import { NextResponse } from "next/server";
import { sharesRepo, usersRepo } from "@/server/db";
import { currentUser } from "@/server/currentUser";
import { accessForUser } from "@/server/access";

// GET —— 已分享的用户列表（仅所有者）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await currentUser();
  const access = accessForUser(id, user);
  if (!access) return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  if (!access.isOwner)
    return NextResponse.json({ error: "无权查看" }, { status: 403 });

  return NextResponse.json({ users: sharesRepo.listByDoc(id) });
}

// POST —— 按用户名分享 { username, permission }（仅所有者）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await currentUser();
  const access = accessForUser(id, user);
  if (!access) return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  if (!access.isOwner)
    return NextResponse.json({ error: "仅所有者可分享" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  const permission = body.permission === "edit" ? "edit" : "read";
  if (!username)
    return NextResponse.json({ error: "用户名不能为空" }, { status: 400 });

  const target = usersRepo.findByUsername(username);
  if (!target)
    return NextResponse.json({ error: "该用户不存在" }, { status: 404 });
  if (target.id === user!.userId)
    return NextResponse.json({ error: "不能分享给自己" }, { status: 400 });

  sharesRepo.upsert(id, target.id, permission);
  return NextResponse.json({ ok: true });
}
