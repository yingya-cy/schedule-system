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

// POST /api/ai/schedule-plan — 生成计划 + 存储
router.post('/schedule-plan', authenticate, async (req, res) => {
  try {
    const { courses, commitments, grade, major, next_monday } = req.body;

    if (!courses || courses.length === 0) {
      res.status(400).json({ success: false, error: '课表为空，请先上传课表' });
      return;
    }

    // 调用 Flask
    const flaskRes = await fetch(`${FLASK_URL}/api/ai/schedule-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courses, commitments, grade, major, next_monday }),
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

    const formData = new FormData();
    const f = new File([file.buffer], file.originalname, { type: file.mimetype });
    formData.append('file', f);

    // Detect if it's an image or PDF
    const isPdf = file.mimetype === 'application/pdf'
      || file.originalname.toLowerCase().endsWith('.pdf');
    const ocrEndpoint = isPdf ? '/api/ocr/pdf' : '/api/ocr/image';

    const flaskRes = await fetch(`${FLASK_URL}${ocrEndpoint}`, {
      method: 'POST',
      body: formData,
    });

    if (!flaskRes.ok) {
      const errText = await flaskRes.text();
      res.status(502).json({ success: false, error: `OCR 失败: ${errText.slice(0, 200)}` });
      return;
    }

    const data = await flaskRes.json();
    if (!data.success) {
      res.status(422).json({ success: false, error: '未能识别课程数据，请检查图片清晰度' });
      return;
    }

    // Normalize OCR output to EditableCourse format
    const courses = (data.schedule_data || []).map((c: Record<string, unknown>, i: number) => {
      // Normalize weeks: handle complex week objects from OCR
      let weeks: number[] = [];
      const weekVal = c.week;
      if (Array.isArray(weekVal)) {
        weeks = weekVal as number[];
      } else if (typeof weekVal === 'object' && weekVal !== null) {
        const w = weekVal as Record<string, unknown>;
        if (w.type === 'range' && typeof w.start === 'number' && typeof w.end === 'number') {
          for (let n = w.start; n <= w.end; n++) {
            if (w.rule === 'odd' && n % 2 === 0) continue;
            if (w.rule === 'even' && n % 2 === 1) continue;
            weeks.push(n);
          }
        } else if (w.type === 'list' && Array.isArray(w.weeks)) {
          weeks = w.weeks as number[];
        } else if (w.type === 'multi_range' && Array.isArray(w.ranges)) {
          (w.ranges as Array<{ start: number; end: number }>).forEach((r) => {
            for (let n = r.start; n <= r.end; n++) weeks.push(n);
          });
        }
      }

      // Normalize sections: OCR returns 'section' (array), we need 'sections'
      let sections: number[] = [];
      const sectionVal = (c as Record<string, unknown>).section;
      if (Array.isArray(sectionVal)) {
        sections = sectionVal as number[];
      } else if (Array.isArray(c.sections)) {
        sections = c.sections as number[];
      }

      return {
        id: `ocr_${i}_${Date.now()}`,
        course_name: (c.course_name as string) || '未识别课程',
        weekday: (c.weekday as number) || 1,
        sections,
        weeks,
        teacher: (c.teacher as string) || '',
        location: (c.location as string) || '',
        remark: '',
      };
    });

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

    res.json({
      success: true,
      data: {
        courses: (input as Record<string, unknown>).courses || [],
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
