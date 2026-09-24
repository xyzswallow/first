import { NextResponse } from "next/server";
import { versionsRepo } from "@/server/db";
import { requireAdmin } from "@/server/currentUser";

// DELETE /api/admin/documents/[id]/versions/[vid] —— 删除某版本（仅管理员）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });

  const { id, vid } = await params;
  const version = versionsRepo.get(Number(vid), id);
  if (!version)
    return NextResponse.json({ error: "版本不存在" }, { status: 404 });

  versionsRepo.remove(Number(vid));
  return NextResponse.json({ ok: true });
}
