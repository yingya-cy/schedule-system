import React from 'react';
import { motion } from 'motion/react';
import { FileSpreadsheet, Users, Clock, FileImage, TrendingUp, Sparkles } from 'lucide-react';
import { ScheduleData } from '@/types';
import { calculateStats } from './utils';

interface StatsCardsProps {
  schedules: ScheduleData[];
}

interface CardConfig {
  label: string;
  value: number;
  icon: React.ElementType;
  bgColor: string;
  iconColor: string;
  trend: React.ElementType;
  trendColor: string;
}

export default function StatsCards({ schedules }: StatsCardsProps) {
  const stats = calculateStats(schedules);

  const cards: CardConfig[] = [
    {
      label: '总课表数',
      value: stats.total,
      icon: FileSpreadsheet,
      bgColor: 'bg-primary/10',
      iconColor: 'text-primary',
      trend: TrendingUp,
      trendColor: 'text-green-500'
    },
    {
      label: '部门数量',
      value: stats.departmentCount,
      icon: Users,
      bgColor: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      trend: Sparkles,
      trendColor: 'text-blue-400'
    },
    {
      label: '本周新增',
      value: stats.recentCount,
      icon: Clock,
      bgColor: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
      trend: TrendingUp,
      trendColor: 'text-amber-400'
    },
    {
      label: '含源文件',
      value: stats.withFile,
      icon: FileImage,
      bgColor: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
      trend: Sparkles,
      trendColor: 'text-purple-400'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const TrendIcon = card.trend;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
            className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low rounded-2xl p-5 border border-surface-container-high shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${card.bgColor} flex items-center justify-center`}>
                <Icon className={card.iconColor} size={20} />
              </div>
              <TrendIcon className={card.trendColor} size={16} />
            </div>
            <div className="text-3xl font-bold text-on-surface mb-1">{card.value}</div>
            <div className="text-sm text-on-surface-variant">{card.label}</div>
          </motion.div>
        );
      })}
    </div>
  );
}
