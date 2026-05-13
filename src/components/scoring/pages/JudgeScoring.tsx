import { useState, useEffect, useRef } from 'react';
import { judgeApi, competitionApi } from '../services/scoringApi.ts';
import type { Contestant, ScoringDimension } from '../types/scoring.ts';
import MessageDialog from '../../MessageDialog.tsx';
import ConfirmDialog from '../../ConfirmDialog.tsx';
import { useSimpleToast } from '../../Toast.tsx';
import ContestantStepper from './JudgeScoring/ContestantStepper.tsx';
import ScoringForm from './JudgeScoring/ScoringForm.tsx';
import { ArrowLeft, HelpCircle } from 'lucide-react';

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

  const [messageDialog, setMessageDialog] = useState<{ open: boolean; type: 'success' | 'error' | 'info'; title: string; message?: string }>({ open: false, type: 'info', title: '' });
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const [switchingContestant, setSwitchingContestant] = useState(false);
  const [loadScoreError, setLoadScoreError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const toast = useSimpleToast();
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const submitAllBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { loadData(); }, [competitionId, judgeId]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [activeContestant?.id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitBtnRef.current?.click(); }
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') { e.preventDefault(); submitAllBtnRef.current?.click(); }
      if (e.ctrlKey && e.key === 'ArrowLeft') { e.preventDefault(); goToPrevContestant(); }
      if (e.ctrlKey && e.key === 'ArrowRight') { e.preventDefault(); goToNextContestant(); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeContestant, contestants]);

  async function loadData() {
    try {
      const comp = await competitionApi.get(competitionId);
      setCompetitionName(comp.name);
      if (comp.template?.dimensions?.length) {
        setDimensions(comp.template.dimensions);
      }
      const data = await competitionApi.getJudgeContestants();
      setContestants(data);
      if (data.length > 0) {
        setActiveContestant(data[0]);
        const loaded = await loadContestantScores(data[0].id);
        setCurrentScores(loaded);
        setContestantScores({ [data[0].id]: loaded });
      }
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function loadContestantScores(contestantId: number) {
    try {
      const rows = await judgeApi.getScoresByContestant(String(contestantId));
      setLoadScoreError('');
      const loaded: Record<number, number> = {};
      for (const row of rows) {
        if (row.subdimension_id) loaded[Number(row.subdimension_id)] = parseFloat(String(row.score));
        else if (row.dimension_id) loaded[Number(row.dimension_id)] = parseFloat(String(row.score));
      }
      return loaded;
    } catch (e: unknown) { setLoadScoreError('加载已有评分失败'); return {}; }
  }

  async function saveCurrentScores(silent = false): Promise<boolean> {
    if (!activeContestant) return true;
    if (Object.keys(currentScores).length === 0) return true;
    const scoreList: { subdimension_id?: number; dimension_id?: number; score: number }[] = [];
    for (const dim of dimensions) {
      if (dim.subdimensions.length > 0) {
        for (const sub of dim.subdimensions) scoreList.push({ subdimension_id: sub.id, score: currentScores[sub.id] ?? 0 });
      } else {
        scoreList.push({ dimension_id: dim.id, score: currentScores[dim.id] ?? 0 });
      }
    }
    try {
      await judgeApi.submitScore({ contestant_id: activeContestant.id, scores: scoreList });
      setContestantScores((prev) => ({ ...prev, [activeContestant.id]: { ...currentScores } }));
      setContestants((prev) => prev.map((c) => (c.id === activeContestant.id ? { ...c, scored: true } : c)));
      toast.success('评分已保存', undefined, 1500);
      return true;
    } catch (e: unknown) {
      if (!silent) setMessageDialog({ open: true, type: 'error', title: '保存失败', message: (e as Error).message });
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

  function handleScoreChange(subId: number, maxScore: number, rawValue: string) {
    if (rawValue === '') {
      setCurrentScores((prev) => { const next = { ...prev }; delete next[subId]; return next; });
      return;
    }
    const num = parseFloat(rawValue);
    if (isNaN(num)) return;
    setCurrentScores((prev) => ({ ...prev, [subId]: Math.min(Math.max(num, 0), maxScore) }));
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
    const templateTotal = dimensions.reduce((sum, d) => sum + (parseFloat(String(d.max_score)) || 0), 0);
    for (const dim of dimensions) {
      if (dim.subdimensions.length > 0) {
        for (const sub of dim.subdimensions) scoreList.push({ subdimension_id: sub.id, score: currentScores[sub.id] ?? 0 });
      } else {
        scoreList.push({ dimension_id: dim.id, score: currentScores[dim.id] ?? 0 });
      }
    }
    const totalInput = scoreList.reduce((sum, s) => sum + s.score, 0);
    if (totalInput > templateTotal) {
      setMessageDialog({ open: true, type: 'error', title: '总分超出限制', message: `当前总分 ${totalInput} 超过了模板满分 ${templateTotal}` });
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
    let submitted = 0, skipped = 0, unchanged = 0;
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
          for (const sub of dim.subdimensions) scoreList.push({ subdimension_id: sub.id, score: saved[sub.id] ?? 0 });
        } else {
          scoreList.push({ dimension_id: dim.id, score: saved[dim.id] ?? 0 });
        }
      }
      if (scoreList.reduce((sum, s) => sum + s.score, 0) > templateTotal) { skipped++; continue; }
      try {
        await judgeApi.submitScore({ contestant_id: c.id, scores: scoreList });
        setContestants((prev) => prev.map((cc) => (cc.id === c.id ? { ...cc, scored: true } : cc)));
        setSubmittedIds((prev) => new Set([...prev, c.id]));
        setContestantScores((prev) => ({ ...prev, [c.id]: { ...saved } }));
        submitted++;
      } catch (e: unknown) { /* skip */ }
    }
    setSubmittingAll(false);
    const parts: string[] = [`已提交 ${submitted} 个选手的评分`];
    if (unchanged > 0) parts.push(`${unchanged} 个选手已有评分，已保持`);
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-b from-primary to-primary/90 shadow-lg shadow-primary/25 rounded-b-2xl">
        <div className="flex items-center justify-between px-3 py-2">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors focus-ring touch-target flex items-center justify-center">
            <ArrowLeft size={18} className="text-on-primary/80" />
          </button>
          <div className="text-center min-w-0 mx-2">
            <div className="text-sm font-bold text-on-primary truncate">{competitionName}</div>
            <div className="text-xs text-on-primary/60">{judgeName}</div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowHelp(!showHelp)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors focus-ring touch-target flex items-center justify-center">
              <HelpCircle size={16} className="text-on-primary/80" />
            </button>
          </div>
        </div>

        {/* Help tooltip */}
        {showHelp && (
          <div className="px-4 pb-3 text-xs text-on-primary/70 flex flex-wrap gap-x-4 gap-y-1">
            <span><kbd className="px-1 py-0.5 bg-white/10 rounded text-xs font-mono">Ctrl+Enter</kbd> 提交</span>
            <span><kbd className="px-1 py-0.5 bg-white/10 rounded text-xs font-mono">Ctrl+←→</kbd> 切换</span>
            <span><kbd className="px-1 py-0.5 bg-white/10 rounded text-xs font-mono">Ctrl+Shift+Enter</kbd> 全部提交</span>
          </div>
        )}

        {/* Stepper */}
        <div className="px-3 pb-2">
          <ContestantStepper
            contestants={contestants}
            activeContestant={activeContestant}
            onSelect={switchToContestant}
            onPrev={goToPrevContestant}
            onNext={goToNextContestant}
          />
        </div>
      </div>

      {/* Scoring Area */}
      <div className="flex-1 p-3 md:p-6">
        <ScoringForm
          contestant={activeContestant}
          contestants={contestants}
          dimensions={dimensions}
          scores={currentScores}
          onScoreChange={handleScoreChange}
          onSubmit={handleSubmit}
          submitting={submitting}
          onSubmitAll={handleSubmitAll}
          submittingAll={submittingAll}
          loadScoreError={loadScoreError}
        />
      </div>

      {/* Dialogs */}
      <MessageDialog
        isOpen={messageDialog.open}
        type={messageDialog.type} title={messageDialog.title} message={messageDialog.message}
        onClose={() => setMessageDialog((p) => ({ ...p, open: false }))}
      />
      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title} message={confirmDialog.message}
        onCancel={() => setConfirmDialog((p) => ({ ...p, open: false }))}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  );
}
