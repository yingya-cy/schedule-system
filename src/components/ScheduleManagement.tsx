import React, { useState, useEffect } from 'react';
import { Database, Trash2, Edit, Eye, Users, Calendar, Loader2, Search, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmDialog from './ConfirmDialog';
import MessageDialog from './MessageDialog';

interface Schedule {
  id: number;
  name: string;
  department: string;
  filename: string | null;
  created_at: string;
  updated_at: string;
  courses?: Course[];
}

interface Course {
  id: number;
  schedule_id: number;
  course_name: string;
  weekday: number;
  sections: number[];
  weeks: number[];
  teacher: string | null;
  location: string | null;
  remark: string | null;
}

interface Department {
  id: number;
  name: string;
  sort_order: number;
}

export default function ScheduleManagement() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [msgDialog, setMsgDialog] = useState<{ open: boolean; type: 'success' | 'error' | 'info'; title: string; message?: string }>({ open: false, type: 'info', title: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [deptResponse, scheduleResponse] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/schedules')
      ]);

      const deptResult = await deptResponse.json();
      const scheduleResult = await scheduleResponse.json();

      if (deptResult.success) {
        setDepartments(deptResult.data);
      }

      if (scheduleResult.success) {
        setSchedules(scheduleResult.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMsgDialog({ open: true, type: 'error', title: '加载失败', message: '请重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleteTarget(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);

    try {
      const response = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        setMsgDialog({ open: true, type: 'success', title: '删除成功' });
        fetchData();
      } else {
        setMsgDialog({ open: true, type: 'error', title: '删除失败', message: result.error });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setMsgDialog({ open: true, type: 'error', title: '删除失败', message: '请重试' });
    }
  };

  const handleViewDetail = async (id: number) => {
    try {
      const response = await fetch(`/api/schedules/${id}`);
      const result = await response.json();

      if (result.success) {
        setSelectedSchedule(result.data);
        setShowDetailModal(true);
      } else {
        setMsgDialog({ open: true, type: 'error', title: '加载详情失败', message: result.error });
      }
    } catch (error) {
      console.error('View detail error:', error);
      setMsgDialog({ open: true, type: 'error', title: '加载详情失败', message: '请重试' });
    }
  };

  const filteredSchedules = schedules.filter(schedule => {
    const matchName = !searchName || schedule.name.toLowerCase().includes(searchName.toLowerCase());
    const matchDept = !filterDepartment || schedule.department === filterDepartment;
    return matchName && matchDept;
  });

  const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-lg p-8"
      >
        <h2 className="text-2xl font-bold text-stone-900 mb-6 flex items-center gap-2">
          <Database className="w-6 h-6 text-purple-600" />
          课表管理
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                搜索姓名
              </div>
            </label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="输入姓名搜索"
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:border-purple-400 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                筛选部门
              </div>
            </label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:border-purple-400 focus:outline-none transition-colors bg-white"
            >
              <option value="">全部部门</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.name}>{dept.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-stone-500">
            共 {filteredSchedules.length} 个课表
          </p>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            刷新
          </button>
        </div>
      </motion.div>

      {loading && schedules.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
        </div>
      ) : filteredSchedules.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-3xl shadow-lg p-12 text-center"
        >
          <Database className="w-16 h-16 text-stone-300 mx-auto mb-4" />
          <p className="text-stone-500 text-lg">
            {schedules.length === 0 ? '暂无课表数据' : '没有找到匹配的课表'}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSchedules.map((schedule, index) => (
            <motion.div
              key={schedule.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity:1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-3xl shadow-lg p-6 hover:shadow-xl transition-shadow border border-stone-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-stone-900 mb-2">
                    {schedule.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-stone-500">
                    <Users className="w-4 h-4" />
                    {schedule.department}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewDetail(schedule.id)}
                    className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                    title="查看详情"
                  >
                    <Eye className="w-4 h-4 text-purple-600" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(schedule.id)}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                {schedule.filename && (
                  <div className="flex items-center gap-2 text-stone-500">
                    <Database className="w-4 h-4" />
                    <span className="truncate">{schedule.filename}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-stone-500">
                  <Calendar className="w-4 h-4" />
                  创建于 {new Date(schedule.created_at).toLocaleDateString('zh-CN')}
                </div>

                {schedule.courses && (
                  <div className="pt-3 border-t border-stone-200">
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-semibold">
                      {schedule.courses.length} 门课程
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showDetailModal && selectedSchedule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-stone-200 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-stone-900">
                    {selectedSchedule.name}
                  </h2>
                  <p className="text-sm text-stone-500 mt-1">
                    {selectedSchedule.department}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {selectedSchedule.courses && selectedSchedule.courses.length > 0 ? (
                  <div className="space-y-4">
                    {selectedSchedule.courses.map((course, idx) => (
                      <motion.div
                        key={course.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="bg-stone-50 rounded-2xl p-4 border border-stone-200"
                      >
                        <h4 className="font-bold text-lg text-stone-900 mb-3">
                          {course.course_name}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-stone-500">星期:</span>
                            <span className="ml-2 font-semibold text-stone-700">
                              {weekdays[course.weekday - 1]}
                            </span>
                          </div>
                          <div>
                            <span className="text-stone-500">节次:</span>
                            <span className="ml-2 font-semibold text-stone-700">
                              {course.sections.join('-')}节
                            </span>
                          </div>
                          <div>
                            <span className="text-stone-500">周数:</span>
                            <span className="ml-2 font-semibold text-stone-700">
                              {course.weeks[0] || 1}-{course.weeks[course.weeks.length - 1] || 18}周
                            </span>
                          </div>
                          {course.teacher && (
                            <div>
                              <span className="text-stone-500">教师:</span>
                              <span className="ml-2 font-semibold text-stone-700">
                                {course.teacher}
                              </span>
                            </div>
                          )}
                          {course.location && (
                            <div>
                              <span className="text-stone-500">地点:</span>
                              <span className="ml-2 font-semibold text-stone-700">
                                {course.location}
                              </span>
                            </div>
                          )}
                        </div>
                        {course.remark && (
                          <div className="mt-3 pt-3 border-t border-stone-200 text-sm text-stone-500">
                            备注: {course.remark}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-stone-500">
                    暂无课程数据
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="确认删除"
        message="确定要删除这个课表吗？此操作不可撤销。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        type="danger"
      />

      <MessageDialog
        isOpen={msgDialog.open}
        type={msgDialog.type}
        title={msgDialog.title}
        message={msgDialog.message}
        onClose={() => setMsgDialog(p => ({ ...p, open: false }))}
      />
    </div>
  );
}
