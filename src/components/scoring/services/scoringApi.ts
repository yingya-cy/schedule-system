import type {
  ScoringTemplate,
  Competition,
  Contestant,
  Judge,
  CompetitionResult,
  SubmitScorePayload,
  ApiResponse,
} from '../types/scoring.ts';

const BASE_URL = '/api/scoring';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  // Handle non-2xx responses that may carry success:false in body
  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    throw new Error(`请求失败 (${res.status})`);
  }
  if (!json.success) throw new Error(json.error || '请求失败');
  return json.data as T;
}

// =============================================
// 模板 API
// =============================================

export const templateApi = {
  list: () => request<ScoringTemplate[]>('/templates'),

  get: (id: number) => request<ScoringTemplate>(`/templates/${id}`),

  create: (data: {
    name: string;
    description?: string;
    total_score?: number;
    category?: string;
    dimensions?: {
      name: string;
      max_score: number;
      is_optional?: boolean;
      subdimensions?: { name: string; max_score: number; description?: string }[];
    }[];
  }) =>
    request<{ id: number }>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    id: number,
    data: {
      name: string;
      description?: string;
      total_score?: number;
      category?: string;
      dimensions?: {
        name: string;
        max_score: number;
        is_optional?: boolean;
        subdimensions?: { name: string; max_score: number; description?: string }[];
      }[];
    }
  ) =>
    request<void>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<void>(`/templates/${id}`, { method: 'DELETE' }),
};

// =============================================
// 比赛 API
// =============================================

export const competitionApi = {
  list: () => request<Competition[]>('/competitions'),

  get: (id: number) => request<Competition>(`/competitions/${id}`),

  getScoreDetails: (competitionId: number) =>
    request<{
      competition: any;
      judges: { id: number; name: string }[];
      contestants: { id: number; number: string; name: string; group_name: string }[];
      dimensionGroups: Record<number, {
        name: string;
        max: number;
        subs: { id: number; name: string; max: number }[];
      }>;
      scoreMap: Record<number, Record<number, Record<number, number>>>;
    }>(`/competitions/${competitionId}/score-details`),

  getJudgeByName: (competitionId: number, name: string) =>
    request<Judge>('/judge/login', {
      method: 'POST',
      body: JSON.stringify({ name, competition_id: competitionId }),
    }),

  getJudgeContestants: (judgeId: number) =>
    request<Contestant[]>(`/judge/${judgeId}/contestants`),

  create: (data: {
    name: string;
    description?: string;
    template_id: number;
    judging_mode?: 'offline' | 'realtime';
  }) =>
    request<{ id: number }>('/competitions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    id: number,
    data: {
      name?: string;
      description?: string;
      status?: string;
      judging_mode?: string;
      result_published?: number;
      start_time?: string;
      end_time?: string;
    }
  ) =>
    request<void>(`/competitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<void>(`/competitions/${id}`, { method: 'DELETE' }),
};

// =============================================
// 选手 API
// =============================================

export const contestantApi = {
  list: (competitionId: number) =>
    request<Contestant[]>(`/competitions/${competitionId}/contestants`),

  create: (
    competitionId: number,
    data: {
      number?: string;
      name: string;
      group_name?: string;
      description?: string;
    }
  ) =>
    request<{ id: number }>(`/competitions/${competitionId}/contestants`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  import: (competitionId: number, contestants: { number: string; name: string; group_name?: string }[]) =>
    request<{ inserted: number; ids: number[] }>(
      `/competitions/${competitionId}/contestants/import`,
      { method: 'POST', body: JSON.stringify({ contestants }) }
    ),

  delete: (competitionId: number, contestantId: number) =>
    request<void>(
      `/competitions/${competitionId}/contestants/${contestantId}`,
      { method: 'DELETE' }
    ),
};

// =============================================
// 评委 API
// =============================================

export const judgeApi = {
  list: (competitionId: number) =>
    request<Judge[]>(`/competitions/${competitionId}/judges`),

  create: (competitionId: number, data: { name: string }) =>
    request<{ id: number }>(`/competitions/${competitionId}/judges`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  import: (competitionId: number, names: string[]) =>
    request<{ inserted: number; ids: number[] }>(
      `/competitions/${competitionId}/judges/import`,
      { method: 'POST', body: JSON.stringify({ names }) }
    ),

  delete: (competitionId: number, judgeId: number) =>
    request<void>(`/competitions/${competitionId}/judges/${judgeId}`, {
      method: 'DELETE',
    }),

  login: (name: string, competitionId: number) =>
    request<Judge>('/judge/login', {
      method: 'POST',
      body: JSON.stringify({ name, competition_id: competitionId }),
    }),

  getContestants: (judgeId: number) =>
    request<Contestant[]>(`/judge/${judgeId}/contestants`),

  getScoresByContestant: (contestantId: string, judgeId: string) =>
    request<{ subdimension_id: number; score: number }[]>(`/judge/scores/${contestantId}/${judgeId}`),

  submitScore: (payload: SubmitScorePayload) =>
    request<{ total_score: number }>('/judge/scores', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// =============================================
// 结果 API
// =============================================

export const resultApi = {
  calculate: (competitionId: number) =>
    request<{
      calculated: number;
      results: { rank: number; contestant: Contestant; total_score: number }[];
    }>(`/competitions/${competitionId}/calculate`, { method: 'POST' }),

  get: (competitionId: number) =>
    request<CompetitionResult[]>(`/competitions/${competitionId}/results`),

  clearAll: (competitionId: number) =>
    request<void>(`/competitions/${competitionId}/clear-all`, { method: 'DELETE' }),

  history: () =>
    request<Competition[]>(
      '/history'
    ),
};

// =============================================
// Excel 导入导出 API
// =============================================

export const importExportApi = {
  // 解析评分模板 Excel
  parseTemplate: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch('/api/scoring/parse-template', {
      method: 'POST',
      body: formData,
    }).then(r => r.json());
  },

  // 解析选手名单 Excel
  parseContestants: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch('/api/scoring/parse-contestants', {
      method: 'POST',
      body: formData,
    }).then(r => r.json());
  },

  // 导出评分结果（返回 Excel 文件）
  exportResults: (templateFile: File, resultData: {
    competition: { name: string; template: any };
    results: Array<{
      rank: number;
      number: string;
      name: string;
      group_name: string;
      total_score: number;
      dimension_scores: Record<string, number>;
      score_count: number;
    }>;
  }) => {
    const formData = new FormData();
    formData.append('template_file', templateFile);
    formData.append('result_data', JSON.stringify(resultData));
    return fetch('/api/scoring/export-results', {
      method: 'POST',
      body: formData,
    }).then(r => r.blob());
  },
};
