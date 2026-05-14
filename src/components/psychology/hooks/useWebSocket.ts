import { useEffect, useRef, useCallback, useState } from 'react';
import type { ChatMessage } from '../types/psychology';

interface WsCallbacks {
  onMessage: (msg: ChatMessage) => void;
  onError?: (err: string) => void;
}

export function useWebSocket(token: string | null, callbacks: WsCallbacks) {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalRef = useRef(false); // 防止 StrictMode 重连死循环
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!token || intentionalRef.current) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      retriesRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if ('error' in data) {
          callbacksRef.current.onError?.(String(data.error));
          return;
        }
        callbacksRef.current.onMessage(data as ChatMessage);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (intentionalRef.current) return; // 主动关闭时不重连
      const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
      retriesRef.current++;
      timerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [token]);

  const sendMessage = useCallback((conversationId: number, content: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ conversationId, content }));
      return true;
    }
    return false;
  }, []);

  const disconnect = useCallback(() => {
    intentionalRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    intentionalRef.current = false;
    connect();
    return () => {
      intentionalRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { sendMessage, isConnected, disconnect };
}
