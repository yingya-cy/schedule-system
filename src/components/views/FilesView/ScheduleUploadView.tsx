import React, { useRef, useCallback, useState } from 'react';
import { motion } from 'motion/react';
import { Upload, FileText, FileImage, RefreshCw, Square, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UploadState, BatchResult } from './constants';
import { processSingleFile } from '@/services/fileProcessor';
import { readFileAsBase64, parseWeekday, parseSections, parseWeeks } from './utils';

interface ScheduleUploadViewProps {
  uploadState: UploadState;
  onUploadStateChange: (state: UploadState | ((prev: UploadState) => UploadState)) => void;
  onBatchResults: (results: BatchResult[]) => void;
  onBack: () => void;
}

export default function ScheduleUploadView({
  uploadState,
  onUploadStateChange,
  onBatchResults,
  onBack
}: ScheduleUploadViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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
    onUploadStateChange({
      ...uploadState,
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
      onUploadStateChange({
        ...uploadState,
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

    onUploadStateChange({
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
      onUploadStateChange(prev => ({
        ...prev,
        currentFile: file.name,
        processedCount: i,
        progress: Math.round((i / validFiles.length) * 100)
      }));

      try {
        const result = await processSingleFile(file, signal);

        if (result.success && result.courses && result.courses.length > 0) {
          const courses = result.courses.map((course, index) => ({
            id: `ocr-${i}-${index}-${Date.now()}`,
            course_name: course.courseName,
            weekday: parseWeekday(course.time),
            sections: parseSections(course.time),
            weeks: parseWeeks(course.weeks, course.weeksList),
            teacher: course.teacher || '',
            location: course.classroom || '',
            remark: course.remark || '',
            isNew: true
          }));

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
      onBatchResults(results);

      const successResults = results.filter(r => r.success);
      if (successResults.length > 0) {
        onUploadStateChange({
          isUploading: false,
          progress: 100,
          error: null,
          success: true,
          processedCount: validFiles.length,
          totalCount: validFiles.length
        });
      } else {
        onUploadStateChange({
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

  // Inline parse functions (same as original)
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
    if (weeksList && weeksList.length > 0) {
      return weeksList;
    }
    if (!weeksStr) return Array.from({ length: 18 }, (_, i) => i + 1);
    const singleMatch = weeksStr.match(/^(\d+)周$/);
    if (singleMatch) {
      return [parseInt(singleMatch[1])];
    }
    const match = weeksStr.match(/(\d+)[-~](\d+)/);
    if (match) {
      const start = parseInt(match[1]);
      const end = parseInt(match[2]);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    return Array.from({ length: 18 }, (_, i) => i + 1);
  };

  return (
    <motion.div
      key="upload"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">上传课表</h1>
          <p className="text-sm text-on-surface-variant mt-1">支持 PDF 和图片格式，可批量上传</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-surface-container-low text-on-surface-variant font-medium rounded-xl hover:bg-surface-container transition-all flex items-center gap-2"
        >
          <X size={18} />
          返回
        </button>
      </div>

      {/* Drop zone */}
      <div
        ref={dragRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "relative bg-surface-container-lowest rounded-2xl border-2 border-dashed transition-all overflow-hidden",
          uploadState.isUploading
            ? "border-surface-container-high cursor-default"
            : "border-surface-container-high hover:border-primary/50 cursor-pointer",
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
  );
}
