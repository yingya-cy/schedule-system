import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WEEKDAYS } from '@/types';

interface DaySelectorProps {
  selectedDay: number;
  onDayChange: (day: number) => void;
  minDay?: number;
  maxDay?: number;
}

export default function DaySelector({
  selectedDay,
  onDayChange,
  minDay = 1,
  maxDay = 7
}: DaySelectorProps) {
  return (
    <div className="space-y-3">
      {/* Day navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => onDayChange(Math.max(minDay, selectedDay - 1))}
          disabled={selectedDay <= minDay}
          className="p-2 bg-surface-container-low rounded-lg hover:bg-surface-container disabled:opacity-30 transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 text-center">
          <span className="text-2xl lg:text-3xl font-black text-primary font-headline">{WEEKDAYS[selectedDay - 1]}</span>
        </div>
        <button
          onClick={() => onDayChange(Math.min(maxDay, selectedDay + 1))}
          disabled={selectedDay >= maxDay}
          className="p-2 bg-surface-container-low rounded-lg hover:bg-surface-container disabled:opacity-30 transition-all"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day, index) => {
          const dayNum = index + 1;
          return (
            <button
              key={day}
              onClick={() => onDayChange(dayNum)}
              className={cn(
                "py-2 text-xs font-medium rounded transition-all",
                selectedDay === dayNum
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
              )}
            >
              {day.replace('周', '')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
