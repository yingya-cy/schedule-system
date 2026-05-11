import type { ScoringDimension } from '../../types/scoring.ts';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, AlertTriangle } from 'lucide-react';

const DIMENSION_COLORS = [
  'border-l-primary', 'border-l-purple-500', 'border-l-orange-500',
  'border-l-green-500', 'border-l-pink-500', 'border-l-cyan-500',
  'border-l-amber-500', 'border-l-indigo-500',
];

interface Props {
  dim: ScoringDimension;
  dimIndex: number;
  scores: Record<number, number>;
  onScoreChange: (subId: number, maxScore: number, value: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

function getDimProgress(dim: ScoringDimension, scores: Record<number, number>) {
  let scored = 0;
  let total = 0;
  if (dim.subdimensions.length > 0) {
    dim.subdimensions.forEach((sub) => {
      total += Number(sub.max_score);
      if (scores[sub.id] !== undefined) scored += scores[sub.id];
    });
  } else {
    total = Number(dim.max_score) || 0;
    if (scores[dim.id] !== undefined) scored = scores[dim.id];
  }
  return { scored, total, percentage: total > 0 ? (scored / total) * 100 : 0 };
}

export default function ScoringDimensionGroup({ dim, dimIndex, scores, onScoreChange, isExpanded, onToggle }: Props) {
  const colorClass = DIMENSION_COLORS[dimIndex % DIMENSION_COLORS.length];
  const progress = getDimProgress(dim, scores);
  const hasAnyScore = dim.subdimensions.length > 0
    ? dim.subdimensions.some((s) => scores[s.id] !== undefined)
    : scores[dim.id] !== undefined;
  const hasOverScore = dim.subdimensions.length > 0
    ? dim.subdimensions.some((s) => { const v = scores[s.id]; return v !== undefined && v > s.max_score; })
    : (scores[dim.id] !== undefined && scores[dim.id] > dim.max_score);

  return (
    <div className={`bg-surface rounded-2xl border border-surface-container-high border-l-4 ${colorClass} overflow-hidden`}>
      {/* Dimension Header */}
      <button onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-container-low/50 transition-colors focus-ring">
        <div className="flex items-center gap-3">
          <ChevronDown size={18}
            className={`text-on-surface-variant transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
          <div className="text-left">
            <div className="font-semibold text-on-surface font-headline">{dim.name}</div>
            <div className="text-xs text-outline">
              满分 <span className="font-medium">{dim.max_score}</span> 分
            </div>
            {dim.description && dim.subdimensions.length > 0 && (
              <div className="text-xs text-outline mt-0.5 line-clamp-2">{dim.description}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasOverScore && <AlertTriangle size={16} className="text-error" />}
          <div className="text-right">
            <div className={`text-sm font-semibold ${hasOverScore ? 'text-error' : hasAnyScore ? 'text-success' : 'text-on-surface-variant'}`}>
              {progress.scored > 0 ? progress.scored.toFixed(1) : '—'} / {progress.total}
            </div>
            <div className="w-16 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }}
                animate={{ width: `${progress.percentage}%` }}
                className={`h-full rounded-full ${hasOverScore ? 'bg-error' : hasAnyScore ? 'bg-success' : 'bg-surface-container-high'}`} />
            </div>
          </div>
        </div>
      </button>

      {/* Subdimensions (Collapsible) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3 border-t border-surface-container-high/50">
              {dim.subdimensions.length === 0 ||
              (dim.subdimensions.length === 1 && dim.subdimensions[0].name === dim.name) ? (
                /* 无子维度 或 子维度name与主维度相同（AI解析错误），视为无子维度 */
                <div className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-on-surface text-sm">{dim.name}</div>
                      {dim.description && (
                        <div className="text-xs text-outline mt-0.5">{dim.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <span className="text-xs text-outline">满分 {dim.max_score} 分</span>
                    </div>
                  </div>
                  <input type="number" min="0" max={dim.max_score} step="0.5"
                    value={scores[dim.id] !== undefined ? scores[dim.id] : ''}
                    onChange={(e) => onScoreChange(dim.id, dim.max_score, e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface text-base placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                    placeholder={`0 - ${dim.max_score}`} />
                  {scores[dim.id] !== undefined && (
                    <div className={`text-xs mt-1 ${scores[dim.id] > dim.max_score ? 'text-error' : 'text-success'}`}>
                      {scores[dim.id] > dim.max_score
                        ? `分数超出（${scores[dim.id]} > ${dim.max_score}）`
                        : `当前：${scores[dim.id]} / ${dim.max_score}`}
                    </div>
                  )}
                </div>
              ) : (
                dim.subdimensions.map((sub) => {
                  const currentVal = scores[sub.id];
                  const isOver = currentVal !== undefined && currentVal > sub.max_score;
                  return (
                    <div key={sub.id} className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-on-surface text-sm">{sub.name}</div>
                          {sub.description && (
                            <div className="text-xs text-outline mt-0.5">{sub.description}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          {isOver && <AlertTriangle size={12} className="text-error" />}
                          <span className={`text-xs ${isOver ? 'text-error font-bold' : 'text-outline'}`}>
                            满分 {sub.max_score}
                          </span>
                        </div>
                      </div>
                      <input type="number" min="0" max={sub.max_score} step="0.5"
                        value={currentVal !== undefined ? currentVal : ''}
                        onChange={(e) => onScoreChange(sub.id, sub.max_score, e.target.value)}
                        className={`w-full px-4 py-3 bg-surface-container-low border rounded-xl text-on-surface text-base placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${isOver ? 'border-error' : 'border-surface-container-high'} focus-ring`}
                        placeholder={`0 - ${sub.max_score}`} />
                      {currentVal !== undefined && (
                        <div className={`text-xs mt-1 ${isOver ? 'text-error' : 'text-success'}`}>
                          {isOver ? `分数超出（${currentVal} > ${sub.max_score}）` : `当前：${currentVal} / ${sub.max_score}`}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
