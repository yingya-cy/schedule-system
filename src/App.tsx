import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { useAppStore } from './stores/appStore';

const DashboardView = lazy(() => import('./components/views/DashboardView'));
const CoursesView = lazy(() => import('./components/views/CoursesView'));
const FilesView = lazy(() => import('./components/views/FilesView'));
const ContactsView = lazy(() => import('./components/views/ContactsView'));
const ScheduleView = lazy(() => import('./components/views/ScheduleView'));
const ChatView = lazy(() => import('./components/views/ChatView'));

function AppContent() {
  const refreshDepartments = useAppStore((s) => s.refreshDepartments);
  const refreshSchedules = useAppStore((s) => s.refreshSchedules);
  const departmentsLoaded = useAppStore((s) => s.departmentsLoaded);
  const schedulesLoaded = useAppStore((s) => s.schedulesLoaded);

  useEffect(() => {
    if (!departmentsLoaded) {
      refreshDepartments();
    }
    if (!schedulesLoaded) {
      refreshSchedules();
    }
  }, []);

  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/files" element={<FilesView />} />
            <Route path="/courses" element={<CoursesView />} />
            <Route path="/contacts" element={<ContactsView />} />
            <Route path="/schedule" element={<ScheduleView />} />
            <Route path="/chat" element={<ChatView />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
