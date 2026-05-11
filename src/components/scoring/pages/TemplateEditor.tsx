import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, GripVertical, Plus, Trash2 } from 'lucide-react';
import MessageDialog from '../../MessageDialog.tsx';
import ConfirmDialog from '../../ConfirmDialog.tsx';
import { templateApi } from '../services/scoringApi.ts';
import type { ScoringTemplate, EditorDimension, EditorSubdimension } from '../types/scoring.ts';

interface TemplateEditorProps {
  template: ScoringTemplate | null;
  onClose: () => void;
  onSaved: (template: ScoringTemplate) => void;
  onError: (message: string) => void;
}

function TemplateEditor({ template, onClose, onSaved, onError }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState(template?.category || 'general');
  const [dimensions, setDimensions] = useState<EditorDimension[]>(
    (template?.dimensions || []).map((d) => ({
      id: d.id,
      template_id: d.template_id,
      name: d.name,
      max_score: Number(d.max_score) || 0,
      sort_order: d.sort_order,
      is_optional: !!d.is_optional,
      description: d.description || '',
      subdimensions: d.subdimensions.map((s) => ({
        id: s.id,
        dimension_id: s.dimension_id,
        name: s.name,
        max_score: Number(s.max_score) || 0,
        sort_order: s.sort_order,
        description: s.description,
      })),
    }))
  );
  const [saving, setSaving] = useState(false);

  // Auto-calculate total from dimensions
  const calculatedTotalScore = dimensions.reduce((sum, d) => sum + (Number(d.max_score) || 0), 0);

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
    if (!name.trim()) {
      onError('请填写模板名称');
      return;
    }
    // 检查是否至少有一个有效维度（有空名称的维度视为无效）
    const validDimensions = dimensions.filter(d => d.name.trim());
    if (validDimensions.length === 0) {
      onError('请至少添加一个有效的维度（维度名称不能为空）');
      return;
    }
    setSaving(true);
    try {
      // 只发送有效维度（名称不为空）
      const data = {
        name: name.trim(),
        description: description.trim(),
        total_score: Number(calculatedTotalScore) || 0,
        category,
        dimensions: validDimensions.map((d) => ({
          name: d.name,
          max_score: Number(d.max_score) || 0,
          is_optional: d.is_optional,
          description: d.description,
          subdimensions: d.subdimensions.map((s) => ({
            name: s.name,
            max_score: Number(s.max_score) || 0,
            description: s.description,
          })),
        })),
      };

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
          onClick={() => onClose()}
          className="p-2 rounded-xl hover:bg-surface-container-low transition-colors focus-ring"
        >
          <ArrowLeft size={20} className="text-on-surface-variant" />
        </button>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">
          {template?.id ? '编辑模板' : '新建模板'}
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
                    className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors focus-ring"
                  >
                    <Trash2 size={14} />
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
          onClick={() => onClose()}
          disabled={saving}
          className="px-6 py-3 bg-surface-container-low text-on-surface-variant font-medium rounded-xl hover:bg-surface-container transition-all disabled:opacity-50 flex items-center gap-2 focus-ring"
        >
          取消
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-primary to-primary/80 text-on-primary font-semibold rounded-xl shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center gap-2 focus-ring"
        >
          {saving ? '保存中...' : '保存模板'}
        </motion.button>
      </div>
    </div>
  );
}

export default TemplateEditor;
