import { useEffect, useState } from 'react';
import { usePsychologyStore } from '../../../stores/psychologyStore';
import type { Counselor } from '../types/psychology';
import CounselorFormDialog from './CounselorFormDialog';
import SlotEditor from './SlotEditor';

export default function CounselorManagePage() {
  const counselors = usePsychologyStore((s) => s.counselors);
  const loading = usePsychologyStore((s) => s.counselorsLoading);
  const error = usePsychologyStore((s) => s.error);
  const clearError = usePsychologyStore((s) => s.clearError);
  const fetchCounselors = usePsychologyStore((s) => s.fetchCounselors);
  const createCounselor = usePsychologyStore((s) => s.createCounselor);
  const updateCounselor = usePsychologyStore((s) => s.updateCounselor);
  const toggleCounselor = usePsychologyStore((s) => s.toggleCounselor);
  const addSlot = usePsychologyStore((s) => s.addSlot);
  const deleteSlot = usePsychologyStore((s) => s.deleteSlot);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Counselor | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchCounselors(true); // admin: show all including inactive
  }, []);

  const handleSave = async (data: { user_id: number; name: string; title: string; bio: string; avatar_url: string }) => {
    if (editing) {
      await updateCounselor(editing.id, data);
    } else {
      await createCounselor(data);
    }
    await fetchCounselors(true);
  };

  const handleToggle = async (c: Counselor) => {
    await toggleCounselor(c.id);
    await fetchCounselors(true);
  };

  const handleAddSlot = async (data: { day_of_week: number; start_time: string; end_time: string }) => {
    if (expandedId === null) return;
    await addSlot(expandedId, data);
    await fetchCounselors(true);
  };

  const handleDeleteSlot = async (slotId: number) => {
    if (expandedId === null) return;
    await deleteSlot(expandedId, slotId);
    await fetchCounselors(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-on-surface font-headline">咨询师管理</h2>
        <button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="btn-primary text-sm px-4 py-2"
        >
          + 新增咨询师
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-error/10 text-error rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {counselors.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">暂无咨询师</p>
          <p className="empty-state-description">点击右上角按钮添加第一位咨询师</p>
        </div>
      ) : (
        <div className="space-y-3">
          {counselors.map((c) => (
            <div key={c.id} className="paper-card bg-surface p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-on-surface">{c.name}</h3>
                    <span className={`badge text-xs ${c.is_active ? 'badge-success' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      {c.is_active ? '在岗' : '停用'}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant mt-0.5">{c.title || '未设置职称'}</p>
                  {c.bio && <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">{c.bio}</p>}
                  <p className="text-xs text-outline mt-1">{c.slots.length} 个可用时段</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setEditing(c); setDialogOpen(true); }}
                    className="px-3 py-1.5 text-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleToggle(c)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      c.is_active
                        ? 'hover:bg-warning/10 text-warning'
                        : 'hover:bg-success/10 text-success'
                    }`}
                  >
                    {c.is_active ? '停用' : '启用'}
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="px-3 py-1.5 text-sm rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors"
                  >
                    {expandedId === c.id ? '收起时段' : '管理时段'}
                  </button>
                </div>
              </div>

              {expandedId === c.id && (
                <div className="pt-3 border-t border-outline-variant/30">
                  <SlotEditor slots={c.slots} onAdd={handleAddSlot} onDelete={handleDeleteSlot} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CounselorFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSave={handleSave}
        initial={editing ? { user_id: editing.user_id, name: editing.name, title: editing.title, bio: editing.bio, avatar_url: editing.avatar_url || '' } : undefined}
        title={editing ? '编辑咨询师' : '新增咨询师'}
      />
    </div>
  );
}
