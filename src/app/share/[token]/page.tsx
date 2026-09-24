import { notFound } from "next/navigation";
import { docsRepo } from "@/server/db";
import ShareViewClient from "@/components/ShareViewClient";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const doc = docsRepo.findByShareToken(token);
  if (!doc) notFound();

  const canWrite = doc.share_permission === "edit";
  const type = doc.type === "doc" ? "doc" : "sheet";

  return (
    <ShareViewClient
      docId={doc.id}
      name={doc.name}
      type={type}
      canWrite={canWrite}
      token={token}
    />
  );
}
