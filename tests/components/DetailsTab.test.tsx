// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../../src/components/scoring/services/scoringApi', () => ({
  competitionApi: { getScoreDetails: vi.fn() },
}));

import DetailsTab from '../../src/components/scoring/pages/CompetitionDetail/DetailsTab';
import { competitionApi } from '../../src/components/scoring/services/scoringApi';

const mockData = {
  competition: {} as Record<string, unknown>,
  judges: [
    { id: 1, name: '评委A' },
    { id: 2, name: '评委B' },
  ],
  contestants: [
    { id: 1, number: '01', name: '选手A', group_name: 'A组' },
    { id: 2, number: '02', name: '选手B', group_name: 'B组', work_name: '作品B' },
  ],
  dimensionGroups: {
    1: { name: '技术', max: 30, subs: [
      { id: 10, name: '代码质量', max: 15 },
      { id: 11, name: '架构', max: 15 },
    ]},
    2: { name: '设计', max: 20, subs: [
      { id: 20, name: 'UI', max: 10 },
      { id: 21, name: 'UX', max: 10 },
    ]},
  },
  scoreMap: {
    1: { 1: { 10: 12.5, 11: 14, 20: 8, 21: 9 }, 2: { 10: 10, 11: 13, 20: 9, 21: 8 } },
    2: { 1: { 10: 10, 11: 10, 20: 7, 21: 8 }, 2: { 10: 13, 11: 12, 20: 9, 21: 7 } },
  },
  totalScoreMap: {
    1: { 1: 43.5, 2: 40 },
    2: { 1: 35, 2: 41 },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DetailsTab', () => {
  it('shows loading state initially', () => {
    vi.mocked(competitionApi.getScoreDetails).mockReturnValue(new Promise(() => {}));
    render(<DetailsTab competitionId={1} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('shows error state on API failure', async () => {
    vi.mocked(competitionApi.getScoreDetails).mockRejectedValue(new Error('fail'));
    render(<DetailsTab competitionId={1} />);
    await waitFor(() => { expect(screen.getByText('加载失败')).toBeInTheDocument(); });
  });

  it('shows empty when no dimension groups', async () => {
    vi.mocked(competitionApi.getScoreDetails).mockResolvedValue({
      competition: {} as Record<string, unknown>, judges: [], contestants: [],
      dimensionGroups: {}, scoreMap: {}, totalScoreMap: {},
    });
    render(<DetailsTab competitionId={1} />);
    await waitFor(() => { expect(screen.getByText('暂无评分数据')).toBeInTheDocument(); });
  });

  it('shows empty when no contestants', async () => {
    vi.mocked(competitionApi.getScoreDetails).mockResolvedValue({
      competition: {} as Record<string, unknown>,
      judges: [{ id: 1, name: '评委A' }], contestants: [],
      dimensionGroups: { 1: { name: '技术', max: 30, subs: [] } },
      scoreMap: {}, totalScoreMap: {},
    });
    render(<DetailsTab competitionId={1} />);
    await waitFor(() => { expect(screen.getByText('暂无选手数据')).toBeInTheDocument(); });
  });

  it('renders contestants, judges, and dimension matrix', async () => {
    vi.mocked(competitionApi.getScoreDetails).mockResolvedValue(mockData);
    render(<DetailsTab competitionId={1} />);
    await waitFor(() => { expect(screen.getByText('选手A')).toBeInTheDocument(); });

    expect(screen.getByText('选手B')).toBeInTheDocument();
    expect(screen.getByText('评委A')).toBeInTheDocument();
    expect(screen.getByText('评委B')).toBeInTheDocument();
    expect(screen.getByText('技术')).toBeInTheDocument();
    expect(screen.getByText('设计')).toBeInTheDocument();
    expect(screen.getByText('代码质量')).toBeInTheDocument();
  });

  it('switches contestant when clicking another tab', async () => {
    const user = userEvent.setup();
    vi.mocked(competitionApi.getScoreDetails).mockResolvedValue(mockData);
    render(<DetailsTab competitionId={1} />);
    await waitFor(() => { expect(screen.getByText('选手A')).toBeInTheDocument(); });

    await user.click(screen.getByText('选手B'));

    // Tab styling changes to indicate active contestant
    const activeBtn = screen.getByText('选手B').closest('button');
    expect(activeBtn).toHaveClass('bg-primary');
  });

  it('shows "暂无评委" when no judges', async () => {
    vi.mocked(competitionApi.getScoreDetails).mockResolvedValue({
      competition: {} as Record<string, unknown>,
      judges: [],
      contestants: [{ id: 1, number: '01', name: '选手A', group_name: 'A组' }],
      dimensionGroups: { 1: { name: '技术', max: 30, subs: [{ id: 10, name: '代码', max: 15 }] } },
      scoreMap: {}, totalScoreMap: {},
    });
    render(<DetailsTab competitionId={1} />);
    await waitFor(() => { expect(screen.getByText('暂无评委')).toBeInTheDocument(); });
  });

  it('loads fresh data when competitionId changes', async () => {
    const { rerender } = render(<DetailsTab competitionId={1} />);

    vi.mocked(competitionApi.getScoreDetails).mockResolvedValue(mockData);
    rerender(<DetailsTab competitionId={2} />);

    await waitFor(() => {
      expect(competitionApi.getScoreDetails).toHaveBeenCalledWith(2);
    });
  });
});
