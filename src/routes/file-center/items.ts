import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';
import { canModifyResource } from '../../middleware/permissions.ts';
import { RowDataPacket, ResultSetHeader } from '../../utils/db-types';

const router = Router();
router.use(authenticate);

// =============================================
// File Items CRUD
// =============================================

// GET /api/file-center/folders/:id/items
router.get('/folders/:id/items', async (req, res) => {
  try {
    const [files] = await pool.query(
      "SELECT id, original_filename, stored_filename, file_size, mime_type, file_category, oss_object_key, oss_url, thumbnail_url, description, created_by, created_at, 'file' as item_type FROM file_items WHERE folder_id = ? ORDER BY created_at DESC",
      [req.params.id]
    );
    const [tweets] = await pool.query(
      "SELECT id, title, content, summary, cover_image, link_url, author, created_by, created_at, 'tweet' as item_type FROM file_tweets WHERE folder_id = ? ORDER BY created_at DESC",
      [req.params.id]
    );
    const [subfolders] = await pool.query(
      "SELECT id, activity_id, parent_id, name, sort_order, created_by FROM file_folders WHERE parent_id = ? ORDER BY sort_order, name",
      [req.params.id]
    );
    res.json({ success: true, data: { files, tweets, subfolders } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// POST /api/file-center/folders/:id/items
router.post('/folders/:id/items', async (req, res) => {
  try {
    const { activity_id, original_filename, stored_filename, file_size, mime_type, file_category, oss_url, description, schedule_id } = req.body;
    if (!activity_id || !original_filename) {
      res.status(400).json({ success: false, error: 'activity_id 和文件名为必填项' });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO file_items (activity_id, folder_id, original_filename, stored_filename, file_size, mime_type, file_category, oss_url, description, schedule_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [activity_id, req.params.id, original_filename, stored_filename || original_filename, file_size || 0, mime_type || null, file_category || 'document', oss_url || null, description || null, schedule_id || null, req.user!.username]
    );
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// PUT /api/file-center/items/:id
router.put('/items/:id', async (req, res) => {
  try {
    const [it] = await pool.query('SELECT created_by FROM file_items WHERE id = ?', [req.params.id]);
    const items = it as RowDataPacket[];
    if (items.length === 0) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }
    if (!canModifyResource(req.user!, items[0].created_by)) {
      res.status(403).json({ success: false, error: '无权编辑此文件' });
      return;
    }
    const { original_filename, description, folder_id } = req.body;
    const [result] = await pool.query(
      'UPDATE file_items SET original_filename = COALESCE(?, original_filename), description = COALESCE(?, description), folder_id = COALESCE(?, folder_id) WHERE id = ?',
      [original_filename, description, folder_id, req.params.id]
    );
    if ((result as ResultSetHeader).affectedRows === 0) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// PUT /api/file-center/items/:id/schedule - link file item to a schedule
router.put('/items/:id/schedule', async (req, res) => {
  try {
    const { schedule_id } = req.body;
    const [result] = await pool.query(
      'UPDATE file_items SET schedule_id = ? WHERE id = ?',
      [schedule_id || null, req.params.id]
    );
    if ((result as ResultSetHeader).affectedRows === 0) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// DELETE /api/file-center/items/:id
router.delete('/items/:id', async (req, res) => {
  try {
    const [it] = await pool.query('SELECT created_by FROM file_items WHERE id = ?', [req.params.id]);
    const items = it as RowDataPacket[];
    if (items.length === 0) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }
    if (!canModifyResource(req.user!, items[0].created_by)) {
      res.status(403).json({ success: false, error: '无权删除此文件' });
      return;
    }
    const [result] = await pool.query('DELETE FROM file_items WHERE id = ?', [req.params.id]);
    if ((result as ResultSetHeader).affectedRows === 0) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});


export default router;
