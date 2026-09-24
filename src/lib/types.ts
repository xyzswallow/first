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
  isAdmin: boolean;
}

export type Permission = "read" | "edit";

export interface VersionItem {
  id: number;
  doc_id: string;
  source: string;
  created_by: string | null;
  created_at: string;
}

export interface AdminUser {
  id: number;
  username: string;
  is_admin: number;
  created_at: string;
  doc_count: number;
}

export interface AdminDocument {
  id: string;
  name: string;
  type: DocType;
  owner_id: number;
  owner_name: string;
  version_count: number;
  updated_at: string;
  created_at: string;
}

export interface SimpleUser {
  id: number;
  username: string;
}
