import { create } from 'zustand';
import type {
  Counselor,
  CounselorSlot,
  ChatConversation,
  ChatMessage,
  Appointment,
  AppointmentStatus,
  PsychView,
} from '../components/psychology/types/psychology';
import { counselorApi, chatApi, appointmentApi } from '../services/psychologyApi';

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : '未知错误';
}

interface PsychologyState {
  // === Identity ===
  counselorProfile: Counselor | null;
  counselorProfileLoading: boolean;
  fetchMyCounselorProfile: () => Promise<void>;

  // === Counselors ===
  counselors: Counselor[];
  counselorsLoading: boolean;
  fetchCounselors: (all?: boolean) => Promise<void>;
  createCounselor: (data: { user_id: number; name: string; title?: string; bio?: string; avatar_url?: string }) => Promise<number>;
  updateCounselor: (id: number, data: { name?: string; title?: string; bio?: string; avatar_url?: string }) => Promise<void>;
  toggleCounselor: (id: number) => Promise<void>;
  addSlot: (counselorId: number, data: { day_of_week: number; start_time: string; end_time: string }) => Promise<void>;
  deleteSlot: (counselorId: number, slotId: number) => Promise<void>;

  // === Sub-view ===
  view: PsychView;
  selectedCounselorId: number | null;
  setView: (view: PsychView) => void;
  setSelectedCounselorId: (id: number | null) => void;

  // === Chat ===
  conversations: ChatConversation[];
  conversationsLoading: boolean;
  activeConversationId: number | null;
  fetchConversations: () => Promise<void>;
  createConversation: (counselorId: number) => Promise<number>;
  setActiveConversation: (id: number | null) => void;

  // === Messages ===
  messages: ChatMessage[];
  messagesLoading: boolean;
  fetchMessages: (conversationId: number, since?: string) => Promise<void>;
  sendMessage: (conversationId: number, content: string) => Promise<void>;
  appendMessage: (msg: ChatMessage) => void;

  // === Appointments ===
  myAppointments: Appointment[];
  manageAppointments: Appointment[];
  allAppointments: Appointment[];
  appointmentsLoading: boolean;
  fetchMyAppointments: () => Promise<void>;
  fetchManageAppointments: (status?: AppointmentStatus) => Promise<void>;
  fetchAllAppointments: (status?: AppointmentStatus) => Promise<void>;
  createAppointment: (data: {
    counselor_id: number;
    slot_date: string;
    slot_start: string;
    slot_end: string;
    conversation_id?: number | null;
  }) => Promise<number>;
  confirmAppointment: (id: number) => Promise<void>;
  completeAppointment: (id: number, notes?: string | null) => Promise<void>;
  cancelAppointment: (id: number) => Promise<void>;

  // === Error ===
  error: string | null;
  clearError: () => void;
}

export const usePsychologyStore = create<PsychologyState>((set, get) => ({
  // === Identity ===
  counselorProfile: null,
  counselorProfileLoading: false,

  fetchMyCounselorProfile: async () => {
    set({ counselorProfileLoading: true });
    try {
      const profile = await counselorApi.me();
      set({ counselorProfile: profile, counselorProfileLoading: false });
    } catch (e) {
      set({ counselorProfileLoading: false, error: getErrorMessage(e) });
    }
  },

  // === Counselors ===
  counselors: [],
  counselorsLoading: false,

  fetchCounselors: async (all) => {
    set({ counselorsLoading: true });
    try {
      const data = await counselorApi.list(all);
      set({ counselors: data, counselorsLoading: false });
    } catch (e) {
      set({ counselorsLoading: false, error: getErrorMessage(e) });
    }
  },

  createCounselor: async (data) => {
    const result = await counselorApi.create(data);
    return result.id;
  },

  updateCounselor: async (id, data) => {
    await counselorApi.update(id, data);
  },

  toggleCounselor: async (id) => {
    await counselorApi.toggle(id);
  },

  addSlot: async (counselorId, data) => {
    await counselorApi.addSlot(counselorId, data);
  },

  deleteSlot: async (counselorId, slotId) => {
    await counselorApi.deleteSlot(counselorId, slotId);
  },

  // === Sub-view ===
  view: 'counselors',
  selectedCounselorId: null,

  setView: (view) => set({ view }),
  setSelectedCounselorId: (id) => set({ selectedCounselorId: id }),

  // === Chat ===
  conversations: [],
  conversationsLoading: false,
  activeConversationId: null,

  fetchConversations: async () => {
    set({ conversationsLoading: true });
    try {
      const data = await chatApi.getConversations();
      set({ conversations: data, conversationsLoading: false });
    } catch (e) {
      set({ conversationsLoading: false, error: getErrorMessage(e) });
    }
  },

  createConversation: async (counselorId) => {
    const result = await chatApi.createConversation(counselorId);
    await get().fetchConversations();
    return result.id;
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  // === Messages ===
  messages: [],
  messagesLoading: false,

  fetchMessages: async (conversationId, since) => {
    set({ messagesLoading: true });
    try {
      const data = await chatApi.getMessages(conversationId, since);
      set({ messages: data, messagesLoading: false });
    } catch (e) {
      set({ messagesLoading: false, error: getErrorMessage(e) });
    }
  },

  sendMessage: async (conversationId, content) => {
    await chatApi.sendMessage(conversationId, content);
  },

  appendMessage: (msg) =>
    set((state) => {
      if (state.messages.some((m) => m.id === msg.id)) return state; // 去重
      return { messages: [...state.messages, msg] };
    }),

  // === Appointments ===
  myAppointments: [],
  manageAppointments: [],
  allAppointments: [],
  appointmentsLoading: false,

  fetchMyAppointments: async () => {
    set({ appointmentsLoading: true });
    try {
      const data = await appointmentApi.getMyAppointments();
      set({ myAppointments: data, appointmentsLoading: false });
    } catch (e) {
      set({ appointmentsLoading: false, error: getErrorMessage(e) });
    }
  },

  fetchManageAppointments: async (status) => {
    set({ appointmentsLoading: true });
    try {
      const data = await appointmentApi.getManageAppointments(status);
      set({ manageAppointments: data, appointmentsLoading: false });
    } catch (e) {
      set({ appointmentsLoading: false, error: getErrorMessage(e) });
    }
  },

  fetchAllAppointments: async (status) => {
    set({ appointmentsLoading: true });
    try {
      const data = await appointmentApi.getAllAppointments(status);
      set({ allAppointments: data, appointmentsLoading: false });
    } catch (e) {
      set({ appointmentsLoading: false, error: getErrorMessage(e) });
    }
  },

  createAppointment: async (data) => {
    const result = await appointmentApi.create(data);
    return result.id;
  },

  confirmAppointment: async (id) => {
    await appointmentApi.confirm(id);
    await get().fetchManageAppointments();
  },

  completeAppointment: async (id, notes) => {
    await appointmentApi.complete(id, notes);
    await get().fetchManageAppointments();
  },

  cancelAppointment: async (id) => {
    await appointmentApi.cancel(id);
    // Refresh both views
    await Promise.all([
      get().fetchMyAppointments(),
      get().fetchManageAppointments().catch(() => {}),
      get().fetchAllAppointments().catch(() => {}),
    ]);
  },

  // === Error ===
  error: null,
  clearError: () => set({ error: null }),
}));
