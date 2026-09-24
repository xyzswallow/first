import { NextResponse } from "next/server";
import { docsRepo } from "@/server/db";
import { requireAdmin } from "@/server/currentUser";

// GET /api/admin/documents —— 全部文档（仅管理员）
export async function GET() {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
  return NextResponse.json({ documents: docsRepo.listAll() });
}
