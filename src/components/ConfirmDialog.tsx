import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'warning' | 'danger';
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  type = 'warning'
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-surface-container-lowest rounded-2xl shadow-xl max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                  type === 'danger' ? "bg-red-100" : "bg-amber-100"
                )}>
                  <AlertTriangle
                    size={24}
                    className={type === 'danger' ? "text-red-500" : "text-amber-500"}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-on-surface font-headline">{title}</h3>
                  <p className="text-sm text-on-surface-variant mt-2">{message}</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-surface-container-high bg-surface-container-low/30 flex justify-end gap-3">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 bg-surface-container-low text-on-surface-variant font-medium rounded-xl hover:bg-surface-container transition-all"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={cn(
                  "px-5 py-2.5 font-semibold rounded-xl shadow-lg transition-all flex items-center gap-2",
                  type === 'danger'
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
                    : "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20"
                )}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}