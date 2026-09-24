import { NextResponse } from "next/server";
import { changePassword } from "@/server/auth";
import { getSession } from "@/server/session";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { oldPassword, newPassword } = await req.json().catch(() => ({}));
  const result = changePassword(
    session.userId,
    String(oldPassword ?? ""),
    String(newPassword ?? "")
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
