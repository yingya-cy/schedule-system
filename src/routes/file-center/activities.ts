import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';
import { canModifyResource } from '../../middleware/permissions.ts';
import { validate, createActivitySchema } from '../../utils/validation.ts';
import { RowDataPacket, ResultSetHeader } from '../../utils/db-types';

const router = Router();
router.use(authenticate);

// =============================================
// Activities CRUD
// =============================================

// GET /api/file-center/activities
router.get('/activities', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM file_activities ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// GET /api/file-center/activities/:id
router.get('/activities/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM file_activities WHERE id = ?', [req.params.id]);
    const activities = rows as RowDataPacket[];
    if (activities.length === 0) {
      res.status(404).json({ success: false, error: '活动不存在' });
      return;
    }
    res.json({ success: true, data: activities[0] });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// POST /api/file-center/activities
router.post('/activities', validate(createActivitySchema), async (req, res) => {
  try {
    const { name, description, department, cover_url } = req.body;
    const [result] = await pool.query(
      'INSERT INTO file_activities (name, description, department, cover_url, created_by) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, department, cover_url || null, req.user!.username]
    );
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// PUT /api/file-center/activities/:id
router.put('/activities/:id', async (req, res) => {
  try {
    const [act] = await pool.query('SELECT created_by FROM file_activities WHERE id = ?', [req.params.id]);
    const activities = act as RowDataPacket[];
    if (activities.length === 0) {
      res.status(404).json({ success: false, error: '活动不存在' });
      return;
    }
    if (!canModifyResource(req.user!, activities[0].created_by)) {
      res.status(403).json({ success: false, error: '无权编辑此活动' });
      return;
    }
    const { name, description, department, cover_url, status } = req.body;
    const [result] = await pool.query(
      'UPDATE file_activities SET name = COALESCE(?, name), description = COALESCE(?, description), department = COALESCE(?, department), cover_url = COALESCE(?, cover_url), status = COALESCE(?, status) WHERE id = ?',
      [name, description, department, cover_url, status, req.params.id]
    );
    if ((result as ResultSetHeader).affectedRows === 0) {
      res.status(404).json({ success: false, error: '活动不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// DELETE /api/file-center/activities/:id
router.delete('/activities/:id', async (req, res) => {
  try {
    const activityId = req.params.id;
    const [act] = await pool.query('SELECT created_by FROM file_activities WHERE id = ?', [activityId]);
    const activities = act as RowDataPacket[];
    if (activities.length === 0) {
      res.status(404).json({ success: false, error: '活动不存在' });
      return;
    }
    if (!canModifyResource(req.user!, activities[0].created_by)) {
      res.status(403).json({ success: false, error: '无权删除此活动' });
      return;
    }
    // Manually delete child records first to avoid FK cascade issues
    await pool.query('DELETE FROM file_tweets WHERE activity_id = ?', [activityId]);
    await pool.query('UPDATE file_items SET folder_id = NULL WHERE activity_id = ?', [activityId]);
    await pool.query('DELETE FROM file_items WHERE activity_id = ?', [activityId]);
    await pool.query('UPDATE file_folders SET parent_id = NULL WHERE activity_id = ?', [activityId]);
    await pool.query('DELETE FROM file_folders WHERE activity_id = ?', [activityId]);
    const [result] = await pool.query('DELETE FROM file_activities WHERE id = ?', [activityId]);
    if ((result as ResultSetHeader).affectedRows === 0) {
      res.status(404).json({ success: false, error: '活动不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

export default router;
