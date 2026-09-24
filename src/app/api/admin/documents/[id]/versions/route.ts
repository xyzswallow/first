import { NextResponse } from "next/server";
import { versionsRepo, docsRepo } from "@/server/db";
import { requireAdmin } from "@/server/currentUser";

// GET /api/admin/documents/[id]/versions —— 某文档版本列表（仅管理员）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });

  const { id } = await params;
  if (!docsRepo.findById(id))
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });

  return NextResponse.json({ versions: versionsRepo.list(id) });
}
