import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*,
        GROUP_CONCAT(CONCAT(cs.day_of_week, ':', cs.start_time, '-', cs.end_time) SEPARATOR ';') as slots_raw
       FROM counselors c
       LEFT JOIN counselor_slots cs ON cs.counselor_id = c.id
       WHERE c.is_active = 1
       GROUP BY c.id
       ORDER BY c.id`
    );
    const counselors = (rows as any[]).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      title: r.title,
      bio: r.bio,
      avatar_url: r.avatar_url,
      is_active: r.is_active,
      created_at: r.created_at,
      slots: r.slots_raw
        ? r.slots_raw.split(';').map((s: string) => {
            const [day, range] = s.split(':');
            const [start, end] = range.split('-');
            return { day_of_week: parseInt(day), start_time: start, end_time: end };
          })
        : [],
    }));
    res.json({ success: true, data: counselors });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
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
    const list = rows as any[];
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
        slots: r.slots_raw
          ? r.slots_raw.split(';').map((s: string) => {
              const [day, range] = s.split(':');
              const [start, end] = range.split('-');
              return { day_of_week: parseInt(day), start_time: start, end_time: end };
            })
          : [],
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
