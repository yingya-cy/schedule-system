import { useState, useEffect } from 'react';
import { templateApi } from '../services/scoringApi.ts';
import type { ScoringTemplate, EditorDimension, EditorSubdimension } from '../types/scoring.ts';
import MessageDialog from '../../MessageDialog.tsx';
import ConfirmDialog from '../../ConfirmDialog.tsx';
import ImportExcelModal from './ImportExcelModal.tsx';
import { motion } from 'motion/react';
import { BookTemplate, Plus, Pencil, Trash2, ArrowLeft, Save, X as XIcon, GripVertical, Upload } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export default function TemplateList({ onBack }: Props) {
  const [templates, setTemplates] = useState<ScoringTemplate[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ScoringTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [messageDialog, setMessageDialog] = useState<{ open: boolean; type: 'success' | 'error' | 'info'; title: string; message?: string }>({ open: false, type: 'info', title: '' });
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

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
    setDeleteLoading(true);
    try {
      await templateApi.delete(deleteTarget);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget));
      setDeleteTarget(null);
    } catch (e: unknown) {
      setMessageDialog({ open: true, type: 'error', title: '删除失败', message: (e as Error).message });
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleEdit(template: ScoringTemplate) {
    setEditingTemplate(template);
    setShowEditor(true);
  }

  function handleCreateNew() {
    setEditingTemplate(null);
    setShowEditor(true);
  }

  function handleImportTemplate(parsed: { name: string; total_score: number; dimensions: Array<{ name: string; max_score: number; description?: string; subdimensions: Array<{ name: string; max_score: number; description: string }> }> }) {
    // 将解析结果转换为 ScoringTemplate 格式并打开编辑器
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
        max_score: d.max_score,
        sort_order: di,
        description: d.description || '',
        is_optional: 0,
        subdimensions: d.subdimensions.map((s, si) => ({
          id: 0,
          dimension_id: 0,
          name: s.name,
          max_score: s.max_score,
          sort_order: si,
          description: s.description,
        })),
      })),
    };
    setEditingTemplate(newTemplate);
    setShowEditor(true);
  }

  function handleSaved(template: ScoringTemplate) {
    // 检查模板是否已存在于列表中
    const existingIndex = templates.findIndex((t) => t.id === template.id);
    if (existingIndex >= 0) {
      // 更新现有模板
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? template : t)));
    } else {
      // 添加新模板
      setTemplates((prev) => [template, ...prev]);
    }
    setShowEditor(false);
    setEditingTemplate(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-outline">加载中...</div>
      </div>
    );
  }

  if (showEditor) {
    return (
      <TemplateEditor
        template={editingTemplate}
        onBack={() => setShowEditor(false)}
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
            onClick={handleCreateNew}
            className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-on-primary font-semibold rounded-xl shadow-lg shadow-primary/25 flex items-center gap-2 focus-ring touch-target"
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
            className="bg-surface rounded-2xl border border-surface-container-high p-5 shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-on-surface font-headline text-base">{t.name}</h3>
              <span className="text-sm text-outline font-medium">满分 {t.total_score}</span>
            </div>
            {t.description && (
              <p className="text-sm text-outline mb-3 line-clamp-2">{t.description}</p>
            )}
            <div className="text-xs text-outline mb-4">
              {t.category || 'general'} · {t.dimensions?.length || 0} 个维度
            </div>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleEdit(t)}
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

// =============================================
// 模板编辑器
// =============================================

interface TemplateEditorProps {
  template: ScoringTemplate | null;
  onBack: () => void;
  onSaved: (template: ScoringTemplate) => void;
  onError: (message: string) => void;
}

function TemplateEditor({ template, onBack, onSaved, onError }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState(template?.category || 'general');
  const [dimensions, setDimensions] = useState<EditorDimension[]>(
    (template?.dimensions || []).map((d) => ({
      id: d.id,
      template_id: d.template_id,
      name: d.name,
      max_score: d.max_score,
      sort_order: d.sort_order,
      is_optional: !!d.is_optional,
      description: d.description || '',
      subdimensions: d.subdimensions.map((s) => ({
        id: s.id,
        dimension_id: s.dimension_id,
        name: s.name,
        max_score: s.max_score,
        sort_order: s.sort_order,
        description: s.description,
      })),
    }))
  );
  const [saving, setSaving] = useState(false);

  // Auto-calculate total from dimensions
  const calculatedTotalScore = dimensions.reduce((sum, d) => sum + (d.max_score || 0), 0);

  function addDimension() {
    setDimensions((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        template_id: template?.id || 0,
        name: '',
        max_score: 0,
        sort_order: prev.length,
        is_optional: false,
        description: '',
        subdimensions: [],
      },
    ]);
  }

  function removeDimension(index: number) {
    setDimensions((prev) => prev.filter((_, i) => i !== index));
  }

  function addSubdimension(dimIndex: number) {
    setDimensions((prev) => {
      const updated = [...prev];
      const newSub: EditorSubdimension = {
        id: `new-${Date.now()}`,
        dimension_id: updated[dimIndex].id as number,
        name: '',
        max_score: 0,
        sort_order: updated[dimIndex].subdimensions.length,
        description: '',
      };
      updated[dimIndex].subdimensions = [...updated[dimIndex].subdimensions, newSub];
      return updated;
    });
  }

  function removeSubdimension(dimIndex: number, subIndex: number) {
    setDimensions((prev) => {
      const updated = [...prev];
      updated[dimIndex].subdimensions = updated[dimIndex].subdimensions.filter(
        (_, i) => i !== subIndex
      );
      return updated;
    });
  }

  async function handleSave() {
    if (!name.trim() || dimensions.length === 0) {
      onError('请填写模板名称并至少添加一个维度');
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
        total_score: calculatedTotalScore,
        category,
        dimensions: dimensions.map((d) => ({
          name: d.name,
          max_score: d.max_score,
          is_optional: d.is_optional,
          description: d.description,
          subdimensions: d.subdimensions.map((s) => ({
            name: s.name,
            max_score: s.max_score,
            description: s.description,
          })),
        })),
      };

      // 判断是新建还是更新：editingTemplate?.id 为 0 或 undefined 表示新建
      const isNewTemplate = !template?.id;

      if (isNewTemplate) {
        const result = await templateApi.create(data);
        const created = await templateApi.get(result.id);
        onSaved(created);
      } else {
        await templateApi.update(template.id, data);
        const updated = await templateApi.get(template.id);
        onSaved(updated);
      }
    } catch (e: unknown) {
      onError('保存失败：' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-surface-container-low transition-colors focus-ring"
        >
          <ArrowLeft size={20} className="text-on-surface-variant" />
        </button>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">
          {template ? '编辑模板' : '新建模板'}
        </h1>
      </div>

      {/* 基本信息 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-on-surface-variant">模板名称 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
            placeholder="如：心理科普短视频大赛"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-on-surface-variant">总分（自动计算）</label>
          <div className="w-full px-4 py-2.5 bg-surface-container-low border border-surface-container-high rounded-xl text-primary font-bold text-lg flex items-center justify-between">
            <span className="text-on-surface-variant text-sm font-normal">各维度满分之和</span>
            <span>{calculatedTotalScore}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-on-surface-variant">类别</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
            placeholder="如：video, presentation"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-on-surface-variant">描述</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all focus-ring"
            placeholder="模板描述（可选）"
          />
        </div>
      </div>

      {/* 维度列表 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-on-surface font-headline">评分维度</h2>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={addDimension}
            className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-1.5 focus-ring"
          >
            <Plus size={16} />
            添加维度
          </motion.button>
        </div>

        {dimensions.map((dim, dimIndex) => (
          <motion.div
            key={dimIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-2xl border border-surface-container-high p-5 space-y-4"
          >
            <div className="flex items-center gap-3">
              <GripVertical size={18} className="text-outline cursor-grab" />
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  value={dim.name}
                  onChange={(e) => setDimensions((prev) => {
                    const u = [...prev];
                    u[dimIndex] = { ...u[dimIndex], name: e.target.value };
                    return u;
                  })}
                  placeholder="维度名称（如：视频内容）"
                  className="px-3 py-2 bg-surface-container-low border border-surface-container-high rounded-lg text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm focus-ring"
                />
                <input
                  type="number"
                  value={dim.max_score}
                  onChange={(e) => setDimensions((prev) => {
                    const u = [...prev];
                    u[dimIndex] = { ...u[dimIndex], max_score: parseFloat(e.target.value) || 0 };
                    return u;
                  })}
                  placeholder="满分"
                  className="px-3 py-2 bg-surface-container-low border border-surface-container-high rounded-lg text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm focus-ring"
                />
                <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dim.is_optional}
                    onChange={(e) => setDimensions((prev) => {
                      const u = [...prev];
                      u[dimIndex] = { ...u[dimIndex], is_optional: e.target.checked };
                      return u;
                    })}
                    className="accent-primary"
                  />
                  可选维度
                </label>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => removeDimension(dimIndex)}
                className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors focus-ring"
              >
                <Trash2 size={16} />
              </motion.button>
            </div>

            {/* 维度描述 */}
            <div className="ml-6 pl-4 border-l-2 border-primary/20">
              <input
                value={dim.description}
                onChange={(e) => setDimensions((prev) => {
                  const u = [...prev];
                  u[dimIndex] = { ...u[dimIndex], description: e.target.value };
                  return u;
                })}
                placeholder="维度评分标准说明（可选）"
                className="w-full px-3 py-2 bg-surface-container-low border border-surface-container-high rounded-lg text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm focus-ring"
              />
            </div>

            {/* 子维度 */}
            <div className="ml-6 pl-4 border-l-2 border-primary/20 space-y-3">
              <div className="text-xs font-medium text-outline uppercase tracking-wider">子维度（二级评分项）</div>
              {dim.subdimensions.map((sub, subIndex) => (
                <div key={subIndex} className="flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      value={sub.name}
                      onChange={(e) => setDimensions((prev) => {
                        const u = [...prev];
                        const subs = [...u[dimIndex].subdimensions];
                        subs[subIndex] = { ...subs[subIndex], name: e.target.value };
                        u[dimIndex] = { ...u[dimIndex], subdimensions: subs };
                        return u;
                      })}
                      placeholder="子维度名称"
                      className="px-3 py-1.5 bg-surface-container-low border border-surface-container-high rounded-lg text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm focus-ring"
                    />
                    <input
                      type="number"
                      value={sub.max_score}
                      onChange={(e) => setDimensions((prev) => {
                        const u = [...prev];
                        const subs = [...u[dimIndex].subdimensions];
                        subs[subIndex] = { ...subs[subIndex], max_score: parseFloat(e.target.value) || 0 };
                        u[dimIndex] = { ...u[dimIndex], subdimensions: subs };
                        return u;
                      })}
                      placeholder="分"
                      className="px-3 py-1.5 bg-surface-container-low border border-surface-container-high rounded-lg text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm w-20 focus-ring"
                    />
                    <input
                      value={sub.description}
                      onChange={(e) => setDimensions((prev) => {
                        const u = [...prev];
                        const subs = [...u[dimIndex].subdimensions];
                        subs[subIndex] = { ...subs[subIndex], description: e.target.value };
                        u[dimIndex] = { ...u[dimIndex], subdimensions: subs };
                        return u;
                      })}
                      placeholder="评分标准说明"
                      className="px-3 py-1.5 bg-surface-container-low border border-surface-container-high rounded-lg text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm focus-ring"
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => removeSubdimension(dimIndex, subIndex)}
                    className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors shrink-0 focus-ring"
                  >
                    <XIcon size={14} />
                  </motion.button>
                </div>
              ))}
              <button
                onClick={() => addSubdimension(dimIndex)}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors focus-ring"
              >
                + 添加子维度
              </button>
            </div>
          </motion.div>
        ))}

        {dimensions.length === 0 && (
          <div className="py-12 text-center text-outline bg-surface rounded-2xl border border-dashed border-surface-container-high">
            暂无维度，点击上方"添加维度"开始
          </div>
        )}
      </div>

      {/* 保存按钮 */}
      <div className="flex gap-3 pt-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-primary to-primary/80 text-on-primary font-semibold rounded-xl shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center gap-2 focus-ring"
        >
          <Save size={18} />
          {saving ? '保存中...' : '保存模板'}
        </motion.button>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-surface border border-surface-container-high text-on-surface rounded-xl hover:bg-surface-container-low transition-colors focus-ring"
        >
          取消
        </button>
      </div>
    </div>
  );
}