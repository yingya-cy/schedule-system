import { ArrowUpRight } from 'lucide-react';

const activities = [
  { title: '21天感恩成长记', line: '把感谢记下来', action: '去打卡', href: 'https://yingyacy.top/gratitude/', image: 'notebook.webp', tone: 'green' },
  { title: '部门人格测试', line: '发现你的朋辈可能', action: '开始探索', href: 'https://yingyacy.top/mbti-classic/', image: 'explore.png', tone: 'coral' },
  { title: '加入朋辈', line: '一起做有温度的事', action: '查看招新', href: 'https://yingyacy.top/join/', image: 'join.png', tone: 'blue' },
];

export default function ActivityEntries() {
  return (
    <section className="activity-band" aria-label="朋辈活动入口">
      <div className="activity-heading"><h2>活动与探索</h2><span>朋辈心理健康服务队</span></div>
      <div className="activity-grid">
        {activities.map((activity) => (
          <a key={activity.href} className={`activity-entry activity-${activity.tone}`} href={activity.href} target="_blank" rel="noopener noreferrer" aria-label={`${activity.title}，在新窗口打开`}>
            <div className="activity-copy"><h3>{activity.title}</h3><p>{activity.line}</p><span className="activity-action">{activity.action}<ArrowUpRight size={15} /></span></div>
            <img src={`/brand/${activity.image}`} alt="" width="100" height="100" />
          </a>
        ))}
      </div>
    </section>
  );
}
