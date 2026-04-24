import React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIME_SLOTS, TimeSlot } from '@/types';

interface TimeSlotSelectorProps {
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  timeSlots?: TimeSlot[];
  useCustomRange?: boolean;
  onToggleCustomRange?: () => void;
  customStartSection?: number;
  customEndSection?: number;
  onCustomStartChange?: (section: number) => void;
  onCustomEndChange?: (section: number) => void;
}

export default function TimeSlotSelector({
  selectedIndex,
  onIndexChange,
  timeSlots = TIME_SLOTS,
  useCustomRange = false,
  onToggleCustomRange,
  customStartSection = 1,
  customEndSection = 2,
  onCustomStartChange,
  onCustomEndChange
}: TimeSlotSelectorProps) {
  return (
    <div className="space-y-3">
      {/* Time slot list */}
      <div className="space-y-2">
        {timeSlots.map((slot, index) => (
          <button
            key={slot.label}
            onClick={() => onIndexChange(index)}
            className={cn(
              "w-full px-4 py-3 rounded-xl text-left transition-all flex items-center justify-between",
              selectedIndex === index && !useCustomRange
                ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            )}
          >
            <div>
              <span className="font-medium">{slot.label}</span>
              <span className={cn(
                "text-xs ml-2",
                selectedIndex === index && !useCustomRange ? "text-on-primary/80" : "text-outline"
              )}>
                {slot.period}
              </span>
            </div>
            <Clock size={16} className={cn(
              selectedIndex === index && !useCustomRange ? "text-on-primary/80" : "text-outline"
            )} />
          </button>
        ))}
      </div>

      {/* Custom range toggle */}
      {onToggleCustomRange && (
        <button
          onClick={onToggleCustomRange}
          className={cn(
            "w-full text-xs font-medium px-3 py-2 rounded-full transition-all",
            useCustomRange
              ? "bg-primary text-on-primary"
              : "bg-surface-container-low text-on-surface-variant"
          )}
        >
          {useCustomRange ? '使用预设' : '自定义范围'}
        </button>
      )}

      {/* Custom range inputs */}
      {useCustomRange && onCustomStartChange && onCustomEndChange && (
        <div className="space-y-3 p-4 bg-surface-container-low rounded-xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-on-surface-variant mb-2">开始节次</label>
              <select
                value={customStartSection}
                onChange={(e) => onCustomStartChange(parseInt(e.target.value))}
                className="w-full px-4 py-2.5 bg-surface-container-lowest border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary outline-none"
              >
                {Array.from({ length: 11 }, (_, i) => i + 1).map(s => (
                  <option key={s} value={s}>第{s}节</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-on-surface-variant mb-2">结束节次</label>
              <select
                value={customEndSection}
                onChange={(e) => onCustomEndChange(parseInt(e.target.value))}
                className="w-full px-4 py-2.5 bg-surface-container-lowest border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary outline-none"
              >
                {Array.from({ length: 11 }, (_, i) => i + 1).map(s => (
                  <option key={s} value={s} disabled={s < customStartSection}>第{s}节</option>
                ))}
              </select>
            </div>
          </div>
          <div className="bg-primary/10 rounded-xl p-3 text-center">
            <span className="text-primary font-medium">
              第{customStartSection}-{customEndSection}节
            </span>
            <span className="text-on-surface-variant text-sm ml-2">
              ({customEndSection - customStartSection + 1}节课)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
