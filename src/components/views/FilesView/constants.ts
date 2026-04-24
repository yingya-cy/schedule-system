import { EditableCourse } from '@/types';

// View modes for FilesView
export type ViewMode = 'list' | 'upload' | 'batch_result' | 'edit' | 'manual_entry';

// Upload state interface
export interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  currentFile?: string;
  processedCount: number;
  totalCount: number;
}

// Batch result interface
export interface BatchResult {
  id: string;
  filename: string;
  courses: EditableCourse[];
  success: boolean;
  error?: string;
  saved?: boolean;
  name?: string;
  department?: string;
  file_data?: string;
  file_type?: string;
  schedule_id?: number;
}

// Animation variants for stagger effects
export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

// Department stats for sidebar
export interface DepartmentStat {
  name: string;
  count: number;
}

// Initial upload state
export const initialUploadState: UploadState = {
  isUploading: false,
  progress: 0,
  error: null,
  success: false,
  processedCount: 0,
  totalCount: 0
};
