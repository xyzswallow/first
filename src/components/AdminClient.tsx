"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminUser, AdminDocument, VersionItem } from "@/lib/types";
import { api } from "@/lib/api";

function fmt(iso: string) {
  const d = new Date(iso.replace(" ", "T") + "Z");
  return d.toLocaleString("zh-CN");
}

type Tab = "users" | "documents";

export default function AdminClient({
  currentUserId,
  initialUsers,
  initialDocuments,
}: {
  currentUserId: number;
  initialUsers: AdminUser[];
  initialDocuments: AdminDocument[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState(initialUsers);
  const [docs, setDocs] = useState(initialDocuments);

  // 版本管理弹窗状态
  const [versionDoc, setVersionDoc] = useState<AdminDocument | null>(null);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [versionLoading, setVersionLoading] = useState(false);

  // ---------- 自定义对话框（替代原生 confirm/alert/prompt，避免内置浏览器崩溃） ----------
  const [dialog, setDialog] = useState<{
    type: "alert" | "confirm" | "prompt";
    message: string;
    resolve: (value: string | boolean | null) => void;
  } | null>(null);
  const [dialogInput, setDialogInput] = useState("");

  function showAlert(message: string) {
    return new Promise<void>((resolve) => {
      setDialog({ type: "alert", message, resolve: () => resolve() });
    });
  }
  function showConfirm(message: string) {
    return new Promise<boolean>((resolve) => {
      setDialog({
        type: "confirm",
        message,
        resolve: (v) => resolve(v === true),
      });
    });
  }
  function showPrompt(message: string, defaultValue = "") {
    return new Promise<string | null>((resolve) => {
      setDialogInput(defaultValue);
      setDialog({
        type: "prompt",
        message,
        resolve: (v) => resolve(typeof v === "string" ? v : null),
      });
    });
  }
  function closeDialog(value: string | boolean | null) {
    dialog?.resolve(value);
    setDialog(null);
    setDialogInput("");
  }

  // ---------- 用户操作 ----------
  async function deleteUser(u: AdminUser) {
    if (u.id === currentUserId) return;
    if (
      !(await showConfirm(
        `确定删除用户「${u.username}」？其名下文档将一并删除，不可恢复。`
      ))
    )
      return;
    try {
      await api.adminDeleteUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      setDocs((prev) => prev.filter((d) => d.owner_id !== u.id));
    } catch (e) {
      await showAlert((e as Error).message);
    }
  }

  async function resetPassword(u: AdminUser) {
    const pwd = await showPrompt(`为「${u.username}」设置新密码（至少 6 位）：`);
    if (!pwd) return;
    if (pwd.length < 6) {
      await showAlert("密码至少 6 位");
      return;
    }
    try {
      await api.adminResetPassword(u.id, pwd);
      await showAlert("密码已重置");
    } catch (e) {
      await showAlert((e as Error).message);
    }
  }

  async function toggleAdmin(u: AdminUser) {
    if (u.id === currentUserId) return;
    const next = u.is_admin === 1 ? false : true;
    try {
      await api.adminSetAdmin(u.id, next);
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, is_admin: next ? 1 : 0 } : x))
      );
    } catch (e) {
      await showAlert((e as Error).message);
    }
  }

  // ---------- 文档操作 ----------
  async function deleteDoc(d: AdminDocument) {
    if (!(await showConfirm(`确定删除文档「${d.name || "未命名"}」？不可恢复。`)))
      return;
    try {
      await api.adminDeleteDocument(d.id);
      setDocs((prev) => prev.filter((x) => x.id !== d.id));
    } catch (e) {
      await showAlert((e as Error).message);
    }
  }

  async function transferDoc(d: AdminDocument) {
    const target = users.find((u) => u.id !== d.owner_id);
    const name = await showPrompt(
      `将「${d.name || "未命名"}」转移给哪个用户？输入目标用户名：`,
      target?.username || ""
    );
    if (!name) return;
    const u = users.find((x) => x.username === name.trim());
    if (!u) {
      await showAlert("找不到该用户");
      return;
    }
    try {
      await api.adminTransferDocument(d.id, u.id);
      setDocs((prev) =>
        prev.map((x) =>
          x.id === d.id ? { ...x, owner_id: u.id, owner_name: u.username } : x
        )
      );
    } catch (e) {
      await showAlert((e as Error).message);
    }
  }

  // ---------- 版本管理 ----------
  async function openVersions(d: AdminDocument) {
    setVersionDoc(d);
    setVersionLoading(true);
    try {
      const list = await api.adminListVersions(d.id);
      setVersions(list);
    } catch (e) {
      await showAlert((e as Error).message);
    } finally {
      setVersionLoading(false);
    }
  }

  async function deleteVersion(vid: number) {
    if (!versionDoc) return;
    if (!(await showConfirm("确定删除该版本？不可恢复。"))) return;
    try {
      await api.adminDeleteVersion(versionDoc.id, vid);
      setVersions((prev) => prev.filter((v) => v.id !== vid));
      setDocs((prev) =>
        prev.map((x) =>
          x.id === versionDoc.id
            ? { ...x, version_count: Math.max(0, x.version_count - 1) }
            : x
        )
      );
    } catch (e) {
      await showAlert((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶栏 */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white/90 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white">
            管
          </div>
          <span className="text-lg font-semibold text-gray-900">管理后台</span>
        </div>
        <button
          onClick={() => router.push("/documents")}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
        >
          返回文档
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Tab 切换 */}
        <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
          <button
            onClick={() => setTab("users")}
            className={`rounded-md px-4 py-1.5 transition ${
              tab === "users"
                ? "bg-white font-medium text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            用户管理（{users.length}）
          </button>
          <button
            onClick={() => setTab("documents")}
            className={`rounded-md px-4 py-1.5 transition ${
              tab === "documents"
                ? "bg-white font-medium text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            文档管理（{docs.length}）
          </button>
        </div>
        {tab === "users" ? (
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">用户名</th>
                  <th className="px-4 py-3 font-medium">角色</th>
                  <th className="px-4 py-3 font-medium">文档数</th>
                  <th className="px-4 py-3 font-medium">注册时间</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 text-gray-900">
                      {u.username}
                      {u.id === currentUserId && (
                        <span className="ml-2 text-xs text-gray-400">(我)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.is_admin === 1 ? (
                        <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white">
                          管理员
                        </span>
                      ) : (
                        <span className="text-gray-400">普通用户</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.doc_count}</td>
                    <td className="px-4 py-3 text-gray-400">{fmt(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => resetPassword(u)}
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          重置密码
                        </button>
                        <button
                          onClick={() => toggleAdmin(u)}
                          disabled={u.id === currentUserId}
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                        >
                          {u.is_admin === 1 ? "取消管理员" : "设为管理员"}
                        </button>
                        <button
                          onClick={() => deleteUser(u)}
                          disabled={u.id === currentUserId}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">文档名</th>
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium">所属人</th>
                  <th className="px-4 py-3 font-medium">版本数</th>
                  <th className="px-4 py-3 font-medium">更新时间</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 text-gray-900">
                      {d.name || "未命名"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {d.type === "doc" ? "文档" : "表格"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{d.owner_name}</td>
                    <td className="px-4 py-3 text-gray-500">{d.version_count}</td>
                    <td className="px-4 py-3 text-gray-400">{fmt(d.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openVersions(d)}
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          版本管理
                        </button>
                        <button
                          onClick={() => transferDoc(d)}
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          转移所属
                        </button>
                        <button
                          onClick={() => deleteDoc(d)}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 版本管理弹窗 */}
      {versionDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          onClick={() => setVersionDoc(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                版本管理 · {versionDoc.name || "未命名"}
              </h2>
              <button
                onClick={() => setVersionDoc(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              {versionLoading ? (
                <p className="py-8 text-center text-sm text-gray-400">加载中…</p>
              ) : versions.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  暂无版本记录
                </p>
              ) : (
                <div className="space-y-2">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="text-gray-700">{fmt(v.created_at)}</span>
                        <span className="ml-2 text-xs text-gray-400">
                          {v.source} · {v.created_by || "系统"}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteVersion(v.id)}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 自定义对话框 */}
      {dialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {dialog.message}
            </p>
            {dialog.type === "prompt" && (
              <input
                autoFocus
                value={dialogInput}
                onChange={(e) => setDialogInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") closeDialog(dialogInput);
                }}
                className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            )}
            <div className="mt-5 flex justify-end gap-2">
              {dialog.type !== "alert" && (
                <button
                  onClick={() =>
                    closeDialog(dialog.type === "prompt" ? null : false)
                  }
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                >
                  取消
                </button>
              )}
              <button
                onClick={() =>
                  closeDialog(
                    dialog.type === "prompt"
                      ? dialogInput
                      : dialog.type === "confirm"
                      ? true
                      : null
                  )
                }
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
