"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface Presence {
  count: number;
  users: string[];
}

type MsgHandler = (msg: Record<string, unknown>) => void;

/**
 * 通用协作 WebSocket 钩子。连接 /ws?docId=&type=&token=。
 * - onMessage 处理业务消息（op / update / awareness / sync）
 * - 自动重连 + 心跳 ping
 * - 暴露 send 供业务发送消息、presence 在线状态
 */
export function useCollab(
  docId: string,
  type: "sheet" | "doc",
  token: string | undefined,
  onMessage: MsgHandler
) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<Presence>({ count: 0, users: [] });

  const send = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    let closed = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (closed) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const params = new URLSearchParams({ docId, type });
      if (token) params.set("token", token);
      const ws = new WebSocket(`${proto}://${location.host}/ws?${params}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        heartbeat = setInterval(() => send({ t: "ping" }), 25000);
        if (type === "doc") send({ t: "sync" });
      };

      ws.onmessage = (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.t === "pong") return;
        if (msg.t === "presence") {
          setPresence({
            count: Number(msg.count) || 0,
            users: (msg.users as string[]) || [],
          });
          return;
        }
        handlerRef.current(msg);
      };

      ws.onclose = () => {
        setConnected(false);
        if (heartbeat) clearInterval(heartbeat);
        if (!closed) retry = setTimeout(connect, 1500);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (retry) clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [docId, type, token, send]);

  return { send, connected, presence };
}
