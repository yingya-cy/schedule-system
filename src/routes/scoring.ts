import { Router, Request } from 'express';
import pool from '../config/database.ts';
import { authenticate, requireRole } from '../middleware/auth.ts';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// =============================================
// 公开接口（评委登录 + 评分提交，无需系统账号）
// =============================================

// 评委登录（用名字 + 比赛ID）
router.post('/judge/login', async (req, res) => {
  try {
    const { name, competition_id } = req.body;
    const [rows] = await pool.query(
      `SELECT j.*, c.name as competition_name, c.status as competition_status
       FROM judges j
       LEFT JOIN competitions c ON j.competition_id = c.id
       WHERE j.name = ? AND j.competition_id = ?`,
      [name, competition_id]
    );
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ success: false, error: '评委姓名不存在' });
    }
    res.json({ success: true, data: (rows as any[])[0] });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 获取评委可评分的选手列表
router.get('/judge/:judgeId/contestants', async (req, res) => {
  try {
    const [judgeRows] = await pool.query(
      'SELECT * FROM judges WHERE id = ?',
      [req.params.judgeId]
    );
    if ((judgeRows as any[]).length === 0) {
      return res.status(404).json({ success: false, error: '评委不存在' });
    }
    const judge = (judgeRows as any[])[0];

    const [contestants] = await pool.query(
      'SELECT * FROM contestants WHERE competition_id = ? ORDER BY number',
      [judge.competition_id]
    );

    const contestantsWithScore = await Promise.all(
      (contestants as any[]).map(async (c: any) => {
        const [scores] = await pool.query(
          'SELECT * FROM scores WHERE contestant_id = ? AND judge_id = ?',
          [c.id, judge.id]
        );
        return {
          ...c,
          scored: (scores as any[]).length > 0,
          score: (scores as any[]).length > 0 ? (scores as any[])[0] : null
        };
      })
    );

    res.json({ success: true, data: contestantsWithScore });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 获取指定选手的评分记录
router.get('/judge/scores/:contestantId/:judgeId', async (req, res) => {
  try {
    const { contestantId, judgeId } = req.params;
    const [scoreRows] = await pool.query(
      `SELECT sd.subdimension_id, sd.dimension_id, sd.score
       FROM scores s
       LEFT JOIN score_details sd ON sd.score_id = s.id
       WHERE s.contestant_id = ? AND s.judge_id = ?`,
      [contestantId, judgeId]
    );
    res.json({ success: true, data: scoreRows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 提交评分
router.post('/judge/scores', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.query('SET NAMES utf8mb4');
    await connection.beginTransaction();

    const { judge_id, contestant_id, scores } = req.body;

    const [judgeRows] = await connection.query(
      'SELECT * FROM judges WHERE id = ?',
      [judge_id]
    );
    if ((judgeRows as any[]).length === 0) {
      throw new Error('评委不存在');
    }
    const judge = (judgeRows as any[])[0];

    const [contestantRows] = await connection.query(
      'SELECT * FROM contestants WHERE id = ?',
      [contestant_id]
    );
    if ((contestantRows as any[]).length === 0) {
      throw new Error('选手不存在');
    }
    const contestant = (contestantRows as any[])[0];

    const [compRows] = await connection.query(
      'SELECT status FROM competitions WHERE id = ?',
      [contestant.competition_id]
    );
    if ((compRows as any[]).length > 0 && (compRows as any[])[0].status === 'completed') {
      throw new Error('比赛已结束，无法提交评分');
    }

    let totalScore = 0;
    const scoreDetails: { subdimension_id?: number; dimension_id?: number; score: number }[] = [];

    if (scores && Array.isArray(scores)) {
      for (const s of scores) {
        totalScore += parseFloat(s.score || 0);
        scoreDetails.push({
          subdimension_id: s.subdimension_id || undefined,
          dimension_id: s.dimension_id || undefined,
          score: parseFloat(s.score || 0)
        });
      }
    }

    const [existingScores] = await connection.query(
      'SELECT * FROM scores WHERE contestant_id = ? AND judge_id = ?',
      [contestant_id, judge.id]
    );

    let scoreId: number;
    if ((existingScores as any[]).length > 0) {
      scoreId = (existingScores as any[])[0].id;
      await connection.query(
        'UPDATE scores SET total_score = ?, ip_address = ? WHERE id = ?',
        [totalScore, req.ip, scoreId]
      );
      await connection.query('DELETE FROM score_details WHERE score_id = ?', [scoreId]);
    } else {
      const [insertResult] = await connection.query(
        'INSERT INTO scores (competition_id, contestant_id, judge_id, total_score, ip_address) VALUES (?, ?, ?, ?, ?)',
        [contestant.competition_id, contestant_id, judge.id, totalScore, req.ip]
      );
      scoreId = (insertResult as any).insertId;
    }

    for (const s of scoreDetails) {
      if (s.subdimension_id) {
        await connection.query(
          'INSERT INTO score_details (score_id, subdimension_id, score) VALUES (?, ?, ?)',
          [scoreId, s.subdimension_id, s.score]
        );
      } else if (s.dimension_id) {
        await connection.query(
          'INSERT INTO score_details (score_id, dimension_id, score) VALUES (?, ?, ?)',
          [scoreId, s.dimension_id, s.score]
        );
      }
    }

    await connection.commit();
    res.json({ success: true, data: { total_score: totalScore } });
  } catch (error: unknown) {
    await connection.rollback();
    res.status(500).json({ success: false, error: (error as Error).message });
  } finally {
    connection.release();
  }
});

// =============================================
// 需登录接口（管理操作）
// =============================================
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

// =============================================
// 模板管理 API
// =============================================

// 获取所有模板
router.get('/templates', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.*,
        (SELECT COUNT(*) FROM scoring_dimensions d WHERE d.template_id = t.id) as dimension_count
      FROM scoring_templates t
      WHERE t.is_active = 1
      ORDER BY t.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 获取模板详情（含维度）
router.get('/templates/:id', async (req, res) => {
  try {
    const [templates] = await pool.query(
      'SELECT * FROM scoring_templates WHERE id = ?',
      [req.params.id]
    );
    if ((templates as any[]).length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const [dimensions] = await pool.query(
      'SELECT * FROM scoring_dimensions WHERE template_id = ? ORDER BY sort_order',
      [req.params.id]
    );

    const dimensionsWithSubs = await Promise.all(
      (dimensions as any[]).map(async (dim: any) => {
        const [subs] = await pool.query(
          'SELECT * FROM scoring_subdimensions WHERE dimension_id = ? ORDER BY sort_order',
          [dim.id]
        );
        return { ...dim, subdimensions: subs };
      })
    );

    res.json({
      success: true,
      data: { ...(templates as any[])[0], dimensions: dimensionsWithSubs }
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 创建模板（仅管理员）
router.post('/templates', requireRole('admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.query('SET NAMES utf8mb4');
    await connection.beginTransaction();

    const { name, description, total_score, category, dimensions } = req.body;

    const [result] = await connection.query(
      'INSERT INTO scoring_templates (name, description, total_score, category) VALUES (?, ?, ?, ?)',
      [name, description || '', total_score || 100, category || 'general']
    );
    const templateId = (result as any).insertId;

    if (dimensions && dimensions.length > 0) {
      for (let i = 0; i < dimensions.length; i++) {
        const dim = dimensions[i];
        const [dimResult] = await connection.query(
          'INSERT INTO scoring_dimensions (template_id, name, max_score, sort_order, is_optional, description) VALUES (?, ?, ?, ?, ?, ?)',
          [templateId, dim.name, dim.max_score, i, dim.is_optional ? 1 : 0, dim.description || '']
        );
        const dimensionId = (dimResult as any).insertId;

        if (dim.subdimensions && dim.subdimensions.length > 0) {
          for (let j = 0; j < dim.subdimensions.length; j++) {
            const sub = dim.subdimensions[j];
            await connection.query(
              'INSERT INTO scoring_subdimensions (dimension_id, name, max_score, sort_order, description) VALUES (?, ?, ?, ?, ?)',
              [dimensionId, sub.name, sub.max_score, j, sub.description || '']
            );
          }
        }
      }
    }

    await connection.commit();
    res.json({ success: true, data: { id: templateId } });
  } catch (error: unknown) {
    await connection.rollback();
    res.status(500).json({ success: false, error: (error as Error).message });
  } finally {
    connection.release();
  }
});

// 更新模板（仅管理员）
router.put('/templates/:id', requireRole('admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.query('SET NAMES utf8mb4');
    await connection.beginTransaction();

    const { name, description, total_score, category, dimensions } = req.body;

    await connection.query(
      'UPDATE scoring_templates SET name = ?, description = ?, total_score = ?, category = ? WHERE id = ?',
      [name, description || '', total_score || 100, category || 'general', req.params.id]
    );

    // 删除旧的维度（级联删除子维度）
    await connection.query(
      'DELETE FROM scoring_dimensions WHERE template_id = ?',
      [req.params.id]
    );

    // 重新插入维度
    if (dimensions && dimensions.length > 0) {
      for (let i = 0; i < dimensions.length; i++) {
        const dim = dimensions[i];
        const [dimResult] = await connection.query(
          'INSERT INTO scoring_dimensions (template_id, name, max_score, sort_order, is_optional, description) VALUES (?, ?, ?, ?, ?, ?)',
          [req.params.id, dim.name, dim.max_score, i, dim.is_optional ? 1 : 0, dim.description || '']
        );
        const dimensionId = (dimResult as any).insertId;

        if (dim.subdimensions && dim.subdimensions.length > 0) {
          for (let j = 0; j < dim.subdimensions.length; j++) {
            const sub = dim.subdimensions[j];
            await connection.query(
              'INSERT INTO scoring_subdimensions (dimension_id, name, max_score, sort_order, description) VALUES (?, ?, ?, ?, ?)',
              [dimensionId, sub.name, sub.max_score, j, sub.description || '']
            );
          }
        }
      }
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error: unknown) {
    await connection.rollback();
    res.status(500).json({ success: false, error: (error as Error).message });
  } finally {
    connection.release();
  }
});

// 删除模板（仅管理员）
router.delete('/templates/:id', requireRole('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE scoring_templates SET is_active = 0 WHERE id = ?', [
      req.params.id
    ]);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// =============================================
// 比赛管理 API
// =============================================

// 获取所有比赛
router.get('/competitions', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, t.name as template_name,
        (SELECT COUNT(*) FROM contestants WHERE competition_id = c.id) as contestant_count,
        (SELECT COUNT(*) FROM judges WHERE competition_id = c.id) as judge_count
      FROM competitions c
      LEFT JOIN scoring_templates t ON c.template_id = t.id
      ORDER BY c.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 获取比赛详情
router.get('/competitions/:id', async (req, res) => {
  try {
    const [competitions] = await pool.query(
      `SELECT c.*, t.name as template_name, t.total_score as template_total_score
       FROM competitions c
       LEFT JOIN scoring_templates t ON c.template_id = t.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if ((competitions as any[]).length === 0) {
      return res.status(404).json({ success: false, error: 'Competition not found' });
    }

    const competition = (competitions as any[])[0];

    // 获取选手列表
    const [contestants] = await pool.query(
      'SELECT * FROM contestants WHERE competition_id = ? ORDER BY number',
      [req.params.id]
    );

    // 获取评委列表
    const [judges] = await pool.query(
      'SELECT id, name, code, is_active, created_at FROM judges WHERE competition_id = ?',
      [req.params.id]
    );

    // 获取模板详情
    const [templateRows] = await pool.query(
      'SELECT * FROM scoring_templates WHERE id = ?',
      [competition.template_id]
    );
    const template = (templateRows as any[])[0];

    if (template) {
      const [dimensions] = await pool.query(
        'SELECT * FROM scoring_dimensions WHERE template_id = ? ORDER BY sort_order',
        [template.id]
      );
      const dimensionsWithSubs = await Promise.all(
        (dimensions as any[]).map(async (dim: any) => {
          const [subs] = await pool.query(
            'SELECT * FROM scoring_subdimensions WHERE dimension_id = ? ORDER BY sort_order',
            [dim.id]
          );
          return { ...dim, subdimensions: subs };
        })
      );
      template.dimensions = dimensionsWithSubs;
    }

    res.json({
      success: true,
      data: { ...competition, contestants, judges, template }
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 创建比赛（仅管理员）
router.post('/competitions', requireRole('admin'), async (req, res) => {
  try {
    await pool.query('SET NAMES utf8mb4');
    const { name, description, template_id, judging_mode } = req.body;
    const [result] = await pool.query(
      'INSERT INTO competitions (name, description, template_id, judging_mode) VALUES (?, ?, ?, ?)',
      [name, description || '', template_id, judging_mode || 'offline']
    );
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 更新比赛（仅管理员）
router.put('/competitions/:id', requireRole('admin'), async (req, res) => {
  try {
    await pool.query('SET NAMES utf8mb4');
    const { name, description, status, judging_mode, result_published, start_time, end_time } = req.body;
    await pool.query(
      `UPDATE competitions SET name = ?, description = ?, status = ?, judging_mode = ?, result_published = ?, start_time = ?, end_time = ? WHERE id = ?`,
      [name, description || '', status, judging_mode, result_published, start_time, end_time, req.params.id]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 删除比赛（仅管理员）
router.delete('/competitions/:id', requireRole('admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const competitionId = req.params.id;
    // 先删除子表记录（按依赖顺序）
    await connection.query('DELETE FROM competition_results WHERE competition_id = ?', [competitionId]);
    await connection.query('DELETE FROM scores WHERE competition_id = ?', [competitionId]);
    await connection.query('DELETE FROM contestants WHERE competition_id = ?', [competitionId]);
    await connection.query('DELETE FROM judges WHERE competition_id = ?', [competitionId]);
    // 最后删除比赛
    await connection.query('DELETE FROM competitions WHERE id = ?', [competitionId]);
    await connection.commit();
    res.json({ success: true });
  } catch (error: unknown) {
    await connection.rollback();
    res.status(500).json({ success: false, error: (error as Error).message });
  } finally {
    connection.release();
  }
});

// =============================================
// 选手管理 API
// =============================================

// 获取选手列表
router.get('/competitions/:id/contestants', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM contestants WHERE competition_id = ? ORDER BY number',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 添加选手（仅管理员）
router.post('/competitions/:id/contestants', requireRole('admin'), async (req, res) => {
  try {
    await pool.query('SET NAMES utf8mb4');
    const { number, name, group_name, description, extra_data } = req.body;
    const [result] = await pool.query(
      'INSERT INTO contestants (competition_id, number, name, group_name, description, extra_data) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, number || '', name, group_name || '', description || '', extra_data || null]
    );
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 批量导入选手（仅管理员）
router.post('/competitions/:id/contestants/import', requireRole('admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.query('SET NAMES utf8mb4');
    await connection.beginTransaction();

    const { contestants } = req.body;
    if (!contestants || !Array.isArray(contestants)) {
      return res.status(400).json({ success: false, error: 'Invalid data format' });
    }

    const insertedIds: number[] = [];
    for (const c of contestants) {
      // 如果姓名为空但有作品名，则用作品名填充姓名
      const name = c.name || c.work_name || '';
      const workName = c.work_name || (c.name ? '' : ''); // 如果姓名本来就是作品名，work_name 也保留空
      const [result] = await connection.query(
        'INSERT INTO contestants (competition_id, number, name, work_name, group_name, description, extra_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.params.id, c.number || '', name, workName || null, c.group_name || '', c.description || '', c.extra_data || null]
      );
      insertedIds.push((result as any).insertId);
    }

    await connection.commit();
    res.json({ success: true, data: { inserted: insertedIds.length, ids: insertedIds } });
  } catch (error: unknown) {
    await connection.rollback();
    res.status(500).json({ success: false, error: (error as Error).message });
  } finally {
    connection.release();
  }
});

// 删除选手（仅管理员）
router.delete('/competitions/:id/contestants/:contestantId', requireRole('admin'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM contestants WHERE id = ? AND competition_id = ?',
      [req.params.contestantId, req.params.id]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// =============================================
// 评委管理 API
// =============================================

// 获取评委列表
router.get('/competitions/:id/judges', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT j.id, j.name, j.code, j.user_id, j.is_active, j.created_at, u.department FROM judges j LEFT JOIN users u ON j.user_id = u.id WHERE j.competition_id = ?',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 获取当前登录用户的评分任务（评委视角）
router.get('/my-tasks', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.description, c.status, c.judging_mode, c.start_time, c.end_time,
        j.id as judge_id,
        (SELECT COUNT(*) FROM contestants WHERE competition_id = c.id) as contestant_count,
        (SELECT COUNT(DISTINCT s.contestant_id) FROM scores s WHERE s.judge_id = j.id AND s.competition_id = c.id) as scored_count
       FROM judges j
       JOIN competitions c ON j.competition_id = c.id
       WHERE j.user_id = ? AND j.is_active = 1 AND c.status IN ('scoring', 'completed')
       ORDER BY c.created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 添加评委（仅管理员，可选关联系统用户）
router.post('/competitions/:id/judges', requireRole('admin'), async (req, res) => {
  try {
    await pool.query('SET NAMES utf8mb4');
    const { name, user_id } = req.body;
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const [result] = await pool.query(
      'INSERT INTO judges (name, code, competition_id, user_id) VALUES (?, ?, ?, ?)',
      [name, code, req.params.id, user_id || null]
    );
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 批量导入评委（仅管理员）
router.post('/competitions/:id/judges/import', requireRole('admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.query('SET NAMES utf8mb4');
    await connection.beginTransaction();
    const { names } = req.body;
    if (!Array.isArray(names)) {
      throw new Error('names must be an array');
    }
    const insertedIds: number[] = [];
    for (const name of names) {
      if (!name || !name.trim()) continue;
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const [result] = await connection.query(
        'INSERT INTO judges (name, code, competition_id) VALUES (?, ?, ?)',
        [name.trim(), code, req.params.id]
      );
      insertedIds.push((result as any).insertId);
    }
    await connection.commit();
    res.json({ success: true, data: { inserted: insertedIds.length, ids: insertedIds } });
  } catch (error: unknown) {
    await connection.rollback();
    res.status(500).json({ success: false, error: (error as Error).message });
  } finally {
    connection.release();
  }
});

// 删除评委（仅管理员）
router.delete('/competitions/:id/judges/:judgeId', requireRole('admin'), async (req, res) => {
  try {
    const { judgeId, id } = req.params;
    // 先删除评委的评分记录(score_details会级联删除)
    await pool.query(
      'DELETE FROM scores WHERE judge_id = ? AND competition_id = ?',
      [judgeId, id]
    );
    // 再删除评委
    await pool.query(
      'DELETE FROM judges WHERE id = ? AND competition_id = ?',
      [judgeId, id]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// =============================================
// 结果计算与展示 API
// =============================================

// 计算最终结果（仅管理员）
router.post('/competitions/:id/calculate', requireRole('admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const competitionId = req.params.id;

    // 清空旧结果
    await connection.query('DELETE FROM competition_results WHERE competition_id = ?', [competitionId]);

    // 获取所有选手
    const [contestants] = await connection.query(
      'SELECT * FROM contestants WHERE competition_id = ?',
      [competitionId]
    );

    const results: any[] = [];
    for (const contestant of contestants as any[]) {
      // 获取所有有效评分
      const [scores] = await connection.query(
        `SELECT s.*, j.name as judge_name
         FROM scores s
         LEFT JOIN judges j ON s.judge_id = j.id
         WHERE s.contestant_id = ? AND s.is_valid = 1`,
        [contestant.id]
      );

      if ((scores as any[]).length === 0) continue;

      const totalScore = (scores as any[]).reduce(
        (sum: number, s: any) => sum + parseFloat(s.total_score || 0),
        0
      );
      const avgScore = totalScore / (scores as any[]).length;

      // 去掉一个最高分和一个最低分（至少需要3个评分才有效）
      let finalScore = avgScore;
      if ((scores as any[]).length >= 3) {
        const sortedScores = (scores as any[])
          .map(s => parseFloat(s.total_score || 0))
          .sort((a, b) => a - b);
        const count = sortedScores.length;
        const trimmedSum = sortedScores.slice(1, count - 1).reduce((sum, s) => sum + s, 0);
        finalScore = trimmedSum / (count - 2);
      }

      // 计算各维度平均分
      const avgScores: Record<string, number> = {};
      for (const score of scores as any[]) {
        const [details] = await connection.query(
          `SELECT sd2.name, sd2.dimension_id, d.name as dimension_name, sd.score
           FROM score_details sd
           LEFT JOIN scoring_subdimensions sd2 ON sd.subdimension_id = sd2.id
           LEFT JOIN scoring_dimensions d ON sd2.dimension_id = d.id
           WHERE sd.score_id = ?`,
          [score.id]
        );
        for (const d of details as any[]) {
          if (!avgScores[d.dimension_name]) {
            avgScores[d.dimension_name] = 0;
          }
          avgScores[d.dimension_name] += parseFloat(d.score || 0) / (scores as any[]).length;
        }
      }

      const [resultInsert] = await connection.query(
        'INSERT INTO competition_results (competition_id, contestant_id, total_score, final_score, score_count, avg_scores) VALUES (?, ?, ?, ?, ?, ?)',
        [competitionId, contestant.id, avgScore, finalScore, (scores as any[]).length, JSON.stringify(avgScores)]
      );

      results.push({
        id: (resultInsert as any).insertId,
        contestant,
        total_score: avgScore,
        final_score: finalScore,
        score_count: (scores as any[]).length
      });
    }

    // 按去掉最高最低分排序并更新排名
    results.sort((a, b) => b.final_score - a.final_score);
    for (let i = 0; i < results.length; i++) {
      await connection.query(
        'UPDATE competition_results SET `rank` = ? WHERE id = ?',
        [i + 1, results[i].id]
      );
    }

    // 更新比赛状态
    await connection.query(
      'UPDATE competitions SET status = ?, result_published = 0 WHERE id = ?',
      ['completed', competitionId]
    );

    await connection.commit();
    res.json({
      success: true,
      data: {
        calculated: results.length,
        results: results.map((r, i) => ({
          rank: i + 1,
          contestant: r.contestant,
          total_score: r.total_score,
          final_score: r.final_score,
          score_count: r.score_count
        }))
      }
    });
  } catch (error: unknown) {
    await connection.rollback();
    res.status(500).json({ success: false, error: (error as Error).message });
  } finally {
    connection.release();
  }
});

// 清除所有评分记录和计算结果（仅管理员）
router.delete('/competitions/:id/clear-all', requireRole('admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const competitionId = req.params.id;
    // 按依赖顺序删除子表
    await connection.query('DELETE FROM competition_results WHERE competition_id = ?', [competitionId]);
    await connection.query('DELETE FROM score_details WHERE score_id IN (SELECT id FROM scores WHERE competition_id = ?)', [competitionId]);
    await connection.query('DELETE FROM scores WHERE competition_id = ?', [competitionId]);
    // 重置比赛状态为 preparing
    await connection.query(
      'UPDATE competitions SET status = ?, result_published = 0 WHERE id = ?',
      ['preparing', competitionId]
    );
    await connection.commit();
    res.json({ success: true });
  } catch (error: unknown) {
    await connection.rollback();
    res.status(500).json({ success: false, error: (error as Error).message });
  } finally {
    connection.release();
  }
});

// 获取评分明细（各选手各评委各维度）
router.get('/competitions/:id/score-details', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const competitionId = req.params.id;

    // 获取比赛详情
    const [compRows] = await connection.query(
      'SELECT c.*, t.name as template_name FROM competitions c LEFT JOIN scoring_templates t ON c.template_id = t.id WHERE c.id = ?',
      [competitionId]
    );
    const competition = (compRows as any[])[0];
    if (!competition) {
      res.status(404).json({ success: false, error: 'Competition not found' });
      return;
    }

    // 获取模板维度（带层级结构）
    const [dimRows] = await connection.query(
      `SELECT d.id as dim_id, d.name as dim_name, d.max_score as dim_max,
              sd.id as sub_id, sd.name as sub_name, sd.max_score as sub_max
       FROM scoring_dimensions d
       LEFT JOIN scoring_subdimensions sd ON sd.dimension_id = d.id
       WHERE d.template_id = ?
       ORDER BY d.sort_order, sd.sort_order`,
      [competition.template_id]
    );

    // 按维度分组
    const dimensionGroups: Record<number, { name: string; max: number; subs: { id: number; name: string; max: number }[] }> = {};
    for (const row of dimRows as any[]) {
      if (!dimensionGroups[row.dim_id]) {
        dimensionGroups[row.dim_id] = { name: row.dim_name, max: parseFloat(row.dim_max || 0), subs: [] };
      }
      if (row.sub_id) {
        dimensionGroups[row.dim_id].subs.push({ id: row.sub_id, name: row.sub_name, max: parseFloat(row.sub_max || 0) });
      }
    }

    // 获取选手
    const [contestantRows] = await connection.query(
      'SELECT id, number, name, work_name, group_name FROM contestants WHERE competition_id = ? ORDER BY number',
      [competitionId]
    );

    // 获取评委
    const [judgeRows] = await connection.query(
      'SELECT id, name FROM judges WHERE competition_id = ? ORDER BY id',
      [competitionId]
    );

    // 获取所有评分
    const [scoreRows] = await connection.query(
      `SELECT s.contestant_id, s.judge_id, s.total_score,
              sd.subdimension_id, sd.dimension_id, sd.score
       FROM scores s
       LEFT JOIN score_details sd ON sd.score_id = s.id
       WHERE s.competition_id = ?`,
      [competitionId]
    );

    // 整理评分数据: contestant -> judge -> (subdimension|dimension) -> score
    const scoreMap: Record<number, Record<number, Record<number, number>>> = {};
    // 存储总分: contestant -> judge -> total_score
    const totalScoreMap: Record<number, Record<number, number>> = {};
    for (const s of scoreRows as any[]) {
      if (!scoreMap[s.contestant_id]) scoreMap[s.contestant_id] = {};
      if (!scoreMap[s.contestant_id][s.judge_id]) scoreMap[s.contestant_id][s.judge_id] = {};
      if (!totalScoreMap[s.contestant_id]) totalScoreMap[s.contestant_id] = {};
      // 存储总分（从 scores 表的 total_score 字段）
      totalScoreMap[s.contestant_id][s.judge_id] = parseFloat(s.total_score || 0);
      if (s.subdimension_id) {
        scoreMap[s.contestant_id][s.judge_id][s.subdimension_id] = parseFloat(s.score || 0);
      } else if (s.dimension_id) {
        scoreMap[s.contestant_id][s.judge_id][s.dimension_id] = parseFloat(s.score || 0);
      }
    }

    res.json({
      success: true,
      data: {
        competition,
        judges: judgeRows,
        contestants: contestantRows,
        dimensionGroups,
        scoreMap,
        totalScoreMap,
      }
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  } finally {
    connection.release();
  }
});

// 发布结果（仅管理员）
router.post('/competitions/:id/publish', requireRole('admin'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE competitions SET result_published = 1 WHERE id = ?',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 获取最终结果
router.get('/competitions/:id/results', async (req, res) => {
  try {
    const [results] = await pool.query(
      `SELECT cr.*, c.number, c.name as contestant_name, c.work_name, c.group_name
       FROM competition_results cr
       LEFT JOIN contestants c ON cr.contestant_id = c.id
       WHERE cr.competition_id = ?
       ORDER BY cr.rank`,
      [req.params.id]
    );
    res.json({ success: true, data: results });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 导出评分结果（直接生成 xlsx，不依赖 AI）
router.get('/competitions/:id/export', async (req, res) => {
  try {
    const competitionId = Number(req.params.id);
    const exportType = (req.query.type as string) || 'summary';

    const [compRows] = await pool.query('SELECT * FROM competitions WHERE id = ?', [competitionId]);
    const competition = (compRows as any[])[0];
    if (!competition) { res.status(404).json({ success: false, error: '比赛不存在' }); return; }

    const [dimRows] = await pool.query(
      'SELECT d.*, sd.id as sub_id, sd.name as sub_name, sd.max_score as sub_max, sd.description as sub_desc, sd.sort_order as sub_sort FROM scoring_dimensions d LEFT JOIN scoring_subdimensions sd ON d.id = sd.dimension_id WHERE d.template_id = ? ORDER BY d.sort_order, sd.sort_order',
      [competition.template_id]
    );
    const dimensions: { id: number; name: string; max_score: number; description: string | null; subs: { id: number; name: string; max_score: number; description: string | null }[] }[] = [];
    const dimMap = new Map<number, typeof dimensions[number]>();
    for (const r of dimRows as any[]) {
      if (!dimMap.has(r.id)) {
        dimMap.set(r.id, { id: r.id, name: r.name, max_score: r.max_score, description: r.description || null, subs: [] });
        dimensions.push(dimMap.get(r.id)!);
      }
      if (r.sub_id) dimMap.get(r.id)!.subs.push({ id: r.sub_id, name: r.sub_name, max_score: r.sub_max, description: r.sub_desc || null });
    }
    if (dimensions.length === 0) { res.status(400).json({ success: false, error: '模板无评分维度' }); return; }

    const [contestantRows] = await pool.query(
      'SELECT id, number, name, group_name FROM contestants WHERE competition_id = ? ORDER BY number, id', [competitionId]
    );
    const contestants = contestantRows as any[];

    const [judgeRows] = await pool.query(
      'SELECT id, name FROM judges WHERE competition_id = ? ORDER BY name', [competitionId]
    );
    const judges = judgeRows as any[];

    // Style helpers
    const thin: Partial<ExcelJS.Border> = { style: 'thin' };
    const borderAll = { top: thin, bottom: thin, left: thin, right: thin };
    const center: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
    const leftAlign: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle', wrapText: true };
    const font11 = { name: '微软雅黑', size: 11 };
    const fontBold11 = { name: '微软雅黑', size: 11, bold: true };
    const fontBold14 = { name: '微软雅黑', size: 14, bold: true };
    const fontBold16 = { name: '微软雅黑', size: 16, bold: true };
    const fontBold18 = { name: '微软雅黑', size: 18, bold: true };
    const fontBold20 = { name: '微软雅黑', size: 20, bold: true };
    const styleCell = (cell: ExcelJS.Cell, font?: any, align?: any) => {
      cell.font = font || font11;
      cell.alignment = align || center;
      cell.border = borderAll;
    };

    const wb = new ExcelJS.Workbook();

    if (exportType === 'judge_detail') {
      const targetJudgeId = Number(req.query.judge_id) || 0;

      const [detailRows] = await pool.query(
        'SELECT sd.subdimension_id, sd.score, s.judge_id, s.contestant_id FROM score_details sd JOIN scores s ON sd.score_id = s.id WHERE s.competition_id = ?',
        [competitionId]
      );
      const scoreMap: Record<number, Record<number, Record<number, number>>> = {};
      for (const r of detailRows as any[]) {
        if (!scoreMap[r.contestant_id]) scoreMap[r.contestant_id] = {};
        if (!scoreMap[r.contestant_id][r.judge_id]) scoreMap[r.contestant_id][r.judge_id] = {};
        scoreMap[r.contestant_id][r.judge_id][r.subdimension_id] = Number(r.score);
      }

      const targetJudges = targetJudgeId
        ? judges.filter(j => j.id === targetJudgeId)
        : judges;
      if (targetJudges.length === 0) { res.status(404).json({ success: false, error: '评委不存在' }); return; }

      for (const judge of targetJudges) {
        const sheetName = judge.name.length > 28 ? judge.name.slice(0, 28) : judge.name;
        const ws = wb.addWorksheet(sheetName);
        const firstDimCol = 3;
        const totalScore = dimensions.reduce((s, d) => s + d.max_score, 0);
        const totalCols = 2 + dimensions.reduce((s, d) => s + Math.max(d.subs.length, 1), 0) + 1;

        // Build rubric overview (dimension descriptions) and check for sub descriptions
        const rubricParts: string[] = [];
        for (const dim of dimensions) {
          if (dim.description) rubricParts.push(`${dim.name}${dim.max_score}分：${dim.description}`);
        }
        const hasRubric = rubricParts.length > 0;
        const hasSubDesc = dimensions.some(d => d.subs.some(s => s.description));

        const headerEndRow = hasSubDesc ? 9 : 8;
        const dataFirstRow = headerEndRow + 1;

        // Title
        ws.mergeCells(1, 1, 3, totalCols);
        const titleCell = ws.getCell('A1');
        titleCell.value = `${competition.name} — ${judge.name} 评分表`;
        styleCell(titleCell, fontBold18, center);
        ws.getRow(1).height = 26;

        // Row 4: 序号 + 作品 (vertically merged) + 评分标准
        ws.mergeCells(4, 1, headerEndRow, 1);
        ws.getCell('A4').value = '序号';
        styleCell(ws.getCell('A4'), fontBold16, center);

        ws.mergeCells(4, 2, headerEndRow, 2);
        ws.getCell('B4').value = '作品';
        styleCell(ws.getCell('B4'), fontBold16, center);

        ws.mergeCells(4, firstDimCol, 4, totalCols);
        ws.getCell(4, firstDimCol).value = '评分标准';
        styleCell(ws.getCell(4, firstDimCol), fontBold14, center);

        // Row 6: rubric overview
        if (hasRubric) {
          ws.mergeCells(6, firstDimCol, 6, totalCols);
          const rubricCell = ws.getCell(6, firstDimCol);
          rubricCell.value = rubricParts.join('\n');
          styleCell(rubricCell, { name: '微软雅黑', size: 10 }, leftAlign);
          ws.getRow(6).height = Math.max(50, rubricParts.length * 20);
        }

        // Row 7: dimension group headers
        let col = firstDimCol;
        for (const dim of dimensions) {
          const nCols = Math.max(dim.subs.length, 1);
          if (nCols > 1) {
            ws.mergeCells(7, col, 7, col + nCols - 1);
          }
          const dc = ws.getCell(7, col);
          dc.value = `${dim.name}（${dim.max_score}分）`;
          styleCell(dc, fontBold14, center);
          for (let i = 0; i < nCols; i++) styleCell(ws.getCell(7, col + i), fontBold14, center);
          col += nCols;
        }
        ws.mergeCells(7, col, 7, col);
        ws.getCell(7, col).value = `总分（${totalScore}分）`;
        styleCell(ws.getCell(7, col), fontBold14, center);
        ws.getRow(7).height = 22;

        // Row 8: subdimension names
        col = firstDimCol;
        for (const dim of dimensions) {
          for (const sub of dim.subs) {
            const sc = ws.getCell(8, col);
            sc.value = `${sub.name}（${sub.max_score}分）`;
            styleCell(sc, fontBold11, center);
            col++;
          }
        }
        styleCell(ws.getCell(8, col), fontBold11, center);
        ws.getRow(8).height = 20;

        // Subdimension description row (from DB, one per column)
        if (hasSubDesc) {
          col = firstDimCol;
          for (const dim of dimensions) {
            for (const sub of dim.subs) {
              if (sub.description) {
                const dc = ws.getCell(9, col);
                dc.value = sub.description;
                styleCell(dc, { name: '微软雅黑', size: 9 }, { horizontal: 'left', vertical: 'top', wrapText: true });
              }
              col++;
            }
          }
          ws.getRow(9).height = 60;
        }

        // Data rows
        for (let i = 0; i < contestants.length; i++) {
          const c = contestants[i];
          const r = dataFirstRow + i;

          styleCell(ws.getCell(r, 1), { name: '微软雅黑', size: 12, bold: true }, center);
          ws.getCell(r, 1).value = c.number || (i + 1);

          styleCell(ws.getCell(r, 2), font11, center);
          ws.getCell(r, 2).value = c.name;

          col = firstDimCol;
          const scoreCols: string[] = [];
          for (const dim of dimensions) {
            for (const sub of dim.subs) {
              const val = scoreMap[c.id]?.[judge.id]?.[sub.id];
              const sc = ws.getCell(r, col);
              if (val != null && val > 0) { sc.value = val; sc.numFmt = '0.0'; }
              styleCell(sc, font11, center);
              scoreCols.push(columnLetter(col));
              col++;
            }
          }
          const totalCell = ws.getCell(r, col);
          if (scoreCols.length > 0) {
            totalCell.value = { formula: `SUM(${scoreCols[0]}${r}:${scoreCols[scoreCols.length - 1]}${r})` };
          }
          styleCell(totalCell, fontBold11, center);
        }

        // Column widths
        ws.getColumn(1).width = 7;
        ws.getColumn(2).width = 42;
        for (let cc = 3; cc <= totalCols; cc++) {
          ws.getColumn(cc).width = cc === totalCols ? 14 : 11;
        }
      }

      const buf = await wb.xlsx.writeBuffer();
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(competition.name)}_%E8%AF%84%E5%88%86%E8%A1%A8.xlsx`,
      });
      res.send(Buffer.from(buf));
    } else {
      // ===== 统分表 =====
      const [scoreRows] = await pool.query(
        'SELECT contestant_id, judge_id, total_score FROM scores WHERE competition_id = ?', [competitionId]
      );
      const totalMap: Record<number, Record<number, number>> = {};
      for (const r of scoreRows as any[]) {
        if (!totalMap[r.contestant_id]) totalMap[r.contestant_id] = {};
        totalMap[r.contestant_id][r.judge_id] = Number(r.total_score);
      }
      const [resultRows] = await pool.query(
        'SELECT contestant_id, avg_scores, `rank` FROM competition_results WHERE competition_id = ?', [competitionId]
      );
      const resultMap = new Map<number, { rank: number }>();
      for (const r of resultRows as any[]) {
        resultMap.set(r.contestant_id, { rank: r.rank });
      }

      const ranked: { contestant: any; avg: number; rank: number; judgeScores: Record<number, number> }[] = [];
      for (const c of contestants) {
        const judgeScores = totalMap[c.id] || {};
        const scores = Object.values(judgeScores).filter(s => s > 0);
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const rank = resultMap.get(c.id)?.rank ?? 0;
        ranked.push({ contestant: c, avg, rank, judgeScores });
      }
      ranked.sort((a, b) => {
        if (a.rank && b.rank) return a.rank - b.rank;
        if (a.rank) return -1;
        if (b.rank) return 1;
        return b.avg - a.avg;
      });

      const totalCols = 2 + judges.length + 2; // 序号+作品+评委+平均分+排名
      const ws = wb.addWorksheet('统分表');

      // Title (row 1)
      ws.mergeCells(1, 1, 1, totalCols);
      const titleCell = ws.getCell('A1');
      titleCell.value = `${competition.name} 统分表`;
      styleCell(titleCell, fontBold20, center);
      ws.getRow(1).height = 28;

      // Headers (rows 2-3)
      ws.mergeCells(2, 1, 3, 1);
      const seqHdr = ws.getCell('A2');
      seqHdr.value = '序号';
      styleCell(seqHdr, fontBold11, center);

      ws.mergeCells(2, 2, 3, 2);
      const workHdr = ws.getCell('B2');
      workHdr.value = '作品';
      styleCell(workHdr, fontBold11, center);

      // 评委打分 merged header
      const judgeStartCol = 3;
      const judgeEndCol = 2 + judges.length;
      if (judges.length > 0) {
        ws.mergeCells(2, judgeStartCol, 2, judgeEndCol);
        const judgeGrp = ws.getCell(2, judgeStartCol);
        judgeGrp.value = '评委打分';
        styleCell(judgeGrp, fontBold11, center);
      }

      ws.mergeCells(2, judgeEndCol + 1, 3, judgeEndCol + 1);
      const avgHdr = ws.getCell(2, judgeEndCol + 1);
      avgHdr.value = '平均分';
      styleCell(avgHdr, fontBold11, center);

      ws.mergeCells(2, judgeEndCol + 2, 3, judgeEndCol + 2);
      const rankHdr = ws.getCell(2, judgeEndCol + 2);
      rankHdr.value = '排名';
      styleCell(rankHdr, fontBold11, center);

      // Individual judge names in row 3
      for (let j = 0; j < judges.length; j++) {
        const jc = ws.getCell(3, judgeStartCol + j);
        jc.value = judges[j].name;
        styleCell(jc, fontBold11, center);
      }
      ws.getRow(2).height = 20;
      ws.getRow(3).height = 20;

      // Data rows starting at row 4
      for (let i = 0; i < ranked.length; i++) {
        const { contestant, avg, rank, judgeScores } = ranked[i];
        const r = 4 + i;

        const seqC = ws.getCell(r, 1);
        seqC.value = i + 1;
        styleCell(seqC, font11, center);

        const nameC = ws.getCell(r, 2);
        nameC.value = contestant.name;
        styleCell(nameC, font11, { horizontal: 'center', vertical: 'middle' });

        for (let j = 0; j < judges.length; j++) {
          const sc = ws.getCell(r, judgeStartCol + j);
          const val = judgeScores[judges[j].id];
          if (val != null) {
            sc.value = val;
            sc.numFmt = '0.0';
          }
          styleCell(sc, font11, { horizontal: 'center', vertical: 'middle' });
        }

        const avgCol = judgeEndCol + 1;
        const avgLetter = columnLetter(avgCol);
        const firstJudgeLetter = columnLetter(judgeStartCol);
        const lastJudgeLetter = columnLetter(judgeEndCol);
        const avgCell = ws.getCell(r, avgCol);
        avgCell.value = { formula: `AVERAGE(${firstJudgeLetter}${r}:${lastJudgeLetter}${r})` };
        avgCell.numFmt = '0.00';
        styleCell(avgCell, font11, center);

        const rankCol = judgeEndCol + 2;
        const rankCell = ws.getCell(r, rankCol);
        const avgRange = `$${avgLetter}$4:$${avgLetter}$${4 + ranked.length - 1}`;
        rankCell.value = { formula: `RANK(${avgLetter}${r},${avgRange})` };
        styleCell(rankCell, font11, center);
      }

      // Column widths
      ws.getColumn(1).width = 8;
      ws.getColumn(2).width = 45;
      for (let c = 3; c <= totalCols; c++) {
        ws.getColumn(c).width = c === judgeEndCol + 2 ? 9 : 10;
      }
      ws.getColumn(judgeEndCol + 1).width = 12;

      const buf = await wb.xlsx.writeBuffer();
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(competition.name)}_%E7%BB%9F%E5%88%86%E8%A1%A8.xlsx`,
      });
      res.send(Buffer.from(buf));
    }
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

function columnLetter(col: number): string {
  let s = '';
  while (col > 0) {
    s = String.fromCharCode(65 + ((col - 1) % 26)) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

// 大屏轮询接口
router.get('/competitions/:id/live-results', async (req, res) => {
  try {
    const [competitionRows] = await pool.query(
      'SELECT * FROM competitions WHERE id = ?',
      [req.params.id]
    );
    const competition = (competitionRows as any[])[0];

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
