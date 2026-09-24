import type { WebSocket } from "ws";
import * as Y from "yjs";
import { snapshotsRepo, docsRepo, logsRepo } from "../db";

/**
 * 协作中枢：
 * - 表格（sheet）：客户端发送 JSON 操作，服务端广播给同房间其它成员；
 *   客户端另外通过 HTTP PUT 快照持久化（见 snapshot API）。
 * - 富文本（doc）：走 Yjs 二进制协议（sync + awareness），服务端中继并定时持久化 Y.Doc。
 */

interface Client {
  ws: WebSocket;
  canWrite: boolean;
  userId: number | null;
  username: string;
}

interface Room {
  docId: string;
  type: "sheet" | "doc";
  clients: Set<Client>;
  ydoc?: Y.Doc;
  saveTimer?: NodeJS.Timeout;
}

const rooms = new Map<string, Room>();

// WebSocket 客户端由自定义服务器（server.ts）管理，而版本恢复的 reload 广播
// 由 Next API 路由触发。两处可能被打包成不同的模块实例，故把 rooms 挂到
// globalThis 上共享，确保 broadcastReload 能找到活跃房间。
const globalRooms = globalThis as unknown as {
  __sheetRooms?: Map<string, Room>;
};
if (!globalRooms.__sheetRooms) {
  globalRooms.__sheetRooms = rooms;
}
const sharedRooms = globalRooms.__sheetRooms;

// ---- Yjs 消息类型（自定义精简协议）----
// { t: 'sync-step1', v: base64 }  客户端发来自身 state vector -> 服务端回 diff
// { t: 'sync-step2', v: base64 }  update 应用
// { t: 'update', v: base64 }      增量 update 广播
// { t: 'awareness', v: base64 }   awareness 广播（服务端仅转发）

function getRoom(docId: string, type: "sheet" | "doc"): Room {
  let room = sharedRooms.get(docId);
  if (!room) {
    room = { docId, type, clients: new Set() };
    if (type === "doc") {
      room.ydoc = new Y.Doc();
      const saved = snapshotsRepo.get(docId);
      if (saved) {
        try {
          const buf = Buffer.from(saved, "base64");
          Y.applyUpdate(room.ydoc, new Uint8Array(buf));
        } catch {
          // 快照不是 Yjs 格式（例如空文档），忽略
        }
      }
    }
    sharedRooms.set(docId, room);
  }
  return room;
}

function scheduleDocSave(room: Room) {
  if (room.type !== "doc" || !room.ydoc) return;
  if (room.saveTimer) clearTimeout(room.saveTimer);
  room.saveTimer = setTimeout(() => {
    if (!room.ydoc) return;
    const update = Y.encodeStateAsUpdate(room.ydoc);
    const b64 = Buffer.from(update).toString("base64");
    snapshotsRepo.save(room.docId, b64);
  }, 1500);
}

export function addClient(
  ws: WebSocket,
  docId: string,
  type: "sheet" | "doc",
  opts: { canWrite: boolean; userId: number | null; username: string }
) {
  const room = getRoom(docId, type);
  const client: Client = {
    ws,
    canWrite: opts.canWrite,
    userId: opts.userId,
    username: opts.username,
  };
  room.clients.add(client);

  // 广播在线人数
  broadcastPresence(room);

  // 富文本：连接后立即把当前文档状态发给新客户端（sync step）
  if (type === "doc" && room.ydoc) {
    const update = Y.encodeStateAsUpdate(room.ydoc);
    send(ws, {
      t: "update",
      v: Buffer.from(update).toString("base64"),
    });
  }

  ws.on("message", (raw: Buffer, isBinary: boolean) => {
    if (isBinary) return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    handleMessage(room, client, msg);
  });

  ws.on("close", () => {
    room.clients.delete(client);
    broadcastPresence(room);
    if (room.clients.size === 0) {
      // 最后一人离开时确保落库
      if (room.type === "doc" && room.ydoc) {
        const update = Y.encodeStateAsUpdate(room.ydoc);
        snapshotsRepo.save(
          room.docId,
          Buffer.from(update).toString("base64")
        );
      }
      if (room.saveTimer) clearTimeout(room.saveTimer);
      sharedRooms.delete(room.docId);
    }
  });

  ws.on("error", () => {
    room.clients.delete(client);
  });
}

function handleMessage(
  room: Room,
  client: Client,
  msg: Record<string, unknown>
) {
  const t = msg.t as string;

  if (t === "ping") {
    send(client.ws, { t: "pong" });
    return;
  }

  // 表格：操作广播（仅可写客户端）
  if (room.type === "sheet") {
    if (t === "op" && client.canWrite) {
      broadcast(room, client, { t: "op", data: msg.data, user: client.username });
      touchLog(room, client);
    }
    return;
  }

  // 富文本：Yjs 协议
  if (room.type === "doc" && room.ydoc) {
    if (t === "update" && client.canWrite && typeof msg.v === "string") {
      try {
        const update = new Uint8Array(Buffer.from(msg.v, "base64"));
        Y.applyUpdate(room.ydoc, update, client);
        // 转发给其它客户端
        broadcast(room, client, { t: "update", v: msg.v });
        scheduleDocSave(room);
        touchLog(room, client);
      } catch {
        /* ignore malformed */
      }
    } else if (t === "sync") {
      // 客户端请求全量同步
      const update = Y.encodeStateAsUpdate(room.ydoc);
      send(client.ws, {
        t: "update",
        v: Buffer.from(update).toString("base64"),
      });
    } else if (t === "awareness" && typeof msg.v === "string") {
      broadcast(room, client, { t: "awareness", v: msg.v });
    }
  }
}

let logThrottle = new Map<string, number>();
function touchLog(room: Room, client: Client) {
  const key = `${room.docId}:${client.userId ?? "anon"}`;
  const now = Date.now();
  const last = logThrottle.get(key) ?? 0;
  if (now - last > 30000) {
    logThrottle.set(key, now);
    logsRepo.add(room.docId, client.userId, client.username, "edit");
  }
  if (room.type === "sheet") {
    docsRepo.touch(room.docId);
  }
}

function broadcastPresence(room: Room) {
  const users = Array.from(room.clients).map((c) => c.username);
  const payload = { t: "presence", count: room.clients.size, users };
  for (const c of room.clients) send(c.ws, payload);
}

function broadcast(room: Room, from: Client, payload: unknown) {
  for (const c of room.clients) {
    if (c !== from) send(c.ws, payload);
  }
}

/**
 * 版本恢复后调用：通知同房间所有客户端重新拉取快照。
 * 由 HTTP API（versions 恢复接口）跨模块调用。
 */
export function broadcastReload(docId: string) {
  const room = sharedRooms.get(docId);
  if (!room) return;
  const payload = { t: "reload" };
  for (const c of room.clients) send(c.ws, payload);
}

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}
