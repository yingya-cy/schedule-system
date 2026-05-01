import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { LayoutDashboard, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function LoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      const returnUrl = searchParams.get('returnUrl') || '/dashboard';
      navigate(returnUrl, { replace: true });
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-lg shadow-primary/20 mb-4">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
            >
              <LayoutDashboard size={32} className="text-on-primary" />
            </motion.div>
          </div>
          <h1 className="text-2xl font-extrabold text-primary font-headline">学术空间</h1>
          <p className="text-sm text-outline mt-2">Academic Ether</p>
        </div>

        {/* Login Card */}
        <div className="bg-surface rounded-2xl border border-surface-container-high shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-1.5 font-headline">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-surface-container-high text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-medium"
                placeholder="请输入用户名"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-surface mb-1.5 font-headline">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-surface-container-lowest border border-surface-container-high text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-medium"
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-error bg-error/5 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all disabled:opacity-60"
            >
              {loading ? '登录中...' : '登录'}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
