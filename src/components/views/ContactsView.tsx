import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Calendar,
  ArrowRight,
  UserPlus,
  Users,
  CalendarDays,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

interface ContactRow {
  id: number;
  username: string;
  name: string;
  role: string;
  department: string | null;
  avatar_url: string | null;
  email?: string;
}

const roleLabels: Record<string, string> = {
  admin: '管理员',
  teacher: '教师',
  student: '学生',
};

const depColorMap: Record<string, string> = {
  '主任团': 'bg-blue-50 text-blue-600',
  '网编部': 'bg-purple-50 text-purple-600',
  '秘书部': 'bg-emerald-50 text-emerald-600',
  '策划部': 'bg-orange-50 text-orange-600',
  '咨询部': 'bg-cyan-50 text-cyan-600',
  '外联部': 'bg-pink-50 text-pink-600',
  '宣传部': 'bg-rose-50 text-rose-600',
};

export default function ContactsView() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (department) params.set('department', department);
    fetch('/api/contacts?' + params.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setContacts(json.data);
          const depts = [...new Set(json.data.map((c: ContactRow) => c.department).filter(Boolean))] as string[];
          setDepartments(depts);
        }
      })
      .finally(() => setLoading(false));
  }, [department, token]);

  const onlineCount = contacts.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30 flex-shrink-0 transition-transform hover:scale-105 hover:rotate-3 cursor-default">
          <Users className="text-on-primary" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-on-surface font-headline">联系人</h1>
          <p className="text-sm text-on-surface-variant mt-1">查看团队通讯录和部门信息</p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-primary p-6 rounded-2xl text-on-primary shadow-xl shadow-primary/10 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-on-primary/70 text-xs font-bold uppercase tracking-widest mb-1">团队总览</p>
            <h3 className="text-3xl font-extrabold font-headline">{onlineCount} 名成员</h3>
            <p className="text-sm mt-4 opacity-90">来自 {departments.length} 个部门</p>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <Users size={128} />
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-surface-container-high flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-sm font-semibold text-on-surface-variant">系统活跃</span>
          </div>
          <p className="text-2xl font-bold font-headline mt-2 text-on-surface">{onlineCount} 位用户</p>
          <p className="text-xs text-outline mt-1">所有已激活的团队成员</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-surface-container-high flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <CalendarDays size={18} className="text-primary" />
            <span className="text-sm font-semibold text-on-surface-variant">部门分布</span>
          </div>
          <p className="text-2xl font-bold font-headline mt-2 text-on-surface">{departments.length} 个部门</p>
          <p className="text-xs text-outline mt-1">{departments.slice(0, 3).join('、')}</p>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setDepartment(null)}
          className={`px-5 py-2 rounded-full text-sm font-bold shadow-md shadow-primary/20 whitespace-nowrap transition-all ${
            !department ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          全部
        </button>
        {departments.map(dept => (
          <button
            key={dept}
            onClick={() => setDepartment(dept)}
            className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              department === dept ? 'bg-primary text-on-primary shadow-md shadow-primary/20' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {dept}
          </button>
        ))}
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div className="text-center py-16 text-on-surface-variant">
          <p className="text-sm">加载联系人...</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">暂无成员</p>
          <p className="text-sm mt-1">请在用户管理中创建用户账号</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {contacts.map((contact) => {
            const depColor = contact.department ? depColorMap[contact.department] || 'bg-slate-50 text-slate-600' : 'bg-slate-50 text-slate-600';
            return (
              <motion.div
                key={contact.id}
                whileHover={{ y: -5 }}
                className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.06)] border border-surface-container-high transition-all duration-300 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                      {contact.name[0]}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-4 border-white rounded-full bg-emerald-500" />
                  </div>
                  <div className="flex gap-2">
                    <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-low text-primary hover:bg-primary hover:text-on-primary transition-all">
                      <MessageSquare size={18} />
                    </button>
                    <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-primary-container/10 hover:text-primary transition-all">
                      <Calendar size={18} />
                    </button>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-lg font-bold font-headline text-on-surface">{contact.name}</h4>
                    {contact.department && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${depColor}`}>
                        {contact.department}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-outline mb-4">{roleLabels[contact.role] || contact.role}</p>
                  <p className="text-sm text-on-surface-variant leading-relaxed mb-6 line-clamp-2">
                    {contact.username} {contact.email ? `· ${contact.email}` : ''}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-surface-container-high">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-outline font-bold tracking-tight">状态</span>
                      <span className="text-xs font-semibold text-emerald-600">活跃</span>
                    </div>
                    <button className="text-sm font-bold text-primary group-hover:underline flex items-center gap-1">
                      查看简介 <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Invite Placeholder */}
          <div
            onClick={() => navigate('/users')}
            className="border-2 border-dashed border-surface-container-high rounded-2xl flex flex-col items-center justify-center p-8 hover:bg-primary/5 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <UserPlus size={24} />
            </div>
            <span className="text-sm font-bold text-on-surface-variant">邀请新同事</span>
            <span className="text-[10px] text-outline mt-1 uppercase tracking-tight">Expand the Ether</span>
          </div>
        </div>
      )}
    </div>
  );
}
