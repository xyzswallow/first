import { docsRepo, sharesRepo, type DocumentRow } from "@/server/db";
import type { SessionUser } from "@/lib/types";

export interface DocAccess {
  doc: DocumentRow;
  canRead: boolean;
  canWrite: boolean;
  isOwner: boolean;
}

/**
 * 判定登录用户对某文档的访问权限（供 API 复用）。
 * 所有者：读写；被分享 edit：读写；被分享 read：只读。
 * 若提供有效的分享链接 token，则按 token 权限授予访问（支持匿名）。
 */
export function accessForUser(
  docId: string,
  user: SessionUser | null,
  token?: string
): DocAccess | null {
  const doc = docsRepo.findById(docId);
  if (!doc) return null;

  if (user) {
    if (doc.owner_id === user.userId) {
      return { doc, canRead: true, canWrite: true, isOwner: true };
    }
    const perm = sharesRepo.getPermission(docId, user.userId);
    if (perm) {
      return {
        doc,
        canRead: true,
        canWrite: perm === "edit",
        isOwner: false,
      };
    }
  }

  // 分享链接 token（支持匿名访问）
  if (token && doc.share_token && token === doc.share_token) {
    return {
      doc,
      canRead: true,
      canWrite: doc.share_permission === "edit",
      isOwner: false,
    };
  }

  return { doc, canRead: false, canWrite: false, isOwner: false };
}
