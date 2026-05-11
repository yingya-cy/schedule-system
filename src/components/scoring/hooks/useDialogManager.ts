import { useState, useCallback } from 'react';

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  type?: 'warning' | 'danger';
  onConfirm: () => void;
}

interface MessageDialogState {
  open: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

export function useDialogManager() {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false, title: '', message: '', onConfirm: () => {},
  });
  const [messageDialog, setMessageDialog] = useState<MessageDialogState>({
    open: false, type: 'info', title: '',
  });

  const showError = useCallback((title: string, message?: string) => {
    setMessageDialog({ open: true, type: 'error', title, message });
  }, []);

  const showSuccess = useCallback((title: string, message?: string) => {
    setMessageDialog({ open: true, type: 'success', title, message });
  }, []);

  const showInfo = useCallback((title: string, message?: string) => {
    setMessageDialog({ open: true, type: 'info', title, message });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, type?: 'warning' | 'danger') => {
    setConfirmDialog({ open: true, title, message, onConfirm, type });
  }, []);

  const closeMessage = useCallback(() => {
    setMessageDialog(prev => ({ ...prev, open: false }));
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog(prev => ({ ...prev, open: false }));
  }, []);

  return {
    confirmDialog, messageDialog,
    showError, showSuccess, showInfo, showConfirm,
    closeMessage, closeConfirm,
  };
}
