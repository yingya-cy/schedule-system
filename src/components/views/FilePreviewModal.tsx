import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { FileCenterFileItem } from './FileCenter/FileCenterTypes';

declare global { interface Window { pdfjsLib?: any; } }

interface Props {
  isOpen: boolean;
  file: FileCenterFileItem | null;
  onClose: () => void;
}

function getPreviewType(mime: string | null, filename?: string): 'image' | 'video' | 'pdf' | 'docx' | 'text' | 'unsupported' {
  if (!mime) {
    const ext = filename?.toLowerCase() || '';
    if (ext.endsWith('.docx') || ext.endsWith('.doc')) return 'docx'; // antiword handles .doc server-side
    return 'unsupported';
  }
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('wordprocessingml') || mime === 'application/msword') return 'docx'; // .doc via antiword
  if (mime.startsWith('text/') || mime === 'application/json' || mime.includes('javascript')) return 'text';
  return 'unsupported';
}

export default function FilePreviewModal({ isOpen, file, onClose }: Props) {
  const token = useAuthStore((s) => s.token);
  const [displayUrl, setDisplayUrl] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [pdfPage, setPdfPage] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pdfjsLoaded = useRef(false);

  const loadPdfJs = useCallback((): Promise<typeof window.pdfjsLib> => {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
      // v3 UMD build for max compatibility (WeChat old Chrome, iOS WKWebView)
      const CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';
      const script = document.createElement('script');
      script.src = CDN + 'build/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib!.GlobalWorkerOptions.workerSrc = CDN + 'build/pdf.worker.min.js';
        resolve(window.pdfjsLib!);
      };
      script.onerror = () => reject(new Error('PDF.js 加载失败'));
      document.head.appendChild(script);
    });
  }, []);

  const renderPdf = useCallback(async (url: string) => {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument(url).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 1.5 });
      const c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height;
      const ctx = c.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      pages.push(c.toDataURL());
    }
    setPdfPages(pages);
    setPdfPage(0);
  }, []);

  useEffect(() => {
    if (!isOpen || !file) return;
    const previewType = getPreviewType(file.mime_type, file.original_filename);

    async function loadUrl() {
      setLoading(true);
      setError('');
      try {
        if (!file?.oss_object_key) {
          setError('文件信息不完整');
          return;
        }

        if (previewType === 'docx') {
          const res = await fetch(`/api/file-center/oss/preview?key=${encodeURIComponent(file.oss_object_key!)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error('文档加载失败');
          setTextContent(await res.text());
        } else if (previewType === 'text') {
          const res = await fetch('/api/file-center/oss/download-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ object_key: file.oss_object_key }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error);
          const textRes = await fetch(json.data.downloadUrl);
          setTextContent(await textRes.text());
          setDownloadUrl(json.data.downloadUrl);
        } else if (previewType === 'pdf') {
          const [dlRes, proxyRes] = await Promise.all([
            fetch('/api/file-center/oss/download-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ object_key: file.oss_object_key }),
            }),
            fetch(`/api/file-center/oss/preview?key=${encodeURIComponent(file.oss_object_key)}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);
          const dlJson = await dlRes.json();
          if (!dlJson.success) throw new Error(dlJson.error);
          if (!proxyRes.ok) throw new Error('PDF 加载失败');
          const blob = await proxyRes.blob();
          const url = URL.createObjectURL(blob);
          setDisplayUrl(url);
          setDownloadUrl(dlJson.data.downloadUrl);
          await renderPdf(url);
        } else {
          const res = await fetch('/api/file-center/oss/download-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ object_key: file.oss_object_key }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error);
          setDisplayUrl(json.data.downloadUrl);
          setDownloadUrl(json.data.downloadUrl);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        setLoading(false);
      }
    }

    loadUrl();
    return () => {
      if (displayUrl) URL.revokeObjectURL(displayUrl);
      setDisplayUrl(''); setDownloadUrl(''); setTextContent(''); setError(''); setPdfPages([]); setPdfPage(0);
    };
  }, [isOpen, file?.id]);

  if (!file) return null;
  const previewType = getPreviewType(file.mime_type, file.original_filename);

  function renderContent() {
    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-primary" /></div>;
    if (error) return <div className="text-center py-16 text-error text-sm">{error}</div>;

    switch (previewType) {
      case 'image':
        return <img src={displayUrl} alt={file?.original_filename} className="max-w-full max-h-[70vh] object-contain rounded-lg" />;
      case 'video':
        return <video src={displayUrl} controls preload="metadata" playsInline crossOrigin="anonymous" className="max-w-full max-h-[70vh] rounded-lg bg-black" />;
      case 'pdf':
        if (pdfPages.length > 0) {
          return (
            <div className="flex flex-col items-center">
              <img src={pdfPages[pdfPage]} alt={`第${pdfPage + 1}页`} className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg" />
              {pdfPages.length > 1 && (
                <div className="flex items-center gap-3 mt-3">
                  <button onClick={() => setPdfPage(p => Math.max(0, p - 1))} disabled={pdfPage === 0}
                    className="p-1.5 rounded-lg hover:bg-surface-container-low disabled:opacity-30"><ChevronLeft size={18} /></button>
                  <span className="text-xs text-on-surface-variant">{pdfPage + 1} / {pdfPages.length}</span>
                  <button onClick={() => setPdfPage(p => Math.min(pdfPages.length - 1, p + 1))} disabled={pdfPage >= pdfPages.length - 1}
                    className="p-1.5 rounded-lg hover:bg-surface-container-low disabled:opacity-30"><ChevronRight size={18} /></button>
                </div>
              )}
              <a href={downloadUrl} download={file?.original_filename} className="text-xs text-primary hover:underline mt-2">下载</a>
            </div>
          );
        }
        return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-primary" /></div>;
      case 'docx':
        return <iframe srcDoc={textContent} className="w-full h-[75vh] rounded-lg border border-surface-container-high" />;
      case 'text':
        return <pre className="max-h-[70vh] overflow-auto bg-surface-container-lowest rounded-lg p-4 text-xs text-on-surface whitespace-pre-wrap font-mono">{textContent}</pre>;
      default:
        return (
          <div className="text-center py-16 text-on-surface-variant text-sm space-y-3">
            <p>暂不支持在线预览此文件格式</p>
            {downloadUrl && (
              <a href={downloadUrl} download={file?.original_filename}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-medium hover:bg-primary/90 transition-colors">
                <Download size={14} /> 下载文件
              </a>
            )}
          </div>
        );
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-4 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-surface rounded-2xl border border-surface-container-high shadow-2xl w-full max-w-5xl max-h-full overflow-hidden flex flex-col pointer-events-auto" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container-high shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-on-surface truncate">{file.original_filename}</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {previewType === 'unsupported' ? '不支持预览' : `${previewType} 预览`}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  {downloadUrl && (
                    <a href={downloadUrl} download={file.original_filename} className="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors" title="下载">
                      <Download size={18} />
                    </a>
                  )}
                  <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-on-surface transition-colors" title="关闭">
                    <X size={18} />
                  </button>
                </div>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
                {renderContent()}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
