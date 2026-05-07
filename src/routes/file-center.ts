import { Router } from 'express';
import pool from '../config/database.ts';
import { authenticate, AuthUser } from '../middleware/auth.ts';
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  getObjectUrl,
  getObjectContent,
  buildObjectKey,
} from '../services/ossService.ts';

const router = Router();

// All file center routes require authentication
router.use(authenticate);

function canModify(user: AuthUser, createdBy: string): boolean {
  return user.role === 'admin' || user.username === createdBy;
}

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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/file-center/activities/:id
router.get('/activities/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM file_activities WHERE id = ?', [req.params.id]);
    const activities = rows as any[];
    if (activities.length === 0) {
      res.status(404).json({ success: false, error: '活动不存在' });
      return;
    }
    res.json({ success: true, data: activities[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/file-center/activities
router.post('/activities', async (req, res) => {
  try {
    const { name, description, department, cover_url } = req.body;
    if (!name || !department) {
      res.status(400).json({ success: false, error: '名称和部门为必填项' });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO file_activities (name, description, department, cover_url, created_by) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, department, cover_url || null, req.user!.username]
    );
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/file-center/activities/:id
router.put('/activities/:id', async (req, res) => {
  try {
    const [act] = await pool.query('SELECT created_by FROM file_activities WHERE id = ?', [req.params.id]);
    const activities = act as any[];
    if (activities.length === 0) {
      res.status(404).json({ success: false, error: '活动不存在' });
      return;
    }
    if (!canModify(req.user!, activities[0].created_by)) {
      res.status(403).json({ success: false, error: '无权编辑此活动' });
      return;
    }
    const { name, description, department, cover_url, status } = req.body;
    const [result] = await pool.query(
      'UPDATE file_activities SET name = COALESCE(?, name), description = COALESCE(?, description), department = COALESCE(?, department), cover_url = COALESCE(?, cover_url), status = COALESCE(?, status) WHERE id = ?',
      [name, description, department, cover_url, status, req.params.id]
    );
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ success: false, error: '活动不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/file-center/activities/:id
router.delete('/activities/:id', async (req, res) => {
  try {
    const activityId = req.params.id;
    const [act] = await pool.query('SELECT created_by FROM file_activities WHERE id = ?', [activityId]);
    const activities = act as any[];
    if (activities.length === 0) {
      res.status(404).json({ success: false, error: '活动不存在' });
      return;
    }
    if (!canModify(req.user!, activities[0].created_by)) {
      res.status(403).json({ success: false, error: '无权删除此活动' });
      return;
    }
    // Manually delete child records first to avoid FK cascade issues
    await pool.query('DELETE FROM file_permissions WHERE activity_id = ?', [activityId]);
    await pool.query('DELETE FROM file_tweets WHERE activity_id = ?', [activityId]);
    await pool.query('UPDATE file_items SET folder_id = NULL WHERE activity_id = ?', [activityId]);
    await pool.query('DELETE FROM file_items WHERE activity_id = ?', [activityId]);
    await pool.query('UPDATE file_folders SET parent_id = NULL WHERE activity_id = ?', [activityId]);
    await pool.query('DELETE FROM file_folders WHERE activity_id = ?', [activityId]);
    const [result] = await pool.query('DELETE FROM file_activities WHERE id = ?', [activityId]);
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ success: false, error: '活动不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/file-center/folders/:id
router.put('/folders/:id', async (req, res) => {
  try {
    const [f] = await pool.query('SELECT created_by FROM file_folders WHERE id = ?', [req.params.id]);
    const folders = f as any[];
    if (folders.length === 0) {
      res.status(404).json({ success: false, error: '文件夹不存在' });
      return;
    }
    if (!canModify(req.user!, folders[0].created_by)) {
      res.status(403).json({ success: false, error: '无权编辑此文件夹' });
      return;
    }
    const { name, sort_order, parent_id } = req.body;
    const [result] = await pool.query(
      'UPDATE file_folders SET name = COALESCE(?, name), sort_order = COALESCE(?, sort_order), parent_id = COALESCE(?, parent_id) WHERE id = ?',
      [name, sort_order, parent_id, req.params.id]
    );
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ success: false, error: '文件夹不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/file-center/folders/:id
router.delete('/folders/:id', async (req, res) => {
  try {
    const [f] = await pool.query('SELECT created_by FROM file_folders WHERE id = ?', [req.params.id]);
    const folders = f as any[];
    if (folders.length === 0) {
      res.status(404).json({ success: false, error: '文件夹不存在' });
      return;
    }
    if (!canModify(req.user!, folders[0].created_by)) {
      res.status(403).json({ success: false, error: '无权删除此文件夹' });
      return;
    }
    // Move child items to parent folder or set folder_id to null
    await pool.query('UPDATE file_items SET folder_id = NULL WHERE folder_id = ?', [req.params.id]);
    await pool.query('UPDATE file_tweets SET folder_id = NULL WHERE folder_id = ?', [req.params.id]);
    // Re-parent child folders
    const [folder] = await pool.query('SELECT parent_id FROM file_folders WHERE id = ?', [req.params.id]);
    const parentId = (folder as any[])[0]?.parent_id || null;
    await pool.query('UPDATE file_folders SET parent_id = ? WHERE parent_id = ?', [parentId, req.params.id]);

    const [result] = await pool.query('DELETE FROM file_folders WHERE id = ?', [req.params.id]);
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ success: false, error: '文件夹不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/file-center/items/:id
router.put('/items/:id', async (req, res) => {
  try {
    const [it] = await pool.query('SELECT created_by FROM file_items WHERE id = ?', [req.params.id]);
    const items = it as any[];
    if (items.length === 0) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }
    if (!canModify(req.user!, items[0].created_by)) {
      res.status(403).json({ success: false, error: '无权编辑此文件' });
      return;
    }
    const { original_filename, description, folder_id } = req.body;
    const [result] = await pool.query(
      'UPDATE file_items SET original_filename = COALESCE(?, original_filename), description = COALESCE(?, description), folder_id = COALESCE(?, folder_id) WHERE id = ?',
      [original_filename, description, folder_id, req.params.id]
    );
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/file-center/items/:id
router.delete('/items/:id', async (req, res) => {
  try {
    const [it] = await pool.query('SELECT created_by FROM file_items WHERE id = ?', [req.params.id]);
    const items = it as any[];
    if (items.length === 0) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }
    if (!canModify(req.user!, items[0].created_by)) {
      res.status(403).json({ success: false, error: '无权删除此文件' });
      return;
    }
    const [result] = await pool.query('DELETE FROM file_items WHERE id = ?', [req.params.id]);
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/file-center/tweets/:id
router.put('/tweets/:id', async (req, res) => {
  try {
    const [tw] = await pool.query('SELECT created_by FROM file_tweets WHERE id = ?', [req.params.id]);
    const tweets = tw as any[];
    if (tweets.length === 0) {
      res.status(404).json({ success: false, error: '推文不存在' });
      return;
    }
    if (!canModify(req.user!, tweets[0].created_by)) {
      res.status(403).json({ success: false, error: '无权编辑此推文' });
      return;
    }
    const { title, content, summary, cover_image, link_url, author, folder_id } = req.body;
    const [result] = await pool.query(
      'UPDATE file_tweets SET title = COALESCE(?, title), content = COALESCE(?, content), summary = COALESCE(?, summary), cover_image = COALESCE(?, cover_image), link_url = COALESCE(?, link_url), author = COALESCE(?, author), folder_id = COALESCE(?, folder_id) WHERE id = ?',
      [title, content, summary, cover_image, link_url, author, folder_id, req.params.id]
    );
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ success: false, error: '推文不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/file-center/tweets/:id
router.delete('/tweets/:id', async (req, res) => {
  try {
    const [tw] = await pool.query('SELECT created_by FROM file_tweets WHERE id = ?', [req.params.id]);
    const tweets = tw as any[];
    if (tweets.length === 0) {
      res.status(404).json({ success: false, error: '推文不存在' });
      return;
    }
    if (!canModify(req.user!, tweets[0].created_by)) {
      res.status(403).json({ success: false, error: '无权删除此推文' });
      return;
    }
    const [result] = await pool.query('DELETE FROM file_tweets WHERE id = ?', [req.params.id]);
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ success: false, error: '推文不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// Permissions CRUD
// =============================================

// GET /api/file-center/permissions/:activityId
router.get('/permissions/:activityId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM file_permissions WHERE activity_id = ? ORDER BY created_at DESC',
      [req.params.activityId]
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/file-center/permissions
router.post('/permissions', async (req, res) => {
  try {
    const { activity_id, file_id, folder_id, permission_type, grantee_type, grantee_name } = req.body;
    if (!activity_id || !permission_type || !grantee_name) {
      res.status(400).json({ success: false, error: 'activity_id, permission_type, grantee_name 为必填项' });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO file_permissions (activity_id, file_id, folder_id, permission_type, grantee_type, grantee_name) VALUES (?, ?, ?, ?, ?, ?)',
      [activity_id, file_id || null, folder_id || null, permission_type, grantee_type || 'department', grantee_name]
    );
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/file-center/permissions/:id
router.delete('/permissions/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM file_permissions WHERE id = ?', [req.params.id]);
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ success: false, error: '权限记录不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/file-center/my-activities - activities the current user has access to
router.get('/my-activities', async (req, res) => {
  try {
    const { role, username } = req.user!;
    // Admins see all activities
    if (role === 'admin') {
      const [rows] = await pool.query('SELECT * FROM file_activities ORDER BY created_at DESC');
      res.json({ success: true, data: rows });
      return;
    }
    // Others see activities where they have permissions or created them
    const [rows] = await pool.query(
      `SELECT DISTINCT a.* FROM file_activities a
       LEFT JOIN file_permissions p ON a.id = p.activity_id
       WHERE a.created_by = ? OR (p.grantee_type = 'user' AND p.grantee_name = ?)
       ORDER BY a.created_at DESC`,
      [username, username]
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// OSS Presigned URL Endpoints
// =============================================

// POST /api/file-center/oss/init - create DB record first, then generate presigned URL
// Returns: { id, uploadUrl, objectKey } — frontend uploads to OSS, no confirm needed
router.post('/oss/init', async (req, res) => {
  try {
    const { activity_id, folder_id, original_filename, file_size, mime_type, file_category, description } = req.body;
    if (!activity_id || !folder_id || !original_filename) {
      res.status(400).json({ success: false, error: 'activity_id, folder_id, original_filename 为必填项' });
      return;
    }

    // 1. Create DB record first to get the auto-increment ID
    const [insertResult] = await pool.query(
      'INSERT INTO file_items (activity_id, folder_id, original_filename, stored_filename, file_size, mime_type, file_category, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [activity_id, folder_id, original_filename, original_filename, file_size || 0, mime_type || null, file_category || 'document', description || null, req.user!.username]
    );
    const fileId = (insertResult as any).insertId;

    // 2. Get activity name
    const [activityRows] = await pool.query('SELECT name FROM file_activities WHERE id = ?', [activity_id]);
    const activityName = (activityRows as any[])[0]?.name || `activity_${activity_id}`;

    // 3. Build folder path by traversing parent chain
    const folderParts: string[] = [];
    let currentId: number | null = folder_id;
    while (currentId) {
      const [folderRows] = await pool.query('SELECT id, parent_id, name FROM file_folders WHERE id = ?', [currentId]);
      if ((folderRows as any[]).length === 0) break;
      folderParts.unshift((folderRows as any[])[0].name);
      currentId = (folderRows as any[])[0].parent_id;
    }
    const folderPath = folderParts.join('/');

    // 4. Build OSS key with readable names + fileId
    const objectKey = buildObjectKey(activityName, folderPath, fileId, original_filename);
    const ossUrl = getObjectUrl(objectKey);

    // 5. Update DB record with OSS key
    await pool.query(
      'UPDATE file_items SET oss_object_key = ?, oss_url = ? WHERE id = ?',
      [objectKey, ossUrl, fileId]
    );

    // 6. Generate presigned upload URL
    const { uploadUrl } = await generatePresignedUploadUrl(objectKey, mime_type || undefined);

    res.json({ success: true, data: { id: fileId, uploadUrl, objectKey } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/file-center/oss/presigned-url
router.post('/oss/presigned-url', async (req, res) => {
  try {
    const { activity_id, folder_id, filename, content_type } = req.body;
    if (!activity_id || !folder_id || !filename) {
      res.status(400).json({ success: false, error: 'activity_id, folder_id, filename 为必填项' });
      return;
    }
    const objectKey = buildObjectKey(`activity_${activity_id}`, `folder_${folder_id}`, Date.now(), filename);
    const result = await generatePresignedUploadUrl(objectKey, content_type || undefined);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/file-center/oss/confirm
router.post('/oss/confirm', async (req, res) => {
  try {
    const { activity_id, folder_id, object_key, original_filename, file_size, mime_type, file_category, description, schedule_id } = req.body;
    if (!activity_id || !folder_id || !object_key || !original_filename) {
      res.status(400).json({ success: false, error: '缺少必要参数' });
      return;
    }
    const ossUrl = getObjectUrl(object_key);
    const [result] = await pool.query(
      'INSERT INTO file_items (activity_id, folder_id, original_filename, stored_filename, file_size, mime_type, file_category, oss_object_key, oss_url, description, schedule_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [activity_id, folder_id, original_filename, original_filename, file_size || 0, mime_type || null, file_category || 'document', object_key, ossUrl, description || null, schedule_id || null, req.user!.username]
    );
    res.json({ success: true, data: { id: (result as any).insertId, oss_url: ossUrl } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/file-center/oss/download-url
router.post('/oss/download-url', async (req, res) => {
  try {
    const { object_key } = req.body;
    if (!object_key) {
      res.status(400).json({ success: false, error: 'object_key 为必填项' });
      return;
    }
    const url = await generatePresignedDownloadUrl(object_key);
    res.json({ success: true, data: { downloadUrl: url } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/file-center/oss/download - server proxy with original filename
router.get('/oss/download', async (req, res) => {
  try {
    const key = req.query.key as string;
    const filename = req.query.filename as string;
    if (!key) {
      res.status(400).json({ success: false, error: 'key 为必填项' });
      return;
    }
    const { body, contentType } = await getObjectContent(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename || key.split('/').pop() || 'download')}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(body);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/file-center/oss/preview - proxied with inline Content-Disposition
router.get('/oss/preview', async (req, res) => {
  try {
    const key = req.query.key as string;
    if (!key) {
      res.status(400).json({ success: false, error: 'key 为必填项' });
      return;
    }
    const { body, contentType } = await getObjectContent(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(body);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
