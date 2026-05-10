import { describe, it, expect } from 'vitest';
import {
  createScheduleSchema,
  createCourseSchema,
  createActivitySchema,
  submitScoreSchema,
  loginSchema,
  registerSchema,
} from '../../../src/utils/validation.ts';

describe('createScheduleSchema', () => {
  it('accepts valid schedule', () => {
    const r = createScheduleSchema.safeParse({ name: '课表1', department: '网编部' });
    expect(r.success).toBe(true);
  });
  it('rejects empty name', () => {
    const r = createScheduleSchema.safeParse({ name: '', department: '网编部' });
    expect(r.success).toBe(false);
  });
  it('rejects missing department', () => {
    const r = createScheduleSchema.safeParse({ name: '课表1' });
    expect(r.success).toBe(false);
  });
  it('rejects name over 100 chars', () => {
    const r = createScheduleSchema.safeParse({ name: 'x'.repeat(101), department: '网编部' });
    expect(r.success).toBe(false);
  });
});

describe('createCourseSchema', () => {
  it('accepts valid course', () => {
    const r = createCourseSchema.safeParse({
      course_name: '数学', weekday: 1, sections: [1, 2], weeks: [1, 2, 3]
    });
    expect(r.success).toBe(true);
  });
  it('rejects invalid weekday', () => {
    const r = createCourseSchema.safeParse({
      course_name: '数学', weekday: 8, sections: [1], weeks: [1]
    });
    expect(r.success).toBe(false);
  });
  it('rejects empty sections', () => {
    const r = createCourseSchema.safeParse({
      course_name: '数学', weekday: 1, sections: [], weeks: [1]
    });
    expect(r.success).toBe(false);
  });
});

describe('createActivitySchema', () => {
  it('accepts valid activity', () => {
    const r = createActivitySchema.safeParse({ name: '活动', department: '网编部' });
    expect(r.success).toBe(true);
  });
  it('rejects empty name', () => {
    const r = createActivitySchema.safeParse({ name: '', department: '网编部' });
    expect(r.success).toBe(false);
  });
});

describe('submitScoreSchema', () => {
  it('accepts valid score submission', () => {
    const r = submitScoreSchema.safeParse({
      contestant_id: 1,
      scores: [{ subdimension_id: 1, score: 85 }]
    });
    expect(r.success).toBe(true);
  });
  it('rejects empty scores array', () => {
    const r = submitScoreSchema.safeParse({ contestant_id: 1, scores: [] });
    expect(r.success).toBe(false);
  });
  it('rejects negative score', () => {
    const r = submitScoreSchema.safeParse({
      contestant_id: 1,
      scores: [{ subdimension_id: 1, score: -1 }]
    });
    expect(r.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid login', () => {
    const r = loginSchema.safeParse({ username: 'admin', password: 'pass123' });
    expect(r.success).toBe(true);
  });
  it('rejects empty username', () => {
    const r = loginSchema.safeParse({ username: '', password: 'pass123' });
    expect(r.success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts valid registration', () => {
    const r = registerSchema.safeParse({
      username: 'newuser', email: 'a@b.com', password: 'pass123', name: '新人'
    });
    expect(r.success).toBe(true);
  });
  it('rejects short password', () => {
    const r = registerSchema.safeParse({
      username: 'newuser', email: 'a@b.com', password: '12345', name: '新人'
    });
    expect(r.success).toBe(false);
  });
  it('rejects invalid email', () => {
    const r = registerSchema.safeParse({
      username: 'newuser', email: 'notanemail', password: 'pass123', name: '新人'
    });
    expect(r.success).toBe(false);
  });
});
