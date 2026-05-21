import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import type { ProfileData } from '../../types';

const PROFILE_KEY = 'user_profile';

function loadProfile(): ProfileData {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { grade: '', major: '', college: '', planNote: '' };
}

interface ProfileCardProps {
  onChange?: (profile: ProfileData) => void;
}

export default function ProfileCard({ onChange }: ProfileCardProps) {
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileData>(loadProfile);
  const [draft, setDraft] = useState<ProfileData>(profile);

  const roleLabel = user?.role === 'admin' ? '管理员' : user?.role === 'teacher' ? '教师' : '学生';

  const handleEdit = () => {
    setDraft({ ...profile });
    setEditing(true);
  };

  const handleSave = () => {
    setProfile(draft);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(draft));
    onChange?.(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-surface-container-low/60 rounded-2xl border border-outline-variant/30 p-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
            {user?.name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                value={draft.grade}
                onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
                placeholder="年级 (如 2024级)"
                className="px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring w-36"
              />
              <input
                value={draft.major}
                onChange={(e) => setDraft({ ...draft, major: e.target.value })}
                placeholder="专业 (如 计算机科学)"
                className="px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring w-36"
              />
              <input
                value={draft.college}
                onChange={(e) => setDraft({ ...draft, college: e.target.value })}
                placeholder="学院 (如 信息学院)"
                className="px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring w-36"
              />
            </div>
            <textarea
              value={draft.planNote}
              onChange={(e) => setDraft({ ...draft, planNote: e.target.value })}
              placeholder="当前规划 (如：本学期重点准备考研，晚上效率高)"
              rows={2}
              className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring resize-none"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleSave} className="btn-outline text-sm px-3 py-1.5">保存</button>
            <button onClick={handleCancel} className="text-sm px-3 py-1.5 text-on-surface-variant hover:text-on-surface">取消</button>
          </div>
        </div>
      </div>
    );
  }

  const hasProfile = profile.grade || profile.major || profile.college || profile.planNote;

  return (
    <div className="bg-surface-container-low/60 rounded-2xl border border-outline-variant/30 p-4">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
          {user?.name?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-on-surface">{user?.name || '未设置'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{roleLabel}</span>
            {user?.department && (
              <span className="text-xs text-on-surface-variant">{user.department}</span>
            )}
          </div>
          {hasProfile ? (
            <div className="text-sm text-on-surface-variant mt-1">
              {[profile.grade, profile.major, profile.college].filter(Boolean).join(' · ')}
              {profile.planNote && (
                <p className="mt-1 text-xs text-on-surface-variant/70 line-clamp-1">{profile.planNote}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant/50 mt-1">点击编辑补充个人信息，帮助 AI 更好地生成计划</p>
          )}
        </div>
        <button onClick={handleEdit} className="text-xs text-primary hover:underline shrink-0">编辑</button>
      </div>
    </div>
  );
}
