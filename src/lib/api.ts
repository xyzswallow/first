import type { DocumentListItem, DocType, VersionItem } from "./types";

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
};
