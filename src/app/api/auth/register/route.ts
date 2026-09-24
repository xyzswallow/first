import { NextResponse } from "next/server";
import { registerUser } from "@/server/auth";
import { getSession } from "@/server/session";

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  const result = registerUser(
    String(username ?? "").trim(),
    String(password ?? "")
  );
  if (!result.ok || !result.user) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const session = await getSession();
  session.userId = result.user.id;
  session.username = result.user.username;
  await session.save();
  return NextResponse.json({
    user: { userId: result.user.id, username: result.user.username },
  });
}
