import React from 'react';
import { motion } from 'motion/react';
import { Users } from 'lucide-react';
import { WEEKDAYS } from '@/types';

interface FreePerson {
  name: string;
  department: string;
}

interface FreeTimeGridProps {
  people: FreePerson[];
  week: number;
  day: number;
  timeSlotLabel: string;
  department?: string;
  loading?: boolean;
}

function LoadingState() {
  return (
    <div className="p-12">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 rounded-full border-3 border-surface-container-high border-t-primary animate-spin" />
        <p className="text-on-surface-variant mt-4">加载中...</p>
      </div>
    </div>
  );
}

function EmptyState({
  week,
  day,
  timeSlotLabel
}: {
  week: number;
  day: number;
  timeSlotLabel: string;
}) {
  return (
    <div className="empty-state py-16">
      <div className="empty-state-icon">
        <Users className="text-outline" size={32} />
      </div>
      <p className="empty-state-title">暂无空闲人员</p>
      <p className="empty-state-description">
        第{week}周 · {WEEKDAYS[day - 1]} · {timeSlotLabel} 没有空闲的成员
      </p>
    </div>
  );
}

export default function FreeTimeGrid({
  people,
  week,
  day,
  timeSlotLabel,
  department,
  loading = false
}: FreeTimeGridProps) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-lg border border-surface-container-high overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-on-surface font-headline">
            第{week}周 · {WEEKDAYS[day - 1]} · {timeSlotLabel}
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">
            {department ? `${department} · ` : '全部部门 · '}
            共 {people.length} 人空闲
          </p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-primary">
            <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <span className="text-sm">加载中</span>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState />
      ) : people.length === 0 ? (
        <EmptyState week={week} day={day} timeSlotLabel={timeSlotLabel} />
      ) : (
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {people.map((person, index) => (
              <motion.div
                key={`${person.name}-${index}`}
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: index * 0.03, type: "spring", stiffness: 300, damping: 20 }}
                className="bg-surface-container-low rounded-xl p-4 border border-surface-container-high/60 hover:border-primary/30 hover:shadow-md transition-all card-hover text-center"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-primary/15 to-primary/5 rounded-full flex items-center justify-center text-primary font-bold text-lg mx-auto mb-3">
                  {person.name.charAt(0)}
                </div>
                <p className="font-semibold text-on-surface text-sm truncate">{person.name}</p>
                <p className="text-xs text-on-surface-variant truncate mt-1">{person.department}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}