// 便签质量检测：优秀 / 普通 / 差劲
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.AI_API_KEY || '';
const BASE = (process.env.AI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
const VISION_MODEL = process.env.AI_VISION_MODEL || 'deepseek-flash';

export const GRADE = { GOOD: '优秀', NORMAL: '普通', POOR: '差劲' };

const QUALITY_PROMPT = `你在一场校园"21天感恩打卡"活动里做便签识别与质量检测。图片应当是一张手写或打印的便签，上面写着当天三件感恩小事。

请一次完成两件事：先把便签上的文字读出来，再判断这一天的质量档次。只输出一个 JSON 对象，不要解释、不要代码块。

判档标准：
- 优秀：写了具体的事（做了什么、和谁、什么场景），并且有细节或真实感受，读起来像本人自己写的，不是套话。
- 普通：写了具体的事，但很短、很平，只有一句话，没有展开。**写了任何一件具体的事，哪怕只有一句话，也归普通，不判差劲。**
- 差劲：**从严判定，宁可归普通也不要轻易判差劲**。只有下面三种情况才判差劲：
  ① 图片里完全没有可辨认的文字（模糊、太暗、歪斜到看不清，或根本不是文字内容）；
  ② 图片主体明显不是当天的感恩便签（代码截图、聊天记录、证件、课表、纯风景/纯人像且无文字、网络图片），或文字内容与感恩完全无关；
  ③ 确实是便签，但整张只有状态词（如"今天很开心""好累""还行""一般"），**连一件具体的事都没写**。
  以下情况**不得**判差劲：写了字但比较空泛；字迹潦草但大体能认；只写了一件很短的事；有错别字或语句不通；拍了多张里有一张糊。拿不准时一律判普通。

输出格式：
{"text_ok": true, "items": ["第一件事（不超过20字）","第二件事","第三件事"], "mood": "温暖", "quote": "便签里最有画面感的一句原话，逐字抄",
 "grade": "优秀", "reason_code": "ok", "chars": 42, "excerpt": "能代表这张便签的10-40字原文", "reason": "12字以内的判档理由"}

要求：
- items 按便签顺序，最多 3 条；看不清的条目写 "[看不清]"；没有文字时 items 为空数组、mood 与 quote 留空、chars 填 0、excerpt 留空；
- mood 只能从 温暖/平静/感动/疲惫/开心 里选一个；
- grade 只能是"优秀""普通""差劲"之一；excerpt 里不要出现英文引号，改写中文引号或不用引号；
- reason_code 只能是以下四个之一，用来区分"差劲"的具体原因（优秀/普通时填 ok）：
  · no_text：图片模糊、太暗、角度歪，人已经没法辨认上面的字；
  · off_topic：图片本身不是当天的感恩便签（例如代码截图、聊天记录、风景照、网络图片），或文字内容与感恩无关；
  · too_brief：确实是便签，但**整张只有状态词**、连一件具体的事都没写（仅在此时可用）；
  · ok：判定为优秀或普通。
- 直接给出 JSON，不要写分析过程。`;

function jsonObj(text) {
  if (!text) return null;
  text = String(text).replace(/```json/g, '').replace(/```/g, '');
  const i = text.indexOf('{');
  const j = text.lastIndexOf('}');
  if (i < 0 || j <= i) return null;
  try { return JSON.parse(text.slice(i, j + 1)); } catch { return null; }
}

async function chat(messages, opt = {}) {
  const { model = VISION_MODEL, maxTokens = 2000, temp = 0.1, timeout = 30000, retries = 1 } = opt;
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
    await new Promise((s) => setTimeout(s, 500));
  }
  throw lastErr || new Error('AI 调用失败');
}

/** 检测单张图；失败返回 null（不阻塞主流程） */
export async function gradeOne(absPath) {
  if (!absPath || !fs.existsSync(absPath)) return null;
  const ext = path.extname(absPath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  const b64 = fs.readFileSync(absPath).toString('base64');
  try {
    const { text } = await chat([{ role: 'user', content: [
      { type: 'text', text: QUALITY_PROMPT },
      { type: 'image_url', image_url: { url: `data:${mime};base64,` + b64 } },
    ] }]);
    const d = jsonObj(text);
    if (!d) return null;
    const grade = [GRADE.GOOD, GRADE.NORMAL, GRADE.POOR].includes(d.grade) ? d.grade : GRADE.NORMAL;
    const textOk = d.text_ok === true && !(d.grade === GRADE.POOR && (d.chars || 0) === 0);
    const items = Array.isArray(d.items)
      ? d.items.map((x) => String(x || '').trim()).filter((x) => x && x !== '[看不清]').slice(0, 3)
      : [];
    return {
      text_ok: textOk,
      grade,
      chars: Number(d.chars) || 0,
      excerpt: String(d.excerpt || '').slice(0, 120),
      reason: String(d.reason || '').slice(0, 30),
      reason_code: String(d.reason_code || '').slice(0, 16),
      items,
      mood: String(d.mood || '').slice(0, 10),
      quote: String(d.quote || '').slice(0, 200),
    };
  } catch {
    return null;
  }
}

/** 并发检测多张，聚合当日结论 */
export async function gradeImages(absPaths) {
  const list = (absPaths || []).filter(Boolean);
  if (!list.length) return null;
  const rs = await Promise.all(list.map((p) => gradeOne(p)));
  const ok = rs.filter(Boolean);
  if (!ok.length) return null;
  const rank = { [GRADE.GOOD]: 3, [GRADE.NORMAL]: 2, [GRADE.POOR]: 1 };
  const top = ok.reduce((a, b) => (rank[b.grade] > rank[a.grade] ? b : a), ok[0]);
  const anyText = ok.some((x) => x.text_ok);
  return {
    day_grade: top.grade,
    text_ok: anyText,
    items: ok,
    excerpt: top.excerpt,
    reason: top.reason,
  };
}

/** 给学生的提醒文案：只在"没文字"或"差劲"时返回，按原因分三种说法 */
export function reminderFor(result) {
  if (!result) return null;
  const code = result.reason_code || '';
  if (code === 'no_text' || (!result.text_ok && code !== 'off_topic')) {
    return { type: 'no_text', msg: '这张便签没太看清，可能是光线或者角度问题，方便的话重拍一张更清楚的～' };
  }
  if (code === 'off_topic') {
    return { type: 'off_topic', msg: '这张看起来不是当天的感恩便签（像是截图或别的照片），方便的话换成写着三件小事的便签照片～' };
  }
  const g = result.day_grade || result.grade;
  if (g === GRADE.POOR) {
    return { type: 'too_brief', msg: '今天写得有点少，可以多写一句具体的事，比如那件事是什么、当时什么感觉～' };
  }
  return null;
}

import { q } from './db.js';

const IMG_RE = /\.(jpe?g|png|webp|heic)$/i;

/** 检测 + 落库 + 聚合；带总时长预算，超时的标"待检测" */
export async function gradeAndStore({ pid, dayno, upDir, relPaths, budgetMs = 8000 }) {
  const imgs = (relPaths || []).filter((p) => IMG_RE.test(p));
  if (!imgs.length) return null;

  const run = Promise.all(imgs.map((rel) => gradeOne(path.join(upDir, rel)).then((r) => [rel, r])));

  let pairs;
  try {
    pairs = await Promise.race([run, new Promise((_, rej) => setTimeout(() => rej(new Error('budget')), budgetMs))]);
  } catch {
    pairs = imgs.map((rel) => [rel, null]);
  }

  const done = [];
  for (const [rel, r] of pairs) {
    if (!r) continue;
    done.push(r);
    await q(`INSERT INTO gratitude_quality (participant_id, day_no, file_path, grade, text_ok, chars, excerpt, reason, reason_code, model)
             VALUES (?,?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE grade=VALUES(grade), text_ok=VALUES(text_ok), chars=VALUES(chars),
               excerpt=VALUES(excerpt), reason=VALUES(reason), reason_code=VALUES(reason_code), model=VALUES(model), created_at=NOW()`,
      [pid, dayno, rel, r.grade, r.text_ok ? 1 : 0, r.chars, r.excerpt, r.reason, r.reason_code || '', VISION_MODEL]);
  }
  // 同一次调用顺手把 OCR 结果落库，避免后续评语/简报再读一遍图
  const withText = done.find((x) => x.text_ok && (x.items?.length || x.quote));
  if (withText) {
    try {
      await q(`INSERT INTO gratitude_ocr (participant_id, day_no, items_json, mood, quote, model)
               VALUES (?,?,?,?,?,?)
               ON DUPLICATE KEY UPDATE items_json=VALUES(items_json), mood=VALUES(mood), quote=VALUES(quote), model=VALUES(model)`,
        [pid, dayno, JSON.stringify(withText.items || []), withText.mood || '', withText.quote || '', VISION_MODEL]);
    } catch { /* 落 OCR 失败不影响主流程 */ }
  }

  if (!done.length) return { pending: true, reminder: null, items: [] };

  const rank = { [GRADE.GOOD]: 3, [GRADE.NORMAL]: 2, [GRADE.POOR]: 1 };
  const top = done.reduce((a, b) => (rank[b.grade] > rank[a.grade] ? b : a), done[0]);
  const agg = {
    day_grade: top.grade,
    text_ok: done.some((x) => x.text_ok),
    excerpt: top.excerpt,
    reason: top.reason,
    reason_code: top.reason_code || '',
    items: done.map((x) => ({ grade: x.grade, text_ok: x.text_ok, chars: x.chars, excerpt: x.excerpt })),
    pending: done.length < imgs.length,
  };
  agg.reminder = reminderFor(agg);
  return agg;
}
