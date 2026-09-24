import { NextResponse } from "next/server";
import { snapshotsRepo } from "@/server/db";
import { currentUser } from "@/server/currentUser";
import { accessForUser } from "@/server/access";

// GET /api/documents/[id]/snapshot —— 读取快照内容
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? undefined;
  const user = await currentUser();
  const access = accessForUser(id, user, token);
  if (!access) return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  if (!access.canRead)
    return NextResponse.json({ error: "无权访问" }, { status: 403 });

  const content = snapshotsRepo.get(id) ?? "";
  return NextResponse.json({ content });
}

// PUT /api/documents/[id]/snapshot —— 保存快照 { content }
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? undefined;
  const user = await currentUser();
  const access = accessForUser(id, user, token);
  if (!access) return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  if (!access.canWrite)
    return NextResponse.json({ error: "无编辑权限" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content : "";
  snapshotsRepo.save(id, content);
  return NextResponse.json({ ok: true });
}
