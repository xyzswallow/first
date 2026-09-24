"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function EditorTopBar({
  docId,
  initialName,
  canWrite,
  isOwner,
  onShare,
  onHistory,
}: {
  docId: string;
  initialName: string;
  canWrite: boolean;
  isOwner: boolean;
  onShare?: () => void;
  onHistory?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);

  async function saveName() {
    setEditing(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) {
      setName(trimmed || initialName);
      return;
    }
    try {
      await api.renameDocument(docId, trimmed);
    } catch {
      setName(initialName);
    }
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-2">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/documents")}
          className="rounded-lg px-2 py-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          title="返回列表"
        >
          ←
        </button>
        {editing && canWrite ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="rounded border border-zinc-300 px-2 py-1 text-sm font-medium outline-none"
          />
        ) : (
          <span
            onClick={() => canWrite && setEditing(true)}
            className={`text-sm font-medium text-gray-900 ${
              canWrite ? "cursor-text hover:bg-gray-50" : ""
            } rounded px-2 py-1`}
          >
            {name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onHistory && (
          <button
            onClick={onHistory}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
          >
            版本历史
          </button>
        )}
        {isOwner && onShare && (
          <button
            onClick={onShare}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black"
          >
            分享
          </button>
        )}
      </div>
    </header>
  );
}
