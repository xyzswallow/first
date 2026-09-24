import "./server-preload";
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer, type WebSocket } from "ws";
import { unsealData } from "iron-session";
import { sessionOptions, parseCookies, type SessionData } from "./src/server/session";
import { docsRepo, sharesRepo } from "./src/server/db";
import { addClient } from "./src/server/ws/roomHub";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

interface AuthContext {
  canWrite: boolean;
  userId: number | null;
  username: string;
  ok: boolean;
}

/** 解密会话 cookie，返回登录用户（若有） */
async function resolveSession(
  cookieHeader: string | undefined
): Promise<SessionData | null> {
  const cookies = parseCookies(cookieHeader);
  const sealed = cookies[sessionOptions.cookieName];
  if (!sealed) return null;
  try {
    const data = await unsealData<SessionData>(sealed, {
      password: sessionOptions.password,
    });
    if (data && data.userId) return data;
  } catch {
    /* 无效或过期 cookie，按匿名处理 */
  }
  return null;
}

/**
 * 判定连接对某文档的访问权限：
 * - 文档所有者：可写
 * - 被按用户名分享（edit）：可写；（read）：只读
 * - 携带有效 share token：按 token 权限（read/edit）
 * - 其余：拒绝
 */
async function authorize(
  docId: string,
  token: string | undefined,
  session: SessionData | null
): Promise<AuthContext> {
  const doc = docsRepo.findById(docId);
  if (!doc) return { ok: false, canWrite: false, userId: null, username: "" };

  const userId = session?.userId ?? null;
  const username = session?.username ?? "匿名";

  // 登录用户：所有者或被分享
  if (userId) {
    if (doc.owner_id === userId) {
      return { ok: true, canWrite: true, userId, username };
    }
    const perm = sharesRepo.getPermission(docId, userId);
    if (perm) {
      return { ok: true, canWrite: perm === "edit", userId, username };
    }
  }

  // 分享链接 token
  if (token && doc.share_token && token === doc.share_token) {
    return {
      ok: true,
      canWrite: doc.share_permission === "edit",
      userId,
      username,
    };
  }

  return { ok: false, canWrite: false, userId, username };
}

app.prepare().then(() => {
  const upgradeHandler = app.getUpgradeHandler();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "", true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname, query } = parse(req.url || "", true);
    if (pathname !== "/ws") {
      // 其余 upgrade（如 Next.js dev HMR websocket）交给 Next 处理，
      // 否则客户端热更新/引导相关连接被销毁会影响开发体验。
      upgradeHandler(req, socket, head);
      return;
    }

    const docId = typeof query.docId === "string" ? query.docId : "";
    const type = query.type === "doc" ? "doc" : "sheet";
    const token = typeof query.token === "string" ? query.token : undefined;

    if (!docId) {
      socket.destroy();
      return;
    }

    (async () => {
      const session = await resolveSession(req.headers.cookie);
      const auth = await authorize(docId, token, session);
      if (!auth.ok) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        addClient(ws, docId, type, {
          canWrite: auth.canWrite,
          userId: auth.userId,
          username: auth.username,
        });
      });
    })().catch(() => {
      socket.destroy();
    });
  });

  server.listen(port, () => {
    console.log(
      `> Ready on http://localhost:${port}  (Next + WebSocket /ws, dev=${dev})`
    );
  });
});
