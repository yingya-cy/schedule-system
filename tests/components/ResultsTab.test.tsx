// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import ResultsTab from '../../src/components/scoring/pages/CompetitionDetail/ResultsTab';

const mockJudges = [
  { id: 1, name: '评委A', competition_id: 1, is_active: 1, created_at: '2025-01-01' },
  { id: 2, name: '评委B', competition_id: 1, is_active: 1, created_at: '2025-01-01' },
];

const resultsData = [
  { rank: 1, number: 'A01', contestant_name: '张三', group_name: '大学组', final_score: 95.5, total_score: 94.2, score_count: 5 },
  { rank: 2, number: 'A02', contestant_name: '李四', group_name: '大学组', final_score: 88.0, total_score: 87.5, score_count: 5 },
  { rank: 3, number: 'A03', contestant_name: '王五', group_name: '高中组', final_score: 82.3, total_score: 81.8, score_count: 4 },
];

const noop = () => {};

describe('ResultsTab', () => {
  it('shows loading spinner when results not loaded', () => {
    render(
      <ResultsTab
        competitionId={1} competitionName="测试比赛"
        results={[]} resultsLoaded={false} judges={mockJudges}
        setMessageDialog={noop}
      />
    );
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('shows empty message when no results', () => {
    render(
      <ResultsTab
        competitionId={1} competitionName="测试比赛"
        results={[]} resultsLoaded={true} judges={mockJudges}
        setMessageDialog={noop}
      />
    );
    expect(screen.getByText(/暂无计算结果/)).toBeInTheDocument();
  });

  it('renders result table with ranking data', () => {
    render(
      <ResultsTab
        competitionId={1} competitionName="测试比赛"
        results={resultsData} resultsLoaded={true} judges={mockJudges}
        setMessageDialog={noop}
      />
    );
    expect(screen.getByText('共 3 条结果')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();
    expect(screen.getByText('王五')).toBeInTheDocument();
    expect(screen.getByText('95.50')).toBeInTheDocument();
    expect(screen.getByText('88.00')).toBeInTheDocument();
  });

  it('renders export buttons', () => {
    render(
      <ResultsTab
        competitionId={1} competitionName="测试比赛"
        results={resultsData} resultsLoaded={true} judges={mockJudges}
        setMessageDialog={noop}
      />
    );
    expect(screen.getByText('导出统分表')).toBeInTheDocument();
    expect(screen.getByText('导出评分表')).toBeInTheDocument();
  });

  it('displays medal emojis for top 3 ranks', () => {
    render(
      <ResultsTab
        competitionId={1} competitionName="测试比赛"
        results={resultsData} resultsLoaded={true} judges={mockJudges}
        setMessageDialog={noop}
      />
    );
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
  });

  it('renders plain rank number for rank > 3', () => {
    const extra = [...resultsData, { rank: 4, number: 'A04', contestant_name: '赵六', group_name: '高中组', final_score: 75.0, total_score: 74.5, score_count: 3 }];
    render(
      <ResultsTab
        competitionId={1} competitionName="测试比赛"
        results={extra} resultsLoaded={true} judges={mockJudges}
        setMessageDialog={noop}
      />
    );
    // rank 4 is displayed as plain number (not an emoji)
    const rankCells = screen.getAllByText('4');
    expect(rankCells.length).toBeGreaterThanOrEqual(1);
  });
});
