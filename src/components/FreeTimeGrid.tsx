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
            第{week}周 · {WEEKDAYS[day - 1]} · {timeSlotLabel} 空闲名单
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">
            {department ? `${department} · ` : '全部部门 · '}
            共 {people.length} 人空闲
          </p>
        </div>
        {loading && (
          <div className="animate-spin text-primary">...</div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {people.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant">
            <Users className="mx-auto mb-4 text-outline" size={48} />
            <p className="text-lg font-medium">暂无空闲人员</p>
            <p className="text-sm mt-2">该时间段没有空闲的成员</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {people.map((person, index) => (
              <motion.div
                key={`${person.name}-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                className="bg-surface-container-low rounded-xl p-4 border border-surface-container-high hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg mb-2">
                    {person.name.charAt(0)}
                  </div>
                  <p className="font-medium text-on-surface text-sm truncate w-full">{person.name}</p>
                  <p className="text-xs text-on-surface-variant truncate w-full mt-0.5">{person.department}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
