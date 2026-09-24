import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, "app.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'sheet',
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE,
  share_permission TEXT DEFAULT 'read',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_snapshots (
  doc_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  shared_with INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(doc_id, shared_with)
);

CREATE TABLE IF NOT EXISTS document_edit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  edit_time TEXT NOT NULL DEFAULT (datetime('now')),
  edit_type TEXT DEFAULT 'edit'
);

CREATE TABLE IF NOT EXISTS document_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'link',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON document_versions(doc_id, id DESC);
`);

// ---------- 迁移：为旧库补充 is_admin 列 ----------
try {
  const cols = db.prepare("PRAGMA table_info(users)").all() as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === "is_admin")) {
    db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
  }
} catch {
  // 忽略迁移错误
}

// 指定用户名 xue 为管理员（若存在）
db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'xue'").run();

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  name: string;
  type: string;
  owner_id: number;
  share_token: string | null;
  share_permission: string;
  created_at: string;
  updated_at: string;
}

// ---------- Users ----------
export const usersRepo = {
  create(username: string, passwordHash: string): UserRow {
    const info = db
      .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
      .run(username, passwordHash);
    return this.findById(Number(info.lastInsertRowid))!;
  },
  findByUsername(username: string): UserRow | undefined {
    return db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username) as UserRow | undefined;
  },
  findById(id: number): UserRow | undefined {
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | UserRow
      | undefined;
  },
  updatePassword(id: number, passwordHash: string): void {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      passwordHash,
      id
    );
  },
  /** 全部用户（管理后台用，含文档数量） */
  listAll(): (Omit<UserRow, "password_hash"> & { doc_count: number })[] {
    return db
      .prepare(
        `SELECT u.id, u.username, u.is_admin, u.created_at,
                (SELECT COUNT(*) FROM documents d WHERE d.owner_id = u.id) AS doc_count
         FROM users u ORDER BY u.id ASC`
      )
      .all() as (Omit<UserRow, "password_hash"> & { doc_count: number })[];
  },
  /** 用户清单（供分享选择，仅 id + username） */
  listSimple(): { id: number; username: string }[] {
    return db
      .prepare("SELECT id, username FROM users ORDER BY username ASC")
      .all() as { id: number; username: string }[];
  },
  remove(id: number): void {
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
  },
  setAdmin(id: number, isAdmin: boolean): void {
    db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(
      isAdmin ? 1 : 0,
      id
    );
  },
};

// ---------- Documents ----------
export const docsRepo = {
  create(name: string, type: string, ownerId: number): DocumentRow {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO documents (id, name, type, owner_id) VALUES (?, ?, ?, ?)"
    ).run(id, name, type, ownerId);
    return this.findById(id)!;
  },
  findById(id: string): DocumentRow | undefined {
    return db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as
      | DocumentRow
      | undefined;
  },
  findByShareToken(token: string): DocumentRow | undefined {
    return db
      .prepare("SELECT * FROM documents WHERE share_token = ?")
      .get(token) as DocumentRow | undefined;
  },
  /** Documents owned by user + shared to user */
  listAccessible(userId: number): (DocumentRow & { shared: 0 | 1; owner_name: string })[] {
    return db
      .prepare(
        `SELECT d.*, 0 AS shared, u.username AS owner_name
         FROM documents d JOIN users u ON u.id = d.owner_id
         WHERE d.owner_id = ?
         UNION
         SELECT d.*, 1 AS shared, u.username AS owner_name
         FROM documents d
         JOIN users u ON u.id = d.owner_id
         JOIN document_shares s ON s.doc_id = d.id
         WHERE s.shared_with = ?
         ORDER BY updated_at DESC`
      )
      .all(userId, userId) as (DocumentRow & { shared: 0 | 1; owner_name: string })[];
  },
  rename(id: string, name: string): void {
    db.prepare(
      "UPDATE documents SET name = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(name, id);
  },
  touch(id: string): void {
    db.prepare(
      "UPDATE documents SET updated_at = datetime('now') WHERE id = ?"
    ).run(id);
  },
  remove(id: string): void {
    db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  },
  setShareToken(id: string, token: string, permission: string): void {
    db.prepare(
      "UPDATE documents SET share_token = ?, share_permission = ? WHERE id = ?"
    ).run(token, permission, id);
  },
  /** 全部文档（管理后台用，含所有者名与版本数） */
  listAll(): (DocumentRow & { owner_name: string; version_count: number })[] {
    return db
      .prepare(
        `SELECT d.*, u.username AS owner_name,
                (SELECT COUNT(*) FROM document_versions v WHERE v.doc_id = d.id) AS version_count
         FROM documents d JOIN users u ON u.id = d.owner_id
         ORDER BY d.updated_at DESC`
      )
      .all() as (DocumentRow & { owner_name: string; version_count: number })[];
  },
  /** 转移文档所属人（管理后台用） */
  setOwner(id: string, ownerId: number): void {
    db.prepare("UPDATE documents SET owner_id = ? WHERE id = ?").run(
      ownerId,
      id
    );
  },
};

// ---------- Snapshots ----------
export const snapshotsRepo = {
  get(docId: string): string | undefined {
    const row = db
      .prepare("SELECT content FROM document_snapshots WHERE doc_id = ?")
      .get(docId) as { content: string } | undefined;
    return row?.content;
  },
  save(docId: string, content: string): void {
    db.prepare(
      `INSERT INTO document_snapshots (doc_id, content, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(doc_id) DO UPDATE SET content = excluded.content, updated_at = datetime('now')`
    ).run(docId, content);
    docsRepo.touch(docId);
  },
};

// ---------- Shares (by username) ----------
export const sharesRepo = {
  upsert(docId: string, sharedWith: number, permission: string): void {
    db.prepare(
      `INSERT INTO document_shares (doc_id, shared_with, permission)
       VALUES (?, ?, ?)
       ON CONFLICT(doc_id, shared_with) DO UPDATE SET permission = excluded.permission`
    ).run(docId, sharedWith, permission);
  },
  listByDoc(docId: string): { username: string; permission: string }[] {
    return db
      .prepare(
        `SELECT u.username AS username, s.permission AS permission
         FROM document_shares s JOIN users u ON u.id = s.shared_with
         WHERE s.doc_id = ?`
      )
      .all(docId) as { username: string; permission: string }[];
  },
  getPermission(docId: string, userId: number): string | undefined {
    const row = db
      .prepare(
        "SELECT permission FROM document_shares WHERE doc_id = ? AND shared_with = ?"
      )
      .get(docId, userId) as { permission: string } | undefined;
    return row?.permission;
  },
};

// ---------- Edit logs ----------
export const logsRepo = {
  add(docId: string, userId: number | null, username: string, editType = "edit"): void {
    db.prepare(
      "INSERT INTO document_edit_logs (doc_id, user_id, username, edit_type) VALUES (?, ?, ?, ?)"
    ).run(docId, userId, username, editType);
  },
};

export interface VersionRow {
  id: number;
  doc_id: string;
  content: string;
  source: string;
  created_by: string | null;
  created_at: string;
}

// ---------- Versions ----------
export const versionsRepo = {
  create(
    docId: string,
    content: string,
    source: string,
    createdBy: string | null
  ): number {
    const info = db
      .prepare(
        "INSERT INTO document_versions (doc_id, content, source, created_by) VALUES (?, ?, ?, ?)"
      )
      .run(docId, content, source, createdBy);
    return Number(info.lastInsertRowid);
  },
  /** 版本列表（不含 content，按时间倒序） */
  list(docId: string): Omit<VersionRow, "content">[] {
    return db
      .prepare(
        `SELECT id, doc_id, source, created_by, created_at
         FROM document_versions WHERE doc_id = ? ORDER BY id DESC`
      )
      .all(docId) as Omit<VersionRow, "content">[];
  },
  get(id: number, docId: string): VersionRow | undefined {
    return db
      .prepare("SELECT * FROM document_versions WHERE id = ? AND doc_id = ?")
      .get(id, docId) as VersionRow | undefined;
  },
  /** 取最新一条版本的内容（用于去重：内容未变则不重复记录） */
  latestContent(docId: string): string | undefined {
    const row = db
      .prepare(
        "SELECT content FROM document_versions WHERE doc_id = ? ORDER BY id DESC LIMIT 1"
      )
      .get(docId) as { content: string } | undefined;
    return row?.content;
  },
  /** 删除单个版本（管理后台用） */
  remove(id: number): void {
    db.prepare("DELETE FROM document_versions WHERE id = ?").run(id);
  },
};

export default db;
