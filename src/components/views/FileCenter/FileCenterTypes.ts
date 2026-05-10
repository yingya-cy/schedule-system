export interface FileCenterActivity {
  id: number;
  name: string;
  description: string | null;
  department: string;
  cover_url: string | null;
  status: 'active' | 'archived';
  created_by: string;
  created_at: string;
}

export interface FileCenterFolder {
  id: number;
  activity_id: number;
  parent_id: number | null;
  name: string;
  sort_order: number;
  created_by: string;
}

export interface FileCenterFileItem {
  id: number;
  original_filename: string;
  stored_filename: string;
  file_size: number;
  mime_type: string | null;
  file_category: string;
  oss_object_key: string | null;
  oss_url: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  item_type: 'file';
}

export interface FileCenterTweetItem {
  id: number;
  title: string;
  content: string | null;
  summary: string | null;
  cover_image: string | null;
  link_url: string | null;
  author: string | null;
  created_by: string;
  created_at: string;
  item_type: 'tweet';
}

export type FileCenterAnyItem = FileCenterFileItem | FileCenterTweetItem;
