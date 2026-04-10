import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, 
  Search, 
  FileText, 
  FileSpreadsheet,
  Trash2,
  Eye,
  RefreshCw,
  Check,
  AlertCircle,
  X,
  ChevronDown,
  Filter,
  Square,
  User,
  Building2,
  Edit3,
  FileCheck,
  Download,
  FileImage,
  FolderOpen,
  Users,
  Calendar,
  TrendingUp,
  Clock,
  FileUp,
  Sparkles,
  MoreVertical,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { 
  ScheduleData, 
  EditableCourse, 
  Department,
  ProcessResult
} from '@/types';
import { api } from '@/services/api';
import { processSingleFile } from '@/services/fileProcessor';
import ScheduleEditor from '@/components/ScheduleEditor';
import ManualScheduleEntry from '@/components/ManualScheduleEntry';

type ViewMode = 'list' | 'upload' | 'batch_result' | 'edit' | 'manual_entry';

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  currentFile?: string;
  processedCount: number;
  totalCount: number;
}

interface BatchResult {
  id: string;
  filename: string;
  courses: EditableCourse[];
  success: boolean;
  error?: string;
  saved?: boolean;
  name?: string;
  department?: string;
  file_data?: string;
  file_type?: string;
  schedule_id?: number;
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function FilesView() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [schedules, setSchedules] = useState<ScheduleData[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [searchName, setSearchName] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    success: false,
    processedCount: 0,
    totalCount: 0
  });
  const [editableCourses, setEditableCourses] = useState<EditableCourse[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [currentEditIndex, setCurrentEditIndex] = useState<number | null>(null);
  const [currentScheduleId, setCurrentScheduleId] = useState<number | null>(null);
  
  const [editName, setEditName] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [searchName, filterDepartment]);

  const loadData = async () => {
    try {
      const deptData = await api.getDepartments();
      setDepartments(deptData);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const data = await api.getSchedules({
        department: filterDepartment || undefined,
        name: searchName || undefined
      });
      setSchedules(data);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleAbortUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploadState({
      isUploading: false,
      progress: 0,
      error: '识别已中断',
      success: false,
      processedCount: 0,
      totalCount: 0
    });
  };

  const handleFileUpload = async (files: File[]) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const validFiles = files.filter(file => {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const isImage = validTypes.slice(1).includes(file.type);
      return isPdf || isImage;
    });
    
    if (validFiles.length === 0) {
      setUploadState({
        isUploading: false,
        progress: 0,
        error: '请上传 PDF 或图片文件',
        success: false,
        processedCount: 0,
        totalCount: 0
      });
      return;
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setUploadState({
      isUploading: true,
      progress: 0,
      error: null,
      success: false,
      processedCount: 0,
      totalCount: validFiles.length
    });

    const results: BatchResult[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      if (signal.aborted) break;
      
      const file = validFiles[i];
      setUploadState(prev => ({
        ...prev,
        currentFile: file.name,
        processedCount: i,
        progress: Math.round((i / validFiles.length) * 100)
      }));

      try {
        const result = await processSingleFile(file, signal);
        
        if (result.success && result.courses && result.courses.length > 0) {
          const courses: EditableCourse[] = result.courses.map((course, index) => {
            const weekday = parseWeekday(course.time);
            const sections = parseSections(course.time);
            const weeks = parseWeeks(course.weeks, course.weeksList);
            
            return {
              id: `ocr-${i}-${index}-${Date.now()}`,
              course_name: course.courseName,
              weekday,
              sections,
              weeks,
              teacher: course.teacher || '',
              location: course.classroom || '',
              remark: course.remark || '',
              isNew: true
            };
          });

          const fileData = await readFileAsBase64(file);
          
          results.push({
            id: `batch-${i}-${Date.now()}`,
            filename: file.name,
            courses,
            success: true,
            file_data: fileData,
            file_type: file.type
          });
        } else {
          results.push({
            id: `batch-${i}-${Date.now()}`,
            filename: file.name,
            courses: [],
            success: false,
            error: result.error || '识别失败'
          });
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          break;
        }
        results.push({
          id: `batch-${i}-${Date.now()}`,
          filename: file.name,
          courses: [],
          success: false,
          error: err.message || '处理失败'
        });
      }
    }

    if (!signal.aborted) {
      setBatchResults(results);
      
      const successResults = results.filter(r => r.success);
      if (successResults.length > 0) {
        setUploadState({
          isUploading: false,
          progress: 100,
          error: null,
          success: true,
          processedCount: validFiles.length,
          totalCount: validFiles.length
        });
        setViewMode('batch_result');
      } else {
        setUploadState({
          isUploading: false,
          progress: 0,
          error: '所有文件识别失败',
          success: false,
          processedCount: validFiles.length,
          totalCount: validFiles.length
        });
      }
    }

    abortControllerRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseWeekday = (timeStr: string): number => {
    const dayMap: Record<string, number> = {
      '星期一': 1, '周一': 1, '一': 1,
      '星期二': 2, '周二': 2, '二': 2,
      '星期三': 3, '周三': 3, '三': 3,
      '星期四': 4, '周四': 4, '四': 4,
      '星期五': 5, '周五': 5, '五': 5,
      '星期六': 6, '周六': 6, '六': 6,
      '星期日': 7, '周日': 7, '日': 7, '星期天': 7
    };
    
    for (const [key, value] of Object.entries(dayMap)) {
      if (timeStr.includes(key)) return value;
    }
    return 1;
  };

  const parseSections = (timeStr: string): number[] => {
    const match = timeStr.match(/(\d+)[-~](\d+)节?/);
    if (match) {
      const start = parseInt(match[1]);
      const end = parseInt(match[2]);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    
    const singleMatch = timeStr.match(/第?(\d+)节?/);
    if (singleMatch) {
      return [parseInt(singleMatch[1])];
    }
    
    return [1, 2];
  };

  const parseWeeks = (weeksStr: string, weeksList?: number[]): number[] => {
    // 优先使用后端返回的 weeks_list 数组
    if (weeksList && weeksList.length > 0) {
      return weeksList;
    }
    
    // 如果没有 weeks_list，则解析字符串
    if (!weeksStr) return Array.from({ length: 18 }, (_, i) => i + 1);
    
    // 匹配单个周数，例如 "4周"
    const singleMatch = weeksStr.match(/^(\d+)周$/);
    if (singleMatch) {
      return [parseInt(singleMatch[1])];
    }
    
    // 匹配周数范围，例如 "1-16周"
    const match = weeksStr.match(/(\d+)[-~](\d+)/);
    if (match) {
      const start = parseInt(match[1]);
      const end = parseInt(match[2]);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    
    // 匹配多个周数，例如 "1周,3周,5周" 或 "1,3,5周"
    const multiMatch = weeksStr.match(/(\d+)[,，]/g);
    if (multiMatch) {
      const weeks = multiMatch.map(m => parseInt(m.match(/\d+/)![0]));
      // 检查最后一个数字
      const lastMatch = weeksStr.match(/[,，](\d+)周?$/);
      if (lastMatch) {
        weeks.push(parseInt(lastMatch[1]));
      }
      return weeks.sort((a, b) => a - b);
    }
    
    return Array.from({ length: 18 }, (_, i) => i + 1);
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
      
      setEditableCourses([]);
      setEditName('');
      setEditDepartment('');
      setCurrentEditIndex(null);
      setCurrentScheduleId(null);
      
      if (batchResults.length > 0 && currentEditIndex !== null) {
        setViewMode('batch_result');
      } else {
        setViewMode('list');
      }
      
      loadSchedules();
    } catch (err: any) {
      console.error('Failed to save schedule:', err);
      alert('保存失败：' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm('确定要删除这个课表吗？')) return;
    
    try {
      await api.deleteSchedule(id);
      loadSchedules();
    } catch (err: any) {
      alert('删除失败：' + err.message);
    }
  };

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
    
    setEditableCourses([]);
    setEditName('');
    setEditDepartment('');
    setCurrentEditIndex(null);
    setUploadState({
      isUploading: false,
      progress: 0,
      error: null,
      success: false,
      processedCount: 0,
      totalCount: 0
    });
  };

  const handleBackToList = () => {
    setViewMode('list');
    setBatchResults([]);
    setEditableCourses([]);
    setEditName('');
    setEditDepartment('');
    setCurrentEditIndex(null);
    setUploadState({
      isUploading: false,
      progress: 0,
      error: null,
      success: false,
      processedCount: 0,
      totalCount: 0
    });
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
      loadSchedules();
    } catch (err: any) {
      console.error('Failed to save manual schedule:', err);
      alert('手动录入失败：' + err.message);
    }
  };

  const handleRemoveBatchResult = (index: number) => {
    setBatchResults(prev => prev.filter((_, i) => i !== index));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return formatDate(dateStr);
  };

  const unsavedCount = batchResults.filter(r => r.success && !r.saved).length;

  const stats = {
    total: schedules.length,
    departmentCount: new Set(schedules.map(s => s.department)).size,
    recentCount: schedules.filter(s => {
      const date = new Date(s.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date > weekAgo;
    }).length,
    withFile: schedules.filter(s => s.filename).length
  };

  const departmentStats = departments.map(dept => ({
    name: dept.name,
    count: schedules.filter(s => s.department === dept.name).length
  })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);

  const recentSchedules = [...schedules]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {viewMode === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
                    <FileSpreadsheet className="text-on-primary" size={20} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-on-surface tracking-tight">课表中心</h1>
                    <p className="text-sm text-on-surface-variant">上传识别、编辑管理和查询统计课表</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setViewMode('manual_entry')}
                  className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 transition-all flex items-center gap-2"
                >
                  <FileText size={18} />
                  手动录入
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setUploadState({ isUploading: false, progress: 0, error: null, success: false, processedCount: 0, totalCount: 0 });
                    setViewMode('upload');
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-on-primary font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all flex items-center gap-2"
                >
                  <FileUp size={18} />
                  上传课表
                </motion.button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low rounded-2xl p-5 border border-surface-container-high shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileSpreadsheet className="text-primary" size={20} />
                  </div>
                  <TrendingUp className="text-green-500" size={16} />
                </div>
                <div className="text-3xl font-bold text-on-surface mb-1">{stats.total}</div>
                <div className="text-sm text-on-surface-variant">总课表数</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low rounded-2xl p-5 border border-surface-container-high shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Users className="text-blue-500" size={20} />
                  </div>
                  <Building2 className="text-blue-400" size={16} />
                </div>
                <div className="text-3xl font-bold text-on-surface mb-1">{stats.departmentCount}</div>
                <div className="text-sm text-on-surface-variant">部门数量</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low rounded-2xl p-5 border border-surface-container-high shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Clock className="text-amber-500" size={20} />
                  </div>
                  <Calendar className="text-amber-400" size={16} />
                </div>
                <div className="text-3xl font-bold text-on-surface mb-1">{stats.recentCount}</div>
                <div className="text-sm text-on-surface-variant">本周新增</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low rounded-2xl p-5 border border-surface-container-high shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <FileImage className="text-purple-500" size={20} />
                  </div>
                  <Sparkles className="text-purple-400" size={16} />
                </div>
                <div className="text-3xl font-bold text-on-surface mb-1">{stats.withFile}</div>
                <div className="text-sm text-on-surface-variant">含源文件</div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-surface-container-high bg-gradient-to-r from-surface-container-low/50 to-transparent">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 overflow-x-auto flex-1 pb-1">
                        <button
                          onClick={() => setFilterDepartment('')}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                            filterDepartment === ''
                              ? "bg-primary text-on-primary"
                              : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                          )}
                        >
                          全部
                        </button>
                        {departments.map((dept) => (
                          <button
                            key={dept.id}
                            onClick={() => setFilterDepartment(dept.name)}
                            className={cn(
                              "px-3 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                              filterDepartment === dept.name
                                ? "bg-primary text-on-primary"
                                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                            )}
                          >
                            {dept.name}
                          </button>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <AnimatePresence>
                          {showSearch && (
                            <motion.input
                              initial={{ width: 0, opacity: 0 }}
                              animate={{ width: 200, opacity: 1 }}
                              exit={{ width: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              type="text"
                              placeholder="搜索姓名..."
                              value={searchName}
                              onChange={(e) => setSearchName(e.target.value)}
                              autoFocus
                              className="px-4 py-2 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-sm"
                            />
                          )}
                        </AnimatePresence>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            if (showSearch && searchName) {
                              setSearchName('');
                            }
                            setShowSearch(!showSearch);
                          }}
                          className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"
                        >
                          {showSearch && searchName ? (
                            <X className="text-primary" size={18} />
                          ) : (
                            <Search className="text-primary" size={18} />
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </div>

                  {loading ? (
                    <div className="p-12 text-center">
                      <RefreshCw className="animate-spin mx-auto text-primary mb-3" size={32} />
                      <p className="text-on-surface-variant">加载中...</p>
                    </div>
                  ) : schedules.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-surface-container-low mx-auto mb-4 flex items-center justify-center">
                        <FileText className="text-outline" size={32} />
                      </div>
                      <p className="text-on-surface-variant font-medium">暂无课表数据</p>
                      <p className="text-sm text-outline mt-1">点击上方按钮上传课表</p>
                    </div>
                  ) : (
                    <motion.div
                      variants={staggerContainer}
                      initial="hidden"
                      animate="show"
                      className="divide-y divide-surface-container-high"
                    >
                      {schedules.map((schedule, index) => (
                        <motion.div
                          key={schedule.id}
                          variants={staggerItem}
                          className="p-4 hover:bg-surface-container-low/50 transition-colors group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                              <FileSpreadsheet className="text-primary" size={22} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-on-surface truncate">{schedule.name}</h4>
                                {schedule.filename && (
                                  <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 text-xs font-medium rounded-full flex items-center gap-1">
                                    <FileImage size={10} />
                                    源文件
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                                <span className="flex items-center gap-1">
                                  <Building2 size={12} />
                                  {schedule.department}
                                </span>
                                <span className="text-outline">·</span>
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {formatRelativeTime(schedule.created_at)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {schedule.filename && (
                                <>
                                  <button
                                    onClick={() => window.open(api.getScheduleFileUrl(schedule.id), '_blank')}
                                    className="p-2 bg-surface-container-low text-on-surface-variant rounded-lg hover:bg-purple-500 hover:text-white transition-all"
                                    title="查看源文件"
                                  >
                                    <ExternalLink size={16} />
                                  </button>
                                  <a
                                    href={api.getScheduleFileUrl(schedule.id, true)}
                                    download={schedule.filename}
                                    className="p-2 bg-surface-container-low text-on-surface-variant rounded-lg hover:bg-primary hover:text-on-primary transition-all"
                                    title="下载源文件"
                                  >
                                    <Download size={16} />
                                  </a>
                                </>
                              )}
                              <button
                                onClick={() => handleViewSchedule(schedule)}
                                className="px-3 py-2 bg-primary text-on-primary text-sm font-medium rounded-lg hover:bg-primary/90 transition-all flex items-center gap-1.5"
                              >
                                <Eye size={14} />
                                查看
                              </button>
                              <button
                                onClick={() => handleDeleteSchedule(schedule.id)}
                                className="p-2 text-outline hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm p-5">
                  <h3 className="font-semibold text-on-surface mb-4 flex items-center gap-2">
                    <TrendingUp className="text-primary" size={18} />
                    课表上传情况
                  </h3>
                  {departmentStats.length === 0 ? (
                    <p className="text-sm text-on-surface-variant text-center py-4">暂无数据</p>
                  ) : (
                    <div className="space-y-3">
                      {departmentStats.slice(0, 5).map((dept, index) => {
                        const percentage = stats.total > 0 ? (dept.count / stats.total) * 100 : 0;
                        const colors = ['bg-primary', 'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-purple-500'];
                        return (
                          <div key={dept.name} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-on-surface-variant">{dept.name}</span>
                              <span className="font-medium text-on-surface">{dept.count}</span>
                            </div>
                            <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ delay: 0.1 + index * 0.05, duration: 0.5 }}
                                className={cn("h-full rounded-full", colors[index % colors.length])}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm p-5">
                  <h3 className="font-semibold text-on-surface mb-4 flex items-center gap-2">
                    <Clock className="text-amber-500" size={18} />
                    最近上传
                  </h3>
                  {recentSchedules.length === 0 ? (
                    <p className="text-sm text-on-surface-variant text-center py-4">暂无数据</p>
                  ) : (
                    <div className="space-y-3">
                      {recentSchedules.map((schedule) => (
                        <div
                          key={schedule.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
                          onClick={() => handleViewSchedule(schedule)}
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FileSpreadsheet className="text-primary" size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-on-surface truncate">{schedule.name}</p>
                            <p className="text-xs text-on-surface-variant">{formatRelativeTime(schedule.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-on-surface tracking-tight">上传课表</h1>
                <p className="text-sm text-on-surface-variant mt-1">支持 PDF 和图片格式，可批量上传</p>
              </div>
              <button
                onClick={handleBackToList}
                className="px-4 py-2 bg-surface-container-low text-on-surface-variant font-medium rounded-xl hover:bg-surface-container transition-all flex items-center gap-2"
              >
                <X size={18} />
                返回
              </button>
            </div>

            <div
              ref={dragRef}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={cn(
                "relative bg-surface-container-lowest rounded-2xl border-2 border-dashed transition-all overflow-hidden",
                uploadState.isUploading ? "border-surface-container-high cursor-default" : "border-surface-container-high hover:border-primary/50 cursor-pointer",
                isDragging && "border-primary bg-primary/5"
              )}
              onClick={() => !uploadState.isUploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {!uploadState.isUploading && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />
              )}
              
              <div className="p-12 text-center relative">
                {uploadState.isUploading ? (
                  <div className="space-y-4">
                    <div className="w-20 h-20 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center">
                      <RefreshCw className="animate-spin text-primary" size={36} />
                    </div>
                    <div>
                      <p className="text-on-surface font-semibold text-lg">正在识别课表...</p>
                      <p className="text-sm text-on-surface-variant mt-1">
                        {uploadState.currentFile && `正在处理: ${uploadState.currentFile}`}
                      </p>
                    </div>
                    <div className="w-full max-w-sm mx-auto">
                      <div className="flex justify-between text-xs text-on-surface-variant mb-2">
                        <span>{uploadState.processedCount} / {uploadState.totalCount} 个文件</span>
                        <span className="font-medium text-primary">{uploadState.progress}%</span>
                      </div>
                      <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadState.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAbortUpload(); }}
                      className="px-5 py-2.5 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-all flex items-center gap-2 mx-auto"
                    >
                      <Square size={16} />
                      中断识别
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mx-auto flex items-center justify-center">
                      <Upload className="text-primary" size={36} />
                    </div>
                    <div>
                      <p className="text-on-surface font-semibold text-lg">拖拽文件到这里，或点击上传</p>
                      <p className="text-sm text-on-surface-variant mt-1">支持 PDF、PNG、JPG 格式，可批量上传</p>
                    </div>
                    <div className="flex items-center justify-center gap-4 text-xs text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <FileText size={14} />
                        PDF 文档
                      </span>
                      <span className="flex items-center gap-1">
                        <FileImage size={14} />
                        图片文件
                      </span>
                    </div>
                  </div>
                )}

                {uploadState.error && (
                  <div className="mt-4 bg-red-50 text-red-600 rounded-xl p-3 flex items-center justify-center gap-2">
                    <AlertCircle size={18} />
                    {uploadState.error}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'batch_result' && (
          <motion.div
            key="batch_result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-on-surface tracking-tight">识别结果</h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  共 {batchResults.length} 个文件，{batchResults.filter(r => r.success).length} 个识别成功
                  {unsavedCount > 0 && `，${unsavedCount} 个待保存`}
                </p>
              </div>
              <button
                onClick={handleBackToList}
                className="px-4 py-2 bg-primary text-on-primary font-medium rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2"
              >
                <Check size={18} />
                完成并返回
              </button>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="divide-y divide-surface-container-high"
              >
                {batchResults.map((result, index) => (
                  <motion.div
                    key={result.id}
                    variants={staggerItem}
                    className={cn(
                      "p-4 flex items-center gap-4 transition-colors",
                      result.saved && "bg-green-50/50"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                      result.success 
                        ? result.saved 
                          ? "bg-green-100" 
                          : "bg-primary/10"
                        : "bg-red-100"
                    )}>
                      {result.saved ? (
                        <FileCheck className="text-green-600" size={24} />
                      ) : result.success ? (
                        <FileSpreadsheet className="text-primary" size={24} />
                      ) : (
                        <AlertCircle className="text-red-500" size={24} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-on-surface truncate">{result.filename}</h4>
                      <p className="text-sm text-on-surface-variant">
                        {result.success ? (
                          result.saved ? (
                            <span className="text-green-600">
                              已保存: {result.name} ({result.department}) · {result.courses.length} 门课程
                            </span>
                          ) : (
                            <>识别成功 · {result.courses.length} 门课程</>
                          )
                        ) : (
                          <span className="text-red-500">{result.error || '识别失败'}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.success && !result.saved && (
                        <button
                          onClick={() => handleEditBatchResult(index)}
                          className="px-4 py-2 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2"
                        >
                          <Edit3 size={16} />
                          编辑保存
                        </button>
                      )}
                      {result.success && result.saved && (
                        <button
                          onClick={() => handleEditBatchResult(index)}
                          className="px-4 py-2 bg-surface-container-low text-on-surface-variant text-sm font-semibold rounded-lg hover:bg-surface-container transition-all flex items-center gap-2"
                        >
                          <Eye size={16} />
                          查看
                        </button>
                      )}
                      {!result.saved && (
                        <button
                          onClick={() => handleRemoveBatchResult(index)}
                          className="p-2 text-outline hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {unsavedCount > 0 && (
              <div className="bg-amber-50 rounded-xl p-4 flex items-center gap-3 border border-amber-200">
                <AlertCircle className="text-amber-600" size={20} />
                <span className="text-amber-700 font-medium">
                  还有 {unsavedCount} 个课表待保存，请逐个编辑并保存
                </span>
              </div>
            )}
          </motion.div>
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
                <X size={18} />
                返回
              </button>
            </div>

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
            onSave={handleManualSave}
            onCancel={() => setViewMode('list')}
            departments={departments}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
