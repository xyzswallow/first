import { NextResponse } from "next/server";
import { snapshotsRepo, versionsRepo, docsRepo } from "@/server/db";
import { currentUser } from "@/server/currentUser";
import { accessForUser } from "@/server/access";
import { broadcastReload, getDocSnapshot, restoreDocSnapshot } from "@/server/ws/roomHub";

// GET /api/documents/[id]/versions/[vid] —— 读取某版本内容（用于预览）
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const { id, vid } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? undefined;
  const user = await currentUser();
  const access = accessForUser(id, user, token);
  if (!access) return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  if (!access.canRead)
    return NextResponse.json({ error: "无权访问" }, { status: 403 });

  const version = versionsRepo.get(Number(vid), id);
  if (!version)
    return NextResponse.json({ error: "版本不存在" }, { status: 404 });
  return NextResponse.json({ content: version.content });
}

// POST /api/documents/[id]/versions/[vid] —— 恢复到该版本（需可写）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const { id, vid } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? undefined;
  const user = await currentUser();
  const access = accessForUser(id, user, token);
  if (!access) return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  if (!access.canWrite)
    return NextResponse.json({ error: "无编辑权限" }, { status: 403 });

  const version = versionsRepo.get(Number(vid), id);
  if (!version)
    return NextResponse.json({ error: "版本不存在" }, { status: 404 });

  const doc = docsRepo.findById(id);
  const viaLink = !!token && !access.isOwner;
  const who = user?.username ?? (viaLink ? "分享链接访客" : "匿名");

  if (doc?.type === "doc") {
    // 富文本：恢复前把当前实时状态存为一个版本
    const current = getDocSnapshot(id) ?? snapshotsRepo.get(id) ?? "";
    if (current && versionsRepo.latestContent(id) !== current) {
      versionsRepo.create(id, current, "auto", who);
    }
    // 将房间 Y.Doc 合并到目标版本并广播实时 update
    restoreDocSnapshot(id, version.content);
  } else {
    // 表格：恢复前先把当前内容存为一个版本，避免误操作丢失
    const current = snapshotsRepo.get(id) ?? "";
    if (current && versionsRepo.latestContent(id) !== current) {
      versionsRepo.create(id, current, "auto", who);
    }
    snapshotsRepo.save(id, version.content);
    // 通知同房间所有客户端重新拉取快照
    broadcastReload(id);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/documents/[id]/versions/[vid] —— 删除某版本（仅所有者）
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const { id, vid } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? undefined;
  const user = await currentUser();
  const access = accessForUser(id, user, token);
  if (!access) return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  if (!access.isOwner)
    return NextResponse.json({ error: "仅所有者可删除版本" }, { status: 403 });

  const version = versionsRepo.get(Number(vid), id);
  if (!version)
    return NextResponse.json({ error: "版本不存在" }, { status: 404 });

  versionsRepo.remove(Number(vid));
  return NextResponse.json({ ok: true });
}
