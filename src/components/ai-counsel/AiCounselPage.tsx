import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useAiCounselStore } from '../../stores/aiCounselStore';
import { aiCounselApi } from '../../services/aiCounselApi';
import type { CounselMessage } from '../../services/aiCounselApi';
import { marked } from 'marked';
import { Menu, X } from 'lucide-react';

const HOTLINE = '全国心理援助热线 400-161-9995';
const CRISIS_KEYWORDS = ['自杀', '自伤', '自残', '想死', '不想活', '结束生命', '伤害自己', '伤害他人',
  '不想活了', '想自杀', '活不下去', '活着没意思', '我要死', '我想死', '杀了我', '死了算了',
  '离开这个世界', '结束自己', '一了百了', '不想存在', '解脱', '去死', '想不开'];

function checkCrisis(text: string): boolean {
  return CRISIS_KEYWORDS.some((kw) => text.includes(kw));
}

function MarkdownContent({ content }: { content: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false }) as string;
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '');
  }, [content]);

  return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />;
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
  const [followups, setFollowups] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const autoSendRef = useRef(false);
  const chunkBuf = useRef('');
  const flushRaf = useRef(0);

  const flushStreamChunks = () => {
    if (flushRaf.current) {
      cancelAnimationFrame(flushRaf.current);
      flushRaf.current = 0;
    }
    if (chunkBuf.current) {
      appendStreamChunk(chunkBuf.current);
      chunkBuf.current = '';
    }
  };

  // Check for pending context from schedule page
  useEffect(() => {
    const ctx = localStorage.getItem('ai_counsel_pending_context');
    if (ctx) {
      localStorage.removeItem('ai_counsel_pending_context');
      autoSendRef.current = true;
      setInputText(ctx);
    }
  }, []);

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

  const profileDebounce = useRef(0);

  const updateProfileInsights = async () => {
    const msgs = useAiCounselStore.getState().messages;
    if (msgs.length < 4) return; // 至少两轮对话
    // 每3次对话才更新一次
    profileDebounce.current += 1;
    if (profileDebounce.current % 3 !== 0) return;

    try {
      const summary = await aiCounselApi.getProfileSummary(
        msgs.slice(-12).map(m => ({ role: m.role, content: m.content }))
      );
      const st = summary as Record<string, unknown>;
      if (st && Object.keys(st).length > 0) {
        const raw = localStorage.getItem('user_profile');
        const existing = raw ? JSON.parse(raw) : {};
        const merged = { ...existing };
        if (Array.isArray(st.topics)) {
          const allTopics = new Set([...(existing.topics || []), ...st.topics as string[]]);
          merged.topics = [...allTopics].slice(-10);
        }
        if (Array.isArray(st.needs)) {
          const allNeeds = new Set([...(existing.needs || []), ...st.needs as string[]]);
          merged.needs = [...allNeeds].slice(-10);
        }
        if (st.mood) merged.mood = String(st.mood);
        if (st.identity) merged.identity = String(st.identity);
        localStorage.setItem('user_profile', JSON.stringify(merged));
      }
    } catch { /* 静默失败 */ }
  };

  const autoTitleIfNew = async (sessionId: number) => {
    try {
      const msgs = useAiCounselStore.getState().messages;
      if (msgs.filter(m => m.role === 'assistant').length > 1) return; // 仅首次
      const result = await aiCounselApi.autoTitle(
        msgs.slice(0, 4).map(m => ({ role: m.role, content: m.content })), sessionId
      );
      if (result.title) {
        // 刷新侧栏标题
        const sessions = useAiCounselStore.getState().sessions.map(s =>
          s.id === sessionId ? { ...s, title: result.title! } : s
        );
        useAiCounselStore.setState({ sessions });
      }
    } catch { /* 静默 */ }
  };

  const fetchFollowups = async () => {
    try {
      const msgs = useAiCounselStore.getState().messages;
      const questions = await aiCounselApi.getFollowups(
        msgs.slice(-4).map(m => ({ role: m.role, content: m.content }))
      );
      console.log('[followups] API returned:', questions);
      if (questions.length > 0) setFollowups(questions);
    } catch (e) {
      console.log('[followups] error:', e);
    }
  };

  const handleSend = async () => {
    if (sendingRef.current) return;
    const text = inputText.trim();
    if (!text || streaming) return;
    sendingRef.current = true;
    setInputText('');
    setStreamError(null);
    setFollowups([]);

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
      const model = localStorage.getItem('ai_text_model') || undefined;
      const response = await aiCounselApi.streamChat(history, sessionId, controller.signal, model);
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
              if (data.crisis === 'yes' || data.crisis === 'uncertain') { setShowCrisis(true); }
              if (data.chunk) {
                fullResponse += data.chunk;
                chunkBuf.current += data.chunk;
                if (!flushRaf.current) {
                  flushRaf.current = requestAnimationFrame(() => flushStreamChunks());
                }
              }
            } catch { /* ignore */ }
          }
        }
      }

      flushStreamChunks();

      // Save AI response
      if (fullResponse) {
        await saveMessage(sessionId, 'assistant', fullResponse);
        // 数据飞轮 + 自动标题 + 追问建议（并行）
        Promise.allSettled([
          updateProfileInsights(),
          autoTitleIfNew(sessionId),
          fetchFollowups(),
        ]);
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

  // Auto-send pending context from schedule page (after handleSend is defined)
  useEffect(() => {
    if (autoSendRef.current && inputText && !streaming && !sendingRef.current) {
      autoSendRef.current = false;
      const timer = setTimeout(async () => {
        // Always start a fresh session for schedule context
        const newId = await createSession();
        setActiveSession(newId);
        useAiCounselStore.setState({ messages: [] });
        handleSend();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [inputText, streaming]);

  // Measure available height so chat fills exactly to bottom tab bar
  const containerRef = useRef<HTMLDivElement>(null);
  const [chatHeight, setChatHeight] = useState<number | null>(null);

  const measureHeight = useCallback(() => {
    if (containerRef.current?.parentElement) {
      const parentRect = containerRef.current.parentElement.getBoundingClientRect();
      const available = window.innerHeight - parentRect.top;
      setChatHeight(Math.max(300, available));
    }
  }, []);

  useEffect(() => {
    measureHeight();
    window.addEventListener('resize', measureHeight);
    window.addEventListener('orientationchange', measureHeight);
    return () => {
      window.removeEventListener('resize', measureHeight);
      window.removeEventListener('orientationchange', measureHeight);
    };
  }, [measureHeight]);

  return (
    <>
      <style>{`
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgb(var(--outline-variant)/.3); border-radius: 2px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgb(var(--outline)/.4); }
        .markdown-content p { margin: 0.25em 0; }
        .markdown-content p:first-child { margin-top: 0; }
        .markdown-content p:last-child { margin-bottom: 0; }
        .markdown-content ul, .markdown-content ol { margin: 0.25em 0; padding-left: 1.25em; }
        .markdown-content li { margin: 0.125em 0; }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 { margin: 0.5em 0 0.25em; font-weight: 600; }
        .markdown-content h1 { font-size: 1.2em; }
        .markdown-content h2 { font-size: 1.1em; }
        .markdown-content h3 { font-size: 1em; }
        .markdown-content h4, .markdown-content h5, .markdown-content h6 { font-size: 0.95em; margin: 0.25em 0; font-weight: 600; }
        .markdown-content code { background: rgb(var(--primary)/.1); padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
        .markdown-content pre { background: rgb(var(--surface-container-low)); padding: 0.6em 0.8em; border-radius: 6px; overflow-x: auto; margin: 0.4em 0; }
        .markdown-content pre code { background: none; padding: 0; }
        .markdown-content blockquote { border-left: 2px solid rgb(var(--primary)/.4); margin: 0.25em 0; padding: 0.1em 0.6em; color: rgb(var(--on-surface-variant)); }
.markdown-content a { color: rgb(var(--primary)); text-decoration: underline; }
        .markdown-content strong { font-weight: 600; }
        .markdown-content hr { border: none; border-top: 1px solid rgb(var(--outline-variant)/.5); margin: 0.5em 0; }
        .markdown-content table { border-collapse: collapse; margin: 0.25em 0; font-size: 0.9em; }
        .markdown-content th, .markdown-content td { border: 1px solid rgb(var(--outline-variant)/.4); padding: 0.25em 0.5em; text-align: left; }
      `}</style>
    <div ref={containerRef} className="flex flex-col" style={chatHeight ? { height: chatHeight } : undefined}>
      <div className="flex flex-1 min-h-0">
      {/* Desktop sidebar */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-64 border-r border-outline-variant/40 shrink-0`}>
        <div className="px-4 py-2.5 border-b border-outline-variant/40 space-y-2">
          <button onClick={handleNewSession} className="btn-primary text-sm px-4 py-2 w-full">新对话</button>
          <select
            defaultValue={localStorage.getItem('ai_text_model') || 'deepseek-v4-pro'}
            onChange={(e) => localStorage.setItem('ai_text_model', e.target.value)}
            className="w-full px-2 py-1 rounded border border-outline-variant bg-surface-container-low text-[10px] text-on-surface-variant focus-ring"
            title="文本生成模型"
          >
            <option value="deepseek-v4-pro">DeepSeek-V4-Pro</option>
            <option value="minimax-m2.7">MiniMax-M2.7</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
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
        <div className="flex items-center gap-2.5 px-3 lg:px-4 py-2.5 lg:py-3 border-b border-outline-variant/40 shrink-0">
          <button onClick={() => setShowSidebar(!showSidebar)} className="lg:hidden p-1.5 -ml-1 hover:bg-surface-container-low rounded-lg transition-colors text-on-surface-variant touch-target">
            {showSidebar ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold text-xs lg:text-sm shrink-0">暖</div>
          <span className="font-semibold text-on-surface text-sm">小暖</span>
          <span className={`ml-auto text-[11px] lg:text-xs ${streaming ? 'text-warning animate-pulse' : 'text-success'}`}>
            {streaming ? '回复中...' : '在线'}
          </span>
        </div>

        {/* Body: messages + input share one background, seamless like Doubao/Kimi */}
        <div className="flex-1 flex flex-col min-h-0 bg-surface-container-low/30">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 lg:px-4 py-3 space-y-2.5">
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
            messages.map((m, i) => (
              <div key={m.id || `pending-${i}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] sm:max-w-[80%] px-3.5 lg:px-4 py-2 rounded-2xl text-sm ${m.role === 'user'
                  ? 'bg-primary-container text-on-surface rounded-br-md'
                  : 'bg-secondary/10 text-on-surface rounded-bl-md'}`}>
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  ) : (
                    <MarkdownContent content={m.content} />
                  )}
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
          {streaming && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start pb-2">
              <div className="bg-secondary/10 rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          )}
          {followups.length > 0 && !streaming && (
            <div className="flex flex-wrap gap-2 px-4 pb-3 pt-1">
              {followups.map((q, i) => (
                <button key={i} onClick={() => { setInputText(q); setFollowups([]); }}
                  className="text-xs px-3 py-2 rounded-full border border-outline-variant/60 text-on-surface-variant hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors touch-target inline-flex items-center">
                  {q}
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input — seamless like Doubao/Kimi: no border, no separate bg */}
        <div className="shrink-0 px-3 lg:px-4 pt-2 pb-3 lg:pb-4 safe-area-inset">
          <div className="flex items-end gap-2">
            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown} placeholder="说点什么吧..."
              className="flex-1 px-4 py-2.5 rounded-2xl border border-outline-variant/40 bg-surface-container-low/80 shadow-sm text-sm resize-none focus-ring min-h-[2.75rem] max-h-32 placeholder:text-on-surface-variant/50"
              rows={1} maxLength={2000} />
            {streaming ? (
              <button onClick={() => controllerRef.current?.abort()}
                className="bg-error text-white px-4 py-2.5 text-sm rounded-2xl shrink-0 hover:bg-error/80 transition-colors touch-target">停止</button>
            ) : (
              <button onClick={handleSend} disabled={!inputText.trim()}
                className="btn-primary px-5 py-2.5 text-sm rounded-2xl shrink-0 touch-target disabled:opacity-40 disabled:shadow-none transition-opacity">发送</button>
            )}
          </div>
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
    </>
  );
}
