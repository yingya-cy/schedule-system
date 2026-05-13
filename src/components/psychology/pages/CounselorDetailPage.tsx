import { useEffect, useState } from 'react';
import { usePsychologyStore } from '../../../stores/psychologyStore';
import { counselorApi } from '../../../services/psychologyApi';
import type { Counselor } from '../types/psychology';
import AppointmentDialog from './AppointmentDialog';

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function CounselorDetailPage() {
  const selectedId = usePsychologyStore((s) => s.selectedCounselorId);
  const setView = usePsychologyStore((s) => s.setView);
  const createConversation = usePsychologyStore((s) => s.createConversation);
  const setActiveConversation = usePsychologyStore((s) => s.setActiveConversation);

  const [counselor, setCounselor] = useState<Counselor | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingSlot, setBookingSlot] = useState<{ start: string; end: string; day: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    counselorApi
      .get(selectedId)
      .then(setCounselor)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const handleStartChat = async () => {
    if (!counselor) return;
    try {
      const convId = await createConversation(counselor.id);
      setActiveConversation(convId);
      setView('chat');
    } catch (e) {
      setError(e instanceof Error ? e.message : '发起聊天失败');
    }
  };

  if (loading) return <div className="skeleton h-64 rounded-xl" />;
  if (!counselor) return <div className="empty-state"><p className="empty-state-title">咨询师不存在</p></div>;

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => setView('counselors')}
        className="text-sm text-primary hover:underline mb-4 inline-block"
      >
        &larr; 返回列表
      </button>

      {error && (
        <div className="mb-4 px-4 py-2 bg-error/10 text-error rounded-lg text-sm">{error}</div>
      )}

      <div className="paper-card bg-surface p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
            {counselor.name[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold text-on-surface font-headline">{counselor.name}</h2>
            <p className="text-sm text-on-surface-variant">{counselor.title || '心理咨询师'}</p>
          </div>
        </div>

        {counselor.bio && (
          <div>
            <h3 className="text-sm font-semibold text-on-surface mb-1">简介</h3>
            <p className="text-sm text-on-surface-variant whitespace-pre-wrap">{counselor.bio}</p>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-on-surface mb-2">可约时段</h3>
          {counselor.slots.length === 0 ? (
            <p className="text-sm text-on-surface-variant">暂无可用时段</p>
          ) : (
            <div className="space-y-1">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const daySlots = counselor.slots.filter((s) => s.day_of_week === d);
                if (daySlots.length === 0) return null;
                return (
                  <div key={d} className="flex items-center gap-2 py-1.5">
                    <span className="w-12 text-sm font-medium text-on-surface-variant">{DAY_NAMES[d]}</span>
                    {daySlots.map((slot, i) => (
                      <button
                        key={i}
                        onClick={() => setBookingSlot({ start: slot.start_time, end: slot.end_time, day: d })}
                        className="btn-primary text-xs px-3 py-1"
                      >
                        {slot.start_time.slice(0, 5)}-{slot.end_time.slice(0, 5)} 预约
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button onClick={handleStartChat} className="btn-secondary text-sm px-4 py-2 w-full">
          发起聊天
        </button>
      </div>

      {bookingSlot && counselor && (
        <AppointmentDialog
          counselor={counselor}
          slot={bookingSlot}
          onClose={() => setBookingSlot(null)}
          onSuccess={() => {
            setBookingSlot(null);
            setView('my-appointments');
          }}
        />
      )}
    </div>
  );
}
