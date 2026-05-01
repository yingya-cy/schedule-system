import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'> & { duration?: number }) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'> & { duration?: number }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...toast, id }]);

    const timeout = toast.duration ?? 4000;
    setTimeout(() => {
      removeToast(id);
    }, timeout);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// Toast container component
function ToastContainer({
  toasts,
  removeToast
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Individual toast
function ToastItem({
  toast,
  onClose
}: {
  toast: Toast;
  onClose: () => void;
}) {
  const icons = {
    success: <CheckCircle className="text-success" size={22} />,
    error: <XCircle className="text-error" size={22} />,
    info: <AlertCircle className="text-primary" size={22} />
  };

  const colors = {
    success: 'border-success/30 bg-success/5',
    error: 'border-error/30 bg-error/5',
    info: 'border-primary/30 bg-primary/5'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm shadow-lg ${colors[toast.type]}`}
      style={{ minWidth: 300, maxWidth: 400 }}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-on-surface text-sm">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-on-surface-variant mt-1">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="p-1 hover:bg-surface-container-low rounded-lg transition-colors"
      >
        <X size={16} className="text-outline" />
      </button>
    </motion.div>
  );
}

// Hook for simple toast usage
export function useSimpleToast() {
  const { addToast } = useToast();

  return {
    success: (title: string, message?: string, duration?: number) => addToast({ type: 'success', title, message, duration }),
    error: (title: string, message?: string, duration?: number) => addToast({ type: 'error', title, message, duration }),
    info: (title: string, message?: string, duration?: number) => addToast({ type: 'info', title, message, duration })
  };
}