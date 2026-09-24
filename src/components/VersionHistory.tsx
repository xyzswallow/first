"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { VersionItem } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  link: "分享链接编辑",
  edit: "登录编辑",
  manual: "手动保存",
  auto: "恢复前自动备份",
};

function formatTime(s: string): string {
  // SQLite datetime('now') 为 UTC，转为本地展示
  const d = new Date(s.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VersionHistory({
  docId,
  canWrite,
  token,
  onClose,
}: {
  docId: string;
  canWrite: boolean;
  token?: string;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listVersions(docId, token)
      .then((v) => {
        setVersions(v);
        setError("");
      })
      .catch((e) => setError(e.message || "加载失败"))
      .finally(() => setLoading(false));
  }, [docId, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveNow() {
    setBusy(true);
    try {
      await api.createVersion(docId, token);
      load();
    } catch (e) {
      setError((e as Error).message || "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function restore(vid: number) {
    if (!confirm("确定恢复到该版本？当前内容会自动备份为一个版本。")) return;
    setBusy(true);
    try {
      await api.restoreVersion(docId, vid, token);
      load();
    } catch (e) {
      setError((e as Error).message || "恢复失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="flex h-full w-80 flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="text-sm font-semibold text-gray-900">版本历史</span>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {canWrite && (
          <div className="border-b border-gray-100 px-4 py-2">
            <button
              onClick={saveNow}
              disabled={busy}
              className="w-full rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              保存当前为版本
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto px-2 py-2">
          {loading ? (
            <p className="px-2 py-4 text-sm text-gray-400">加载中…</p>
          ) : error ? (
            <p className="px-2 py-4 text-sm text-red-500">{error}</p>
          ) : versions.length === 0 ? (
            <p className="px-2 py-4 text-sm text-gray-400">暂无历史版本</p>
          ) : (
            <ul className="space-y-1">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="rounded-lg border border-gray-100 px-3 py-2 transition hover:border-gray-200 hover:bg-gray-50"
                >
                  <div className="text-sm font-medium text-gray-800">
                    {formatTime(v.created_at)}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {SOURCE_LABEL[v.source] ?? v.source}
                      {v.created_by ? ` · ${v.created_by}` : ""}
                    </span>
                    {canWrite && (
                      <button
                        onClick={() => restore(v.id)}
                        disabled={busy}
                        className="rounded border border-gray-200 px-2 py-0.5 text-gray-600 transition hover:bg-white disabled:opacity-50"
                      >
                        恢复
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
