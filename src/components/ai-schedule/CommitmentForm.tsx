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
    <div className="space-y-2.5">
      <div className="space-y-2">
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="事项名称"
          className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-xs focus-ring"
        />
        <div className="flex gap-1.5">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-xs focus-ring" />
        </div>
        <div className="flex gap-2 items-center">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-xs focus-ring" />
          <span className="text-[10px] text-outline">至</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-xs focus-ring" />
        </div>
        <div className="flex gap-1.5">
          <select value={priority} onChange={(e) => setPriority(e.target.value as Commitment['priority'])}
            className="flex-1 px-2 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-xs focus-ring">
            <option value="high">高优先</option>
            <option value="medium">中优先</option>
            <option value="low">低优先</option>
          </select>
          <button onClick={handleAdd} className="btn-primary text-xs px-3 py-1.5">添加</button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded bg-surface-container-low/80 border border-outline-variant/20">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                item.priority === 'high' ? 'bg-error' : item.priority === 'medium' ? 'bg-warning' : 'bg-outline'
              }`} />
              <span className="font-medium text-on-surface truncate">{item.name}</span>
              <button onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="ml-auto text-outline hover:text-error text-sm leading-none shrink-0">&times;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
