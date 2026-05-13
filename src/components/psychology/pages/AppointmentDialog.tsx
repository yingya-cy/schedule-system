import { useState } from 'react';
import { usePsychologyStore } from '../../../stores/psychologyStore';
import type { Counselor } from '../types/psychology';

interface Props {
  counselor: Counselor;
  slot: { start: string; end: string; day: number };
  onClose: () => void;
  onSuccess: () => void;
}

export default function AppointmentDialog({ counselor, slot, onClose, onSuccess }: Props) {
  const createAppointment = usePsychologyStore((s) => s.createAppointment);
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!date) { setError('请选择日期'); return; }
    setSaving(true);
    setError('');
    try {
      await createAppointment({
        counselor_id: counselor.id,
        slot_date: date,
        slot_start: slot.start,
        slot_end: slot.end,
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : '预约失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="paper-card bg-surface w-full max-w-sm mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-on-surface font-headline">确认预约</h3>
        <div className="text-sm space-y-1 text-on-surface-variant">
          <p>咨询师：<span className="text-on-surface font-medium">{counselor.name}</span></p>
          <p>时段：{slot.start.slice(0, 5)} - {slot.end.slice(0, 5)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-1">选择日期</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring"
            min={new Date().toISOString().slice(0, 10)}
          />
        </div>
        {error && <p className="text-error text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 btn-secondary py-2 text-sm">取消</button>
          <button onClick={handleSubmit} className="flex-1 btn-primary py-2 text-sm" disabled={saving}>
            {saving ? '预约中...' : '确认预约'}
          </button>
        </div>
      </div>
    </div>
  );
}
