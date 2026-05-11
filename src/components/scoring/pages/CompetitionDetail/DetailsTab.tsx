import { useState, useEffect } from 'react';
import { competitionApi } from '../../services/scoringApi.ts';

interface Props {
  competitionId: number;
}

interface DetailsData {
  judges: { id: number; name: string }[];
  contestants: { id: number; number: string; name: string; work_name?: string; group_name: string }[];
  dimensionGroups: Record<number, { name: string; max: number; subs: { id: number; name: string; max: number }[] }>;
  scoreMap: Record<number, Record<number, Record<number, number>>>;
  totalScoreMap: Record<number, Record<number, number>>;
}

export default function DetailsTab({ competitionId }: Props) {
  const [data, setData] = useState<DetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeContestantId, setActiveContestantId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setActiveContestantId(null);
    competitionApi.getScoreDetails(competitionId)
      .then((result) => {
        setData(result);
        if (result.contestants.length > 0) {
          setActiveContestantId(result.contestants[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [competitionId]);

  if (loading) return <div className="py-16 text-center text-outline">加载中...</div>;

  if (!data) return (
    <div className="py-16 text-center text-outline bg-surface rounded-2xl border border-surface-container-high">加载失败</div>
  );

  if (!data.dimensionGroups || Object.keys(data.dimensionGroups).length === 0) return (
    <div className="py-16 text-center text-outline bg-surface rounded-2xl border border-surface-container-high">暂无评分数据</div>
  );

  if (!data.contestants || data.contestants.length === 0) return (
    <div className="py-16 text-center text-outline bg-surface rounded-2xl border border-surface-container-high">暂无选手数据</div>
  );

  return (
    <div className="space-y-4">
      {/* 选手横向Tab选择器 */}
      <div className="flex gap-2 flex-wrap">
        {data.contestants.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveContestantId(c.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all focus-ring ${
              activeContestantId === c.id
                ? 'bg-primary text-on-primary shadow-md'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* 矩阵表：行=评委，列=维度/子维度 */}
      <div className="bg-surface rounded-2xl border border-surface-container-high overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant sticky left-0 bg-surface-container-low z-10 w-24">评委</th>
                {Object.entries(data.dimensionGroups).map(([dimId, dim]) => (
                  <th key={dimId} colSpan={dim.subs.length + 1}
                    className="px-3 py-2 text-center text-xs font-medium text-primary border-l border-surface-container-high min-w-[120px]">
                    {dim.name}
                    <span className="block text-xs font-normal text-on-surface-variant/normal mt-0.5">满分{dim.max}</span>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-on-surface-variant border-l border-surface-container-high w-20">总分</th>
              </tr>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-2.5 sticky left-0 bg-surface-container-low z-10"></th>
                {Object.entries(data.dimensionGroups).map(([dimId, dim]) => (
                  <th key={dimId} className="contents">
                    {dim.subs.map((sub) => (
                      <th key={sub.id} className="px-2 py-2 text-center text-xs text-on-surface-variant font-normal border-l border-surface-container-high/50 min-w-[60px]">
                        {sub.name}<span className="block text-xs text-outline font-normal">{sub.max}分</span>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center text-xs text-on-surface-variant font-normal border-l border-surface-container-high/50">小计</th>
                  </th>
                ))}
                <th className="border-l border-surface-container-high"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {data.judges.map((judge) => {
                const contestantScores = activeContestantId != null
                  ? (data.scoreMap[activeContestantId]?.[judge.id] ?? {})
                  : {};
                const totalScore = activeContestantId != null
                  ? (data.totalScoreMap[activeContestantId]?.[judge.id] ?? 0)
                  : 0;
                const hasDetails = Object.keys(contestantScores).length > 0;
                const judgeDimTotals = Object.entries(data.dimensionGroups).map(([dimId, dim]) => {
                  if (dim.subs.length > 0) {
                    return dim.subs.reduce((sum, sub) => sum + (contestantScores[sub.id] ?? 0), 0);
                  }
                  return contestantScores[Number(dimId)] ?? 0;
                });
                const judgeGrandTotal = hasDetails ? judgeDimTotals.reduce((a, b) => a + b, 0) : totalScore;

                return (
                  <tr key={judge.id} className="hover:bg-surface-container-low/50">
                    <td className="px-4 py-3 text-sm font-medium text-on-surface sticky left-0 bg-surface z-10">
                      {judge.name}
                    </td>
                    {Object.entries(data.dimensionGroups).map(([dimId, dim], dimIdx) => (
                      <td key={dimId} className="contents">
                        {dim.subs.length > 0 ? (
                          <>
                            {dim.subs.map((sub) => {
                              const score = contestantScores[sub.id];
                              const hasScore = score !== undefined && score > 0;
                              return (
                                <td key={sub.id}
                                  className={`px-2 py-3 text-center text-sm border-l border-surface-container-high/50 ${hasScore ? 'text-on-surface font-medium' : 'text-outline'}`}>
                                  {hasScore ? score.toFixed(1) : '-'}
                                </td>
                              );
                            })}
                            <td className="px-2 py-3 text-center text-sm font-semibold text-primary border-l border-surface-container-high/50 bg-primary/5">
                              {judgeDimTotals[dimIdx] > 0 ? judgeDimTotals[dimIdx].toFixed(1) : '-'}
                            </td>
                          </>
                        ) : (
                          (() => {
                            const score = contestantScores[Number(dimId)];
                            const hasScore = score !== undefined && score > 0;
                            return (
                              <td className={`px-2 py-3 text-center text-sm border-l border-surface-container-high/50 ${hasScore ? 'text-on-surface font-medium' : 'text-outline'}`}>
                                {hasScore ? score.toFixed(1) : '-'}
                              </td>
                            );
                          })()
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center text-sm font-bold text-primary border-l border-surface-container-high bg-primary/5">
                      {judgeGrandTotal > 0 ? judgeGrandTotal.toFixed(1) : '-'}
                    </td>
                  </tr>
                );
              })}
              {data.judges.length === 0 && (
                <tr><td colSpan={20} className="px-4 py-12 text-center text-outline">暂无评委</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
