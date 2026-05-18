import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, Edit3, X, FolderPlus, FileText, Image, Video, ExternalLink,
  ChevronRight, ChevronDown, FolderOpen, Upload, Search, Eye, Download
} from 'lucide-react';
import FilePreviewModal from '../FilePreviewModal';
import { useAuthStore } from '@/stores/authStore';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  FileCenterActivity, FileCenterFolder, FileCenterFileItem, FileCenterTweetItem,
  FileCenterActivityForm, FileCenterFolderForm, FileCenterItemForm,
  FileCenterTweetForm, FileCenterDeleteTarget, FileCenterItemsState,
  type SortBy, type SortOrder,
} from './FileCenterTypes';
import { categoryIcons, categoryLabels, formatSize, detectFileCategory, getFolderPath, sortedFiles, buildTree } from './FileCenterUtils';

export default function FileCenterView() {
  const token = useAuthStore((s) => s.token);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [activities, setActivities] = useState<FileCenterActivity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<FileCenterActivity | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<FileCenterActivity | null>(null);
  const [activityForm, setActivityForm] = useState<FileCenterActivityForm>({ name: '', department: '', description: '', cover_url: '' });
  const [activityError, setActivityError] = useState('');

  const [folders, setFolders] = useState<FileCenterFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FileCenterFolder | null>(null);
  const [folderForm, setFolderForm] = useState<FileCenterFolderForm>({ name: '', parent_id: '' });
  const [folderError, setFolderError] = useState('');

  const [items, setItems] = useState<FileCenterItemsState>({ files: [], tweets: [], subfolders: [] });
  const [showItemModal, setShowItemModal] = useState(false);
  const [showTweetModal, setShowTweetModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FileCenterFileItem | null>(null);
  const [editingTweet, setEditingTweet] = useState<FileCenterTweetItem | null>(null);
  const [itemForm, setItemForm] = useState<FileCenterItemForm>({ original_filename: '', file_category: 'document', description: '', oss_url: '' });
  const [tweetForm, setTweetForm] = useState<FileCenterTweetForm>({ title: '', content: '', summary: '', cover_image: '', link_url: '', author: '' });
  const [itemError, setItemError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadStartTime, setUploadStartTime] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const abortRef = useRef<AbortController | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<FileCenterDeleteTarget | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [loading, setLoading] = useState(false);

  const [previewFile, setPreviewFile] = useState<FileCenterFileItem | null>(null);
  const [showTweetDetail, setShowTweetDetail] = useState<FileCenterTweetItem | null>(null);

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
      if (json.success) setFolders(Array.isArray(json.data) ? json.data : []);
    } catch { /* ignore */ }
  }

  async function fetchItems(folderId: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/file-center/folders/${folderId}/items`, { headers });
      const json = await res.json();
      if (json.success) setItems({ files: json.data.files || [], tweets: json.data.tweets || [], subfolders: json.data.subfolders || [] });
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { fetchActivities(); }, []);

  useEffect(() => {
    if (selectedActivity) {
      fetchFolders(selectedActivity.id);
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

  function openEditActivity(a: FileCenterActivity) {
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
    } catch (e: unknown) {
      setActivityError(e instanceof Error ? e.message : '未知错误');
    }
  }

  function openCreateFolder(parentId: number | null = null) {
    setEditingFolder(null);
    setFolderForm({ name: '', parent_id: parentId ? String(parentId) : '' });
    setFolderError('');
    setShowFolderModal(true);
  }

  function openEditFolder(f: FileCenterFolder) {
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
      if (selectedFolderId) fetchItems(selectedFolderId);
    } catch (e: unknown) {
      setFolderError(e instanceof Error ? e.message : '未知错误');
    }
  }

  function uploadToOss(url: string, file: File, contentType: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
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
        setUploadStartTime(Date.now());

        const uploadOne = async (file: File) => {
          const filename = file.name;
          setUploadFileName(`上传中 ${completed + 1}/${total}: ${filename}`);
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
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setItemError('');
      } else if (e instanceof Error && e.message === '上传已取消') {
        setItemError('');
      } else {
        setItemError(e instanceof Error ? e.message : '未知错误');
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
    } catch (e: unknown) {
      setItemError(e instanceof Error ? e.message : '未知错误');
    }
  }

  async function handleDownload(file: FileCenterFileItem) {
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
    } catch (e: unknown) {
      console.error('Delete failed:', e);
      setDeleteTarget(null);
    }
  }

  function toggleFileSelection(fileId: number) {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId); else next.add(fileId);
      return next;
    });
  }

  function clearSelection() { setSelectedFileIds(new Set()); }

  async function handleBatchDelete() {
    if (selectedFileIds.size === 0) return;
    try {
      const res = await fetch('/api/file-center/items/batch-delete', {
        method: 'POST', headers,
        body: JSON.stringify({ ids: Array.from(selectedFileIds) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      clearSelection();
      if (selectedFolderId) fetchItems(selectedFolderId);
    } catch (e: unknown) {
      console.error('Batch delete failed:', e);
    }
  }

  async function handleBatchDownloadZip() {
    if (selectedFileIds.size === 0) return;
    const res = await fetch('/api/file-center/items/batch-download', {
      method: 'POST', headers,
      body: JSON.stringify({ ids: Array.from(selectedFileIds) }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'files.zip';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleBatchDownloadIndividual() {
    if (selectedFileIds.size === 0) return;
    const files = items.files.filter(f => selectedFileIds.has(f.id) && f.oss_object_key);
    for (const f of files) {
      try {
        const res = await fetch(`/api/file-center/oss/download?key=${encodeURIComponent(f.oss_object_key!)}&filename=${encodeURIComponent(f.original_filename)}`, { headers });
        if (!res.ok) continue;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = f.original_filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } catch { /* skip failed files */ }
    }
    clearSelection();
  }

  // Drag & drop
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(false);
    if (!selectedFolderId) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles(files);
      setItemForm({ original_filename: '', file_category: detectFileCategory(files[0].type, files[0].name), description: '', oss_url: '' });
      setItemError(''); setUploadProgress(0); setEditingItem(null);
      setShowItemModal(true);
    }
  }

  function toggleExpand(folderId: number) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function renderFolderTree(folders: FileCenterFolder[], depth = 0) {
    return folders.map(f => {
      const children = buildTree(folders, f.id);
      const isExpanded = expandedFolders.has(f.id);
      const isSelected = selectedFolderId === f.id;
      return (
        <div key={f.id} className="group">
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
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30 flex-shrink-0 transition-transform hover:scale-105 hover:rotate-3 cursor-default">
                <FolderOpen className="text-on-primary" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-on-surface font-headline">文件中心</h1>
                <p className="text-sm text-on-surface-variant mt-1">管理活动和文件资源</p>
              </div>
            </div>
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
                {buildTree(folders).length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-2 px-2">暂无文件夹</p>
                ) : (
                  renderFolderTree(buildTree(folders))
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            {isDragOver && (
              <div className="fixed inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-2xl flex items-center justify-center pointer-events-none">
                <div className="bg-surface rounded-2xl shadow-xl px-8 py-6 text-center">
                  <Upload size={40} className="mx-auto mb-3 text-primary" />
                  <p className="text-lg font-bold text-on-surface">释放文件以上传</p>
                  <p className="text-sm text-on-surface-variant mt-1">文件将上传到当前文件夹</p>
                </div>
              </div>
            )}
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

              {/* Breadcrumb */}
              {selectedFolderId && (
                <div className="flex items-center gap-1 mb-3 text-xs text-outline">
                  <button onClick={() => setSelectedFolderId(null)} className="hover:text-primary transition-colors">全部文件</button>
                  {getFolderPath(folders, selectedFolderId).map(f => (
                    <span key={f.id} className="flex items-center gap-1">
                      <ChevronRight size={10} />
                      <button onClick={() => setSelectedFolderId(f.id)} className="hover:text-primary transition-colors truncate max-w-[120px]">{f.name}</button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-on-surface font-headline">
                    {selectedFolderId
                      ? folders.find(f => f.id === selectedFolderId)?.name || '文件夹'
                      : '全部文件'}
                  </h3>
                  {/* Sort controls */}
                  {items.files.length > 1 && (
                    <div className="flex items-center gap-1 text-[10px]">
                      <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                        className="px-1.5 py-0.5 rounded bg-surface-container-low border border-surface-container-high text-on-surface-variant">
                        <option value="date">时间</option>
                        <option value="name">名称</option>
                        <option value="size">大小</option>
                      </select>
                      <button onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                        className="px-1.5 py-0.5 rounded bg-surface-container-low border border-surface-container-high text-on-surface-variant">
                        {sortOrder === 'desc' ? '↓' : '↑'}
                      </button>
                    </div>
                  )}
                </div>
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


              {loading ? (
                <p className="text-sm text-on-surface-variant py-8 text-center">加载中...</p>
              ) : !selectedFolderId ? (
                /* Root level — show root folders from the tree */
                (() => {
                  const rootFolders = folders.filter(f => f.parent_id === null);
                  return rootFolders.length > 0 ? (
                    <div>
                      <p className="text-xs font-bold text-outline uppercase tracking-wider mb-2">文件夹</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {rootFolders.map(sf => (
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
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setDeleteTarget({ type: 'folder', id: sf.id, name: sf.name }); }}
                                className="p-1 hover:bg-red-50 rounded text-red-400"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-on-surface-variant">
                      <p className="text-sm">此活动还没有文件夹</p>
                      <p className="text-xs mt-1">点击左侧「新建文件夹」创建</p>
                    </div>
                  );
                })()
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
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-bold text-outline uppercase tracking-wider">文件</p>
                        <button
                          onClick={() => {
                            if (selectedFileIds.size === items.files.length) clearSelection();
                            else setSelectedFileIds(new Set(items.files.map(f => f.id)));
                          }}
                          className="text-[10px] text-primary hover:underline"
                        >
                          {selectedFileIds.size === items.files.length ? '取消全选' : '全选'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {sortedFiles(items.files, sortBy, sortOrder).map(f => (
                          <div key={f.id} className={`group relative bg-surface-container-lowest rounded-xl border p-3 hover:border-primary/30 transition-all cursor-pointer ${selectedFileIds.has(f.id) ? 'border-primary/50 bg-primary/5' : 'border-surface-container-high'}`}
                            onClick={() => setPreviewFile(f)}
                          >
                            <div className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={selectedFileIds.has(f.id)} onChange={() => toggleFileSelection(f.id)}
                                className="w-4 h-4 rounded accent-primary cursor-pointer opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity" />
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                {categoryIcons[f.file_category] || <FileText size={16} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-on-surface truncate">{f.original_filename}</p>
                                <p className="text-xs text-on-surface-variant mt-0.5">
                                  {categoryLabels[f.file_category] || f.file_category}
                                  {f.file_size > 0 && ` · ${formatSize(f.file_size)}`}
                                  {f.created_at && ` · ${new Date(f.created_at).toLocaleDateString('zh-CN')}`}
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

      {/* Batch action bar */}
      <AnimatePresence>
        {selectedFileIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface rounded-2xl border border-surface-container-high shadow-xl px-5 py-3 flex items-center gap-4"
          >
            <span className="text-sm font-medium text-on-surface">{selectedFileIds.size} 个文件已选</span>
            <div className="relative">
              <button onClick={() => setShowDownloadMenu(!showDownloadMenu)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors">
                批量下载
              </button>
              {showDownloadMenu && (
                <>
                  <div className="fixed inset-0 z-50" onClick={() => setShowDownloadMenu(false)} />
                  <div className="absolute bottom-full mb-1 left-0 bg-surface rounded-xl border border-surface-container-high shadow-lg py-1 min-w-[140px] z-50">
                    <button onClick={() => { setShowDownloadMenu(false); handleBatchDownloadZip(); }} className="w-full px-3 py-2 text-left text-xs hover:bg-surface-container-low transition-colors">
                      打包为 ZIP
                    </button>
                    <button onClick={() => { setShowDownloadMenu(false); handleBatchDownloadIndividual(); }} className="w-full px-3 py-2 text-left text-xs hover:bg-surface-container-low transition-colors">
                      分别下载
                    </button>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setBatchDeleteConfirm(true)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
              批量删除
            </button>
            <button onClick={clearSelection} className="px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors">
              取消
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
                          <p className="text-xs text-outline mt-0.5">支持图片、视频、文档、压缩包、音频等</p>
                        </div>
                      )}
                    </label>
                  </div>
                  )}

                  {uploading && (
                    <div className="space-y-2">
                      <p className="text-xs text-on-surface truncate">{uploadFileName}</p>
                      <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-outline">
                        <span>{uploadProgress}%</span>
                        {uploadStartTime > 0 && uploadProgress > 0 && uploadProgress < 100 && (
                          <span>剩余约 {Math.ceil((100 - uploadProgress) * (Date.now() - uploadStartTime) / uploadProgress / 1000)}s</span>
                        )}
                      </div>
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

      {/* Batch Delete Confirm */}
      <ConfirmDialog
        isOpen={batchDeleteConfirm}
        onCancel={() => setBatchDeleteConfirm(false)}
        onConfirm={() => { setBatchDeleteConfirm(false); handleBatchDelete(); }}
        title="批量删除"
        message={`确定要删除选中的 ${selectedFileIds.size} 个文件吗？此操作不可撤销。`}
        confirmText="删除"
        type="danger"
      />

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
