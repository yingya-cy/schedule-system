import { useState, useEffect } from 'react';

interface CounselorFormData {
  user_id: number;
  name: string;
  title: string;
  bio: string;
  avatar_url: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: CounselorFormData) => Promise<void>;
  initial?: Partial<CounselorFormData> & { id?: number };
  title: string;
}

export default function CounselorFormDialog({ open, onClose, onSave, initial, title }: Props) {
  const [userId, setUserId] = useState(initial?.user_id?.toString() || '');
  const [name, setName] = useState(initial?.name || '');
  const [cTitle, setTitle] = useState(initial?.title || '');
  const [bio, setBio] = useState(initial?.bio || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setUserId(initial?.user_id?.toString() || '');
      setName(initial?.name || '');
      setTitle(initial?.title || '');
      setBio(initial?.bio || '');
      setError('');
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userId) {
      setError('姓名和关联用户为必填项');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        user_id: parseInt(userId),
        name: name.trim(),
        title: cTitle.trim(),
        bio: bio.trim(),
        avatar_url: '',
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="paper-card bg-surface w-full max-w-md mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-on-surface font-headline">{title}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">关联用户 ID</label>
            <input
              type="number"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring"
              placeholder="输入 users 表中的用户 ID"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">姓名 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">职称</label>
            <input
              type="text"
              value={cTitle}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring"
              placeholder="如：高级心理咨询师"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">简介</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring h-24 resize-none"
              placeholder="咨询师的个人简介"
            />
          </div>
          {error && <p className="text-error text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary py-2 text-sm" disabled={saving}>
              取消
            </button>
            <button type="submit" className="flex-1 btn-primary py-2 text-sm" disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
