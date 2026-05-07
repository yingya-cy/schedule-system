import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { motion } from 'motion/react';

export default function RegisterView() {
  const [form, setForm] = useState({ username: '', email: '', name: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.username.trim() || !form.email.trim() || !form.name.trim() || !form.password) {
      setError('请填写所有字段');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('邮箱格式不正确');
      return;
    }
    if (form.password.length < 6) {
      setError('密码长度至少6位');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('两次密码不一致');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        name: form.name.trim(),
        password: form.password,
      });
      setSuccess(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-surface rounded-2xl shadow-lg p-8 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2">注册成功</h2>
          <p className="text-on-surface-variant mb-6">
            验证邮件已发送至 <strong>{form.email}</strong>，请点击邮件中的链接激活账号。
          </p>
          <Link to="/login" className="text-primary font-medium hover:underline">
            返回登录
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface rounded-2xl shadow-lg p-8 max-w-md w-full"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-on-surface">创建账号</h1>
          <p className="text-on-surface-variant mt-1 text-sm">注册后需验证邮箱</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">用户名</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="登录时使用"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">邮箱</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="example@qq.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">姓名</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="显示名称"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">密码</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="至少6位"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">确认密码</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="再次输入密码"
            />
          </div>

          {error && (
            <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="text-center text-sm text-on-surface-variant mt-6">
          已有账号？{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">
            立即登录
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
