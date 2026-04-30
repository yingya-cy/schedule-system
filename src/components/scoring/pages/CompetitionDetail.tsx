import { useState, useEffect } from 'react';
import { competitionApi, contestantApi, judgeApi, resultApi } from '../services/scoringApi.ts';
import type { Competition, Contestant, Judge } from '../types/scoring.ts';
import MessageDialog from '../../MessageDialog.tsx';
import ConfirmDialog from '../../ConfirmDialog.tsx';
import ImportExcelModal from './ImportExcelModal.tsx';
import ExportExcelModal from './ExportExcelModal.tsx';
import { motion } from 'motion/react';
import { ArrowLeft, Plus, Trash2, X as XIcon, Users, UserCheck, BarChart3, Calculator, RotateCcw, Trash, Wand2, Table, FileSpreadsheet, Download } from 'lucide-react';

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

  // 选手管理
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [showAddContestant, setShowAddContestant] = useState(false);
  const [newContestant, setNewContestant] = useState({ number: '', name: '', group_name: '' });
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchImportText, setBatchImportText] = useState('');

  // 评分明细
  const [detailsData, setDetailsData] = useState<{
    judges: { id: number; name: string }[];
    contestants: { id: number; number: string; name: string; work_name?: string; group_name: string }[];
    dimensionGroups: Record<number, { name: string; max: number; subs: { id: number; name: string; max: number }[] }>;
    scoreMap: Record<number, Record<number, Record<number, number>>>;
    totalScoreMap: Record<number, Record<number, number>>;
  } | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeContestantId, setActiveContestantId] = useState<number | null>(null);

  // 评委管理
  const [judges, setJudges] = useState<Judge[]>([]);
  const [showAddJudge, setShowAddJudge] = useState(false);
  const [newJudge, setNewJudge] = useState({ name: '' });
  const [showBatchImportJudge, setShowBatchImportJudge] = useState(false);
  const [batchImportJudgeText, setBatchImportJudgeText] = useState('');

  // 结果
  const [results, setResults] = useState<any[]>([]);
  const [resultsLoaded, setResultsLoaded] = useState(false);

  // Dialogs
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'contestant' | 'judge'; id: number; name: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; type?: 'warning' | 'danger'; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [messageDialog, setMessageDialog] = useState<{ open: boolean; type: 'success' | 'error' | 'info'; title: string; message?: string }>({ open: false, type: 'info', title: '' });
  const [loadingAction, setLoadingAction] = useState(false);

  // Excel Import/Export
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    loadCompetition();
  }, [competitionId]);

  // 当切换到结果标签页时，自动加载结果数据
  useEffect(() => {
    if (activeTab === 'results') {
      resultApi.get(competitionId)
        .then((data) => {
          setResults(data || []);
          setResultsLoaded(true);
        })
        .catch(() => {
          setResults([]);
          setResultsLoaded(true);
        });
    }
  }, [activeTab, competitionId]);

  // competitionId 变化时重置结果状态
  useEffect(() => {
    setResultsLoaded(false);
  }, [competitionId]);

  // 当切换到明细标签页时，自动加载评分明细
  useEffect(() => {
    if (activeTab === 'details') {
      setDetailsLoading(true);
      setActiveContestantId(null); // 重置
      competitionApi.getScoreDetails(competitionId)
        .then((data) => {
          setDetailsData(data);
          if (data.contestants.length > 0) {
            setActiveContestantId(data.contestants[0].id);
          }
        })
        .catch(() => {})
        .finally(() => setDetailsLoading(false));
    }
  }, [activeTab, competitionId]);

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

  async function handleAddContestant() {
    if (!newContestant.name.trim()) {
      setMessageDialog({ open: true, type: 'error', title: '添加失败', message: '请填写选手姓名' });
      return;
    }
    try {
      const result = await contestantApi.create(competitionId, {
        number: newContestant.number,
        name: newContestant.name.trim(),
        group_name: newContestant.group_name,
      });
      setContestants((prev) => [...prev, { id: result.id, ...newContestant, competition_id: competitionId, created_at: new Date().toISOString() } as Contestant]);
      setShowAddContestant(false);
      setNewContestant({ number: '', name: '', group_name: '' });
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '添加失败', message: (e as Error).message });
    }
  }

  async function handleBatchImport() {
    const lines = batchImportText.trim().split('\n').filter((l) => l.trim());
    if (lines.length === 0) {
      setMessageDialog({ open: true, type: 'error', title: '导入失败', message: '请输入至少一行选手数据' });
      return;
    }
    const parsed = lines.map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return { number: parts[0] || '', name: parts[1] || '', group_name: parts[2] || '' };
    }).filter((p) => p.name);
    if (parsed.length === 0) {
      setMessageDialog({ open: true, type: 'error', title: '导入失败', message: '每行格式：编号,姓名,组别（组别可省略）' });
      return;
    }
    setLoadingAction(true);
    try {
      const result = await contestantApi.import(competitionId, parsed);
      const newContestants = parsed.map((p, i) => ({
        id: result.ids[i],
        ...p,
        competition_id: competitionId,
        created_at: new Date().toISOString(),
        description: '',
        extra_data: null,
      }));
      setContestants((prev) => [...prev, ...newContestants]);
      setShowBatchImport(false);
      setBatchImportText('');
      setMessageDialog({ open: true, type: 'success', title: '导入成功', message: `成功导入 ${result.inserted} 位选手` });
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '导入失败', message: (e as Error).message });
    } finally {
      setLoadingAction(false);
    }
  }

  function handleDeleteContestantClick(id: number) {
    const c = contestants.find((c) => c.id === id);
    if (c) {
      setDeleteTarget({ type: 'contestant', id, name: c.name });
    }
  }

  async function handleAddJudge() {
    if (!newJudge.name.trim()) {
      setMessageDialog({ open: true, type: 'error', title: '添加失败', message: '请填写评委姓名' });
      return;
    }
    try {
      const result = await judgeApi.create(competitionId, {
        name: newJudge.name.trim(),
      });
      setJudges((prev) => [...prev, { id: result.id, name: newJudge.name.trim(), competition_id: competitionId, is_active: 1, created_at: new Date().toISOString() } as Judge]);
      setShowAddJudge(false);
      setNewJudge({ name: '' });
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '添加失败', message: (e as Error).message });
    }
  }

  async function handleBatchImportJudge() {
    const lines = batchImportJudgeText.trim().split('\n').filter((l) => l.trim());
    if (lines.length === 0) {
      setMessageDialog({ open: true, type: 'error', title: '导入失败', message: '请输入至少一个评委姓名' });
      return;
    }
    const names = lines.map((l) => l.trim()).filter((n) => n);
    if (names.length === 0) {
      setMessageDialog({ open: true, type: 'error', title: '导入失败', message: '每行一个姓名' });
      return;
    }
    setLoadingAction(true);
    try {
      const result = await judgeApi.import(competitionId, names);
      const newJudges = names.map((name, i) => ({
        id: result.ids[i],
        name,
        competition_id: competitionId,
        is_active: 1,
        created_at: new Date().toISOString(),
      }));
      setJudges((prev) => [...prev, ...newJudges]);
      setShowBatchImportJudge(false);
      setBatchImportJudgeText('');
      setMessageDialog({ open: true, type: 'success', title: '导入成功', message: `成功导入 ${result.inserted} 位评委` });
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '导入失败', message: (e as Error).message });
    } finally {
      setLoadingAction(false);
    }
  }

  function handleDeleteJudgeClick(id: number) {
    const j = judges.find((j) => j.id === id);
    if (j) {
      setDeleteTarget({ type: 'judge', id, name: j.name });
    }
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
    name: string;
    total_score: number;
    dimensions: Array<{
      name: string;
      max_score: number;
      subdimensions: Array<{ name: string; max_score: number; description: string }>;
    }>;
  }) {
    setMessageDialog({
      open: true,
      type: 'info',
      title: '模板已导入',
      message: `模板「${template.name}」已解析完成，请前往「评分模板」页面进行创建。`,
    });
  }

  function handleImportContestants(contestants: { number: string; name: string; work_name?: string; group_name: string }[], compId: number) {
    if (compId !== competitionId) return;
    // 调用 API 保存到数据库
    contestantApi.import(compId, contestants).then((result) => {
      const newContestants = contestants.map((c, i) => ({
        id: result.ids[i],
        ...c,
        competition_id: compId,
        created_at: new Date().toISOString(),
        description: '',
        extra_data: null,
      }));
      setContestants((prev) => [...prev, ...newContestants]);
      setMessageDialog({
        open: true,
        type: 'success',
        title: '导入成功',
        message: `成功导入 ${contestants.length} 位选手`,
      });
    }).catch(() => {
      setMessageDialog({
        open: true,
        type: 'error',
        title: '导入失败',
        message: '保存选手数据失败',
      });
    });
  }

  async function handleStartScoring() {
    setLoadingAction(true);
    try {
      await competitionApi.update(competitionId, {
        name: competition!.name,
        status: 'scoring',
      });
      setCompetition((prev) => prev ? { ...prev, status: 'scoring' } : null);
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '操作失败', message: (e as Error).message });
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleCalculate() {
    setConfirmDialog({
      open: true,
      title: '计算结果',
      message: '确认计算最终结果？此操作将覆盖之前的计算结果。',
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
      open: true,
      title: '重新开放评分',
      message: '确认重新开放评分？评委可以继续提交评分，之后需重新计算结果。',
      onConfirm: async () => {
        setConfirmDialog((p) => ({ ...p, open: false }));
        setLoadingAction(true);
        try {
          await competitionApi.update(competitionId, {
            name: competition!.name,
            status: 'scoring',
          });
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
      open: true,
      title: '清除结果',
      message: '确认清除所有评分记录和计算结果？此操作不可恢复。',
      type: 'danger',
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
    <div className="flex items-center justify-center h-64">
      <div className="text-outline">加载中...</div>
    </div>
  );

  if (!competition) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-outline">比赛不存在</div>
    </div>
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
          <button
            onClick={onBack}
            className="focus-ring p-2 rounded-xl hover:bg-surface-container-low transition-colors touch-target"
          >
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
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStartScoring}
              disabled={loadingAction}
              className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-on-primary font-medium rounded-xl shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 focus-ring touch-target"
            >
              开始评分
            </motion.button>
          )}
          {competition.status === 'scoring' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCalculate}
              disabled={loadingAction}
              className="px-5 py-2.5 bg-gradient-to-r from-success to-success/80 text-on-primary font-medium rounded-xl shadow-lg shadow-success/20 flex items-center gap-2 disabled:opacity-50 focus-ring touch-target"
            >
              <Calculator size={16} />
              计算结果
            </motion.button>
          )}
          {competition.status === 'completed' && (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleClearResults}
                disabled={loadingAction}
                className="px-4 py-2.5 bg-gradient-to-r from-error to-error/80 text-on-error font-medium rounded-xl shadow-lg shadow-error/20 flex items-center gap-2 disabled:opacity-50 focus-ring touch-target"
              >
                <Trash size={16} />
                清除结果
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReopenScoring}
                disabled={loadingAction}
                className="px-4 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-on-primary font-medium rounded-xl shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 focus-ring touch-target"
              >
                <RotateCcw size={16} />
                重新开放评分
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
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setShowAddContestant(false); setShowBatchImport(false); setShowAddJudge(false); setShowBatchImportJudge(false); }}
              style={{ minWidth: '80px', flexShrink: 0 }}
              className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors focus-ring ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-outline hover:text-on-surface hover:border-surface-container-high'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {tab.key === 'contestants' && ` (${contestants.length})`}
              {tab.key === 'judges' && ` (${judges.length})`}
            </button>
          );
        })}
      </div>

      {/* 选手管理 */}
      {activeTab === 'contestants' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-end gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setShowAddContestant(true); setShowBatchImport(false); }}
              className="px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-2 touch-target focus-ring"
            >
              <Plus size={16} />
              添加选手
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setShowBatchImport(true); setShowAddContestant(false); }}
              className="px-4 py-2.5 bg-surface-container-low text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container-high transition-colors flex items-center gap-2 touch-target focus-ring"
            >
              <Wand2 size={16} />
              批量导入
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2.5 bg-surface-container-low text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container-high transition-colors flex items-center gap-2 touch-target focus-ring"
            >
              <FileSpreadsheet size={16} />
              导入Excel
            </motion.button>
          </div>

          {showAddContestant && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface rounded-2xl border border-surface-container-high p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-on-surface font-headline">添加选手</h4>
                <button onClick={() => setShowAddContestant(false)} className="p-1.5 hover:bg-surface-container-low rounded-lg transition-colors focus-ring">
                  <XIcon size={18} className="text-outline" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">编号</label>
                  <input
                    value={newContestant.number}
                    onChange={(e) => setNewContestant((p) => ({ ...p, number: e.target.value }))}
                    className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                    placeholder="如：01"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">姓名/名称 *</label>
                  <input
                    value={newContestant.name}
                    onChange={(e) => setNewContestant((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                    placeholder="选手姓名或团队名称"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">组别</label>
                  <input
                    value={newContestant.group_name}
                    onChange={(e) => setNewContestant((p) => ({ ...p, group_name: e.target.value }))}
                    className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                    placeholder="如：大学组"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddContestant}
                  className="px-5 py-2.5 bg-gradient-to-r from-success to-success/80 text-on-primary font-medium rounded-xl focus-ring touch-target"
                >
                  添加
                </motion.button>
                <button
                  onClick={() => setShowAddContestant(false)}
                  className="px-5 py-2.5 bg-surface border border-surface-container-high text-on-surface rounded-xl hover:bg-surface-container-low transition-colors focus-ring touch-target"
                >
                  取消
                </button>
              </div>
            </motion.div>
          )}

          <div className="bg-surface rounded-2xl border border-surface-container-high overflow-hidden">
            <div className="overflow-x-auto momentum-scroll">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">编号</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">姓名/名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">组别</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          <span className="text-outline text-sm">加载中...</span>
                        </div>
                      </td>
                    </tr>
                  ) : contestants.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-outline">暂无选手</td>
                    </tr>
                  ) : (
                    contestants.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-on-surface">{c.number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-on-surface font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-sm text-outline">{c.group_name || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDeleteContestantClick(c.id)}
                            className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors focus-ring"
                          >
                            <Trash2 size={16} />
                          </motion.button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 批量导入选手 */}
      {showBatchImport && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-2xl border border-surface-container-high p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-on-surface font-headline">批量导入选手</h4>
            <button onClick={() => { setShowBatchImport(false); setBatchImportText(''); }} className="p-1.5 hover:bg-surface-container-low rounded-lg transition-colors focus-ring">
              <XIcon size={18} className="text-outline" />
            </button>
          </div>
          <div className="text-sm text-outline">
            每行格式：<span className="font-mono text-on-surface">编号,姓名,组别</span>（组别可省略，逗号用英文逗号）
          </div>
          <textarea
            value={batchImportText}
            onChange={(e) => setBatchImportText(e.target.value)}
            className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono text-sm focus-ring"
            placeholder={"1,张三,A组\n2,李四,B组\n3,王五"}
            rows={4}
          />
          <div className="flex gap-3 pt-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBatchImport}
              disabled={loadingAction}
              className="px-5 py-2.5 bg-gradient-to-r from-success to-success/80 text-on-primary font-medium rounded-xl disabled:opacity-50 focus-ring touch-target"
            >
              导入
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setShowBatchImport(false); setBatchImportText(''); }}
              className="px-5 py-2.5 bg-surface-container-low text-on-surface-variant rounded-xl focus-ring touch-target"
            >
              取消
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* 评委管理 */}
      {activeTab === 'judges' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-end gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setShowAddJudge(true); setShowBatchImportJudge(false); }}
              className="px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-2 touch-target focus-ring"
            >
              <Plus size={16} />
              添加评委
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setShowBatchImportJudge(true); setShowAddJudge(false); }}
              className="px-4 py-2.5 bg-surface-container-low text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container-high transition-colors flex items-center gap-2 touch-target focus-ring"
            >
              <Wand2 size={16} />
              批量导入
            </motion.button>
          </div>

          {showAddJudge && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface rounded-2xl border border-surface-container-high p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-on-surface font-headline">添加评委</h4>
                <button onClick={() => setShowAddJudge(false)} className="p-1.5 hover:bg-surface-container-low rounded-lg transition-colors focus-ring touch-target">
                  <XIcon size={18} className="text-outline" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">评委姓名 *</label>
                  <input
                    value={newJudge.name}
                    onChange={(e) => setNewJudge((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                    placeholder="评委姓名"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddJudge}
                  className="px-5 py-2.5 bg-gradient-to-r from-success to-success/80 text-on-primary font-medium rounded-xl focus-ring touch-target"
                >
                  添加
                </motion.button>
                <button
                  onClick={() => setShowAddJudge(false)}
                  className="px-5 py-2.5 bg-surface border border-surface-container-high text-on-surface rounded-xl hover:bg-surface-container-low transition-colors focus-ring touch-target"
                >
                  取消
                </button>
              </div>
            </motion.div>
          )}

          {showBatchImportJudge && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface rounded-2xl border border-surface-container-high p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-on-surface font-headline">批量导入评委</h4>
                <button onClick={() => { setShowBatchImportJudge(false); setBatchImportJudgeText(''); }} className="p-1.5 hover:bg-surface-container-low rounded-lg transition-colors focus-ring">
                  <XIcon size={18} className="text-outline" />
                </button>
              </div>
              <div className="text-sm text-outline">每行一个评委姓名</div>
              <textarea
                value={batchImportJudgeText}
                onChange={(e) => setBatchImportJudgeText(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono text-sm focus-ring"
                placeholder={"张三\n李四\n王五"}
                rows={4}
              />
              <div className="flex gap-3 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleBatchImportJudge}
                  disabled={loadingAction}
                  className="px-5 py-2.5 bg-gradient-to-r from-success to-success/80 text-on-primary font-medium rounded-xl disabled:opacity-50 focus-ring touch-target"
                >
                  导入
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setShowBatchImportJudge(false); setBatchImportJudgeText(''); }}
                  className="px-5 py-2.5 bg-surface-container-low text-on-surface-variant rounded-xl focus-ring touch-target"
                >
                  取消
                </motion.button>
              </div>
            </motion.div>
          )}

          <div className="bg-surface rounded-2xl border border-surface-container-high overflow-hidden">
            <div className="overflow-x-auto momentum-scroll">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">姓名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">状态</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          <span className="text-outline text-sm">加载中...</span>
                        </div>
                      </td>
                    </tr>
                  ) : judges.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-outline">暂无评委</td>
                    </tr>
                  ) : (
                    judges.map((j) => (
                      <tr key={j.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-on-surface font-medium">{j.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${j.is_active ? 'text-success' : 'text-outline'}`}>
                            {j.is_active ? '启用' : '禁用'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDeleteJudgeClick(j.id)}
                            className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors focus-ring"
                          >
                            <Trash2 size={16} />
                          </motion.button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 明细 - 方案A：选手横向Tab + 矩阵表 */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          {detailsLoading ? (
            <div className="py-16 text-center text-outline">加载中...</div>
          ) : !detailsData ? (
            <div className="py-16 text-center text-outline bg-surface rounded-2xl border border-surface-container-high">
              加载失败
            </div>
          ) : !detailsData.dimensionGroups || Object.keys(detailsData.dimensionGroups).length === 0 ? (
            <div className="py-16 text-center text-outline bg-surface rounded-2xl border border-surface-container-high">
              暂无评分数据
            </div>
          ) : !detailsData.contestants || detailsData.contestants.length === 0 ? (
            <div className="py-16 text-center text-outline bg-surface rounded-2xl border border-surface-container-high">
              暂无选手数据
            </div>
          ) : (
            <>
              {/* 选手横向Tab选择器 */}
              <div className="flex gap-2 flex-wrap">
                {detailsData.contestants.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveContestantId(c.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all focus-ring ${
                      activeContestantId === c.id
                        ? 'bg-primary text-on-primary shadow-md'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* 矩阵表：行=评委，列=维度/子维度 */}
              <div className="bg-surface rounded-2xl border border-surface-container-high overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="bg-surface-container-low">
                        <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant sticky left-0 bg-surface-container-low z-10 w-24">评委</th>
                        {Object.entries(detailsData.dimensionGroups).map(([dimId, dim]) => (
                          <th
                            key={dimId}
                            colSpan={dim.subs.length + 1}
                            className="px-3 py-2 text-center text-xs font-medium text-primary border-l border-surface-container-high min-w-[120px]"
                          >
                            {dim.name}
                            <span className="block text-xs font-normal text-on-surface-variant/normal mt-0.5">满分{dim.max}</span>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center text-xs font-medium text-on-surface-variant border-l border-surface-container-high w-20">总分</th>
                      </tr>
                      <tr className="bg-surface-container-low">
                        <th className="px-4 py-2.5 sticky left-0 bg-surface-container-low z-10"></th>
                        {Object.entries(detailsData.dimensionGroups).map(([dimId, dim]) => (
                          <th key={dimId} className="contents">
                            {dim.subs.map((sub) => (
                              <th
                                key={sub.id}
                                className="px-2 py-2 text-center text-xs text-on-surface-variant font-normal border-l border-surface-container-high/50 min-w-[60px]"
                              >
                                {sub.name}
                                <span className="block text-xs text-outline font-normal">{sub.max}分</span>
                              </th>
                            ))}
                            <th className="px-2 py-2 text-center text-xs text-on-surface-variant font-normal border-l border-surface-container-high/50">小计</th>
                          </th>
                        ))}
                        <th className="border-l border-surface-container-high"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-high">
                      {detailsData.judges.map((judge) => {
                        const contestantScores = activeContestantId != null
                          ? (detailsData.scoreMap[activeContestantId]?.[judge.id] ?? {})
                          : {};
                        // 如果没有明细分数但有总分，使用总分
                        const totalScore = activeContestantId != null
                          ? (detailsData.totalScoreMap[activeContestantId]?.[judge.id] ?? 0)
                          : 0;
                        const hasDetails = Object.keys(contestantScores).length > 0;
                        const judgeDimTotals = Object.entries(detailsData.dimensionGroups).map(([dimId, dim]) => {
                          if (dim.subs.length > 0) {
                            return dim.subs.reduce((sum, sub) => sum + (contestantScores[sub.id] ?? 0), 0);
                          } else {
                            // 无子维度时，dimId 是字符串，scoreMap 的 key 也是字符串
                            return contestantScores[dimId] ?? 0;
                          }
                        });
                        const judgeGrandTotal = hasDetails ? judgeDimTotals.reduce((a, b) => a + b, 0) : totalScore;

                        return (
                          <tr key={judge.id} className="hover:bg-surface-container-low/50">
                            <td className="px-4 py-3 text-sm font-medium text-on-surface sticky left-0 bg-surface z-10">
                              {judge.name}
                            </td>
                            {Object.entries(detailsData.dimensionGroups).map(([dimId, dim], dimIdx) => (
                              <td key={dimId} className="contents">
                                {dim.subs.length > 0 ? (
                                  <>
                                    {dim.subs.map((sub) => {
                                      const score = contestantScores[sub.id];
                                      const hasScore = score !== undefined && score > 0;
                                      return (
                                        <td
                                          key={sub.id}
                                          className={`px-2 py-3 text-center text-sm border-l border-surface-container-high/50 ${
                                            hasScore ? 'text-on-surface font-medium' : 'text-outline'
                                          }`}
                                        >
                                          {hasScore ? score.toFixed(1) : '-'}
                                        </td>
                                      );
                                    })}
                                    {/* 小计 */}
                                    <td className="px-2 py-3 text-center text-sm font-semibold text-primary border-l border-surface-container-high/50 bg-primary/5">
                                      {judgeDimTotals[dimIdx] > 0 ? judgeDimTotals[dimIdx].toFixed(1) : '-'}
                                    </td>
                                  </>
                                ) : (
                                  /* 无子维度时，直接显示维度评分（无小计列） */
                                  (() => {
                                    const score = contestantScores[dimId];
                                    const hasScore = score !== undefined && score > 0;
                                    return (
                                      <td className={`px-2 py-3 text-center text-sm border-l border-surface-container-high/50 ${
                                        hasScore ? 'text-on-surface font-medium' : 'text-outline'
                                      }`}>
                                        {hasScore ? score.toFixed(1) : '-'}
                                      </td>
                                    );
                                  })()
                                )}
                              </td>
                            ))}
                            {/* 总分 */}
                            <td className="px-4 py-3 text-center text-sm font-bold text-primary border-l border-surface-container-high bg-primary/5">
                              {judgeGrandTotal > 0 ? judgeGrandTotal.toFixed(1) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                      {detailsData.judges.length === 0 && (
                        <tr>
                          <td colSpan={20} className="px-4 py-12 text-center text-outline">暂无评委</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 结果 */}
      {activeTab === 'results' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-outline">共 {results.length} 条结果</div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-2 touch-target focus-ring"
            >
              <Download size={16} />
              导出Excel
            </motion.button>
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
                      <tr
                        key={r.rank}
                        className={`transition-colors ${r.rank <= 3 ? 'bg-primary/5' : 'hover:bg-surface-container-low/50'}`}
                      >
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
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={deleteTarget?.type === 'contestant' ? '删除选手' : '删除评委'}
        message={`确认删除「${deleteTarget?.name}」？`}
        confirmText="删除"
        cancelText="取消"
        type="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Confirm Dialog for Calculate */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="确认"
        cancelText="取消"
        type="warning"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((p) => ({ ...p, open: false }))}
      />

      {/* Message Dialog */}
      <MessageDialog
        isOpen={messageDialog.open}
        type={messageDialog.type}
        title={messageDialog.title}
        message={messageDialog.message}
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

      {/* Excel Export Modal */}
      <ExportExcelModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        currentCompetition={competition ?? undefined}
      />
    </div>
  );
}