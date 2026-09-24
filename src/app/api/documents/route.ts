import { NextResponse } from "next/server";
import { docsRepo } from "@/server/db";
import { currentUser } from "@/server/currentUser";
import type { DocumentListItem, DocType } from "@/lib/types";

// GET /api/documents —— 当前用户可访问的文档列表（自己拥有 + 被分享）
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const rows = docsRepo.listAccessible(user.userId);
  const items: DocumentListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as DocType,
    updated_at: r.updated_at,
    owner_name: r.owner_name,
    shared: r.shared === 1,
  }));
  return NextResponse.json({ items });
}

// POST /api/documents —— 新建文档 { name, type }
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type: DocType = body.type === "doc" ? "doc" : "sheet";
  const name =
    String(body.name ?? "").trim() ||
    (type === "doc" ? "无标题文档" : "无标题表格");

  const doc = docsRepo.create(name, type, user.userId);
  return NextResponse.json({ id: doc.id, type: doc.type });
}
