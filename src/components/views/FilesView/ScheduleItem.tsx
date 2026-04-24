import React from 'react';
import { motion } from 'motion/react';
import { FileSpreadsheet, Building2, Clock, FileImage, ExternalLink, Download, Eye, Trash2 } from 'lucide-react';
import { ScheduleData } from '@/types';
import { api } from '@/services/api';
import { formatRelativeTime } from './utils';
import { cn } from '@/lib/utils';

interface ScheduleItemProps {
  schedule: ScheduleData;
  onView: (schedule: ScheduleData) => void;
  onDelete: (id: number) => void;
}

export default function ScheduleItem({ schedule, onView, onDelete }: ScheduleItemProps) {
  return (
    <motion.div
      className="p-4 hover:bg-surface-container-low/50 transition-colors group"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="text-primary" size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-on-surface truncate">{schedule.name}</h4>
            {schedule.filename && (
              <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 text-xs font-medium rounded-full flex items-center gap-1">
                <FileImage size={10} />
                源文件
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-on-surface-variant">
            <span className="flex items-center gap-1">
              <Building2 size={12} />
              {schedule.department}
            </span>
            <span className="text-outline">·</span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatRelativeTime(schedule.created_at)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {schedule.filename && (
            <>
              <button
                onClick={() => window.open(api.getScheduleFileUrl(schedule.id), '_blank')}
                className="p-2 bg-surface-container-low text-on-surface-variant rounded-lg hover:bg-purple-500 hover:text-white transition-all"
                title="查看源文件"
              >
                <ExternalLink size={16} />
              </button>
              <a
                href={api.getScheduleFileUrl(schedule.id, true)}
                download={schedule.filename}
                className="p-2 bg-surface-container-low text-on-surface-variant rounded-lg hover:bg-primary hover:text-on-primary transition-all"
                title="下载源文件"
              >
                <Download size={16} />
              </a>
            </>
          )}
          <button
            onClick={() => onView(schedule)}
            className="px-3 py-2 bg-primary text-on-primary text-sm font-medium rounded-lg hover:bg-primary/90 transition-all flex items-center gap-1.5"
          >
            <Eye size={14} />
            查看
          </button>
          <button
            onClick={() => onDelete(schedule.id)}
            className="p-2 text-outline hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
