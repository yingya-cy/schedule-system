import { useState, useEffect } from 'react';
import { competitionApi, contestantApi, judgeApi, resultApi } from '../services/scoringApi.ts';
import type { Competition, Contestant, Judge } from '../types/scoring.ts';
import MessageDialog from '../../MessageDialog.tsx';
import ConfirmDialog from '../../ConfirmDialog.tsx';
import ImportExcelModal from './ImportExcelModal.tsx';
import { motion } from 'motion/react';
import { ArrowLeft, Calculator, RotateCcw, Trash, Users, UserCheck, BarChart3, Table } from 'lucide-react';
import ContestantsTab from './CompetitionDetail/ContestantsTab.tsx';
import JudgesTab from './CompetitionDetail/JudgesTab.tsx';
import DetailsTab from './CompetitionDetail/DetailsTab.tsx';
import ResultsTab from './CompetitionDetail/ResultsTab.tsx';

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

interface Props {
  competitionId: number;
  onBack: () => void;
}

const TABS = [
  { key: 'contestants', label: '选手', icon: Users },
  { key: 'judges', label: '评委', icon: UserCheck },
  { key: 'details', label: '明细', icon: Table },
  { key: 'results', label: '结果', icon: BarChart3 },
] as const;

export default function CompetitionDetail({ competitionId, onBack }: Props) {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [activeTab, setActiveTab] = useState<'contestants' | 'judges' | 'details' | 'results'>('contestants');
  const [loading, setLoading] = useState(true);

  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);

  const [results, setResults] = useState<ResultRow[]>([]);
  const [resultsLoaded, setResultsLoaded] = useState(false);

  // Dialogs
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'contestant' | 'judge'; id: number; name: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; type?: 'warning' | 'danger'; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [messageDialog, setMessageDialog] = useState<{ open: boolean; type: 'success' | 'error' | 'info'; title: string; message?: string }>({ open: false, type: 'info', title: '' });
  const [loadingAction, setLoadingAction] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => { loadCompetition(); }, [competitionId]);

  useEffect(() => {
    if (activeTab === 'results') {
      resultApi.get(competitionId)
        .then((data) => { setResults(data || []); setResultsLoaded(true); })
        .catch(() => { setResults([]); setResultsLoaded(true); });
    }
  }, [activeTab, competitionId]);

  useEffect(() => { setResultsLoaded(false); }, [competitionId]);

  async function loadCompetition() {
    try {
      const data = await competitionApi.get(competitionId);
      setCompetition(data);
      setContestants(data.contestants || []);
      setJudges(data.judges || []);
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(type: 'contestant' | 'judge', id: number, name: string) {
    setDeleteTarget({ type, id, name });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setLoadingAction(true);
    try {
      if (deleteTarget.type === 'contestant') {
        await contestantApi.delete(competitionId, deleteTarget.id);
        setContestants((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      } else {
        await judgeApi.delete(competitionId, deleteTarget.id);
        setJudges((prev) => prev.filter((j) => j.id !== deleteTarget.id));
      }
      setDeleteTarget(null);
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '删除失败', message: (e as Error).message });
    } finally {
      setLoadingAction(false);
    }
  }

  function handleImportTemplate(template: {
    name: string; total_score: number;
    dimensions: Array<{ name: string; max_score: number; subdimensions: Array<{ name: string; max_score: number; description: string }> }>;
  }) {
    setMessageDialog({ open: true, type: 'info', title: '模板已导入', message: `模板「${template.name}」已解析完成，请前往「评分模板」页面进行创建。` });
  }

  function handleImportContestants(contestants: { number: string; name: string; work_name?: string; group_name: string }[], compId: number) {
    if (compId !== competitionId) return;
    contestantApi.import(compId, contestants).then((result) => {
      const newContestants = contestants.map((c, i) => ({
        id: result.ids[i], ...c, competition_id: compId, created_at: new Date().toISOString(),
        description: '', extra_data: null,
      }));
      setContestants((prev) => [...prev, ...newContestants]);
      setMessageDialog({ open: true, type: 'success', title: '导入成功', message: `成功导入 ${contestants.length} 位选手` });
    }).catch(() => {
      setMessageDialog({ open: true, type: 'error', title: '导入失败', message: '保存选手数据失败' });
    });
  }

  async function handleStartScoring() {
    setLoadingAction(true);
    try {
      await competitionApi.update(competitionId, { name: competition!.name, status: 'scoring' });
      setCompetition((prev) => prev ? { ...prev, status: 'scoring' } : null);
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '操作失败', message: (e as Error).message });
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleCalculate() {
    setConfirmDialog({
      open: true, title: '计算结果', message: '确认计算最终结果？此操作将覆盖之前的计算结果。',
      onConfirm: async () => {
        setConfirmDialog((p) => ({ ...p, open: false }));
        setLoadingAction(true);
        try {
          const result = await resultApi.calculate(competitionId);
          setResults(result.results || []);
          setResultsLoaded(true);
          setActiveTab('results');
        } catch (e: unknown) {
          setMessageDialog({ open: true, type: 'error', title: '计算失败', message: (e as Error).message });
        } finally {
          setLoadingAction(false);
        }
      },
    });
  }

  async function handleReopenScoring() {
    setConfirmDialog({
      open: true, title: '重新开放评分', message: '确认重新开放评分？评委可以继续提交评分，之后需重新计算结果。',
      onConfirm: async () => {
        setConfirmDialog((p) => ({ ...p, open: false }));
        setLoadingAction(true);
        try {
          await competitionApi.update(competitionId, { name: competition!.name, status: 'scoring' });
          setCompetition((prev) => prev ? { ...prev, status: 'scoring' } : null);
          setMessageDialog({ open: true, type: 'success', title: '已重新开放', message: '评委可以继续提交评分' });
        } catch (e: unknown) {
          setMessageDialog({ open: true, type: 'error', title: '操作失败', message: (e as Error).message });
        } finally {
          setLoadingAction(false);
        }
      },
    });
  }

  async function handleClearResults() {
    setConfirmDialog({
      open: true, title: '清除结果', message: '确认清除所有评分记录和计算结果？此操作不可恢复。', type: 'danger',
      onConfirm: async () => {
        setConfirmDialog((p) => ({ ...p, open: false }));
        setLoadingAction(true);
        try {
          await resultApi.clearAll(competitionId);
          setResults([]);
          setResultsLoaded(false);
          setCompetition((prev) => prev ? { ...prev, status: 'preparing' } : null);
          setActiveTab('contestants');
          setMessageDialog({ open: true, type: 'success', title: '已清除', message: '所有评分记录和结果已清除' });
        } catch (e: unknown) {
          setMessageDialog({ open: true, type: 'error', title: '清除失败', message: (e as Error).message });
        } finally {
          setLoadingAction(false);
        }
      },
    });
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64"><div className="text-outline">加载中...</div></div>
  );

  if (!competition) return (
    <div className="flex items-center justify-center h-64"><div className="text-outline">比赛不存在</div></div>
  );

  const statusConfig: Record<string, { label: string; className: string }> = {
    preparing: { label: '准备中', className: 'bg-outline/10 text-outline' },
    scoring: { label: '评分中', className: 'bg-primary/10 text-primary' },
    completed: { label: '已结束', className: 'bg-success/10 text-success' },
    archived: { label: '已归档', className: 'bg-surface-container-high text-on-surface-variant' },
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="focus-ring p-2 rounded-xl hover:bg-surface-container-low transition-colors touch-target">
            <ArrowLeft size={20} className="text-on-surface-variant" />
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight font-headline">{competition.name}</h1>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${statusConfig[competition.status]?.className || 'bg-surface-container-high text-on-surface-variant'}`}>
              {statusConfig[competition.status]?.label || competition.status}
            </span>
          </div>
        </div>
        <div className="ml-auto flex gap-3 flex-wrap">
          {competition.status === 'preparing' && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleStartScoring} disabled={loadingAction}
              className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-on-primary font-medium rounded-xl shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 focus-ring touch-target">
              开始评分
            </motion.button>
          )}
          {competition.status === 'scoring' && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleCalculate} disabled={loadingAction}
              className="px-5 py-2.5 bg-gradient-to-r from-success to-success/80 text-on-primary font-medium rounded-xl shadow-lg shadow-success/20 flex items-center gap-2 disabled:opacity-50 focus-ring touch-target">
              <Calculator size={16} /> 计算结果
            </motion.button>
          )}
          {competition.status === 'completed' && (
            <>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleClearResults} disabled={loadingAction}
                className="px-4 py-2.5 bg-gradient-to-r from-error to-error/80 text-on-error font-medium rounded-xl shadow-lg shadow-error/20 flex items-center gap-2 disabled:opacity-50 focus-ring touch-target">
                <Trash size={16} /> 清除结果
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleReopenScoring} disabled={loadingAction}
                className="px-4 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-on-primary font-medium rounded-xl shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 focus-ring touch-target">
                <RotateCcw size={16} /> 重新开放评分
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-container-high overflow-x-auto momentum-scroll scrollbar-hide">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{ minWidth: '80px', flexShrink: 0 }}
              className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors focus-ring ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-outline hover:text-on-surface hover:border-surface-container-high'
              }`}>
              <Icon size={16} /> {tab.label}
              {tab.key === 'contestants' && ` (${contestants.length})`}
              {tab.key === 'judges' && ` (${judges.length})`}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'contestants' && (
        <ContestantsTab
          competitionId={competitionId}
          contestants={contestants}
          setContestants={setContestants}
          loading={loading}
          loadingAction={loadingAction}
          setLoadingAction={setLoadingAction}
          setMessageDialog={setMessageDialog}
          onImportExcel={() => setShowImportModal(true)}
          onDelete={handleDelete}
        />
      )}
      {activeTab === 'judges' && (
        <JudgesTab
          competitionId={competitionId}
          judges={judges}
          setJudges={setJudges}
          loading={loading}
          loadingAction={loadingAction}
          setLoadingAction={setLoadingAction}
          setMessageDialog={setMessageDialog}
          onDelete={handleDelete}
        />
      )}
      {activeTab === 'details' && <DetailsTab competitionId={competitionId} />}
      {activeTab === 'results' && (
        <ResultsTab
          competitionId={competitionId}
          competitionName={competition?.name || ''}
          results={results}
          resultsLoaded={resultsLoaded}
          judges={judges}
          setMessageDialog={setMessageDialog}
        />
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={deleteTarget?.type === 'contestant' ? '删除选手' : '删除评委'}
        message={`确认删除「${deleteTarget?.name}」？`}
        confirmText="删除" cancelText="取消" type="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Confirm Dialog for Calculate/Clear/Reopen */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title} message={confirmDialog.message}
        confirmText="确认" cancelText="取消" type="warning"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((p) => ({ ...p, open: false }))}
      />

      {/* Message Dialog */}
      <MessageDialog
        isOpen={messageDialog.open}
        type={messageDialog.type} title={messageDialog.title} message={messageDialog.message}
        onClose={() => setMessageDialog((p) => ({ ...p, open: false }))}
      />

      {/* Excel Import Modal */}
      <ImportExcelModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        competitionId={competitionId}
        onImportTemplate={handleImportTemplate}
        onImportContestants={handleImportContestants}
        competitions={[{ id: competitionId, name: competition?.name || '' }]}
      />
    </div>
  );
}
