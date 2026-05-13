import { useEffect, useState } from 'react';
import { usePsychologyStore } from '../../../stores/psychologyStore';
import type { AppointmentStatus } from '../types/psychology';

const STATUS_OPTIONS: { key: AppointmentStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待确认' },
  { key: 'confirmed', label: '已确认' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  completed: '已完成',
  cancelled: '已取消',
};

export default function AdminAppointmentsPage() {
  const appointments = usePsychologyStore((s) => s.allAppointments);
  const loading = usePsychologyStore((s) => s.appointmentsLoading);
  const fetchAllAppointments = usePsychologyStore((s) => s.fetchAllAppointments);
  const cancelAppointment = usePsychologyStore((s) => s.cancelAppointment);
  const error = usePsychologyStore((s) => s.error);

  const [status, setStatus] = useState<AppointmentStatus | 'all'>('all');

  useEffect(() => {
    fetchAllAppointments(status === 'all' ? undefined : status);
  }, [status]);

  const handleCancel = async (id: number) => {
    await cancelAppointment(id);
    await fetchAllAppointments(status === 'all' ? undefined : status);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-on-surface font-headline mb-4">预约总览</h2>

      <div className="flex gap-1 mb-4 overflow-x-auto">
        {STATUS_OPTIONS.map((o) => (
          <button
            key={o.key}
            onClick={() => setStatus(o.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              status === o.key ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-error/10 text-error rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
      ) : appointments.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">暂无预约记录</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/40 text-left">
                  <th className="py-2 px-3 font-medium text-on-surface-variant">学生</th>
                  <th className="py-2 px-3 font-medium text-on-surface-variant">咨询师</th>
                  <th className="py-2 px-3 font-medium text-on-surface-variant">日期</th>
                  <th className="py-2 px-3 font-medium text-on-surface-variant">时间</th>
                  <th className="py-2 px-3 font-medium text-on-surface-variant">状态</th>
                  <th className="py-2 px-3 font-medium text-on-surface-variant">操作</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id} className="border-b border-outline-variant/20 hover:bg-surface-container-low/50">
                    <td className="py-2 px-3">{a.student_name}</td>
                    <td className="py-2 px-3">{a.counselor_name}</td>
                    <td className="py-2 px-3">{a.slot_date}</td>
                    <td className="py-2 px-3 text-xs">{a.slot_start.slice(0, 5)}-{a.slot_end.slice(0, 5)}</td>
                    <td className="py-2 px-3">
                      <span className="badge text-xs">{STATUS_LABELS[a.status] || a.status}</span>
                    </td>
                    <td className="py-2 px-3">
                      {a.status !== 'cancelled' && a.status !== 'completed' && (
                        <button onClick={() => handleCancel(a.id)} className="text-xs text-error hover:underline">
                          取消
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {appointments.map((a) => (
              <div key={a.id} className="paper-card bg-surface p-3">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium text-sm">{a.student_name}</p>
                    <p className="text-xs text-on-surface-variant">咨询师：{a.counselor_name}</p>
                    <p className="text-xs text-on-surface-variant">{a.slot_date} {a.slot_start.slice(0, 5)}-{a.slot_end.slice(0, 5)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="badge text-xs">{STATUS_LABELS[a.status] || a.status}</span>
                    {a.status !== 'cancelled' && a.status !== 'completed' && (
                      <button onClick={() => handleCancel(a.id)} className="text-xs text-error">取消</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
