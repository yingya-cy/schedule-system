import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { usePsychologyStore } from '../../stores/psychologyStore';
import type { PsychView } from './types/psychology';

const CounselorManagePage = lazy(() => import('./pages/CounselorManagePage'));
const CounselorListPage = lazy(() => import('./pages/CounselorListPage'));
const CounselorDetailPage = lazy(() => import('./pages/CounselorDetailPage'));
const MyAppointmentsPage = lazy(() => import('./pages/MyAppointmentsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));

function SubNav({ view, onView }: { view: PsychView; onView: (v: PsychView) => void }) {
  const user = useAuthStore((s) => s.user);
  const counselorProfile = usePsychologyStore((s) => s.counselorProfile);
  const isAdmin = user?.role === 'admin';
  const isCounselor = counselorProfile !== null;

  const tabs: { id: PsychView; label: string; show: boolean }[] = [
    { id: 'counselors', label: '咨询师列表', show: true },
    { id: 'chat', label: '我的聊天', show: true },
    { id: 'my-appointments', label: '我的预约', show: true },
    { id: 'workbench', label: '工作台', show: isCounselor },
    { id: 'manage', label: '咨询师管理', show: isAdmin },
    { id: 'appointments-overview', label: '预约总览', show: isAdmin },
  ];

  return (
    <nav className="flex gap-1 px-4 py-3 overflow-x-auto border-b border-outline-variant/40 bg-surface-container-lowest/60 backdrop-blur-sm">
      {tabs
        .filter((t) => t.show)
        .map((t) => (
          <button
            key={t.id}
            onClick={() => onView(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-ring ${
              view === t.id
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            {t.label}
          </button>
        ))}
    </nav>
  );
}

export default function PsychologyView() {
  const user = useAuthStore((s) => s.user);
  const fetchMyCounselorProfile = usePsychologyStore((s) => s.fetchMyCounselorProfile);
  const counselorProfile = usePsychologyStore((s) => s.counselorProfile);
  const view = usePsychologyStore((s) => s.view);
  const setView = usePsychologyStore((s) => s.setView);
  const error = usePsychologyStore((s) => s.error);
  const clearError = usePsychologyStore((s) => s.clearError);

  useEffect(() => {
    fetchMyCounselorProfile();
  }, []);

  // Set default view based on role
  useEffect(() => {
    if (counselorProfile === undefined) return; // still loading
    if (user?.role === 'admin') {
      setView('manage');
    } else if (counselorProfile !== null) {
      setView('workbench');
    } else {
      setView('counselors');
    }
  }, [user, counselorProfile]);

  const renderPage = () => {
    switch (view) {
      case 'counselors':
        return <Suspense fallback={<div className="skeleton h-64 rounded-xl" />}><CounselorListPage /></Suspense>;
      case 'counselor-detail':
        return <Suspense fallback={<div className="skeleton h-64 rounded-xl" />}><CounselorDetailPage /></Suspense>;
      case 'chat':
        return <Suspense fallback={<div className="skeleton h-96 rounded-xl" />}><ChatPage /></Suspense>;
      case 'my-appointments':
        return <Suspense fallback={<div className="skeleton h-64 rounded-xl" />}><MyAppointmentsPage /></Suspense>;
      case 'workbench':
        return <div className="empty-state"><p className="empty-state-title">工作台</p><p className="empty-state-description">页面开发中...</p></div>;
      case 'manage':
        return <Suspense fallback={<div className="skeleton h-64 rounded-xl" />}><CounselorManagePage /></Suspense>;
      case 'appointments-overview':
        return <div className="empty-state"><p className="empty-state-title">预约总览</p><p className="empty-state-description">页面开发中...</p></div>;
      default:
        return <div className="empty-state"><p className="empty-state-title">未知页面</p></div>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <SubNav view={view} onView={setView} />
      {error && (
        <div className="mx-4 mt-3 px-4 py-2 bg-error/10 text-error rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="ml-2 font-bold text-lg leading-none">&times;</button>
        </div>
      )}
      <div className="flex-1 p-4">
        {renderPage()}
      </div>
    </div>
  );
}
