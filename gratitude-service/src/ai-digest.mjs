// src/ai-digest.mjs —— 每日简报 & 逐条评语（DeepSeek 多模态）
import fs from 'node:fs';
import path from 'node:path';
import { q, q1, pool } from './db.js';

const UP_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const BASE = (process.env.AI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
const KEY = (process.env.AI_API_KEY || '').trim();
const VISION_MODEL = process.env.AI_VISION_MODEL || 'deepseek-flash';
const TEXT_MODEL = process.env.AI_TEXT_MODEL || 'deepseek-flash';

export const aiReady = () => !!KEY;

async function chat(messages, opt = {}) {
  const { model = TEXT_MODEL, maxTokens = 3000, temp = 0.6, timeout = 90000, retries = 2 } = opt;
  if (!KEY) throw new Error('AI_API_KEY 未配置');
  let lastErr = null;
  for (let i = 0; i <= retries; i++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);
    try {
      const r = await fetch(BASE + '/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature: temp, max_tokens: maxTokens }),
        signal: ac.signal,
      });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
      const j = await r.json();
      let txt = (j.choices?.[0]?.message?.content || '').trim();
      if (txt.includes('</think>')) txt = txt.split('</think>').pop().trim();
      if (txt) return { text: txt, usage: j.usage || {} };
      lastErr = new Error('空回复（可能被推理 token 吃光）');
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((s) => setTimeout(s, 800));
  }
  throw lastErr || new Error('AI 调用失败');
}

function jsonBlock(txt, open, close) {
  const a = txt.indexOf(open);
  const b = txt.lastIndexOf(close);
  if (a < 0 || b < a) return null;
  try { return JSON.parse(txt.slice(a, b + 1)); } catch { return null; }
}

const EXTRACT_PROMPT = `看这张"21天感恩成长记"的打卡便签照片，只输出 JSON（不要解释、不要代码块）：
{"day": 数字或null, "items": ["事件1","事件2","事件3"], "mood": "温暖/平静/感动/疲惫/开心 里选一个",
 "quote": "便签里最有画面感的一句原话，逐字抄"}
items 每条不超过 20 字；看不清的条目写 "[看不清]"。`;

export async function extractOne(imagePath) {
  const b64 = fs.readFileSync(imagePath).toString('base64');
  const { text } = await chat([{ role: 'user', content: [
    { type: 'text', text: EXTRACT_PROMPT },
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64 } },
  ] }], { model: VISION_MODEL, maxTokens: 1500, temp: 0.1 });
  const d = jsonBlock(text, '{', '}');
  if (!d) return null;
  const items = Array.isArray(d.items) ? d.items.filter((x) => x && x !== '[看不清]').slice(0, 3) : [];
  return { day: d.day ?? null, items, mood: (d.mood || '').slice(0, 10), quote: (d.quote || '').slice(0, 200) };
}

// 找这一天最合适的一张图（优先非视频/音频）
export async function firstImage(pid, day) {
  const row = await q1('SELECT action_images FROM gratitude_days WHERE participant_id=? AND day_no=?', [pid, day]);
  let list = [];
  if (row?.action_images) {
    try {
      const v = JSON.parse(row.action_images);
      list = Array.isArray(v) ? v : [v];
    } catch { list = [String(row.action_images)]; }
  }
  list = list.filter((p) => typeof p === 'string' && /\.(jpe?g|png|webp)$/i.test(p));
  for (const rel of list) {
    const abs = path.resolve(UP_DIR, rel);
    if (abs.startsWith(UP_DIR) && fs.existsSync(abs)) return abs;
  }
  // 兜底：扫目录
  const dir = path.join(UP_DIR, String(pid), String(day));
  if (fs.existsSync(dir)) {
    const f = fs.readdirSync(dir).find((n) => /\.(jpe?g|png|webp)$/i.test(n));
    if (f) return path.join(dir, f);
  }
  return null;
}

export async function ensureOcr(pid, day) {
  const hit = await q1('SELECT * FROM gratitude_ocr WHERE participant_id=? AND day_no=?', [pid, day]);
  if (hit) return { ...hit, items: safeArr(hit.items_json), cached: true };
  const img = await firstImage(pid, day);
  if (!img) return null;
  const r = await extractOne(img);
  if (!r) return null;
  await q(`INSERT INTO gratitude_ocr (participant_id, day_no, items_json, mood, quote, model)
           VALUES (?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE items_json=VALUES(items_json), mood=VALUES(mood), quote=VALUES(quote), model=VALUES(model)`,
    [pid, day, JSON.stringify(r.items), r.mood, r.quote, VISION_MODEL]);
  return { participant_id: pid, day_no: day, items_json: JSON.stringify(r.items), items: r.items, mood: r.mood, quote: r.quote, cached: false };
}

function safeArr(s) {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}

const COMMENT_SYS = `你是"微光拾暖·艺绘感恩"21天感恩成长记活动里负责回应的朋辈伙伴。
学生刚提交当天打卡，便签上写下了自己的三件小事（从照片转录，可能有识别误差）。

请为每一条写一句回应（20-40字），规则：
1. 必须落到具体那件事上，不能泛泛而谈；
2. 不评判对错、不说教、不做心理分析、不夸张赞美；
3. 平视的语气，像同学，不像老师或客服；
4. 不用感叹号，不用 emoji，不写"加油""你真棒"；
5. 若干条一起生成时，开头句式必须互不相同；
6. 如果内容明显是识别错误或看不清，就写一句不依赖细节的温和回应。`;

export async function generateComments(records) {
  // records: [{pid, day, items, mood}]
  const payload = records.map((r) => ({ id: r.pid, day: r.day, mood: r.mood || '', items: r.items }));
  const { text } = await chat([
    { role: 'system', content: COMMENT_SYS },
    { role: 'user', content: '待回应记录（JSON）：\n' + JSON.stringify(payload) + '\n\n只输出 JSON 数组，每项 {"id": 数字, "comment": "这句回应"}，不要解释、不要代码块。' },
  ], { maxTokens: 4000, temp: 0.85 });
  let arr = jsonBlock(text, '[', ']');
  if (!arr) {
    const one = jsonBlock(text, '{', '}');   // 单条时模型可能直接返回对象
    if (one) arr = [one];
  }
  if (!arr) throw new Error('评语解析失败: ' + text.slice(0, 120));
  const out = new Map();
  for (const x of arr) {
    const rec = records.find((r) => String(r.id ?? r.pid) === String(x.id));
    if (rec && x.comment) out.set(rec.pid, String(x.comment).slice(0, 240));
  }
  // 兜底：没拿到的逐条重试一次
  for (const r of records) {
    if (out.has(r.pid)) continue;
    try {
      const t2 = await chat([
        { role: 'system', content: COMMENT_SYS },
        { role: 'user', content: '只有一条记录：' + JSON.stringify({ day: r.day, mood: r.mood || '', items: r.items }) + '\n只输出这一句回应本身，不要 JSON、不要引号、不要解释。' },
      ], { maxTokens: 2000, temp: 0.85 });
      const line = t2.text.split('\n').map((x) => x.trim()).filter(Boolean).pop() || '';
      const clean = line.replace(/^(comment[:：]\s*)/i, '').replace(/^["「]|["」]$/g, '').trim();
      if (clean) out.set(r.pid, clean.slice(0, 240));
    } catch { /* 忽略，最后用安全句 */ }
  }
  return out;
}

export async function generateCommentFor(pid, day) {
  const hit = await q1('SELECT * FROM gratitude_comments WHERE participant_id=? AND day_no=?', [pid, day]);
  if (hit) return { ...hit, cached: true };
  const ocr = await ensureOcr(pid, day);
  const m = await generateComments([{ pid, day, items: ocr?.items || [], mood: ocr?.mood || '' }]);
  const comment = m.get(pid) || '这一天被你记下来了，很好。';
  await q(`INSERT INTO gratitude_comments (participant_id, day_no, comment, model) VALUES (?,?,?,?)
           ON DUPLICATE KEY UPDATE comment=VALUES(comment), model=VALUES(model)`, [pid, day, comment, TEXT_MODEL]);
  return { participant_id: pid, day_no: day, comment, cached: false };
}

const DIGEST_PROMPT = `你是"微光拾暖·艺绘感恩"21天感恩成长记的活动主编。
以下是今天同学在便签上真实写下的事情（从照片转录，可能有个别识别误差）。今天共 %n 位同学、%c 条记录：

%s

请写一段发到学生群的话（120-220 字）：
1. 开头点出今天参与的人数；
2. 中间归纳这些事情集中在哪些方面（2-3 句，归纳不要逐条罗列）；
3. 结尾引用其中一句原话作为"今日微光"，再加一句简短收束；
4. 【硬性要求】只能使用上面列出的内容。不得添加任何没有出现的人物、地点、情节或感受。记录少的时候就写短，宁可短也不许编；
5. 语气温柔克制，不用感叹号堆砌，不用 emoji，纯文本，不要标题；
6. 不要出现"开头""中间""收束""总结"这类写作说明词，也不要在文中解释这是几条记录。`;

export async function buildDigest(dateStr) {
  const rows = await q(
    `SELECT d.participant_id, d.day_no, o.items_json, o.mood, o.quote
       FROM gratitude_days d JOIN gratitude_ocr o
         ON o.participant_id=d.participant_id AND o.day_no=d.day_no
      WHERE d.log_date=?`, [dateStr]);
  const items = [];
  let quote = '';
  for (const r of rows) {
    for (const it of safeArr(r.items_json)) items.push(it);
    if (!quote && r.quote) quote = r.quote;
  }
  if (!rows.length) return null;
  const body = DIGEST_PROMPT
    .replace('%n', String(rows.length))
    .replace('%c', String(items.length))
    .replace('%s', items.map((i) => '· ' + i).join('\n') || '· （今天没有可读的便签文字）');
  const { text } = await chat([{ role: 'user', content: body }], { maxTokens: 4000, temp: 0.7 });
  const digest = text.trim();
  await q(`INSERT INTO gratitude_digests (digest_date, participants, items_count, digest_text, quote, model)
           VALUES (?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE participants=VALUES(participants), items_count=VALUES(items_count),
             digest_text=VALUES(digest_text), quote=VALUES(quote), model=VALUES(model)`,
    [dateStr, rows.length, items.length, digest, quote, TEXT_MODEL]);
  return { date: dateStr, participants: rows.length, items: items.length, digest, quote };
}

async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (i < list.length) {
      const idx = i++;
      try { out[idx] = await fn(list[idx], idx); } catch (e) { out[idx] = { error: String(e.message || e) }; }
    }
  });
  await Promise.all(workers);
  return out;
}

export async function runDaily(dateStr) {
  const days = await q('SELECT participant_id, day_no FROM gratitude_days WHERE log_date=?', [dateStr]);
  const stats = { date: dateStr, records: days.length, ocr_ok: 0, ocr_fail: 0, comments: 0, comment_fail: 0, digest: false };
  if (!days.length) return stats;

  const ocr = await mapLimit(days, 4, async (d) => ensureOcr(d.participant_id, d.day_no));
  const withText = [];
  days.forEach((d, i) => {
    const o = ocr[i];
    if (o && !o.error && o.items) { stats.ocr_ok++; withText.push({ pid: d.participant_id, day: d.day_no, items: o.items, mood: o.mood }); }
    else stats.ocr_fail++;
  });

  const need = [];
  for (const r of withText) {
    const hit = await q1('SELECT 1 AS x FROM gratitude_comments WHERE participant_id=? AND day_no=?', [r.pid, r.day]);
    if (!hit) need.push(r);
  }
  for (let i = 0; i < need.length; i += 20) {
    const batch = need.slice(i, i + 20);
    try {
      const m = await generateComments(batch);
      for (const r of batch) {
        const c = m.get(r.pid);
        if (!c) { stats.comment_fail++; continue; }
        await q(`INSERT INTO gratitude_comments (participant_id, day_no, comment, model) VALUES (?,?,?,?)
                 ON DUPLICATE KEY UPDATE comment=VALUES(comment)`, [r.pid, r.day, c, TEXT_MODEL]);
        stats.comments++;
      }
    } catch (e) { stats.comment_fail += batch.length; }
  }

  try { stats.digest = !!(await buildDigest(dateStr)); } catch (e) { stats.digest_error = String(e.message || e).slice(0, 120); }
  return stats;
}

// CLI：node src/ai-digest.mjs 2026-11-06
const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith('ai-digest.mjs');
if (isMain) {
  const d = process.argv[2] || new Date().toISOString().slice(0, 10);
  runDaily(d).then((s) => { console.log(JSON.stringify(s, null, 1)); return pool.end(); })
    .catch((e) => { console.error('失败:', e.message); process.exit(1); });
}