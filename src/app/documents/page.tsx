import { currentUser } from "@/server/currentUser";
import { docsRepo } from "@/server/db";
import DocumentsClient from "@/components/DocumentsClient";
import type { DocumentListItem, DocType } from "@/lib/types";

export default async function DocumentsPage() {
  const user = await currentUser();

  const items: DocumentListItem[] = user
    ? docsRepo.listAccessible(user.userId).map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type as DocType,
        updated_at: r.updated_at,
        owner_name: r.owner_name,
        shared: r.shared === 1,
      }))
    : [];

  return <DocumentsClient username={user?.username ?? null} initialItems={items} />;
}
