import React, { useState, useEffect } from 'react';
import { Search, Users, Clock, Calendar, Download, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FreeTimeResult {
  week: number;
  day: number;
  section: number;
  free_people: Array<{
    schedule_id: number;
    name: string;
    department: string;
  }>;
  total_count: number;
}

interface Department {
  id: number;
  name: string;
  sort_order: number;
}

export default function QueryPanel() {
  const [week, setWeek] = useState<number | undefined>(undefined);
  const [day, setDay] = useState<number | undefined>(undefined);
  const [section, setSection] = useState<number | undefined>(undefined);
  const [department, setDepartment] = useState<string>('');
  const [name, setName] = useState<string>('');
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [results, setResults] = useState<FreeTimeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      const result = await response.json();
      if (result.success) {
        setDepartments(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const handleQuery = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (week) params.append('week', week.toString());
      if (day) params.append('day', day.toString());
      if (section) params.append('section', section.toString());
      if (department) params.append('department', department);
      if (name) params.append('name', name);

      const response = await fetch(`/api/query/free-time?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setResults(result.data);
      } else {
        alert(`查询失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Query error:', error);
      alert('查询失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await fetch('/api/export/reverse-schedule', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reverse-schedule.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('导出失败，请重试');
    }
  };

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedResults(newExpanded);
  };

  const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const sections = Array.from({ length: 11 }, (_, i) => i + 1);
  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-lg p-8"
      >
        <h2 className="text-2xl font-bold text-stone-900 mb-6 flex items-center gap-2">
          <Search className="w-6 h-6 text-purple-600" />
          空闲时间查询
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                周数
              </div>
            </label>
            <select
              value={week || ''}
              onChange={(e) => setWeek(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:border-purple-400 focus:outline-none transition-colors bg-white"
            >
              <option value="">全部周数</option>
              {weeks.map(w => (
                <option key={w} value={w}>第{w}周</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                星期
              </div>
            </label>
            <select
              value={day || ''}
              onChange={(e) => setDay(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:border-purple-400 focus:outline-none transition-colors bg-white"
            >
              <option value="">全部星期</option>
              {weekdays.map((wd, idx) => (
                <option key={idx + 1} value={idx + 1}>{wd}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                节次
              </div>
            </label>
            <select
              value={section || ''}
              onChange={(e) => setSection(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:border-purple-400 focus:outline-none transition-colors bg-white"
            >
              <option value="">全部节次</option>
              {sections.map(s => (
                <option key={s} value={s}>第{s}节</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                部门
              </div>
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:border-purple-400 focus:outline-none transition-colors bg-white"
            >
              <option value="">全部部门</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.name}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                姓名
              </div>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入姓名搜索"
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:border-purple-400 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleQuery}
            disabled={loading}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-stone-300 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                查询中...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                查询空闲时间
              </>
            )}
          </button>

          <button
            onClick={handleExportExcel}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            导出反课表
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-3xl shadow-lg p-8"
          >
            <h3 className="text-xl font-bold text-stone-900 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              查询结果
              <span className="text-sm font-normal text-stone-500">
                (共 {results.length} 条记录)
              </span>
            </h3>

            <div className="space-y-4">
              {results.map((result, index) => (
                <motion.div
                  key={`${result.week}-${result.day}-${result.section}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border border-stone-200 rounded-2xl overflow-hidden"
                >
                  <div
                    className="p-4 bg-gradient-to-r from-purple-50 to-white cursor-pointer hover:from-purple-100 transition-colors"
                    onClick={() => toggleExpand(index)}
                  >
                    {expandedResults.has(index) ? (
                      <ChevronUp className="text-purple-600" />
                    ) : (
                      <ChevronDown className="text-purple-600" />
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-semibold">
                          第{result.week}周
                        </span>
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                          {weekdays[result.day - 1]}
                        </span>
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
                          第{result.section}节
                        </span>
                      </div>
                      <span className="text-2xl font-bold text-purple-600">
                        {result.total_count}人
                      </span>
                    </div>

                    <AnimatePresence>
                      {expandedResults.has(index) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-stone-200"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {result.free_people.map((person, personIdx) => (
                              <div
                                key={`${person.schedule_id}-${personIdx}`}
                                className="bg-stone-50 rounded-xl p-3 border border-stone-200"
                              >
                                <div className="font-semibold text-stone-900 mb-1">
                                  {person.name}
                                </div>
                                <div className="text-sm text-stone-500">
                                  {person.department}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
