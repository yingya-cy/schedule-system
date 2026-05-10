import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// =============================================
// Schemas
// =============================================

export const createScheduleSchema = z.object({
  name: z.string().min(1, '课表名不能为空').max(100),
  department: z.string().min(1, '部门不能为空').max(100),
  filename: z.string().max(255).optional(),
  file_data: z.string().optional(),
  file_type: z.string().max(100).optional(),
  term_id: z.number().int().positive().optional(),
});

export const updateScheduleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  department: z.string().min(1).max(100).optional(),
  filename: z.string().max(255).optional(),
  file_type: z.string().max(100).optional(),
  term_id: z.number().int().positive().optional(),
});

export const createCourseSchema = z.object({
  course_name: z.string().min(1, '课程名不能为空').max(200),
  weekday: z.number().int().min(1).max(7),
  sections: z.array(z.number().int().min(1).max(11)).min(1),
  weeks: z.array(z.number().int().min(1).max(20)).min(1),
  teacher: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  remark: z.string().max(500).optional(),
});

export const updateCourseSchema = z.object({
  course_name: z.string().min(1).max(200).optional(),
  weekday: z.number().int().min(1).max(7).optional(),
  sections: z.array(z.number().int().min(1).max(11)).min(1).optional(),
  weeks: z.array(z.number().int().min(1).max(20)).min(1).optional(),
  teacher: z.string().max(100).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
});

export const createActivitySchema = z.object({
  name: z.string().min(1, '名称不能为空').max(200),
  department: z.string().min(1, '部门不能为空').max(100),
  description: z.string().max(2000).optional(),
  cover_url: z.string().max(500).optional(),
});

export const submitScoreSchema = z.object({
  contestant_id: z.number().int().positive(),
  scores: z.array(z.object({
    subdimension_id: z.number().int().positive().optional(),
    dimension_id: z.number().int().positive().optional(),
    score: z.number().min(0),
  })).min(1, '至少需要一个评分项'),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  username: z.string().min(1).max(50),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码长度至少6位'),
  name: z.string().min(1).max(100),
});

// =============================================
// Middleware factory
// =============================================

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      res.status(400).json({ success: false, error: errors.join('; ') });
      return;
    }
    // Merge validated data back so extra fields survive
    Object.assign(req.body, result.data);
    next();
  };
}
