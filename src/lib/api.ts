import type {
  DocumentListItem,
  DocType,
  VersionItem,
  AdminUser,
  AdminDocument,
  SimpleUser,
} from "./types";

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "请求失败");
  return data;
}

export const api = {
  async listDocuments(): Promise<DocumentListItem[]> {
    const res = await fetch("/api/documents");
    const data = await jsonOrThrow(res);
    return data.items;
  },
  async createDocument(name: string, type: DocType): Promise<{ id: string; type: DocType }> {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    });
    return jsonOrThrow(res);
  },
  async deleteDocument(id: string): Promise<void> {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    await jsonOrThrow(res);
  },
  async renameDocument(id: string, name: string): Promise<void> {
    const res = await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await jsonOrThrow(res);
  },
  async logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
  },
  async listVersions(
    id: string,
    token?: string
  ): Promise<VersionItem[]> {
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(`/api/documents/${id}/versions${qs}`);
    const data = await jsonOrThrow(res);
    return data.versions;
  },
  async createVersion(id: string, token?: string): Promise<void> {
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(`/api/documents/${id}/versions${qs}`, {
      method: "POST",
    });
    await jsonOrThrow(res);
  },
  async getVersionContent(
    id: string,
    vid: number,
    token?: string
  ): Promise<string> {
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(`/api/documents/${id}/versions/${vid}${qs}`);
    const data = await jsonOrThrow(res);
    return data.content;
  },
  async restoreVersion(id: string, vid: number, token?: string): Promise<void> {
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(`/api/documents/${id}/versions/${vid}${qs}`, {
      method: "POST",
    });
    await jsonOrThrow(res);
  },
  async deleteVersion(id: string, vid: number, token?: string): Promise<void> {
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(`/api/documents/${id}/versions/${vid}${qs}`, {
      method: "DELETE",
    });
    await jsonOrThrow(res);
  },

  // ---------- 系统用户清单（供分享选择） ----------
  async listUsers(): Promise<SimpleUser[]> {
    const res = await fetch("/api/users");
    const data = await jsonOrThrow(res);
    return data.users;
  },

  // ---------- 管理后台 ----------
  async adminListUsers(): Promise<AdminUser[]> {
    const res = await fetch("/api/admin/users");
    const data = await jsonOrThrow(res);
    return data.users;
  },
  async adminDeleteUser(uid: number): Promise<void> {
    const res = await fetch(`/api/admin/users/${uid}`, { method: "DELETE" });
    await jsonOrThrow(res);
  },
  async adminResetPassword(uid: number, password: string): Promise<void> {
    const res = await fetch(`/api/admin/users/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    await jsonOrThrow(res);
  },
  async adminSetAdmin(uid: number, isAdmin: boolean): Promise<void> {
    const res = await fetch(`/api/admin/users/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin }),
    });
    await jsonOrThrow(res);
  },
  async adminListDocuments(): Promise<AdminDocument[]> {
    const res = await fetch("/api/admin/documents");
    const data = await jsonOrThrow(res);
    return data.documents;
  },
  async adminDeleteDocument(id: string): Promise<void> {
    const res = await fetch(`/api/admin/documents/${id}`, { method: "DELETE" });
    await jsonOrThrow(res);
  },
  async adminTransferDocument(id: string, ownerId: number): Promise<void> {
    const res = await fetch(`/api/admin/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId }),
    });
    await jsonOrThrow(res);
  },
  async adminListVersions(id: string): Promise<VersionItem[]> {
    const res = await fetch(`/api/admin/documents/${id}/versions`);
    const data = await jsonOrThrow(res);
    return data.versions;
  },
  async adminDeleteVersion(id: string, vid: number): Promise<void> {
    const res = await fetch(`/api/admin/documents/${id}/versions/${vid}`, {
      method: "DELETE",
    });
    await jsonOrThrow(res);
  },
};
