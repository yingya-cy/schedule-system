import React from 'react';
import { motion } from 'motion/react';
import { User, Building2, FileImage } from 'lucide-react';
import ScheduleEditor from '@/components/ScheduleEditor';
import { EditableCourse, Department } from '@/types';
import { api } from '@/services/api';

interface ScheduleEditFormProps {
  editName: string;
  editDepartment: string;
  editableCourses: EditableCourse[];
  departments: Department[];
  currentEditIndex: number | null;
  batchResults: { filename?: string; file_data?: string; file_type?: string }[];
  currentScheduleId: number | null;
  isSaving: boolean;
  onEditNameChange: (name: string) => void;
  onEditDepartmentChange: (dept: string) => void;
  onCoursesChange: (courses: EditableCourse[]) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function ScheduleEditForm({
  editName,
  editDepartment,
  editableCourses,
  departments,
  currentEditIndex,
  batchResults,
  currentScheduleId,
  isSaving,
  onEditNameChange,
  onEditDepartmentChange,
  onCoursesChange,
  onSave,
  onCancel
}: ScheduleEditFormProps) {
  const handleViewSourceFile = () => {
    if (currentEditIndex !== null) {
      const result = batchResults[currentEditIndex];
      if (result.file_data && result.file_type) {
        const byteCharacters = atob(result.file_data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.file_type });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } else if (currentScheduleId) {
      window.open(api.getScheduleFileUrl(currentScheduleId), '_blank');
    }
  };

  return (
    <motion.div
      key="edit"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">课表编辑</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {currentEditIndex !== null && batchResults[currentEditIndex]?.filename}
            {currentEditIndex === null && editName && ` · ${editName}`}
            {editableCourses.length > 0 && ` · ${editableCourses.length} 门课程`}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="focus-ring px-4 py-2 bg-surface-container-low text-on-surface-variant font-medium rounded-xl hover:bg-surface-container transition-all flex items-center gap-2"
        >
          返回
        </button>
      </div>

      {/* Edit form */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">
              <div className="flex items-center gap-2">
                <User size={16} />
                姓名 <span className="text-error">*</span>
              </div>
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              placeholder="请输入姓名"
              className="focus-ring w-full px-4 py-3 border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all bg-surface-container-lowest"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">
              <div className="flex items-center gap-2">
                <Building2 size={16} />
                部门 <span className="text-error">*</span>
              </div>
            </label>
            <select
              value={editDepartment}
              onChange={(e) => onEditDepartmentChange(e.target.value)}
              className="focus-ring w-full px-4 py-3 border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all appearance-none bg-surface-container-lowest"
            >
              <option value="">请选择部门</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.name}>{dept.name}</option>
              ))}
            </select>
          </div>
        </div>

        {((currentEditIndex !== null && batchResults[currentEditIndex]?.file_data) || currentScheduleId) && (
          <div className="flex justify-end">
            <button
              onClick={handleViewSourceFile}
              className="focus-ring px-4 py-2 bg-purple-500/10 text-purple-600 text-sm font-medium rounded-lg hover:bg-purple-500/20 transition-all flex items-center gap-2"
            >
              <FileImage size={16} />
              查看源文件
            </button>
          </div>
        )}
      </div>

      <ScheduleEditor
        courses={editableCourses}
        onCoursesChange={onCoursesChange}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={isSaving}
      />
    </motion.div>
  );
}