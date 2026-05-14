import { create } from 'zustand';
import type { CounselSession, CounselMessage } from '../services/aiCounselApi';
import { aiCounselApi } from '../services/aiCounselApi';

interface AiCounselState {
  sessions: CounselSession[];
  sessionsLoading: boolean;
  activeSessionId: number | null;
  messages: CounselMessage[];
  messagesLoading: boolean;
  streaming: boolean;
  streamError: string | null;
  fetchSessions: () => Promise<void>;
  createSession: () => Promise<number>;
  setActiveSession: (id: number) => void;
  fetchMessages: (sessionId: number) => Promise<void>;
  saveMessage: (sessionId: number, role: 'user' | 'assistant', content: string) => Promise<void>;
  deleteSession: (id: number) => Promise<void>;
  setStreaming: (v: boolean) => void;
  setStreamError: (e: string | null) => void;
  appendStreamChunk: (chunk: string) => void;
}

export const useAiCounselStore = create<AiCounselState>((set, get) => ({
  sessions: [], sessionsLoading: false,
  activeSessionId: null, messages: [], messagesLoading: false,
  streaming: false, streamError: null,

  fetchSessions: async () => {
    set({ sessionsLoading: true });
    try { set({ sessions: await aiCounselApi.getSessions(), sessionsLoading: false }); }
    catch { set({ sessionsLoading: false }); }
  },
  createSession: async () => {
    const { id } = await aiCounselApi.createSession();
    await get().fetchSessions();
    return id;
  },
  setActiveSession: (id) => set({ activeSessionId: id }),
  fetchMessages: async (sessionId) => {
    set({ messagesLoading: true });
    try { set({ messages: await aiCounselApi.getMessages(sessionId), messagesLoading: false }); }
    catch { set({ messagesLoading: false }); }
  },
  saveMessage: async (sessionId, role, content) => {
    await aiCounselApi.saveMessage(sessionId, role, content);
  },
  deleteSession: async (id) => {
    await aiCounselApi.deleteSession(id);
    if (get().activeSessionId === id) set({ activeSessionId: null, messages: [] });
    await get().fetchSessions();
  },
  setStreaming: (v) => set({ streaming: v }),
  setStreamError: (e) => set({ streamError: e }),
  appendStreamChunk: (chunk) => set((state) => {
    const msgs = [...state.messages];
    const last = msgs[msgs.length - 1];
    if (last && last.role === 'assistant' && last.id === 0) {
      msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
    } else {
      msgs.push({ id: 0, session_id: state.activeSessionId || 0, role: 'assistant', content: chunk, created_at: new Date().toISOString() });
    }
    return { messages: msgs };
  }),
}));
