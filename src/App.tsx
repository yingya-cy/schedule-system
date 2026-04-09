import React, { useState } from 'react';
import Layout from './components/Layout';
import DashboardView from './components/views/DashboardView';
import CoursesView from './components/views/CoursesView';
import FilesView from './components/views/FilesView';
import ContactsView from './components/views/ContactsView';
import ScheduleView from './components/views/ScheduleView';
import ChatView from './components/views/ChatView';
import { ViewType } from './types';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'courses':
        return <CoursesView />;
      case 'files':
        return <FilesView />;
      case 'contacts':
        return <ContactsView />;
      case 'schedule':
        return <ScheduleView />;
      case 'chat':
        return <ChatView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {renderView()}
    </Layout>
  );
}
