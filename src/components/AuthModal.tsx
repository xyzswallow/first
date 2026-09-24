"use client";

import { useState } from "react";

type Mode = "login" | "register";

export default function AuthModal({
  initialMode = "login",
  onClose,
  onSuccess,
}: {
  initialMode?: Mode;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setPassword("");
    setConfirm("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "register" && password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (mode === "login" ? "登录失败" : "注册失败"));
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            {mode === "login" ? "欢迎回来" : "创建账号"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {mode === "login" ? "登录云文档，开始协作" : "加入云文档，随时随地协作"}
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">用户名</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-800 focus:ring-2 focus:ring-zinc-200"
              placeholder={mode === "login" ? "请输入用户名" : "设置用户名"}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-800 focus:ring-2 focus:ring-zinc-200"
              placeholder={mode === "login" ? "请输入密码" : "至少 6 位"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">确认密码</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-800 focus:ring-2 focus:ring-zinc-200"
                placeholder="再次输入密码"
                autoComplete="new-password"
              />
            </div>
          )}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
          >
            {loading
              ? mode === "login"
                ? "登录中…"
                : "注册中…"
              : mode === "login"
                ? "登录"
                : "注册"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-gray-500">
          {mode === "login" ? "还没有账号？" : "已有账号？"}
          <button
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
            className="ml-1 font-medium text-zinc-900 hover:underline"
          >
            {mode === "login" ? "立即注册" : "去登录"}
          </button>
        </p>
      </div>
    </div>
  );
}
