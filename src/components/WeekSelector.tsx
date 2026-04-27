import React from 'react';
import { motion } from 'motion/react';
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
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-center gap-4">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onWeekChange(Math.max(minWeek, currentWeek - 1))}
          disabled={currentWeek <= minWeek}
          className="focus-ring p-2.5 bg-surface-container-low rounded-xl hover:bg-surface-container-high disabled:opacity-30 transition-all"
        >
          <ChevronLeft size={20} />
        </motion.button>
        <div className="relative min-w-[80px] text-center">
          <span className="text-3xl lg:text-4xl font-black text-primary font-headline">第{currentWeek}周</span>
          {actualCurrentWeek === currentWeek && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-success rounded-full flex items-center justify-center shadow-sm">
              <Check size={12} className="text-white" />
            </div>
          )}
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onWeekChange(Math.min(maxWeek, currentWeek + 1))}
          disabled={currentWeek >= maxWeek}
          className="focus-ring p-2.5 bg-surface-container-low rounded-xl hover:bg-surface-container-high disabled:opacity-30 transition-all"
        >
          <ChevronRight size={20} />
        </motion.button>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: maxWeek - minWeek + 1 }, (_, i) => minWeek + i).map(week => (
          <button
            key={week}
            onClick={() => onWeekChange(week)}
            onContextMenu={(e) => {
              e.preventDefault();
              onSetActualWeek?.(week);
            }}
            className={cn(
              "focus-ring py-2.5 text-sm font-semibold rounded-xl transition-all relative",
              currentWeek === week
                ? "bg-primary text-on-primary shadow-sm"
                : actualCurrentWeek === week
                  ? "bg-success text-on-success shadow-sm"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:shadow-sm"
            )}
          >
            {week}
            {actualCurrentWeek === week && currentWeek !== week && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-success rounded-full ring-2 ring-white"></span>
            )}
          </button>
        ))}
      </div>

      {/* Quick jump */}
      {showQuickJump && actualCurrentWeek && (
        <div className="flex items-center justify-between text-xs text-on-surface-variant pt-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success mr-1"></span>
            当前第{actualCurrentWeek}周
          </span>
          <span className="text-outline">点击选择 · 右键设为当前</span>
          <button
            onClick={() => onWeekChange(actualCurrentWeek)}
            className="focus-ring px-3 py-1.5 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-all flex items-center gap-1.5 text-xs font-medium"
          >
            <Target size={12} />
            跳转
          </button>
        </div>
      )}
    </div>
  );
}