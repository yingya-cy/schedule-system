import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { templateApi } from '../services/scoringApi.ts';
import type { ScoringTemplate, EditorDimension, EditorSubdimension } from '../types/scoring.ts';
import MessageDialog from '../../MessageDialog.tsx';
import ConfirmDialog from '../../ConfirmDialog.tsx';
import ImportExcelModal from './ImportExcelModal.tsx';
import { motion } from 'motion/react';
import { BookTemplate, Plus, Pencil, Trash2, ArrowLeft, Upload, GripVertical } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export default function TemplateList({ onBack }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [templates, setTemplates] = useState<ScoringTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // 编辑状态：编辑中的模板 ID，null 表示不在编辑状态
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);

  // 加载现有模板时的 loading 状态
  const [templateLoading, setTemplateLoading] = useState(false);

  // Dialogs
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [messageDialog, setMessageDialog] = useState<{ open: boolean; type: 'success' | 'error' | 'info'; title: string; message?: string }>({ open: false, type: 'info', title: '' });
  const [showImportModal, setShowImportModal] = useState(false);

  // 正在编辑的模板（从列表中查找或服务器获取）
  const [editingTemplate, setEditingTemplate] = useState<ScoringTemplate | null>(null);

  // 加载模板数据
  useEffect(() => {
    loadTemplates();
  }, []);

  // 当 editingId 变化时，加载对应的模板
  useEffect(() => {
    if (editingId === null) {
      setEditingTemplate(null);
      setTemplateLoading(false);
      return;
    }
    if (editingId === 'new') {
      // 不覆盖 editingTemplate，让 handleImportTemplate 设置的数据保持
      setTemplateLoading(false);
      return;
    }
    // 编辑现有模板 - 总是从服务器加载以获取完整数据（包括维度）
    setTemplateLoading(true);
    const id = Number(editingId);
    templateApi.get(id).then((t) => {
      setEditingTemplate(t);
      setTemplateLoading(false);
    }).catch(() => {
      setEditingId(null);
      setSearchParams({});
      setTemplateLoading(false);
    });
  }, [editingId]);

  async function loadTemplates() {
    try {
      const data = await templateApi.list();
      setTemplates(data);
    } finally {
      setLoading(false);
    }
  }

  function handleDeleteClick(id: number) {
    const t = templates.find((t) => t.id === id);
    if (t) {
      setDeleteTarget(id);
      setDeleteName(t.name);
    }
  }

  async function confirmDelete() {
    if (deleteTarget === null) return;
    try {
      await templateApi.delete(deleteTarget);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget));
      setDeleteTarget(null);
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '删除失败', message: (e as Error).message });
    }
  }

  // 打开编辑器的统一方法
  const openEditor = useCallback((id: number | 'new') => {
    setEditingId(id);
    if (id === 'new') {
      setSearchParams({ edit: 'new' });
    } else {
      setSearchParams({ edit: String(id) });
    }
  }, [setSearchParams]);

  // 关闭编辑器
  const closeEditor = useCallback(() => {
    setEditingId(null);
    setEditingTemplate(null);
    setSearchParams({});
  }, [setSearchParams]);

  // 保存成功后的回调
  const handleSaved = useCallback((template: ScoringTemplate) => {
    // 添加 dimension_count 用于列表显示
    const templateWithCount = {
      ...template,
      dimension_count: template.dimensions?.length || 0
    };
    // 更新列表
    setTemplates((prev) => {
      const existingIndex = prev.findIndex((t) => t.id === template.id);
      if (existingIndex >= 0) {
        return prev.map((t) => (t.id === template.id ? templateWithCount : t));
      }
      return [templateWithCount, ...prev];
    });
    // 保存成功，直接关闭编辑器
    setEditingId(null);
    setEditingTemplate(null);
    setSearchParams({});
  }, [setSearchParams]);

  // 导入模板
  function handleImportTemplate(parsed: { name: string; total_score: number; dimensions: Array<{ name: string; max_score: number; description?: string; subdimensions: Array<{ name: string; max_score: number; description: string }> }> }) {
    // 将解析结果转换为模板格式
    const newTemplate: ScoringTemplate = {
      id: 0,
      name: parsed.name,
      total_score: parsed.total_score,
      description: '',
      category: 'general',
      is_active: 1,
      created_at: '',
      updated_at: '',
      dimensions: parsed.dimensions.map((d, di) => ({
        id: 0,
        template_id: 0,
        name: d.name,
        max_score: Number(d.max_score) || 0,
        sort_order: di,
        description: d.description || '',
        is_optional: 0,
        subdimensions: d.subdimensions.map((s, si) => ({
          id: 0,
          dimension_id: 0,
          name: s.name,
          max_score: Number(s.max_score) || 0,
          sort_order: si,
          description: s.description,
        })),
      })),
      dimension_count: parsed.dimensions.length,
    };
    setEditingTemplate(newTemplate);
    setEditingId('new');
    setSearchParams({ edit: 'new' });
  }

  // 处理从 URL 恢复编辑状态
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId === null) {
      setEditingId(null);
    } else if (editingId === null) {
      // 只有在没有在编辑状态时才设置
      if (editId === 'new') {
        setEditingId('new');
      } else {
        const id = parseInt(editId, 10);
        if (!isNaN(id)) {
          setEditingId(id);
        }
      }
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-outline">加载中...</div>
      </div>
    );
  }

  // 加载现有模板时显示 loading
  if (editingId !== null && editingId !== 'new' && templateLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-outline">加载模板中...</div>
      </div>
    );
  }

  // 渲染编辑器
  if (editingId !== null) {
    return (
      <TemplateEditor
        key={editingId === 'new' ? 'new' : `edit-${editingId}`}
        template={editingTemplate}
        onClose={closeEditor}
        onSaved={handleSaved}
        onError={(msg) => setMessageDialog({ open: true, type: 'error', title: '操作失败', message: msg })}
      />
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-surface-container-low transition-colors focus-ring touch-target"
          >
            <ArrowLeft size={20} className="text-on-surface-variant" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
            <BookTemplate className="text-on-primary" size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight font-headline">评分模板</h1>
            <p className="text-sm text-outline hidden sm:block">创建和管理评分维度</p>
          </div>
        </div>
        <div className="flex gap-2 self-end sm:self-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowImportModal(true)}
            className="px-5 py-2.5 bg-surface-container-high text-on-surface font-medium rounded-xl hover:bg-surface-container-high/80 transition-colors flex items-center gap-2 focus-ring touch-target border border-surface-container-high"
          >
            <Upload size={18} />
            <span className="whitespace-nowrap">导入 Excel</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => openEditor('new')}
            className="px-5 py-2.5 bg-primary text-on-primary font-semibold rounded-xl shadow-md flex items-center gap-2 focus-ring touch-target hover:bg-primary/90 transition-colors"
          >
            <Plus size={18} />
            <span className="whitespace-nowrap">新建模板</span>
          </motion.button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-2xl border border-surface-container-high p-5 shadow-sm flex flex-col"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="font-bold text-on-surface font-headline text-base min-w-0 truncate">{t.name}</h3>
              <span className="text-sm text-outline font-medium shrink-0 whitespace-nowrap">满分 {Math.round(Number(t.total_score))}</span>
            </div>
            {t.description && (
              <p className="text-sm text-outline mb-3 line-clamp-2">{t.description}</p>
            )}
            <div className="text-xs text-outline mb-4">
              {t.category || 'general'} · {t.dimension_count || 0} 个维度
            </div>
            <div className="flex gap-2 mt-auto">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => openEditor(t.id)}
                className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-1.5 focus-ring"
              >
                <Pencil size={14} />
                编辑
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleDeleteClick(t.id)}
                className="px-4 py-2 bg-error/10 text-error rounded-lg text-sm font-medium hover:bg-error/20 transition-colors flex items-center gap-1.5 focus-ring"
              >
                <Trash2 size={14} />
                删除
              </motion.button>
            </div>
          </motion.div>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full py-16 text-center text-outline">
            暂无模板，点击"新建模板"开始
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="删除模板"
        message={`确认删除模板「${deleteName}」？此操作不可恢复。`}
        confirmText="删除"
        cancelText="取消"
        type="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Message Dialog */}
      <MessageDialog
        isOpen={messageDialog.open}
        type={messageDialog.type}
        title={messageDialog.title}
        message={messageDialog.message}
        onClose={() => setMessageDialog((p) => ({ ...p, open: false }))}
      />

      {/* Import Excel Modal */}
      <ImportExcelModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportTemplate={handleImportTemplate}
      />
    </div>
  );
}


import TemplateEditor from './TemplateEditor.tsx';
