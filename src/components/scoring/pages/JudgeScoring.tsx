import { useState, useEffect, useRef } from 'react';
import { judgeApi, competitionApi } from '../services/scoringApi.ts';
import type { Contestant, ScoringDimension } from '../types/scoring.ts';
import MessageDialog from '../../MessageDialog.tsx';
import ConfirmDialog from '../../ConfirmDialog.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, ClipboardList, ArrowLeft, AlertTriangle, ChevronDown } from 'lucide-react';

// Dimension colors for visual distinction
const DIMENSION_COLORS = [
  'border-l-primary',
  'border-l-purple-500',
  'border-l-orange-500',
  'border-l-green-500',
  'border-l-pink-500',
  'border-l-cyan-500',
  'border-l-amber-500',
  'border-l-indigo-500',
];

interface JudgeScoringProps {
  competitionId: number;
  judgeId: number;
  judgeName: string;
  onBack: () => void;
}

export default function JudgeScoring({ competitionId, judgeId, judgeName, onBack }: JudgeScoringProps) {
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [activeContestant, setActiveContestant] = useState<Contestant | null>(null);
  // 所有选手的评分 { contestantId: { subId: score } }
  const [contestantScores, setContestantScores] = useState<Record<number, Record<number, number>>>({});
  // 当前选手的评分 { subId: score }
  const [currentScores, setCurrentScores] = useState<Record<number, number>>({});
  // 已提交的选手ID集合
  const [submittedIds, setSubmittedIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submittingAll, setSubmittingAll] = useState(false);
  const [error, setError] = useState('');
  const [competitionName, setCompetitionName] = useState('');

  // Template dimensions for scoring form
  const [dimensions, setDimensions] = useState<ScoringDimension[]>([]);

  // Track expanded dimensions (all expanded by default)
  const [expandedDims, setExpandedDims] = useState<Record<number, boolean>>({});

  // Dialogs
  const [messageDialog, setMessageDialog] = useState<{ open: boolean; type: 'success' | 'error' | 'info'; title: string; message?: string }>({ open: false, type: 'info', title: '' });
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });

  // 是否正在切换选手（防止重复保存）
  const [switchingContestant, setSwitchingContestant] = useState(false);
  // 评分加载错误
  const [loadScoreError, setLoadScoreError] = useState('');
  // 用于自动滚动到顶部
  const scoringAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, [competitionId, judgeId]);

  // 自动滚动到顶部当切换选手时
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeContestant?.id]);

  async function loadData() {
    try {
      // Load competition to get template with dimensions
      const comp = await competitionApi.get(competitionId);
      setCompetitionName(comp.name);
      if (comp.template?.dimensions?.length) {
        setDimensions(comp.template.dimensions);
        // Initialize all dimensions as expanded
        const initialExpanded: Record<number, boolean> = {};
        comp.template.dimensions.forEach((d: ScoringDimension) => {
          initialExpanded[d.id] = true;
        });
        setExpandedDims(initialExpanded);
      }

      const data = await competitionApi.getJudgeContestants(judgeId);
      setContestants(data);

      if (data.length > 0) {
        setActiveContestant(data[0]);
        // 加载第一个选手的已有评分
        const loaded = await loadContestantScores(data[0].id);
        setCurrentScores(loaded);
        // 标记已加载的选手
        setContestantScores({ [data[0].id]: loaded });
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  // 加载指定选手的已有评分
  async function loadContestantScores(contestantId: number) {
    try {
      const rows = await judgeApi.getScoresByContestant(String(contestantId), String(judgeId));
      setLoadScoreError('');
      const loaded: Record<number, number> = {};
      for (const row of rows) {
        if (row.subdimension_id) {
          loaded[Number(row.subdimension_id)] = parseFloat(String(row.score));
        } else if (row.dimension_id) {
          loaded[Number(row.dimension_id)] = parseFloat(String(row.score));
        }
      }
      return loaded;
    } catch (e: unknown) {
      setLoadScoreError('加载已有评分失败，请检查网络连接');
      return {};
    }
  }

  // 保存当前选手评分（内部方法）
  async function saveCurrentScores(silent = false): Promise<boolean> {
    if (!activeContestant) return true;
    // 如果没有任何评分，不发送请求
    if (Object.keys(currentScores).length === 0) return true;
    const scoreList: { subdimension_id?: number; dimension_id?: number; score: number }[] = [];
    for (const dim of dimensions) {
      if (dim.subdimensions.length > 0) {
        for (const sub of dim.subdimensions) {
          const scoreVal = currentScores[sub.id];
          scoreList.push({ subdimension_id: sub.id, score: scoreVal !== undefined ? scoreVal : 0 });
        }
      } else {
        const scoreVal = currentScores[dim.id];
        scoreList.push({ dimension_id: dim.id, score: scoreVal !== undefined ? scoreVal : 0 });
      }
    }
    try {
      await judgeApi.submitScore({
        judge_id: judgeId,
        contestant_id: activeContestant.id,
        scores: scoreList,
      });
      // 更新本地记录
      setContestantScores(prev => ({ ...prev, [activeContestant.id]: { ...currentScores } }));
      // 同步更新 scored 状态，使 UI 标签正确显示已评分
      setContestants(prev =>
        prev.map(c => c.id === activeContestant.id ? { ...c, scored: true } : c)
      );
      return true;
    } catch (e: unknown) {
      if (!silent) {
        setMessageDialog({
          open: true, type: 'error', title: '保存失败',
          message: (e as Error).message,
        });
      }
      return false;
    }
  }

  // 切换到指定选手
  async function switchToContestant(c: Contestant) {
    if (!activeContestant || switchingContestant) return;
    if (activeContestant.id === c.id) return;

    // 保存当前选手的评分
    setSwitchingContestant(true);
    const saved = await saveCurrentScores(true);
    if (!saved) {
      setSwitchingContestant(false);
      return;
    }

    // 加载新选手的已有评分
    const loaded = await loadContestantScores(c.id);
    // 缓存到 contestantScores，便于一键提交时使用
    setContestantScores(prev => ({ ...prev, [c.id]: { ...loaded } }));
    setActiveContestant(c);
    setCurrentScores(loaded);
    setSwitchingContestant(false);
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  function handleScoreChange(subId: number, maxScore: number, rawValue: string) {
    if (rawValue === '') {
      setCurrentScores((prev) => {
        const next = { ...prev };
        delete next[subId];
        return next;
      });
      return;
    }
    const num = parseFloat(rawValue);
    if (isNaN(num)) return;
    // Clamp to valid range [0, maxScore]
    const clamped = clamp(num, 0, maxScore);
    setCurrentScores((prev) => ({ ...prev, [subId]: clamped }));
  }

  function toggleDimension(dimId: number) {
    setExpandedDims((prev) => ({ ...prev, [dimId]: !prev[dimId] }));
  }

  // 切换到上一个选手
  function goToPrevContestant() {
    if (!activeContestant || contestants.length === 0) return;
    const idx = contestants.findIndex(c => c.id === activeContestant.id);
    if (idx > 0) {
      switchToContestant(contestants[idx - 1]);
    }
  }

  // 切换到下一个选手
  function goToNextContestant() {
    if (!activeContestant || contestants.length === 0) return;
    const idx = contestants.findIndex(c => c.id === activeContestant.id);
    if (idx < contestants.length - 1) {
      switchToContestant(contestants[idx + 1]);
    }
  }

  // Calculate dimension progress
  function getDimProgress(dim: ScoringDimension) {
    let scored = 0;
    let total = 0;
    if (dim.subdimensions.length > 0) {
      dim.subdimensions.forEach((sub) => {
        total += Number(sub.max_score);
        if (currentScores[sub.id] !== undefined) {
          scored += currentScores[sub.id];
        }
      });
    } else {
      // 无子维度时，直接用维度本身计算
      total = Number(dim.max_score) || 0;
      if (currentScores[dim.id] !== undefined) {
        scored = currentScores[dim.id];
      }
    }
    return { scored, total, percentage: total > 0 ? (scored / total) * 100 : 0 };
  }

  // 提交当前选手评分
  function handleSubmit() {
    if (!activeContestant) return;

    // 构建完整评分列表：所有子维度必须包含，未填的补 0
    const scoreList: { subdimension_id?: number; dimension_id?: number; score: number }[] = [];
    for (const dim of dimensions) {
      if (dim.subdimensions.length > 0) {
        for (const sub of dim.subdimensions) {
          const scoreVal = currentScores[sub.id];
          scoreList.push({ subdimension_id: sub.id, score: scoreVal !== undefined ? scoreVal : 0 });
        }
      } else {
        const scoreVal = currentScores[dim.id];
        scoreList.push({ dimension_id: dim.id, score: scoreVal !== undefined ? scoreVal : 0 });
      }
    }

    // Check for scores exceeding max
    const overMax = scoreList.filter((s) => {
      // 查找是子维度还是主维度
      let maxScore = 0;
      for (const dim of dimensions) {
        if (dim.subdimensions.length > 0) {
          if (s.subdimension_id) {
            const sub = dim.subdimensions.find(sub => sub.id === s.subdimension_id);
            if (sub) { maxScore = sub.max_score; break; }
          }
        } else if (s.dimension_id && dim.id === s.dimension_id) {
          maxScore = dim.max_score;
          break;
        }
      }
      return s.score > maxScore;
    });

    // Calculate total
    const totalInput = scoreList.reduce((sum, s) => sum + s.score, 0);
    const templateTotal = dimensions.reduce((sum, d) => sum + (parseFloat(String(d.max_score)) || 0), 0);

    if (overMax.length > 0) {
      setMessageDialog({
        open: true,
        type: 'error',
        title: '分数超出范围',
        message: `有 ${overMax.length} 个评分项分数超过了满分，请修正后再提交。`,
      });
      return;
    }

    if (totalInput > templateTotal) {
      setMessageDialog({
        open: true,
        type: 'error',
        title: '总分超出限制',
        message: `当前总分 ${totalInput} 超过了模板满分 ${templateTotal}，请修正后再提交。`,
      });
      return;
    }

    setSubmitting(true);
    judgeApi.submitScore({
      judge_id: judgeId,
      contestant_id: activeContestant.id,
      scores: scoreList,
    })
      .then(() => {
        setContestantScores(prev => ({ ...prev, [activeContestant.id]: { ...currentScores }}));
        setSubmittedIds(prev => new Set([...prev, activeContestant.id]));
        setContestants((prev) =>
          prev.map((c) => (c.id === activeContestant.id ? { ...c, scored: true } : c))
        );
        setCurrentScores({});
        setMessageDialog({
          open: true,
          type: 'success',
          title: '提交成功',
          message: contestants.find(c => !c.scored && c.id !== activeContestant.id)
            ? '即将切换到下一位选手'
            : '已是最后一位选手',
        });
        // 延迟切换到下一位
        setTimeout(() => {
          setMessageDialog(p => ({ ...p, open: false }));
          const currentIdx = contestants.findIndex(c => c.id === activeContestant.id);
          const nextIdx = currentIdx + 1;
          if (nextIdx < contestants.length) {
            switchToContestant(contestants[nextIdx]);
          }
        }, 1200);
      })
      .catch((e: unknown) => {
        setMessageDialog({ open: true, type: 'error', title: '提交失败', message: (e as Error).message });
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  // 一键提交所有未评分选手
  function handleSubmitAll() {
    const unscored = contestants.filter((c) => !c.scored && !submittedIds.has(c.id));
    if (unscored.length > 0) {
      setConfirmDialog({
        open: true,
        title: '还有未评分选手',
        message: `还有 ${unscored.length} 个选手未评分，确定要一键提交吗？未评分选手将以 0 分计入。`,
        onConfirm: () => {
          setConfirmDialog(p => ({ ...p, open: false }));
          submitAllContestants(unscored);
        },
      });
      return;
    }
    submitAllContestants(contestants);
  }

  // 执行一键提交
  async function submitAllContestants(toSubmit: Contestant[]) {
    setSubmittingAll(true);
    const templateTotal = dimensions.reduce((sum, d) => sum + (parseFloat(String(d.max_score)) || 0), 0);
    let submitted = 0;
    let skipped = 0;
    let unchanged = 0;
    for (const c of toSubmit) {
      // 获取该选手的评分数据：
      // - 当前选手：用 currentScores（有数据时），否则回退到缓存（如个别提交后 currentScores 被清空）
      // - 其他选手：用 contestantScores 缓存
      const isCurrent = activeContestant?.id === c.id;
      const rawScores: Record<number, number> | undefined = isCurrent
        ? (Object.keys(currentScores).length > 0 ? currentScores : contestantScores[c.id])
        : contestantScores[c.id];

      // 选手已有评分但本地没有缓存（此次会话未修改过），跳过以免清空已有数据
      if (!rawScores && c.scored) {
        unchanged++;
        continue;
      }

      const saved = rawScores || {};
      const scoreList: { subdimension_id?: number; dimension_id?: number; score: number }[] = [];
      for (const dim of dimensions) {
        if (dim.subdimensions.length > 0) {
          for (const sub of dim.subdimensions) {
            const scoreVal = saved[sub.id];
            scoreList.push({ subdimension_id: sub.id, score: scoreVal !== undefined ? scoreVal : 0 });
          }
        } else {
          const scoreVal = saved[dim.id];
          scoreList.push({ dimension_id: dim.id, score: scoreVal !== undefined ? scoreVal : 0 });
        }
      }
      // 检查总分是否超出模板满分
      const totalInput = scoreList.reduce((sum, s) => sum + s.score, 0);
      if (totalInput > templateTotal) {
        skipped++;
        continue;
      }
      try {
        await judgeApi.submitScore({
          judge_id: judgeId,
          contestant_id: c.id,
          scores: scoreList,
        });
        setContestants(prev => prev.map(cc => cc.id === c.id ? { ...cc, scored: true } : cc));
        setSubmittedIds(prev => new Set([...prev, c.id]));
        // 更新本地缓存
        setContestantScores(prev => ({ ...prev, [c.id]: { ...saved } }));
        submitted++;
      } catch (e: unknown) {
        // skip failed ones
      }
    }
    setSubmittingAll(false);
    const parts: string[] = [`已提交 ${submitted} 个选手的评分`];
    if (unchanged > 0) parts.push(`${unchanged} 个选手已有评分且未修改，已保持`);
    if (skipped > 0) parts.push(`${skipped} 个选手因总分超出满分已跳过`);
    setMessageDialog({
      open: true,
      type: 'success',
      title: '提交完成',
      message: parts.join('，'),
    });
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-surface rounded-2xl border border-error/30 p-8 text-center max-w-sm">
          <div className="text-error text-xl font-bold mb-2">加载失败</div>
          <div className="text-sm text-outline mb-4">{error}</div>
          <div className="text-xs text-outline">请联系比赛管理员</div>
        </div>
      </div>
    );
  }

  const unscoredCount = contestants.filter((c) => !c.scored && !submittedIds.has(c.id)).length;

  // Flatten all subdimensions for rendering
  const allSubdimensions = dimensions.flatMap((d) =>
    d.subdimensions.map((s) => ({ ...s, dimensionName: d.name, dimensionMaxScore: d.max_score }))
  );

  // Calculate current totals for display
  const currentTotal = allSubdimensions.reduce((sum, sub) => {
    const v = currentScores[sub.id];
    return sum + (v !== undefined ? v : 0);
  }, 0);
  const templateTotal = dimensions.reduce((sum, d) => sum + (parseFloat(String(d.max_score)) || 0), 0);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="bg-gradient-to-r from-primary to-primary/80 text-on-primary px-6 py-4 flex justify-between items-center shadow-lg shadow-primary/20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors focus-ring"
          >
            <ArrowLeft size={20} className="text-on-primary/80" />
          </button>
          <div>
            <div className="text-lg font-bold font-headline truncate max-w-[50vw]">{competitionName}</div>
            <div className="text-sm text-on-primary/80 mt-0.5">评委：{judgeName}</div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-3xl font-bold font-headline">{unscoredCount}</div>
          <div className="text-xs text-on-primary/80">待评分</div>
        </div>
      </header>

      {/* Contestant Tabs */}
      {contestants.length > 0 && (
        <div className="bg-surface border-b border-surface-container-high px-2 py-2 flex gap-2 items-center flex-shrink-0 overflow-hidden">
          <button
            onClick={goToPrevContestant}
            disabled={!activeContestant || contestants.findIndex(c => c.id === activeContestant.id) === 0}
            className="p-1 rounded bg-surface-container-low hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-ring flex-shrink-0 touch-target flex items-center justify-center"
          >
            <ChevronLeft size={14} className="text-on-surface-variant" />
          </button>

          <div className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0 h-7 max-w-[calc(100vw-140px)]">
            {contestants.map((c) => (
              <button
                key={c.id}
                onClick={() => switchToContestant(c)}
                className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 h-full flex items-center justify-center ${
                  activeContestant?.id === c.id
                    ? 'bg-primary text-on-primary shadow-md'
                    : c.scored
                    ? 'bg-success/10 text-success'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {c.number || c.name}
                {c.scored && <span className="ml-0.5">✓</span>}
              </button>
            ))}
          </div>

          <button
            onClick={goToNextContestant}
            disabled={!activeContestant || contestants.findIndex(c => c.id === activeContestant.id) >= contestants.length - 1}
            className="p-1 rounded bg-surface-container-low hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-ring flex-shrink-0 touch-target flex items-center justify-center"
          >
            <ChevronRight size={14} className="text-on-surface-variant" />
          </button>
        </div>
      )}

      {/* Scoring Area */}
      <div ref={scoringAreaRef} className="flex-1 p-4 md:p-6 flex flex-col gap-4 md:gap-6 overflow-y-auto">
        {/* No contestants message */}
        {contestants.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center max-w-2xl mx-auto w-full">
            <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center">
              <ClipboardList size={32} className="text-outline" />
            </div>
            <div className="text-lg font-medium text-on-surface">暂无可评分选手</div>
            <div className="text-sm text-outline">请等待管理员添加选手后再进行评分</div>
          </div>
        )}

        {/* Active contestant scoring */}
        {activeContestant && contestants.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key="scoring"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col gap-4 md:gap-6 max-w-2xl mx-auto w-full"
            >
                {/* Contestant Info */}
                <div className="bg-surface rounded-2xl border border-surface-container-high p-4 md:p-5 shadow-sm">
                  <h2 className="text-lg md:text-xl font-bold text-on-surface font-headline truncate">
                    {activeContestant.work_name || activeContestant.name}
                  </h2>
                  {activeContestant.group_name && (
                    <div className="text-sm text-outline mt-1">组别：{activeContestant.group_name}</div>
                  )}
                </div>

                  {/* 评分加载错误提示 */}
                  {loadScoreError && (
                    <div className="p-3 bg-error/10 border border-error/20 rounded-xl flex items-center gap-2 text-error text-sm">
                      <AlertTriangle size={16} />
                      {loadScoreError}
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
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={currentScores[0] ?? ''}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (e.target.value === '') setCurrentScores({ 0: undefined as any });
                          else setCurrentScores({ 0: clamp(v, 0, 100) });
                        }}
                        className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface text-lg placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                        placeholder="请输入总分"
                      />
                    </div>
                  )}

                  {/* Dimension Groups with Collapsible */}
                  <div className="space-y-3">
                    {dimensions.map((dim, dimIndex) => {
                      const colorClass = DIMENSION_COLORS[dimIndex % DIMENSION_COLORS.length];
                      const progress = getDimProgress(dim);
                      const isExpanded = expandedDims[dim.id] !== false;
                      const hasAnyScore = dim.subdimensions.length > 0
                        ? dim.subdimensions.some(s => currentScores[s.id] !== undefined)
                        : currentScores[dim.id] !== undefined;
                      const hasOverScore = dim.subdimensions.length > 0
                        ? dim.subdimensions.some(s => {
                            const v = currentScores[s.id];
                            return v !== undefined && v > s.max_score;
                          })
                        : (currentScores[dim.id] !== undefined && currentScores[dim.id] > dim.max_score);

                      return (
                        <div
                          key={dim.id}
                          className={`bg-surface rounded-2xl border border-surface-container-high border-l-4 ${colorClass} overflow-hidden`}
                        >
                          {/* Dimension Header */}
                          <button
                            onClick={() => toggleDimension(dim.id)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-container-low/50 transition-colors focus-ring"
                          >
                            <div className="flex items-center gap-3">
                              <ChevronDown
                                size={18}
                                className={`text-on-surface-variant transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                              />
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
                              {hasOverScore && (
                                <AlertTriangle size={16} className="text-error" />
                              )}
                              <div className="text-right">
                                <div className={`text-sm font-semibold ${hasOverScore ? 'text-error' : hasAnyScore ? 'text-success' : 'text-on-surface-variant'}`}>
                                  {progress.scored > 0 ? progress.scored.toFixed(1) : '—'} / {progress.total}
                                </div>
                                <div className="w-16 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress.percentage}%` }}
                                    className={`h-full rounded-full ${hasOverScore ? 'bg-error' : hasAnyScore ? 'bg-success' : 'bg-surface-container-high'}`}
                                  />
                                </div>
                              </div>
                            </div>
                          </button>

                          {/* Subdimensions (Collapsible) */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 space-y-3 border-t border-surface-container-high/50">
                                  {dim.subdimensions.length === 0 ||
                                  (dim.subdimensions.length === 1 &&
                                   dim.subdimensions[0].name === dim.name) ? (
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
                                      <input
                                        type="number"
                                        min="0"
                                        max={dim.max_score}
                                        step="0.5"
                                        value={currentScores[dim.id] !== undefined ? currentScores[dim.id] : ''}
                                        onChange={(e) => {
                                          const v = parseFloat(e.target.value);
                                          if (e.target.value === '') {
                                            const newScores = { ...currentScores };
                                            delete newScores[dim.id];
                                            setCurrentScores(newScores);
                                          } else {
                                            setCurrentScores({ ...currentScores, [dim.id]: clamp(v, 0, dim.max_score) });
                                          }
                                        }}
                                        className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface text-base placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                                        placeholder={`0 - ${dim.max_score}`}
                                      />
                                      {currentScores[dim.id] !== undefined && (
                                        <div className={`text-xs mt-1 ${currentScores[dim.id] > dim.max_score ? 'text-error' : 'text-success'}`}>
                                          {currentScores[dim.id] > dim.max_score
                                            ? `分数超出（${currentScores[dim.id]} > ${dim.max_score}）`
                                            : `当前：${currentScores[dim.id]} / ${dim.max_score}`}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    dim.subdimensions.map((sub) => {
                                      const currentVal = currentScores[sub.id];
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
                                          <input
                                            type="number"
                                            min="0"
                                            max={sub.max_score}
                                            step="0.5"
                                            value={currentVal !== undefined ? currentVal : ''}
                                            onChange={(e) => handleScoreChange(sub.id, sub.max_score, e.target.value)}
                                            className={`w-full px-4 py-3 bg-surface-container-low border rounded-xl text-on-surface text-base placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${isOver ? 'border-error' : 'border-surface-container-high'} focus-ring`}
                                            placeholder={`0 - ${sub.max_score}`}
                                          />
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
                    })}
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-4 bg-gradient-to-r from-primary to-primary/80 text-on-primary font-bold rounded-xl shadow-lg shadow-primary/25 text-lg flex items-center justify-center gap-2 disabled:opacity-50 focus-ring"
                >
                  {submitting ? '提交中...' : '提交评分'}
                  {!submitting && <ChevronRight size={20} />}
                </motion.button>

                {/* 一键提交按钮 */}
                {contestants.length > 1 && (
                  <button
                    onClick={handleSubmitAll}
                    disabled={submittingAll}
                    className="w-full py-3 bg-surface-container-high text-on-surface-variant font-medium rounded-xl border border-surface-container-high hover:bg-surface-container-low transition-colors disabled:opacity-50 focus-ring flex items-center justify-center gap-2"
                  >
                    {submittingAll ? '提交中...' : '一键提交全部'}
                  </button>
                )}
              </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Message Dialog */}
      <MessageDialog
        isOpen={messageDialog.open}
        type={messageDialog.type}
        title={messageDialog.title}
        message={messageDialog.message}
        onClose={() => setMessageDialog((p) => ({ ...p, open: false }))}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onCancel={() => setConfirmDialog((p) => ({ ...p, open: false }))}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  );
}