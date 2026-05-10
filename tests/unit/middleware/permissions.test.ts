import { describe, it, expect } from 'vitest';
import { canModifyResource } from '../../../src/middleware/permissions.ts';
import type { AuthUser } from '../../../src/middleware/auth.ts';

const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  userId: 1,
  username: 'test',
  role: 'teacher',
  ...overrides,
});

describe('canModifyResource', () => {
  it('admin can always modify', () => {
    expect(canModifyResource(makeUser({ role: 'admin' }), 'other_user', '秘书部')).toBe(true);
  });

  it('teacher cannot modify other user resource', () => {
    expect(canModifyResource(makeUser({ role: 'teacher' }), 'other_user', '秘书部')).toBe(false);
  });

  it('teacher can modify own resource', () => {
    expect(canModifyResource(makeUser({ role: 'teacher', username: 'me' }), 'me', '秘书部')).toBe(true);
  });

  it('creator can modify own resource', () => {
    expect(canModifyResource(makeUser({ role: 'student', username: 'me' }), 'me')).toBe(true);
  });

  it('student cannot modify other resource', () => {
    expect(canModifyResource(makeUser({ role: 'student', username: 'me' }), 'other')).toBe(false);
  });

  it('department_head can modify same department resource', () => {
    expect(canModifyResource(
      makeUser({ role: 'department_head', department: '网编部', username: 'head' }),
      'other',
      '网编部',
    )).toBe(true);
  });

  it('department_head cannot modify different department resource', () => {
    expect(canModifyResource(
      makeUser({ role: 'department_head', department: '网编部', username: 'head' }),
      'other',
      '秘书部',
    )).toBe(false);
  });

  it('department_head can modify own resource even in different dept', () => {
    expect(canModifyResource(
      makeUser({ role: 'department_head', department: '网编部', username: 'head' }),
      'head',
      '秘书部',
    )).toBe(true);
  });
});
