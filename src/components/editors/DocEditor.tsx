"use client";

import * as Y from "yjs";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { Color } from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";

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
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true }),
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
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("请输入链接地址", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
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
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btn(editor.isActive("underline"))}
      >
        <u>U</u>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(editor.isActive("strike"))}
      >
        <s>S</s>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={btn(editor.isActive("highlight"))}
        title="高亮"
      >
        <span className="bg-yellow-200 px-0.5">H</span>
      </button>
      <label
        className="flex items-center gap-1 rounded px-1 py-1 text-sm text-gray-600 hover:bg-gray-100"
        title="字体颜色"
      >
        <span
          className="h-3 w-3 rounded-full border border-gray-300"
          style={{ background: editor.getAttributes("textStyle").color || "#111827" }}
        />
        <input
          type="color"
          className="h-0 w-0 opacity-0"
          value={(editor.getAttributes("textStyle").color as string) || "#111827"}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
        <span>色</span>
      </label>
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
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={btn(editor.isActive({ textAlign: "left" }))}
        title="左对齐"
      >
        ⬅
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={btn(editor.isActive({ textAlign: "center" }))}
        title="居中"
      >
        ↔
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={btn(editor.isActive({ textAlign: "right" }))}
        title="右对齐"
      >
        ➡
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        className={btn(editor.isActive({ textAlign: "justify" }))}
        title="两端对齐"
      >
        ☰
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
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={btn(editor.isActive("taskList"))}
      >
        ✓ 待办
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
      <button onClick={setLink} className={btn(editor.isActive("link"))}>
        链接
      </button>
      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={btn(false)}
        title="分割线"
      >
        —
      </button>
      <span className="mx-1 h-4 w-px bg-gray-200" />
      <button
        onClick={() => editor.chain().focus().undo().run()}
        className={btn(false)}
        disabled={!editor.can().undo()}
        title="撤销"
      >
        ↶
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        className={btn(false)}
        disabled={!editor.can().redo()}
        title="重做"
      >
        ↷
      </button>
    </div>
  );
}
