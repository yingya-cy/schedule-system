import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { usePsychologyStore } from '../../../stores/psychologyStore';
import type { AppointmentStatus } from '../types/psychology';

const TABS: { key: AppointmentStatus; label: string }[] = [
  { key: 'pending', label: '待处理' },
  { key: 'confirmed', label: '已确认' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'badge-warning',
  confirmed: 'badge-success',
  completed: 'bg-surface-container-high text-on-surface-variant',
  cancelled: 'bg-error/10 text-error',
};

export default function WorkbenchPage() {
  const user = useAuthStore((s) => s.user);
  const counselorProfile = usePsychologyStore((s) => s.counselorProfile);
  const appointments = usePsychologyStore((s) => s.manageAppointments);
  const loading = usePsychologyStore((s) => s.appointmentsLoading);
  const fetchManageAppointments = usePsychologyStore((s) => s.fetchManageAppointments);
  const confirmAppointment = usePsychologyStore((s) => s.confirmAppointment);
  const completeAppointment = usePsychologyStore((s) => s.completeAppointment);
  const cancelAppointment = usePsychologyStore((s) => s.cancelAppointment);
  const error = usePsychologyStore((s) => s.error);

  const [tab, setTab] = useState<AppointmentStatus>('pending');
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchManageAppointments(tab);
  }, [tab]);

  if (!counselorProfile && user?.role !== 'admin') {
    return (
      <div className="empty-state">
        <p className="empty-state-title">您不是咨询师</p>
        <p className="empty-state-description">只有咨询师才能访问工作台</p>
      </div>
    );
  }

  const handleConfirm = async (id: number) => {
    await confirmAppointment(id);
    await fetchManageAppointments(tab);
  };

  const handleComplete = async (id: number) => {
    await completeAppointment(id, notes || null);
    setCompletingId(null);
    setNotes('');
    await fetchManageAppointments(tab);
  };

  const handleCancel = async (id: number) => {
    await cancelAppointment(id);
    await fetchManageAppointments(tab);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-on-surface font-headline mb-4">工作台</h2>

      <div className="flex gap-1 mb-4 overflow-x-auto">
        {TABS.map((t) => {
          const count = t.key === tab ? appointments.length : undefined;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {t.label}
              {count !== undefined && count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-on-primary/20 text-xs">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-error/10 text-error rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : appointments.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">暂无预约</p>
          <p className="empty-state-description">当前分类没有预约记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <div key={a.id} className="paper-card bg-surface p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-on-surface">{a.student_name || `学生 #${a.student_user_id}`}</h3>
                  <p className="text-sm text-on-surface-variant mt-0.5">
                    {a.slot_date} {a.slot_start.slice(0, 5)}-{a.slot_end.slice(0, 5)}
                  </p>
                  {a.notes && <p className="text-xs text-on-surface-variant mt-1">备注：{a.notes}</p>}
                </div>
                <span className={`badge text-xs ${STATUS_COLORS[a.status] || ''}`}>
                  {TABS.find((t) => t.key === a.status)?.label || a.status}
                </span>
              </div>

              <div className="flex gap-2 mt-3">
                {a.status === 'pending' && (
                  <>
                    <button onClick={() => handleConfirm(a.id)} className="btn-primary text-xs px-3 py-1 touch-target">
                      确认
                    </button>
                    <button onClick={() => handleCancel(a.id)} className="btn-secondary text-xs px-3 py-1 touch-target">
                      取消
                    </button>
                  </>
                )}
                {a.status === 'confirmed' && (
                  <>
                    {completingId === a.id ? (
                      <div className="flex-1 space-y-2">
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="咨询备注（可选）"
                          className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-sm resize-none h-16"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => handleComplete(a.id)} className="btn-primary text-xs px-3 py-1">
                            确认完成
                          </button>
                          <button onClick={() => { setCompletingId(null); setNotes(''); }} className="btn-secondary text-xs px-3 py-1">
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => setCompletingId(a.id)} className="btn-primary text-xs px-3 py-1 touch-target">
                          完成
                        </button>
                        <button onClick={() => handleCancel(a.id)} className="btn-secondary text-xs px-3 py-1 touch-target">
                          取消预约
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
