import { useEffect, useState } from 'react';
import { usePsychologyStore } from '../../../stores/psychologyStore';
import type { AppointmentStatus } from '../types/psychology';

const TABS: { key: AppointmentStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待确认' },
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

const STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  completed: '已完成',
  cancelled: '已取消',
};

export default function MyAppointmentsPage() {
  const appointments = usePsychologyStore((s) => s.myAppointments);
  const loading = usePsychologyStore((s) => s.appointmentsLoading);
  const fetchMyAppointments = usePsychologyStore((s) => s.fetchMyAppointments);
  const cancelAppointment = usePsychologyStore((s) => s.cancelAppointment);
  const error = usePsychologyStore((s) => s.error);

  const [tab, setTab] = useState<AppointmentStatus | 'all'>('all');

  useEffect(() => {
    fetchMyAppointments();
  }, []);

  const filtered = tab === 'all'
    ? appointments
    : appointments.filter((a) => a.status === tab);

  const handleCancel = async (id: number) => {
    await cancelAppointment(id);
    await fetchMyAppointments();
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-on-surface font-headline mb-4">我的预约</h2>

      <div className="flex gap-1 mb-4 overflow-x-auto">
        {TABS.map((t) => (
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
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-error/10 text-error rounded-lg text-sm">{error}</div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">暂无预约记录</p>
          <p className="empty-state-description">去咨询师列表预约吧</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="paper-card bg-surface p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-on-surface">{a.counselor_name || '咨询师'}</h3>
                  <p className="text-sm text-on-surface-variant mt-0.5">
                    {a.slot_date} {a.slot_start.slice(0, 5)}-{a.slot_end.slice(0, 5)}
                  </p>
                  {a.notes && <p className="text-xs text-on-surface-variant mt-1">备注：{a.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge text-xs ${STATUS_COLORS[a.status] || ''}`}>
                    {STATUS_LABELS[a.status] || a.status}
                  </span>
                  {a.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(a.id)}
                      className="text-xs text-error hover:underline"
                    >
                      取消
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
