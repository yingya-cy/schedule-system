import { useState, useEffect } from 'react';
import { competitionApi, templateApi } from '../services/scoringApi.ts';
import type { Competition, ScoringTemplate } from '../types/scoring.ts';
import MessageDialog from '../../MessageDialog.tsx';
import ConfirmDialog from '../../ConfirmDialog.tsx';
import { motion } from 'motion/react';
import { Trophy, Plus, Pencil, Trash2, ArrowLeft, X as XIcon } from 'lucide-react';

interface Props {
  onSelect: (competition: Competition) => void;
  onBack: () => void;
}

export default function CompetitionList({ onSelect, onBack }: Props) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [templates, setTemplates] = useState<ScoringTemplate[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [messageDialog, setMessageDialog] = useState<{ open: boolean; type: 'success' | 'error' | 'info'; title: string; message?: string }>({ open: false, type: 'info', title: '' });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [comps, temps] = await Promise.all([
        competitionApi.list(),
        templateApi.list(),
      ]);
      setCompetitions(comps);
      setTemplates(temps);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!name.trim() || !templateId) {
      setMessageDialog({ open: true, type: 'error', title: '创建失败', message: '请填写比赛名称并选择评分模板' });
      return;
    }
    try {
      const result = await competitionApi.create({
        name: name.trim(),
        template_id: parseInt(templateId),
      });
      const newComp = await competitionApi.get(result.id);
      setCompetitions((prev) => [newComp, ...prev]);
      setShowCreate(false);
      setName('');
      setTemplateId('');
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '创建失败', message: (e as Error).message });
    }
  }

  function handleDeleteClick(id: number) {
    const c = competitions.find((c) => c.id === id);
    if (c) {
      setDeleteTarget(id);
      setDeleteName(c.name);
    }
  }

  async function confirmDelete() {
    if (deleteTarget === null) return;
    setDeleteLoading(true);
    try {
      await competitionApi.delete(deleteTarget);
      setCompetitions((prev) => prev.filter((c) => c.id !== deleteTarget));
      setDeleteTarget(null);
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '删除失败', message: (e as Error).message });
    } finally {
      setDeleteLoading(false);
    }
  }

  const statusConfig: Record<string, { label: string; className: string }> = {
    preparing: { label: '准备中', className: 'bg-outline/10 text-outline' },
    scoring: { label: '评分中', className: 'bg-primary/10 text-primary' },
    completed: { label: '已结束', className: 'bg-success/10 text-success' },
    archived: { label: '已归档', className: 'bg-surface-container-high text-on-surface-variant' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-outline">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-surface-container-low transition-colors focus-ring touch-target"
          >
            <ArrowLeft size={20} className="text-on-surface-variant" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
            <Trophy className="text-on-primary" size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight font-headline">比赛列表</h1>
            <p className="text-sm text-outline hidden sm:block">管理比赛、选手和评委</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreate(true)}
          className="self-end sm:self-auto px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-on-primary font-semibold rounded-xl shadow-lg shadow-primary/25 flex items-center gap-2 focus-ring touch-target"
        >
          <Plus size={18} />
          <span className="whitespace-nowrap">新建比赛</span>
        </motion.button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-2xl border border-surface-container-high p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-on-surface font-headline">新建比赛</h3>
            <button
              onClick={() => setShowCreate(false)}
              className="p-1.5 hover:bg-surface-container-low rounded-lg transition-colors focus-ring"
            >
              <XIcon size={18} className="text-outline" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface-variant">比赛名称 *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                placeholder="如：心理科普短视频大赛"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface-variant">评分模板 *</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
              >
                <option value="">选择评分模板</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} (总分{t.total_score})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreate}
              className="px-5 py-2.5 bg-gradient-to-r from-success to-success/80 text-on-primary font-semibold rounded-xl shadow-lg shadow-success/25 focus-ring"
            >
              确认创建
            </motion.button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-5 py-2.5 bg-surface border border-surface-container-high text-on-surface rounded-xl hover:bg-surface-container-low transition-colors focus-ring"
            >
              取消
            </button>
          </div>
        </motion.div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {competitions.map((comp) => (
          <motion.div
            key={comp.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-2xl border border-surface-container-high p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer"
            onClick={() => onSelect(comp)}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-on-surface font-headline text-base">{comp.name}</h3>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${statusConfig[comp.status]?.className || 'bg-surface-container-high text-on-surface-variant'}`}>
                {statusConfig[comp.status]?.label || comp.status}
              </span>
            </div>
            <div className="text-sm text-outline mb-1">
              模板：{comp.template_name || '未知'}
            </div>
            <div className="text-sm text-outline mb-4">
              选手 {comp.contestant_count || 0} 人 · 评委 {comp.judge_count || 0} 人
            </div>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(comp)}
                className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-1.5 focus-ring"
              >
                <Pencil size={14} />
                进入
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleDeleteClick(comp.id)}
                className="px-4 py-2 bg-error/10 text-error rounded-lg text-sm font-medium hover:bg-error/20 transition-colors flex items-center gap-1.5 focus-ring"
              >
                <Trash2 size={14} />
                删除
              </motion.button>
            </div>
          </motion.div>
        ))}
        {competitions.length === 0 && (
          <div className="col-span-full py-16 text-center text-outline">
            暂无比赛，点击"新建比赛"开始
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="删除比赛"
        message={`确认删除比赛「${deleteName}」？所有选手和评分数据将一并删除。`}
        confirmText="删除"
        cancelText="取消"
        type="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Message Dialog */}
      <MessageDialog
        isOpen={messageDialog.open}
        type={messageDialog.type}
        title={messageDialog.title}
        message={messageDialog.message}
        onClose={() => setMessageDialog((p) => ({ ...p, open: false }))}
      />
    </div>
  );
}