import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';
import { canModifyResource } from '../../middleware/permissions.ts';
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  getObjectUrl,
  getObjectContent,
  buildObjectKey,
} from '../../services/ossService.ts';
import { RowDataPacket, ResultSetHeader } from '../../utils/db-types';

const router = Router();
router.use(authenticate);

// =============================================
// Permissions CRUD
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
    const fileId = (insertResult as ResultSetHeader).insertId;

    // 2. Get activity name
    const [activityRows] = await pool.query('SELECT name FROM file_activities WHERE id = ?', [activity_id]);
    const activityName = (activityRows as RowDataPacket[])[0]?.name || `activity_${activity_id}`;

    // 3. Build folder path by traversing parent chain
    const folderParts: string[] = [];
    let currentId: number | null = folder_id;
    while (currentId) {
      const [folderRows] = await pool.query('SELECT id, parent_id, name FROM file_folders WHERE id = ?', [currentId]);
      if ((folderRows as RowDataPacket[]).length === 0) break;
      folderParts.unshift((folderRows as RowDataPacket[])[0].name);
      currentId = (folderRows as RowDataPacket[])[0].parent_id;
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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
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
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId, oss_url: ossUrl } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// POST /api/file-center/items/batch-delete
router.post('/items/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: 'ids 为必填项' });
      return;
    }

    // Verify permissions for all items
    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT id, created_by FROM file_items WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    for (const item of items) {
      if (!canModifyResource(req.user!, item.created_by)) {
        res.status(403).json({ success: false, error: `无权删除文件 #${item.id}` });
        return;
      }
    }

    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM file_items WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    res.json({ success: true, data: { deleted: result.affectedRows } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// POST /api/file-center/items/batch-download
router.post('/items/batch-download', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: 'ids 为必填项' });
      return;
    }

    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT id, original_filename, oss_object_key, stored_filename FROM file_items WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );

    if (items.length === 0) {
      res.status(404).json({ success: false, error: '未找到文件' });
      return;
    }

    // Download from OSS and zip
    const archiver = (await import('archiver')).default;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="batch-download-${Date.now()}.zip"`);

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    for (const item of items) {
      try {
        if (item.oss_object_key) {
          const { body } = await getObjectContent(item.oss_object_key);
          archive.append(body, { name: item.original_filename || item.stored_filename });
        }
      } catch {
        // Skip files that can't be fetched
      }
    }

    await archive.finalize();
  } catch (error: unknown) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
    }
  }
});

export default router;

