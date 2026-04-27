import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, FileSpreadsheet, CheckCircle, AlertCircle, ArrowRight, Loader } from 'lucide-react';
import { importExportApi } from '../services/scoringApi.ts';

interface ParsedTemplate {
  name: string;
  total_score: number;
  dimensions: Array<{
    name: string;
    max_score: number;
    subdimensions: Array<{ name: string; max_score: number; description: string }>;
  }>;
}

interface ParsedContestant {
  number: string;
  name: string;
  group_name: string;
}

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitionId?: number;
  onImportTemplate?: (template: ParsedTemplate) => void;
  onImportContestants?: (contestants: ParsedContestant[], competitionId: number) => void;
  competitions?: Array<{ id: number; name: string }>;
}

type Step = 'choose' | 'template-preview' | 'contestants-select' | 'contestants-preview' | 'loading';

export default function ImportExcelModal({
  isOpen,
  onClose,
  competitionId,
  onImportTemplate,
  onImportContestants,
  competitions = [],
}: ImportExcelModalProps) {
  const [step, setStep] = useState<Step>('choose');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [contestantsFile, setContestantsFile] = useState<File | null>(null);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number>(competitionId || 0);
  const [parsedTemplate, setParsedTemplate] = useState<ParsedTemplate | null>(null);
  const [parsedContestants, setParsedContestants] = useState<ParsedContestant[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const templateInputRef = useRef<HTMLInputElement>(null);
  const contestantsInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep('choose');
    setTemplateFile(null);
    setContestantsFile(null);
    setSelectedCompetitionId(competitionId || 0);
    setParsedTemplate(null);
    setParsedContestants([]);
    setError('');
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleParseTemplate(file: File) {
    setTemplateFile(file);
    setLoading(true);
    setError('');
    try {
      const result = await importExportApi.parseTemplate(file) as { success: boolean; data?: ParsedTemplate; error?: string };
      if (!result.success || !result.data) {
        setError(result.error || '解析失败');
        setStep('choose');
      } else {
        setParsedTemplate(result.data);
        setStep('template-preview');
      }
    } catch (e) {
      setError((e as Error).message);
      setStep('choose');
    } finally {
      setLoading(false);
    }
  }

  async function handleParseContestants(file: File) {
    setContestantsFile(file);
    setLoading(true);
    setError('');
    try {
      const result = await importExportApi.parseContestants(file) as { success: boolean; data?: { contestants: ParsedContestant[] }; error?: string };
      if (!result.success || !result.data) {
        setError(result.error || '解析失败');
      } else {
        setParsedContestants(result.data.contestants || []);
        setStep('contestants-preview');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleConfirmTemplate() {
    if (parsedTemplate && onImportTemplate) {
      onImportTemplate(parsedTemplate);
      handleClose();
    }
  }

  function handleConfirmContestants() {
    if (parsedContestants.length > 0 && selectedCompetitionId && onImportContestants) {
      onImportContestants(parsedContestants, selectedCompetitionId);
      handleClose();
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
            className="bg-surface rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container-high">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg font-headline">导入 Excel</h3>
                  <p className="text-xs text-outline">AI 智能识别模板和选手名单</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-surface-container-low rounded-lg transition-colors">
                <X size={20} className="text-outline" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-xl flex items-center gap-2 text-error text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {/* Step: Choose */}
              {step === 'choose' && (
                <div className="space-y-4">
                  <div
                    className="border-2 border-dashed border-surface-container-high rounded-2xl p-8 text-center hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => templateInputRef.current?.click()}
                  >
                    <Upload size={32} className="mx-auto text-outline mb-3" />
                    <p className="font-medium text-on-surface">上传评分模板 Excel</p>
                    <p className="text-sm text-outline mt-1">AI 自动识别维度、子维度、满分</p>
                    <input
                      ref={templateInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleParseTemplate(file);
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-surface-container-high" />
                    <span className="text-sm text-outline">或</span>
                    <div className="flex-1 h-px bg-surface-container-high" />
                  </div>

                  <div
                    className="border-2 border-dashed border-surface-container-high rounded-2xl p-8 text-center hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => contestantsInputRef.current?.click()}
                  >
                    <Upload size={32} className="mx-auto text-outline mb-3" />
                    <p className="font-medium text-on-surface">上传选手名单 Excel</p>
                    <p className="text-sm text-outline mt-1">AI 自动识别编号、姓名、组别</p>
                    <input
                      ref={contestantsInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleParseContestants(file);
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Step: Template Preview */}
              {step === 'template-preview' && parsedTemplate && (
                <div className="space-y-4">
                  <div className="p-4 bg-surface-container-low rounded-xl">
                    <div className="text-sm text-outline mb-1">模板名称</div>
                    <div className="font-bold text-lg">{parsedTemplate.name}</div>
                    <div className="text-sm text-outline mt-1">总分：{parsedTemplate.total_score}</div>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {parsedTemplate.dimensions.map((dim, i) => (
                      <div key={i} className="p-3 bg-surface-container-lowest border border-surface-container-high rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{dim.name}</span>
                          <span className="text-sm text-primary font-medium">{dim.max_score}分</span>
                        </div>
                        {dim.subdimensions.length > 0 && (
                          <div className="space-y-1 pl-3 border-l-2 border-primary/20">
                            {dim.subdimensions.map((sub, j) => (
                              <div key={j} className="flex items-center justify-between text-sm">
                                <span className="text-on-surface-variant">{sub.name}</span>
                                <span className="text-outline">{sub.max_score}分</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step: Contestants Select Competition */}
              {step === 'contestants-select' && (
                <div className="space-y-4">
                  <p className="text-sm text-on-surface-variant">请选择要导入选手的比赛：</p>
                  <select
                    value={selectedCompetitionId}
                    onChange={(e) => setSelectedCompetitionId(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value={0}>选择比赛...</option>
                    {competitions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Step: Contestants Preview */}
              {step === 'contestants-preview' && (
                <div className="space-y-4">
                  <div className="p-4 bg-surface-container-low rounded-xl">
                    <div className="font-medium">识别到 {parsedContestants.length} 名选手</div>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {parsedContestants.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 bg-surface-container-lowest rounded-lg">
                        <span className="text-sm text-outline w-6">{i + 1}</span>
                        <span className="font-medium text-sm">{c.name}</span>
                        <span className="text-sm text-outline">{c.number && `(${c.number})`}</span>
                        <span className="text-sm text-outline ml-auto">{c.group_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading */}
              {step === 'loading' && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader size={32} className="text-primary animate-spin" />
                  <p className="text-on-surface-variant">AI 解析中...</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-surface-container-high flex justify-end gap-3">
              {step === 'template-preview' && (
                <>
                  <button
                    onClick={() => { setStep('choose'); setTemplateFile(null); setParsedTemplate(null); }}
                    className="px-5 py-2.5 bg-surface-container-low text-on-surface-variant font-medium rounded-xl hover:bg-surface-container transition-all"
                  >
                    返回
                  </button>
                  <button
                    onClick={handleConfirmTemplate}
                    className="px-5 py-2.5 bg-primary text-on-primary font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2"
                  >
                    确认导入
                    <ArrowRight size={16} />
                  </button>
                </>
              )}

              {step === 'contestants-preview' && (
                <>
                  <button
                    onClick={() => { setStep('choose'); setContestantsFile(null); setParsedContestants([]); }}
                    className="px-5 py-2.5 bg-surface-container-low text-on-surface-variant font-medium rounded-xl hover:bg-surface-container transition-all"
                  >
                    返回
                  </button>
                  <button
                    onClick={handleConfirmContestants}
                    disabled={!selectedCompetitionId}
                    className="px-5 py-2.5 bg-primary text-on-primary font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    确认导入
                    <ArrowRight size={16} />
                  </button>
                </>
              )}

              {(step === 'choose') && (
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 bg-surface-container-low text-on-surface-variant font-medium rounded-xl hover:bg-surface-container transition-all"
                >
                  关闭
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
