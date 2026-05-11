import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate, requireRole } from '../../middleware/auth.ts';
import { RowDataPacket, ResultSetHeader } from '../../utils/db-types';

const router = Router();

// Authentication required for all routes
router.use(authenticate);

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

    // Batch: fetch all scores for all contestants in one query (避免 N+1)
    const contestantIds = (contestants as RowDataPacket[]).map(c => c.id);
    const [allScores] = contestantIds.length > 0
      ? await connection.query<RowDataPacket[]>(
          `SELECT s.*, j.name as judge_name
           FROM scores s
           LEFT JOIN judges j ON s.judge_id = j.id
           WHERE s.contestant_id IN (?) AND s.is_valid = 1`,
          [contestantIds]
        )
      : [[]];

    // Batch: fetch all score_details for all scores in one query
    const scoreIds = (allScores as RowDataPacket[]).map(s => s.id);
    const [allDetails] = scoreIds.length > 0
      ? await connection.query<RowDataPacket[]>(
          `SELECT sd.score_id, sd2.name, sd2.dimension_id, d.name as dimension_name, sd.score
           FROM score_details sd
           LEFT JOIN scoring_subdimensions sd2 ON sd.subdimension_id = sd2.id
           LEFT JOIN scoring_dimensions d ON sd2.dimension_id = d.id
           WHERE sd.score_id IN (?)`,
          [scoreIds]
        )
      : [[]];

    // Group scores by contestant
    const scoresByContestant: Record<number, RowDataPacket[]> = {};
    for (const s of allScores as RowDataPacket[]) {
      if (!scoresByContestant[s.contestant_id]) scoresByContestant[s.contestant_id] = [];
      scoresByContestant[s.contestant_id].push(s);
    }
    // Group details by score
    const detailsByScore: Record<number, RowDataPacket[]> = {};
    for (const d of allDetails as RowDataPacket[]) {
      if (!detailsByScore[d.score_id]) detailsByScore[d.score_id] = [];
      detailsByScore[d.score_id].push(d);
    }

    const results: { id: number; contestant: RowDataPacket; total_score: number; final_score: number; score_count: number }[] = [];
    for (const contestant of contestants as RowDataPacket[]) {
      const scores = scoresByContestant[contestant.id] || [];
      if (scores.length === 0) continue;

      const totalScore = scores.reduce(
        (sum: number, s: RowDataPacket) => sum + parseFloat(s.total_score || 0),
        0
      );
      const avgScore = totalScore / scores.length;

      // 去掉一个最高分和一个最低分（至少需要3个评分才有效）
      let finalScore = avgScore;
      if (scores.length >= 3) {
        const sortedScores = scores
          .map(s => parseFloat(s.total_score || 0))
          .sort((a, b) => a - b);
        const count = sortedScores.length;
        const trimmedSum = sortedScores.slice(1, count - 1).reduce((sum, s) => sum + s, 0);
        finalScore = trimmedSum / (count - 2);
      }

      // 计算各维度平均分
      const avgScores: Record<string, number> = {};
      for (const score of scores) {
        const details = detailsByScore[score.id] || [];
        for (const d of details) {
          if (!avgScores[d.dimension_name]) {
            avgScores[d.dimension_name] = 0;
          }
          avgScores[d.dimension_name] += parseFloat(d.score || 0) / scores.length;
        }
      }

      const [resultInsert] = await connection.query(
        'INSERT INTO competition_results (competition_id, contestant_id, total_score, final_score, score_count, avg_scores) VALUES (?, ?, ?, ?, ?, ?)',
        [competitionId, contestant.id, avgScore, finalScore, (scores as RowDataPacket[]).length, JSON.stringify(avgScores)]
      );

      results.push({
        id: (resultInsert as ResultSetHeader).insertId,
        contestant,
        total_score: avgScore,
        final_score: finalScore,
        score_count: (scores as RowDataPacket[]).length
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
    const competition = (compRows as RowDataPacket[])[0];
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
    for (const row of dimRows as RowDataPacket[]) {
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
    for (const s of scoreRows as RowDataPacket[]) {
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

export default router;
