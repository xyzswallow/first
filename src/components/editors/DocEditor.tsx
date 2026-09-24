"use client";

import * as Y from "yjs";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";

function toBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default function DocEditor({
  docId,
  canWrite,
  token,
}: {
  docId: string;
  canWrite: boolean;
  token?: string;
}) {
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [presenceCount, setPresenceCount] = useState(0);

  // 建立 WebSocket + Yjs 同步
  useEffect(() => {
    const ydoc = ydocRef.current;
    let closed = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const applyingRemote = { current: false };

    function onLocalUpdate(update: Uint8Array, origin: unknown) {
      // 忽略来自远端应用的 update，避免回环
      if (origin === "remote") return;
      const ws = wsRef.current;
      if (canWrite && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ t: "update", v: toBase64(update) }));
      }
    }
    ydoc.on("update", onLocalUpdate);

    function connect() {
      if (closed) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const params = new URLSearchParams({ docId, type: "doc" });
      if (token) params.set("token", token);
      const ws = new WebSocket(`${proto}://${location.host}/ws?${params}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        heartbeat = setInterval(
          () => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: "ping" })),
          25000
        );
        ws.send(JSON.stringify({ t: "sync" }));
      };

      ws.onmessage = (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.t === "update" && typeof msg.v === "string") {
          applyingRemote.current = true;
          Y.applyUpdate(ydoc, fromBase64(msg.v), "remote");
          applyingRemote.current = false;
        } else if (msg.t === "presence") {
          setPresenceCount(Number(msg.count) || 0);
        }
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
      ydoc.off("update", onLocalUpdate);
      if (heartbeat) clearInterval(heartbeat);
      if (retry) clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [docId, token, canWrite]);

  const editor = useEditor({
    editable: canWrite,
    extensions: [
      StarterKit.configure({ history: false }),
      Placeholder.configure({ placeholder: "开始输入内容…" }),
      Collaboration.configure({ document: ydocRef.current }),
    ],
    immediatelyRender: false,
  });

  if (!editor) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        加载编辑器…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-2">
        {canWrite && <Toolbar editor={editor} />}
        <div className="ml-auto flex items-center gap-3 text-sm text-gray-500">
          <span
            className={`inline-flex items-center gap-1 ${
              connected ? "text-emerald-600" : "text-gray-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? "bg-emerald-500" : "bg-gray-300"
              }`}
            />
            {connected ? "已连接" : "连接中…"}
          </span>
          {presenceCount > 1 && <span>{presenceCount} 人在线</span>}
          {!canWrite && (
            <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-600">
              只读
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="mx-auto my-6 min-h-[70vh] max-w-3xl rounded-lg bg-white p-12 shadow-sm">
          <EditorContent editor={editor} className="prose-editor" />
        </div>
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-sm transition ${
      active ? "bg-zinc-200 text-zinc-900" : "text-gray-600 hover:bg-gray-100"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
      >
        <b>B</b>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
      >
        <i>I</i>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(editor.isActive("strike"))}
      >
        <s>S</s>
      </button>
      <span className="mx-1 h-4 w-px bg-gray-200" />
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btn(editor.isActive("heading", { level: 1 }))}
      >
        H1
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
      >
        H2
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }))}
      >
        H3
      </button>
      <span className="mx-1 h-4 w-px bg-gray-200" />
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
      >
        • 列表
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
      >
        1. 列表
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
      >
        引用
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btn(editor.isActive("codeBlock"))}
      >
        代码
      </button>
    </div>
  );
}
