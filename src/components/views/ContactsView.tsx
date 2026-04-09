import React from 'react';
import { 
  MessageSquare, 
  Calendar, 
  ArrowRight, 
  UserPlus, 
  Search,
  Users,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Member } from '@/types';

const members: Member[] = [
  {
    id: '1',
    name: '林清雅',
    role: '计算机科学系 · 副教授',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAj3HjroaQ9JDnu0TBeem76W1XiWzV3xBi9eiNjqYckxUxdPqLYVHn-s7sJuIoAr9x0_MtI0pmrwJ4AIOPsUMPARak7mpmPneAv4b94k8e-U2_I1x6aYuaLjvw3-P3iewW_n-jcMUbVUCrS3BS4Zp5XrTn2zNw1PXbHj6cKS6ztHZ3Sdw3nPusBVXW3ti2D-TwfCK4kVNzM-zHLM0nYhMTDvMG8A3r9UJSaVmdiZcvkBgBD-VIo0p4eMiu9bbX-q4IDcOrp4IqwCSU',
    status: 'online',
    statusText: '空闲 (至 14:00)',
    description: '专注于人机交互与情感计算研究。目前正主导"共情AI"校园导航系统项目。',
    tags: ['CS 专家'],
  },
  {
    id: '2',
    name: '张子墨',
    role: '艺术设计学院 · 讲师',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDIeCZv95Y__5hl6x_Spy8GdsZvGVuEajGF6maFAj6ja6lMe29aVy5n1J_bhSCe8Y1EAMXFJ1yaiykSDNSV2maBRx-fJqPdQFrEK9AZ12uf9sls6OmOxriNdPEqZFqbRIa308dRsAF7YXjNnMalc6nu7C7R9PrbLKQiLQDSRYIEs7RvjnASDwJ2zHrPx1a0EwWG0B15RsFGNP0dmSP_D237zeHiYBQO_4FFyemeW3NbB5LI3JFZr1nR2xSblhKO68EaPAm0rSc68vs',
    status: 'away',
    statusText: '会议中 (10:00 - 11:30)',
    description: '深耕极简主义视觉传达，致力于提升校园数字界面的"空气感"与人文关怀。',
    tags: ['设计总监'],
  },
  {
    id: '3',
    name: '陈若冰',
    role: '教务处 · 负责人',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXklTgfnjhO6r4znZ1YsjvdAhn3NxiAqFgWFsLRrTslnY3inoPRpM-48_8e2l4pgU5cSEtTxuhYUJ3Oa23cxj8fT5FcWUPFV8DBUsmlxyfeEx0VEsJqWpE68q551RYAIlwqVJ0erNFl1h_ghjp9FJq7SitsjFXYZloNpns_cHkMc6sPd2kTwGvYC2fvcKlgSveZ8t4eROxxfIXOrgZR_P7dSo3oR3_NAel2a7Vc6i2wS5eY5Gt-Svo0i4hw6j-N1EWwrI-cyw8e18',
    status: 'online',
    statusText: '空闲 (全天)',
    description: '负责跨学科课程整合与学分互认机制优化，是校园各部门协作的重要纽带。',
    tags: ['教务协作'],
  },
  {
    id: '4',
    name: '陆明远',
    role: '物理实验中心 · 技术支持',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAPmGSCCYX6pkVoOe9TqEs6aZq5HLjplA1Byp1fVUKs87Q1fYYbN0_Nokbf9Fiprl75VsxHox7E7bX7Ee_eWp00UKAEzDzcoQziIHWPedRi-xblKeMRTAwZQRkQBpZSQsuafNdyJxWZg-mLQBLik4rQorU8PgF7JSBE_0VkvZsdM9DrOA0jMXIrw4DYIZkyaBJ151ZuA8nIZCRb4aLr1lsixphHz60revUaxyJYui37RjTj8L-p_QXc-g29CRjOWN9BSb923RoKlLA',
    status: 'busy',
    statusText: '请勿打扰 (实验中)',
    description: '精通精密仪器维护与实验室自动化流程，正协助多项量子物理实验开展。',
    tags: ['科研助手'],
  },
];

export default function ContactsView() {
  return (
    <div className="space-y-8">
      {/* Hero / Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-primary p-6 rounded-2xl text-on-primary shadow-xl shadow-primary/10 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-on-primary/70 text-xs font-bold uppercase tracking-widest mb-1">团队总览</p>
            <h3 className="text-3xl font-extrabold font-headline">42 名成员</h3>
            <p className="text-sm mt-4 opacity-90">当前 12 人在线，8 人正在进行课程</p>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <Users size={128} />
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-surface-container-high flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-sm font-semibold text-on-surface-variant">实时空闲状态</span>
          </div>
          <p className="text-2xl font-bold font-headline mt-2 text-on-surface">24 人当前空闲</p>
          <p className="text-xs text-outline mt-1">您可以随时发起协作或对话</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-surface-container-high flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <CalendarDays size={18} className="text-primary" />
            <span className="text-sm font-semibold text-on-surface-variant">部门动态</span>
          </div>
          <p className="text-2xl font-bold font-headline mt-2 text-on-surface">人工智能实验室</p>
          <p className="text-xs text-outline mt-1">本周新增 3 项联合科研项目</p>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <button className="px-5 py-2 rounded-full bg-primary text-on-primary text-sm font-bold shadow-md shadow-primary/20 whitespace-nowrap">全部</button>
        <button className="px-5 py-2 rounded-full bg-surface-container-low text-on-surface-variant text-sm font-medium hover:bg-surface-container-high transition-colors whitespace-nowrap">计算机科学系</button>
        <button className="px-5 py-2 rounded-full bg-surface-container-low text-on-surface-variant text-sm font-medium hover:bg-surface-container-high transition-colors whitespace-nowrap">艺术设计学院</button>
        <button className="px-5 py-2 rounded-full bg-surface-container-low text-on-surface-variant text-sm font-medium hover:bg-surface-container-high transition-colors whitespace-nowrap">管理学院</button>
        <button className="px-5 py-2 rounded-full bg-surface-container-low text-on-surface-variant text-sm font-medium hover:bg-surface-container-high transition-colors whitespace-nowrap">基础教学部</button>
        <button className="px-5 py-2 rounded-full bg-surface-container-low text-on-surface-variant text-sm font-medium hover:bg-surface-container-high transition-colors whitespace-nowrap">行政办公室</button>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {members.map((member) => (
          <motion.div 
            key={member.id}
            whileHover={{ y: -5 }}
            className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.06)] border border-surface-container-high transition-all duration-300 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="relative">
                <img className="w-16 h-16 rounded-xl object-cover" src={member.avatar} alt={member.name} />
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-5 h-5 border-4 border-white rounded-full",
                  member.status === 'online' && "bg-emerald-500",
                  member.status === 'away' && "bg-amber-500",
                  member.status === 'busy' && "bg-red-500",
                  member.status === 'offline' && "bg-slate-400",
                )}></div>
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
                <h4 className="text-lg font-bold font-headline text-on-surface">{member.name}</h4>
                {member.tags?.map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 uppercase">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-xs text-outline mb-4">{member.role}</p>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-6 line-clamp-2">
                {member.description}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-surface-container-high">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-outline font-bold tracking-tight">状态</span>
                  <span className={cn(
                    "text-xs font-semibold",
                    member.status === 'online' && "text-emerald-600",
                    member.status === 'away' && "text-amber-600",
                    member.status === 'busy' && "text-red-600",
                  )}>{member.statusText}</span>
                </div>
                <button className="text-sm font-bold text-primary group-hover:underline flex items-center gap-1">
                  查看简介 <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Add New Member Placeholder */}
        <div className="border-2 border-dashed border-surface-container-high rounded-2xl flex flex-col items-center justify-center p-8 hover:bg-primary/5 transition-all cursor-pointer group">
          <div className="w-12 h-12 rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <UserPlus size={24} />
          </div>
          <span className="text-sm font-bold text-on-surface-variant">邀请新同事</span>
          <span className="text-[10px] text-outline mt-1 uppercase tracking-tight">Expand the Ether</span>
        </div>
      </div>
    </div>
  );
}
