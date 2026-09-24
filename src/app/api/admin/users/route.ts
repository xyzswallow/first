import { NextResponse } from "next/server";
import { usersRepo } from "@/server/db";
import { requireAdmin } from "@/server/currentUser";

// GET /api/admin/users —— 全部用户（仅管理员）
export async function GET() {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
  return NextResponse.json({ users: usersRepo.listAll() });
}
