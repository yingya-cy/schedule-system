import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
  removeItem: vi.fn((k: string) => { delete store[k]; }),
});

describe('aiCounselApi', () => {
  let aiCounselApi: typeof import('../../../src/services/aiCounselApi').aiCounselApi;

  beforeEach(async () => {
    mockFetch.mockReset();
    store['auth_token'] = 'test-token';
    const mod = await import('../../../src/services/aiCounselApi');
    aiCounselApi = mod.aiCounselApi;
  });

  const mockSuccess = (data: unknown) => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ success: true, data }) });
  };

  describe('createSession', () => {
    it('POSTs new session and returns id', async () => {
      mockSuccess({ id: 99 });
      const result = await aiCounselApi.createSession();
      expect(result.id).toBe(99);
      expect(mockFetch).toHaveBeenCalledWith('/api/ai/counsel/sessions', expect.objectContaining({ method: 'POST' }));
    });
  });

  describe('getSessions', () => {
    it('returns session list', async () => {
      const sessions = [{ id: 1, user_id: 1, title: 'New Chat', created_at: '', updated_at: '' }];
      mockSuccess(sessions);
      expect(await aiCounselApi.getSessions()).toEqual(sessions);
    });
  });

  describe('getMessages', () => {
    it('returns messages for session', async () => {
      const msgs = [{ id: 1, session_id: 5, role: 'user', content: 'hi', created_at: '' }];
      mockSuccess(msgs);
      expect(await aiCounselApi.getMessages(5)).toEqual(msgs);
    });
  });

  describe('saveMessage', () => {
    it('sends message and returns id', async () => {
      mockSuccess({ id: 10 });
      const result = await aiCounselApi.saveMessage(5, 'user', 'hello');
      expect(result.id).toBe(10);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.role).toBe('user');
      expect(body.content).toBe('hello');
    });
  });

  describe('deleteSession', () => {
    it('calls DELETE', async () => {
      mockSuccess(undefined);
      await aiCounselApi.deleteSession(3);
      expect(mockFetch).toHaveBeenCalledWith('/api/ai/counsel/sessions/3', expect.objectContaining({ method: 'DELETE' }));
    });
  });

  describe('streamChat', () => {
    it('sends SSE request with auth and signal', async () => {
      const signal = new AbortController().signal;
      mockFetch.mockResolvedValue({ ok: true, body: null });

      await aiCounselApi.streamChat([{ role: 'user', content: 'hi' }], 5, signal, 'deepseek');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/counsel/stream',
        expect.objectContaining({
          method: 'POST',
          signal,
        })
      );
    });
  });
});
