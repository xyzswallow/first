import { NextResponse } from "next/server";
import { docsRepo, usersRepo } from "@/server/db";
import { requireAdmin } from "@/server/currentUser";

// DELETE /api/admin/documents/[id] —— 删除任意文档（仅管理员）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });

  const { id } = await params;
  if (!docsRepo.findById(id))
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });

  docsRepo.remove(id);
  return NextResponse.json({ ok: true });
}

// PATCH /api/admin/documents/[id] —— 转移所属人 { ownerId }（仅管理员）
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });

  const { id } = await params;
  if (!docsRepo.findById(id))
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const ownerId = Number(body.ownerId);
  if (!ownerId || !usersRepo.findById(ownerId))
    return NextResponse.json({ error: "目标用户不存在" }, { status: 400 });

  docsRepo.setOwner(id, ownerId);
  return NextResponse.json({ ok: true });
}
