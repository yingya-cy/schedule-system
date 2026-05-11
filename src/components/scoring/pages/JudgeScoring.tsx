import { useState, useEffect, useRef } from 'react';
import { judgeApi, competitionApi } from '../services/scoringApi.ts';
import type { Contestant, ScoringDimension } from '../types/scoring.ts';
import MessageDialog from '../../MessageDialog.tsx';
import ConfirmDialog from '../../ConfirmDialog.tsx';
import { useSimpleToast } from '../../Toast.tsx';
import ScoringForm from './JudgeScoring/ScoringForm.tsx';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';

interface JudgeScoringProps {
  competitionId: number;
  judgeId: number;
  judgeName: string;
  onBack: () => void;
}

export default function JudgeScoring({ competitionId, judgeId, judgeName, onBack }: JudgeScoringProps) {
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [activeContestant, setActiveContestant] = useState<Contestant | null>(null);
  const [contestantScores, setContestantScores] = useState<Record<number, Record<number, number>>>({});
  const [currentScores, setCurrentScores] = useState<Record<number, number>>({});
  const [submittedIds, setSubmittedIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submittingAll, setSubmittingAll] = useState(false);
  const [error, setError] = useState('');
  const [competitionName, setCompetitionName] = useState('');

  const [dimensions, setDimensions] = useState<ScoringDimension[]>([]);
  const [expandedDims, setExpandedDims] = useState<Record<number, boolean>>({});

  const [messageDialog, setMessageDialog] = useState<{ open: boolean; type: 'success' | 'error' | 'info'; title: string; message?: string }>({ open: false, type: 'info', title: '' });
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const [switchingContestant, setSwitchingContestant] = useState(false);
  const [loadScoreError, setLoadScoreError] = useState('');
  const toast = useSimpleToast();
  const scoringAreaRef = useRef<HTMLDivElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const submitAllBtnRef = useRef<HTMLButtonElement>(null);
  const prevBtnRef = useRef<HTMLButtonElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { loadData(); }, [competitionId, judgeId]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [activeContestant?.id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitBtnRef.current?.click();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        submitAllBtnRef.current?.click();
      }
      if (e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        prevBtnRef.current?.click();
      }
      if (e.ctrlKey && e.key === 'ArrowRight') {
        e.preventDefault();
        nextBtnRef.current?.click();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function loadData() {
    try {
      const comp = await competitionApi.get(competitionId);
      setCompetitionName(comp.name);
      if (comp.template?.dimensions?.length) {
        setDimensions(comp.template.dimensions);
        const initialExpanded: Record<number, boolean> = {};
        comp.template.dimensions.forEach((d: ScoringDimension) => {
          initialExpanded[d.id] = true;
        });
        setExpandedDims(initialExpanded);
      }
      const data = await competitionApi.getJudgeContestants();
      setContestants(data);
      if (data.length > 0) {
        setActiveContestant(data[0]);
        const loaded = await loadContestantScores(data[0].id);
        setCurrentScores(loaded);
        setContestantScores({ [data[0].id]: loaded });
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  async function loadContestantScores(contestantId: number) {
    try {
      const rows = await judgeApi.getScoresByContestant(String(contestantId));
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

  async function saveCurrentScores(silent = false): Promise<boolean> {
    if (!activeContestant) return true;
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
      await judgeApi.submitScore({ contestant_id: activeContestant.id, scores: scoreList });
      setContestantScores((prev) => ({ ...prev, [activeContestant.id]: { ...currentScores } }));
      setContestants((prev) =>
        prev.map((c) => (c.id === activeContestant.id ? { ...c, scored: true } : c))
      );
      toast.success('评分已保存', undefined, 1500);
      return true;
    } catch (e: unknown) {
      if (!silent) {
        setMessageDialog({ open: true, type: 'error', title: '保存失败', message: (e as Error).message });
      }
      return false;
    }
  }

  async function switchToContestant(c: Contestant) {
    if (!activeContestant || switchingContestant) return;
    if (activeContestant.id === c.id) return;
    setSwitchingContestant(true);
    const saved = await saveCurrentScores(true);
    if (!saved) { setSwitchingContestant(false); return; }
    const loaded = await loadContestantScores(c.id);
    setContestantScores((prev) => ({ ...prev, [c.id]: { ...loaded } }));
    setActiveContestant(c);
    setCurrentScores(loaded);
    setSwitchingContestant(false);
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  function handleScoreChange(subId: number, maxScore: number, rawValue: string) {
    if (rawValue === '') {
      setCurrentScores((prev) => { const next = { ...prev }; delete next[subId]; return next; });
      return;
    }
    const num = parseFloat(rawValue);
    if (isNaN(num)) return;
    const clamped = clamp(num, 0, maxScore);
    setCurrentScores((prev) => ({ ...prev, [subId]: clamped }));
  }

  function toggleDimension(dimId: number) {
    setExpandedDims((prev) => ({ ...prev, [dimId]: !prev[dimId] }));
  }

  function goToPrevContestant() {
    if (!activeContestant || contestants.length === 0) return;
    const idx = contestants.findIndex((c) => c.id === activeContestant.id);
    if (idx > 0) switchToContestant(contestants[idx - 1]);
  }

  function goToNextContestant() {
    if (!activeContestant || contestants.length === 0) return;
    const idx = contestants.findIndex((c) => c.id === activeContestant.id);
    if (idx < contestants.length - 1) switchToContestant(contestants[idx + 1]);
  }

  function handleSubmit() {
    if (!activeContestant) return;
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

    const overMax = scoreList.filter((s) => {
      let maxScore = 0;
      for (const dim of dimensions) {
        if (dim.subdimensions.length > 0) {
          if (s.subdimension_id) {
            const sub = dim.subdimensions.find((sub) => sub.id === s.subdimension_id);
            if (sub) { maxScore = sub.max_score; break; }
          }
        } else if (s.dimension_id && dim.id === s.dimension_id) {
          maxScore = dim.max_score; break;
        }
      }
      return s.score > maxScore;
    });

    const totalInput = scoreList.reduce((sum, s) => sum + s.score, 0);
    const templateTotal = dimensions.reduce((sum, d) => sum + (parseFloat(String(d.max_score)) || 0), 0);

    if (overMax.length > 0) {
      setMessageDialog({ open: true, type: 'error', title: '分数超出范围',
        message: `有 ${overMax.length} 个评分项分数超过了满分，请修正后再提交。` });
      return;
    }
    if (totalInput > templateTotal) {
      setMessageDialog({ open: true, type: 'error', title: '总分超出限制',
        message: `当前总分 ${totalInput} 超过了模板满分 ${templateTotal}，请修正后再提交。` });
      return;
    }

    setSubmitting(true);
    judgeApi.submitScore({ contestant_id: activeContestant.id, scores: scoreList })
      .then(() => {
        setContestantScores((prev) => ({ ...prev, [activeContestant.id]: { ...currentScores } }));
        setSubmittedIds((prev) => new Set([...prev, activeContestant.id]));
        setContestants((prev) => prev.map((c) => (c.id === activeContestant.id ? { ...c, scored: true } : c)));
        setCurrentScores({});
        const hasMore = contestants.some((c) => !c.scored && c.id !== activeContestant.id);
        toast.success('提交成功', hasMore ? '即将切换到下一位选手' : '已是最后一位选手', 2000);
        setTimeout(() => {
          const currentIdx = contestants.findIndex((c) => c.id === activeContestant.id);
          const nextIdx = currentIdx + 1;
          if (nextIdx < contestants.length) switchToContestant(contestants[nextIdx]);
        }, 400);
      })
      .catch((e: unknown) => {
        setMessageDialog({ open: true, type: 'error', title: '提交失败', message: (e as Error).message });
      })
      .finally(() => { setSubmitting(false); });
  }

  function handleSubmitAll() {
    const unscored = contestants.filter((c) => !c.scored && !submittedIds.has(c.id));
    if (unscored.length > 0) {
      setConfirmDialog({
        open: true, title: '还有未评分选手',
        message: `还有 ${unscored.length} 个选手未评分，确定要一键提交吗？未评分选手将以 0 分计入。`,
        onConfirm: () => { setConfirmDialog((p) => ({ ...p, open: false })); submitAllContestants(unscored); },
      });
      return;
    }
    submitAllContestants(contestants);
  }

  async function submitAllContestants(toSubmit: Contestant[]) {
    setSubmittingAll(true);
    const templateTotal = dimensions.reduce((sum, d) => sum + (parseFloat(String(d.max_score)) || 0), 0);
    let submitted = 0;
    let skipped = 0;
    let unchanged = 0;
    for (const c of toSubmit) {
      const isCurrent = activeContestant?.id === c.id;
      const rawScores: Record<number, number> | undefined = isCurrent
        ? (Object.keys(currentScores).length > 0 ? currentScores : contestantScores[c.id])
        : contestantScores[c.id];
      if (!rawScores && c.scored) { unchanged++; continue; }
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
      const totalInput = scoreList.reduce((sum, s) => sum + s.score, 0);
      if (totalInput > templateTotal) { skipped++; continue; }
      try {
        await judgeApi.submitScore({ contestant_id: c.id, scores: scoreList });
        setContestants((prev) => prev.map((cc) => (cc.id === c.id ? { ...cc, scored: true } : cc)));
        setSubmittedIds((prev) => new Set([...prev, c.id]));
        setContestantScores((prev) => ({ ...prev, [c.id]: { ...saved } }));
        submitted++;
      } catch (e: unknown) {
        // skip failed ones
      }
    }
    setSubmittingAll(false);
    const parts: string[] = [`已提交 ${submitted} 个选手的评分`];
    if (unchanged > 0) parts.push(`${unchanged} 个选手已有评分且未修改，已保持`);
    if (skipped > 0) parts.push(`${skipped} 个选手因总分超出满分已跳过`);
    setMessageDialog({ open: true, type: 'success', title: '提交完成', message: parts.join('，') });
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

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="bg-gradient-to-r from-primary to-primary/80 text-on-primary px-6 py-4 flex justify-between items-center shadow-lg shadow-primary/20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors focus-ring">
            <ArrowLeft size={20} className="text-on-primary/80" />
          </button>
          <div>
            <div className="text-lg font-bold font-headline truncate max-w-[50vw]">{competitionName}</div>
            <div className="text-sm text-on-primary/80 mt-0.5">评委：{judgeName}</div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <div className="flex gap-2 text-[10px] text-on-primary/60">
            <span><kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px] font-mono">Ctrl+Enter</kbd> 提交</span>
            <span><kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px] font-mono">Ctrl+←/→</kbd> 切换</span>
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
          <button ref={prevBtnRef} onClick={goToPrevContestant}
            disabled={!activeContestant || contestants.findIndex((c) => c.id === activeContestant.id) === 0}
            className="p-1 rounded bg-surface-container-low hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-ring flex-shrink-0 touch-target flex items-center justify-center">
            <ChevronLeft size={14} className="text-on-surface-variant" />
          </button>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0 h-7 max-w-[calc(100vw-140px)]">
            {contestants.map((c) => (
              <button key={c.id} onClick={() => switchToContestant(c)}
                className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 h-full flex items-center justify-center ${
                  activeContestant?.id === c.id
                    ? 'bg-primary text-on-primary shadow-md'
                    : c.scored
                    ? 'bg-success/10 text-success'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}>
                {c.number || c.name}
                {c.scored && <span className="ml-0.5">✓</span>}
              </button>
            ))}
          </div>
          <button ref={nextBtnRef} onClick={goToNextContestant}
            disabled={!activeContestant || contestants.findIndex((c) => c.id === activeContestant.id) >= contestants.length - 1}
            className="p-1 rounded bg-surface-container-low hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-ring flex-shrink-0 touch-target flex items-center justify-center">
            <ChevronRight size={14} className="text-on-surface-variant" />
          </button>
        </div>
      )}

      {/* Scoring Area */}
      <div ref={scoringAreaRef} className="flex-1 p-4 md:p-6 flex flex-col gap-4 md:gap-6 overflow-y-auto">
        <ScoringForm
          contestant={activeContestant}
          contestants={contestants}
          dimensions={dimensions}
          scores={currentScores}
          onScoreChange={handleScoreChange}
          expandedDims={expandedDims}
          onToggleDim={toggleDimension}
          onSubmit={handleSubmit}
          submitting={submitting}
          onSubmitAll={handleSubmitAll}
          submittingAll={submittingAll}
          loadScoreError={loadScoreError}
        />
      </div>

      {/* Message Dialog */}
      <MessageDialog
        isOpen={messageDialog.open}
        type={messageDialog.type} title={messageDialog.title} message={messageDialog.message}
        onClose={() => setMessageDialog((p) => ({ ...p, open: false }))}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title} message={confirmDialog.message}
        onCancel={() => setConfirmDialog((p) => ({ ...p, open: false }))}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  );
}
