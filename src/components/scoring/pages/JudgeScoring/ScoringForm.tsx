import type { Contestant, ScoringDimension } from '../../types/scoring.ts';
import ScoringDimensionGroup from './ScoringDimensionGroup.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, AlertTriangle, ChevronRight } from 'lucide-react';

interface Props {
  contestant: Contestant | null;
  contestants: Contestant[];
  dimensions: ScoringDimension[];
  scores: Record<number, number>;
  onScoreChange: (subId: number, maxScore: number, value: string) => void;
  expandedDims: Record<number, boolean>;
  onToggleDim: (dimId: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  onSubmitAll: () => void;
  submittingAll: boolean;
  loadScoreError: string;
}

export default function ScoringForm({
  contestant, contestants, dimensions, scores, onScoreChange,
  expandedDims, onToggleDim, onSubmit, submitting, onSubmitAll, submittingAll, loadScoreError,
}: Props) {
  const allSubdimensions = dimensions.flatMap((d) =>
    d.subdimensions.map((s) => ({ ...s, dimensionName: d.name, dimensionMaxScore: d.max_score }))
  );
  const currentTotal = allSubdimensions.reduce((sum, sub) => {
    const v = scores[sub.id];
    return sum + (v !== undefined ? v : 0);
  }, 0);
  const templateTotal = dimensions.reduce((sum, d) => sum + (parseFloat(String(d.max_score)) || 0), 0);

  if (contestants.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center max-w-2xl mx-auto w-full">
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
    <AnimatePresence mode="wait">
      <motion.div
        key="scoring"
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex-1 flex flex-col gap-4 md:gap-6 max-w-2xl mx-auto w-full">
        {/* Contestant Info */}
        <div className="bg-surface rounded-2xl border border-surface-container-high p-4 md:p-5 shadow-sm">
          <h2 className="text-lg md:text-xl font-bold text-on-surface font-headline truncate">
            {contestant.work_name || contestant.name}
          </h2>
          {contestant.group_name && (
            <div className="text-sm text-outline mt-1">组别：{contestant.group_name}</div>
          )}
        </div>

        {/* 评分加载错误提示 */}
        {loadScoreError && (
          <div className="p-3 bg-error/10 border border-error/20 rounded-xl flex items-center gap-2 text-error text-sm">
            <AlertTriangle size={16} /> {loadScoreError}
          </div>
        )}

        <div className="flex-1 space-y-3 md:space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-wider">请打分</h3>
            {allSubdimensions.length > 0 && (
              <div className={`text-sm font-medium ${currentTotal > templateTotal ? 'text-error' : 'text-on-surface-variant'}`}>
                当前总分：{currentTotal} / {templateTotal}
              </div>
            )}
          </div>

          {/* No dimensions fallback */}
          {dimensions.length === 0 && (
            <div className="bg-surface rounded-2xl border border-surface-container-high p-5 space-y-3">
              <label className="text-sm font-medium text-on-surface-variant">总分（0-100）</label>
              <input type="number" min="0" max="100" step="0.5"
                value={scores[0] ?? ''}
                onChange={(e) => onScoreChange(0, 100, e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface text-lg placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                placeholder="请输入总分" />
            </div>
          )}

          {/* Dimension Groups */}
          <div className="space-y-3">
            {dimensions.map((dim, dimIndex) => (
              <ScoringDimensionGroup
                key={dim.id}
                dim={dim}
                dimIndex={dimIndex}
                scores={scores}
                onScoreChange={onScoreChange}
                isExpanded={expandedDims[dim.id] !== false}
                onToggle={() => onToggleDim(dim.id)}
              />
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <motion.button
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          onClick={onSubmit} disabled={submitting}
          className="w-full py-4 bg-gradient-to-r from-primary to-primary/80 text-on-primary font-bold rounded-xl shadow-lg shadow-primary/25 text-lg flex items-center justify-center gap-2 disabled:opacity-50 focus-ring">
          {submitting ? '提交中...' : '提交评分'}
          {!submitting && <ChevronRight size={20} />}
        </motion.button>

        {/* 一键提交按钮 */}
        {contestants.length > 1 && (
          <button
            onClick={onSubmitAll} disabled={submittingAll}
            className="w-full py-3 bg-surface-container-high text-on-surface-variant font-medium rounded-xl border border-surface-container-high hover:bg-surface-container-low transition-colors disabled:opacity-50 focus-ring flex items-center justify-center gap-2">
            {submittingAll ? '提交中...' : '一键提交全部'}
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
