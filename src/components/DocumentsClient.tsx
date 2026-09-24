"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentListItem, DocType } from "@/lib/types";
import { api } from "@/lib/api";
import AuthModal from "@/components/AuthModal";
import ChangePasswordModal from "@/components/ChangePasswordModal";

function timeAgo(iso: string) {
  const d = new Date(iso.replace(" ", "T") + "Z");
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const day = Math.floor(h / 24);
  if (day < 30) return `${day} 天前`;
  return d.toLocaleDateString("zh-CN");
}

const TYPE_META: Record<DocType, { label: string; icon: string; color: string }> = {
  sheet: { label: "表格", icon: "▦", color: "bg-emerald-50 text-emerald-600" },
  doc: { label: "文档", icon: "✎", color: "bg-zinc-100 text-zinc-700" },
};

export default function DocumentsClient({
  username,
  initialItems,
}: {
  username: string | null;
  initialItems: DocumentListItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [changePwd, setChangePwd] = useState(false);

  async function create(type: DocType) {
    if (!username) {
      setMenuOpen(false);
      setAuthMode("login");
      return;
    }
    setMenuOpen(false);
    setCreating(true);
    try {
      const { id } = await api.createDocument("", type);
      router.push(type === "doc" ? `/doc/${id}` : `/sheet/${id}`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("确定删除该文档？此操作不可恢复。")) return;
    try {
      await api.deleteDocument(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      alert((e as Error).message);
    }
  }

  function open(item: DocumentListItem) {
    router.push(item.type === "doc" ? `/doc/${item.id}` : `/sheet/${item.id}`);
  }

  async function logout() {
    await api.logout();
    setUserMenu(false);
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      {/* 顶栏 */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white/90 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white">
            云
          </div>
          <span className="text-lg font-semibold text-gray-900">云文档</span>
        </div>
        {username ? (
          <div className="relative">
            <button
              onClick={() => setUserMenu((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                {username.slice(0, 1).toUpperCase()}
              </span>
              {username}
            </button>
            {userMenu && (
              <div
                className="absolute right-0 mt-1 w-40 overflow-hidden rounded-lg border border-gray-100 bg-white py-1 shadow-lg"
                onMouseLeave={() => setUserMenu(false)}
              >
                <button
                  onClick={() => {
                    setUserMenu(false);
                    setChangePwd(true);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  修改密码
                </button>
                <button
                  onClick={logout}
                  className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                >
                  退出登录
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAuthMode("login")}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              登录
            </button>
            <button
              onClick={() => setAuthMode("register")}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black"
            >
              注册
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">我的文档</h1>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              disabled={creating}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
            >
              <span className="text-base leading-none">+</span> 新建
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-lg border border-gray-100 bg-white py-1 shadow-lg"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  onClick={() => create("sheet")}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className="text-emerald-600">▦</span> 在线表格
                </button>
                <button
                  onClick={() => create("doc")}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className="text-zinc-700">✎</span> 富文本文档
                </button>
              </div>
            )}
          </div>
        </div>

        {!username ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center">
            <div className="mb-3 text-4xl text-gray-300">👋</div>
            <p className="text-sm text-gray-500">登录后即可创建和管理你的文档</p>
            <button
              onClick={() => setAuthMode("login")}
              className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
            >
              立即登录
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center">
            <div className="mb-3 text-4xl text-gray-300">📄</div>
            <p className="text-sm text-gray-500">还没有文档，点击右上角「新建」开始吧</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => {
              const meta = TYPE_META[item.type];
              return (
                <div
                  key={item.id}
                  onClick={() => open(item)}
                  className="group relative cursor-pointer rounded-xl border border-gray-100 bg-white p-4 transition hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg ${meta.color}`}
                    >
                      {meta.icon}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(item.id);
                      }}
                      className="text-gray-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>
                  <h3 className="mt-3 truncate text-sm font-medium text-gray-900">
                    {item.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    <span>{timeAgo(item.updated_at)}</span>
                    {item.shared && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-600">
                        来自 {item.owner_name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {authMode && (
        <AuthModal
          initialMode={authMode}
          onClose={() => setAuthMode(null)}
          onSuccess={() => {
            setAuthMode(null);
            router.refresh();
          }}
        />
      )}
      {changePwd && (
        <ChangePasswordModal
          onClose={() => setChangePwd(false)}
          onSuccess={() => setChangePwd(false)}
        />
      )}
    </div>
  );
}
