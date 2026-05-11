import { vi } from 'vitest';
import type { UserInfo } from '../../src/types/auth';

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  setUser: ReturnType<typeof vi.fn>;
}

export function createMockAuthStore(overrides: Partial<AuthState> = {}): AuthState {
  return {
    token: 'mock-token',
    user: {
      id: 1,
      username: 'testuser',
      name: '测试用户',
      email: 'test@example.com',
      role: 'admin' as const,
      department: '秘书部',
      avatar_url: null,
      is_active: true,
      last_login: null,
      created_at: '2025-01-01',
    },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    ...overrides,
  };
}

export function mockAuthStore(overrides?: Partial<AuthState>) {
  const mock = createMockAuthStore(overrides);
  vi.mock('@/stores/authStore', () => ({
    useAuthStore: (selector?: (state: AuthState) => unknown) =>
      selector ? selector(mock) : mock,
  }));
  return mock;
}
