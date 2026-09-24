import { NextResponse } from "next/server";
import { docsRepo } from "@/server/db";
import { currentUser } from "@/server/currentUser";
import { accessForUser } from "@/server/access";

// GET /api/documents/[id] —— 文档元信息（含权限）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await currentUser();
  const access = accessForUser(id, user);
  if (!access) return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  if (!access.canRead)
    return NextResponse.json({ error: "无权访问" }, { status: 403 });

  return NextResponse.json({
    id: access.doc.id,
    name: access.doc.name,
    type: access.doc.type,
    canWrite: access.canWrite,
    isOwner: access.isOwner,
    updated_at: access.doc.updated_at,
  });
}

// PATCH /api/documents/[id] —— 重命名 { name }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await currentUser();
  const access = accessForUser(id, user);
  if (!access) return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  if (!access.canWrite)
    return NextResponse.json({ error: "无编辑权限" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
  docsRepo.rename(id, name);
  return NextResponse.json({ ok: true });
}

// DELETE /api/documents/[id] —— 仅所有者可删
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await currentUser();
  const access = accessForUser(id, user);
  if (!access) return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  if (!access.isOwner)
    return NextResponse.json({ error: "仅所有者可删除" }, { status: 403 });

  docsRepo.remove(id);
  return NextResponse.json({ ok: true });
}
