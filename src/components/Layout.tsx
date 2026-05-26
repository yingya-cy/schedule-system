import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  FolderOpen,
  Users,
  Settings,
  HelpCircle,
  Menu,
  X,
  Trophy,
  Smile,
  User,
  LogOut,
  Shield,
  Sun,
  Moon,
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
  { id: 'ai-counsel', label: 'AI 咨询', icon: 'smile' },
  { id: 'profile', label: '个人中心', icon: 'user' },
  { id: 'users', label: '用户管理', icon: 'users', adminOnly: true },
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

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
      setDark(true);
    }
  }, []);
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'dashboard': return <LayoutDashboard size={20} />;
      case 'users': return <Users size={20} />;
      case 'calendar': return <CalendarDays size={20} />;
      case 'folder': return <FolderOpen size={20} />;
      case 'trophy': return <Trophy size={20} />;
      case 'smile': return <Smile size={20} />;
      case 'user': return <User size={20} />;
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
        className="fixed inset-0 bg-black/50 z-[var(--z-overlay)] lg:hidden pointer-events-none"
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
          "fixed left-0 top-0 h-full w-64 border-r border-outline-variant/40 bg-surface/90 backdrop-blur-md flex flex-col p-4 gap-2",
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
            onClick={() => { setSettingsOpen(true); setMobileMenuOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-all"
          >
            <Settings size={20} className="text-outline" />
            <span className="text-sm font-medium font-headline">设置</span>
          </button>
          <button
            onClick={() => { setHelpOpen(true); setMobileMenuOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-all"
          >
            <HelpCircle size={20} className="text-outline" />
            <span className="text-sm font-medium font-headline">帮助</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col w-full pb-20 lg:pb-0 min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 h-16 bg-surface-container-lowest/80 backdrop-blur-md flex justify-between items-center px-4 lg:px-8 shadow-nav">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="focus-ring lg:hidden p-3 hover:bg-surface-container-low rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h2 className="text-base sm:text-lg lg:text-xl font-bold tracking-tighter font-headline truncate title-ink"
              title={ROUTE_LABELS[currentPath as RoutePath] || ROUTE_LABELS['/dashboard']}>
              {ROUTE_LABELS[currentPath as RoutePath] || ROUTE_LABELS['/dashboard']}
            </h2>
          </div>

          <div className="flex items-center gap-2 lg:gap-4 shrink-0">
            <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 hover:bg-surface-container-low rounded-xl transition-all active:opacity-80"
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

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSettingsOpen(false)}>
          <div className="bg-surface rounded-2xl w-full max-w-sm mx-4 p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-on-surface">设置</h3>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-on-surface">深色模式</span>
              <button onClick={toggleDark} className="w-12 h-7 rounded-full bg-surface-container-high border border-outline-variant relative transition-colors">
                <motion.div
                  className="w-5 h-5 rounded-full absolute top-0.5 flex items-center justify-center"
                  animate={{ left: dark ? 24 : 4 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  {dark ? <Moon size={14} className="text-on-surface-variant" /> : <Sun size={14} className="text-warning" />}
                </motion.div>
              </button>
            </div>
            <button onClick={() => setSettingsOpen(false)} className="btn-primary w-full py-2 text-sm">完成</button>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setHelpOpen(false)}>
          <div className="bg-surface rounded-2xl w-full max-w-sm mx-4 p-6 space-y-4 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-on-surface">帮助</h3>

            <div>
              <h4 className="text-sm font-semibold text-on-surface mb-1">全国心理援助热线</h4>
              <p className="text-xl font-bold text-error">400-161-9995</p>
              <p className="text-xs text-on-surface-variant">24 小时免费，随时可拨打</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-on-surface mb-1">学校心理咨询中心</h4>
              <p className="text-sm text-on-surface-variant">东校区：综合楼西侧 504 · 020-38256674</p>
              <p className="text-sm text-on-surface-variant">西校区：综合楼 305 · QQ 2839789996</p>
              <p className="text-sm text-on-surface-variant">白云校区：二教附属楼 102 · 020-36545761</p>
              <p className="text-sm text-on-surface-variant">河源校区：厚德楼 307 · 0762-8883151</p>
              <p className="text-xs text-on-surface-variant mt-1">周一至周五 8:30-16:30</p>
              <p className="text-xs text-on-surface-variant">预约：公众号"广师大心理健康教育与咨询中心"→咨询服务→选择校区</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-on-surface mb-1">使用小提示</h4>
              <ul className="text-xs text-on-surface-variant space-y-1 list-disc list-inside">
                <li>小暖可以帮你解答校园生活、教务、就业等问题</li>
                <li>对话自动保存，关闭页面后再打开可继续</li>
                <li>点击追问按钮可以引导对话方向</li>
                <li>随时可以点击"停止"中断 AI 回复</li>
              </ul>
            </div>

            <button onClick={() => setHelpOpen(false)} className="btn-primary w-full py-2 text-sm">知道了</button>
          </div>
        </div>
      )}
    </div>
  );
}
