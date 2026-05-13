import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, c.name as counselor_name
       FROM appointments a JOIN counselors c ON a.counselor_id = c.id
       WHERE a.student_user_id = ?
       ORDER BY a.slot_date DESC, a.slot_start DESC`,
      [req.user!.userId]
    );
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/manage', authenticate, async (req, res) => {
  try {
    const [counselors] = await pool.query(
      'SELECT id FROM counselors WHERE user_id = ?', [req.user!.userId]
    );
    if ((counselors as any[]).length === 0) {
      res.status(403).json({ success: false, error: '不是咨询师' });
      return;
    }
    const counselorId = (counselors as any[])[0].id;
    const { status } = req.query;
    let sql = `SELECT a.*, u.username as student_name
               FROM appointments a JOIN users u ON a.student_user_id = u.id
               WHERE a.counselor_id = ?`;
    const params: any[] = [counselorId];
    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    sql += ' ORDER BY a.slot_date ASC, a.slot_start ASC LIMIT 200';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/', authenticate, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { counselor_id, slot_date, slot_start, slot_end, conversation_id } = req.body;
    await conn.beginTransaction();

    const [existing] = await conn.query(
      `SELECT id FROM appointments
       WHERE counselor_id = ? AND slot_date = ? AND slot_start = ?
       AND status NOT IN ('cancelled') FOR UPDATE`,
      [counselor_id, slot_date, slot_start]
    );
    if ((existing as any[]).length > 0) {
      await conn.rollback();
      conn.release();
      res.status(409).json({ success: false, error: '该时段已被预约' });
      return;
    }

    const [result] = await conn.query(
      `INSERT INTO appointments (student_user_id, counselor_id, slot_date, slot_start, slot_end, conversation_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user!.userId, counselor_id, slot_date, slot_start, slot_end, conversation_id || null]
    );

    await conn.commit();
    conn.release();
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error: unknown) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id/confirm', authenticate, async (req, res) => {
  try {
    const [counselors] = await pool.query('SELECT id FROM counselors WHERE user_id = ?', [req.user!.userId]);
    if ((counselors as any[]).length === 0) {
      res.status(403).json({ success: false, error: '不是咨询师' });
      return;
    }
    await pool.query(
      "UPDATE appointments SET status = 'confirmed' WHERE id = ? AND counselor_id = ? AND status = 'pending'",
      [req.params.id, (counselors as any[])[0].id]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id/complete', authenticate, async (req, res) => {
  try {
    const [counselors] = await pool.query('SELECT id FROM counselors WHERE user_id = ?', [req.user!.userId]);
    if ((counselors as any[]).length === 0) {
      res.status(403).json({ success: false, error: '不是咨询师' });
      return;
    }
    await pool.query(
      "UPDATE appointments SET status = 'completed', notes = ? WHERE id = ? AND counselor_id = ?",
      [req.body.notes || null, req.params.id, (counselors as any[])[0].id]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id/cancel', authenticate, async (req, res) => {
  try {
    const [appt] = await pool.query('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    if ((appt as any[]).length === 0) {
      res.status(404).json({ success: false, error: '预约不存在' });
      return;
    }
    await pool.query(
      "UPDATE appointments SET status = 'cancelled' WHERE id = ?",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
