import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EditableCourse, ScheduleData, Department } from '@/types';
import { api } from '@/services/api';
import ManualScheduleEntry from '@/components/ManualScheduleEntry';
import { useAuthStore } from '@/stores/authStore';
import ConfirmDialog from '@/components/ConfirmDialog';
import MessageDialog from '@/components/MessageDialog';
import { useAppStore } from '@/stores/appStore';
import { ViewMode, UploadState, BatchResult, initialUploadState } from './constants';
import ScheduleListView from './ScheduleListView';
import ScheduleUploadView from './ScheduleUploadView';
import BatchResultView from './BatchResultView';
import ScheduleEditForm from './ScheduleEditForm';

export default function FilesView() {
  const allSchedules = useAppStore((s) => s.schedules);
  const loading = useAppStore((s) => s.schedulesLoading);
  const refreshSchedules = useAppStore((s) => s.refreshSchedules);
  const removeSchedule = useAppStore((s) => s.removeSchedule);
  const departments = useAppStore((s) => s.departments);
  const availableTerms = useAppStore((s) => s.availableTerms);
  const currentTermId = useAppStore((s) => s.currentTermId);
  const setCurrentTermId = useAppStore((s) => s.setCurrentTermId);
  const refreshTerms = useAppStore((s) => s.refreshTerms);

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Upload states
  const [uploadState, setUploadState] = useState<UploadState>(initialUploadState);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);

  // Edit states
  const [editableCourses, setEditableCourses] = useState<EditableCourse[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentEditIndex, setCurrentEditIndex] = useState<number | null>(null);
  const [currentScheduleId, setCurrentScheduleId] = useState<number | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const user = useAuthStore((s) => s.user);
  const [editName, setEditName] = useState('');
  const [editDepartment, setEditDepartment] = useState('');

  // Confirm dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Message dialog state
  const [messageDialog, setMessageDialog] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message?: string;
  }>({ isOpen: false, type: 'info', title: '' });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Handlers
  const handleViewSchedule = async (schedule: ScheduleData) => {
    if (user) {
      const isPrivileged = user.role === 'admin' || user.department === '秘书部' || user.department === '主任团';
      const isCreator = (schedule as any).created_by === user.username;
      setReadOnly(!isPrivileged && !isCreator);
    }
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
      setMessageDialog({
        isOpen: true,
        type: 'error',
        title: '加载失败',
        message: err.message || '加载课表失败，请重试'
      });
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
      setMessageDialog({
        isOpen: true,
        type: 'error',
        title: '删除失败',
        message: err.message || '删除课表失败，请重试'
      });
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
      setMessageDialog({
        isOpen: true,
        type: 'error',
        title: '保存失败',
        message: '请填写姓名和部门'
      });
      return;
    }

    setIsSaving(true);
    try {
      const currentResult = currentEditIndex !== null ? batchResults[currentEditIndex] : null;

      let scheduleId = currentScheduleId;
      if (currentScheduleId) {
        await api.updateSchedule(currentScheduleId, {
          name: editName.trim(),
          department: editDepartment,
        });
        for (const course of editableCourses) {
          if (course.id && !course.id.startsWith('new-')) {
            await api.updateCourse(parseInt(course.id), {
              course_name: course.course_name,
              weekday: course.weekday,
              sections: course.sections,
              weeks: course.weeks,
              teacher: course.teacher,
              location: course.location,
              remark: course.remark,
            });
          } else {
            await api.createCourse(currentScheduleId, {
              course_name: course.course_name,
              weekday: course.weekday,
              sections: course.sections,
              weeks: course.weeks,
              teacher: course.teacher,
              location: course.location,
              remark: course.remark,
            });
          }
        }
      } else {
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
      scheduleId = schedule.id;
      }

      if (currentEditIndex !== null) {
        setBatchResults(prev => prev.map((r, i) =>
          i === currentEditIndex
            ? { ...r, saved: true, name: editName.trim(), department: editDepartment, courses: editableCourses, schedule_id: scheduleId }
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
      setMessageDialog({
        isOpen: true,
        type: 'error',
        title: '保存失败',
        message: err.message || '保存课表失败，请重试'
      });
    } finally {
      setIsSaving(false);
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

      setMessageDialog({
        isOpen: true,
        type: 'success',
        title: '保存成功',
        message: '手动录入课表已保存'
      });
      setViewMode('list');
      refreshSchedules();
      return { success: true };
    } catch (err: any) {
      console.error('Failed to save manual schedule:', err);
      return { success: false, error: err.message || '保存失败，请重试' };
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
            {/* Term selector + export */}
            <div className="flex items-center gap-2 mb-4">
              {availableTerms.length > 0 && (
                <select
                  value={currentTermId || ''}
                  onChange={e => setCurrentTermId(Number(e.target.value))}
                  className="px-2 py-1 text-xs rounded-lg bg-surface-container-low border border-surface-container-high"
                >
                  {availableTerms.map(t => (
                    <option key={t.id} value={t.id}>{t.name}{t.status === 'active' ? ' (当前)' : ''}</option>
                  ))}
                </select>
              )}
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('auth_token');
                    const res = await fetch('/api/export/reverse-schedule', {
                      method: 'POST',
                      headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ term_id: currentTermId }),
                    });
                    if (!res.ok) throw new Error('导出失败');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url;
                    a.download = 'reverse-schedule.xlsx'; a.click();
                    URL.revokeObjectURL(url);
                  } catch { /* ignore */ }
                }}
                className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
              >
                导出反课表
              </button>
            </div>
            {/* List View */}
            <ScheduleListView
              schedules={allSchedules}
              loading={loading}
              departments={departments}
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
          <ScheduleEditForm
            key="edit"
            editName={editName}
            editDepartment={editDepartment}
            editableCourses={editableCourses}
            departments={departments}
            currentEditIndex={currentEditIndex}
            batchResults={batchResults}
            currentScheduleId={currentScheduleId}
            isSaving={isSaving}
            readOnly={readOnly}
            onEditNameChange={setEditName}
            onEditDepartmentChange={setEditDepartment}
            onCoursesChange={setEditableCourses}
            onSave={handleSaveSchedule}
            onCancel={handleCancelEdit}
          />
        )}

        {viewMode === 'manual_entry' && (
          <ManualScheduleEntry
            key="manual-entry"
            onSave={handleManualSave}
            onCancel={() => setViewMode('list')}
            onError={(msg) => setMessageDialog({ isOpen: true, type: 'error', title: '错误', message: msg })}
            onSuccess={(msg) => setMessageDialog({ isOpen: true, type: 'success', title: '成功', message: msg })}
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

      <MessageDialog
        isOpen={messageDialog.isOpen}
        type={messageDialog.type}
        title={messageDialog.title}
        message={messageDialog.message}
        onClose={() => setMessageDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
