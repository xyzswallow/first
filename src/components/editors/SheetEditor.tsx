"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useCollab } from "../useCollab";
import {
  colLabel,
  keyToA1,
  computeSheet,
  isFormula,
  FUNCTIONS,
} from "@/lib/formula";

interface SheetData {
  cells: Record<string, string>;
  rows: number;
  cols: number;
}

const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 26;

function parseKey(key: string): [number, number] {
  const [r, c] = key.split(":").map(Number);
  return [r, c];
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
  // 当前活动单元格（单击选中）
  const [active, setActive] = useState<string | null>(null);
  // 是否处于编辑态（输入即编辑）
  const [editing, setEditing] = useState(false);
  // 编辑中的文本（受控，用于公式栏与单元格同步）
  const [draft, setDraft] = useState("");
  // 拖拽框选：起点/终点 key
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const dragging = useRef(false);

  const dataRef = useRef(data);
  dataRef.current = data;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressSave = useRef(false);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const activeRef = useRef(active);
  activeRef.current = active;

  const tokenQS = token ? `?token=${encodeURIComponent(token)}` : "";

  // 载入快照
  const loadSnapshot = useCallback(() => {
    fetch(`/api/documents/${docId}/snapshot${tokenQS}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.content) {
          try {
            const parsed = JSON.parse(d.content) as SheetData;
            suppressSave.current = true;
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

  // 接收远端消息
  const onMessage = useCallback(
    (msg: Record<string, unknown>) => {
      if (msg.t === "op" && msg.data) {
        const { key, value } = msg.data as { key: string; value: string };
        suppressSave.current = true;
        setData((prev) => ({ ...prev, cells: { ...prev.cells, [key]: value } }));
      } else if (msg.t === "reload") {
        // 版本恢复：重新拉取快照
        loadSnapshot();
      }
    },
    [loadSnapshot]
  );

  const { send, connected, presence } = useCollab(
    docId,
    "sheet",
    token,
    onMessage
  );

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

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

  useEffect(() => {
    if (!loaded) return;
    if (suppressSave.current) {
      suppressSave.current = false;
      return;
    }
    scheduleSave();
  }, [data, loaded, scheduleSave]);

  // 计算整表显示值
  const computed = useMemo(() => computeSheet(data.cells), [data.cells]);

  const commitCell = useCallback(
    (key: string, value: string) => {
      setData((prev) => ({ ...prev, cells: { ...prev.cells, [key]: value } }));
      send({ t: "op", data: { key, value } });
    },
    [send]
  );

  const headerCols = useMemo(
    () => Array.from({ length: data.cols }, (_, c) => colLabel(c)),
    [data.cols]
  );

  async function exportXlsx() {
    await fetch(`/api/documents/${docId}/snapshot${tokenQS}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: JSON.stringify(dataRef.current) }),
    }).catch(() => {});
    window.open(`/api/export/${docId}${tokenQS}`, "_blank");
  }

  const inputRef = useRef<HTMLInputElement | null>(null);

  // 提交当前编辑
  const commitDraft = useCallback(() => {
    const key = activeRef.current;
    if (!key) return;
    commitCell(key, draftRef.current);
  }, [commitCell]);

  // 开始编辑（进入编辑态并聚焦）
  const startEditing = useCallback((initial: string) => {
    setEditing(true);
    setDraft(initial);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // 移动活动单元格
  const moveActive = useCallback(
    (dr: number, dc: number) => {
      const key = activeRef.current;
      if (!key) return;
      const [r, c] = parseKey(key);
      const nr = Math.min(Math.max(r + dr, 0), dataRef.current.rows - 1);
      const nc = Math.min(Math.max(c + dc, 0), dataRef.current.cols - 1);
      const nk = `${nr}:${nc}`;
      setActive(nk);
      setSelStart(nk);
      setSelEnd(nk);
      setEditing(false);
      setDraft(dataRef.current.cells[nk] ?? "");
    },
    []
  );

  // 向公式中插入引用/区间
  const insertRef = useCallback((startKey: string, endKey: string) => {
    const ref =
      startKey === endKey
        ? keyToA1(startKey)
        : `${keyToA1(startKey)}:${keyToA1(endKey)}`;
    setDraft((prev) => prev + ref);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // 单元格鼠标按下
  const onCellMouseDown = useCallback(
    (e: React.MouseEvent, key: string) => {
      if (!canWrite) {
        setActive(key);
        return;
      }
      // 编辑公式时：点选/框选插入引用，保持输入焦点
      if (editingRef.current && isFormula(draftRef.current)) {
        e.preventDefault();
        dragging.current = true;
        setSelStart(key);
        setSelEnd(key);
        return;
      }
      // 普通：先提交上一处编辑，再选中新单元格
      if (editingRef.current) commitDraft();
      setActive(key);
      setEditing(false);
      setDraft(dataRef.current.cells[key] ?? "");
      dragging.current = true;
      setSelStart(key);
      setSelEnd(key);
    },
    [canWrite, commitDraft]
  );

  const onCellMouseEnter = useCallback((key: string) => {
    if (!dragging.current) return;
    setSelEnd(key);
  }, []);

  // 全局 mouseup 结束拖拽；若在公式编辑态则插入引用
  useEffect(() => {
    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      if (
        editingRef.current &&
        isFormula(draftRef.current) &&
        selStart
      ) {
        insertRef(selStart, selEnd ?? selStart);
      }
    }
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [selStart, selEnd, insertRef]);

  // 网格键盘：未编辑时输入即编辑 / 方向键移动 / 删除清空
  const onGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!canWrite || !activeRef.current) return;
      if (editingRef.current) return; // 编辑态交给 input 处理
      const k = e.key;
      if (k === "Enter" || k === "F2") {
        e.preventDefault();
        startEditing(dataRef.current.cells[activeRef.current] ?? "");
        return;
      }
      if (k === "Backspace" || k === "Delete") {
        e.preventDefault();
        commitCell(activeRef.current, "");
        setDraft("");
        return;
      }
      if (k === "ArrowUp") {
        e.preventDefault();
        moveActive(-1, 0);
        return;
      }
      if (k === "ArrowDown") {
        e.preventDefault();
        moveActive(1, 0);
        return;
      }
      if (k === "ArrowLeft") {
        e.preventDefault();
        moveActive(0, -1);
        return;
      }
      if (k === "ArrowRight" || k === "Tab") {
        e.preventDefault();
        moveActive(0, 1);
        return;
      }
      // 可打印字符：直接进入编辑并以该字符起始
      if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        startEditing(k);
      }
    },
    [canWrite, commitCell, moveActive, startEditing]
  );

  // input 内键盘
  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitDraft();
        setEditing(false);
        moveActive(1, 0);
      } else if (e.key === "Tab") {
        e.preventDefault();
        commitDraft();
        setEditing(false);
        moveActive(0, 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditing(false);
        setDraft(dataRef.current.cells[activeRef.current ?? ""] ?? "");
      }
    },
    [commitDraft, moveActive]
  );

  // 插入函数模板到公式
  const insertFunction = useCallback(
    (name: string) => {
      if (!activeRef.current) return;
      const cur = editingRef.current
        ? draftRef.current
        : dataRef.current.cells[activeRef.current] ?? "";
      const base = isFormula(cur) ? cur : "=";
      setEditing(true);
      setDraft(`${base}${name}(`);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    []
  );

  // 计算选区范围（用于高亮）
  const selRange = useMemo(() => {
    if (!selStart || !selEnd) return null;
    const [r1, c1] = parseKey(selStart);
    const [r2, c2] = parseKey(selEnd);
    return {
      rlo: Math.min(r1, r2),
      rhi: Math.max(r1, r2),
      clo: Math.min(c1, c2),
      chi: Math.max(c1, c2),
      single: selStart === selEnd,
    };
  }, [selStart, selEnd]);

  const inSelRange = useCallback(
    (r: number, c: number) => {
      if (!selRange || selRange.single) return false;
      return (
        r >= selRange.rlo &&
        r <= selRange.rhi &&
        c >= selRange.clo &&
        c <= selRange.chi
      );
    },
    [selRange]
  );

  const activeLabel = active ? keyToA1(active) : "";
  const formulaBarValue = editing
    ? draft
    : active
      ? data.cells[active] ?? ""
      : "";

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

      {/* 公式栏 */}
      <div className="flex items-center gap-2 border-b border-gray-100 bg-white px-3 py-1.5">
        <span className="min-w-[52px] rounded border border-gray-200 bg-gray-50 px-2 py-1 text-center text-xs font-medium text-gray-500">
          {activeLabel || "—"}
        </span>
        <span className="text-gray-400">fx</span>
        <input
          value={formulaBarValue}
          disabled={!canWrite || !active}
          placeholder={active ? "输入内容或以 = 开始输入公式" : "选择单元格"}
          onChange={(e) => {
            if (!editing) setEditing(true);
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
              setEditing(false);
              moveActive(1, 0);
            } else if (e.key === "Escape") {
              setEditing(false);
              setDraft(data.cells[active ?? ""] ?? "");
            }
          }}
          className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-zinc-800 disabled:bg-gray-50"
        />
        {canWrite && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) insertFunction(e.target.value);
            }}
            disabled={!active}
            className="rounded border border-gray-200 px-1 py-1 text-xs text-gray-600 outline-none disabled:opacity-50"
            title="插入函数"
          >
            <option value="">函数</option>
            {FUNCTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
      </div>

      <div
        className="flex-1 overflow-auto bg-white outline-none"
        tabIndex={0}
        onKeyDown={onGridKeyDown}
      >
        <table className="border-collapse select-none text-sm">
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
                  const isActive = active === key;
                  const isEditingCell = isActive && editing;
                  const inRange = inSelRange(r, c);
                  const display = computed[key] ?? "";
                  return (
                    <td
                      key={c}
                      onMouseDown={(e) => onCellMouseDown(e, key)}
                      onMouseEnter={() => onCellMouseEnter(key)}
                      onDoubleClick={() =>
                        canWrite && startEditing(data.cells[key] ?? "")
                      }
                      className={`relative border border-gray-200 px-2 py-1 ${
                        isActive
                          ? "outline outline-2 outline-zinc-800"
                          : inRange
                            ? "bg-zinc-100"
                            : ""
                      }`}
                    >
                      {isEditingCell ? (
                        <input
                          ref={inputRef}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={onInputKeyDown}
                          onBlur={() => {
                            // 公式模式下点选/框选会使 input 失焦，此时不提交；
                            // 仅在非公式模式失焦时提交并退出编辑
                            if (!isFormula(draftRef.current)) {
                              commitDraft();
                              setEditing(false);
                            }
                          }}
                          className="w-full min-w-[80px] outline-none"
                        />
                      ) : (
                        <span className="block min-h-[20px] whitespace-nowrap">
                          {display}
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
