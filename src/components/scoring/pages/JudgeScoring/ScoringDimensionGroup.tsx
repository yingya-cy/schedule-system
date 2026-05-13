import type { ScoringDimension } from '../../types/scoring.ts';
import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

// Unicode circled numbers ①-⑧ for clean visual indexing
const BADGES = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];

interface Props {
  dim: ScoringDimension;
  dimIndex: number;
  scores: Record<number, number>;
  onScoreChange: (subId: number, maxScore: number, value: string) => void;
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

export default function ScoringDimensionGroup({ dim, dimIndex, scores, onScoreChange }: Props) {
  const progress = getDimProgress(dim, scores);
  const isComplete = dim.subdimensions.length > 0
    ? dim.subdimensions.every((s) => scores[s.id] !== undefined)
    : scores[dim.id] !== undefined;
  const hasOverScore = dim.subdimensions.length > 0
    ? dim.subdimensions.some((s) => { const v = scores[s.id]; return v !== undefined && v > s.max_score; })
    : (scores[dim.id] !== undefined && scores[dim.id] > dim.max_score);

  const badge = BADGES[dimIndex] ?? `${dimIndex + 1}`;
  const borderClass = isComplete
    ? 'border-l-2 border-l-success/60'
    : 'border-l-2 border-l-primary/20';

  return (
    <div className={`bg-surface rounded-xl border border-outline-variant/60 ${borderClass} overflow-hidden`}>
      {/* Dimension Header */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-primary text-sm font-bold flex-shrink-0 w-5">{badge}</span>
          <div className="text-left min-w-0">
            <div className="text-sm font-semibold text-on-surface">{dim.name}</div>
            {dim.description ? (
              <div className="text-xs text-on-surface-variant mt-0.5">{dim.description}</div>
            ) : null}
            <div className="text-xs text-on-surface-variant">满分 {dim.max_score} 分</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {hasOverScore && <AlertTriangle size={14} className="text-error" />}
          {isComplete && !hasOverScore && (
            <span className="text-xs text-success font-medium">✓</span>
          )}
          <div className="text-right">
            <div className={`text-xs font-semibold ${hasOverScore ? 'text-error' : isComplete ? 'text-success' : 'text-on-surface-variant'}`}>
              {progress.scored > 0 ? progress.scored.toFixed(1) : '—'}/{progress.total}
            </div>
            <div className="w-12 h-1 bg-surface-container-high rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }}
                animate={{ width: `${progress.percentage}%` }}
                className={`h-full rounded-full ${hasOverScore ? 'bg-error' : isComplete ? 'bg-success' : 'bg-primary/50'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Subdimensions (always visible) */}
      <div className="px-3 pb-3 space-y-2.5 border-t border-outline-variant/30">
              {dim.subdimensions.length === 0 ||
              (dim.subdimensions.length === 1 && dim.subdimensions[0].name === dim.name) ? (
                <div className="pt-3">
                  <input type="number" min="0" max={dim.max_score} step="0.5"
                    inputMode="decimal"
                    value={scores[dim.id] !== undefined ? scores[dim.id] : ''}
                    onChange={(e) => onScoreChange(dim.id, dim.max_score, e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface text-base placeholder:text-outline/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                    placeholder={`0 - ${dim.max_score}`} />
                </div>
              ) : (
                dim.subdimensions.map((sub) => {
                  const currentVal = scores[sub.id];
                  const isOver = currentVal !== undefined && currentVal > sub.max_score;
                  return (
                    <div key={sub.id} className="pt-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-on-surface truncate min-w-0 mr-2">{sub.name}</div>
                        <span className={`text-xs flex-shrink-0 ${isOver ? 'text-error font-bold' : 'text-on-surface-variant'}`}>
                          /{sub.max_score}
                        </span>
                      </div>
                      {sub.description ? (
                        <div className="text-xs text-on-surface-variant mb-1.5">{sub.description}</div>
                      ) : null}
                      <input type="number" min="0" max={sub.max_score} step="0.5"
                        inputMode="decimal"
                        value={currentVal !== undefined ? currentVal : ''}
                        onChange={(e) => onScoreChange(sub.id, sub.max_score, e.target.value)}
                        className={`w-full px-3 py-2.5 bg-surface-container-low border rounded-lg text-on-surface text-base placeholder:text-outline/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${isOver ? 'border-error' : 'border-outline-variant'} focus-ring`}
                        placeholder={`0 - ${sub.max_score}`} />
                    </div>
                  );
                })
              )}
            </div>
    </div>
  );
}
