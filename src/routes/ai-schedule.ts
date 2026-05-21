import { Router } from 'express';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — multer 2.x has no bundled types, handled by src/types/multer.d.ts
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader, getErrorMessage } from '../utils/db-types';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();
const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5002';

function parseSectionString(raw: string): number[] {
  // Handle "1-2节", "1-2", "3-4节" range format
  const rangeMatch = raw.match(/^(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
  }
  // Handle comma/Chinese comma separated: "1,3,5" or "1，3，5"
  return raw.split(/[,，、]/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
}

function parseWeekdayString(raw: string): number {
  // "星期一"→1, "星期二"→2, ..., "星期日"→7
  // "周一"→1, "Monday"→1, plain "1"→1
  const map: Record<string, number> = {
    '一': 1, '1': 1, 'mon': 1, 'monday': 1,
    '二': 2, '2': 2, 'tue': 2, 'tuesday': 2,
    '三': 3, '3': 3, 'wed': 3, 'wednesday': 3,
    '四': 4, '4': 4, 'thu': 4, 'thursday': 4,
    '五': 5, '5': 5, 'fri': 5, 'friday': 5,
    '六': 6, '6': 6, 'sat': 6, 'saturday': 6,
    '日': 7, '天': 7, '7': 7, 'sun': 7, 'sunday': 7,
  };
  for (const [key, val] of Object.entries(map)) {
    if (raw.includes(key)) return val;
  }
  const num = parseInt(raw, 10);
  return isNaN(num) ? 1 : num;
}

function parseWeekString(raw: string): number[] {
  const text = raw.replace(/\s/g, '');
  const weeks = new Set<number>();

  // Split by comma (English or Chinese)
  const parts = text.split(/[,，]/);
  for (const part of parts) {
    if (!part) continue;

    // Detect parity: (单) or (双)
    let parity: 'odd' | 'even' | null = null;
    if (part.includes('(单)') || part.includes('（单）')) parity = 'odd';
    else if (part.includes('(双)') || part.includes('（双）')) parity = 'even';

    // Range: "1-16周"
    const rangeMatch = part.match(/(\d+)\s*-\s*(\d+)/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let n = start; n <= end; n++) {
          if (parity === 'odd' && n % 2 === 0) continue;
          if (parity === 'even' && n % 2 === 1) continue;
          weeks.add(n);
        }
      }
      continue;
    }

    // Single: "3周" or just "3"
    const singleMatch = part.match(/(\d+)/);
    if (singleMatch) {
      const n = parseInt(singleMatch[1], 10);
      if (!isNaN(n)) weeks.add(n);
    }
  }

  return Array.from(weeks).sort((a, b) => a - b);
}

// POST /api/ai/schedule-plan — 生成计划 + 存储
router.post('/schedule-plan', authenticate, async (req, res) => {
  try {
    const { courses, commitments, grade, major, next_monday, model, current_week, custom_prompt } = req.body;

    if (!courses || courses.length === 0) {
      res.status(400).json({ success: false, error: '课表为空，请先上传课表' });
      return;
    }

    // 调用 Flask
    const flaskRes = await fetch(`${FLASK_URL}/api/ai/schedule-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courses, commitments, grade, major, next_monday, model, current_week, custom_prompt }),
    });
    const flaskJson = await flaskRes.json();

    if (!flaskJson.success) {
      res.status(502).json(flaskJson);
      return;
    }

    const plan = flaskJson.data;
    const inputJson = JSON.stringify({ courses, commitments, grade, major });
    const planJson = JSON.stringify(plan);

    // Upsert: update the latest pending plan (no plan_data), or insert new
    const [existing] = await pool.query(
      'SELECT id FROM ai_schedule_plans WHERE user_id = ? AND plan_data IS NULL ORDER BY created_at DESC LIMIT 1',
      [req.user!.userId]
    );
    const existingRow = (existing as RowDataPacket[])[0];

    let planId: number;
    if (existingRow) {
      await pool.query(
        'UPDATE ai_schedule_plans SET input_data = ?, plan_data = ? WHERE id = ?',
        [inputJson, planJson, existingRow.id]
      );
      planId = existingRow.id;
    } else {
      const [result] = await pool.query(
        'INSERT INTO ai_schedule_plans (user_id, input_data, plan_data) VALUES (?, ?, ?)',
        [req.user!.userId, inputJson, planJson]
      );
      planId = (result as ResultSetHeader).insertId;
    }

    res.json({
      success: true,
      data: { id: planId, plan },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// GET /api/ai/schedule-plans — 用户历史计划
router.get('/schedule-plans', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, term_id, plan_data, created_at FROM ai_schedule_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user!.userId]
    );
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// GET /api/ai/schedule-plans/:id — 计划详情
router.get('/schedule-plans/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM ai_schedule_plans WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.userId]
    );
    const list = rows as RowDataPacket[];
    if (list.length === 0) {
      res.status(404).json({ success: false, error: '计划不存在' });
      return;
    }
    res.json({ success: true, data: list[0] });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// DELETE /api/ai/schedule-plans/:id
router.delete('/schedule-plans/:id', authenticate, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM ai_schedule_plans WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.userId]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// POST /api/ai/upload — OCR 课表上传（AI 排课专用，不存 schedules 表）
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: '请选择文件' });
      return;
    }

    const isPdf = file.mimetype === 'application/pdf'
      || file.originalname.toLowerCase().endsWith('.pdf');

    // 图/PDF 都直接发 Flask，走原有逻辑
    const fd = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype });
    fd.append('file', blob, file.originalname);
    const ocrUrl = isPdf ? '/api/ocr/pdf' : '/api/ocr/image';
    const r = await fetch(`${FLASK_URL}${ocrUrl}`, { method: 'POST', body: fd });
    const data = await r.json() as Record<string, unknown>;

    if (!data.success) {
      res.status(422).json({ success: false, error: '未能识别课程数据，请检查图片清晰度' });
      return;
    }

    // Mirror 课表中心: step1 mapBackendDataToArray → step2 ScheduleUploadView remap
    const d = data as Record<string, unknown>;
    const rawList: Record<string, unknown>[] = ((d.schedule_data as unknown[])?.length > 0 ? d.schedule_data : d.raw_data) as Record<string, unknown>[] || [];
    if (rawList.length > 0) {
      console.log('[ai-upload]', rawList.length, 'courses, parse_method:', d.parse_method);
    }

    const courses = rawList.map((c: Record<string, unknown>, i: number) => {
      const rec = c as Record<string, unknown>;

      // === Step 1: same as mapBackendDataToArray ===
      // getWeekdayName: handles number | "星期一" | "未知"
      const rawDay = rec.weekday ?? rec.day;
      let dayStr = '';
      if (typeof rawDay === 'number') {
        const DAY_NAMES = ['星期一','星期二','星期三','星期四','星期五','星期六','星期日'];
        dayStr = DAY_NAMES[rawDay - 1] || '';
      } else if (typeof rawDay === 'string') {
        const num = parseInt(rawDay);
        if (!isNaN(num)) {
          const DAY_NAMES = ['星期一','星期二','星期三','星期四','星期五','星期六','星期日'];
          dayStr = DAY_NAMES[num - 1] || '';
        } else {
          const dayMap: Record<string, number> = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':7 };
          for (const [k, v] of Object.entries(dayMap)) {
            if (rawDay.includes(k)) { dayStr = ['星期一','星期二','星期三','星期四','星期五','星期六','星期日'][v-1]; break; }
          }
        }
      }

      // parsePeriod: handles "1-2节", "1-2", "1~2节", number array
      const rawSec = rec.section ?? rec.period;
      let sectionArray: number[] = [];
      if (Array.isArray(rawSec)) {
        sectionArray = (rawSec as unknown[]).filter((s: unknown) => typeof s === 'number') as number[];
      } else if (typeof rawSec === 'string') {
        const match = String(rawSec).match(/(\d+)[-~](\d+)节?/);
        if (match) {
          const s = parseInt(match[1]), e = parseInt(match[2]);
          if (!isNaN(s) && !isNaN(e)) sectionArray = Array.from({length: e - s + 1}, (_, j) => s + j);
        } else {
          const singleMatch = String(rawSec).match(/第?(\d+)节/);
          if (singleMatch) sectionArray = [parseInt(singleMatch[1])];
        }
      }
      const sectionStr = sectionArray.length > 0
        ? `${sectionArray[0]}-${sectionArray[sectionArray.length - 1]}节`
        : '';
      const timeStr = `${dayStr} ${sectionStr}`.trim();

      // formatWeekInfo: prefers weeks_list, falls back to weeks/week string
      const weeksList: number[] | undefined = Array.isArray(rec.weeks_list) ? (rec.weeks_list as number[]) : undefined;
      const rawWeeks = rec.weeks ?? rec.week;

      // === Step 2: same as ScheduleUploadView remap ===
      // parseWeekday from timeStr
      const wdMap: Record<string, number> = {
        '星期一':1,'周一':1,'一':1,'星期二':2,'周二':2,'二':2,
        '星期三':3,'周三':3,'三':3,'星期四':4,'周四':4,'四':4,
        '星期五':5,'周五':5,'五':5,'星期六':6,'周六':6,'六':6,
        '星期日':7,'周日':7,'日':7,'星期天':7
      };
      let weekday = 1;
      for (const [k, v] of Object.entries(wdMap)) {
        if (timeStr.includes(k)) { weekday = v; break; }
      }

      // parseSections from timeStr
      const secMatch = timeStr.match(/(\d+)[-~](\d+)节?/);
      let sections: number[] = [];
      if (secMatch) {
        const s = parseInt(secMatch[1]), e = parseInt(secMatch[2]);
        if (!isNaN(s) && !isNaN(e)) sections = Array.from({length: e - s + 1}, (_, j) => s + j);
      } else {
        const singleMatch = timeStr.match(/第?(\d+)节?/);
        if (singleMatch) sections = [parseInt(singleMatch[1])];
      }

      // parseWeeks: prefers weeksList
      let weeks: number[] = [];
      if (weeksList && weeksList.length > 0) {
        weeks = weeksList;
      } else if (Array.isArray(rawWeeks)) {
        weeks = (rawWeeks as unknown[]).filter((w: unknown) => typeof w === 'number') as number[];
      } else if (typeof rawWeeks === 'string') {
        weeks = parseWeekString(rawWeeks);
      }

      return {
        id: `ocr_${i}_${Date.now()}`,
        course_name: String(rec.course_name || rec.course || rec.name || '未识别课程'),
        weekday,
        sections,
        weeks,
        teacher: '',
        location: '',
        remark: '',
      };
    });

    if (courses.length > 0) {
      console.log(`[ai-upload] normalized ${courses.length} courses`);
      for (let i = 0; i < Math.min(3, rawList.length); i++) {
        const r = rawList[i];
        const c = courses[i];
        console.log(`[ai #${i}] raw: cn="${r.course_name||r.course}" wd="${r.weekday||r.day}" sec="${r.section||r.period}" wk=${JSON.stringify(r.weeks||r.weeks_list)}`);
        console.log(`[ai #${i}] map: cn="${c.course_name}" wd=${c.weekday} sec=${JSON.stringify(c.sections)} wk=${JSON.stringify(c.weeks)}`);
      }
    }
    res.json({
      success: true,
      data: {
        courses,
        course_count: courses.length,
        raw: data.raw_data || [],
        diagnostic: data.diagnostics || {},
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// GET /api/ai/latest-schedule — 加载用户最近的课表和计划
router.get('/latest-schedule', authenticate, async (req, res) => {
  try {
    const [plans] = await pool.query(
      'SELECT id, input_data, plan_data, created_at FROM ai_schedule_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user!.userId]
    );
    const latestPlan = (plans as RowDataPacket[])[0];
    const parseJson = (v: unknown): Record<string, unknown> => {
      if (!v) return {};
      if (typeof v === 'string') return JSON.parse(v);
      return v as Record<string, unknown>;
    };

    const input = latestPlan ? parseJson(latestPlan.input_data) : {};
    const plan = latestPlan?.plan_data ? parseJson(latestPlan.plan_data) : null;

    // Normalize stored courses to EditableCourse format (handle both name and course_name)
    const rawCourses = ((input as Record<string, unknown>).courses || []) as Record<string, unknown>[];
    const courses = rawCourses.map((c: Record<string, unknown>, i: number) => ({
      id: (c.id as string) || `saved_${i}`,
      course_name: String(c.course_name || c.name || '未识别课程'),
      weekday: Number(c.weekday) || 1,
      sections: Array.isArray(c.sections) ? c.sections : [],
      weeks: Array.isArray(c.weeks) ? c.weeks : [],
      teacher: String(c.teacher || ''),
      location: String(c.location || ''),
      remark: String(c.remark || ''),
    }));

    res.json({
      success: true,
      data: {
        courses,
        commitments: (input as Record<string, unknown>).commitments || [],
        plan,
        planId: latestPlan?.id || null,
        createdAt: latestPlan?.created_at || null,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// POST /api/ai/save-schedule — 保存课表（生成计划前持久化）
router.post('/save-schedule', authenticate, async (req, res) => {
  try {
    const { courses, commitments } = req.body;
    if (!courses || courses.length === 0) {
      res.status(400).json({ success: false, error: '课表为空' });
      return;
    }

    const [result] = await pool.query(
      'INSERT INTO ai_schedule_plans (user_id, input_data) VALUES (?, ?)',
      [req.user!.userId, JSON.stringify({ courses, commitments: commitments || [] })]
    );

    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
