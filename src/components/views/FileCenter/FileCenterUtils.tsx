import { FileText, Image, Video } from 'lucide-react';

export const categoryIcons: Record<string, React.ReactNode> = {
  video: <Video size={16} />,
  image: <Image size={16} />,
  document: <FileText size={16} />,
  tweet: <FileText size={16} />,
};

export const categoryLabels: Record<string, string> = {
  video: '视频',
  image: '图片',
  document: '文档',
  tweet: '推文',
};

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function detectFileCategory(mimeType: string, filename: string): string {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'document';
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/javascript') return 'document';
  if (mime.includes('word') || mime.includes('excel') || mime.includes('powerpoint') || mime.includes('document')) return 'document';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'];
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  return 'document';
}
