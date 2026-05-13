import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { usePsychologyStore } from '../../../stores/psychologyStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { chatApi } from '../../../services/psychologyApi';
import type { ChatMessage } from '../types/psychology';

export default function ChatPage() {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);

  const conversations = usePsychologyStore((s) => s.conversations);
  const conversationsLoading = usePsychologyStore((s) => s.conversationsLoading);
  const activeConversationId = usePsychologyStore((s) => s.activeConversationId);
  const messages = usePsychologyStore((s) => s.messages);
  const messagesLoading = usePsychologyStore((s) => s.messagesLoading);
  const fetchConversations = usePsychologyStore((s) => s.fetchConversations);
  const setActiveConversation = usePsychologyStore((s) => s.setActiveConversation);
  const fetchMessages = usePsychologyStore((s) => s.fetchMessages);
  const sendMessage = usePsychologyStore((s) => s.sendMessage);
  const appendMessage = usePsychologyStore((s) => s.appendMessage);
  const setView = usePsychologyStore((s) => s.setView);

  const [inputText, setInputText] = useState('');
  const [showMobileList, setShowMobileList] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [wsError, setWsError] = useState('');

  const { sendMessage: wsSend, isConnected } = useWebSocket(token, {
    onMessage: (msg) => {
      if (msg.conversation_id === activeConversationId) {
        appendMessage(msg);
      }
      // Refresh conversation list to update unread counts
      fetchConversations();
    },
    onError: setWsError,
  });

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    }
  }, [activeConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConversation = (id: number) => {
    setActiveConversation(id);
    setShowMobileList(false);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !activeConversationId) return;
    setInputText('');

    try {
      // Try WS first, fallback to REST
      const sent = wsSend(activeConversationId, text);
      if (!sent) {
        await sendMessage(activeConversationId, text);
        await fetchMessages(activeConversationId);
      }
    } catch {
      // message will be retried
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  // Mobile: show conversation list
  if (showMobileList || !activeConversationId) {
    return (
      <div className="flex flex-col h-full lg:hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/40">
          <h2 className="font-bold text-on-surface font-headline">我的聊天</h2>
        </div>
        {conversationsLoading ? (
          <div className="p-4 space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-lg" />)}</div>
        ) : conversations.length === 0 ? (
          <div className="empty-state flex-1">
            <p className="empty-state-title">暂无会话</p>
            <p className="empty-state-description">去咨询师列表发起聊天</p>
            <button onClick={() => setView('counselors')} className="btn-primary text-sm mt-3 px-4 py-2">浏览咨询师</button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectConversation(c.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left border-b border-outline-variant/20"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                  {c.counselor_name?.[0] || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-on-surface truncate">{c.counselor_name}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant truncate">点击查看消息</p>
                </div>
                {Number(c.unread_count) > 0 && (
                  <span className="badge badge-error text-xs shrink-0">{c.unread_count}</span>
                )}
              </button>
            ))}
          </div>
        )}
        {/* Desktop: full layout rendered via the outer div's lg:flex sibling */}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Conversation list (desktop) */}
      <div className="hidden lg:flex flex-col w-72 border-r border-outline-variant/40 shrink-0">
        <div className="px-4 py-3 border-b border-outline-variant/40">
          <h2 className="font-bold text-on-surface font-headline text-sm">会话</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveConversation(c.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left border-b border-outline-variant/20 ${
                c.id === activeConversationId ? 'bg-primary/5' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                {c.counselor_name?.[0] || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-on-surface truncate">{c.counselor_name}</span>
                </div>
                <p className="text-xs text-on-surface-variant truncate">
                  {Number(c.unread_count) > 0 ? `${c.unread_count} 条未读` : '暂无新消息'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/40">
          <button
            onClick={() => { setShowMobileList(true); setActiveConversation(null); }}
            className="lg:hidden text-sm text-primary"
          >
            &larr; 返回
          </button>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {activeConv?.counselor_name?.[0] || '?'}
          </div>
          <span className="font-semibold text-on-surface text-sm">{activeConv?.counselor_name || '咨询师'}</span>
          <span className={`ml-auto text-xs ${isConnected ? 'text-success' : 'text-warning'}`}>
            {isConnected ? '在线' : wsError ? '连接断开' : '连接中...'}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-container-low/30">
          {messagesLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg w-3/4" />)}</div>
          ) : messages.length === 0 ? (
            <div className="empty-state h-full">
              <p className="empty-state-title">暂无消息</p>
              <p className="empty-state-description">发送第一条消息开始聊天</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === userId;
              return (
                <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                      isMine
                        ? 'bg-primary-container text-on-surface rounded-br-md'
                        : 'bg-surface-container-high text-on-surface rounded-bl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className="text-xs text-outline mt-1 text-right">
                      {new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-outline-variant/40 bg-surface">
          <div className="flex items-end gap-2">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              className="flex-1 px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-sm resize-none focus-ring h-10 max-h-32"
              rows={1}
            />
            <button onClick={handleSend} disabled={!inputText.trim()} className="btn-primary px-4 py-2 text-sm shrink-0">
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
