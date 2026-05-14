import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader, getErrorMessage } from '../utils/db-types';

const router = Router();
const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5002';

// POST /api/ai/schedule-plan — 生成计划 + 存储
router.post('/schedule-plan', authenticate, async (req, res) => {
  try {
    const { courses, commitments, grade, major, next_monday } = req.body;

    if (!courses || courses.length === 0) {
      res.status(400).json({ success: false, error: '课表为空，请先选择有课表的学期' });
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

    // 存储到 DB
    const [result] = await pool.query(
      'INSERT INTO ai_schedule_plans (user_id, term_id, input_data, plan_data) VALUES (?, ?, ?, ?)',
      [
        req.user!.userId,
        req.body.term_id || null,
        JSON.stringify({ courses, commitments, grade, major }),
        JSON.stringify(plan),
      ]
    );

    res.json({
      success: true,
      data: { id: (result as ResultSetHeader).insertId, plan },
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

export default router;
