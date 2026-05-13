import { useState, useRef, useEffect } from 'react';
import type { Contestant } from '../../types/scoring.ts';
import { ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';

interface Props {
  contestants: Contestant[];
  activeContestant: Contestant | null;
  onSelect: (c: Contestant) => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function ContestantStepper({ contestants, activeContestant, onSelect, onPrev, onNext }: Props) {
  const [showList, setShowList] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (listRef.current && !listRef.current.contains(e.target as Node)) setShowList(false);
    }
    if (showList) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showList]);

  if (!activeContestant || contestants.length === 0) return null;

  const idx = contestants.findIndex((c) => c.id === activeContestant.id);
  const total = contestants.length;
  const unscored = contestants.filter((c) => !c.scored).length;

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Prev */}
      <button onClick={onPrev} disabled={idx <= 0}
        className="flex-shrink-0 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-20 disabled:cursor-not-allowed transition-colors focus-ring flex items-center justify-center"
        aria-label="上一个选手">
        <ChevronLeft size={16} className="text-on-primary" />
      </button>

      {/* Center: progress + name */}
      <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 text-on-primary">
        <span className="text-sm font-bold tabular-nums">{idx + 1}/{total}</span>
        <span className="text-sm truncate opacity-90">{activeContestant.name}</span>
        {activeContestant.scored && <Check size={14} className="flex-shrink-0 text-green-300" />}
      </div>

      {/* Next */}
      <button onClick={onNext} disabled={idx >= total - 1}
        className="flex-shrink-0 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-20 disabled:cursor-not-allowed transition-colors focus-ring flex items-center justify-center"
        aria-label="下一个选手">
        <ChevronRight size={16} className="text-on-primary" />
      </button>

      {/* Dropdown */}
      <div className="relative" ref={listRef}>
        <button onClick={() => setShowList(!showList)}
          className="flex-shrink-0 h-9 px-2.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors focus-ring flex items-center gap-1 text-on-primary text-sm"
          aria-label="选手列表">
          <ChevronDown size={14} className={`transition-transform ${showList ? 'rotate-180' : ''}`} />
          {unscored > 0 && <span className="text-xs font-bold tabular-nums">{unscored}</span>}
        </button>

        {showList && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowList(false)} />
            <div className="absolute right-0 top-full mt-1 z-40 bg-surface rounded-xl border border-outline-variant shadow-lg py-1 w-48 max-h-60 overflow-y-auto">
              {contestants.map((c) => {
                const isActive = c.id === activeContestant.id;
                return (
                  <button key={c.id}
                    onClick={() => { onSelect(c); setShowList(false); }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                      isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-on-surface hover:bg-surface-container-low'
                    }`}>
                    <span className="w-8 text-xs text-on-surface-variant tabular-nums">
                      {contestants.findIndex((x) => x.id === c.id) + 1}
                    </span>
                    <span className="flex-1 truncate">{c.name}</span>
                    {c.scored && <Check size={14} className="text-success flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
