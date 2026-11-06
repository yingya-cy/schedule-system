import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool, q, q1, getConfig, buildDays } from './db.js';
import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import { ZipArchive } from 'archiver';
import crypto from 'crypto';
import { summarizeWorklist } from './admin-worklist.mjs';
import { registerJudgeRoutes } from './judge.mjs';
import { aiReady, runDaily, generateCommentFor } from './ai-digest.mjs';
import { gradeAndStore } from './ai-quality.mjs';

// 质量检测并发闸门：后台检测最多同时跑 2 个，避免晚间集中保存把视觉模型打满
const _qWait = [];
let _qBusy = 0;
function enqueueQuality(task) {
  return new Promise((resolve) => {
    _qWait.push(() => task().then(resolve).catch(() => resolve(null)));
    const pump = () => {
      if (_qBusy >= 2 || !_qWait.length) return;
      _qBusy++;
      const fn = _qWait.shift();
      fn().finally(() => { _qBusy--; pump(); });
    };
    pump();
  });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============ 校区归一化（支持多校区写法）============
// 配置键 campus_aliases: {"河源":["河源","河源校区"],"白云":["白云","白云校区","北校区"]}
// 配置键 campus_list  : ["河源","白云","天河","清远"]  —— 用于识别"未知校区"并告警
const DEFAULT_CAMPUS_ALIASES = {
  '河源校区': ['河源', '河源校区', 'hy'],
  '白云校区': ['白云', '白云校区', '北校区', 'by'],
  '东校区': ['东', '东校区', '东区'],
  '西校区': ['西', '西校区', '西区'],
};
function campusKey(s) {
  return String(s || '')
    .replace(/\s/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/(校区|校区部)$/, '')
    .trim();
}
async function loadCampusAliases() {
  try {
    const rows = await q("SELECT k, v FROM gratitude_config WHERE k IN ('campus_aliases','campus_list')");
    const m = {};
    for (const r of rows) m[r.k] = r.v;
    const aliases = m.campus_aliases ? JSON.parse(m.campus_aliases) : DEFAULT_CAMPUS_ALIASES;
    const list = m.campus_list ? JSON.parse(m.campus_list) : Object.keys(aliases);
    return { aliases, list };
  } catch (e) {
    return { aliases: DEFAULT_CAMPUS_ALIASES, list: Object.keys(DEFAULT_CAMPUS_ALIASES) };
  }
}
function normalizeCampus(raw, cfg) {
  const k = campusKey(raw);
  if (!k) return { value: '河源校区', known: true, fallback: true };
  for (const [canonical, variants] of Object.entries(cfg.aliases)) {
    if (campusKey(canonical) === k) return { value: canonical, known: true };
    if ((variants || []).some(v => campusKey(v) === k)) return { value: canonical, known: true };
  }
  for (const canonical of cfg.list) if (campusKey(canonical) === k) return { value: canonical, known: true };
  return { value: campusKey(raw) || String(raw).trim(), known: false };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ============ 图片上传 ============
const UP_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UP_DIR, { recursive: true });

// 先存到临时目录（因为 multer 阶段 req.body 还没解析完）
const TMP_DIR = path.join(UP_DIR, '_tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 兜底：_tmp 可能被外部清理删掉，每次上传前确保目录存在
    try { fs.mkdirSync(TMP_DIR, { recursive: true }); } catch (e) { /* 已存在 */ }
    cb(null, TMP_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 32 * 1024 * 1024 },         // 20MB（图片5M + 视频15M）
  fileFilter: (req, file, cb) => {
    const isImg = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    const isVid = /^video\/(mp4|quicktime|webm|x-msvideo)$/.test(file.mimetype);
    const isAud = /^audio\/(mpeg|mp3|mp4|x-m4a|m4a|wav|x-wav|wave|aac|ogg|x-ogg|webm|3gpp)$/.test(file.mimetype);
    cb((isImg || isVid || isAud) ? null : new Error('只支持图片、视频或录音'), isImg || isVid || isAud);
  },
});

// ============ 工具 ============
const ok = (res, data) => res.json({ success: true, data });
const fail = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ============ 时区安全的本地日期（修 P1 时区 bug）============
// 旧写法 new Date().toISOString().slice(0,10) 取的是 UTC 日期，
// 在 UTC+8 的服务器上，每天 00:00~07:59 会算成"昨天" → 学生打不了当天的卡。
function todayStr() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============ 管理端鉴权（修 P0 无鉴权）============
const ADMIN_USER = process.env.ADMIN_USER || 'pengbei';
const ADMIN_PASS = process.env.ADMIN_PASS || '525';
const ADMIN_SECRET = process.env.ADMIN_SECRET || crypto.randomBytes(16).toString('hex');
const adminTokens = new Set();   // 已登录的管理端 token（内存态）

function makeAdminToken() {
  const t = crypto.randomBytes(24).toString('hex');
  adminTokens.add(t);
  return t;
}
function isAdmin(req) {
  const t = req.headers['x-admin-token'] || req.query.admin_token;
  return !!t && adminTokens.has(t);
}
// 中间件：保护所有管理端接口
function adminOnly(req, res, next) {
  if (isAdmin(req)) return next();
  return res.status(401).json({ success: false, error: '需要管理员权限' });
}

// ============ 0. 管理端登录 ============
app.post('/api/admin/login', async (req, res) => {
  try {
    const { user, pass } = req.body || {};
    if (String(user) === ADMIN_USER && String(pass) === ADMIN_PASS) {
      const token = makeAdminToken();
      return ok(res, { token });
    }
    return fail(res, '账号或密码错误', 401);
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 0.1 管理端退出 ============
app.post('/api/admin/logout', (req, res) => {
  const t = req.headers['x-admin-token'];
  if (t) adminTokens.delete(t);
  ok(res, { logged_out: true });
});

// ============ 0.2 检查登录态 ============
app.get('/api/admin/check', (req, res) => ok(res, { admin: isAdmin(req) }));

// ============ 1. 活动信息 ============
app.get('/api/info', async (req, res) => {
  try {
    const cfg = await getConfig();
    ok(res, {
      title: cfg.title,
      start_date: cfg.start_date,
      end_date: cfg.end_date,
      total_days: +cfg.total_days,
      days: buildDays(cfg.start_date, +cfg.total_days),
    });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 2. 登录 ============
app.post('/api/login', async (req, res) => {
  try {
    const { student_id, name, phone4, invite_code } = req.body;
    if (!student_id || !name) return fail(res, '请填写学号和姓名');

    const sid = String(student_id).trim();
    const nm = String(name).trim();

    const cfg = await getConfig();
    // 邀请码（配置了才校验；留空=不校验）
    if (cfg.invite_code && invite_code !== cfg.invite_code) {
      return fail(res, '邀请码不正确');
    }

    // ⭐ 白名单模式：必须已在名单里，不自动注册
    const p = await q1('SELECT * FROM gratitude_participants WHERE student_id = ?', [sid]);

    if (!p) {
      return fail(res, '不在报名名单中，请先完成报名', 403);
    }
    if (p.name !== nm) {
      return fail(res, '姓名与学号不匹配，请检查后重试', 403);
    }

    // 手机后4位（名单里有电话时才校验）
    if (phone4 && p.phone && !String(p.phone).endsWith(String(phone4))) {
      return fail(res, '手机号后4位不匹配', 403);
    }

    await pool.execute('UPDATE gratitude_participants SET last_login_at = NOW() WHERE id = ?', [p.id]);
    ok(res, {
      id: p.id, student_id: p.student_id, name: p.name,
      college: p.college, class_name: p.class_name, campus: p.campus,
    });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 3. 我的打卡状态 ============
app.get('/api/days/:pid', async (req, res) => {
  try {
    const pid = +req.params.pid;
    if (!Number.isInteger(pid) || pid <= 0) return fail(res, '参数不合法');
    // 校验参与者存在（修 P2：已删 participant 会显示"0天"假象）
    const exists = await q1('SELECT id FROM gratitude_participants WHERE id = ?', [pid]);
    if (!exists) return fail(res, '用户不存在，请重新登录', 404);
    const cfg = await getConfig();
    const all = buildDays(cfg.start_date, +cfg.total_days);
    const done = await q(
      'SELECT day_no, action_images, created_at, updated_at FROM gratitude_days WHERE participant_id = ?',
      [pid]
    );
    const doneMap = {};
    for (const d of done) doneMap[d.day_no] = d;

    const today = todayStr();
    const testMode = cfg.test_mode === '1';   // 【测试模式】无视日期限制
    const days = all.map(d => {
      const rec = doneMap[d.day_no];
      return {
        ...d,
        done: !!rec,
        is_today: d.date === today,
        is_future: testMode ? false : d.date > today,     // 测试模式：全开放
        can_edit: true,
        action_images: rec?.action_images ? (typeof rec.action_images === 'string' ? JSON.parse(rec.action_images) : rec.action_images) : [],
        updated_at: rec?.updated_at || null,
      };
    });

    ok(res, {
      total: +cfg.total_days,
      done_count: done.length,
      progress: Math.round(done.length / +cfg.total_days * 100),
      today,
      days,
    });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 4. 单天详情 ============
app.get('/api/day/:pid/:dayno', async (req, res) => {
  try {
    const pid = +req.params.pid, dayno = +req.params.dayno;
    const cfg = await getConfig();
    const all = buildDays(cfg.start_date, +cfg.total_days);
    const d = all.find(x => x.day_no === dayno);
    if (!d) return fail(res, '天数超出范围');

    const rec = await q1('SELECT * FROM gratitude_days WHERE participant_id=? AND day_no=?', [pid, dayno]);
    const imgs = rec?.action_images
      ? (typeof rec.action_images === 'string' ? JSON.parse(rec.action_images) : rec.action_images)
      : [];

    // 该天的图片（从 uploads 表查）
    const ups = await q('SELECT id, file_path, kind, mime_type, created_at FROM gratitude_uploads WHERE participant_id=? AND day_no=? ORDER BY id', [pid, dayno]);

    ok(res, {
      ...d,
      action_images: imgs,
      uploads: ups,
      is_special: dayno === +cfg.total_days,   // 第21天特殊
    });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 5. 保存打卡 ============
app.post('/api/day', async (req, res) => {
  try {
    const { participant_id, day_no, action_images } = req.body;
    if (!participant_id || !day_no) return fail(res, '缺少参数');

    const cfg = await getConfig();
    const all = buildDays(cfg.start_date, +cfg.total_days);
    const d = all.find(x => x.day_no === +day_no);
    if (!d) return fail(res, '天数超出范围');

    const today = todayStr();
    const isMakeup = d.date < today;              // 补卡：应打卡日已过
    if (cfg.test_mode !== '1') {
      if (today > cfg.end_date) return fail(res, '活动已经结束啦，不能再补卡了');
      if (d.date > today) return fail(res, '还没到这一天哦～');
      if (isMakeup) {
        // 已用掉的补卡次数（不含当前这一天，避免重复编辑重复计数）
        const mk = await q1(
          `SELECT COUNT(*) AS n FROM gratitude_days
            WHERE participant_id = ? AND day_no <> ?
              AND log_date <> DATE_ADD(?, INTERVAL day_no - 1 DAY)`,
          [participant_id, +day_no, cfg.start_date]
        );
        if (Number(mk && mk.n || 0) >= 3) {
          return fail(res, '最多只能补 3 天哦，这次补卡机会已经用完了');
        }
      }
    }

    // ⚠️ 防护：必须至少提交 1 张图（防前端 bug 传空数组导致清空）
    const imgsArr = Array.isArray(action_images) ? action_images.filter(Boolean) : [];
    if (imgsArr.length === 0) {
      return fail(res, '请至少上传一张图片');
    }
    if (imgsArr.length > 5) {
      return fail(res, '图片最多 5 张');     // 防异常
    }
    // 每张路径必须是安全的相对路径（防注入/穿越）
    // ⚠️ 且必须属于 "该人该天" 的目录（防日期错乱时把别的天的图挂错）
    const expectPrefix = `${participant_id}/${day_no}/`;
    for (const pth of imgsArr) {
      if (typeof pth !== 'string' || pth.includes('..') || pth.startsWith('/')) {
        return fail(res, '图片路径不合法');
      }
      if (!pth.startsWith(expectPrefix)) {
        return fail(res, `图片路径与天数不匹配（应为 ${expectPrefix}xxx）`);
      }
    }

    // ⭐ 以本次提交的 action_images 为唯一真相，重建 uploads 记录
    const keepPaths = (Array.isArray(action_images) ? action_images : []).filter(Boolean);

    // 1) 先找出该人该天已有的记录
    const existing = await q(
      'SELECT id, file_path FROM gratitude_uploads WHERE participant_id=? AND day_no=?',
      [participant_id, day_no]
    );
    const existingPaths = existing.map(u => u.file_path);

    // 2) 删除"已有但本次没提交"的（含磁盘文件）
    for (const u of existing) {
      if (keepPaths.includes(u.file_path)) continue;
      try {
        const abs = path.resolve(UP_DIR, u.file_path);
        if (abs.startsWith(UP_DIR + path.sep) && fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch (_) {}
      await pool.execute('DELETE FROM gratitude_uploads WHERE id = ?', [u.id]);
    }

    // 3) 为"本次提交但库里还没有"的补记录（新上传的）
    for (const pth of keepPaths) {
      if (existingPaths.includes(pth)) continue;
      const abs = path.resolve(UP_DIR, pth);
      const isVid = /\.(mp4|mov|webm|avi|m4v)$/i.test(pth);
      const isAud = /\.(mp3|m4a|wav|aac|ogg|opus|amr|3gp)$/i.test(pth);
      const kindByExt = isVid ? 'video' : (isAud ? 'audio' : 'image');
      const mimeByExt = isVid ? 'video/mp4'
        : /\.mp3$/i.test(pth) ? 'audio/mpeg'
        : /\.(m4a|mp4)$/i.test(pth) ? 'audio/mp4'
        : /\.wav$/i.test(pth) ? 'audio/wav'
        : /\.aac$/i.test(pth) ? 'audio/aac'
        : /\.ogg$/i.test(pth) ? 'audio/ogg'
        : /\.(opus)$/i.test(pth) ? 'audio/opus'
        : /\.(amr)$/i.test(pth) ? 'audio/amr'
        : /\.3gp$/i.test(pth) ? 'audio/3gpp'
        : 'image/jpeg';
      let size = 0;
      try { if (fs.existsSync(abs)) size = fs.statSync(abs).size; } catch (_) {}
      await pool.execute(
        'INSERT INTO gratitude_uploads (participant_id, day_no, kind, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?, ?)',
        [participant_id, day_no, kindByExt, pth, size, mimeByExt]
      );
    }

    await pool.execute(`
      INSERT INTO gratitude_days (participant_id, day_no, log_date, action_images)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        action_images=VALUES(action_images), updated_at=NOW()
    `, [participant_id, day_no, today, imgsArr.length ? JSON.stringify(imgsArr) : null]);

    // 便签质量检测：改为异步后台跑，保存立即返回（用户体验优先，2026-11-04）
    // 结果只落库供管理端筛“优秀便签”，不再当场打断学生
    if (keepPaths.length) {
      enqueueQuality(async () => {
        const g = await gradeAndStore({
          pid: participant_id, dayno: day_no, upDir: UP_DIR, relPaths: keepPaths, budgetMs: 20000,
        });
        // 判定完成后顺手生成一句：差劲→提醒，普通/优秀→评语（2026-11-04 用户设计）
        if (!g || g.pending || !g.day_grade) return g;
        if (g.day_grade === '差劲' && g.reminder && g.reminder.msg) {
          // 差劲档：用按原因码分好的固定文案，措辞与问题一致，也省一次模型调用
          await q(`INSERT INTO gratitude_comments (participant_id, day_no, grade, kind, comment)
                   VALUES (?,?,?,?,?)
                   ON DUPLICATE KEY UPDATE grade=VALUES(grade), kind=VALUES(kind), comment=VALUES(comment), hidden=0`,
            [participant_id, day_no, '差劲', 'reminder', g.reminder.msg]).catch(() => {});
        } else {
          if (g.day_grade === '差劲') {
            await generateCommentFor(participant_id, day_no, { grade: g.day_grade }).catch(() => {});
          }
        }
        return g;
      });
    }
    ok(res, { day_no, saved: true, images: keepPaths.length });
    // 异步生成一句回应，不阻塞保存
    // AI 评语功能暂停上线：改为手动触发，不再在保存打卡时自动调用（2026-11-04 用户要求）
    // if (aiReady()) generateCommentFor(participant_id, day_no).catch(() => {});
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 6. 图片上传 ============
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, '没有文件');
    // 正确读取（multer 解析完 body 后）
    // ⚠️ 强校验：pid 必须正整数、dayno 必须 1..21（修 P0 路径穿越写）
    const pidNum = parseInt(req.body.participant_id || req.query.participant_id, 10);
    if (!Number.isInteger(pidNum) || pidNum <= 0) {
      fs.unlink(req.file.path, () => {});
      return fail(res, 'participant_id 不合法');
    }
    const dayNum = parseInt(req.body.day_no || req.query.day_no, 10) || 0;
    if (dayNum < 0 || dayNum > 21) {
      fs.unlink(req.file.path, () => {});
      return fail(res, 'day_no 不合法');
    }
    const pid = String(pidNum);
    const dayno = dayNum;

    // 移动到最终目录：uploads/<pid>/<day>/
    const destDir = path.join(UP_DIR, pid, String(dayno));
    fs.mkdirSync(destDir, { recursive: true });
    const finalPath = path.join(destDir, path.basename(req.file.path));
    fs.renameSync(req.file.path, finalPath);

    // 相对路径（用于 URL 访问）
    const rel = path.relative(UP_DIR, finalPath).replace(/\\/g, '/');
    const url = `/api/gratitude/img/${rel}`;

    // kind 由 mime 自动判断
    const kind = req.file.mimetype.startsWith('video/') ? 'video'
               : req.file.mimetype.startsWith('audio/') ? 'audio' : 'image';
    if (kind === 'audio' && dayno !== 21) {
      try { fs.unlinkSync(finalPath); } catch (_) {}
      return fail(res, '录音只能作为第 21 天的最终提交素材上传');
    }
    // ⭐ 不写库！等"保存打卡"时再统一写（避免未保存的新图变成幽灵记录）
    ok(res, { url, path: rel, size: req.file.size, kind });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 7. 图片访问 ============
// 注意：nginx 把 /api/gratitude/ 重写成 /api/，所以实际到后端的是 /api/img/*
// ⚠️ 安全读图（修 P1 路径穿越：startsWith 前缀匹配可被兄弟目录绕过）
function sendImg(req, res) {
  const rel = String(req.params[0] || '');
  if (rel.includes('..') || rel.includes('\\0')) return fail(res, '非法路径', 400);
  const p = path.resolve(UP_DIR, rel);
  // 必须严格在 UP_DIR 之内
  if (!(p === UP_DIR || p.startsWith(UP_DIR + path.sep))) return fail(res, '图片不存在', 404);
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return fail(res, '图片不存在', 404);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(p);
}
app.get('/api/img/*', sendImg);
app.get('/api/gratitude/img/*', sendImg);   // 直连后端时用

// ============ 8. 管理端：进度总表 ============
app.get('/api/admin/list', adminOnly, async (req, res) => {
  try {
    const { campus } = req.query;
    const cond = campus ? 'AND p.campus = ?' : '';
    const params = campus ? [campus] : [];
    const rows = await q(`
      SELECT p.id, p.student_id, p.name, p.college, p.class_name, p.campus,
             COUNT(d.id) AS days_done
      FROM gratitude_participants p
      LEFT JOIN gratitude_days d ON d.participant_id = p.id
      WHERE 1=1 ${cond}
      GROUP BY p.id
      ORDER BY days_done DESC, p.name
    `, params);
    const records = await q('SELECT participant_id, day_no FROM gratitude_days');
    const scores = await q('SELECT participant_id, judge_name FROM gratitude_scores');
    const cfg = await getConfig();
    ok(res, summarizeWorklist(rows, records, scores, buildDays(cfg.start_date, +cfg.total_days), todayStr()));
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 9. 管理端：某人详情 ============
app.get('/api/admin/detail/:pid', adminOnly, async (req, res) => {
  try {
    const pid = +req.params.pid;
    const p = await q1('SELECT * FROM gratitude_participants WHERE id = ?', [pid]);
    if (!p) return fail(res, '未找到', 404);
    const days = await q('SELECT * FROM gratitude_days WHERE participant_id=? ORDER BY day_no', [pid]);
    const ups = await q('SELECT * FROM gratitude_uploads WHERE participant_id=? ORDER BY day_no, id', [pid]);
    const scores = await q('SELECT * FROM gratitude_scores WHERE participant_id=?', [pid]);
    ok(res, { participant: p, days, uploads: ups, scores });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 9.5 管理端：全部素材总览 ============
app.get('/api/admin/materials', adminOnly, async (req, res) => {
  try {
    const rows = await q(`
      SELECT u.id, u.participant_id, u.day_no, u.kind, u.file_path, u.file_size, u.mime_type, u.created_at,
             p.name, p.student_id, p.campus, p.class_name
      FROM gratitude_uploads u
      JOIN gratitude_participants p ON p.id = u.participant_id
      ORDER BY u.id DESC
    `);
    const stats = { total: rows.length, image: 0, video: 0, audio: 0, other: 0, people: 0 };
    const set = new Set();
    for (const r of rows) {
      const k = r.kind || 'image';
      stats[k] = (stats[k] || 0) + 1;
      set.add(r.participant_id);
    }
    stats.people = set.size;
    ok(res, { items: rows, stats });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 11. 排名（总分） ============
app.get('/api/admin/rank', adminOnly, async (req, res) => {
  try {
    const rows = await q(`
      SELECT p.id, p.name, p.class_name, p.campus,
             COUNT(DISTINCT d.day_no) AS days_done,
             IFNULL(SUM(s.score_real+s.score_theme+s.score_quality+s.score_text+s.score_creative),0) AS judge_total,
             COUNT(DISTINCT s.judge_name) AS judge_count
      FROM gratitude_participants p
      LEFT JOIN gratitude_days d ON d.participant_id = p.id
      LEFT JOIN gratitude_scores s ON s.participant_id = p.id
      GROUP BY p.id
      ORDER BY judge_total DESC, days_done DESC
    `);
    ok(res, { list: rows });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 11.5 管理端：读配置 ============
app.get('/api/admin/config', adminOnly, async (req, res) => {
  try {
    const cfg = await getConfig();
    ok(res, cfg);
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 11.6 管理端：改配置（含测试模式开关）============
app.post('/api/admin/config', adminOnly, async (req, res) => {
  try {
    const allowed = ['test_mode', 'start_date', 'end_date', 'invite_code', 'title'];
    const updates = [];
    for (const [k, v] of Object.entries(req.body)) {
      if (allowed.includes(k)) updates.push([k, String(v)]);
    }
    for (const [k, v] of updates) {
      await pool.execute(`
        INSERT INTO gratitude_config (k, v) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE v = VALUES(v)
      `, [k, v]);
    }
    ok(res, { updated: updates.map(x => x[0]) });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 11.7 管理端：导入名单 ============
// 支持 xlsx / csv，字段：学号 / 姓名 / 学院 / 班级 / 联系电话 / 微信号 / 校区
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/admin/import', adminOnly, memUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, '没有文件');
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) return fail(res, '文件里没有数据');

    // 字段名模糊匹配（问卷星导出的表头可能不同）
    const pick = (row, keys) => {
      for (const k of Object.keys(row)) {
        const kk = String(k).replace(/\s/g, '');
        for (const want of keys) if (kk.includes(want)) return String(row[k]).trim();
      }
      return '';
    };

    let okCount = 0, skipCount = 0;
    const errors = [];
    const warnings = [];
    const campusCfg = await loadCampusAliases();
    for (const r of rows) {
      const student_id = pick(r, ['学号']);
      const name = pick(r, ['姓名', '名字']);
      if (!student_id || !name) { skipCount++; continue; }

      const college = pick(r, ['学院', '系']);
      const class_name = pick(r, ['班级', '班']);
      const phone = pick(r, ['电话', '手机', '联系方式']);
      const wechat = pick(r, ['微信']);
      const campusRaw = pick(r, ['校区']);
      const campusPick = normalizeCampus(campusRaw, campusCfg);
      const campus = campusPick.value;
      if (!campusPick.known) warnings.push(`${name}(${student_id}): 校区「${String(campusRaw).trim()}」不在已知列表，按原文保存`);

      try {
        await pool.execute(`
          INSERT INTO gratitude_participants (student_id, name, college, class_name, phone, wechat, campus)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name=VALUES(name), college=VALUES(college), class_name=VALUES(class_name),
            phone=VALUES(phone), wechat=VALUES(wechat), campus=VALUES(campus)
        `, [student_id, name, college || null, class_name || null, phone || null, wechat || null, campus]);
        okCount++;
      } catch (e) {
        errors.push(`${name}(${student_id}): ${e.message}`);
      }
    }
    ok(res, { imported: okCount, skipped: skipCount, total: rows.length, errors: errors.slice(0, 5), warnings: warnings.slice(0, 10) });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 11.8 管理端：导出 Excel（一天一列，链接到图片查看页）============
app.get('/api/admin/export', adminOnly, async (req, res) => {
  try {
    const baseUrl = process.env.PUBLIC_BASE || 'http://129.204.50.194';
    const TOTAL = 21;

    const people = await q(`
      SELECT p.id, p.student_id, p.name, p.college, p.class_name, p.campus,
             COUNT(DISTINCT d.day_no) AS days_done
      FROM gratitude_participants p
      LEFT JOIN gratitude_days d ON d.participant_id = p.id
      GROUP BY p.id ORDER BY COUNT(DISTINCT d.day_no) DESC, p.name
    `);
    const allDays = await q('SELECT participant_id, day_no FROM gratitude_days');
    const allUps  = await q('SELECT participant_id, day_no, kind, file_path FROM gratitude_uploads ORDER BY id');

    const daySet = {};
    for (const d of allDays) (daySet[d.participant_id] = daySet[d.participant_id] || new Set()).add(d.day_no);
    const upsMap = {};
    for (const u of allUps) (upsMap[u.participant_id] = upsMap[u.participant_id] || []).push(u);

    const wb = new ExcelJS.Workbook();
    wb.creator = '21天感恩成长记';
    const ws = wb.addWorksheet('打卡明细', { views: [{ state: 'frozen', ySplit: 1 }] });

    // 表头：D1..D21 + D21视频
    const headers = ['学号','姓名','学院','班级','校区','打卡天数'];
    for (let n = 1; n <= TOTAL; n++) headers.push(`D${n}`);
    headers.push('D21视频');

    ws.columns = headers.map((h, i) => ({
      header: h, key: 'c' + i,
      width: (i === 0) ? 16 : (h.startsWith('D') ? 12 : 12),
    }));

    const headRow = ws.getRow(1);
    headRow.font = { bold: true, size: 11, color: { argb: 'FF2E5C8A' } };
    headRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6FB' } };
    headRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headRow.height = 22;

    people.forEach((p) => {
      const ups = upsMap[p.id] || [];
      const done = daySet[p.id] || new Set();
      const rowData = [p.student_id, p.name, p.college || '', p.class_name || '', p.campus, p.days_done];
      const linkCells = [];

      for (let n = 1; n <= TOTAL; n++) {
        const col = 6 + n;
        const imgs = ups.filter(u => u.day_no === n && u.kind === 'image');
        if (imgs.length === 1) {
          rowData.push('图片');
          linkCells.push({ col, url: `${baseUrl}/gview?pid=${p.id}&day=${n}`, text: '图片' });
        } else if (imgs.length > 1) {
          rowData.push(imgs.map((_, i) => `图片${i + 1}`).join(' '));
          linkCells.push({ col, url: `${baseUrl}/gview?pid=${p.id}&day=${n}`, text: imgs.map((_, i) => `图片${i + 1}`).join(' ') });
        } else if (done.has(n)) {
          rowData.push('✓');
        } else {
          rowData.push('');
        }
      }
      const vids21 = ups.filter(u => u.day_no === TOTAL && u.kind === 'video');
      if (vids21.length) {
        rowData.push('视频');
        linkCells.push({ col: 6 + TOTAL + 1, url: `${baseUrl}/gview?pid=${p.id}&day=${TOTAL}&v=1`, text: '视频' });
      } else {
        rowData.push('');
      }

      const row = ws.addRow(rowData);
      for (const L of linkCells) {
        const cell = row.getCell(L.col);
        cell.value = { text: L.text, hyperlink: L.url };
        cell.font = { color: { argb: 'FF0563C1' }, underline: true, size: 11 };
      }
      row.getCell(6).alignment = { horizontal: 'center' };
      for (let i = 7; i <= headers.length; i++) row.getCell(i).alignment = { horizontal: 'center' };
      row.height = 18;
    });

    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

    const buf = await wb.xlsx.writeBuffer();
    const fname = encodeURIComponent(`感恩打卡明细_${todayStr()}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${fname}`);
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error('[export error]', e);
    fail(res, e.message, 500);
  }
});

// ============ 11.8.1 某天图片数据（给查看页用）============
app.get('/api/view/day', async (req, res) => {
  try {
    const pid = +req.query.pid, day = +req.query.day;
    if (!Number.isInteger(pid) || !Number.isInteger(day) || day < 1 || day > 21) {
      return fail(res, '参数不合法');
    }
    const cfg = await getConfig();
    const all = buildDays(cfg.start_date, +cfg.total_days);
    const d = all.find(x => x.day_no === day);

    const person = await q1('SELECT name, student_id FROM gratitude_participants WHERE id = ?', [pid]);
    if (!person) return fail(res, '用户不存在', 404);

    const ups = await q(
      'SELECT kind, file_path, file_size, mime_type FROM gratitude_uploads WHERE participant_id=? AND day_no=? ORDER BY id',
      [pid, day]
    );

    ok(res, {
      person: { name: person.name, student_id: person.student_id },
      day, label: d?.label || `第${day}天`, date: d?.date,
      images: ups.filter(u => u.kind !== 'video'),
      videos: ups.filter(u => u.kind === 'video'),
    });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 11.8.2 图片查看页（HTML）============
app.get('/gview', async (req, res) => {
  try {
    const pid = +req.query.pid, day = +req.query.day;
    const cfg = await getConfig();
    const all = buildDays(cfg.start_date, +cfg.total_days);
    const d = all.find(x => x.day_no === day);
    const person = await q1('SELECT name, student_id FROM gratitude_participants WHERE id = ?', [pid]);

    const ups = person ? await q(
      'SELECT kind, file_path, mime_type FROM gratitude_uploads WHERE participant_id=? AND day_no=? ORDER BY id',
      [pid, day]
    ) : [];

    const imgs = ups.filter(u => u.kind !== 'video');
    const vids = ups.filter(u => u.kind === 'video');

    const itemHtml = (u, i, isVid) => {
      const url = `/api/gratitude/img/${u.file_path}`;
      const dl = `/api/gratitude/download/${u.file_path}`;
      const name = isVid ? `视频${i + 1}` : `图片${i + 1}`;
      return `
      <div class="item">
        <div class="cap">${name}</div>
        ${isVid
          ? `<video src="${url}" controls preload="metadata" style="width:100%;max-height:70vh;background:#000;border-radius:10px;"></video>`
          : `<img src="${url}" loading="lazy" onclick="window.open('${url}','_blank')">`}
        <div class="btns">
          <a class="btn" href="${url}" target="_blank">查看原图</a>
          <a class="btn dl" href="${dl}">下载</a>
        </div>
      </div>`;
    };

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${person ? person.name : '未知'} · ${d ? d.label : ''} · 感恩打卡</title>
<style>
  body{margin:0;background:#f5f3f0;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;}
  .head{background:#fff;padding:16px 20px;border-bottom:1px solid #ece7e0;position:sticky;top:0;z-index:10;}
  .head h1{margin:0;font-size:18px;color:#2E5C8A;}
  .head p{margin:4px 0 0;font-size:12px;color:#999;}
  .wrap{padding:18px;max-width:900px;margin:0 auto;}
  .item{background:#fff;border-radius:14px;padding:14px;margin-bottom:16px;box-shadow:0 1px 6px rgba(0,0,0,.06);}
  .cap{font-size:13px;color:#C97B54;font-weight:600;margin-bottom:10px;}
  .item img{width:100%;border-radius:10px;cursor:zoom-in;display:block;}
  .btns{display:flex;gap:10px;margin-top:12px;}
  .btn{flex:1;text-align:center;padding:10px;border-radius:10px;font-size:13px;text-decoration:none;
       background:#f0f4fa;color:#2E5C8A;font-weight:500;}
  .btn.dl{background:#C97B54;color:#fff;}
  .empty{text-align:center;padding:60px 20px;color:#bbb;font-size:14px;}
  .foot{text-align:center;padding:20px;font-size:11px;color:#ccc;}
</style></head>
<body>
  <div class="head">
    <h1>${person ? person.name : '未知用户'} <span style="font-size:12px;color:#aaa;font-weight:400;">${person ? person.student_id : ''}</span></h1>
    <p>${d ? d.label : ''} (${d ? d.date : ''}) · 第 ${day} 天 · 共 ${imgs.length} 张图片${vids.length ? ` + ${vids.length} 个视频` : ''}</p>
  </div>
  <div class="wrap">
    ${(imgs.length + vids.length) ? imgs.map((u, i) => itemHtml(u, i, false)).join('') + vids.map((u, i) => itemHtml(u, i, true)).join('')
      : '<div class="empty">这一天没有图片</div>'}
  </div>
  <div class="foot">21天感恩成长记 · 朋辈心理健康服务队</div>
</body></html>`);
  } catch (e) {
    res.status(500).send('加载失败: ' + e.message);
  }
});

// ============ 11.8.3 图片下载（强制附件）============
function downloadImg(req, res) {
  const rel = String(req.params[0] || '');
  if (rel.includes('..') || rel.includes('\0')) return res.status(400).end();
  const p = path.resolve(UP_DIR, rel);
  if (!(p === UP_DIR || p.startsWith(UP_DIR + path.sep)) || !fs.existsSync(p)) return res.status(404).end();
  res.download(p);
}
app.get('/api/download/*', downloadImg);
app.get('/api/gratitude/download/*', downloadImg);

// ============ 11.9 名单管理：列表（含打卡数）============
app.get('/api/admin/roster', adminOnly, async (req, res) => {
  try {
    const rows = await q(`
      SELECT p.id, p.student_id, p.name, p.college, p.class_name, p.campus, p.phone, p.wechat,
             p.created_at, p.last_login_at,
             COUNT(DISTINCT d.day_no) AS days_done
      FROM gratitude_participants p
      LEFT JOIN gratitude_days d ON d.participant_id = p.id
      GROUP BY p.id ORDER BY p.id DESC
    `);
    ok(res, { total: rows.length, list: rows });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 11.10 名单管理：手动加人 ============
app.post('/api/admin/roster', adminOnly, async (req, res) => {
  try {
    const { student_id, name, college, class_name, campus, phone, wechat } = req.body;
    if (!student_id || !name) return fail(res, '学号和姓名必填');
    const sid = String(student_id).trim();
    const exists = await q1('SELECT id FROM gratitude_participants WHERE student_id = ?', [sid]);
    if (exists) return fail(res, '该学号已存在');

    const r = await pool.execute(`
      INSERT INTO gratitude_participants (student_id, name, college, class_name, campus, phone, wechat)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [sid, String(name).trim(), college || null, class_name || null, normalizeCampus(campus, await loadCampusAliases()).value, phone || null, wechat || null]);
    ok(res, { id: r[0].insertId });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 11.11 名单管理：删除 ============
app.delete('/api/admin/roster/:pid', adminOnly, async (req, res) => {
  try {
    const pid = +req.params.pid;
    if (!Number.isInteger(pid) || pid <= 0) return fail(res, '参数不合法');
    const p = await q1('SELECT name FROM gratitude_participants WHERE id = ?', [pid]);
    if (!p) return fail(res, '不存在', 404);
    // 检查是否已有打卡记录
    const cnt = await q1('SELECT COUNT(*) AS n FROM gratitude_days WHERE participant_id = ?', [pid]);
    if (cnt.n > 0 && !req.query.force) {
      return fail(res, `${p.name} 已有 ${cnt.n} 天打卡记录，删除会一并删除。确认请加 ?force=1`);
    }
    // 记录删除日志（便于事后追溯，就像你那次靠 SQL 记录找回数据）
    console.log(`[DELETE participant] id=${pid} name=${p.name} days=${cnt.n} at=${new Date().toISOString()}`);
    await pool.execute('DELETE FROM gratitude_participants WHERE id = ?', [pid]);
    ok(res, { deleted: true, name: p.name });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 11.12 导入预览（不写库，只看会怎样）============
app.post('/api/admin/import-preview', adminOnly, memUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, '没有文件');
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const pick = (row, keys) => {
      for (const k of Object.keys(row)) {
        const kk = String(k).replace(/\s/g, '');
        for (const want of keys) if (kk.includes(want)) return String(row[k]).trim();
      }
      return '';
    };

    const items = [];
    const campusCfgPrev = await loadCampusAliases();
    for (const r of rows) {
      const student_id = pick(r, ['学号']);
      const name = pick(r, ['姓名', '名字']);
      if (!student_id || !name) continue;
      const exists = await q1('SELECT id, name FROM gratitude_participants WHERE student_id = ?', [student_id]);
      const campusPick = normalizeCampus(pick(r, ['校区']), campusCfgPrev);
      items.push({
        student_id, name,
        college: pick(r, ['学院', '系']),
        class_name: pick(r, ['班级', '班']),
        campus: campusPick.value,
        campus_known: campusPick.known,
        action: exists ? (exists.name === name ? '更新' : `改名(${exists.name}→${name})`) : '新增',
      });
    }
    ok(res, {
      total: items.length,
      will_add: items.filter(x => x.action === '新增').length,
      will_update: items.filter(x => x.action === '更新').length,
      will_rename: items.filter(x => x.action.startsWith('改名')).length,
      unknown_campus: items.filter(x => x.campus_known === false).length,
      preview: items.slice(0, 20),
    });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 11.13 导出 ZIP（每人一个文件夹，图片视频按天命名）============
app.get('/api/admin/export-zip', adminOnly, async (req, res) => {
  try {
    // 一次性取全量（避免 N+1）
    const people = await q(`
      SELECT p.id, p.student_id, p.name, p.campus,
             COUNT(DISTINCT d.day_no) AS days_done
      FROM gratitude_participants p
      LEFT JOIN gratitude_days d ON d.participant_id = p.id
      GROUP BY p.id
      ORDER BY p.campus, p.id
    `);
    const allUps = await q(
      'SELECT participant_id, day_no, kind, file_path FROM gratitude_uploads ORDER BY participant_id, day_no, id'
    );

    // 按人分组
    const upsMap = {};
    for (const u of allUps) (upsMap[u.participant_id] = upsMap[u.participant_id] || []).push(u);

    // 文件名清理（去掉 Windows 非法字符）
    const safe = (str) => String(str || '').replace(/[\\/:*?"<>|\r\n]/g, '_').trim() || 'unknown';

    const ts = todayStr().replace(/-/g, '');
    const zipName = `感恩打卡导出_${ts}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`);
    // 大文件：禁用超时缓冲
    res.setHeader('X-Accel-Buffering', 'no');

    const archive = new ZipArchive({ zlib: { level: 1 } });   // 图片已压缩，level 1 快速打包
    archive.on('warning', (err) => { if (err.code !== 'ENOENT') console.error('[zip warn]', err); });
    archive.on('error', (err) => { console.error('[zip error]', err); try { res.status(500).end(); } catch (_) {} });
    archive.pipe(res);

    // 逐人打包
    for (const p of people) {
      const folder = `${safe(p.name)}_${safe(p.student_id)}`;
      const ups = upsMap[p.id] || [];

      // 按天分组，序号从 1 开始
      const byDay = {};
      for (const u of ups) (byDay[u.day_no] = byDay[u.day_no] || []).push(u);

      for (const dayNo of Object.keys(byDay).map(Number).sort((a, b) => a - b)) {
        const list = byDay[dayNo];
        let imgIdx = 0;
        for (const u of list) {
          const abs = path.resolve(UP_DIR, u.file_path);
          if (!abs.startsWith(UP_DIR + path.sep) || !fs.existsSync(abs)) continue;

          const ext = path.extname(abs) || (u.kind === 'video' ? '.mp4' : '.jpg');
          const dd = String(dayNo).padStart(2, '0');    // D01, D02, ...
          let outName;
          if (u.kind === 'video') {
            outName = `D${dd}_video${ext}`;
          } else {
            imgIdx++;
            outName = `D${dd}_${imgIdx}${ext}`;
          }
          archive.file(abs, { name: `${folder}/${outName}` });
        }
      }
    }

    // 附一个汇总表（可选，方便对照）
    const summary = people.map(p => ({
      姓名: p.name, 学号: p.student_id, 校区: p.campus, 打卡天数: p.days_done,
      文件夹: `${safe(p.name)}_${safe(p.student_id)}`,
    }));
    const csv = '\uFEFF' + ['姓名,学号,校区,打卡天数,文件夹']
      .concat(summary.map(x => `${x.姓名},${x.学号},${x.校区},${x.打卡天数},${x.文件夹}`))
      .join('\n');
    archive.append(Buffer.from(csv, 'utf8'), { name: '汇总表.csv' });

    await archive.finalize();
  } catch (e) {
    console.error('[export-zip error]', e);
    try { fail(res, e.message, 500); } catch (_) {}
  }
});

// ============ 11.14 评分结果查询（按人聚合，含各评委明细）============
app.get('/api/admin/scores', adminOnly, async (req, res) => {
  try {
    const rows = await q(`
      SELECT s.participant_id, p.name, p.student_id, p.college, p.class_name, p.campus,
             s.judge_name, s.score_real, s.score_theme, s.score_quality, s.score_text, s.score_creative,
             s.comment, s.updated_at,
             (s.score_real + s.score_theme + s.score_quality + s.score_text + s.score_creative) AS total
      FROM gratitude_scores s
      JOIN gratitude_participants p ON p.id = s.participant_id
      ORDER BY p.id
    `);
    // 打卡天数
    const dayCnt = await q('SELECT participant_id, COUNT(DISTINCT day_no) AS n FROM gratitude_days GROUP BY participant_id');
    const dayMap = {};
    for (const d of dayCnt) dayMap[d.participant_id] = d.n;

    // 按人聚合
    const byPerson = {};
    for (const r of rows) {
      const k = r.participant_id;
      if (!byPerson[k]) {
        byPerson[k] = {
          id: k, name: r.name, student_id: r.student_id,
          college: r.college, class_name: r.class_name, campus: r.campus,
          days_done: dayMap[k] || 0,
          judges: [], sum: 0,
        };
      }
      byPerson[k].judges.push({
        judge_name: r.judge_name,
        real: r.score_real, theme: r.score_theme, quality: r.score_quality,
        text: r.score_text, creative: r.score_creative,
        total: r.total, comment: r.comment, at: r.updated_at,
      });
      byPerson[k].sum += r.total;
    }

    const list = Object.values(byPerson).map(x => ({
      ...x,
      judge_count: x.judges.length,
      avg: x.judges.length ? +(x.sum / x.judges.length).toFixed(1) : 0,
    })).sort((a, b) => b.avg - a.avg);

    const judgeSet = new Set(rows.map(r => r.judge_name));
    ok(res, { total: list.length, judge_count: judgeSet.size, judges: [...judgeSet], list });
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 11.15 评分结果导出（Excel）============
app.get('/api/admin/scores/export', adminOnly, async (req, res) => {
  try {
    const rows = await q(`
      SELECT s.participant_id, p.name, p.student_id, p.college, p.class_name, p.campus,
             s.judge_name, s.score_real, s.score_theme, s.score_quality, s.score_text, s.score_creative,
             s.comment, s.updated_at,
             (s.score_real + s.score_theme + s.score_quality + s.score_text + s.score_creative) AS total
      FROM gratitude_scores s
      JOIN gratitude_participants p ON p.id = s.participant_id
      ORDER BY p.id
    `);
    const dayCnt = await q('SELECT participant_id, COUNT(DISTINCT day_no) AS n FROM gratitude_days GROUP BY participant_id');
    const dayMap = {};
    for (const d of dayCnt) dayMap[d.participant_id] = d.n;

    // 所有评委名
    const judgeSet = [...new Set(rows.map(r => r.judge_name))];

    // 按人分组
    const byPerson = {};
    for (const r of rows) {
      const k = r.participant_id;
      if (!byPerson[k]) byPerson[k] = { name: r.name, sid: r.student_id, cls: r.class_name, camp: r.campus, judges: {} };
      byPerson[k].judges[r.judge_name] = r.total;
    }

    // 表头：学号 姓名 学院 班级 校区 打卡天数 | 评委甲 评委乙 ... | 平均分 排名
    const headers = ['学号','姓名','学院','班级','校区','打卡天数'];
    for (const j of judgeSet) headers.push(j);
    headers.push('平均分', '排名');

    const list = Object.entries(byPerson).map(([pid, x]) => {
      const totals = Object.values(x.judges);
      const avg = totals.length ? +(totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1) : 0;
      return { pid: +pid, ...x, avg, days: dayMap[+pid] || 0 };
    }).sort((a, b) => b.avg - a.avg);
    list.forEach((x, i) => x.rank = i + 1);

    const wb = new ExcelJS.Workbook();
    wb.creator = '21天感恩成长记';
    const ws = wb.addWorksheet('评分结果', { views: [{ state: 'frozen', ySplit: 1 }] });

    ws.columns = headers.map((h, i) => ({ header: h, key: 'c'+i, width: (i===0?16:12) }));
    const hr = ws.getRow(1);
    hr.font = { bold: true, size: 11, color: { argb: 'FF2E5C8A' } };
    hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6FB' } };
    hr.alignment = { vertical: 'middle', horizontal: 'center' };
    hr.height = 22;

    for (const x of list) {
      const row = [x.sid, x.name, '', x.cls || '', x.camp, x.days];
      for (const j of judgeSet) row.push(x.judges[j] !== undefined ? x.judges[j] : '');
      row.push(x.avg, x.rank);
      const r = ws.addRow(row);
      r.getCell(6).alignment = { horizontal: 'center' };
      for (let i = 7; i <= headers.length; i++) r.getCell(i).alignment = { horizontal: 'center' };
      // 前三名标色
      if (x.rank <= 3) r.getCell(headers.length).font = { bold: true, color: { argb: 'FFC97B54' } };
    }

    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

    // 第二个 sheet：明细（每个评委对每个人的 5 项分）
    const ws2 = wb.addWorksheet('评分明细');
    const h2 = ['学号','姓名','评委','真实性(30)','主题(25)','素材(15)','文字(15)','创意(15)','总分','评语','时间'];
    ws2.columns = h2.map(h => ({ header: h, key: h, width: h.includes('(') ? 11 : 14 }));
    const hr2 = ws2.getRow(1);
    hr2.font = { bold: true, size: 11, color: { argb: 'FF2E5C8A' } };
    hr2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6FB' } };
    for (const r of rows) {
      ws2.addRow([r.student_id, r.name, r.judge_name, r.score_real, r.score_theme, r.score_quality,
                  r.score_text, r.score_creative, r.total, r.comment || '', String(r.updated_at).slice(0, 16).replace('T',' ')]);
    }

    const buf = await wb.xlsx.writeBuffer();
    const fname = encodeURIComponent(`评分结果_${todayStr()}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${fname}`);
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error('[scores export error]', e);
    fail(res, e.message, 500);
  }
});

// ============ 12. 健康检查 ============
registerJudgeRoutes(app, { q, q1, ok, fail, adminOnly, todayStr, ExcelJS });

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'gratitude' }));


// ============ 15. AI：每日简报 & 逐条评语 ============
app.get('/api/comment/unread/:pid', async (req, res) => {
  try {
    const pid = +req.params.pid;
    const rows = await q(`SELECT c.day_no, c.comment, c.grade, c.kind, d.log_date
                            FROM gratitude_comments c
                            LEFT JOIN gratitude_days d
                              ON d.participant_id=c.participant_id AND d.day_no=c.day_no
                           WHERE c.participant_id=? AND c.hidden=0
                           ORDER BY c.day_no DESC LIMIT 21`, [pid]);
    ok(res, { list: rows });
  } catch (e) { fail(res, e.message, 500); }
});

app.get('/api/comment/:pid/:dayno', async (req, res) => {
  try {
    const pid = +req.params.pid, dayno = +req.params.dayno;
    const row = await q1('SELECT comment, hidden FROM gratitude_comments WHERE participant_id=? AND day_no=?', [pid, dayno]);
    if (!row || row.hidden) return ok(res, { comment: '' });
    ok(res, { comment: row.comment });
  } catch (e) { fail(res, e.message, 500); }
});

app.get('/api/admin/ai/status', adminOnly, async (req, res) => {
  try {
    const [o, c, d] = await Promise.all([
      q1('SELECT COUNT(*) n FROM gratitude_ocr'),
      q1('SELECT COUNT(*) n FROM gratitude_comments'),
      q1('SELECT COUNT(*) n FROM gratitude_digests'),
    ]);
    ok(res, { ready: aiReady(), ocr: o.n, comments: c.n, digests: d.n });
  } catch (e) { fail(res, e.message, 500); }
});

app.get('/api/admin/ai/digests', adminOnly, async (req, res) => {
  try {
    const rows = await q(`SELECT digest_date, participants, items_count, digest_text, quote, created_at
                            FROM gratitude_digests ORDER BY digest_date DESC LIMIT 60`);
    ok(res, { list: rows });
  } catch (e) { fail(res, e.message, 500); }
});

app.post('/api/admin/ai/digest/run', adminOnly, async (req, res) => {
  try {
    const date = String((req.body || {}).date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(res, '日期格式应为 YYYY-MM-DD');
    if (!aiReady()) return fail(res, 'AI 未配置');
    const stats = await runDaily(date);
    ok(res, stats);
  } catch (e) { fail(res, e.message, 500); }
});

app.get('/api/admin/ai/candidates', adminOnly, async (req, res) => {
  try {
    const date = String(req.query.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(res, '日期格式应为 YYYY-MM-DD');
    const list = await q(`SELECT x.file_path, x.excerpt, x.chars, x.day_no, x.participant_id,
                                 p.name, p.student_id
                            FROM (
                              SELECT g.participant_id, g.day_no, g.file_path, g.excerpt, g.chars,
                                     ROW_NUMBER() OVER (PARTITION BY g.participant_id, g.day_no ORDER BY g.chars DESC) AS rn
                                FROM gratitude_quality g
                                JOIN gratitude_days d ON d.participant_id = g.participant_id AND d.day_no = g.day_no
                               WHERE d.log_date = ? AND g.grade = '优秀'
                            ) x
                            JOIN gratitude_participants p ON p.id = x.participant_id
                           WHERE x.rn = 1
                           ORDER BY x.chars DESC
                           LIMIT 200`, [date]);
    const stats = await q(`SELECT g.grade, COUNT(DISTINCT CONCAT(g.participant_id, '-', g.day_no)) AS n
                             FROM gratitude_quality g
                             JOIN gratitude_days d ON d.participant_id = g.participant_id AND d.day_no = g.day_no
                            WHERE d.log_date = ?
                            GROUP BY g.grade`, [date]);
    ok(res, { list, stats });
  } catch (e) { fail(res, e.message, 500); }
});

app.get('/api/admin/ai/comments', adminOnly, async (req, res) => {
  try {
    const date = String(req.query.date || '').slice(0, 10);
    const where = date ? 'WHERE d.log_date=?' : '';
    const params = date ? [date] : [];
    const rows = await q(`SELECT c.participant_id, c.day_no, c.comment, c.hidden, p.name, p.student_id, d.log_date
                            FROM gratitude_comments c
                            JOIN gratitude_participants p ON p.id=c.participant_id
                            LEFT JOIN gratitude_days d ON d.participant_id=c.participant_id AND d.day_no=c.day_no
                            ${where}
                           ORDER BY d.log_date DESC, c.participant_id LIMIT 500`, params);
    ok(res, { list: rows });
  } catch (e) { fail(res, e.message, 500); }
});

app.post('/api/admin/ai/comment/hide', adminOnly, async (req, res) => {
  try {
    const { participant_id, day_no, hidden } = req.body || {};
    await q('UPDATE gratitude_comments SET hidden=? WHERE participant_id=? AND day_no=?', [hidden ? 1 : 0, +participant_id, +day_no]);
    ok(res, { done: true });
  } catch (e) { fail(res, e.message, 500); }
});

app.post('/api/admin/ai/comment/run', adminOnly, async (req, res) => {
  try {
    const { participant_id, day_no } = req.body || {};
    const r = await generateCommentFor(+participant_id, +day_no);
    ok(res, r);
  } catch (e) { fail(res, e.message, 500); }
});

// ============ 全局异常处理（防进程崩溃）============
process.on('uncaughtException', (e) => {
  console.error('[uncaughtException]', e && e.stack || e);
});
process.on('unhandledRejection', (e) => {
  console.error('[unhandledRejection]', e && e.stack || e);
});
// express 错误中间件（multer 错误等）
app.use((err, req, res, next) => {
  console.error('[express error]', err && err.message);
  if (res.headersSent) return next(err);
  const msg = err && err.message ? err.message : '服务器错误';
  res.status(400).json({ success: false, error: msg });
});

const PORT = +(process.env.PORT || 5004);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[gratitude] listening on ${PORT}`);
});
