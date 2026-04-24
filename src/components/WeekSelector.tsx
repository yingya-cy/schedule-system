import React from 'react';
import { ChevronLeft, ChevronRight, Check, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeekSelectorProps {
  currentWeek: number;
  actualCurrentWeek?: number | null;
  onWeekChange: (week: number) => void;
  onSetActualWeek?: (week: number) => void;
  showQuickJump?: boolean;
  minWeek?: number;
  maxWeek?: number;
}

export default function WeekSelector({
  currentWeek,
  actualCurrentWeek,
  onWeekChange,
  onSetActualWeek,
  showQuickJump = true,
  minWeek = 1,
  maxWeek = 18
}: WeekSelectorProps) {
  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => onWeekChange(Math.max(minWeek, currentWeek - 1))}
          disabled={currentWeek <= minWeek}
          className="p-2 bg-surface-container-low rounded-lg hover:bg-surface-container disabled:opacity-30 transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="relative">
          <span className="text-2xl lg:text-3xl font-black text-primary font-headline">第{currentWeek}周</span>
          {actualCurrentWeek === currentWeek && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
              <Check size={10} className="text-white" />
            </div>
          )}
        </div>
        <button
          onClick={() => onWeekChange(Math.min(maxWeek, currentWeek + 1))}
          disabled={currentWeek >= maxWeek}
          className="p-2 bg-surface-container-low rounded-lg hover:bg-surface-container disabled:opacity-30 transition-all"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-6 gap-1">
        {Array.from({ length: maxWeek - minWeek + 1 }, (_, i) => minWeek + i).map(week => (
          <button
            key={week}
            onClick={() => onWeekChange(week)}
            onContextMenu={(e) => {
              e.preventDefault();
              onSetActualWeek?.(week);
            }}
            className={cn(
              "py-1.5 text-xs font-medium rounded transition-all relative",
              currentWeek === week
                ? "bg-primary text-on-primary"
                : actualCurrentWeek === week
                  ? "bg-green-500 text-white"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            )}
          >
            {week}
            {actualCurrentWeek === week && currentWeek !== week && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full ring-2 ring-white"></span>
            )}
          </button>
        ))}
      </div>

      {/* Quick jump */}
      {showQuickJump && actualCurrentWeek && (
        <div className="flex items-center justify-between text-xs text-on-surface-variant">
          <span>点击选择周次</span>
          <span>右键设为当前周</span>
          <button
            onClick={() => onWeekChange(actualCurrentWeek)}
            className="px-3 py-1 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-all flex items-center gap-1"
          >
            <Target size={12} />
            跳转当前第{actualCurrentWeek}周
          </button>
        </div>
      )}
    </div>
  );
}
