import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/currentUser";
import { usersRepo, docsRepo } from "@/server/db";
import AdminClient from "@/components/AdminClient";
import type { AdminUser, AdminDocument, DocType } from "@/lib/types";

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/documents");

  const users: AdminUser[] = usersRepo.listAll().map((u) => ({
    id: u.id,
    username: u.username,
    is_admin: u.is_admin,
    created_at: u.created_at,
    doc_count: u.doc_count,
  }));

  const documents: AdminDocument[] = docsRepo.listAll().map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type as DocType,
    owner_id: d.owner_id,
    owner_name: d.owner_name,
    version_count: d.version_count,
    updated_at: d.updated_at,
    created_at: d.created_at,
  }));

  return (
    <AdminClient
      currentUserId={admin.userId}
      initialUsers={users}
      initialDocuments={documents}
    />
  );
}
