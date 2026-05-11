import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate, requireRole } from '../../middleware/auth.ts';
import { RowDataPacket, ResultSetHeader } from '../../utils/db-types';
import crypto from 'crypto';

const router = Router();

// Authentication required for all routes
router.use(authenticate);

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
    if ((competitions as RowDataPacket[]).length === 0) {
      return res.status(404).json({ success: false, error: 'Competition not found' });
    }

    const competition = (competitions as RowDataPacket[])[0];

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
    const template = (templateRows as RowDataPacket[])[0];

    if (template) {
      const [dimensions] = await pool.query(
        'SELECT * FROM scoring_dimensions WHERE template_id = ? ORDER BY sort_order',
        [template.id]
      );
      const dimensionsWithSubs = await Promise.all(
        (dimensions as RowDataPacket[]).map(async (dim: RowDataPacket) => {
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
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
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
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
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
      insertedIds.push((result as ResultSetHeader).insertId);
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
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const [result] = await pool.query(
      'INSERT INTO judges (name, code, competition_id, user_id) VALUES (?, ?, ?, ?)',
      [name, code, req.params.id, user_id || null]
    );
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
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
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const [result] = await connection.query(
        'INSERT INTO judges (name, code, competition_id) VALUES (?, ?, ?)',
        [name.trim(), code, req.params.id]
      );
      insertedIds.push((result as ResultSetHeader).insertId);
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

export default router;
