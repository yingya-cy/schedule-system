import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileSpreadsheet, Building2, Clock, FileImage, ExternalLink, Download, Eye, Trash2, MoreHorizontal } from 'lucide-react';
import { ScheduleData } from '@/types';
import { api } from '@/services/api';
import { formatRelativeTime } from './utils';

interface ScheduleItemProps {
  schedule: ScheduleData;
  onView: (schedule: ScheduleData) => void;
  onDelete: (id: number) => void;
  canDelete?: boolean;
}

export default function ScheduleItem({ schedule, onView, onDelete, canDelete }: ScheduleItemProps) {
  const [showFileMenu, setShowFileMenu] = useState(false);

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="bg-surface-container-lowest rounded-2xl border border-surface-container-high/80 shadow-sm p-5 group flex flex-col min-w-0"
    >
      <div className="flex-1 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center group-hover:from-primary/25 group-hover:to-primary/10 transition-[background] duration-200">
            <FileSpreadsheet className="text-primary" size={22} />
          </div>
          {schedule.filename && (
            <span className="badge badge-primary">
              <FileImage size={10} />
              源文件
            </span>
          )}
        </div>

        {/* Info */}
        <div className="space-y-2.5">
          <h4 className="font-semibold text-on-surface text-lg leading-tight truncate pr-2">{schedule.name}</h4>
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Building2 size={13} className="text-outline flex-shrink-0" />
            <span className="truncate">{schedule.department}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Clock size={13} className="text-outline flex-shrink-0" />
            <span>{formatRelativeTime(schedule.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-4 mt-4 border-t border-surface-container-high/60">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onView(schedule)}
          className="focus-ring min-w-0 flex-1 py-2 px-3 bg-primary text-on-primary text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
        >
          <Eye size={14} />
          <span>查看课表</span>
        </motion.button>

        {schedule.filename && (
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFileMenu(!showFileMenu)}
              className="focus-ring p-2 bg-surface-container-low text-on-surface-variant rounded-lg hover:bg-surface-container transition-colors"
              title="更多操作"
            >
              <MoreHorizontal size={14} />
            </motion.button>
            {showFileMenu && (
              <div className="absolute right-0 bottom-full mb-1 z-20">
                <div className="bg-surface border border-surface-container-high rounded-lg shadow-lg py-1 min-w-[120px]">
                  <button
                    onClick={() => { window.open(api.getScheduleFileUrl(schedule.id), '_blank'); setShowFileMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-surface-container-low flex items-center gap-2"
                  >
                    <ExternalLink size={13} />
                    查看源文件
                  </button>
                  <a
                    href={api.getScheduleFileUrl(schedule.id, true)}
                    download={schedule.filename}
                    onClick={() => setShowFileMenu(false)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-surface-container-low flex items-center gap-2"
                  >
                    <Download size={13} />
                    下载源文件
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {canDelete !== false && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onDelete(schedule.id)}
            className="focus-ring p-2 text-outline hover:text-error hover:bg-error/10 rounded-lg transition-colors flex-shrink-0"
            title="删除"
          >
            <Trash2 size={14} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}