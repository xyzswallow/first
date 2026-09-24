import { getSession } from "@/server/session";
import type { SessionUser } from "@/lib/types";

/** 服务端读取当前登录用户；未登录返回 null。 */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session.userId || !session.username) return null;
  return { userId: session.userId, username: session.username };
}
