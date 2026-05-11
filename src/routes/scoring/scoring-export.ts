import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';
import { RowDataPacket } from '../../utils/db-types';
import ExcelJS from 'exceljs';
import { columnLetter } from '../../utils/formatters.ts';

const router = Router();

// Authentication required
router.use(authenticate);

// 导出评分结果（直接生成 xlsx，不依赖 AI）
router.get('/competitions/:id/export', async (req, res) => {
  try {
    const competitionId = Number(req.params.id);
    const exportType = (req.query.type as string) || 'summary';

    const [compRows] = await pool.query('SELECT * FROM competitions WHERE id = ?', [competitionId]);
    const competition = (compRows as RowDataPacket[])[0];
    if (!competition) { res.status(404).json({ success: false, error: '比赛不存在' }); return; }

    const [dimRows] = await pool.query(
      'SELECT d.*, sd.id as sub_id, sd.name as sub_name, sd.max_score as sub_max, sd.description as sub_desc, sd.sort_order as sub_sort FROM scoring_dimensions d LEFT JOIN scoring_subdimensions sd ON d.id = sd.dimension_id WHERE d.template_id = ? ORDER BY d.sort_order, sd.sort_order',
      [competition.template_id]
    );
    const dimensions: { id: number; name: string; max_score: number; description: string | null; subs: { id: number; name: string; max_score: number; description: string | null }[] }[] = [];
    const dimMap = new Map<number, typeof dimensions[number]>();
    for (const r of dimRows as RowDataPacket[]) {
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
    const contestants = contestantRows as RowDataPacket[];

    const [judgeRows] = await pool.query(
      'SELECT id, name FROM judges WHERE competition_id = ? ORDER BY name', [competitionId]
    );
    const judges = judgeRows as RowDataPacket[];

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
    const styleCell = (cell: ExcelJS.Cell, font?: Partial<ExcelJS.Font>, align?: Partial<ExcelJS.Alignment>) => {
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
      for (const r of detailRows as RowDataPacket[]) {
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
      for (const r of scoreRows as RowDataPacket[]) {
        if (!totalMap[r.contestant_id]) totalMap[r.contestant_id] = {};
        totalMap[r.contestant_id][r.judge_id] = Number(r.total_score);
      }
      const [resultRows] = await pool.query(
        'SELECT contestant_id, avg_scores, `rank` FROM competition_results WHERE competition_id = ?', [competitionId]
      );
      const resultMap = new Map<number, { rank: number }>();
      for (const r of resultRows as RowDataPacket[]) {
        resultMap.set(r.contestant_id, { rank: r.rank });
      }

      const ranked: { contestant: RowDataPacket; avg: number; rank: number; judgeScores: Record<number, number> }[] = [];
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

export default router;
