import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate, requireRole } from '../../middleware/auth.ts';
import { RowDataPacket, ResultSetHeader, getErrorMessage } from '../../utils/db-types';

const router = Router();

type CounselorRow = RowDataPacket & {
  id: number;
  user_id: number;
  name: string;
  title: string;
  bio: string;
  avatar_url: string;
  is_active: number;
  created_at: string;
  slots_raw: string;
};

function parseSlots(slotsRaw: string | null) {
  if (!slotsRaw) return [];
  return slotsRaw.split(';').map((s) => {
    const colonIdx = s.indexOf(':');
    const day = s.substring(0, colonIdx);
    const range = s.substring(colonIdx + 1);
    const dashIdx = range.indexOf('-');
    const start = range.substring(0, dashIdx);
    const end = range.substring(dashIdx + 1);
    return { day_of_week: parseInt(day), start_time: start, end_time: end };
  });
}

router.get('/', authenticate, async (req, res) => {
  try {
    const showAll = req.query.all === '1';
    let sql = `SELECT c.*,
        GROUP_CONCAT(CONCAT(cs.day_of_week, ':', cs.start_time, '-', cs.end_time) SEPARATOR ';') as slots_raw
       FROM counselors c
       LEFT JOIN counselor_slots cs ON cs.counselor_id = c.id`;
    if (!showAll) sql += ' WHERE c.is_active = 1';
    sql += ' GROUP BY c.id ORDER BY c.id';
    const [rows] = await pool.query(sql);
    const counselors = (rows as CounselorRow[]).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      title: r.title,
      bio: r.bio,
      avatar_url: r.avatar_url,
      is_active: r.is_active,
      created_at: r.created_at,
      slots: parseSlots(r.slots_raw),
    }));
    res.json({ success: true, data: counselors });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*,
        GROUP_CONCAT(CONCAT(cs.day_of_week, ':', cs.start_time, '-', cs.end_time) SEPARATOR ';') as slots_raw
       FROM counselors c
       LEFT JOIN counselor_slots cs ON cs.counselor_id = c.id
       WHERE c.id = ? AND c.is_active = 1
       GROUP BY c.id`,
      [req.params.id]
    );
    const list = rows as CounselorRow[];
    if (list.length === 0) {
      res.status(404).json({ success: false, error: '咨询师不存在' });
      return;
    }
    const r = list[0];
    res.json({
      success: true,
      data: {
        id: r.id,
        user_id: r.user_id,
        name: r.name,
        title: r.title,
        bio: r.bio,
        avatar_url: r.avatar_url,
        is_active: r.is_active,
        created_at: r.created_at,
        slots: parseSlots(r.slots_raw),
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// === Admin CRUD ===

router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { user_id, name, title, bio, avatar_url } = req.body;
    const [result] = await pool.query(
      'INSERT INTO counselors (user_id, name, title, bio, avatar_url) VALUES (?, ?, ?, ?, ?)',
      [user_id, name, title || null, bio || null, avatar_url || null]
    );
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, title, bio, avatar_url } = req.body;
    const fields: string[] = [];
    const values: (string | number)[] = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
    if (avatar_url !== undefined) { fields.push('avatar_url = ?'); values.push(avatar_url); }
    if (fields.length === 0) {
      res.status(400).json({ success: false, error: '没有要更新的字段' });
      return;
    }
    values.push(req.params.id);
    await pool.query(`UPDATE counselors SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.put('/:id/toggle', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE counselors SET is_active = NOT is_active WHERE id = ?',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/:id/slots', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { day_of_week, start_time, end_time } = req.body;
    const [result] = await pool.query(
      'INSERT INTO counselor_slots (counselor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
      [req.params.id, day_of_week, start_time, end_time]
    );
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.delete('/:id/slots/:slotId', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM counselor_slots WHERE id = ? AND counselor_id = ?',
      [req.params.slotId, req.params.id]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
