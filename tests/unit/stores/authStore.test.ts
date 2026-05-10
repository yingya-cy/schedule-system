import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
  removeItem: vi.fn((k: string) => { delete store[k]; }),
});

describe('useAuthStore', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    mockFetch.mockReset();
  });

  it('initializes with token from localStorage', async () => {
    store['auth_token'] = 'existing-token';
    const { useAuthStore } = await import('../../../src/stores/authStore.ts');
    const state = useAuthStore.getState();
    expect(state.token).toBe('existing-token');
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitialized).toBe(false);
  });

  it('logout clears token and user', async () => {
    const { useAuthStore } = await import('../../../src/stores/authStore.ts');
    useAuthStore.setState({ token: 't', user: { id: 1, username: 'x', name: 'X', role: 'student' } as any, isAuthenticated: true });
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('login sets token and user on success', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: { token: 'jwt', user: { id: 1, username: 'admin', name: 'Admin', role: 'admin' } } }),
    });
    const { useAuthStore } = await import('../../../src/stores/authStore.ts');
    await useAuthStore.getState().login('admin', 'pass');
    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt');
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.username).toBe('admin');
  });

  it('login throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: '密码错误' }),
    });
    const { useAuthStore } = await import('../../../src/stores/authStore.ts');
    await expect(useAuthStore.getState().login('admin', 'wrong')).rejects.toThrow('密码错误');
  });

  it('register throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: '用户名已存在' }),
    });
    const { useAuthStore } = await import('../../../src/stores/authStore.ts');
    await expect(useAuthStore.getState().register({ username: 'x', email: 'a@b.com', password: '123456', name: 'X' }))
      .rejects.toThrow('用户名已存在');
  });

  it('initialize skips when no token', async () => {
    const { useAuthStore } = await import('../../../src/stores/authStore.ts');
    useAuthStore.setState({ token: null, isInitialized: false });
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().isInitialized).toBe(true);
  });

  it('initialize fetches user with valid token', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: { id: 1, username: 'u', name: 'U', role: 'teacher' } }),
    });
    const { useAuthStore } = await import('../../../src/stores/authStore.ts');
    useAuthStore.setState({ token: 'valid-token', isInitialized: false });
    await useAuthStore.getState().initialize();
    const state = useAuthStore.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.role).toBe('teacher');
  });

  it('initialize clears token on failed fetch', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const { useAuthStore } = await import('../../../src/stores/authStore.ts');
    useAuthStore.setState({ token: 'bad-token', isInitialized: false });
    await useAuthStore.getState().initialize();
    const state = useAuthStore.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.token).toBeNull();
  });
});
