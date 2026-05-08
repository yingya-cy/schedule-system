import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import AuthGuard from './components/AuthGuard';
import { useAppStore } from './stores/appStore';
import { useAuthStore } from './stores/authStore';

const LoginView = lazy(() => import('./components/views/LoginView'));
const RegisterView = lazy(() => import('./components/views/RegisterView'));
const DashboardView = lazy(() => import('./components/views/DashboardView'));
const CoursesView = lazy(() => import('./components/views/CoursesView'));
const FilesView = lazy(() => import('./components/views/FilesView'));
const ContactsView = lazy(() => import('./components/views/ContactsView'));
const ScheduleView = lazy(() => import('./components/views/ScheduleView'));
const ChatView = lazy(() => import('./components/views/ChatView'));
const ScoringDashboard = lazy(() => import('./components/scoring'));
const UserManagementView = lazy(() => import('./components/views/UserManagementView'));
const FileCenterView = lazy(() => import('./components/views/FileCenterView'));

function AppContent() {
  const refreshDepartments = useAppStore((s) => s.refreshDepartments);
  const refreshSchedules = useAppStore((s) => s.refreshSchedules);
  const refreshTerms = useAppStore((s) => s.refreshTerms);
  const departmentsLoaded = useAppStore((s) => s.departmentsLoaded);
  const schedulesLoaded = useAppStore((s) => s.schedulesLoaded);
  const initialize = useAuthStore((s) => s.initialize);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      if (!departmentsLoaded) refreshDepartments();
      refreshTerms().then(() => {
        if (!schedulesLoaded) refreshSchedules();
      });
    }
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/register" element={<RegisterView />} />
          <Route element={<AuthGuard />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/files" element={<FilesView />} />
            <Route path="/courses" element={<CoursesView />} />
            <Route path="/contacts" element={<ContactsView />} />
            <Route path="/schedule" element={<ScheduleView />} />
            <Route path="/chat" element={<ChatView />} />
            <Route path="/scoring" element={<ScoringDashboard />} />
            <Route path="/users" element={<UserManagementView />} />
            <Route path="/file-center" element={<FileCenterView />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
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
