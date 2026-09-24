import { NextResponse } from "next/server";
import { usersRepo } from "@/server/db";
import { requireAdmin } from "@/server/currentUser";
import bcrypt from "bcryptjs";

// DELETE /api/admin/users/[uid] —— 删除用户（仅管理员，不能删自己）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });

  const uid = Number((await params).uid);
  if (uid === admin.userId)
    return NextResponse.json({ error: "不能删除自己" }, { status: 400 });
  if (!usersRepo.findById(uid))
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  usersRepo.remove(uid);
  return NextResponse.json({ ok: true });
}

// PATCH /api/admin/users/[uid] —— 重置密码 { password } 或设置管理员 { isAdmin }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });

  const uid = Number((await params).uid);
  const target = usersRepo.findById(uid);
  if (!target)
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  if (typeof body.password === "string") {
    if (body.password.length < 6)
      return NextResponse.json({ error: "密码长度至少6位" }, { status: 400 });
    usersRepo.updatePassword(uid, bcrypt.hashSync(body.password, 10));
    return NextResponse.json({ ok: true });
  }

  if (typeof body.isAdmin === "boolean") {
    if (uid === admin.userId && !body.isAdmin)
      return NextResponse.json({ error: "不能取消自己的管理员" }, { status: 400 });
    usersRepo.setAdmin(uid, body.isAdmin);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "无效的请求" }, { status: 400 });
}
