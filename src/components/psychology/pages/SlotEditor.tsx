import { useState } from 'react';
import type { CounselorSlot } from '../types/psychology';

const DAY_LABELS = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function SlotEditor({
  slots,
  onAdd,
  onDelete,
}: {
  slots: CounselorSlot[];
  onAdd: (data: { day_of_week: number; start_time: string; end_time: string }) => void;
  onDelete: (slotId: number) => void;
}) {
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');

  const handleAdd = () => {
    onAdd({ day_of_week: day, start_time: `${start}:00`, end_time: `${end}:00` });
  };

  const grouped = new Map<number, CounselorSlot[]>();
  slots.forEach((s) => {
    if (!grouped.has(s.day_of_week)) grouped.set(s.day_of_week, []);
    grouped.get(s.day_of_week)!.push(s);
  });

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-on-surface">可用时段</h4>
      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
        <div key={d} className="flex items-center gap-2">
          <span className="w-10 text-sm font-medium text-on-surface-variant">{DAY_LABELS[d]}</span>
          <div className="flex-1 flex flex-wrap gap-1">
            {(grouped.get(d) || []).map((slot) => (
              <span
                key={slot.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs"
              >
                {slot.start_time.slice(0, 5)}-{slot.end_time.slice(0, 5)}
                {slot.id && (
                  <button
                    onClick={() => onDelete(slot.id!)}
                    className="ml-0.5 hover:text-error transition-colors"
                  >
                    &times;
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/30">
        <select
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className="px-2 py-1 rounded-lg border border-outline-variant bg-surface text-sm"
        >
          {DAY_LABELS.slice(1).map((label, i) => (
            <option key={i + 1} value={i + 1}>{label}</option>
          ))}
        </select>
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="px-2 py-1 rounded-lg border border-outline-variant bg-surface text-sm"
        />
        <span className="text-on-surface-variant text-sm">-</span>
        <input
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="px-2 py-1 rounded-lg border border-outline-variant bg-surface text-sm"
        />
        <button onClick={handleAdd} className="btn-primary text-xs px-3 py-1">
          添加
        </button>
      </div>
    </div>
  );
}
