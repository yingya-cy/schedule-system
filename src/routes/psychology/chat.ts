import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';
import { RowDataPacket, ResultSetHeader, getErrorMessage } from '../../utils/db-types';

const router = Router();

router.get('/conversations', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT cc.*,
        c.name as counselor_name, c.avatar_url,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.conversation_id = cc.id AND cm.read_at IS NULL AND cm.sender_role != 'student') as unread_count
       FROM chat_conversations cc
       JOIN counselors c ON cc.counselor_id = c.id
       WHERE (cc.student_user_id = ? OR cc.counselor_id IN (SELECT id FROM counselors WHERE user_id = ?))
         AND cc.is_active = 1
       ORDER BY cc.created_at DESC`,
      [req.user!.userId, req.user!.userId]
    );
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/conversations', authenticate, async (req, res) => {
  try {
    const { counselor_id } = req.body;
    const [existing] = await pool.query(
      'SELECT id FROM chat_conversations WHERE student_user_id = ? AND counselor_id = ? AND is_active = 1',
      [req.user!.userId, counselor_id]
    );
    const rows = existing as RowDataPacket[];
    if (rows.length > 0) {
      res.json({ success: true, data: { id: rows[0].id } });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO chat_conversations (student_user_id, counselor_id) VALUES (?, ?)',
      [req.user!.userId, counselor_id]
    );
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/:conversationId/messages', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { since } = req.query;
    let sql = 'SELECT * FROM chat_messages WHERE conversation_id = ?';
    const params: (string | number)[] = [conversationId];
    if (since) {
      sql += ' AND created_at > ?';
      params.push(String(since));
    }
    sql += ' ORDER BY created_at ASC LIMIT 200';
    const [rows] = await pool.query(sql, params);

    await pool.query(
      'UPDATE chat_messages SET read_at = NOW() WHERE conversation_id = ? AND read_at IS NULL AND sender_role != ?',
      [conversationId, req.user!.role === 'admin' ? 'admin' : 'student']
    );

    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/:conversationId/messages', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const [conv] = await pool.query(
      'SELECT * FROM chat_conversations WHERE id = ? AND is_active = 1',
      [conversationId]
    );
    const convRows = conv as RowDataPacket[];
    if (convRows.length === 0) {
      res.status(404).json({ success: false, error: '会话不存在' });
      return;
    }
    const isStudent = req.user!.userId === convRows[0].student_user_id;
    const senderRole = isStudent ? 'student' : 'counselor';
    const [result] = await pool.query(
      'INSERT INTO chat_messages (conversation_id, sender_role, sender_id, content) VALUES (?, ?, ?, ?)',
      [conversationId, senderRole, req.user!.userId, content]
    );
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
