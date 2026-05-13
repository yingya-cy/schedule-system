import { Router } from 'express';
import pool from '../../config/database.ts';
import { judgeAuth, JWT_SECRET } from '../../middleware/auth.ts';
import { RowDataPacket, ResultSetHeader } from '../../utils/db-types';
import { validate, submitScoreSchema } from '../../utils/validation.ts';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const router = Router();

// =============================================
// 评委登录（公开，用名字 + 比赛ID）
// =============================================

router.post('/judge/login', async (req, res) => {
  try {
    const { name, competition_id } = req.body;
    if (!name || !competition_id) {
      res.status(400).json({ success: false, error: '请输入评委姓名和比赛' });
      return;
    }
    const [rows] = await pool.query(
      `SELECT j.id, j.name, j.code, j.competition_id, c.name as competition_name, c.status as competition_status
       FROM judges j
       LEFT JOIN competitions c ON j.competition_id = c.id
       WHERE j.name = ? AND j.competition_id = ?`,
      [name, competition_id]
    );
    if ((rows as RowDataPacket[]).length === 0) {
      res.status(401).json({ success: false, error: '评委姓名错误或未分配到该比赛' });
      return;
    }
    const judge = (rows as RowDataPacket[])[0];

    const tokenPayload = { judgeId: judge.id, competitionId: judge.competition_id, type: 'judge' };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '12h' });

    res.json({ success: true, data: { ...judge, token } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

// =============================================
// 评委已认证接口
// =============================================

router.get('/judge/contestants', judgeAuth, async (req, res) => {
  try {
    const judgeId = req.judge!.judgeId;

    const [judgeRows] = await pool.query(
      'SELECT * FROM judges WHERE id = ?',
      [judgeId]
    );
    if ((judgeRows as RowDataPacket[]).length === 0) {
      res.status(404).json({ success: false, error: '评委不存在' });
      return;
    }
    const judge = (judgeRows as RowDataPacket[])[0];

    const [contestants] = await pool.query(
      'SELECT * FROM contestants WHERE competition_id = ? ORDER BY number',
      [judge.competition_id]
    );

    const contestantsWithScore = await Promise.all(
      (contestants as RowDataPacket[]).map(async (c: RowDataPacket) => {
        const [scores] = await pool.query(
          'SELECT * FROM scores WHERE contestant_id = ? AND judge_id = ?',
          [c.id, judge.id]
        );
        return {
          ...c,
          scored: (scores as RowDataPacket[]).length > 0,
          score: (scores as RowDataPacket[]).length > 0 ? (scores as RowDataPacket[])[0] : null
        };
      })
    );

    res.json({ success: true, data: contestantsWithScore });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

router.get('/judge/scores/:contestantId', judgeAuth, async (req, res) => {
  try {
    const { contestantId } = req.params;
    const judgeId = req.judge!.judgeId;
    const [scoreRows] = await pool.query(
      `SELECT sd.subdimension_id, sd.dimension_id, sd.score
       FROM scores s
       LEFT JOIN score_details sd ON sd.score_id = s.id
       WHERE s.contestant_id = ? AND s.judge_id = ?`,
      [contestantId, judgeId]
    );
    res.json({ success: true, data: scoreRows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
});

router.post('/judge/scores', judgeAuth, validate(submitScoreSchema), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.query('SET NAMES utf8mb4');
    await connection.beginTransaction();

    const { contestant_id, scores } = req.body;
    const judgeId = req.judge!.judgeId;

    const [judgeRows] = await connection.query(
      'SELECT * FROM judges WHERE id = ?',
      [judgeId]
    );
    if ((judgeRows as RowDataPacket[]).length === 0) {
      throw new Error('评委不存在');
    }
    const judge = (judgeRows as RowDataPacket[])[0];

    const [contestantRows] = await connection.query(
      'SELECT * FROM contestants WHERE id = ?',
      [contestant_id]
    );
    if ((contestantRows as RowDataPacket[]).length === 0) {
      throw new Error('选手不存在');
    }
    const contestant = (contestantRows as RowDataPacket[])[0];

    const [compRows] = await connection.query(
      'SELECT status FROM competitions WHERE id = ?',
      [contestant.competition_id]
    );
    if ((compRows as RowDataPacket[]).length > 0 && (compRows as RowDataPacket[])[0].status === 'completed') {
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
    if ((existingScores as RowDataPacket[]).length > 0) {
      scoreId = (existingScores as RowDataPacket[])[0].id;
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
      scoreId = (insertResult as ResultSetHeader).insertId;
    }

    // Batch INSERT score_details (避免 N+1)
    if (scoreDetails.length > 0) {
      const detailValues: (number | undefined)[] = [];
      const detailPlaceholders: string[] = [];
      for (const s of scoreDetails) {
        if (s.subdimension_id) {
          detailPlaceholders.push('(?, ?, NULL, ?)');
          detailValues.push(scoreId, s.subdimension_id, s.score);
        } else if (s.dimension_id) {
          detailPlaceholders.push('(?, NULL, ?, ?)');
          detailValues.push(scoreId, s.dimension_id, s.score);
        }
      }
      if (detailPlaceholders.length > 0) {
        await connection.query(
          `INSERT INTO score_details (score_id, subdimension_id, dimension_id, score) VALUES ${detailPlaceholders.join(', ')}`,
          detailValues
        );
      }
    }

    await connection.commit();
    res.json({ success: true, data: { total_score: totalScore } });
  } catch (error: unknown) {
    await connection.rollback();
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  } finally {
    connection.release();
  }
});

export default router;
