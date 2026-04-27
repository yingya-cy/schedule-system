import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, FileSpreadsheet, AlertCircle, ArrowRight, Loader, CheckCircle } from 'lucide-react';
import { importExportApi } from '../services/scoringApi.ts';
import type { Competition } from '../types/scoring.ts';

interface ExportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitions: Competition[];
}

export default function ExportExcelModal({ isOpen, onClose, competitions }: ExportExcelModalProps) {
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number>(0);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setSelectedCompetitionId(0);
    setTemplateFile(null);
    setLoading(false);
    setError('');
    setSuccess(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleExport() {
    if (!selectedCompetitionId || !templateFile) {
      setError('请选择比赛并上传模板文件');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 获取比赛结果
      const response = await fetch(`/api/scoring/competitions/${selectedCompetitionId}/results`);
      const json = await response.json();

      if (!json.success || !json.data) {
        throw new Error(json.error || '获取结果失败');
      }

      const results = json.data;

      if (results.length === 0) {
        setError('该比赛暂无评分结果，请先计算结果');
        setLoading(false);
        return;
      }

      // 构建结果数据
      const resultData = {
        competition: {
          name: competitions.find(c => c.id === selectedCompetitionId)?.name || '',
          template: null,
        },
        results: results.map((r: any) => ({
          rank: r.rank,
          number: r.number || '',
          name: r.contestant_name || '',
          group_name: r.group_name || '',
          total_score: parseFloat(r.total_score) || 0,
          dimension_scores: r.avg_scores || {},
          score_count: r.score_count || 0,
        })),
      };

      // 调用导出
      const blob = await importExportApi.exportResults(templateFile, resultData);

      // 下载文件
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `评分结果_${competitions.find(c => c.id === selectedCompetitionId)?.name || '比赛'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-surface rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container-high">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Download size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg font-headline">导出评分结果</h3>
                  <p className="text-xs text-outline">上传模板，AI 智能填充数据</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-surface-container-low rounded-lg transition-colors">
                <X size={20} className="text-outline" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-xl flex items-center gap-2 text-error text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {success ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <CheckCircle size={48} className="text-success" />
                  <p className="font-medium text-lg">导出成功！</p>
                  <p className="text-sm text-outline">文件已开始下载</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-on-surface-variant mb-2 block">选择比赛</label>
                    <select
                      value={selectedCompetitionId}
                      onChange={(e) => setSelectedCompetitionId(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value={0}>选择比赛...</option>
                      {competitions.filter(c => c.status === 'completed').map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-on-surface-variant mb-2 block">上传结果模板 Excel</label>
                    <div
                      onClick={() => inputRef.current?.click()}
                      className="border-2 border-dashed border-surface-container-high rounded-xl p-6 text-center hover:border-primary/30 transition-colors cursor-pointer"
                    >
                      {templateFile ? (
                        <div className="flex items-center justify-center gap-2 text-primary">
                          <FileSpreadsheet size={20} />
                          <span className="text-sm font-medium">{templateFile.name}</span>
                        </div>
                      ) : (
                        <>
                          <Download size={24} className="mx-auto text-outline mb-2" />
                          <p className="text-sm text-on-surface-variant">点击上传 Excel 模板</p>
                        </>
                      )}
                      <input
                        ref={inputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setTemplateFile(file);
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-surface-container-high flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-5 py-2.5 bg-surface-container-low text-on-surface-variant font-medium rounded-xl hover:bg-surface-container transition-all"
              >
                {success ? '关闭' : '取消'}
              </button>
              {!success && (
                <button
                  onClick={handleExport}
                  disabled={!selectedCompetitionId || !templateFile || loading}
                  className="px-5 py-2.5 bg-primary text-on-primary font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
                  导出
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
