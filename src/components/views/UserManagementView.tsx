import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Edit3, X, Shield, Search, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import ConfirmDialog from '@/components/ConfirmDialog';
import TermTransitionModal from '@/components/TermTransitionModal';
import { useAppStore } from '@/stores/appStore';
import type { UserInfo } from '@/types/auth';

interface UserFormData {
  username: string;
  name: string;
  password: string;
  role: string;
  department: string;
  email: string;
}

const emptyForm: UserFormData = {
  username: '', name: '', password: '', role: 'teacher', department: '', email: '',
};

const roleLabels: Record<string, string> = { admin: '管理员', teacher: '教师', student: '学生', department_head: '部长' };

export default function UserManagementView() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<UserInfo | null>(null);
  const [showTransition, setShowTransition] = useState(false);

  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/users?search=${encodeURIComponent(search)}&page=${page}&limit=20`, { headers });
      const json = await res.json();
      if (json.success) {
        setUsers(json.data);
        setTotal(json.meta?.total || 0);
        setError('');
      } else {
        setError(json.error || '加载失败');
        setUsers([]);
        setTotal(0);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, [page, search]);

  function openCreate() {
    setEditingUser(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(user: UserInfo) {
    setEditingUser(user);
    setForm({ username: user.username, name: user.name, password: '', role: user.role, department: user.department || '', email: user.email || '' });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    setFormError('');
    if (!form.username.trim() || !form.name.trim()) {
      setFormError('用户名和姓名为必填项');
      return;
    }
    if (!editingUser && !form.password) {
      setFormError('请输入密码');
      return;
    }
    if (form.password && form.password.length < 6) {
      setFormError('密码长度至少6位');
      return;
    }
    setSaving(true);
    try {
      if (editingUser) {
        const body: any = { name: form.name, role: form.role, department: form.department, email: form.email };
        if (form.password) (body as any).newPassword = form.password;
        const res = await fetch(`/api/auth/users/${editingUser.id}`, { method: 'PUT', headers, body: JSON.stringify(body) });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        if (form.password) {
          await fetch(`/api/auth/users/${editingUser.id}/reset-password`, { method: 'PUT', headers, body: JSON.stringify({ newPassword: form.password }) });
        }
      } else {
        const res = await fetch('/api/auth/users', { method: 'POST', headers, body: JSON.stringify(form) });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      }
      setShowModal(false);
      fetchUsers();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/auth/users/${deleteTarget.id}`, { method: 'DELETE', headers });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setDeleteTarget(null);
      fetchUsers();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-on-surface font-headline">用户管理</h2>
          <p className="text-sm text-on-surface-variant mt-1">管理系统用户账号和权限</p>
        </div>
        <div className="flex items-center gap-2">
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setShowTransition(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-100 text-amber-700 rounded-xl font-bold text-sm hover:bg-amber-200 transition-colors"
            >
              <RefreshCw size={18} />
              换届
            </button>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm shadow-lg shadow-primary/20"
          >
          <Plus size={18} />
          创建用户
        </motion.button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline size-4" />
        <input
          className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          placeholder="搜索用户名、姓名、部门..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-surface-container-high overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container-high bg-surface-container-lowest">
                <th className="text-left px-4 py-3 text-xs font-bold text-outline uppercase tracking-wider">用户名</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-outline uppercase tracking-wider">姓名</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-outline uppercase tracking-wider">角色</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-outline uppercase tracking-wider">部门</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-outline uppercase tracking-wider">状态</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-outline uppercase tracking-wider">最后登录</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-outline uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-sm text-on-surface-variant">加载中...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-sm text-on-surface-variant">暂无用户</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-surface-container-high/50 hover:bg-surface-container-lowest/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-on-surface">{u.username}</td>
                    <td className="px-4 py-3 text-sm text-on-surface">{u.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        <Shield size={10} />
                        {roleLabels[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant">{u.department || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.is_active !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {u.is_active !== false ? '正常' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant">{u.last_login ? new Date(u.last_login).toLocaleString('zh-CN') : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 text-outline hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="编辑">
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className="p-1.5 text-outline hover:text-error hover:bg-error/5 rounded-lg transition-colors"
                          title={u.id === currentUser?.id ? '不能删除自己' : '删除'}
                          disabled={u.id === currentUser?.id}
                        >
                          <Trash2 size={14} className={u.id === currentUser?.id ? 'opacity-30' : ''} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-surface-container-high hover:bg-surface-container-low disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-sm text-on-surface-variant">第 {page} 页 / 共 {Math.ceil(total / 20)} 页</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-3 py-1.5 text-sm rounded-lg border border-surface-container-high hover:bg-surface-container-low disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-surface rounded-2xl border border-surface-container-high shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-on-surface font-headline">
                    {editingUser ? '编辑用户' : '创建用户'}
                  </h3>
                  <button onClick={() => setShowModal(false)} className="p-1 hover:bg-surface-container-low rounded-lg">
                    <X size={20} className="text-outline" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">用户名 *</label>
                      <input
                        type="text"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        disabled={!!editingUser}
                        className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">姓名 *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      密码 {!editingUser && '*'}
                      {editingUser && <span className="text-outline font-normal">（留空不修改）</span>}
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder={editingUser ? '留空则不修改密码' : '至少6位'}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">角色</label>
                      <select
                        value={form.role}
                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      >
                        <option value="teacher">教师</option>
                        <option value="admin">管理员</option>
                        <option value="student">学生</option>
                        <option value="department_head">部长</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">部门</label>
                      <input
                        type="text"
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">邮箱</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>

                  {formError && (
                    <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{formError}</p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowModal(false)}
                      className="flex-1 py-2.5 text-sm font-medium text-on-surface-variant bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors"
                    >
                      取消
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 py-2.5 text-sm font-bold text-on-primary bg-primary rounded-xl shadow-lg shadow-primary/20 disabled:opacity-60"
                    >
                      {saving ? '保存中...' : editingUser ? '保存更改' : '创建'}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <TermTransitionModal
        isOpen={showTransition}
        onClose={() => setShowTransition(false)}
        onTransitioned={() => {
          useAppStore.getState().refreshTerms();
          fetchUsers();
        }}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除用户"
        message={`确定要删除用户「${deleteTarget?.name}」（${deleteTarget?.username}）吗？此操作不可撤销。`}
        confirmText="删除"
        type="danger"
      />
    </div>
  );
}
