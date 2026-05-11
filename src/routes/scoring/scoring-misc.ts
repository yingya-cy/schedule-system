import { Router, Request } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';
import { RowDataPacket } from '../../utils/db-types';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Authentication required
router.use(authenticate);

// Multer adds file property to request
interface MulterRequest extends Request {
  file?: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  };
  files?: Record<string, MulterFile[]>;
}

interface MulterFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
  fieldname: string;
}

// 大屏轮询接口
router.get('/competitions/:id/live-results', async (req, res) => {
  try {
    const [competitionRows] = await pool.query(
      'SELECT * FROM competitions WHERE id = ?',
      [req.params.id]
    );
    const competition = (competitionRows as RowDataPacket[])[0];

    const [results] = await pool.query(
      `SELECT cr.*, c.number, c.name as contestant_name, c.group_name
       FROM competition_results cr
       LEFT JOIN contestants c ON cr.contestant_id = c.id
       WHERE cr.competition_id = ?
       ORDER BY cr.rank`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        published: competition?.result_published,
        status: competition?.status,
        results
      }
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// =============================================
// Excel 导入导出 API（代理到 Flask AI）
// =============================================

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5002';

// 解析评分模板
router.post('/parse-template', upload.single('file'), async (req: MulterRequest, res) => {
  try {
    const formData = new FormData();
    if (req.file) {
      formData.append('file', req.file.buffer, req.file.originalname);
    }

    const response = await axios.post(`${AI_SERVICE_URL}/api/parse/scoring-template`, formData, {
      headers: formData.getHeaders(),
    });
    res.json(response.data);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 解析选手名单
router.post('/parse-contestants', upload.single('file'), async (req: MulterRequest, res) => {
  try {
    const formData = new FormData();
    if (req.file) {
      formData.append('file', req.file.buffer, req.file.originalname);
    }

    const response = await axios.post(`${AI_SERVICE_URL}/api/parse/contestants`, formData, {
      headers: formData.getHeaders(),
    });
    res.json(response.data);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 导出评分结果
router.post('/export-results', upload.fields([{ name: 'template_file' }, { name: 'result_data' }]), async (req: MulterRequest, res) => {
  try {
    const resultDataStr = req.body.result_data;
    let parsedResultData;
    if (typeof resultDataStr === 'string') {
      parsedResultData = JSON.parse(resultDataStr);
    } else {
      parsedResultData = resultDataStr;
    }

    // 构建 FormData 发送给 AI 服务
    const formData = new FormData();
    // upload.fields() puts files in req.files, not req.file
    const files = req.files as { [fieldname: string]: MulterFile[] };
    const templateFile = files?.['template_file']?.[0];
    if (templateFile) {
      formData.append('template_file', templateFile.buffer, templateFile.originalname);
    }
    formData.append('result_data', JSON.stringify(parsedResultData));

    const response = await axios.post(`${AI_SERVICE_URL}/api/export/scoring-results`, formData, {
      headers: formData.getHeaders(),
      responseType: 'arraybuffer',
    });
    const buffer = response.data;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=scoring_results.xlsx',
    });
    res.send(Buffer.from(buffer));
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// =============================================
// 历史记录 API
// =============================================

router.get('/history', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.name, c.description, c.status, c.result_published, c.created_at,
        t.name as template_name,
        (SELECT COUNT(*) FROM contestants WHERE competition_id = c.id) as contestant_count,
        (SELECT COUNT(*) FROM judges WHERE competition_id = c.id) as judge_count
      FROM competitions c
      LEFT JOIN scoring_templates t ON c.template_id = t.id
      WHERE c.status IN ('completed', 'archived')
      ORDER BY c.updated_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
