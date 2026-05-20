import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeekSelectorProps {
  currentWeek: number;
  onWeekChange: (week: number) => void;
  minWeek?: number;
  maxWeek?: number;
}

export default function WeekSelector({
  currentWeek,
  onWeekChange,
  minWeek = 1,
  maxWeek = 18
}: WeekSelectorProps) {
  return (
    <div className="space-y-4">
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
        <div className="min-w-[80px] text-center">
          <span className="text-3xl lg:text-4xl font-black text-primary font-headline">第{currentWeek}周</span>
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

      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: maxWeek - minWeek + 1 }, (_, i) => minWeek + i).map(week => (
          <button
            key={week}
            onClick={() => onWeekChange(week)}
            className={cn(
              "focus-ring py-2.5 text-sm font-semibold rounded-xl transition-all",
              currentWeek === week
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:shadow-sm"
            )}
          >
            {week}
          </button>
        ))}
      </div>
    </div>
  );
}