import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = {
  getSessions: vi.fn(),
  createSession: vi.fn(),
  getMessages: vi.fn(),
  saveMessage: vi.fn(),
  deleteSession: vi.fn(),
};

vi.mock('../../../src/services/aiCounselApi', () => ({
  aiCounselApi: mockApi,
}));

describe('useAiCounselStore', () => {
  let useAiCounselStore: typeof import('../../../src/stores/aiCounselStore').useAiCounselStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../../src/stores/aiCounselStore');
    useAiCounselStore = mod.useAiCounselStore;
    useAiCounselStore.setState({
      sessions: [], sessionsLoading: false,
      activeSessionId: null, messages: [], messagesLoading: false,
      streaming: false, streamError: null,
    });
  });

  describe('fetchSessions', () => {
    it('populates sessions on success', async () => {
      const sessions = [{ id: 1, user_id: 1, title: 'Chat', created_at: '', updated_at: '' }];
      mockApi.getSessions.mockResolvedValue(sessions);

      await useAiCounselStore.getState().fetchSessions();

      expect(useAiCounselStore.getState().sessions).toEqual(sessions);
      expect(useAiCounselStore.getState().sessionsLoading).toBe(false);
    });

    it('handles error gracefully', async () => {
      mockApi.getSessions.mockRejectedValue(new Error('fail'));
      await useAiCounselStore.getState().fetchSessions();
      expect(useAiCounselStore.getState().sessionsLoading).toBe(false);
    });
  });

  describe('createSession', () => {
    it('creates session and refreshes list', async () => {
      mockApi.createSession.mockResolvedValue({ id: 42 });
      mockApi.getSessions.mockResolvedValue([]);

      const id = await useAiCounselStore.getState().createSession();

      expect(id).toBe(42);
      expect(mockApi.getSessions).toHaveBeenCalled();
    });
  });

  describe('setActiveSession', () => {
    it('sets active session id', () => {
      useAiCounselStore.getState().setActiveSession(5);
      expect(useAiCounselStore.getState().activeSessionId).toBe(5);
    });
  });

  describe('fetchMessages', () => {
    it('loads messages for session', async () => {
      const msgs = [{ id: 1, session_id: 3, role: 'user', content: 'hi', created_at: '' }];
      mockApi.getMessages.mockResolvedValue(msgs);

      await useAiCounselStore.getState().fetchMessages(3);

      expect(useAiCounselStore.getState().messages).toEqual(msgs);
      expect(useAiCounselStore.getState().messagesLoading).toBe(false);
    });
  });

  describe('saveMessage', () => {
    it('calls API to persist message', async () => {
      await useAiCounselStore.getState().saveMessage(3, 'user', 'hello');
      expect(mockApi.saveMessage).toHaveBeenCalledWith(3, 'user', 'hello');
    });
  });

  describe('deleteSession', () => {
    it('deletes and clears active if same id', async () => {
      useAiCounselStore.setState({ activeSessionId: 3, messages: [{ id: 1, session_id: 3, role: 'user', content: 'x', created_at: '' }] });
      mockApi.deleteSession.mockResolvedValue(undefined);
      mockApi.getSessions.mockResolvedValue([]);

      await useAiCounselStore.getState().deleteSession(3);

      expect(useAiCounselStore.getState().activeSessionId).toBeNull();
      expect(useAiCounselStore.getState().messages).toEqual([]);
    });

    it('keeps active session if deleting different id', async () => {
      useAiCounselStore.setState({ activeSessionId: 5 });
      mockApi.deleteSession.mockResolvedValue(undefined);
      mockApi.getSessions.mockResolvedValue([]);

      await useAiCounselStore.getState().deleteSession(3);

      expect(useAiCounselStore.getState().activeSessionId).toBe(5);
    });
  });

  describe('setStreaming / setStreamError', () => {
    it('toggles streaming', () => {
      useAiCounselStore.getState().setStreaming(true);
      expect(useAiCounselStore.getState().streaming).toBe(true);
    });

    it('sets stream error', () => {
      useAiCounselStore.getState().setStreamError('oops');
      expect(useAiCounselStore.getState().streamError).toBe('oops');
    });
  });

  describe('appendStreamChunk', () => {
    it('creates new assistant message on first chunk', () => {
      useAiCounselStore.setState({
        activeSessionId: 1,
        messages: [{ id: 1, session_id: 1, role: 'user', content: 'hi', created_at: '' }],
      });

      useAiCounselStore.getState().appendStreamChunk('Hello');

      const msgs = useAiCounselStore.getState().messages;
      expect(msgs.length).toBe(2);
      expect(msgs[1].role).toBe('assistant');
      expect(msgs[1].content).toBe('Hello');
    });

    it('appends to existing streaming message', () => {
      useAiCounselStore.setState({
        activeSessionId: 1,
        messages: [
          { id: 1, session_id: 1, role: 'user', content: 'hi', created_at: '' },
          { id: 0, session_id: 1, role: 'assistant', content: 'Hel', created_at: '' },
        ],
      });

      useAiCounselStore.getState().appendStreamChunk('lo');

      expect(useAiCounselStore.getState().messages[1].content).toBe('Hello');
    });
  });
});
