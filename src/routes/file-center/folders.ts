import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';
import { canModifyResource } from '../../middleware/permissions.ts';
import { RowDataPacket, ResultSetHeader } from '../../utils/db-types';

const router = Router();
router.use(authenticate);

// =============================================
// Folders CRUD (tree structure)
// =============================================

// GET /api/file-center/activities/:id/folders - get full folder tree
router.get('/activities/:id/folders', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM file_folders WHERE activity_id = ? ORDER BY parent_id IS NULL DESC, sort_order ASC, name ASC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// POST /api/file-center/activities/:id/folders
router.post('/activities/:id/folders', async (req, res) => {
  try {
    const { name, parent_id } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: '文件夹名称为必填项' });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO file_folders (activity_id, parent_id, name, created_by) VALUES (?, ?, ?, ?)',
      [req.params.id, parent_id || null, name, req.user!.username]
    );
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// PUT /api/file-center/folders/:id
router.put('/folders/:id', async (req, res) => {
  try {
    const [f] = await pool.query('SELECT created_by FROM file_folders WHERE id = ?', [req.params.id]);
    const folders = f as RowDataPacket[];
    if (folders.length === 0) {
      res.status(404).json({ success: false, error: '文件夹不存在' });
      return;
    }
    if (!canModifyResource(req.user!, folders[0].created_by)) {
      res.status(403).json({ success: false, error: '无权编辑此文件夹' });
      return;
    }
    const { name, sort_order, parent_id } = req.body;
    const [result] = await pool.query(
      'UPDATE file_folders SET name = COALESCE(?, name), sort_order = COALESCE(?, sort_order), parent_id = COALESCE(?, parent_id) WHERE id = ?',
      [name, sort_order, parent_id, req.params.id]
    );
    if ((result as ResultSetHeader).affectedRows === 0) {
      res.status(404).json({ success: false, error: '文件夹不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// DELETE /api/file-center/folders/:id
router.delete('/folders/:id', async (req, res) => {
  try {
    const [f] = await pool.query('SELECT created_by FROM file_folders WHERE id = ?', [req.params.id]);
    const folders = f as RowDataPacket[];
    if (folders.length === 0) {
      res.status(404).json({ success: false, error: '文件夹不存在' });
      return;
    }
    if (!canModifyResource(req.user!, folders[0].created_by)) {
      res.status(403).json({ success: false, error: '无权删除此文件夹' });
      return;
    }
    // Move child items to parent folder or set folder_id to null
    await pool.query('UPDATE file_items SET folder_id = NULL WHERE folder_id = ?', [req.params.id]);
    await pool.query('UPDATE file_tweets SET folder_id = NULL WHERE folder_id = ?', [req.params.id]);
    // Re-parent child folders
    const [folder] = await pool.query('SELECT parent_id FROM file_folders WHERE id = ?', [req.params.id]);
    const parentId = (folder as RowDataPacket[])[0]?.parent_id || null;
    await pool.query('UPDATE file_folders SET parent_id = ? WHERE parent_id = ?', [parentId, req.params.id]);

    const [result] = await pool.query('DELETE FROM file_folders WHERE id = ?', [req.params.id]);
    if ((result as ResultSetHeader).affectedRows === 0) {
      res.status(404).json({ success: false, error: '文件夹不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});


export default router;
