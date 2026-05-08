import type { AuthUser } from './auth.ts';

export function canModifyResource(
  user: AuthUser,
  createdBy: string,
  resourceDepartment?: string,
): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'teacher') return true;
  if (user.username === createdBy) return true;
  if (user.role === 'department_head' && resourceDepartment && user.department === resourceDepartment) return true;
  return false;
}
