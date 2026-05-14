import { useEffect } from 'react';
import { usePsychologyStore } from '../../../stores/psychologyStore';
import type { Counselor } from '../types/psychology';

export default function CounselorListPage() {
  const counselors = usePsychologyStore((s) => s.counselors);
  const loading = usePsychologyStore((s) => s.counselorsLoading);
  const fetchCounselors = usePsychologyStore((s) => s.fetchCounselors);
  const setView = usePsychologyStore((s) => s.setView);
  const setSelectedCounselorId = usePsychologyStore((s) => s.setSelectedCounselorId);

  useEffect(() => {
    fetchCounselors();
  }, []);

  const handleClick = (c: Counselor) => {
    setSelectedCounselorId(c.id);
    setView('counselor-detail');
  };

  const dayNames = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  if (counselors.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">暂无可用咨询师</p>
        <p className="empty-state-description">请稍后再来查看</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <h2 className="text-xl font-bold text-on-surface font-headline mb-4">咨询师列表</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {counselors.map((c) => (
          <button
            key={c.id}
            onClick={() => handleClick(c)}
            className="paper-card bg-surface p-4 text-left hover:shadow-md transition-shadow focus-ring"
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                {c.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-on-surface truncate">{c.name}</h3>
                <p className="text-sm text-on-surface-variant">{c.title || '心理咨询师'}</p>
                {c.bio && (
                  <p className="text-sm text-on-surface-variant mt-1.5 line-clamp-3">{c.bio}</p>
                )}
                {c.slots.length > 0 && (
                  <p className="text-xs text-outline mt-2">
                    可约：{[...new Set(c.slots.map((s) => dayNames[s.day_of_week]))].join('、')}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
