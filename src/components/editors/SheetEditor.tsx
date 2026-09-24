"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useCollab } from "../useCollab";

interface SheetData {
  cells: Record<string, string>;
  rows: number;
  cols: number;
}

const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 26;

function colLabel(c: number) {
  let s = "";
  let n = c;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export default function SheetEditor({
  docId,
  canWrite,
  token,
}: {
  docId: string;
  canWrite: boolean;
  token?: string;
}) {
  const [data, setData] = useState<SheetData>({
    cells: {},
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
  });
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressSave = useRef(false);

  // 接收远端单元格更新
  const onMessage = useCallback((msg: Record<string, unknown>) => {
    if (msg.t === "op" && msg.data) {
      const { key, value } = msg.data as { key: string; value: string };
      suppressSave.current = true;
      setData((prev) => ({ ...prev, cells: { ...prev.cells, [key]: value } }));
    }
  }, []);

  const { send, connected, presence } = useCollab(docId, "sheet", token, onMessage);

  const tokenQS = token ? `?token=${encodeURIComponent(token)}` : "";

  // 载入快照
  useEffect(() => {
    fetch(`/api/documents/${docId}/snapshot${tokenQS}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.content) {
          try {
            const parsed = JSON.parse(d.content) as SheetData;
            setData({
              cells: parsed.cells ?? {},
              rows: parsed.rows ?? DEFAULT_ROWS,
              cols: parsed.cols ?? DEFAULT_COLS,
            });
          } catch {
            /* 空快照 */
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [docId, tokenQS]);

  // 防抖保存快照
  const scheduleSave = useCallback(() => {
    if (!canWrite) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/documents/${docId}/snapshot${tokenQS}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: JSON.stringify(dataRef.current) }),
      }).catch(() => {});
    }, 1000);
  }, [canWrite, docId, tokenQS]);

  // 本地或远端数据变动后触发保存（远端变动仅由拥有写权限的所有者/编辑者落库；这里所有可写端都尝试，服务端会做权限校验）
  useEffect(() => {
    if (!loaded) return;
    if (suppressSave.current) {
      suppressSave.current = false;
      return;
    }
    scheduleSave();
  }, [data, loaded, scheduleSave]);

  function commitCell(key: string, value: string) {
    setData((prev) => ({ ...prev, cells: { ...prev.cells, [key]: value } }));
    send({ t: "op", data: { key, value } });
  }

  const headerCols = useMemo(
    () => Array.from({ length: data.cols }, (_, c) => colLabel(c)),
    [data.cols]
  );

  async function exportXlsx() {
    // 确保先落库再导出
    await fetch(`/api/documents/${docId}/snapshot${tokenQS}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: JSON.stringify(dataRef.current) }),
    }).catch(() => {});
    window.open(`/api/export/${docId}${tokenQS}`, "_blank");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-2">
        <div className="flex items-center gap-3 text-sm text-gray-500">
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
          {presence.count > 1 && (
            <span className="text-gray-500">{presence.count} 人在线</span>
          )}
          {!canWrite && (
            <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-600">
              只读
            </span>
          )}
        </div>
        <button
          onClick={exportXlsx}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
        >
          导出 Excel
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-10 w-12 border border-gray-200 bg-gray-50" />
              {headerCols.map((label) => (
                <th
                  key={label}
                  className="sticky top-0 z-10 min-w-[96px] border border-gray-200 bg-gray-50 px-2 py-1 font-medium text-gray-500"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: data.rows }, (_, r) => (
              <tr key={r}>
                <td className="sticky left-0 z-[5] border border-gray-200 bg-gray-50 px-2 py-1 text-center text-gray-400">
                  {r + 1}
                </td>
                {Array.from({ length: data.cols }, (_, c) => {
                  const key = `${r}:${c}`;
                  const isEditing = editing === key;
                  const isSel = selected === key;
                  return (
                    <td
                      key={c}
                      onClick={() => canWrite && setSelected(key)}
                      onDoubleClick={() => canWrite && setEditing(key)}
                      className={`border border-gray-200 px-2 py-1 ${
                        isSel ? "outline outline-2 outline-zinc-800" : ""
                      }`}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          defaultValue={data.cells[key] ?? ""}
                          onBlur={(e) => {
                            commitCell(key, e.target.value);
                            setEditing(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              commitCell(key, e.currentTarget.value);
                              setEditing(null);
                            } else if (e.key === "Escape") {
                              setEditing(null);
                            }
                          }}
                          className="w-full min-w-[80px] outline-none"
                        />
                      ) : (
                        <span className="block min-h-[20px] whitespace-nowrap">
                          {data.cells[key] ?? ""}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
