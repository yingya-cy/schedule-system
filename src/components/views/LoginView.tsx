import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { LayoutDashboard, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function LoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle email verification from URL
  useEffect(() => {
    const verifyToken = searchParams.get('verify');
    if (verifyToken) {
      (async () => {
        try {
          const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`);
          const json = await res.json();
          if (json.success) {
            setSuccessMsg(json.data.message || '邮箱验证成功，请登录');
          } else {
            setError(json.error || '验证链接无效');
          }
        } catch {
          setError('验证失败，请稍后重试');
        }
        // Clean URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('verify');
        setSearchParams(newParams, { replace: true });
      })();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
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
      const msg = err.message || '登录失败';
      // Handle need-verify case with resend link
      setError(msg);
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
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#5590b2] to-[#d4b88a] flex items-center justify-center mx-auto shadow-[0_4px_16px_rgba(85,144,178,0.18)] mb-4">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
            >
              <LayoutDashboard size={30} className="text-white" />
            </motion.div>
          </div>
          <h1 className="text-2xl font-extrabold text-primary font-headline">学术空间</h1>
          <p className="text-sm text-outline mt-2">Academic Ether</p>
        </div>

        {/* Login Card */}
        <div className="bg-surface-container-lowest/85 backdrop-blur-sm rounded-3xl border border-outline-variant/50 shadow-[0_4px_20px_rgba(139,119,90,0.06)] p-6">
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
                placeholder="用户名或邮箱"
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

            {successMsg && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2"
              >
                {successMsg}
              </motion.p>
            )}

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
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.995 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-on-primary rounded-2xl font-bold text-sm shadow-[0_4px_16px_rgba(85,144,178,0.20)] hover:shadow-[0_6px_22px_rgba(85,144,178,0.28)] hover:brightness-105 transition-all duration-200 disabled:opacity-60"
            >
              {loading ? '登录中...' : '登录'}
            </motion.button>
          </form>
        </div>

        <p className="text-center text-sm text-on-surface-variant mt-6">
          还没有账号？{' '}
          <Link to="/register" className="text-primary font-medium hover:underline">
            立即注册
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
