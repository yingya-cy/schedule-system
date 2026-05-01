import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, Edit3, X, FolderPlus, FileText, Image, Video, ExternalLink,
  ChevronRight, ChevronDown, FolderOpen, Upload, Search
} from 'lucide-react';
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

export default function FileCenterView() {
  const token = useAuthStore((s) => s.token);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // Activities
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityForm, setActivityForm] = useState({ name: '', department: '', description: '', cover_url: '' });
  const [activityError, setActivityError] = useState('');

  // Folders
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderForm, setFolderForm] = useState({ name: '', parent_id: '' });
  const [folderParentId, setFolderParentId] = useState<number | null>(null);
  const [folderError, setFolderError] = useState('');

  // Items
  const [items, setItems] = useState<{ files: FileItem[]; tweets: TweetItem[] }>({ files: [], tweets: [] });
  const [showItemModal, setShowItemModal] = useState(false);
  const [showTweetModal, setShowTweetModal] = useState(false);
  const [editingTweet, setEditingTweet] = useState<TweetItem | null>(null);
  const [itemForm, setItemForm] = useState({ original_filename: '', file_category: 'document', description: '', oss_url: '' });
  const [tweetForm, setTweetForm] = useState({ title: '', content: '', summary: '', cover_image: '', link_url: '', author: '' });
  const [itemError, setItemError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Permissions
  const [permissions, setPermissions] = useState<any[]>([]);
  const [showPermPanel, setShowPermPanel] = useState(false);
  const [permForm, setPermForm] = useState({ permission_type: 'view', grantee_type: 'department', grantee_name: '' });

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: number; name: string } | null>(null);
  const [loading, setLoading] = useState(false);

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
      fetchFolders(selectedActivity.id);
      fetchPermissions(selectedActivity.id);
    }
  }, [selectedActivity]);

  useEffect(() => {
    if (selectedFolderId) fetchItems(selectedFolderId);
  }, [selectedFolderId]);

  // Activity handlers
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

  // Folder handlers
  function openCreateFolder(parentId: number | null = null) {
    setEditingFolder(null);
    setFolderParentId(parentId);
    setFolderForm({ name: '', parent_id: '' });
    setFolderError('');
    setShowFolderModal(true);
  }

  function openEditFolder(f: Folder) {
    setEditingFolder(f);
    setFolderParentId(null);
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
          body: JSON.stringify({ name: folderForm.name, parent_id: folderParentId })
        });
      }
      setShowFolderModal(false);
      if (selectedActivity) fetchFolders(selectedActivity.id);
    } catch (e: any) {
      setFolderError(e.message);
    }
  }

  // Item handlers
  async function handleSaveItem() {
    if (!selectedActivity || !selectedFolderId) return;
    setItemError('');
    setUploading(true);
    setUploadProgress(0);
    try {
      if (selectedFile) {
        // OSS presigned URL upload flow
        const filename = selectedFile.name;
        const contentType = selectedFile.type || 'application/octet-stream';

        // Step 1: Request presigned URL
        setUploadProgress(10);
        const presignedRes = await fetch('/api/file-center/oss/presigned-url', {
          method: 'POST', headers,
          body: JSON.stringify({
            activity_id: selectedActivity.id,
            folder_id: selectedFolderId,
            filename,
            content_type: contentType,
          }),
        });
        const presignedJson = await presignedRes.json();
        if (!presignedJson.success) throw new Error(presignedJson.error);

        // Step 2: Upload file directly to OSS
        setUploadProgress(30);
        const uploadRes = await fetch(presignedJson.data.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: selectedFile,
        });
        if (!uploadRes.ok) throw new Error('OSS 上传失败');

        // Step 3: Confirm upload and register file in database
        setUploadProgress(80);
        const confirmRes = await fetch('/api/file-center/oss/confirm', {
          method: 'POST', headers,
          body: JSON.stringify({
            activity_id: selectedActivity.id,
            folder_id: selectedFolderId,
            object_key: presignedJson.data.objectKey,
            original_filename: filename,
            file_size: selectedFile.size,
            mime_type: contentType,
            file_category: itemForm.file_category,
          }),
        });
        const confirmJson = await confirmRes.json();
        if (!confirmJson.success) throw new Error(confirmJson.error);
      } else if (itemForm.original_filename && itemForm.oss_url) {
        // Manual URL entry fallback
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
      } else {
        setItemError('请选择文件或填写文件名和 URL');
        setUploading(false);
        return;
      }
      setUploadProgress(100);
      setShowItemModal(false);
      setSelectedFile(null);
      setItemForm({ original_filename: '', file_category: 'document', description: '', oss_url: '' });
      if (selectedFolderId) fetchItems(selectedFolderId);
    } catch (e: any) {
      setItemError(e.message);
    } finally {
      setUploading(false);
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

  // Delete handler
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const endpoints: Record<string, string> = {
        activity: `/api/file-center/activities/${deleteTarget.id}`,
        folder: `/api/file-center/folders/${deleteTarget.id}`,
        file: `/api/file-center/items/${deleteTarget.id}`,
        tweet: `/api/file-center/tweets/${deleteTarget.id}`,
      };
      await fetch(endpoints[deleteTarget.type], { method: 'DELETE', headers });
      setDeleteTarget(null);
      if (deleteTarget.type === 'activity') {
        setSelectedActivity(null);
        setSelectedFolderId(null);
        setFolders([]);
        setItems({ files: [], tweets: [] });
        fetchActivities();
      } else if (deleteTarget.type === 'folder') {
        if (selectedActivity) fetchFolders(selectedActivity.id);
        if (selectedFolderId === deleteTarget.id) setSelectedFolderId(null);
      } else {
        if (selectedFolderId) fetchItems(selectedFolderId);
      }
    } catch { /* ignore */ }
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
      {/* Activity Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {activities.map(a => (
            <button
              key={a.id}
              onClick={() => {
                setSelectedActivity(a);
                setSelectedFolderId(null);
                setItems({ files: [], tweets: [] });
                setExpandedFolders(new Set());
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedActivity?.id === a.id
                  ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low border border-surface-container-high'
              }`}
            >
              {a.name}
            </button>
          ))}
          <button
            onClick={openCreateActivity}
            className="px-3 py-2 rounded-xl text-sm text-outline hover:text-primary hover:bg-primary/5 border border-dashed border-surface-container-high flex items-center gap-1 whitespace-nowrap"
          >
            <Plus size={14} /> 新活动
          </button>
        </div>
      </div>

      {!selectedActivity ? (
        <div className="text-center py-20 text-on-surface-variant">
          <FolderOpen size={48} className="mx-auto mb-4 text-outline/50" />
          <p className="text-lg font-medium">选择一个活动或创建新活动</p>
          <p className="text-sm mt-1">文件中心按活动组织资料</p>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Folder Tree Sidebar */}
          <div className="w-56 shrink-0">
            <div className="bg-surface rounded-2xl border border-surface-container-high p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-outline uppercase tracking-wider">目录</h3>
                <button
                  onClick={() => openCreateFolder(null)}
                  className="p-1 hover:bg-surface-container-low rounded-lg text-outline hover:text-primary transition-colors"
                  title="新建文件夹"
                >
                  <FolderPlus size={14} />
                </button>
              </div>
              <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
                {buildTree().length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-2 px-2">暂无文件夹</p>
                ) : (
                  renderFolderTree(buildTree())
                )}
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            <div className="bg-surface rounded-2xl border border-surface-container-high p-4">
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-on-surface font-headline">
                  {selectedFolderId
                    ? folders.find(f => f.id === selectedFolderId)?.name || '文件夹'
                    : '全部文件'}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowItemModal(true); setItemForm({ original_filename: '', file_category: 'document', description: '', oss_url: '' }); setItemError(''); setSelectedFile(null); setUploadProgress(0); }}
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

              {/* Permissions Panel */}
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

              {/* Items Grid */}
              {loading ? (
                <p className="text-sm text-on-surface-variant py-8 text-center">加载中...</p>
              ) : (
                <>
                  {/* Files */}
                  {items.files.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-bold text-outline uppercase tracking-wider mb-2">文件</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {items.files.map(f => (
                          <div key={f.id} className="group relative bg-surface-container-lowest rounded-xl border border-surface-container-high p-3 hover:border-primary/30 transition-all">
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
                            <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setDeleteTarget({ type: 'file', id: f.id, name: f.original_filename })}
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

                  {/* Tweets */}
                  {items.tweets.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-outline uppercase tracking-wider mb-2">推文</p>
                      <div className="space-y-2">
                        {items.tweets.map(t => (
                          <div key={t.id} className="group relative bg-surface-container-lowest rounded-xl border border-surface-container-high p-3 hover:border-primary/30 transition-all">
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

                  {items.files.length === 0 && items.tweets.length === 0 && (
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
            <div className="fixed inset-0 bg-black/50 z-50" onClick={() => { if (!uploading) { setShowItemModal(false); setSelectedFile(null); } }} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-surface rounded-2xl border border-surface-container-high shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-on-surface font-headline">添加文件</h3>
                  <button onClick={() => { if (!uploading) { setShowItemModal(false); setSelectedFile(null); } }} className="p-1 hover:bg-surface-container-low rounded-lg"><X size={20} className="text-outline" /></button>
                </div>
                <div className="space-y-4">
                  {/* File Input for OSS upload */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">选择文件（上传到 OSS）</label>
                    <input
                      type="file"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                          setItemForm({ ...itemForm, original_filename: file.name });
                        }
                      }}
                      className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all"
                      disabled={uploading}
                    />
                    {selectedFile && (
                      <p className="text-xs text-primary mt-1">{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)</p>
                    )}
                  </div>

                  {/* Upload Progress */}
                  {uploading && (
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <p className="text-xs text-on-surface-variant">上传中... {uploadProgress}%</p>
                    </div>
                  )}

                  <div className="border-t border-surface-container-high pt-4">
                    <p className="text-xs text-outline mb-3">或者手动填写文件 URL</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-on-surface mb-1">文件名</label>
                        <input type="text" value={itemForm.original_filename} onChange={e => setItemForm({ ...itemForm, original_filename: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" disabled={uploading} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-on-surface mb-1">URL</label>
                        <input type="text" value={itemForm.oss_url} onChange={e => setItemForm({ ...itemForm, oss_url: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="文件的 OSS URL" disabled={uploading} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">类别</label>
                    <select value={itemForm.file_category} onChange={e => setItemForm({ ...itemForm, file_category: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" disabled={uploading}>
                      <option value="document">文档</option>
                      <option value="image">图片</option>
                      <option value="video">视频</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">描述</label>
                    <textarea value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" disabled={uploading} />
                  </div>
                  {itemError && <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{itemError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { if (!uploading) { setShowItemModal(false); setSelectedFile(null); } }} className="flex-1 py-2.5 text-sm font-medium text-on-surface-variant bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors" disabled={uploading}>取消</button>
                    <motion.button whileTap={{ scale: 0.98 }} onClick={handleSaveItem} disabled={uploading} className="flex-1 py-2.5 text-sm font-bold text-on-primary bg-primary rounded-xl shadow-lg shadow-primary/20 disabled:opacity-60">{uploading ? '上传中...' : '添加'}</motion.button>
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
