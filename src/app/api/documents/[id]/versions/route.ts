import { NextResponse } from "next/server";
import { snapshotsRepo, versionsRepo, docsRepo } from "@/server/db";
import { currentUser } from "@/server/currentUser";
import { accessForUser } from "@/server/access";
import { getDocSnapshot } from "@/server/ws/roomHub";

// GET /api/documents/[id]/versions —— 版本列表（可读即可查看）
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

  return NextResponse.json({ versions: versionsRepo.list(id) });
}

// POST /api/documents/[id]/versions —— 手动创建版本快照（需可写）
export async function POST(
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

  // 富文本：优先取活跃房间的实时 Y.Doc 状态，回退到已落库快照
  const doc = docsRepo.findById(id);
  const content =
    (doc?.type === "doc" ? getDocSnapshot(id) : null) ??
    snapshotsRepo.get(id) ??
    "";
  if (!content)
    return NextResponse.json({ error: "文档暂无内容" }, { status: 400 });

  const viaLink = !!token && !access.isOwner;
  const who = user?.username ?? (viaLink ? "分享链接访客" : "匿名");
  const versionId = versionsRepo.create(id, content, "manual", who);
  return NextResponse.json({ ok: true, id: versionId });
}
