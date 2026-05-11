import React from 'react';
import { motion } from 'motion/react';
import { Check, FileSpreadsheet, AlertCircle, Edit3, Eye, Trash2 } from 'lucide-react';
import { BatchResult, staggerContainer, staggerItem } from './constants';
import { cn } from '@/lib/utils';

interface BatchResultViewProps {
  batchResults: BatchResult[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onBack: () => void;
}

export default function BatchResultView({
  batchResults,
  onEdit,
  onRemove,
  onBack
}: BatchResultViewProps) {
  const unsavedCount = batchResults.filter(r => r.success && !r.saved).length;
  const successCount = batchResults.filter(r => r.success).length;

  return (
    <motion.div
      key="batch_result"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">识别结果</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            共 {batchResults.length} 个文件，{successCount} 个识别成功
            {unsavedCount > 0 && `，${unsavedCount} 个待保存`}
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-primary text-on-primary font-medium rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2"
        >
          <Check size={18} />
          完成并返回
        </button>
      </div>

      {/* Results list */}
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
              {/* Status icon */}
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                result.success
                  ? result.saved
                    ? "bg-green-100"
                    : "bg-primary/10"
                  : "bg-red-100"
              )}>
                {result.saved ? (
                  <FileSpreadsheet className="text-green-600" size={24} />
                ) : result.success ? (
                  <FileSpreadsheet className="text-primary" size={24} />
                ) : (
                  <AlertCircle className="text-red-500" size={24} />
                )}
              </div>

              {/* File info */}
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

              {/* Actions */}
              <div className="flex items-center gap-2">
                {result.success && !result.saved && (
                  <button
                    onClick={() => onEdit(index)}
                    className="px-4 py-2 bg-primary/12 text-primary text-sm font-semibold rounded-xl hover:bg-primary/20 hover:shadow-[0_2px_8px_rgba(85,144,178,0.10)] transition-all duration-200 flex items-center gap-2"
                  >
                    <Edit3 size={16} />
                    编辑保存
                  </button>
                )}
                {result.success && result.saved && (
                  <button
                    onClick={() => onEdit(index)}
                    className="px-4 py-2 bg-surface-container-low text-on-surface-variant text-sm font-semibold rounded-lg hover:bg-surface-container transition-all flex items-center gap-2"
                  >
                    <Eye size={16} />
                    查看
                  </button>
                )}
                {!result.saved && (
                  <button
                    onClick={() => onRemove(index)}
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

      {/* Warning */}
      {unsavedCount > 0 && (
        <div className="bg-amber-50 rounded-xl p-4 flex items-center gap-3 border border-amber-200">
          <AlertCircle className="text-amber-600" size={20} />
          <span className="text-amber-700 font-medium">
            还有 {unsavedCount} 个课表待保存，请逐个编辑并保存
          </span>
        </div>
      )}
    </motion.div>
  );
}
