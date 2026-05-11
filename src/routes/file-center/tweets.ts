import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';
import { canModifyResource } from '../../middleware/permissions.ts';
import { RowDataPacket, ResultSetHeader } from '../../utils/db-types';

const router = Router();
router.use(authenticate);

// =============================================
// Tweets CRUD
// =============================================

// POST /api/file-center/folders/:id/tweets
router.post('/folders/:id/tweets', async (req, res) => {
  try {
    const { activity_id, title, content, summary, cover_image, link_url, author } = req.body;
    if (!activity_id || !title) {
      res.status(400).json({ success: false, error: 'activity_id 和标题为必填项' });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO file_tweets (activity_id, folder_id, title, content, summary, cover_image, link_url, author, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [activity_id, req.params.id, title, content || null, summary || null, cover_image || null, link_url || null, author || null, req.user!.username]
    );
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// PUT /api/file-center/tweets/:id
router.put('/tweets/:id', async (req, res) => {
  try {
    const [tw] = await pool.query('SELECT created_by FROM file_tweets WHERE id = ?', [req.params.id]);
    const tweets = tw as RowDataPacket[];
    if (tweets.length === 0) {
      res.status(404).json({ success: false, error: '推文不存在' });
      return;
    }
    if (!canModifyResource(req.user!, tweets[0].created_by)) {
      res.status(403).json({ success: false, error: '无权编辑此推文' });
      return;
    }
    const { title, content, summary, cover_image, link_url, author, folder_id } = req.body;
    const [result] = await pool.query(
      'UPDATE file_tweets SET title = COALESCE(?, title), content = COALESCE(?, content), summary = COALESCE(?, summary), cover_image = COALESCE(?, cover_image), link_url = COALESCE(?, link_url), author = COALESCE(?, author), folder_id = COALESCE(?, folder_id) WHERE id = ?',
      [title, content, summary, cover_image, link_url, author, folder_id, req.params.id]
    );
    if ((result as ResultSetHeader).affectedRows === 0) {
      res.status(404).json({ success: false, error: '推文不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// DELETE /api/file-center/tweets/:id
router.delete('/tweets/:id', async (req, res) => {
  try {
    const [tw] = await pool.query('SELECT created_by FROM file_tweets WHERE id = ?', [req.params.id]);
    const tweets = tw as RowDataPacket[];
    if (tweets.length === 0) {
      res.status(404).json({ success: false, error: '推文不存在' });
      return;
    }
    if (!canModifyResource(req.user!, tweets[0].created_by)) {
      res.status(403).json({ success: false, error: '无权删除此推文' });
      return;
    }
    const [result] = await pool.query('DELETE FROM file_tweets WHERE id = ?', [req.params.id]);
    if ((result as ResultSetHeader).affectedRows === 0) {
      res.status(404).json({ success: false, error: '推文不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});


export default router;
