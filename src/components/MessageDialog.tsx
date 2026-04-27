import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageDialogProps {
  isOpen: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  onClose: () => void;
}

export default function MessageDialog({
  isOpen,
  type,
  title,
  message,
  onClose
}: MessageDialogProps) {
  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-500',
      buttonColor: 'bg-green-500 hover:bg-green-600'
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-100',
      iconColor: 'text-red-500',
      buttonColor: 'bg-red-500 hover:bg-red-600'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-500',
      buttonColor: 'bg-blue-500 hover:bg-blue-600'
    }
  };

  const { icon: Icon, bgColor, iconColor, buttonColor } = config[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
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
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", bgColor)}>
                  <Icon size={24} className={iconColor} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-on-surface font-headline">{title}</h3>
                  {message && <p className="text-sm text-on-surface-variant mt-2">{message}</p>}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-surface-container-high bg-surface-container-low/30 flex justify-end">
              <button
                onClick={onClose}
                className={cn("px-5 py-2.5 text-white font-semibold rounded-xl shadow-lg transition-all focus-ring", buttonColor)}
              >
                确定
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
