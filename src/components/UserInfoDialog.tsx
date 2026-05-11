import React, { useState, useEffect } from 'react';
import { X, User, Building2, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Department } from '@/types';
import { api } from '@/services/api';

interface UserInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, department: string) => void;
  filename?: string;
}

export default function UserInfoDialog({
  isOpen,
  onClose,
  onSubmit,
  filename
}: UserInfoDialogProps) {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadDepartments();
    }
  }, [isOpen]);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const data = await api.getDepartments();
      setDepartments(data);
      if (data.length > 0) {
        setDepartment(data[0].name);
      }
    } catch {
      setError('加载部门列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('请输入姓名');
      return;
    }
    if (!department) {
      setError('请选择部门');
      return;
    }
    onSubmit(name.trim(), department);
    setName('');
    setDepartment(departments[0]?.name || '');
    setError('');
  };

  const handleClose = () => {
    setName('');
    setError('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-surface-container-lowest rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-surface-container-high flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-on-surface font-headline">完善信息</h3>
                <p className="text-sm text-on-surface-variant mt-1">课表识别成功，请填写以下信息</p>
              </div>
              <button 
                onClick={handleClose}
                className="p-2 hover:bg-surface-container-low rounded-lg transition-colors"
              >
                <X size={20} className="text-outline" />
              </button>
            </div>

            {filename && (
              <div className="px-6 pt-4">
                <div className="bg-primary/10 rounded-lg p-3 flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center">
                    <Check size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-primary font-medium">识别成功</p>
                    <p className="text-sm text-on-surface truncate">{filename}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 rounded-lg p-3 flex items-center gap-2 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    姓名 <span className="text-red-500">*</span>
                  </div>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  placeholder="请输入您的姓名"
                  className="w-full px-4 py-3 border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} />
                    部门 <span className="text-red-500">*</span>
                  </div>
                </label>
                {loading ? (
                  <div className="w-full px-4 py-3 border border-surface-container-high rounded-xl bg-surface-container-low animate-pulse">
                    加载中...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {departments.map((dept) => (
                      <button
                        key={dept.id}
                        onClick={() => { setDepartment(dept.name); setError(''); }}
                        className={cn(
                          "px-4 py-3 rounded-xl text-sm font-medium transition-all",
                          department === dept.name
                            ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                            : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-surface-container-high"
                        )}
                      >
                        {dept.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-surface-container-high bg-surface-container-low/30 flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="px-6 py-2.5 bg-surface-container-low text-on-surface-variant font-medium rounded-xl hover:bg-surface-container transition-all"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || !department}
                className="px-6 py-2.5 bg-primary text-on-primary font-semibold rounded-xl shadow-lg shadow-primary/20 hover:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Check size={16} />
                确认并继续
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
