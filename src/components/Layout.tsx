import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Menu,
  X,
  Trophy,
  Heart,
  Bot,
  Smile,
  LogOut,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavItem, ROUTE_LABELS, RoutePath } from '@/types';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '@/stores/authStore';

const navItems: NavItem[] = [
  { id: 'dashboard', label: '仪表盘', icon: 'dashboard' },
  { id: 'files', label: '课表中心', icon: 'calendar' },
  { id: 'file-center', label: '文件中心', icon: 'folder' },
  { id: 'scoring', label: '比赛评分', icon: 'trophy' },
  { id: 'users', label: '用户管理', icon: 'users', adminOnly: true },
  // { id: 'psychology', label: '心理咨询', icon: 'heart' },
  { id: 'ai-schedule', label: 'AI 排课', icon: 'bot' },
  { id: 'ai-counsel', label: 'AI 咨询', icon: 'smile' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // Track mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get current path
  const currentPath = '/' + location.pathname.split('/')[1] || '/dashboard';
  const currentView = currentPath as RoutePath;

  const handleNavClick = (viewId: string) => {
    const path = `/${viewId}`;
    navigate(path);
    setMobileMenuOpen(false);
  };

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && user?.role !== 'admin') return false;
    return true;
  });

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'dashboard': return <LayoutDashboard size={20} />;
      case 'book': return <BookOpen size={20} />;
      case 'folder': return <FolderOpen size={20} />;
      case 'users': return <Users size={20} />;
      case 'calendar': return <CalendarDays size={20} />;
      case 'chat': return <MessageSquare size={20} />;
      case 'trophy': return <Trophy size={20} />;
      case 'heart': return <Heart size={20} />;
      case 'bot': return <Bot size={20} />;
      case 'smile': return <Smile size={20} />;
      default: return <LayoutDashboard size={20} />;
    }
  };

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      {/* Mobile Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: mobileMenuOpen ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/50 z-40 lg:hidden pointer-events-none"
        style={{ pointerEvents: mobileMenuOpen && isMobile ? 'auto' : 'none' }}
      >
        <div
          className="absolute inset-0"
          onClick={() => setMobileMenuOpen(false)}
        />
      </motion.div>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 24 }}
        className={cn(
          "fixed left-0 top-0 h-full w-64 border-r border-outline-variant/40 bg-surface/90 backdrop-blur-md flex flex-col p-4 gap-2 z-50",
          "lg:translate-x-0",
          isMobile ? "-translate-x-full" : mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 px-3 mb-8 mt-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5590b2] to-[#d4b88a] flex items-center justify-center text-white shadow-sm">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
            >
              <LayoutDashboard size={22} />
            </motion.div>
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-primary font-headline leading-none">学术空间</h1>
            <p className="text-[10px] text-outline uppercase tracking-widest mt-1">Academic Ether</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group focus-ring",
                currentView === `/${item.id}`
                  ? "bg-primary/10 text-primary shadow-sm font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              )}
            >
              <span className={cn(
                "transition-colors",
                currentView === `/${item.id}` ? "text-primary" : "text-outline group-hover:text-primary"
              )}>
                {getIcon(item.icon)}
              </span>
              <span className="font-headline text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-1">
          <button
            onClick={() => { navigate('/files'); setMobileMenuOpen(false); }}
            className="w-full bg-primary-container text-on-primary py-3 rounded-2xl font-bold text-sm mb-4 flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(85,144,178,0.18)] hover:shadow-[0_6px_20px_rgba(85,144,178,0.25)] hover:brightness-105 active:brightness-95 transition-all duration-200"
          >
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
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col w-full pb-20 lg:pb-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 h-16 bg-surface-container-lowest/80 backdrop-blur-md flex justify-between items-center px-4 lg:px-8 shadow-[0_4px_20px_rgba(139,119,90,0.06)]">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="focus-ring lg:hidden p-2 hover:bg-surface-container-low rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h2 className="text-base sm:text-lg lg:text-xl font-bold tracking-tighter text-primary font-headline truncate">
              {ROUTE_LABELS[currentPath as RoutePath] || ROUTE_LABELS['/dashboard']}
            </h2>
          </div>

          <div className="flex items-center gap-2 lg:gap-4 shrink-0">
            <div className="relative group hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline size-4" />
              <input
                className="bg-surface-container-low border-none rounded-xl py-1.5 pl-10 pr-4 text-sm w-32 sm:w-40 lg:w-64 focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="搜索..."
                type="text"
              />
            </div>
            <div className="flex items-center gap-1 lg:gap-2">
              <button className="p-2 hover:bg-surface-container-low rounded-full transition-all active:opacity-80 text-on-surface-variant">
                <Bell size={20} />
              </button>
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1.5 hover:bg-surface-container-low rounded-xl transition-all active:opacity-80"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {user?.name?.[0] || '?'}
                  </div>
                  <span className="hidden md:block text-sm font-medium text-on-surface max-w-[80px] truncate">
                    {user?.name || ''}
                  </span>
                </button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 z-20 w-56 bg-surface border border-surface-container-high rounded-xl shadow-lg py-1"
                      >
                        <div className="px-4 py-3 border-b border-surface-container-high">
                          <p className="text-sm font-semibold text-on-surface">{user?.name}</p>
                          <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
                            <Shield size={10} />
                            {user?.role === 'admin' ? '管理员' : user?.role === 'teacher' ? '教师' : '学生'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            logout();
                            navigate('/login');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors"
                        >
                          <LogOut size={16} />
                          退出登录
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* View Container */}
        <main className="p-4 lg:p-8 min-h-[calc(100vh-64px)] w-full">
          <motion.div
            key={currentPath}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-surface-container-high safe-area-inset flex lg:hidden">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-3 gap-1 touch-target transition-colors",
                currentView === `/${item.id}`
                  ? "text-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <span className={currentView === `/${item.id}` ? "text-primary" : "text-outline group-hover:text-primary"}>
                {getIcon(item.icon)}
              </span>
              <span className="text-xs font-medium font-headline">{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
