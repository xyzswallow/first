import { NextResponse } from "next/server";
import { usersRepo } from "@/server/db";
import { currentUser } from "@/server/currentUser";

// GET /api/users —— 系统用户清单（登录即可，供分享选择用户）
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  // 排除自己
  const users = usersRepo.listSimple().filter((u) => u.id !== user.userId);
  return NextResponse.json({ users });
}
