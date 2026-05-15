import { useEffect, useState, useRef } from 'react';
import { useAiCounselStore } from '../../stores/aiCounselStore';
import { aiCounselApi } from '../../services/aiCounselApi';
import type { CounselMessage } from '../../services/aiCounselApi';

const HOTLINE = '全国心理援助热线 400-161-9995';
const CRISIS_KEYWORDS = ['自杀', '自伤', '自残', '想死', '不想活', '结束生命', '伤害自己', '伤害他人'];

function checkCrisis(text: string): boolean {
  return CRISIS_KEYWORDS.some((kw) => text.includes(kw));
}

export default function AiCounselPage() {
  const sessions = useAiCounselStore((s) => s.sessions);
  const sessionsLoading = useAiCounselStore((s) => s.sessionsLoading);
  const activeSessionId = useAiCounselStore((s) => s.activeSessionId);
  const messages = useAiCounselStore((s) => s.messages);
  const messagesLoading = useAiCounselStore((s) => s.messagesLoading);
  const streaming = useAiCounselStore((s) => s.streaming);
  const streamError = useAiCounselStore((s) => s.streamError);
  const fetchSessions = useAiCounselStore((s) => s.fetchSessions);
  const createSession = useAiCounselStore((s) => s.createSession);
  const setActiveSession = useAiCounselStore((s) => s.setActiveSession);
  const fetchMessages = useAiCounselStore((s) => s.fetchMessages);
  const saveMessage = useAiCounselStore((s) => s.saveMessage);
  const deleteSession = useAiCounselStore((s) => s.deleteSession);
  const setStreaming = useAiCounselStore((s) => s.setStreaming);
  const setStreamError = useAiCounselStore((s) => s.setStreamError);
  const appendStreamChunk = useAiCounselStore((s) => s.appendStreamChunk);

  const [inputText, setInputText] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showCrisis, setShowCrisis] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    // Don't fetch if we already have messages for this session (prevents race with handleSend)
    if (activeSessionId && !useAiCounselStore.getState().messages.some((m) => m.session_id === activeSessionId)) {
      fetchMessages(activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewSession = async () => {
    const id = await createSession();
    setActiveSession(id);
    setShowSidebar(false);
  };

  const handleSend = async () => {
    if (sendingRef.current) return;
    const text = inputText.trim();
    if (!text || streaming) return;
    sendingRef.current = true;
    setInputText('');
    setStreamError(null);

    // Crisis keyword check
    if (checkCrisis(text)) setShowCrisis(true);

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createSession();
    }

    // Build history BEFORE setting active session (avoids fetchMessages race)
    const currentMsgs = [...useAiCounselStore.getState().messages];
    const userMsg: CounselMessage = {
      id: Date.now(),
      session_id: sessionId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    const history = [...currentMsgs, userMsg].map((m) => ({ role: m.role, content: m.content }));

    // Now update store & activate session
    // (user message saved to DB by Express /api/ai/counsel/stream — don't double-save)
    useAiCounselStore.setState((s) => ({ messages: [...s.messages, userMsg] }));
    setActiveSession(sessionId);

    // Start streaming
    setStreaming(true);
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await aiCounselApi.streamChat(history, sessionId, controller.signal);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) { setStreamError(data.error); break; }
              if (data.done) break;
              if (data.chunk) {
                fullResponse += data.chunk;
                appendStreamChunk(data.chunk);
              }
            } catch { /* ignore */ }
          }
        }
      }

      // Save AI response (no fetchMessages — would duplicate user msg from DB)
      if (fullResponse) {
        await saveMessage(sessionId, 'assistant', fullResponse);
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        setStreamError(err instanceof Error ? err.message : '连接中断');
      }
    } finally {
      setStreaming(false);
      controllerRef.current = null;
      sendingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
      <div className="flex flex-1 min-h-0">
      {/* Desktop sidebar */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-64 border-r border-outline-variant/40 shrink-0`}>
        <div className="px-4 py-3 border-b border-outline-variant/40">
          <button onClick={handleNewSession} className="btn-primary text-sm px-4 py-2 w-full">新对话</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessionsLoading ? (
            <div className="p-4 space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-xs text-on-surface-variant text-center">还没有对话记录</div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="relative group border-b border-outline-variant/20">
                <button onClick={() => { setActiveSession(s.id); setShowSidebar(false); }}
                  className={`w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors ${s.id === activeSessionId ? 'bg-primary/5' : ''}`}>
                  <span className="text-sm text-on-surface truncate block pr-6">{s.title}</span>
                  <span className="text-xs text-on-surface-variant">{new Date(s.updated_at).toLocaleDateString('zh-CN')}</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-outline hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                  &times;
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/40 shrink-0">
          <button onClick={() => setShowSidebar(!showSidebar)} className="lg:hidden text-sm text-primary">
            {showSidebar ? '关闭' : '历史'}
          </button>
          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold text-sm shrink-0">暖</div>
          <span className="font-semibold text-on-surface text-sm">小暖</span>
          <span className={`ml-auto text-xs ${streaming ? 'text-warning animate-pulse' : 'text-success'}`}>
            {streaming ? '回复中...' : '在线'}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-container-low/30">
          {messagesLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg w-3/4" />)}</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center text-secondary text-2xl">暖</div>
              <div>
                <p className="text-on-surface font-medium">你好，我是小暖</p>
                <p className="text-on-surface-variant text-sm mt-1">有什么想聊的吗？</p>
              </div>
              <p className="text-xs text-outline mt-4">{HOTLINE}</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${m.role === 'user'
                  ? 'bg-primary-container text-on-surface rounded-br-md'
                  : 'bg-secondary/10 text-on-surface rounded-bl-md'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.content}{m.id === 0 && streaming && <span className="animate-pulse">▊</span>}</p>
                </div>
              </div>
            ))
          )}
          {streamError && (
            <div className="text-center text-sm text-error py-2">
              {streamError}
              <button onClick={handleSend} className="ml-2 underline">重试</button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-outline-variant/40 bg-surface shrink-0">
          <p className="text-[10px] text-outline text-center mb-1">{HOTLINE}</p>
          <div className="flex items-end gap-2">
            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown} placeholder="说点什么吧..."
              disabled={streaming}
              className="flex-1 px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-sm resize-none focus-ring h-10 max-h-32"
              rows={1} maxLength={2000} />
            <button onClick={handleSend} disabled={!inputText.trim() || streaming}
              className="btn-primary px-4 py-2 text-sm shrink-0">发送</button>
          </div>
        </div>
      </div>
      </div>

      {/* Crisis modal */}
      {showCrisis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCrisis(false)}>
          <div className="paper-card bg-surface w-full max-w-sm mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-error">请注意</h3>
            <p className="text-sm text-on-surface">我注意到你说的情况让我有些担心。虽然我是 AI，无法提供危机干预，但这里有一些可以帮助你的资源：</p>
            <div className="bg-error/5 rounded-lg p-3 text-sm text-on-surface space-y-1">
              <p className="font-semibold">全国心理援助热线</p>
              <p className="text-xl font-bold text-error">400-161-9995</p>
              <p className="text-xs text-on-surface-variant">24 小时免费</p>
            </div>
            <p className="text-sm text-on-surface">学校心理中心也随时欢迎你。你愿意的话，我可以帮你联系学校的真人咨询师。</p>
            <button onClick={() => setShowCrisis(false)} className="btn-primary py-2 w-full text-sm">我知道了</button>
          </div>
        </div>
      )}
    </div>
  );
}
