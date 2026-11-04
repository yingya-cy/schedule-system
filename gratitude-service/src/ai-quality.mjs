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
- 普通：写了具体的事，但很短、很平，只有一句话，没有展开。
- 差劲：满足任一条即算——图片里没有可辨认的文字；文字过少或只有状态词（如"今天很开心""还行""一般""累"）；明显是空话套话、复制粘贴；内容与感恩无关。

输出格式：
{"text_ok": true, "items": ["第一件事（不超过20字）","第二件事","第三件事"], "mood": "温暖", "quote": "便签里最有画面感的一句原话，逐字抄",
 "grade": "优秀", "chars": 42, "excerpt": "能代表这张便签的10-40字原文", "reason": "12字以内的判档理由"}

要求：
- items 按便签顺序，最多 3 条；看不清的条目写 "[看不清]"；没有文字时 items 为空数组、mood 与 quote 留空、chars 填 0、excerpt 留空；
- mood 只能从 温暖/平静/感动/疲惫/开心 里选一个；
- grade 只能是"优秀""普通""差劲"之一；excerpt 里不要出现英文引号，改写中文引号或不用引号；
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

/** 给学生的提醒文案：只在"没文字"或"差劲"时返回 */
export function reminderFor(result) {
  if (!result) return null;
  if (!result.text_ok) {
    return { type: 'no_text', msg: '这张便签没太看清，可能是光线或者角度问题，方便的话重拍一张更清楚的～' };
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
    await q(`INSERT INTO gratitude_quality (participant_id, day_no, file_path, grade, text_ok, chars, excerpt, reason, model)
             VALUES (?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE grade=VALUES(grade), text_ok=VALUES(text_ok), chars=VALUES(chars),
               excerpt=VALUES(excerpt), reason=VALUES(reason), model=VALUES(model), created_at=NOW()`,
      [pid, dayno, rel, r.grade, r.text_ok ? 1 : 0, r.chars, r.excerpt, r.reason, VISION_MODEL]);
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
    items: done.map((x) => ({ grade: x.grade, text_ok: x.text_ok, chars: x.chars, excerpt: x.excerpt })),
    pending: done.length < imgs.length,
  };
  agg.reminder = reminderFor(agg);
  return agg;
}
