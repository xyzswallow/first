import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/server/currentUser";
import { accessForUser } from "@/server/access";
import DocPageClient from "@/components/DocPageClient";

export default async function DocPage({
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
    <DocPageClient
      docId={id}
      name={access.doc.name}
      canWrite={access.canWrite}
      isOwner={access.isOwner}
    />
  );
}
