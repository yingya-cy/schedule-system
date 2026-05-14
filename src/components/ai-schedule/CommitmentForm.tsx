import { useState } from 'react';

export interface Commitment {
  name: string;
  date: string;
  start: string;
  end: string;
  priority: 'high' | 'medium' | 'low';
}

interface Props {
  items: Commitment[];
  onChange: (items: Commitment[]) => void;
}

export default function CommitmentForm({ items, onChange }: Props) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('14:00');
  const [end, setEnd] = useState('16:00');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');

  const handleAdd = () => {
    if (!name.trim() || !date) return;
    onChange([...items, { name: name.trim(), date, start, end, priority }]);
    setName('');
    setDate('');
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-on-surface text-sm">添加事项</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="事项名称，如：期末考试"
          className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring"
        />
        <div className="flex gap-1 items-center">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
            className="flex-1 px-2 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring" />
          <span className="text-xs text-outline">-</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
            className="flex-1 px-2 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring" />
        </div>
        <div className="flex gap-1">
          <select value={priority} onChange={(e) => setPriority(e.target.value as Commitment['priority'])}
            className="flex-1 px-2 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring">
            <option value="high">高优先</option>
            <option value="medium">中优先</option>
            <option value="low">低优先</option>
          </select>
          <button onClick={handleAdd} className="btn-primary text-sm px-4 py-2 shrink-0">添加</button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-surface-container-low">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                item.priority === 'high' ? 'bg-error' : item.priority === 'medium' ? 'bg-warning' : 'bg-outline'
              }`} />
              <span className="font-medium text-on-surface">{item.name}</span>
              <span className="text-on-surface-variant">{item.date} {item.start}-{item.end}</span>
              <button onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="ml-auto text-outline hover:text-error text-lg">&times;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
