import type { Contestant, ScoringDimension } from '../../types/scoring.ts';
import ScoringDimensionGroup from './ScoringDimensionGroup.tsx';
import { motion } from 'motion/react';
import { ClipboardList, AlertTriangle, ChevronRight } from 'lucide-react';

interface Props {
  contestant: Contestant | null;
  contestants: Contestant[];
  dimensions: ScoringDimension[];
  scores: Record<number, number>;
  onScoreChange: (subId: number, maxScore: number, value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  onSubmitAll: () => void;
  submittingAll: boolean;
  loadScoreError: string;
}

export default function ScoringForm({
  contestant, contestants, dimensions, scores, onScoreChange,
  onSubmit, submitting, onSubmitAll, submittingAll, loadScoreError,
}: Props) {
  const templateTotal = dimensions.reduce((sum, d) => sum + (parseFloat(String(d.max_score)) || 0), 0);
  const currentTotal = dimensions.reduce((sum, dim) => {
    if (dim.subdimensions.length > 0) {
      return sum + dim.subdimensions.reduce((s, sub) => s + (scores[sub.id] ?? 0), 0);
    }
    return sum + (scores[dim.id] ?? 0);
  }, 0);
  const unscoredCount = contestants.filter((c) => !c.scored).length;

  if (contestants.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-6">
        <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center">
          <ClipboardList size={32} className="text-outline" />
        </div>
        <div className="text-lg font-medium text-on-surface">暂无可评分选手</div>
        <div className="text-sm text-outline">请等待管理员添加选手后再进行评分</div>
      </div>
    );
  }

  if (!contestant) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Contestant Info + Total */}
      <div className="flex items-center justify-between bg-surface rounded-xl border border-outline-variant/60 px-3 py-2.5 shadow-sm">
        <div className="min-w-0 mr-2">
          <div className="text-sm font-semibold text-on-surface truncate">
            {contestant.work_name || contestant.name}
          </div>
          {contestant.group_name && (
            <div className="text-xs text-on-surface-variant">{contestant.group_name}</div>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <div className={`text-sm font-bold tabular-nums ${currentTotal > templateTotal ? 'text-error' : currentTotal === templateTotal ? 'text-success' : 'text-on-surface'}`}>
            {currentTotal}
          </div>
          <div className="text-xs text-on-surface-variant">/ {templateTotal}</div>
        </div>
      </div>

      {/* Score load error */}
      {loadScoreError && (
        <div className="p-2.5 bg-error/10 border border-error/20 rounded-lg flex items-center gap-2 text-error text-xs">
          <AlertTriangle size={14} /> {loadScoreError}
        </div>
      )}

      {/* No dimensions fallback */}
      {dimensions.length === 0 && (
        <div className="bg-surface rounded-xl border border-outline-variant/60 p-4">
          <label className="text-sm font-medium text-on-surface-variant mb-2 block">总分（0-100）</label>
          <input type="number" min="0" max="100" step="0.5" inputMode="decimal"
            value={scores[0] ?? ''}
            onChange={(e) => onScoreChange(0, 100, e.target.value)}
            className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-on-surface text-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
            placeholder="请输入总分" />
        </div>
      )}

      {/* Dimension Grid: 1-col mobile, 2-col desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {dimensions.map((dim, dimIndex) => (
          <ScoringDimensionGroup
            key={dim.id}
            dim={dim}
            dimIndex={dimIndex}
            scores={scores}
            onScoreChange={onScoreChange}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-2 pt-4 max-w-sm mx-auto w-full">
        <motion.button
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          onClick={onSubmit} disabled={submitting}
          className="w-full py-3 bg-primary text-on-primary font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-50 focus-ring hover:bg-primary/90 transition-colors touch-target">
          {submitting ? '提交中...' : '提交评分'}
          {!submitting && <ChevronRight size={18} />}
        </motion.button>

        {contestants.length > 1 && (
          <button
            onClick={onSubmitAll} disabled={submittingAll}
            className="text-center text-xs text-on-surface-variant hover:text-primary transition-colors disabled:opacity-50 focus-ring py-1">
            {submittingAll ? '提交中...' : `一键提交全部${unscoredCount > 0 ? `（还有 ${unscoredCount} 人未评分）` : ''}`}
          </button>
        )}
      </div>
    </div>
  );
}
