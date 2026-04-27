import { useState } from 'react';
import TemplateList from './pages/TemplateList.tsx';
import CompetitionList from './pages/CompetitionList.tsx';
import CompetitionDetail from './pages/CompetitionDetail.tsx';
import JudgeScoring from './pages/JudgeScoring.tsx';
import { Trophy, BookTemplate, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { competitionApi } from './services/scoringApi.ts';
import type { Competition } from './types/scoring.ts';

type View = 'home' | 'templates' | 'competitions' | 'competition-detail' | 'judge';

interface NavState {
  view: View;
  competitionId?: number;
  judgeId?: number;
  judgeName?: string;
}

export default function ScoringDashboard() {
  const [nav, setNav] = useState<NavState>({ view: 'home' });
  const [showJudgeDialog, setShowJudgeDialog] = useState(false);
  const [judgeNameInput, setJudgeNameInput] = useState('');
  const [judgeNameError, setJudgeNameError] = useState('');
  const [competitionList, setCompetitionList] = useState<Competition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number>(0);
  const [judgingLoading, setJudgingLoading] = useState(false);

  function navigate(view: View, competitionId?: number, judgeId?: number, judgeName?: string) {
    setNav({ view, competitionId, judgeId, judgeName });
  }

  async function handleJudgeNameSubmit() {
    const name = judgeNameInput.trim();
    if (!name) return;
    if (!selectedCompetitionId) {
      setJudgeNameError('请先选择一个比赛');
      return;
    }
    setJudgingLoading(true);
    setJudgeNameError('');
    try {
      const judge = await competitionApi.getJudgeByName(selectedCompetitionId, name);
      setShowJudgeDialog(false);
      setJudgeNameInput('');
      setSelectedCompetitionId(0);
      navigate('judge', selectedCompetitionId, judge.id, judge.name);
    } catch (e: unknown) {
      setJudgeNameError((e as Error).message);
    } finally {
      setJudgingLoading(false);
    }
  }

  function handleJudgeNameCancel() {
    setShowJudgeDialog(false);
    setJudgeNameInput('');
    setJudgeNameError('');
    setSelectedCompetitionId(0);
  }

  function openJudgeDialog() {
    competitionApi.list().then((data) => {
      // 只显示评分中的比赛
      const scoring = data.filter((c) => c.status === 'scoring' || c.status === 'preparing');
      setCompetitionList(scoring);
      if (scoring.length > 0) setSelectedCompetitionId(scoring[0].id);
      else setSelectedCompetitionId(0);
    }).catch(() => {});
    setJudgeNameError('');
    setJudgeNameInput('');
    setShowJudgeDialog(true);
  }

  return (
    <div className="min-h-screen bg-background">
      {nav.view === 'home' && (
        <div className="p-6 lg:p-8">
          {/* 页面标题 */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-primary font-headline tracking-tight">比赛评分系统</h1>
            <p className="text-sm text-outline mt-1">多维度评分模板 · 多人离线评分</p>
          </div>

          {/* 功能卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl">
            <NavCard
              icon={<BookTemplate className="size-8 text-primary" />}
              title="评分模板"
              desc="创建/编辑评分维度"
              onClick={() => navigate('templates')}
            />
            <NavCard
              icon={<Trophy className="size-8 text-primary" />}
              title="比赛管理"
              desc="管理比赛、选手、评委"
              onClick={() => navigate('competitions')}
            />
            <NavCard
              icon={<UserCheck className="size-8 text-primary" />}
              title="评委入口"
              desc="输入姓名进入评分"
              onClick={openJudgeDialog}
            />
          </div>
        </div>
      )}

      {nav.view === 'templates' && (
        <TemplateList onBack={() => navigate('home')} />
      )}

      {nav.view === 'competitions' && (
        <CompetitionList
          onSelect={(comp) => navigate('competition-detail', comp.id)}
          onBack={() => navigate('home')}
        />
      )}

      {nav.view === 'competition-detail' && nav.competitionId && (
        <CompetitionDetail
          competitionId={nav.competitionId}
          onBack={() => navigate('competitions')}
        />
      )}

      {nav.view === 'judge' && nav.competitionId && nav.judgeId && (
        <JudgeScoring
          competitionId={nav.competitionId}
          judgeId={nav.judgeId}
          judgeName={nav.judgeName!}
          onBack={() => navigate('home')}
        />
      )}

      {/* 评委入口弹窗 */}
      {showJudgeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-surface rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
          >
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-bold text-on-surface font-headline">评委入口</h2>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">选择比赛</label>
                <select
                  value={selectedCompetitionId}
                  onChange={(e) => setSelectedCompetitionId(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                >
                  <option value={0}>请选择比赛</option>
                  {competitionList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">输入姓名</label>
                <input
                  type="text"
                  value={judgeNameInput}
                  onChange={(e) => setJudgeNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJudgeNameSubmit()}
                  placeholder="请输入您的姓名"
                  className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 text-base"
                  autoFocus
                />
              </div>
              {judgeNameError && (
                <p className="text-sm text-error">{judgeNameError}</p>
              )}
            </div>
            <div className="p-4 border-t border-surface-container-high flex gap-3 justify-end">
              <button
                onClick={handleJudgeNameCancel}
                className="focus-ring px-5 py-2.5 bg-surface-container-low text-on-surface-variant font-medium rounded-xl hover:bg-surface-container transition-all"
              >
                取消
              </button>
              <button
                onClick={handleJudgeNameSubmit}
                disabled={judgingLoading}
                className="focus-ring px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-on-primary font-semibold rounded-xl shadow-lg shadow-primary/25 disabled:opacity-50"
              >
                {judgingLoading ? '验证中...' : '进入'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function NavCard({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex flex-col sm:flex-row items-center sm:items-start gap-3 p-5 sm:p-5 bg-surface rounded-2xl border border-surface-container-high shadow-sm hover:shadow-md hover:border-primary/30 transition-all text-left"
    >
      <div className="p-2.5 bg-primary/10 rounded-xl flex-shrink-0">{icon}</div>
      <div className="text-center sm:text-left">
        <div className="font-semibold text-on-surface font-headline">{title}</div>
        <div className="text-xs text-outline mt-0.5">{desc}</div>
      </div>
    </motion.button>
  );
}