// =============================================
// 评分系统类型定义
// =============================================

export interface ScoringDimension {
  id: number;
  template_id: number;
  name: string;
  max_score: number;
  sort_order: number;
  is_optional: number;
  subdimensions: ScoringSubdimension[];
}

export interface ScoringSubdimension {
  id: number;
  dimension_id: number;
  name: string;
  max_score: number;
  sort_order: number;
  description: string;
}

export interface ScoringTemplate {
  id: number;
  name: string;
  description: string;
  total_score: number;
  category: string;
  is_active: number;
  dimensions: ScoringDimension[];
  created_at: string;
  updated_at: string;
}

// 编辑器内部状态类型（与API响应类型分开）
export interface EditorDimension {
  id: number | string;
  template_id: number;
  name: string;
  max_score: number;
  sort_order: number;
  is_optional: boolean;
  subdimensions: EditorSubdimension[];
}

export interface EditorSubdimension {
  id: number | string;
  dimension_id: number;
  name: string;
  max_score: number;
  sort_order: number;
  description: string;
}

export interface Competition {
  id: number;
  template_id: number;
  name: string;
  description: string;
  status: 'preparing' | 'scoring' | 'completed' | 'archived';
  judging_mode: 'offline' | 'realtime';
  result_published: number;
  start_time: string | null;
  end_time: string | null;
  template_name?: string;
  template_total_score?: number;
  contestants?: Contestant[];
  judges?: Judge[];
  template?: ScoringTemplate;
  contestant_count?: number;
  judge_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Contestant {
  id: number;
  competition_id: number;
  number: string;
  name: string;
  group_name: string;
  description: string;
  extra_data: Record<string, unknown> | null;
  scored?: boolean;
  score?: Score;
  created_at: string;
}

export interface Judge {
  id: number;
  name: string;
  code?: string;
  competition_id: number;
  is_active: number;
  competition_name?: string;
  competition_status?: string;
  created_at: string;
}

export interface Score {
  id: number;
  competition_id: number;
  contestant_id: number;
  judge_id: number;
  total_score: number;
  is_valid: number;
  submitted_at: string;
}

export interface ScoreDetail {
  score_id: number;
  subdimension_id: number;
  score: number;
}

export interface CompetitionResult {
  id: number;
  competition_id: number;
  contestant_id: number;
  total_score: number;
  rank: number;
  avg_scores: Record<string, number>;
  score_count: number;
  calculated_at: string;
  number?: string;
  contestant_name?: string;
  group_name?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SubmitScorePayload {
  judge_id: number;
  contestant_id: number;
  scores: {
    subdimension_id: number;
    score: number;
  }[];
}
