import { useState } from 'react';
import { judgeApi } from '../../services/scoringApi.ts';
import type { Judge } from '../../types/scoring.ts';
import { motion } from 'motion/react';
import { Plus, Trash2, X as XIcon, Wand2 } from 'lucide-react';

interface MsgState {
  open: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface Props {
  competitionId: number;
  judges: Judge[];
  setJudges: React.Dispatch<React.SetStateAction<Judge[]>>;
  loading: boolean;
  loadingAction: boolean;
  setLoadingAction: React.Dispatch<React.SetStateAction<boolean>>;
  setMessageDialog: React.Dispatch<React.SetStateAction<MsgState>>;
  onDelete: (type: 'judge', id: number, name: string) => void;
}

export default function JudgesTab({
  competitionId, judges, setJudges, loading, loadingAction,
  setLoadingAction, setMessageDialog, onDelete,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [newJudge, setNewJudge] = useState({ name: '' });
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchImportText, setBatchImportText] = useState('');

  async function handleAdd() {
    if (!newJudge.name.trim()) {
      setMessageDialog({ open: true, type: 'error', title: '添加失败', message: '请填写评委姓名' });
      return;
    }
    try {
      const result = await judgeApi.create(competitionId, { name: newJudge.name.trim() });
      setJudges((prev) => [...prev, {
        id: result.id, name: newJudge.name.trim(), competition_id: competitionId,
        is_active: 1, created_at: new Date().toISOString(),
      } as Judge]);
      setShowAdd(false);
      setNewJudge({ name: '' });
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '添加失败', message: (e as Error).message });
    }
  }

  async function handleBatchImport() {
    const lines = batchImportText.trim().split('\n').filter((l) => l.trim());
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
        id: result.ids[i], name, competition_id: competitionId,
        is_active: 1, created_at: new Date().toISOString(),
      }));
      setJudges((prev) => [...prev, ...newJudges]);
      setShowBatchImport(false);
      setBatchImportText('');
      setMessageDialog({ open: true, type: 'success', title: '导入成功', message: `成功导入 ${result.inserted} 位评委` });
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '导入失败', message: (e as Error).message });
    } finally {
      setLoadingAction(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => { setShowAdd(true); setShowBatchImport(false); }}
          className="px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-2 touch-target focus-ring"
        >
          <Plus size={16} /> 添加评委
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => { setShowBatchImport(true); setShowAdd(false); }}
          className="px-4 py-2.5 bg-surface-container-low text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container-high transition-colors flex items-center gap-2 touch-target focus-ring"
        >
          <Wand2 size={16} /> 批量导入
        </motion.button>
      </div>

      {showAdd && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-2xl border border-surface-container-high p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-on-surface font-headline">添加评委</h4>
            <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-surface-container-low rounded-lg transition-colors focus-ring touch-target">
              <XIcon size={18} className="text-outline" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface-variant">评委姓名 *</label>
              <input value={newJudge.name} onChange={(e) => setNewJudge((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                placeholder="评委姓名" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleAdd}
              className="px-5 py-2.5 bg-gradient-to-r from-success to-success/80 text-on-primary font-medium rounded-xl focus-ring touch-target">
              添加
            </motion.button>
            <button onClick={() => setShowAdd(false)}
              className="px-5 py-2.5 bg-surface border border-surface-container-high text-on-surface rounded-xl hover:bg-surface-container-low transition-colors focus-ring touch-target">
              取消
            </button>
          </div>
        </motion.div>
      )}

      {showBatchImport && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-2xl border border-surface-container-high p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-on-surface font-headline">批量导入评委</h4>
            <button onClick={() => { setShowBatchImport(false); setBatchImportText(''); }} className="p-1.5 hover:bg-surface-container-low rounded-lg transition-colors focus-ring">
              <XIcon size={18} className="text-outline" />
            </button>
          </div>
          <div className="text-sm text-outline">每行一个评委姓名</div>
          <textarea value={batchImportText} onChange={(e) => setBatchImportText(e.target.value)}
            className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono text-sm focus-ring"
            placeholder={"张三\n李四\n王五"} rows={4} />
          <div className="flex gap-3 pt-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleBatchImport} disabled={loadingAction}
              className="px-5 py-2.5 bg-gradient-to-r from-success to-success/80 text-on-primary font-medium rounded-xl disabled:opacity-50 focus-ring touch-target">
              导入
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => { setShowBatchImport(false); setBatchImportText(''); }}
              className="px-5 py-2.5 bg-surface-container-low text-on-surface-variant rounded-xl focus-ring touch-target">
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
                <tr><td colSpan={4} className="px-4 py-12 text-center text-outline">暂无评委</td></tr>
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
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => onDelete('judge', j.id, j.name)}
                        className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors focus-ring">
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
  );
}
