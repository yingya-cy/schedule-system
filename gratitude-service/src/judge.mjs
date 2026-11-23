// 评委端：按部门分片打分 + 排名/综测名单计算
// 通过 registerJudgeRoutes(app, ctx) 挂载到主服务
import crypto from 'crypto';

const DIMS = [
  ['real', 'score_real', 30],
  ['theme', 'score_theme', 25],
  ['quality', 'score_quality', 15],
  ['text', 'score_text', 15],
  ['creative', 'score_creative', 15],
];

export function registerJudgeRoutes(app, ctx) {
  const { q, q1, ok, fail, adminOnly, todayStr } = ctx;

  // ---------- 会话 ----------
  const judgeTokens = new Map(); // token -> {id,name,dept,slice_no}

  function judgeOf(req) {
    const t = req.headers['x-judge-token'] || req.query.judge_token;
    if (!t || !judgeTokens.has(t)) return null;
    return judgeTokens.get(t);
  }
  function judgeOnly(req, res, next) {
    const j = judgeOf(req);
    if (j) { req.judge = j; return next(); }
    return res.status(401).json({ success: false, error: '需要评委身份，请重新登录' });
  }

  // ---------- 1. 评委登录：姓名 + 学号 ----------
  app.post('/api/judge/login', async (req, res) => {
    try {
      const name = String((req.body || {}).name || '').trim();
      const sid = String((req.body || {}).student_id || '').trim();
      if (!name || !sid) return fail(res, '请填写姓名和学号');
      const rows = await q(
        'SELECT id, name, dept, student_id, role, slice_no FROM gratitude_judges WHERE student_id = ? AND slice_no IS NOT NULL',
        [sid]
      );
      if (!rows.length) return fail(res, '不在评委名单里（或不属于评分部门）', 403);
      const j = rows.find(r => String(r.name).replace(/\s/g, '') === name.replace(/\s/g, ''));
      if (!j) return fail(res, '姓名与学号不匹配', 403);
      const token = crypto.randomBytes(24).toString('hex');
      judgeTokens.set(token, { id: j.id, name: j.name, dept: j.dept, slice_no: j.slice_no });
      return ok(res, { token, name: j.name, dept: j.dept, role: j.role, slice_no: j.slice_no });
    } catch (e) { fail(res, e.message, 500); }
  });

  app.post('/api/judge/logout', (req, res) => {
    const t = req.headers['x-judge-token'];
    if (t) judgeTokens.delete(t);
    ok(res, { logged_out: true });
  });

  // ---------- 2. 我的概览 ----------
  app.get('/api/judge/me', judgeOnly, async (req, res) => {
    try {
      const j = req.judge;
      const [{ total }] = await q('SELECT COUNT(*) AS total FROM gratitude_slices WHERE slice_no = ?', [j.slice_no]);
      const [{ scored }] = await q(
        'SELECT COUNT(*) AS scored FROM gratitude_scores s JOIN gratitude_slices sl ON sl.participant_id = s.participant_id WHERE sl.slice_no = ? AND s.judge_id = ?',
        [j.slice_no, j.id]
      );
      ok(res, { id: j.id, name: j.name, dept: j.dept, slice_no: j.slice_no, total, scored });
    } catch (e) { fail(res, e.message, 500); }
  });

  // ---------- 3. 我负责的名单 ----------
  app.get('/api/judge/list', judgeOnly, async (req, res) => {
    try {
      const j = req.judge;
      const rows = await q(
        `SELECT p.id, p.name, p.student_id, p.college, p.class_name, p.campus,
                sl.slice_no,
                (SELECT COUNT(DISTINCT day_no) FROM gratitude_days d WHERE d.participant_id = p.id) AS days_done,
                s.score_real, s.score_theme, s.score_quality, s.score_text, s.score_creative, s.updated_at,
                (s.score_real + s.score_theme + s.score_quality + s.score_text + s.score_creative) AS my_total
           FROM gratitude_slices sl
           JOIN gratitude_participants p ON p.id = sl.participant_id
           LEFT JOIN gratitude_scores s ON s.participant_id = p.id AND s.judge_id = ?
          WHERE sl.slice_no = ?
          ORDER BY p.student_id`,
        [j.id, j.slice_no]
      );
      const list = rows.map(r => ({
        id: r.id, name: r.name, student_id: r.student_id, college: r.college,
        class_name: r.class_name, campus: r.campus, days_done: r.days_done,
        scored: r.my_total != null, my_total: r.my_total, at: r.updated_at,
      }));
      ok(res, { total: list.length, scored: list.filter(x => x.scored).length, list });
    } catch (e) { fail(res, e.message, 500); }
  });

  // ---------- 4. 打分详情（只能看自己分片的人）----------
  app.get('/api/judge/detail/:pid', judgeOnly, async (req, res) => {
    try {
      const j = req.judge;
      const pid = Number(req.params.pid);
      const inSlice = await q1('SELECT participant_id FROM gratitude_slices WHERE participant_id = ? AND slice_no = ?', [pid, j.slice_no]);
      if (!inSlice) return fail(res, '这个人不在你负责的名单里', 403);
      const p = await q1('SELECT id, name, student_id, college, class_name, campus FROM gratitude_participants WHERE id = ?', [pid]);
      const days = await q('SELECT day_no, log_date FROM gratitude_days WHERE participant_id = ? ORDER BY day_no', [pid]);
      const uploads = await q('SELECT day_no, kind, file_path, file_size, mime_type FROM gratitude_uploads WHERE participant_id = ? ORDER BY day_no, id', [pid]);
      const mine = await q1(
        'SELECT score_real, score_theme, score_quality, score_text, score_creative, comment, updated_at FROM gratitude_scores WHERE participant_id = ? AND judge_id = ?',
        [pid, j.id]
      );
      ok(res, { participant: p, days, uploads, my_score: mine || null });
    } catch (e) { fail(res, e.message, 500); }
  });

  // ---------- 5. 提交打分 ----------
  app.post('/api/judge/score', judgeOnly, async (req, res) => {
    try {
      const j = req.judge;
      const b = req.body || {};
      const pid = Number(b.participant_id);
      if (!pid) return fail(res, '缺少 participant_id');
      const inSlice = await q1('SELECT participant_id FROM gratitude_slices WHERE participant_id = ? AND slice_no = ?', [pid, j.slice_no]);
      if (!inSlice) return fail(res, '这个人不在你负责的名单里', 403);

      const vals = {};
      for (const [key, , max] of DIMS) {
        const v = Number(b[key]);
        if (!Number.isFinite(v) || v < 0 || v > max) return fail(res, `「${key}」需在 0–${max} 之间`);
        vals[key] = Math.round(v);
      }
      const comment = String(b.comment || '').slice(0, 500);
      const exists = await q1('SELECT id FROM gratitude_scores WHERE participant_id = ? AND judge_id = ?', [pid, j.id]);
      if (exists) {
        await q(
          `UPDATE gratitude_scores SET score_real=?, score_theme=?, score_quality=?, score_text=?, score_creative=?, comment=?, judge_name=? WHERE id=?`,
          [vals.real, vals.theme, vals.quality, vals.text, vals.creative, comment, j.name, exists.id]
        );
      } else {
        await q(
          `INSERT INTO gratitude_scores (participant_id, judge_id, judge_name, score_real, score_theme, score_quality, score_text, score_creative, comment)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [pid, j.id, j.name, vals.real, vals.theme, vals.quality, vals.text, vals.creative, comment]
        );
      }
      ok(res, { saved: true, total: vals.real + vals.theme + vals.quality + vals.text + vals.creative });
    } catch (e) { fail(res, e.message, 500); }
  });

  // ---------- 6. 管理端：生成分片 ----------
  app.post('/api/admin/slices/generate', adminOnly, async (req, res) => {
    try {
      const minDays = Number((req.body || {}).min_days || 18);
      const slices = Number((req.body || {}).slices || 6);
      const cfg = await q("SELECT k, v FROM gratitude_config WHERE k IN ('start_date','total_days')");
      const start = (cfg.find(r => r.k === 'start_date') || {}).v || '2026-11-06';

      const eligible = await q(
        `SELECT p.id, p.student_id, COUNT(DISTINCT d.day_no) AS days_done
           FROM gratitude_participants p
           JOIN gratitude_days d ON d.participant_id = p.id
          GROUP BY p.id, p.student_id
         HAVING days_done >= ?
          ORDER BY p.student_id`,
        [minDays]
      );
      if (!eligible.length) return fail(res, '目前没有满足条件的参与者（≥' + minDays + ' 天）');

      const n = eligible.length;
      const base = Math.floor(n / slices);
      const rest = n % slices;
      const dist = {};
      for (let s = 0; s < slices; s++) dist[s + 1] = base + (s < rest ? 1 : 0);
      if ((req.body || {}).dry) {
        return ok(res, { dry: true, eligible: n, slices, dist, min_days: minDays, start_date: start });
      }

      await q('DELETE FROM gratitude_slices');
      let idx = 0;
      const rows = [];
      for (let s = 0; s < slices; s++) {
        const take = base + (s < rest ? 1 : 0);
        dist[s + 1] = take;
        for (let k = 0; k < take; k++) {
          const p = eligible[idx++];
          rows.push([p.id, s + 1, p.student_id]);
        }
      }
      for (const r of rows) {
        await q('INSERT INTO gratitude_slices (participant_id, slice_no, student_id) VALUES (?,?,?)', r);
      }
      ok(res, { eligible: n, slices, dist, min_days: minDays, start_date: start });
    } catch (e) { fail(res, e.message, 500); }
  });

  app.get('/api/admin/slices', adminOnly, async (req, res) => {
    try {
      const rows = await q(
        `SELECT sl.slice_no, COUNT(*) AS n,
                GROUP_CONCAT(CONCAT(p.name,'(',p.student_id,')') ORDER BY p.student_id SEPARATOR '、') AS people
           FROM gratitude_slices sl JOIN gratitude_participants p ON p.id = sl.participant_id
          GROUP BY sl.slice_no ORDER BY sl.slice_no`
      );
      ok(res, { total: rows.reduce((a, r) => a + r.n, 0), slices: rows });
    } catch (e) { fail(res, e.message, 500); }
  });

  // ---------- 7. 管理端：评委进度 ----------
  app.get('/api/admin/judge-progress', adminOnly, async (req, res) => {
    try {
      const judges = await q(
        `SELECT j.id, j.dept, j.name, j.student_id, j.slice_no,
                (SELECT COUNT(*) FROM gratitude_scores s WHERE s.judge_id = j.id) AS scored
           FROM gratitude_judges j WHERE j.slice_no IS NOT NULL
          ORDER BY j.slice_no, j.name`
      );
      const perSlice = {};
      const sl = await q('SELECT slice_no, COUNT(*) n FROM gratitude_slices GROUP BY slice_no');
      for (const r of sl) perSlice[r.slice_no] = r.n;
      ok(res, {
        judges: judges.map(j => ({ ...j, slice_total: perSlice[j.slice_no] || 0 })),
        slice_total: perSlice,
      });
    } catch (e) { fail(res, e.message, 500); }
  });

  // ---------- 8. 管理端：排名（裁极值 + 补卡扣分）----------
  async function computeRanking(minDays = 18) {
    const start = ((await q1("SELECT v FROM gratitude_config WHERE k='start_date'")) || {}).v || '2026-11-06';
    const rows = await q(
      `SELECT p.id, p.name, p.student_id, p.college, p.class_name, p.campus,
              (SELECT COUNT(DISTINCT day_no) FROM gratitude_days d WHERE d.participant_id = p.id) AS days_done,
              (SELECT COUNT(*) FROM gratitude_days d WHERE d.participant_id = p.id
                 AND d.log_date <> DATE_ADD(?, INTERVAL d.day_no - 1 DAY)) AS makeup,
              (SELECT COUNT(*) FROM gratitude_scores s WHERE s.participant_id = p.id) AS judge_count
         FROM gratitude_participants p
        HAVING days_done >= ?
         ORDER BY p.student_id`,
      [start, minDays]
    );
    const scores = await q(
      `SELECT participant_id, judge_id, judge_name,
              (COALESCE(score_real,0)+COALESCE(score_theme,0)+COALESCE(score_quality,0)+COALESCE(score_text,0)+COALESCE(score_creative,0)) AS total
         FROM gratitude_scores`
    );
    const byP = {};
    for (const s of scores) {
      (byP[s.participant_id] = byP[s.participant_id] || []).push(s);
    }
    const list = rows.map(r => {
      const arr = (byP[r.id] || []).map(x => Number(x.total)).sort((a, b) => a - b);
      let avg = 0, trimmed = false;
      if (arr.length >= 3) {
        const cut = arr.slice(1, -1);
        avg = cut.reduce((a, b) => a + b, 0) / cut.length;
        trimmed = true;
      } else if (arr.length > 0) {
        avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      }
      const deduct = 2 * Number(r.makeup || 0);
      const final = Math.max(0, +(avg - deduct).toFixed(2));
      return {
        id: r.id, name: r.name, student_id: r.student_id, campus: r.campus,
        college: r.college, class_name: r.class_name,
        days_done: r.days_done, makeup: Number(r.makeup || 0),
        judge_count: arr.length, trimmed,
        avg_raw: +avg.toFixed(2), deduct, final,
      };
    });
    list.sort((a, b) => (b.final - a.final) || (b.days_done - a.days_done) || a.student_id.localeCompare(b.student_id));
    list.forEach((x, i) => { x.rank = i + 1; });
    return list;
  }

  app.get('/api/admin/ranking', adminOnly, async (req, res) => {
    try {
      const minDays = Number(req.query.min_days || 18);
      const list = await computeRanking(minDays);
      const scored = list.filter(x => x.judge_count > 0);
      ok(res, {
        min_days: minDays,
        total: list.length,
        scored: scored.length,
        top: list.slice(0, 20),
        list,
      });
    } catch (e) { fail(res, e.message, 500); }
  });

  // ---------- 9. 管理端：综测证明名单 ----------
  app.get('/api/admin/cert-list', adminOnly, async (req, res) => {
    try {
      const minDays = Number(req.query.min_days || 18);
      const rows = await q(
        `SELECT p.id, p.name, p.student_id, p.college, p.class_name, p.campus,
                (SELECT COUNT(DISTINCT day_no) FROM gratitude_days d WHERE d.participant_id = p.id) AS days_done,
                (SELECT COUNT(*) FROM gratitude_uploads u WHERE u.participant_id = p.id AND u.day_no = 21 AND u.kind = 'image') AS d21_img,
                (SELECT COUNT(*) FROM gratitude_uploads u WHERE u.participant_id = p.id AND u.day_no = 21 AND u.kind IN ('video','audio')) AS d21_media
           FROM gratitude_participants p
          HAVING days_done >= ? AND d21_img >= 1 AND d21_media >= 1
          ORDER BY p.campus, p.student_id`,
        [minDays]
      );
      ok(res, { min_days: minDays, total: rows.length, list: rows });
    } catch (e) { fail(res, e.message, 500); }
  });

  // ---------- 9.5 管理端：评分明细导出 ----------
  app.get('/api/admin/scores-detail/export', adminOnly, async (req, res) => {
    try {
      const ExcelJS = ctx.ExcelJS;
      const rows = await q(
        `SELECT s.id, s.participant_id, s.judge_id, s.judge_name,
                s.score_real, s.score_theme, s.score_quality, s.score_text, s.score_creative,
                s.comment, s.created_at, s.updated_at,
                (COALESCE(s.score_real,0)+COALESCE(s.score_theme,0)+COALESCE(s.score_quality,0)
                 +COALESCE(s.score_text,0)+COALESCE(s.score_creative,0)) AS total,
                p.name, p.student_id, p.college, p.class_name, p.campus,
                (SELECT COUNT(DISTINCT day_no) FROM gratitude_days d WHERE d.participant_id = p.id) AS days_done,
                j.dept AS judge_dept, j.name AS judge_real_name
           FROM gratitude_scores s
           JOIN gratitude_participants p ON p.id = s.participant_id
           LEFT JOIN gratitude_judges j ON j.id = s.judge_id
          ORDER BY p.campus, p.student_id, s.judge_name`
      );
      const wb = new ExcelJS.Workbook();
      wb.creator = '21天感恩成长记';

      const ws = wb.addWorksheet('评分明细', { views: [{ state: 'frozen', ySplit: 1 }] });
      ws.columns = [
        { header: '序号', key: 'idx', width: 7 },
        { header: '学号', key: 'student_id', width: 18 },
        { header: '姓名', key: 'name', width: 12 },
        { header: '校区', key: 'campus', width: 12 },
        { header: '学院', key: 'college', width: 22 },
        { header: '班级', key: 'class_name', width: 16 },
        { header: '打卡天数', key: 'days_done', width: 10 },
        { header: '评委', key: 'judge_name', width: 12 },
        { header: '评委部门', key: 'judge_dept', width: 12 },
        { header: '真实性(30)', key: 'score_real', width: 12 },
        { header: '主题契合度(25)', key: 'score_theme', width: 15 },
        { header: '素材质量(15)', key: 'score_quality', width: 13 },
        { header: '文字完整性(15)', key: 'score_text', width: 15 },
        { header: '创意性(15)', key: 'score_creative', width: 12 },
        { header: '单条总分', key: 'total', width: 11 },
        { header: '评语', key: 'comment', width: 30 },
        { header: '评分时间', key: 'time', width: 20 },
      ];
      rows.forEach((r, i) => {
        ws.addRow({
          idx: i + 1,
          student_id: r.student_id, name: r.name, campus: r.campus,
          college: r.college, class_name: r.class_name, days_done: r.days_done,
          judge_name: r.judge_name,
          judge_dept: r.judge_dept || '',
          score_real: r.score_real, score_theme: r.score_theme, score_quality: r.score_quality,
          score_text: r.score_text, score_creative: r.score_creative, total: r.total,
          comment: r.comment || '',
          time: r.updated_at ? new Date(r.updated_at).toLocaleString('zh-CN') : '',
        });
      });
      ws.getRow(1).font = { bold: true };
      ws.autoFilter = { from: 'A1', to: 'Q1' };

      const list = await computeRanking(Number(req.query.min_days || 18));
      const ws2 = wb.addWorksheet('按人汇总');
      ws2.columns = [
        { header: '名次', key: 'rank', width: 8 },
        { header: '学号', key: 'student_id', width: 18 },
        { header: '姓名', key: 'name', width: 12 },
        { header: '校区', key: 'campus', width: 12 },
        { header: '班级', key: 'class_name', width: 16 },
        { header: '打卡天数', key: 'days_done', width: 10 },
        { header: '参评人数', key: 'judge_count', width: 10 },
        { header: '裁极值均分', key: 'avg_raw', width: 12 },
        { header: '补卡次数', key: 'makeup', width: 10 },
        { header: '补卡扣分', key: 'deduct', width: 10 },
        { header: '最终得分', key: 'final', width: 10 },
      ];
      for (const x of list) ws2.addRow(x);
      ws2.getRow(1).font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="scores-detail.xlsx"');
      await wb.xlsx.write(res);
      res.end();
    } catch (e) { fail(res, e.message, 500); }
  });

  // ---------- 10. 管理端：榜单导出 ----------
  app.get('/api/admin/ranking/export', adminOnly, async (req, res) => {
    try {
      const ExcelJS = ctx.ExcelJS;
      const list = await computeRanking(Number(req.query.min_days || 18));
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('总分排名');
      ws.columns = [
        { header: '名次', key: 'rank', width: 8 },
        { header: '姓名', key: 'name', width: 12 },
        { header: '学号', key: 'student_id', width: 18 },
        { header: '校区', key: 'campus', width: 12 },
        { header: '学院', key: 'college', width: 22 },
        { header: '班级', key: 'class_name', width: 16 },
        { header: '打卡天数', key: 'days_done', width: 12 },
        { header: '补卡次数', key: 'makeup', width: 12 },
        { header: '参评人数', key: 'judge_count', width: 12 },
        { header: '裁极值均分', key: 'avg_raw', width: 14 },
        { header: '补卡扣分', key: 'deduct', width: 12 },
        { header: '最终得分', key: 'final', width: 12 },
      ];
      for (const x of list) ws.addRow(x);
      ws.getRow(1).font = { bold: true };
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="ranking.xlsx"');
      await wb.xlsx.write(res);
      res.end();
    } catch (e) { fail(res, e.message, 500); }
  });
}
