export type DocType = "sheet" | "doc";

export interface DocumentListItem {
  id: string;
  name: string;
  type: DocType;
  updated_at: string;
  owner_name: string;
  shared: boolean;
}

export interface SessionUser {
  userId: number;
  username: string;
}

export type Permission = "read" | "edit";

export interface VersionItem {
  id: number;
  doc_id: string;
  source: string;
  created_by: string | null;
  created_at: string;
}
