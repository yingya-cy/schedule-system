import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bookmark,
  User,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { WEEKDAYS, COURSE_COLORS } from '@/types';

interface CourseRow {
  id: number;
  schedule_id: number;
  course_name: string;
  weekday: number;
  sections: number[];
  weeks: number[];
  teacher: string | null;
  location: string | null;
  remark: string | null;
  schedule_name: string;
  department: string;
}

function sectionsToTime(sections: number[]): string {
  if (!sections || sections.length === 0) return '';
  const sorted = [...sections].sort((a, b) => a - b);
  const day = WEEKDAYS[0]; // placeholder
  if (sorted.length === 1) return `第${sorted[0]}节`;
  return `第${sorted[0]}-${sorted[sorted.length - 1]}节`;
}

export default function CoursesView() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    fetch('/api/courses?' + params.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setCourses(json.data);
          const depts = [...new Set(json.data.map((c: CourseRow) => c.department))] as string[];
          setDepartments(depts);
        }
      })
      .finally(() => setLoading(false));
  }, [category, token]);

  return (
    <section className="max-w-7xl mx-auto space-y-8">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory(null)}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 ${
              !category ? 'bg-primary text-on-primary shadow-md shadow-primary/20' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            全部
          </button>
          {departments.map(dept => (
            <button
              key={dept}
              onClick={() => setCategory(dept)}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105 ${
                category === dept ? 'bg-primary text-on-primary shadow-md shadow-primary/20' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="text-center py-20 text-on-surface-variant">
          <Sparkles size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">加载课程数据...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 text-on-surface-variant">
          <p className="text-lg font-medium">暂无课程数据</p>
          <p className="text-sm mt-1">请先上传课表文件</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course, i) => (
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

              <div className="p-6 flex-1 flex flex-col">
                <div
                  className="mb-6 h-12 w-12 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: `${COURSE_COLORS[i % COURSE_COLORS.length]}15`,
                    color: COURSE_COLORS[i % COURSE_COLORS.length],
                  }}
                >
                  <Sparkles size={24} />
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2 tracking-tight font-headline">{course.course_name}</h3>
                <p className="text-sm text-on-surface-variant mb-6 leading-relaxed line-clamp-2">
                  {course.remark || `${course.schedule_name} · ${course.department}`}
                </p>

                <div className="mt-auto space-y-3 pt-4 border-t border-surface-container-high">
                  <div className="flex items-center justify-between text-xs text-outline">
                    <div className="flex items-center gap-2">
                      <User size={14} />
                      <span>{course.teacher || '未指定'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} />
                      <span>{course.location || '未指定'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: `${COURSE_COLORS[i % COURSE_COLORS.length]}15`,
                        color: COURSE_COLORS[i % COURSE_COLORS.length],
                      }}
                    >
                      {course.department}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary ml-auto">
                      <Clock size={14} />
                      <span>{WEEKDAYS[course.weekday - 1] || `周${course.weekday}`} {sectionsToTime(course.sections)}</span>
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
              <h3 className="text-2xl font-bold mb-4 leading-tight font-headline">上传新课程</h3>
              <p className="text-on-primary/80 text-sm leading-relaxed mb-6">通过课表中心上传 PDF 或图片，AI 将自动识别并录入课程数据。</p>
            </div>
            <button
              onClick={() => navigate('/files')}
              className="bg-white text-primary px-6 py-3 rounded-xl font-bold text-sm w-fit transition-all hover:shadow-lg hover:bg-on-primary active:scale-95"
            >
              前往课表中心
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
