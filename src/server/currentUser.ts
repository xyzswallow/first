import { getSession } from "@/server/session";
import { usersRepo } from "@/server/db";
import type { SessionUser } from "@/lib/types";

/** 服务端读取当前登录用户；未登录返回 null。isAdmin 实时从数据库读取。 */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session.userId || !session.username) return null;
  const row = usersRepo.findById(session.userId);
  return {
    userId: session.userId,
    username: session.username,
    isAdmin: row?.is_admin === 1,
  };
}

/** 要求管理员身份；非管理员返回 null。 */
export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await currentUser();
  if (!user || !user.isAdmin) return null;
  return user;
}
