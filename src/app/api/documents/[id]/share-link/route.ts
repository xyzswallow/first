import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { docsRepo } from "@/server/db";
import { currentUser } from "@/server/currentUser";
import { accessForUser } from "@/server/access";

// GET —— 获取当前分享链接 token 与权限（仅所有者）
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

  return NextResponse.json({
    token: access.doc.share_token,
    permission: access.doc.share_permission,
  });
}

// POST —— 生成/更新分享链接 { permission }（仅所有者）
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
  const permission = body.permission === "edit" ? "edit" : "read";
  const token = access.doc.share_token || randomBytes(12).toString("hex");
  docsRepo.setShareToken(id, token, permission);
  return NextResponse.json({ token, permission });
}
