import { useState } from 'react';
import { resultApi } from '../../services/scoringApi.ts';
import type { Judge } from '../../types/scoring.ts';
import { motion } from 'motion/react';
import { Download } from 'lucide-react';

interface ResultRow {
  rank: number;
  number?: string;
  contestant_name?: string;
  work_name?: string;
  group_name?: string;
  final_score?: number;
  total_score: number;
  score_count?: number;
}

interface MsgState {
  open: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface Props {
  competitionId: number;
  competitionName: string;
  results: ResultRow[];
  resultsLoaded: boolean;
  judges: Judge[];
  setMessageDialog: React.Dispatch<React.SetStateAction<MsgState>>;
}

export default function ResultsTab({
  competitionId, competitionName, results, resultsLoaded, judges, setMessageDialog,
}: Props) {
  const [showJudgePicker, setShowJudgePicker] = useState(false);

  async function exportSummary() {
    try {
      const { blob, filename } = await resultApi.exportResultsDirect(competitionId, 'summary');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename;
      a.click(); URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '导出失败', message: (e as Error).message || '请检查网络和服务器' });
    }
  }

  async function exportJudgeDetail(judgeId: number) {
    setShowJudgePicker(false);
    try {
      const { blob, filename } = await resultApi.exportResultsDirect(competitionId, 'judge_detail', judgeId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename;
      a.click(); URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '导出失败', message: (e as Error).message || '请检查网络和服务器' });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-outline">共 {results.length} 条结果</div>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={exportSummary}
            className="px-3 py-2 bg-surface-container-low text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container-high transition-colors flex items-center gap-1.5 touch-target focus-ring"
          >
            <Download size={14} /> 导出统分表
          </motion.button>
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowJudgePicker(!showJudgePicker)}
              className="px-3 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-1.5 touch-target focus-ring"
            >
              <Download size={14} /> 导出评分表
            </motion.button>
            {showJudgePicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowJudgePicker(false)} />
                <div className="absolute right-0 top-full mt-1 bg-surface rounded-xl border border-surface-container-high shadow-lg z-50 py-1 min-w-[140px]">
                  {judges.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => exportJudgeDetail(j.id)}
                      className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      {j.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {!resultsLoaded && results.length === 0 ? (
        <div className="py-16 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-outline text-sm">加载中...</span>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="py-16 text-center text-outline bg-surface rounded-2xl border border-surface-container-high">
          暂无计算结果，请先点击"计算结果"
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-surface-container-high overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3 text-center text-xs font-medium text-on-surface-variant uppercase tracking-wider w-16">排名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">编号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">姓名/名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">组别</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-on-surface-variant uppercase tracking-wider">最终分</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-on-surface-variant uppercase tracking-wider">原始均分</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-on-surface-variant uppercase tracking-wider">评分人数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {results.map((r) => (
                <tr key={r.rank} className={`transition-colors ${r.rank <= 3 ? 'bg-primary/5' : 'hover:bg-surface-container-low/50'}`}>
                  <td className="px-4 py-3 text-center">
                    <span className="text-lg">{r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface">{r.number || '-'}</td>
                  <td className={`px-4 py-3 text-sm font-medium ${r.rank <= 3 ? 'text-primary' : 'text-on-surface'}`}>
                    {r.work_name || r.contestant_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-outline">{r.group_name || '-'}</td>
                  <td className="px-4 py-3 text-center text-sm font-bold text-on-surface">
                    {Number(r.final_score ?? r.total_score).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-outline">
                    {Number(r.total_score).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-outline">{r.score_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
