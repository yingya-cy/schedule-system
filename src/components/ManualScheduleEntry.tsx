import React, { useState } from 'react';
import { Save, X, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';

interface ManualScheduleEntryProps {
  onSave: (data: {
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
  }) => Promise<void>;
  onCancel: () => void;
  departments: { id: number; name: string; sort_order: number }[];
}

export default function ManualScheduleEntry({ onSave, onCancel, departments }: ManualScheduleEntryProps) {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [courses, setCourses] = useState<Array<{
    course_name: string;
    weekday: number;
    sections: number[];
    weeks: number[];
    teacher?: string;
    location?: string;
    remark?: string;
  }>>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !department.trim()) {
      alert('请填写课表名称和选择部门');
      return;
    }

    if (courses.length === 0) {
      alert('请至少添加一个课程');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        department: department.trim(),
        courses: courses.map(course => ({
          ...course,
          course_name: course.course_name.trim()
        }))
      });
    } catch (error) {
      console.error('保存课表失败:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCourse = () => {
    setCourses([...courses, {
      course_name: '',
      weekday: 1,
      sections: [],
      weeks: [],
      teacher: '',
      location: '',
      remark: ''
    }]);
  };

  const handleUpdateCourse = (index: number, field: string, value: any) => {
    const updatedCourses = [...courses];
    updatedCourses[index] = { ...updatedCourses[index], [field]: value };
    setCourses(updatedCourses);
  };

  const handleDeleteCourse = (index: number) => {
    const updatedCourses = courses.filter((_, i) => i !== index);
    setCourses(updatedCourses);
  };

  const isFormValid = name.trim() && department.trim() && 
    courses.some(course => course.course_name.trim());

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        {/* 头部 */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-blue-600" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">手动录入课表</h2>
                <p className="text-gray-600 mt-1">直接输入课表信息，无需上传文件</p>
              </div>
            </div>
            <button 
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* 基本信息 */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  课表名称 <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder="例如：张三的课表"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  所属部门 <span className="text-red-500">*</span>
                </label>
                <select 
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                >
                  <option value="">请选择部门</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 课程列表 */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">课程列表</h3>
              <button 
                onClick={handleAddCourse}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                添加课程
              </button>
            </div>

            <div className="space-y-4">
              {courses.map((course, index) => (
                <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        课程名称
                      </label>
                      <input 
                        type="text" 
                        value={course.course_name}
                        onChange={(e) => handleUpdateCourse(index, 'course_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        placeholder="课程名称"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        星期
                      </label>
                      <select 
                        value={course.weekday}
                        onChange={(e) => handleUpdateCourse(index, 'weekday', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      >
                        {['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'].map((day, idx) => (
                          <option key={idx} value={idx + 1}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        教师
                      </label>
                      <input 
                        type="text" 
                        value={course.teacher || ''}
                        onChange={(e) => handleUpdateCourse(index, 'teacher', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        placeholder="教师姓名"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        地点
                      </label>
                      <input 
                        type="text" 
                        value={course.location || ''}
                        onChange={(e) => handleUpdateCourse(index, 'location', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        placeholder="上课地点"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        节次（可多选）
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(section => (
                          <button
                            key={section}
                            type="button"
                            onClick={() => {
                              const currentSections = course.sections || [];
                              const newSections = currentSections.includes(section)
                                ? currentSections.filter(s => s !== section)
                                : [...currentSections, section];
                              handleUpdateCourse(index, 'sections', newSections.sort((a, b) => a - b));
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              course.sections?.includes(section)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            第{section}节
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        周次（可多选）
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].map(week => (
                          <button
                            key={week}
                            type="button"
                            onClick={() => {
                              const currentWeeks = course.weeks || [];
                              const newWeeks = currentWeeks.includes(week)
                                ? currentWeeks.filter(w => w !== week)
                                : [...currentWeeks, week];
                              handleUpdateCourse(index, 'weeks', newWeeks.sort((a, b) => a - b));
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              course.weeks?.includes(week)
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            第{week}周
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      备注
                    </label>
                    <textarea 
                      value={course.remark || ''}
                      onChange={(e) => handleUpdateCourse(index, 'remark', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      placeholder="课程备注"
                      rows={2}
                    />
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button 
                      onClick={() => handleDeleteCourse(index)}
                      className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <button 
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              取消
            </button>
            <button 
              onClick={handleSave}
              disabled={!isFormValid || isSaving}
              className={`px-6 py-3 rounded-lg transition-colors ${
                isFormValid && !isSaving
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? '保存中...' : '保存课表'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}