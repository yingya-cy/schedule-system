import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';
import { RowDataPacket, getErrorMessage } from '../../utils/db-types';
import counselorsRouter from './counselors.ts';
import chatRouter from './chat.ts';
import appointmentsRouter from './appointments.ts';

const router = Router();

// GET /api/psychology/me — 当前用户的咨询师档案（null = 非咨询师）
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM counselors WHERE user_id = ?',
      [req.user!.userId]
    );
    const list = rows as RowDataPacket[];
    res.json({ success: true, data: list.length > 0 ? list[0] : null });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.use('/counselors', counselorsRouter);
router.use('/chat', chatRouter);
router.use('/appointments', appointmentsRouter);

export default router;
