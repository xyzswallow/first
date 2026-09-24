import { NextResponse } from "next/server";
import { verifyLogin } from "@/server/auth";
import { getSession } from "@/server/session";

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  const result = verifyLogin(
    String(username ?? "").trim(),
    String(password ?? "")
  );
  if (!result.ok || !result.user) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  const session = await getSession();
  session.userId = result.user.id;
  session.username = result.user.username;
  session.isAdmin = result.user.is_admin === 1;
  await session.save();
  return NextResponse.json({
    user: {
      userId: result.user.id,
      username: result.user.username,
      isAdmin: result.user.is_admin === 1,
    },
  });
}
