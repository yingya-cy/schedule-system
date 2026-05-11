import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate, requireRole } from '../../middleware/auth.ts';
import { RowDataPacket, ResultSetHeader } from '../../utils/db-types';

const router = Router();

// Authentication required for all routes
router.use(authenticate);

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
    if ((templates as RowDataPacket[]).length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const [dimensions] = await pool.query(
      'SELECT * FROM scoring_dimensions WHERE template_id = ? ORDER BY sort_order',
      [req.params.id]
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

    res.json({
      success: true,
      data: { ...(templates as RowDataPacket[])[0], dimensions: dimensionsWithSubs }
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
    const templateId = (result as ResultSetHeader).insertId;

    if (dimensions && dimensions.length > 0) {
      for (let i = 0; i < dimensions.length; i++) {
        const dim = dimensions[i];
        const [dimResult] = await connection.query(
          'INSERT INTO scoring_dimensions (template_id, name, max_score, sort_order, is_optional, description) VALUES (?, ?, ?, ?, ?, ?)',
          [templateId, dim.name, dim.max_score, i, dim.is_optional ? 1 : 0, dim.description || '']
        );
        const dimensionId = (dimResult as ResultSetHeader).insertId;

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
        const dimensionId = (dimResult as ResultSetHeader).insertId;

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


export default router;
