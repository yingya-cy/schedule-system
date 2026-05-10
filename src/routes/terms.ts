import { Router } from 'express';
import pool from '../config/database.ts';
import { authenticate, requireRole } from '../middleware/auth.ts';
import { RowDataPacket, ResultSetHeader } from '../utils/db-types';

const router = Router();

// GET /api/terms — list all terms
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM terms ORDER BY sequence_number DESC');
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// GET /api/terms/current — get active term
router.get('/current', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM terms WHERE status = 'active' LIMIT 1");
    const terms = rows as RowDataPacket[];
    res.json({ success: true, data: terms[0] || null });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// POST /api/terms — admin creates a new term
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, academic_year, semester } = req.body;
    if (!name || !academic_year || !semester) {
      res.status(400).json({ success: false, error: 'name, academic_year, semester 为必填项' });
      return;
    }
    const [maxRow] = await pool.query('SELECT MAX(sequence_number) as maxSeq FROM terms');
    const seq = ((maxRow as RowDataPacket[])[0].maxSeq || 0) + 1;
    const [result] = await pool.query(
      'INSERT INTO terms (name, academic_year, semester, sequence_number) VALUES (?, ?, ?, ?)',
      [name, academic_year, semester, seq]
    );
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// POST /api/terms/transition — 换届
router.post('/transition', authenticate, requireRole('admin'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { academic_year, semester, name, retain_user_ids = [], remove_user_ids = [] } = req.body;
    if (!academic_year || !semester) {
      res.status(400).json({ success: false, error: 'academic_year, semester 为必填项' });
      await conn.rollback();
      return;
    }

    // Archive current active term
    const [currentRows] = await conn.query("SELECT * FROM terms WHERE status = 'active' LIMIT 1");
    const currentTerms = currentRows as RowDataPacket[];
    if (currentTerms.length > 0) {
      await conn.query("UPDATE terms SET status = 'archived' WHERE id = ?", [currentTerms[0].id]);
    }
    const newSeq = currentTerms.length > 0 ? currentTerms[0].sequence_number + 1 : 1;

    // Create new term
    const newName = name || `${academic_year}${semester}·第${newSeq}届`;
    const [result] = await conn.query(
      'INSERT INTO terms (name, academic_year, semester, sequence_number, status) VALUES (?, ?, ?, ?, ?)',
      [newName, academic_year, semester, newSeq, 'active']
    );
    const newTermId = (result as ResultSetHeader).insertId;

    // Deactivate removed users
    if (remove_user_ids.length > 0) {
      await conn.query(
        `UPDATE users SET is_active = 0 WHERE id IN (${remove_user_ids.map(() => '?').join(',')})`,
        remove_user_ids
      );
    }

    await conn.commit();
    res.json({
      success: true,
      data: {
        new_term: { id: newTermId, name: newName, sequence_number: newSeq },
        deactivated_count: remove_user_ids.length,
        retained_count: retain_user_ids.length,
      },
    });
  } catch (error: unknown) {
    await conn.rollback();
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  } finally {
    conn.release();
  }
});

export default router;
