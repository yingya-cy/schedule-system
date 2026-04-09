import React from 'react';
import { 
  RefreshCw, 
  Share2, 
  CloudUpload, 
  FileCheck, 
  CheckCircle2, 
  ArrowRight,
  Plus,
  Clock,
  MapPin,
  Calendar
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

const days = [
  { name: 'MON', date: '15' },
  { name: 'TUE', date: '16' },
  { name: 'WED', date: '17', isToday: true },
  { name: 'THU', date: '18' },
  { name: 'FRI', date: '19' },
];

const scheduleItems = [
  { day: 0, start: 8, duration: 2, title: '高等数学 II', location: '理学楼 302', type: 'Lecture', color: 'blue' },
  { day: 2, start: 8, duration: 2, title: '数字逻辑设计', location: '工程馆 B4', type: 'Seminar', color: 'gray' },
  { day: 4, start: 8, duration: 2, title: '高等数学 II', location: '理学楼 302', type: 'Lecture', color: 'blue' },
  { day: 1, start: 10, duration: 3, title: '操作系统实验', location: '计算中心 2F', type: 'Lab', color: 'purple' },
  { day: 3, start: 10, duration: 2, title: '科技写作', location: '线上课堂', type: 'Seminar', color: 'gray' },
  { day: 0, start: 14, duration: 2, title: '数据结构', location: '逸夫楼 101', type: 'Lecture', color: 'blue' },
  { day: 2, start: 14, duration: 2, title: '人工智能前沿导论', location: '大礼堂', type: 'Workshop', color: 'primary' },
  { day: 3, start: 14, duration: 2, title: '数据结构', location: '逸夫楼 101', type: 'Lecture', color: 'blue' },
];

export default function ScheduleView() {
  return (
    <div className="space-y-8">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2 font-headline">我的每周安排</h1>
          <p className="text-on-surface-variant font-medium">2024年 春季学期 · 第12周</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-low text-primary border border-primary/10 rounded-xl font-medium hover:bg-primary/5 transition-colors">
            <Calendar size={18} />
            <span>同步手机</span>
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-medium shadow-md shadow-primary/10 hover:shadow-lg hover:shadow-primary/20 transition-all">
            <Share2 size={18} />
            <span>导出</span>
          </button>
        </div>
      </header>

      {/* Bento Layout Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Schedule Grid */}
        <div className="col-span-12 xl:col-span-9 bento-card p-6">
          <div className="grid grid-cols-[80px_repeat(5,1fr)] border-b border-surface-container-high mb-4">
            <div className="flex items-center justify-center font-bold text-[10px] text-outline uppercase tracking-widest">时间</div>
            {days.map((day) => (
              <div key={day.name} className={cn(
                "flex flex-col items-center justify-center pb-4",
                day.isToday && "text-primary"
              )}>
                <span className="text-outline text-xs mb-1 font-bold">{day.name}</span>
                <span className="font-headline font-bold text-lg relative">
                  {day.date}
                  {day.isToday && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full"></span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[80px_repeat(5,1fr)] grid-rows-[repeat(8,100px)] relative">
            {/* Time Column */}
            {[8, 9, 10, 11, 12, 13, 14, 15].map((hour) => (
              <div key={hour} className="flex items-start justify-center pt-2 text-xs text-outline font-medium border-t border-surface-container-high/50">
                {hour.toString().padStart(2, '0')}:00
              </div>
            ))}

            {/* Grid Lines */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="border-l border-surface-container-high/50 h-full"></div>
            ))}

            {/* Schedule Items */}
            {scheduleItems.map((item, idx) => (
              <div 
                key={idx}
                className="absolute p-1"
                style={{
                  left: `calc(80px + ${item.day * 20}%)`,
                  top: `${(item.start - 8) * 100}px`,
                  width: '20%',
                  height: `${item.duration * 100}px`
                }}
              >
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    "h-full w-full rounded-xl p-3 border-l-4 shadow-sm",
                    item.color === 'blue' && "bg-blue-50 text-blue-700 border-primary",
                    item.color === 'gray' && "bg-surface-container text-on-surface-variant border-outline/30",
                    item.color === 'purple' && "bg-purple-50 text-purple-700 border-purple-500",
                    item.color === 'primary' && "bg-primary text-on-primary border-white shadow-lg shadow-primary/10",
                  )}
                >
                  <p className="text-[10px] font-bold uppercase mb-1 opacity-70">{item.type}</p>
                  <p className="font-headline text-xs font-bold leading-tight">{item.title}</p>
                  <p className="text-[10px] opacity-70 mt-1">{item.location}</p>
                </motion.div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="col-span-12 xl:col-span-3 space-y-6">
          {/* File Upload Section */}
          <div className="bg-surface-container-low rounded-[24px] p-6 border border-surface-container-high">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline font-bold text-on-surface">上传课表源文件</h3>
              <CloudUpload size={20} className="text-primary" />
            </div>
            <div className="border-2 border-dashed border-outline-variant/50 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-primary/50 hover:bg-white transition-all cursor-pointer group">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                <CloudUpload size={24} className="text-primary" />
              </div>
              <p className="text-xs font-medium text-on-surface mb-1">点击或拖拽文件至此</p>
              <p className="text-[10px] text-outline">支持 PDF, .XLSX 或 教务系统导出的 .ICS</p>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-surface-container">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold truncate">2024_Spring_Final.ics</p>
                  <div className="w-full bg-surface-container h-1 rounded-full mt-1">
                    <div className="bg-emerald-500 h-1 w-full rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Today Tasks */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-surface-container overflow-hidden relative">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full opacity-50"></div>
            <h3 className="font-headline font-bold text-on-surface mb-4 relative z-10">今日待办</h3>
            <div className="space-y-4 relative z-10">
              <div className="flex gap-4 items-start">
                <div className="w-1.5 h-1.5 mt-1.5 bg-primary rounded-full shrink-0"></div>
                <div>
                  <p className="text-xs font-bold text-on-surface">操作系统实验报告</p>
                  <p className="text-[10px] text-outline">截止时间 23:59</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-1.5 h-1.5 mt-1.5 bg-purple-500 rounded-full shrink-0"></div>
                <div>
                  <p className="text-xs font-bold text-on-surface">AI前沿讲座签到</p>
                  <p className="text-[10px] text-outline">14:00 - 大礼堂</p>
                </div>
              </div>
            </div>
            <button className="w-full mt-6 text-[10px] font-bold text-primary uppercase tracking-widest hover:underline text-left">
              查看全部待办 →
            </button>
          </div>

          {/* Campus News */}
          <div className="relative rounded-[24px] overflow-hidden aspect-video group cursor-pointer">
            <img 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
              src="https://picsum.photos/seed/campus/400/300" 
              alt="campus"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 to-transparent"></div>
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <p className="text-[10px] font-medium opacity-80 mb-1">校园生活</p>
              <h4 className="font-headline font-bold text-sm leading-tight">春季摄影大赛现已开启作品征集</h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
