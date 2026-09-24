"use client";

import { useRouter } from "next/navigation";
import SheetEditor from "./editors/SheetEditor";
import DocEditor from "./editors/DocEditor";

export default function ShareViewClient({
  docId,
  name,
  type,
  canWrite,
  token,
}: {
  docId: string;
  name: string;
  type: "sheet" | "doc";
  canWrite: boolean;
  token: string;
}) {
  const router = useRouter();
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
            云
          </div>
          <span className="text-sm font-medium text-gray-900">{name}</span>
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            分享{canWrite ? "（可编辑）" : "（只读）"}
          </span>
        </div>
        <button
          onClick={() => router.push("/documents")}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
        >
          我的文档
        </button>
      </header>
      <div className="flex-1 overflow-hidden">
        {type === "doc" ? (
          <DocEditor docId={docId} canWrite={canWrite} token={token} />
        ) : (
          <SheetEditor docId={docId} canWrite={canWrite} token={token} />
        )}
      </div>
    </div>
  );
}
