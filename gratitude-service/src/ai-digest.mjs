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
        body: JSON.stringify({ model, messages, temperature: temp, max_tokens: maxTokens, thinking: { type: 'disabled' } }),
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

请为每一条写两三句回应（30-60字），规则：
1. 像熟识的同学随口接的一句，语气轻、近、有余温，可以有一点具体的画面、想象，或者一点轻的玩笑；
2. 【硬性】不要提问、不要追问，全文不出现问号，也不要用"……吗""……呢""……吧？"这类收尾；但不要因此写成四平八稳的总结——把关心写成具体的观察、画面或轻轻的理解，句子要有细节、有温度，不要像公文；
3. 必须落到具体那件事上，不能泛泛而谈；
4. 不评判对错、不说教、不做心理分析、不夸张赞美；
5. 不用感叹号，不用 emoji，不写"加油""你真棒""很棒"；
6. 若干条一起生成时，开头句式必须互不相同；
7. 如果内容明显是识别错误或看不清，就写一句不依赖细节的温和回应；
8. 读起来要像人话，不要"愿你""希望你继续保持"这类套话；
9. 不要用"踏实""挺好的""真好""很温暖"这类形容词收尾；几条之间不要用同一个词或同一个句式开头，但也不必刻意求怪，自然就好。`;

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
今天共 %n 位同学完成打卡。下面是每位同学当天打卡后收到的回应（每条对应该同学写下的三件小事）：

%s
%q

请写一段发到学生群的话（90-160 字）：
1. 像群里一个熟悉的同学，把今天的事说给自家人听：语气软、近，可以有一点轻的情绪、一个具体的画面或一句轻的感慨，但不要写成抒情散文，也不要写成流水的记录；
2. 人比较多时，可以顺带提一句大家大致在写什么；如果只有一两个人写，就把那件小事直接说出来，短一点更好；
3. 结尾挑一句原话当"今日微光"（用下面给的原话，没给就不强求），再轻轻收一句，不要喊口号；
4. 【硬性要求】只能使用上面列出的内容。不得添加任何没有出现的人物、地点、情节或感受。内容少的时候就写短，宁可短也不许编；
5. 不用感叹号堆叠，不用 emoji，纯文本，不要标题，不要分点；
6. 不要出现"开头""中间""收束""总结""本次""活动""归类""分类"这类说明词，也不要提"几条记录"；
7. 【硬性】不要提问、不要追问、不要邀请回应，全文不出现问号；这一段是给大家看的一句收束，不需要任何人回答；
8. 开头不要每次都用"今天有 N 位同学写下了记录"这类句式，可以直接从一件具体的事、一句原话或一个画面起笔。`;

const DIGEST_PROMPT_FEW = `你是"微光拾暖·艺绘感恩"21天感恩成长记的朋辈伙伴。今天写下的记录很少（%n 位同学）：

%s
%q

请写一段发到学生群里的话，60-100 字：
1. 像同学在群里随口说一句今天的情况，只提一句写下了多少人，可以带一点自己的语气；
2. 把那一两件小事具体说出来，同一句原话最多引用一次，不要反复重复；
3. 结尾轻轻收一句，不喊口号、不拔高；
4. 【硬性要求】只能使用上面列出的内容，不得添加任何没有出现的人物、地点、情节或感受；
5. 不用感叹号堆叠，不用 emoji，纯文本，不要标题、不要分点；
6. 不要出现"开头""中间""收束""总结""本次""活动""归类""分类"这类说明词，也不要提"几条记录"；
7. 【硬性】不要提问、不要追问、不要邀请回应，全文不出现问号；
8. 开头不必每次都说"今天有 N 位同学"，可以直接从那件小事说起。`;

export async function buildDigest(dateStr) {
  const rows = await q(
    `SELECT d.participant_id, d.day_no, c.comment, o.quote, o.items_json
       FROM gratitude_days d
       LEFT JOIN gratitude_comments c ON c.participant_id=d.participant_id AND c.day_no=d.day_no
       LEFT JOIN gratitude_ocr o ON o.participant_id=d.participant_id AND o.day_no=d.day_no
      WHERE d.log_date=?`, [dateStr]);
  const lines = [];
  const quotes = [];
  const items = [];
  for (const r of rows) {
    if (r.comment) lines.push('· ' + String(r.comment).trim());
    for (const it of safeArr(r.items_json)) items.push(it);
    if (r.quote && quotes.length < 20) quotes.push(String(r.quote).trim());
  }
  const useLines = lines.length ? lines : items.map((i) => '· ' + i);
  const quote = quotes[0] || '';
  if (!rows.length) return null;
  const tpl = rows.length <= 2 ? DIGEST_PROMPT_FEW : DIGEST_PROMPT;
  const quoteBlock = quotes.length ? '\n今天的便签原话：\n' + quotes.map((x) => '· ' + x).join('\n') : '';
  const body = tpl
    .replace('%n', () => String(rows.length))
    .replace('%c', () => String(useLines.length))
    .replace('%s', () => useLines.join('\n') || '· （今天没有可读的内容）')
    .replace('%q', () => quoteBlock);
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