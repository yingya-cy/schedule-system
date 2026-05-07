import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, Edit3, X, FolderPlus, FileText, Image, Video, ExternalLink,
  ChevronRight, ChevronDown, FolderOpen, Upload, Search, Eye, Download
} from 'lucide-react';
import FilePreviewModal from './FilePreviewModal';
import { useAuthStore } from '@/stores/authStore';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Activity {
  id: number;
  name: string;
  description: string | null;
  department: string;
  cover_url: string | null;
  status: 'active' | 'archived';
  created_by: string;
  created_at: string;
}

interface Folder {
  id: number;
  activity_id: number;
  parent_id: number | null;
  name: string;
  sort_order: number;
  created_by: string;
}

interface FileItem {
  id: number;
  original_filename: string;
  stored_filename: string;
  file_size: number;
  mime_type: string | null;
  file_category: string;
  oss_object_key: string | null;
  oss_url: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  item_type: 'file';
}

interface TweetItem {
  id: number;
  title: string;
  content: string | null;
  summary: string | null;
  cover_image: string | null;
  link_url: string | null;
  author: string | null;
  created_by: string;
  created_at: string;
  item_type: 'tweet';
}

type AnyItem = FileItem | TweetItem;

const categoryIcons: Record<string, React.ReactNode> = {
  video: <Video size={16} />,
  image: <Image size={16} />,
  document: <FileText size={16} />,
  tweet: <FileText size={16} />,
};

const categoryLabels: Record<string, string> = {
  video: '视频',
  image: '图片',
  document: '文档',
  tweet: '推文',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectFileCategory(mimeType: string, filename: string): string {
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

export default function FileCenterView() {
  const token = useAuthStore((s) => s.token);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityForm, setActivityForm] = useState({ name: '', department: '', description: '', cover_url: '' });
  const [activityError, setActivityError] = useState('');

  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderForm, setFolderForm] = useState({ name: '', parent_id: '' });
  const [folderError, setFolderError] = useState('');

  const [items, setItems] = useState<{ files: FileItem[]; tweets: TweetItem[]; subfolders: Folder[] }>({ files: [], tweets: [], subfolders: [] });
  const [showItemModal, setShowItemModal] = useState(false);
  const [showTweetModal, setShowTweetModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FileItem | null>(null);
  const [editingTweet, setEditingTweet] = useState<TweetItem | null>(null);
  const [itemForm, setItemForm] = useState({ original_filename: '', file_category: 'document', description: '', oss_url: '' });
  const [tweetForm, setTweetForm] = useState({ title: '', content: '', summary: '', cover_image: '', link_url: '', author: '' });
  const [itemError, setItemError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Permissions
  const [permissions, setPermissions] = useState<any[]>([]);
  const [showPermPanel, setShowPermPanel] = useState(false);
  const [permForm, setPermForm] = useState({ permission_type: 'view', grantee_type: 'department', grantee_name: '' });

  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: number; name: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [showTweetDetail, setShowTweetDetail] = useState<TweetItem | null>(null);

  async function fetchActivities() {
    try {
      const res = await fetch('/api/file-center/activities', { headers });
      const json = await res.json();
      if (json.success) setActivities(json.data);
    } catch { /* ignore */ }
  }

  async function fetchFolders(activityId: number) {
    try {
      const res = await fetch(`/api/file-center/activities/${activityId}/folders`, { headers });
      const json = await res.json();
      if (json.success) setFolders(json.data);
    } catch { /* ignore */ }
  }

  async function fetchItems(folderId: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/file-center/folders/${folderId}/items`, { headers });
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function fetchPermissions(activityId: number) {
    try {
      const res = await fetch(`/api/file-center/permissions/${activityId}`, { headers });
      const json = await res.json();
      if (json.success) setPermissions(json.data);
    } catch { /* ignore */ }
  }

  async function handleAddPermission() {
    if (!selectedActivity || !permForm.grantee_name) return;
    try {
      await fetch('/api/file-center/permissions', {
        method: 'POST', headers,
        body: JSON.stringify({ ...permForm, activity_id: selectedActivity.id }),
      });
      setPermForm({ permission_type: 'view', grantee_type: 'department', grantee_name: '' });
      fetchPermissions(selectedActivity.id);
    } catch { /* ignore */ }
  }

  async function handleRemovePermission(id: number) {
    try {
      await fetch(`/api/file-center/permissions/${id}`, { method: 'DELETE', headers });
      if (selectedActivity) fetchPermissions(selectedActivity.id);
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchActivities(); }, []);

  useEffect(() => {
    if (selectedActivity) {
      Promise.all([fetchFolders(selectedActivity.id), fetchPermissions(selectedActivity.id)]);
    }
  }, [selectedActivity]);

  useEffect(() => {
    if (selectedFolderId) fetchItems(selectedFolderId);
  }, [selectedFolderId]);

  function openCreateActivity() {
    setEditingActivity(null);
    setActivityForm({ name: '', department: '', description: '', cover_url: '' });
    setActivityError('');
    setShowActivityModal(true);
  }

  function openEditActivity(a: Activity) {
    setEditingActivity(a);
    setActivityForm({ name: a.name, department: a.department, description: a.description || '', cover_url: a.cover_url || '' });
    setActivityError('');
    setShowActivityModal(true);
  }

  async function handleSaveActivity() {
    if (!activityForm.name || !activityForm.department) {
      setActivityError('名称和部门为必填项');
      return;
    }
    try {
      if (editingActivity) {
        await fetch(`/api/file-center/activities/${editingActivity.id}`, { method: 'PUT', headers, body: JSON.stringify(activityForm) });
      } else {
        await fetch('/api/file-center/activities', { method: 'POST', headers, body: JSON.stringify(activityForm) });
      }
      setShowActivityModal(false);
      fetchActivities();
    } catch (e: any) {
      setActivityError(e.message);
    }
  }

  function openCreateFolder(parentId: number | null = null) {
    setEditingFolder(null);
    setFolderForm({ name: '', parent_id: parentId ? String(parentId) : '' });
    setFolderError('');
    setShowFolderModal(true);
  }

  function openEditFolder(f: Folder) {
    setEditingFolder(f);
    setFolderForm({ name: f.name, parent_id: f.parent_id ? String(f.parent_id) : '' });
    setFolderError('');
    setShowFolderModal(true);
  }

  async function handleSaveFolder() {
    if (!folderForm.name) {
      setFolderError('文件夹名称为必填项');
      return;
    }
    try {
      if (editingFolder) {
        await fetch(`/api/file-center/folders/${editingFolder.id}`, {
          method: 'PUT', headers,
          body: JSON.stringify({ name: folderForm.name, parent_id: folderForm.parent_id ? Number(folderForm.parent_id) : null })
        });
      } else {
        if (!selectedActivity) return;
        await fetch(`/api/file-center/activities/${selectedActivity.id}/folders`, {
          method: 'POST', headers,
          body: JSON.stringify({ name: folderForm.name, parent_id: folderForm.parent_id ? Number(folderForm.parent_id) : null })
        });
      }
      setShowFolderModal(false);
      if (selectedActivity) fetchFolders(selectedActivity.id);
    } catch (e: any) {
      setFolderError(e.message);
    }
  }

  function uploadToOss(url: string, file: File, contentType: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          // Map 30%–80% range to the upload phase
          setUploadProgress(30 + Math.round((e.loaded / e.total) * 50));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`OSS 上传失败 (${xhr.status})`));
        }
      });

      const onAbort = () => xhr.abort();
      controller.signal.addEventListener('abort', onAbort, { once: true });

      xhr.addEventListener('error', () => reject(new Error('OSS 上传失败：网络错误')));
      xhr.addEventListener('abort', () => reject(new Error('上传已取消')));

      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.setRequestHeader('Content-Disposition', 'inline');
      xhr.send(file);
    });
  }

  function cancelUpload() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setUploading(false);
    setUploadProgress(0);
  }

  async function handleSaveItem() {
    if (!selectedActivity || !selectedFolderId) return;
    setItemError('');
    setUploading(true);
    setUploadProgress(0);
    try {
      if (editingItem) {
        const res = await fetch(`/api/file-center/items/${editingItem.id}`, {
          method: 'PUT', headers,
          body: JSON.stringify({
            original_filename: itemForm.original_filename,
            description: itemForm.description,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setShowItemModal(false);
        setEditingItem(null);
        setItemForm({ original_filename: '', file_category: 'document', description: '', oss_url: '' });
        if (selectedFolderId) fetchItems(selectedFolderId);
      } else if (selectedFiles.length > 0) {
        const controller = new AbortController();
        abortRef.current = controller;
        const total = selectedFiles.length;
        let completed = 0;

        const uploadOne = async (file: File) => {
          const filename = file.name;
          const contentType = file.type || 'application/octet-stream';

          const initRes = await fetch('/api/file-center/oss/init', {
            method: 'POST', headers,
            body: JSON.stringify({
              activity_id: selectedActivity.id,
              folder_id: selectedFolderId,
              original_filename: filename,
              file_size: file.size,
              mime_type: contentType,
              file_category: detectFileCategory(file.type, file.name),
              description: itemForm.description || null,
            }),
            signal: controller.signal,
          });
          const initJson = await initRes.json();
          if (!initJson.success) throw new Error(`${filename}: ${initJson.error}`);

          await uploadToOss(initJson.data.uploadUrl, file, contentType);

          completed++;
          setUploadProgress(Math.round((completed / total) * 100));
        };

        const concurrency = 3;
        for (let i = 0; i < total; i += concurrency) {
          const batch = selectedFiles.slice(i, i + concurrency).map(uploadOne);
          await Promise.all(batch);
        }

        setShowItemModal(false);
        setSelectedFiles([]);
        setItemForm({ original_filename: '', file_category: 'document', description: '', oss_url: '' });
        if (selectedFolderId) fetchItems(selectedFolderId);
      } else if (itemForm.original_filename && itemForm.oss_url) {
        const res = await fetch(`/api/file-center/folders/${selectedFolderId}/items`, {
          method: 'POST', headers,
          body: JSON.stringify({
            activity_id: selectedActivity.id,
            original_filename: itemForm.original_filename,
            file_category: itemForm.file_category,
            description: itemForm.description,
            oss_url: itemForm.oss_url,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setShowItemModal(false);
        setItemForm({ original_filename: '', file_category: 'document', description: '', oss_url: '' });
        if (selectedFolderId) fetchItems(selectedFolderId);
      } else {
        setItemError('请选择文件或填写文件名和 URL');
        setUploading(false);
        return;
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || e.message === '上传已取消') {
        setItemError('');
      } else {
        setItemError(e.message);
      }
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  }

  async function handleSaveTweet() {
    if (!tweetForm.title || !selectedActivity) {
      setItemError('标题为必填项');
      return;
    }
    try {
      if (editingTweet) {
        await fetch(`/api/file-center/tweets/${editingTweet.id}`, {
          method: 'PUT', headers,
          body: JSON.stringify(tweetForm)
        });
      } else {
        await fetch(`/api/file-center/folders/${selectedFolderId}/tweets`, {
          method: 'POST', headers,
          body: JSON.stringify({ ...tweetForm, activity_id: selectedActivity.id })
        });
      }
      setShowTweetModal(false);
      setEditingTweet(null);
      if (selectedFolderId) fetchItems(selectedFolderId);
    } catch (e: any) {
      setItemError(e.message);
    }
  }

  async function handleDownload(file: FileItem) {
    if (!file.oss_object_key) return;
    try {
      const res = await fetch(`/api/file-center/oss/download?key=${encodeURIComponent(file.oss_object_key)}&filename=${encodeURIComponent(file.original_filename)}`, { headers });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const endpoints: Record<string, string> = {
        activity: `/api/file-center/activities/${deleteTarget.id}`,
        folder: `/api/file-center/folders/${deleteTarget.id}`,
        file: `/api/file-center/items/${deleteTarget.id}`,
        tweet: `/api/file-center/tweets/${deleteTarget.id}`,
      };
      const res = await fetch(endpoints[deleteTarget.type], { method: 'DELETE', headers });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '删除失败');
      setDeleteTarget(null);
      if (deleteTarget.type === 'activity') {
        setSelectedActivity(null);
        setSelectedFolderId(null);
        setFolders([]);
        setItems({ files: [], tweets: [], subfolders: [] });
        fetchActivities();
      } else if (deleteTarget.type === 'folder') {
        if (selectedActivity) fetchFolders(selectedActivity.id);
        if (selectedFolderId === deleteTarget.id) setSelectedFolderId(null);
      } else {
        if (selectedFolderId) fetchItems(selectedFolderId);
      }
    } catch (e: any) {
      alert(e.message || '删除失败');
      setDeleteTarget(null);
    }
  }

  // Build folder tree
  function buildTree(parentId: number | null = null): Folder[] {
    return folders
      .filter(f => f.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  function toggleExpand(folderId: number) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function renderFolderTree(folders: Folder[], depth = 0) {
    return folders.map(f => {
      const children = buildTree(f.id);
      const isExpanded = expandedFolders.has(f.id);
      const isSelected = selectedFolderId === f.id;
      return (
        <div key={f.id}>
          <button
            onClick={() => {
              setSelectedFolderId(f.id);
              toggleExpand(f.id);
            }}
            className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
              isSelected ? 'bg-primary/10 text-primary font-medium' : 'text-on-surface hover:bg-surface-container-low'
            }`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            {children.length > 0 ? (
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              <span className="w-3.5" />
            )}
            <FolderOpen size={14} className={isSelected ? 'text-primary' : 'text-outline'} />
            <span className="truncate flex-1 text-left">{f.name}</span>
            <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
              <button onClick={() => openCreateFolder(f.id)} className="p-0.5 hover:bg-primary/10 rounded text-outline hover:text-primary" title="新建子文件夹">
                <FolderPlus size={10} />
              </button>
              <button onClick={() => openEditFolder(f)} className="p-0.5 hover:bg-surface-container-high rounded">
                <Edit3 size={10} />
              </button>
              <button onClick={() => setDeleteTarget({ type: 'folder', id: f.id, name: f.name })} className="p-0.5 hover:bg-red-50 rounded text-red-400">
                <Trash2 size={10} />
              </button>
            </span>
          </button>
          {isExpanded && children.length > 0 && renderFolderTree(children, depth + 1)}
        </div>
      );
    });
  }

  return (
    <div className="space-y-4">
      {!selectedActivity ? (
        /* Activity Selection Grid */
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-on-surface font-headline">文件中心</h2>
            <button
              onClick={openCreateActivity}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors"
            >
              <Plus size={14} /> 新活动
            </button>
          </div>
          {activities.length === 0 ? (
            <div className="text-center py-20 text-on-surface-variant">
              <FolderOpen size={48} className="mx-auto mb-4 text-outline/50" />
              <p className="text-lg font-medium">创建你的第一个活动</p>
              <p className="text-sm mt-1">文件中心按活动组织资料</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {activities.map(a => (
                <div key={a.id} className="group relative bg-surface rounded-2xl border border-surface-container-high p-5 hover:border-primary/30 hover:shadow-md transition-all">
                  <button
                    onClick={() => {
                      setSelectedActivity(a);
                      setSelectedFolderId(null);
                      setItems({ files: [], tweets: [], subfolders: [] });
                      setExpandedFolders(new Set());
                    }}
                    className="w-full text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3">
                      <FolderOpen size={20} />
                    </div>
                    <h3 className="text-sm font-bold text-on-surface font-headline">{a.name}</h3>
                    <p className="text-xs text-on-surface-variant mt-1">{a.department}</p>
                    {a.description && (
                      <p className="text-xs text-outline mt-2 line-clamp-2">{a.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        a.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-outline'
                      }`}>
                        {a.status === 'active' ? '进行中' : '已归档'}
                      </span>
                    </div>
                  </button>
                  <div className="absolute top-3 right-3 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); openEditActivity(a); }}
                      className="p-1.5 hover:bg-surface-container-high rounded-lg text-outline hover:text-primary transition-colors"
                      title="编辑活动"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget({ type: 'activity', id: a.id, name: a.name }); }}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-outline hover:text-red-500 transition-colors"
                      title="删除活动"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="w-56 shrink-0">
            <button
              onClick={() => {
                setSelectedActivity(null);
                setSelectedFolderId(null);
                setItems({ files: [], tweets: [], subfolders: [] });
                setExpandedFolders(new Set());
              }}
              className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-xl text-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
            >
              <ChevronRight size={14} className="rotate-180" />
              <span className="truncate">{selectedActivity.name}</span>
            </button>

            <div className="bg-surface rounded-2xl border border-surface-container-high p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-outline uppercase tracking-wider">目录</h3>
                <button
                  onClick={() => openCreateFolder(selectedFolderId)}
                  className="p-1 hover:bg-surface-container-low rounded-lg text-outline hover:text-primary transition-colors"
                  title={selectedFolderId ? '新建子文件夹' : '新建文件夹'}
                >
                  <FolderPlus size={14} />
                </button>
              </div>
              <div className="space-y-0.5 max-h-[65vh] overflow-y-auto">
                {buildTree().length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-2 px-2">暂无文件夹</p>
                ) : (
                  renderFolderTree(buildTree())
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-surface rounded-2xl border border-surface-container-high p-4">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-surface-container-high">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => {
                      setSelectedActivity(null);
                      setSelectedFolderId(null);
                      setItems({ files: [], tweets: [], subfolders: [] });
                      setExpandedFolders(new Set());
                    }}
                    className="p-1 hover:bg-surface-container-low rounded-lg text-outline hover:text-primary transition-colors shrink-0"
                    title="返回活动列表"
                  >
                    <ChevronRight size={16} className="rotate-180" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-on-surface font-headline truncate">{selectedActivity.name}</h2>
                    <p className="text-[11px] text-outline truncate">{selectedActivity.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditActivity(selectedActivity)}
                    className="px-2 py-1 text-xs text-outline hover:text-primary hover:bg-surface-container-low rounded-lg transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ type: 'activity', id: selectedActivity.id, name: selectedActivity.name })}
                    className="px-2 py-1 text-xs text-outline hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-on-surface font-headline">
                  {selectedFolderId
                    ? folders.find(f => f.id === selectedFolderId)?.name || '文件夹'
                    : '全部文件'}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowItemModal(true); setEditingItem(null); setItemForm({ original_filename: '', file_category: 'document', description: '', oss_url: '' }); setItemError(''); setSelectedFiles([]); setUploadProgress(0); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors"
                    disabled={!selectedFolderId}
                  >
                    <Upload size={13} /> 上传文件
                  </button>
                  <button
                    onClick={() => { setShowTweetModal(true); setEditingTweet(null); setTweetForm({ title: '', content: '', summary: '', cover_image: '', link_url: '', author: '' }); setItemError(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-high/80 transition-colors"
                    disabled={!selectedFolderId}
                  >
                    <Plus size={13} /> 添加推文
                  </button>
                </div>
              </div>

              <div className="mb-4 border-t border-surface-container-high pt-3">
                <button
                  onClick={() => setShowPermPanel(!showPermPanel)}
                  className="flex items-center gap-1.5 text-xs font-medium text-outline hover:text-on-surface transition-colors"
                >
                  {showPermPanel ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  权限管理 ({permissions.length})
                </button>
                {showPermPanel && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={permForm.permission_type}
                        onChange={e => setPermForm({ ...permForm, permission_type: e.target.value })}
                        className="px-2 py-1 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs"
                      >
                        <option value="view">查看</option>
                        <option value="upload">上传</option>
                        <option value="edit">编辑</option>
                        <option value="admin">管理</option>
                      </select>
                      <select
                        value={permForm.grantee_type}
                        onChange={e => setPermForm({ ...permForm, grantee_type: e.target.value })}
                        className="px-2 py-1 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs"
                      >
                        <option value="department">部门</option>
                        <option value="user">用户</option>
                      </select>
                      <input
                        type="text"
                        value={permForm.grantee_name}
                        onChange={e => setPermForm({ ...permForm, grantee_name: e.target.value })}
                        placeholder={permForm.grantee_type === 'department' ? '部门名称' : '用户名'}
                        className="flex-1 px-2 py-1 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs"
                      />
                      <button
                        onClick={handleAddPermission}
                        className="px-2 py-1 text-xs font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90 shrink-0"
                      >
                        添加
                      </button>
                    </div>
                    {permissions.length > 0 ? (
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {permissions.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-surface-container-lowest">
                            <span>
                              <span className={`font-medium ${p.permission_type === 'admin' ? 'text-primary' : 'text-on-surface'}`}>
                                {p.permission_type === 'admin' ? '管理' : p.permission_type === 'edit' ? '编辑' : p.permission_type === 'upload' ? '上传' : '查看'}
                              </span>
                              <span className="text-outline mx-1">·</span>
                              <span className="text-outline">{p.grantee_type === 'department' ? '部门' : '用户'}:</span>
                              <span className="text-on-surface-variant ml-0.5">{p.grantee_name}</span>
                            </span>
                            <button onClick={() => handleRemovePermission(p.id)} className="text-red-400 hover:text-red-500">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-on-surface-variant">暂无权限设置（管理员可查看全部）</p>
                    )}
                  </div>
                )}
              </div>

              {loading ? (
                <p className="text-sm text-on-surface-variant py-8 text-center">加载中...</p>
              ) : (
                <>
                  {items.subfolders.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-bold text-outline uppercase tracking-wider mb-2">文件夹</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {items.subfolders.map(sf => (
                          <div key={sf.id} className="group relative bg-surface-container-lowest rounded-xl border border-surface-container-high p-3 hover:border-primary/30 transition-all cursor-pointer"
                            onClick={() => setSelectedFolderId(sf.id)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <FolderOpen size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-on-surface truncate">{sf.name}</p>
                                <p className="text-xs text-on-surface-variant mt-0.5">文件夹</p>
                              </div>
                            </div>
                            <div className="absolute bottom-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-surface/80 backdrop-blur rounded-lg p-0.5">
                              <button
                                onClick={e => { e.stopPropagation(); setEditingFolder(sf); setFolderForm({ name: sf.name, parent_id: String(sf.parent_id || '') }); setFolderError(''); }}
                                className="p-1 hover:bg-primary/10 rounded text-primary"
                                title="编辑"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setDeleteTarget({ type: 'folder', id: sf.id, name: sf.name }); }}
                                className="p-1 hover:bg-red-50 rounded text-red-400"
                                title="删除"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {items.files.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-bold text-outline uppercase tracking-wider mb-2">文件</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {items.files.map(f => (
                          <div key={f.id} className="group relative bg-surface-container-lowest rounded-xl border border-surface-container-high p-3 hover:border-primary/30 transition-all cursor-pointer"
                            onClick={() => setPreviewFile(f)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                {categoryIcons[f.file_category] || <FileText size={16} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-on-surface truncate">{f.original_filename}</p>
                                <p className="text-xs text-on-surface-variant mt-0.5">
                                  {categoryLabels[f.file_category] || f.file_category}
                                  {f.file_size > 0 && ` · ${formatSize(f.file_size)}`}
                                </p>
                                {f.description && (
                                  <p className="text-xs text-outline mt-1 truncate">{f.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="absolute bottom-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-surface/80 backdrop-blur rounded-lg p-0.5">
                              <button
                                onClick={e => { e.stopPropagation(); setPreviewFile(f); }}
                                className="p-1 hover:bg-primary/10 rounded text-primary"
                                title="预览"
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); handleDownload(f); }}
                                className="p-1 hover:bg-primary/10 rounded text-primary"
                                title="下载"
                              >
                                <Download size={12} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setEditingItem(f); setItemForm({ original_filename: f.original_filename || '', file_category: f.file_category, description: f.description || '', oss_url: f.oss_url || '' }); setShowItemModal(true); setSelectedFiles([]); setItemError(''); setUploadProgress(0); }}
                                className="p-1 hover:bg-surface-container-high rounded text-outline"
                                title="编辑"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setDeleteTarget({ type: 'file', id: f.id, name: f.original_filename }); }}
                                className="p-1 hover:bg-red-50 rounded text-red-400"
                                title="删除"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {items.tweets.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-outline uppercase tracking-wider mb-2">推文</p>
                      <div className="space-y-2">
                        {items.tweets.map(t => (
                          <div key={t.id} className="group relative bg-surface-container-lowest rounded-xl border border-surface-container-high p-3 hover:border-primary/30 transition-all cursor-pointer"
                            onClick={() => setShowTweetDetail(t)}>
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-on-surface">{t.title}</p>
                                {t.summary && <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{t.summary}</p>}
                                <div className="flex items-center gap-3 mt-1.5">
                                  {t.author && <span className="text-xs text-outline">{t.author}</span>}
                                  {t.link_url && (
                                    <a href={t.link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-0.5 hover:underline">
                                      <ExternalLink size={10} /> 链接
                                    </a>
                                  )}
                                  <span className="text-xs text-outline">{new Date(t.created_at).toLocaleDateString('zh-CN')}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                <button
                                  onClick={() => { setEditingTweet(t); setTweetForm({ title: t.title, content: t.content || '', summary: t.summary || '', cover_image: t.cover_image || '', link_url: t.link_url || '', author: t.author || '' }); setShowTweetModal(true); setItemError(''); }}
                                  className="p-1 hover:bg-surface-container-high rounded"
                                >
                                  <Edit3 size={12} className="text-outline" />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget({ type: 'tweet', id: t.id, name: t.title })}
                                  className="p-1 hover:bg-red-50 rounded text-red-400"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {items.files.length === 0 && items.tweets.length === 0 && items.subfolders.length === 0 && (
                    <div className="text-center py-12 text-on-surface-variant">
                      <p className="text-sm">此文件夹为空</p>
                      <p className="text-xs mt-1">上传文件或添加推文</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      <AnimatePresence>
        {showActivityModal && (
          <>
            <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowActivityModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-surface rounded-2xl border border-surface-container-high shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-on-surface font-headline">{editingActivity ? '编辑活动' : '创建活动'}</h3>
                  <button onClick={() => setShowActivityModal(false)} className="p-1 hover:bg-surface-container-low rounded-lg"><X size={20} className="text-outline" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">名称 *</label>
                    <input type="text" value={activityForm.name} onChange={e => setActivityForm({ ...activityForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">部门 *</label>
                    <input type="text" value={activityForm.department} onChange={e => setActivityForm({ ...activityForm, department: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">描述</label>
                    <textarea value={activityForm.description} onChange={e => setActivityForm({ ...activityForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" />
                  </div>
                  {activityError && <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{activityError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowActivityModal(false)} className="flex-1 py-2.5 text-sm font-medium text-on-surface-variant bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors">取消</button>
                    <motion.button whileTap={{ scale: 0.98 }} onClick={handleSaveActivity} className="flex-1 py-2.5 text-sm font-bold text-on-primary bg-primary rounded-xl shadow-lg shadow-primary/20">保存</motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Folder Modal */}
      <AnimatePresence>
        {showFolderModal && (
          <>
            <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowFolderModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-surface rounded-2xl border border-surface-container-high shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-on-surface font-headline">{editingFolder ? '编辑文件夹' : '新建文件夹'}</h3>
                  <button onClick={() => setShowFolderModal(false)} className="p-1 hover:bg-surface-container-low rounded-lg"><X size={20} className="text-outline" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">名称 *</label>
                    <input type="text" value={folderForm.name} onChange={e => setFolderForm({ ...folderForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                  {folderError && <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{folderError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowFolderModal(false)} className="flex-1 py-2.5 text-sm font-medium text-on-surface-variant bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors">取消</button>
                    <motion.button whileTap={{ scale: 0.98 }} onClick={handleSaveFolder} className="flex-1 py-2.5 text-sm font-bold text-on-primary bg-primary rounded-xl shadow-lg shadow-primary/20">保存</motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* File Item Modal */}
      <AnimatePresence>
        {showItemModal && (
          <>
            <div className="fixed inset-0 bg-black/50 z-50" onClick={() => { if (uploading) cancelUpload(); else { setShowItemModal(false); setSelectedFiles([]); setEditingItem(null); } }} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-surface rounded-2xl border border-surface-container-high shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-on-surface font-headline">{editingItem ? '编辑文件' : '添加文件'}</h3>
                  <button onClick={() => { if (uploading) cancelUpload(); else { setShowItemModal(false); setSelectedFiles([]); setEditingItem(null); } }} className="p-1 hover:bg-surface-container-low rounded-lg"><X size={20} className="text-outline" /></button>
                </div>
                <div className="space-y-4">
                  {!editingItem && (
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">选择文件</label>
                    <label className={`flex items-center justify-center w-full border-2 border-dashed rounded-xl cursor-pointer transition-colors ${selectedFiles.length > 0 ? 'h-auto min-h-28 py-3' : 'h-28'} ${
                      selectedFiles.length > 0
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-surface-container-high hover:border-primary/30 hover:bg-surface-container-lowest'
                    }`}>
                      <input
                        type="file"
                        multiple
                        onChange={e => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) {
                            setSelectedFiles(files);
                            setItemForm({
                              ...itemForm,
                              original_filename: '',
                              file_category: detectFileCategory(files[0].type, files[0].name),
                            });
                          }
                        }}
                        className="hidden"
                        disabled={uploading}
                      />
                      {selectedFiles.length > 0 ? (
                        <div className="text-center w-full px-4">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-2">
                            <FileText size={20} />
                          </div>
                          <p className="text-sm font-medium text-on-surface">{selectedFiles.length} 个文件已选择</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            {selectedFiles.length <= 3
                              ? selectedFiles.map(f => f.name).join('、')
                              : selectedFiles.slice(0, 3).map(f => f.name).join('、') + ` 等${selectedFiles.length}个`
                            }
                          </p>
                          <p className="text-xs text-outline mt-1">
                            共 {(selectedFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSelectedFiles([]); }}
                            className="text-xs text-error hover:underline mt-1"
                          >
                            清除选择
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload size={24} className="mx-auto mb-1 text-outline" />
                          <p className="text-sm text-on-surface-variant">点击选择文件（支持批量）</p>
                          <p className="text-xs text-outline mt-0.5">支持图片、视频、文档</p>
                        </div>
                      )}
                    </label>
                  </div>
                  )}

                  {uploading && (
                    <div className="space-y-2">
                      <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <p className="text-xs text-on-surface-variant">上传中... {uploadProgress}%</p>
                      <button
                        onClick={cancelUpload}
                        className="w-full py-2 text-sm font-medium text-error bg-error/5 rounded-xl hover:bg-error/10 transition-colors"
                      >
                        取消上传
                      </button>
                    </div>
                  )}

                  {!editingItem && (
                  <div className="border-t border-surface-container-high pt-4">
                  <p className="text-xs text-outline mb-3">或者从外部链接添加文件</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-on-surface mb-1">文件名</label>
                        <input type="text" value={itemForm.original_filename} onChange={e => setItemForm({ ...itemForm, original_filename: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" disabled={uploading} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-on-surface mb-1">URL</label>
                        <input type="text" value={itemForm.oss_url} onChange={e => setItemForm({ ...itemForm, oss_url: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="已有文件的 OSS URL（不填则使用上传的文件）" disabled={uploading} />
                      </div>
                    </div>
                  </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">描述</label>
                    <textarea value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" disabled={uploading} />
                  </div>
                  {itemError && <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{itemError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { if (uploading) cancelUpload(); else { setShowItemModal(false); setSelectedFiles([]); setEditingItem(null); } }} className="flex-1 py-2.5 text-sm font-medium text-on-surface-variant bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors">{uploading ? '取消上传' : '取消'}</button>
                    {!uploading && (
                      <motion.button whileTap={{ scale: 0.98 }} onClick={handleSaveItem} className="flex-1 py-2.5 text-sm font-bold text-on-primary bg-primary rounded-xl shadow-lg shadow-primary/20">{editingItem ? '保存' : '添加'}</motion.button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Tweet Modal */}
      <AnimatePresence>
        {showTweetModal && (
          <>
            <div className="fixed inset-0 bg-black/50 z-50" onClick={() => { setShowTweetModal(false); setEditingTweet(null); }} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-surface rounded-2xl border border-surface-container-high shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-on-surface font-headline">{editingTweet ? '编辑推文' : '添加推文'}</h3>
                  <button onClick={() => { setShowTweetModal(false); setEditingTweet(null); }} className="p-1 hover:bg-surface-container-low rounded-lg"><X size={20} className="text-outline" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">标题 *</label>
                    <input type="text" value={tweetForm.title} onChange={e => setTweetForm({ ...tweetForm, title: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">摘要</label>
                    <textarea value={tweetForm.summary} onChange={e => setTweetForm({ ...tweetForm, summary: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">作者</label>
                    <input type="text" value={tweetForm.author} onChange={e => setTweetForm({ ...tweetForm, author: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">链接 URL</label>
                    <input type="text" value={tweetForm.link_url} onChange={e => setTweetForm({ ...tweetForm, link_url: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">内容</label>
                    <textarea value={tweetForm.content} onChange={e => setTweetForm({ ...tweetForm, content: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" />
                  </div>
                  {itemError && <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{itemError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { setShowTweetModal(false); setEditingTweet(null); }} className="flex-1 py-2.5 text-sm font-medium text-on-surface-variant bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors">取消</button>
                    <motion.button whileTap={{ scale: 0.98 }} onClick={handleSaveTweet} className="flex-1 py-2.5 text-sm font-bold text-on-primary bg-primary rounded-xl shadow-lg shadow-primary/20">保存</motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={!!previewFile}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      {/* Tweet Detail Modal */}
      <AnimatePresence>
        {showTweetDetail && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowTweetDetail(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-4 z-50 flex items-center justify-center pointer-events-none"
            >
              <div className="bg-surface rounded-2xl border border-surface-container-high shadow-2xl w-full max-w-2xl max-h-full overflow-hidden flex flex-col pointer-events-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container-high shrink-0">
                  <h3 className="text-lg font-bold text-on-surface font-headline truncate">{showTweetDetail.title}</h3>
                  <button onClick={() => setShowTweetDetail(null)} className="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-on-surface transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-6">
                  {(showTweetDetail.author || showTweetDetail.created_at) && (
                    <div className="flex items-center gap-3 mb-5 text-xs text-outline">
                      {showTweetDetail.author && <span>{showTweetDetail.author}</span>}
                      {showTweetDetail.author && showTweetDetail.created_at && <span>·</span>}
                      {showTweetDetail.created_at && <span>{new Date(showTweetDetail.created_at).toLocaleDateString('zh-CN')}</span>}
                    </div>
                  )}
                  {showTweetDetail.summary && (
                    <p className="text-sm text-on-surface-variant mb-5 p-4 bg-surface-container-lowest rounded-xl border-l-2 border-primary/30 italic">
                      {showTweetDetail.summary}
                    </p>
                  )}
                  {showTweetDetail.content && (
                    <div className="prose prose-sm max-w-none text-on-surface whitespace-pre-wrap leading-relaxed">
                      {showTweetDetail.content}
                    </div>
                  )}
                  {!showTweetDetail.content && !showTweetDetail.summary && (
                    <p className="text-sm text-on-surface-variant py-8 text-center">暂无正文内容</p>
                  )}
                  {showTweetDetail.link_url && (
                    <a href={showTweetDetail.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      <ExternalLink size={14} /> 查看原文链接
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="确认删除"
        message={`确定要删除${deleteTarget?.type === 'activity' ? '活动' : deleteTarget?.type === 'folder' ? '文件夹' : deleteTarget?.type === 'tweet' ? '推文' : '文件'}「${deleteTarget?.name}」吗？此操作不可撤销。`}
        confirmText="删除"
        type="danger"
      />
    </div>
  );
}
