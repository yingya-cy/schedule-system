import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import type { UserInfo } from '@/types/auth';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onTransitioned: () => void;
}

export default function TermTransitionModal({ isOpen, onClose, onTransitioned }: Props) {
  const token = useAuthStore((s) => s.token);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [academicYear, setAcademicYear] = useState('');
  const [semester, setSemester] = useState<'春' | '秋'>('秋');
  const [name, setName] = useState('');
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [retainIds, setRetainIds] = useState<Set<number>>(new Set());
  const [removeIds, setRemoveIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/auth/users?limit=500', { headers })
        .then(r => r.json())
        .then(json => {
          if (json.success) {
            setUsers(json.data);
            setRetainIds(new Set(json.data.map((u: UserInfo) => u.id)));
            setRemoveIds(new Set());
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  function toggleUser(id: number, action: 'retain' | 'remove') {
    const newRetain = new Set(retainIds);
    const newRemove = new Set(removeIds);
    if (action === 'retain') {
      newRetain.add(id);
      newRemove.delete(id);
    } else {
      newRemove.add(id);
      newRetain.delete(id);
    }
    setRetainIds(newRetain);
    setRemoveIds(newRemove);
  }

  async function handleTransition() {
    if (!academicYear) { setError('请输入学年'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/terms/transition', {
        method: 'POST', headers,
        body: JSON.stringify({
          academic_year: academicYear,
          semester,
          name: name || undefined,
          retain_user_ids: Array.from(retainIds),
          remove_user_ids: Array.from(removeIds),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onTransitioned();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-surface rounded-2xl border border-surface-container-high shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-on-surface font-headline">换届操作</h3>
                <button onClick={onClose} className="p-1 hover:bg-surface-container-low rounded-lg">
                  <X size={20} className="text-outline" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">学年 *</label>
                    <input
                      type="text"
                      value={academicYear}
                      onChange={e => setAcademicYear(e.target.value)}
                      placeholder="如 2025-2026"
                      className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">学期</label>
                    <select
                      value={semester}
                      onChange={e => setSemester(e.target.value as '春' | '秋')}
                      className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                      <option value="秋">秋</option>
                      <option value="春">春</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">届名（可选）</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="留空则自动生成：2025秋·第2届"
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-2">人员安排</label>
                  <div className="text-xs text-outline mb-2">
                    留任 {retainIds.size} 人 · 离任 {removeIds.size} 人
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-surface-container-high rounded-lg p-2">
                    {users.map((u: UserInfo) => {
                      const isRetain = retainIds.has(u.id);
                      const isRemove = removeIds.has(u.id);
                      return (
                        <div key={u.id} className="flex items-center justify-between py-1 px-2 rounded text-sm hover:bg-surface-container-lowest">
                          <span>
                            <span className="font-medium text-on-surface">{u.name}</span>
                            <span className="text-outline ml-2">{u.username}</span>
                            <span className="text-outline ml-1">· {u.department || '-'}</span>
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => toggleUser(u.id, 'retain')}
                              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${isRetain ? 'bg-emerald-100 text-emerald-700 font-medium' : 'bg-surface-container-low text-outline'}`}
                            >
                              留任
                            </button>
                            <button
                              onClick={() => toggleUser(u.id, 'remove')}
                              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${isRemove ? 'bg-red-100 text-red-600 font-medium' : 'bg-surface-container-low text-outline'}`}
                            >
                              离任
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{error}</p>
                )}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTransition}
                  disabled={loading}
                  className="w-full py-2.5 text-sm font-bold text-on-primary bg-primary rounded-xl shadow-lg shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  {loading ? '执行中...' : '执行换届'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
