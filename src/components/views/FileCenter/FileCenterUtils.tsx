import { FileText, Image, Video, FileArchive, Music, File } from 'lucide-react';

export const categoryIcons: Record<string, React.ReactNode> = {
  video: <Video size={16} />,
  image: <Image size={16} />,
  document: <FileText size={16} />,
  archive: <FileArchive size={16} />,
  audio: <Music size={16} />,
  other: <File size={16} />,
  tweet: <FileText size={16} />,
};

export const categoryLabels: Record<string, string> = {
  video: '视频',
  image: '图片',
  document: '文档',
  archive: '压缩包',
  audio: '音频',
  other: '其他',
  tweet: '推文',
};

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function detectFileCategory(mimeType: string, filename: string): string {
  const mime = mimeType.toLowerCase();
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // 图片
  if (mime.startsWith('image/')) return 'image';
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'heic', 'heif', 'raw', 'cr2', 'nef', 'psd', 'ai', 'eps'];
  if (imageExts.includes(ext)) return 'image';

  // 视频
  if (mime.startsWith('video/')) return 'video';
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', '3gp', 'ogv', 'ts'];
  if (videoExts.includes(ext)) return 'video';

  // 音频
  if (mime.startsWith('audio/')) return 'audio';
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus', 'aiff', 'ape'];
  if (audioExts.includes(ext)) return 'audio';

  // 压缩包
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lz', 'lzma', 'zst', 'arj', 'cab', 'iso', 'dmg'];
  if (archiveExts.includes(ext)) return 'archive';
  if (mime) {
    const archiveMimes = ['application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed',
      'application/x-7z-compressed', 'application/x-tar', 'application/gzip', 'application/x-bzip2',
      'application/x-xz', 'application/x-compressed', 'application/x-stuffit'];
    if (archiveMimes.some(m => mime === m || mime.startsWith(m))) return 'archive';
  }

  // 文档
  if (mime === 'application/pdf') return 'document';
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/javascript') return 'document';
  if (mime.includes('word') || mime.includes('excel') || mime.includes('powerpoint') || mime.includes('document') || mime.includes('presentation') || mime.includes('spreadsheet')) return 'document';
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'odt', 'ods', 'odp', 'md', 'tex', 'epub', 'mobi', 'pages', 'numbers', 'key'];
  if (docExts.includes(ext)) return 'document';

  return 'other';
}
