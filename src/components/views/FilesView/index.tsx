import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Building2, FileImage } from 'lucide-react';
import { EditableCourse, ScheduleData, Department } from '@/types';
import { api } from '@/services/api';
import ScheduleEditor from '@/components/ScheduleEditor';
import ManualScheduleEntry from '@/components/ManualScheduleEntry';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAppStore } from '@/stores/appStore';
import { ViewMode, UploadState, BatchResult, initialUploadState } from './constants';
import ScheduleListView from './ScheduleListView';
import ScheduleUploadView from './ScheduleUploadView';
import BatchResultView from './BatchResultView';
import StatsCards from './StatsCards';

export default function FilesView() {
  const allSchedules = useAppStore((s) => s.schedules);
  const loading = useAppStore((s) => s.schedulesLoading);
  const refreshSchedules = useAppStore((s) => s.refreshSchedules);
  const removeSchedule = useAppStore((s) => s.removeSchedule);
  const departments = useAppStore((s) => s.departments);

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // List view filter states
  const [searchName, setSearchName] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Upload states
  const [uploadState, setUploadState] = useState<UploadState>(initialUploadState);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);

  // Edit states
  const [editableCourses, setEditableCourses] = useState<EditableCourse[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentEditIndex, setCurrentEditIndex] = useState<number | null>(null);
  const [currentScheduleId, setCurrentScheduleId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDepartment, setEditDepartment] = useState('');

  // Confirm dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Handlers
  const handleViewSchedule = async (schedule: ScheduleData) => {
    try {
      const fullSchedule = await api.getSchedule(schedule.id);

      const courses: EditableCourse[] = (fullSchedule.courses || []).map(c => ({
        id: String(c.id),
        course_name: c.course_name,
        weekday: c.weekday,
        sections: c.sections,
        weeks: c.weeks,
        teacher: c.teacher || '',
        location: c.location || '',
        remark: c.remark || ''
      }));

      setEditableCourses(courses);
      setEditName(schedule.name);
      setEditDepartment(schedule.department);
      setCurrentEditIndex(null);
      setCurrentScheduleId(schedule.id);
      setViewMode('edit');
    } catch (err: any) {
      alert('加载课表失败：' + err.message);
    }
  };

  const handleDeleteSchedule = (id: number) => {
    setPendingDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (pendingDeleteId === null) return;
    const id = pendingDeleteId;
    setShowDeleteConfirm(false);
    setPendingDeleteId(null);

    try {
      await api.deleteSchedule(id);
      removeSchedule(id);
    } catch (err: any) {
      alert('删除失败：' + err.message);
    }
  };

  const handleEditBatchResult = (index: number) => {
    const result = batchResults[index];
    if (!result.success) return;

    setCurrentEditIndex(index);
    setEditableCourses([...result.courses]);
    setEditName(result.name || '');
    setEditDepartment(result.department || '');
    setViewMode('edit');
  };

  const handleSaveSchedule = async () => {
    if (!editName.trim() || !editDepartment) {
      alert('请填写姓名和部门');
      return;
    }

    setIsSaving(true);
    try {
      // Delete existing schedules for this person/department
      const existingSchedules = await api.getSchedules({
        name: editName.trim(),
        department: editDepartment
      });

      for (const schedule of existingSchedules) {
        await api.deleteSchedule(schedule.id);
      }

      const currentResult = currentEditIndex !== null ? batchResults[currentEditIndex] : null;

      const schedule = await api.createSchedule({
        name: editName.trim(),
        department: editDepartment,
        filename: currentResult?.filename,
        file_data: currentResult?.file_data,
        file_type: currentResult?.file_type,
        courses: editableCourses.map(c => ({
          course_name: c.course_name,
          weekday: c.weekday,
          sections: c.sections,
          weeks: c.weeks,
          teacher: c.teacher || undefined,
          location: c.location || undefined,
          remark: c.remark || undefined
        }))
      });

      if (currentEditIndex !== null) {
        setBatchResults(prev => prev.map((r, i) =>
          i === currentEditIndex
            ? { ...r, saved: true, name: editName.trim(), department: editDepartment, courses: editableCourses, schedule_id: schedule.id }
            : r
        ));
      }

      resetEditState();

      if (batchResults.length > 0 && currentEditIndex !== null) {
        setViewMode('batch_result');
      } else {
        setViewMode('list');
      }

      refreshSchedules();
    } catch (err: any) {
      console.error('Failed to save schedule:', err);
      alert('保存失败：' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

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

  const handleCancelEdit = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (batchResults.length > 0 && currentEditIndex !== null) {
      setViewMode('batch_result');
    } else {
      setViewMode('list');
    }

    resetEditState();
  };

  const handleBackToList = () => {
    const unsavedResults = batchResults.filter(r => r.success && !r.saved);
    if (unsavedResults.length > 0) {
      setShowConfirmDialog(true);
      return;
    }
    setViewMode('list');
    setBatchResults([]);
    resetEditState();
  };

  const confirmBackToList = () => {
    setShowConfirmDialog(false);
    setViewMode('list');
    setBatchResults([]);
    resetEditState();
  };

  const handleManualSave = async (data: {
    name: string;
    department: string;
    courses: Array<{
      course_name: string;
      weekday: number;
      sections: number[];
      weeks: number[];
      teacher?: string;
      location?: string;
      remark?: string;
    }>;
  }) => {
    try {
      await api.createSchedule({
        name: data.name,
        department: data.department,
        courses: data.courses.map(c => ({
          course_name: c.course_name,
          weekday: c.weekday,
          sections: c.sections,
          weeks: c.weeks,
          teacher: c.teacher || undefined,
          location: c.location || undefined,
          remark: c.remark || undefined
        }))
      });

      alert('手动录入成功');
      setViewMode('list');
      refreshSchedules();
    } catch (err: any) {
      console.error('Failed to save manual schedule:', err);
      alert('手动录入失败：' + err.message);
    }
  };

  const handleRemoveBatchResult = (index: number) => {
    setBatchResults(prev => prev.filter((_, i) => i !== index));
  };

  const resetEditState = () => {
    setEditableCourses([]);
    setEditName('');
    setEditDepartment('');
    setCurrentEditIndex(null);
    setCurrentScheduleId(null);
    setUploadState(initialUploadState);
  };

  const handleBatchResults = (results: BatchResult[]) => {
    setBatchResults(results);
    setViewMode('batch_result');
  };

  return (
    <div className="space-y-6 w-full">
      <AnimatePresence mode="wait">
        {viewMode === 'list' && (
          <div key="list-content" className="w-full">
            {/* List View */}
            <ScheduleListView
              schedules={allSchedules}
              loading={loading}
              departments={departments}
              filterDepartment={filterDepartment}
              onFilterDepartmentChange={setFilterDepartment}
              searchName={searchName}
              onSearchNameChange={setSearchName}
              showSearch={showSearch}
              onToggleSearch={() => setShowSearch(!showSearch)}
              onUploadClick={() => {
                setUploadState(initialUploadState);
                setViewMode('upload');
              }}
              onManualEntryClick={() => setViewMode('manual_entry')}
              onViewSchedule={handleViewSchedule}
              onDeleteSchedule={handleDeleteSchedule}
            />
          </div>
        )}

        {viewMode === 'upload' && (
          <ScheduleUploadView
            key="upload-view"
            uploadState={uploadState}
            onUploadStateChange={setUploadState}
            onBatchResults={handleBatchResults}
            onBack={handleBackToList}
          />
        )}

        {viewMode === 'batch_result' && (
          <BatchResultView
            key="batch-result-view"
            batchResults={batchResults}
            onEdit={handleEditBatchResult}
            onRemove={handleRemoveBatchResult}
            onBack={handleBackToList}
          />
        )}

        {viewMode === 'edit' && (
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
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-surface-container-low text-on-surface-variant font-medium rounded-xl hover:bg-surface-container transition-all flex items-center gap-2"
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
                      姓名 <span className="text-red-500">*</span>
                    </div>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="请输入姓名"
                    className="w-full px-4 py-3 border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} />
                      部门 <span className="text-red-500">*</span>
                    </div>
                  </label>
                  <select
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full px-4 py-3 border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all appearance-none bg-surface-container-lowest"
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
                    className="px-4 py-2 bg-purple-500/10 text-purple-600 text-sm font-medium rounded-lg hover:bg-purple-500/20 transition-all flex items-center gap-2"
                  >
                    <FileImage size={16} />
                    查看源文件
                  </button>
                </div>
              )}
            </div>

            <ScheduleEditor
              courses={editableCourses}
              onCoursesChange={setEditableCourses}
              onSave={handleSaveSchedule}
              onCancel={handleCancelEdit}
              isSaving={isSaving}
            />
          </motion.div>
        )}

        {viewMode === 'manual_entry' && (
          <ManualScheduleEntry
            key="manual-entry"
            onSave={handleManualSave}
            onCancel={() => setViewMode('list')}
            departments={departments}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="确认返回"
        message={`还有 ${batchResults.filter(r => r.success && !r.saved).length} 个未保存的识别结果，确定要返回吗？`}
        confirmText="确定返回"
        cancelText="取消"
        onConfirm={confirmBackToList}
        onCancel={() => setShowConfirmDialog(false)}
        type="warning"
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="确认删除"
        message="确定要删除这个课表吗？此操作不可撤销。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setPendingDeleteId(null);
        }}
        type="danger"
      />
    </div>
  );
}
