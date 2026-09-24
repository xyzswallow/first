"use client";

import { useEffect, useState } from "react";

interface ShareUser {
  username: string;
  permission: string;
}

export default function ShareDialog({
  docId,
  onClose,
}: {
  docId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"user" | "link">("user");
  const [shareUsername, setShareUsername] = useState("");
  const [permission, setPermission] = useState<"read" | "edit">("read");
  const [users, setUsers] = useState<ShareUser[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [linkPermission, setLinkPermission] = useState<"read" | "edit">("read");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${docId}/share`)
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {});
    fetch(`/api/documents/${docId}/share-link`)
      .then((r) => r.json())
      .then((d) => {
        if (d.token) {
          setShareUrl(`${location.origin}/share/${d.token}`);
          if (d.permission) setLinkPermission(d.permission);
        }
      })
      .catch(() => {});
  }, [docId]);

  async function addUser() {
    setError("");
    const uname = shareUsername.trim();
    if (!uname) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${docId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uname, permission }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "分享失败");
        return;
      }
      setUsers((prev) => {
        const rest = prev.filter((u) => u.username !== uname);
        return [...rest, { username: uname, permission }];
      });
      setShareUsername("");
    } finally {
      setBusy(false);
    }
  }

  async function genLink() {
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${docId}/share-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission: linkPermission }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setShareUrl(`${location.origin}/share/${data.token}`);
      }
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">分享文档</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
          <button
            onClick={() => setTab("user")}
            className={`flex-1 rounded-md py-1.5 transition ${
              tab === "user"
                ? "bg-white font-medium text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            按用户名
          </button>
          <button
            onClick={() => setTab("link")}
            className={`flex-1 rounded-md py-1.5 transition ${
              tab === "link"
                ? "bg-white font-medium text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            分享链接
          </button>
        </div>

        {tab === "user" ? (
          <div>
            <div className="flex gap-2">
              <input
                value={shareUsername}
                onChange={(e) => setShareUsername(e.target.value)}
                placeholder="输入对方用户名"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-zinc-800"
              />
              <select
                value={permission}
                onChange={(e) =>
                  setPermission(e.target.value as "read" | "edit")
                }
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm outline-none"
              >
                <option value="read">只读</option>
                <option value="edit">可编辑</option>
              </select>
              <button
                onClick={addUser}
                disabled={busy}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
              >
                添加
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 space-y-2">
              {users.length === 0 ? (
                <p className="text-sm text-gray-400">尚未分享给任何人</p>
              ) : (
                users.map((u) => (
                  <div
                    key={u.username}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                  >
                    <span className="text-gray-700">{u.username}</span>
                    <span className="text-gray-400">
                      {u.permission === "edit" ? "可编辑" : "只读"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex gap-2">
              <select
                value={linkPermission}
                onChange={(e) =>
                  setLinkPermission(e.target.value as "read" | "edit")
                }
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm outline-none"
              >
                <option value="read">只读链接</option>
                <option value="edit">可编辑链接</option>
              </select>
              <button
                onClick={genLink}
                disabled={busy}
                className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
              >
                {shareUrl ? "重新生成" : "生成链接"}
              </button>
            </div>
            {shareUrl && (
              <div className="mt-4 flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 outline-none"
                />
                <button
                  onClick={copy}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {copied ? "已复制" : "复制"}
                </button>
              </div>
            )}
            <p className="mt-3 text-xs text-gray-400">
              任何人凭此链接可按对应权限访问文档。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
