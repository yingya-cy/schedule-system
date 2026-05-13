import { useState } from 'react';
import { contestantApi } from '../../services/scoringApi.ts';
import type { Contestant } from '../../types/scoring.ts';
import { motion } from 'motion/react';
import { Plus, Trash2, X as XIcon, Wand2, FileSpreadsheet } from 'lucide-react';

interface MsgState {
  open: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface Props {
  competitionId: number;
  contestants: Contestant[];
  setContestants: React.Dispatch<React.SetStateAction<Contestant[]>>;
  loading: boolean;
  loadingAction: boolean;
  setLoadingAction: React.Dispatch<React.SetStateAction<boolean>>;
  setMessageDialog: React.Dispatch<React.SetStateAction<MsgState>>;
  onImportExcel: () => void;
  onDelete: (type: 'contestant', id: number, name: string) => void;
}

export default function ContestantsTab({
  competitionId, contestants, setContestants, loading, loadingAction,
  setLoadingAction, setMessageDialog, onImportExcel, onDelete,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [newContestant, setNewContestant] = useState({ number: '', name: '', group_name: '' });
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchImportText, setBatchImportText] = useState('');

  async function handleAdd() {
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
      setShowAdd(false);
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
        id: result.ids[i], ...p, competition_id: competitionId, created_at: new Date().toISOString(),
        description: '', extra_data: null,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => { setShowAdd(true); setShowBatchImport(false); }}
          className="px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-2 touch-target focus-ring"
        >
          <Plus size={16} /> 添加选手
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => { setShowBatchImport(true); setShowAdd(false); }}
          className="px-4 py-2.5 bg-surface-container-low text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container-high transition-colors flex items-center gap-2 touch-target focus-ring"
        >
          <Wand2 size={16} /> 批量导入
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={onImportExcel}
          className="px-4 py-2.5 bg-surface-container-low text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container-high transition-colors flex items-center gap-2 touch-target focus-ring"
        >
          <FileSpreadsheet size={16} /> 导入Excel
        </motion.button>
      </div>

      {showAdd && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-2xl border border-surface-container-high p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-on-surface font-headline">添加选手</h4>
            <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-surface-container-low rounded-lg transition-colors focus-ring">
              <XIcon size={18} className="text-outline" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface-variant">编号</label>
              <input value={newContestant.number} onChange={(e) => setNewContestant((p) => ({ ...p, number: e.target.value }))}
                className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                placeholder="如：01" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface-variant">姓名/名称 *</label>
              <input value={newContestant.name} onChange={(e) => setNewContestant((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                placeholder="选手姓名或团队名称" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface-variant">组别</label>
              <input value={newContestant.group_name} onChange={(e) => setNewContestant((p) => ({ ...p, group_name: e.target.value }))}
                className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
                placeholder="如：大学组" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleAdd}
              className="px-5 py-2.5 bg-success text-on-success font-semibold rounded-xl shadow-md focus-ring touch-target hover:bg-success/90 transition-colors">
              添加
            </motion.button>
            <button onClick={() => setShowAdd(false)}
              className="px-5 py-2.5 bg-surface border border-surface-container-high text-on-surface rounded-xl hover:bg-surface-container-low transition-colors focus-ring touch-target">
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
                <tr><td colSpan={4} className="px-4 py-12 text-center text-outline">暂无选手</td></tr>
              ) : (
                contestants.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-on-surface">{c.number || '-'}</td>
                    <td className="px-4 py-3 text-sm text-on-surface font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-outline">{c.group_name || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => onDelete('contestant', c.id, c.name)}
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

      {showBatchImport && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
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
          <textarea value={batchImportText} onChange={(e) => setBatchImportText(e.target.value)}
            className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono text-sm focus-ring"
            placeholder={"1,张三,A组\n2,李四,B组\n3,王五"} rows={4} />
          <div className="flex gap-3 pt-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleBatchImport} disabled={loadingAction}
              className="px-5 py-2.5 bg-success text-on-success font-semibold rounded-xl shadow-md disabled:opacity-50 focus-ring touch-target hover:bg-success/90 transition-colors">
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
    </div>
  );
}
