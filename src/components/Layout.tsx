import React from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  FolderOpen, 
  Users, 
  CalendarDays, 
  MessageSquare, 
  Plus, 
  Settings, 
  HelpCircle,
  Search,
  Bell,
  UserCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ViewType, NavItem } from '@/types';
import { motion } from 'motion/react';

const navItems: NavItem[] = [
  { id: 'dashboard', label: '仪表盘', icon: 'dashboard' },
  { id: 'files', label: '课表中心', icon: 'calendar' },
];

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export default function Layout({ children, currentView, onViewChange }: LayoutProps) {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'dashboard': return <LayoutDashboard size={20} />;
      case 'book': return <BookOpen size={20} />;
      case 'folder': return <FolderOpen size={20} />;
      case 'users': return <Users size={20} />;
      case 'calendar': return <CalendarDays size={20} />;
      case 'chat': return <MessageSquare size={20} />;
      default: return <LayoutDashboard size={20} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 border-r border-surface-container-high bg-surface flex flex-col p-4 gap-2 z-50">
        <div className="flex items-center gap-3 px-3 mb-8 mt-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-lg shadow-primary/20">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
            >
              <LayoutDashboard size={24} />
            </motion.div>
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-primary font-headline leading-none">学术空间</h1>
            <p className="text-[10px] text-outline uppercase tracking-widest mt-1">Academic Ether</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                currentView === item.id 
                  ? "bg-white text-primary shadow-sm font-semibold" 
                  : "text-on-surface-variant hover:bg-surface-container-low hover:translate-x-1"
              )}
            >
              <span className={cn(
                "transition-colors",
                currentView === item.id ? "text-primary" : "text-outline group-hover:text-primary"
              )}>
                {getIcon(item.icon)}
              </span>
              <span className="font-headline text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-1">
          <button className="w-full bg-primary-container text-on-primary py-3 rounded-xl font-bold text-sm mb-6 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all">
            <Plus size={18} />
            新建日程
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-all">
            <Settings size={20} className="text-outline" />
            <span className="text-sm font-medium font-headline">设置</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-all">
            <HelpCircle size={20} className="text-outline" />
            <span className="text-sm font-medium font-headline">帮助</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-64 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-xl flex justify-between items-center px-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="flex items-center gap-8">
            <h2 className="text-xl font-bold tracking-tighter text-primary font-headline">
              {navItems.find(i => i.id === currentView)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline size-4" />
              <input 
                className="bg-surface-container-low border-none rounded-xl py-1.5 pl-10 pr-4 text-sm w-64 focus:ring-2 focus:ring-primary/20 transition-all" 
                placeholder="搜索内容..." 
                type="text"
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-surface-container-low rounded-full transition-all active:opacity-80 text-on-surface-variant">
                <Bell size={20} />
              </button>
              <button className="p-2 hover:bg-surface-container-low rounded-full transition-all active:opacity-80 text-on-surface-variant">
                <UserCircle size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* View Container */}
        <main className="p-8 min-h-[calc(100vh-64px)]">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
