import React from 'react';
import { 
  Search, 
  ChevronDown, 
  Bookmark, 
  User, 
  MapPin, 
  Clock,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { CourseDisplay } from '@/types';

const courses: CourseDisplay[] = [
  {
    id: '1',
    title: '现代建筑设计导论',
    description: '探索当代建筑的美学与结构，重点关注可持续性发展与空间秩序感。',
    instructor: '张明 教授',
    location: '教学楼 A-302',
    time: '周一 08:00 - 10:00',
    category: '艺术学院',
    icon: 'architecture',
    color: 'blue',
  },
  {
    id: '2',
    title: '高级量子物理',
    description: '深入探讨微观世界的物理法则，涵盖量子纠缠、波动力学及相关数学工具。',
    instructor: '李思远 博士',
    location: '理学院 L-105',
    time: '周三 14:00 - 16:00',
    category: '教学组',
    icon: 'science',
    color: 'green',
  },
  {
    id: '3',
    title: '世界文明史',
    description: '跨越时空的宏大叙事，分析人类文明的兴衰演变与核心文化价值。',
    instructor: '陈文静 教授',
    location: '人文学院 H-211',
    time: '周五 10:00 - 12:00',
    category: '教学组',
    icon: 'history_edu',
    color: 'purple',
  },
  {
    id: '4',
    title: '高校行政管理实务',
    description: '面向行政职能部门的内部研讨课程，聚焦流程优化与校园服务体系建设。',
    instructor: '行政办 统筹',
    location: '行政楼 会议室',
    time: '不定时 线上/线下',
    category: '行政部',
    icon: 'admin_panel_settings',
    color: 'orange',
  },
  {
    id: '5',
    title: '数字媒体艺术探索',
    description: '通过数字工具重新定义视觉语言，跨越传统艺术与科技的边界。',
    instructor: '王也 导师',
    location: '艺术中心 401',
    time: '周二 18:30 - 20:30',
    category: '艺术学院',
    icon: 'palette',
    color: 'pink',
    image: 'https://picsum.photos/seed/art/400/200',
  },
];

export default function CoursesView() {
  return (
    <section className="max-w-7xl mx-auto space-y-8">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button className="px-6 py-2.5 bg-primary text-on-primary rounded-full text-sm font-semibold shadow-md shadow-primary/20 transition-all hover:scale-105">全部</button>
          <button className="px-6 py-2.5 bg-surface-container-lowest text-on-surface-variant rounded-full text-sm font-medium hover:bg-surface-container-high transition-all">教学组</button>
          <button className="px-6 py-2.5 bg-surface-container-lowest text-on-surface-variant rounded-full text-sm font-medium hover:bg-surface-container-high transition-all">行政部</button>
          <button className="px-6 py-2.5 bg-surface-container-lowest text-on-surface-variant rounded-full text-sm font-medium hover:bg-surface-container-high transition-all">艺术学院</button>
        </div>
        <div className="flex items-center gap-2 text-outline text-sm">
          <span>排序:</span>
          <button className="flex items-center gap-1 font-semibold text-on-surface">
            最近更新
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <motion.div 
            key={course.id}
            whileHover={{ y: -5 }}
            className="group bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-transparent hover:border-primary/10 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col relative"
          >
            <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-2 bg-white/80 backdrop-blur-md rounded-lg text-primary hover:bg-primary hover:text-white transition-colors shadow-sm">
                <Bookmark size={18} />
              </button>
            </div>

            {course.image && (
              <div className="h-32 relative overflow-hidden">
                <img 
                  alt={course.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  src={course.image} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                <span className="absolute bottom-3 left-4 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 backdrop-blur-md text-white uppercase tracking-wider">
                  {course.category}
                </span>
              </div>
            )}

            <div className="p-6 flex-1 flex flex-col">
              {!course.image && (
                <div className={cn(
                  "mb-6 h-12 w-12 rounded-xl flex items-center justify-center",
                  course.color === 'blue' && "bg-blue-50 text-blue-600",
                  course.color === 'green' && "bg-green-50 text-green-600",
                  course.color === 'purple' && "bg-purple-50 text-purple-600",
                  course.color === 'orange' && "bg-orange-50 text-orange-600",
                  course.color === 'pink' && "bg-pink-50 text-pink-600",
                )}>
                  <Sparkles size={24} />
                </div>
              )}
              <h3 className="text-lg font-bold text-on-surface mb-2 tracking-tight font-headline">{course.title}</h3>
              <p className="text-sm text-on-surface-variant mb-6 leading-relaxed line-clamp-2">{course.description}</p>
              
              <div className="mt-auto space-y-3 pt-4 border-t border-surface-container-high">
                <div className="flex items-center justify-between text-xs text-outline">
                  <div className="flex items-center gap-2">
                    <User size={14} />
                    <span>{course.instructor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>{course.location}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  {!course.image && (
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      course.color === 'blue' && "bg-blue-50 text-blue-700",
                      course.color === 'green' && "bg-green-50 text-green-700",
                      course.color === 'purple' && "bg-purple-50 text-purple-700",
                      course.color === 'orange' && "bg-orange-50 text-orange-700",
                      course.color === 'pink' && "bg-pink-50 text-pink-700",
                    )}>
                      {course.category}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary ml-auto">
                    <Clock size={14} />
                    <span>{course.time}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Bento Style Placeholder */}
        <div className="group bg-primary rounded-2xl p-8 shadow-xl shadow-primary/20 flex flex-col justify-between text-on-primary relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] opacity-10">
            <Sparkles size={180} />
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-4 leading-tight font-headline">还未找到心仪课程？</h3>
            <p className="text-on-primary/80 text-sm leading-relaxed mb-6">浏览我们的全校课程公开目录，或者根据你的学分要求生成定制化课表推荐。</p>
          </div>
          <button className="bg-white text-primary px-6 py-3 rounded-xl font-bold text-sm w-fit transition-all hover:shadow-lg hover:bg-on-primary active:scale-95">
            开启智能搜索
          </button>
        </div>
      </div>
    </section>
  );
}
