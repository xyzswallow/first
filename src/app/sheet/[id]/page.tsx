import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/server/currentUser";
import { accessForUser } from "@/server/access";
import SheetPageClient from "@/components/SheetPageClient";

export default async function SheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect("/documents");

  const access = accessForUser(id, user);
  if (!access) notFound();
  if (!access.canRead) redirect("/documents");

  return (
    <SheetPageClient
      docId={id}
      name={access.doc.name}
      canWrite={access.canWrite}
      isOwner={access.isOwner}
    />
  );
}
