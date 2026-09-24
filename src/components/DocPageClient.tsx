"use client";

import { useState } from "react";
import EditorTopBar from "./EditorTopBar";
import ShareDialog from "./ShareDialog";
import DocEditor from "./editors/DocEditor";

export default function DocPageClient({
  docId,
  name,
  canWrite,
  isOwner,
  token,
}: {
  docId: string;
  name: string;
  canWrite: boolean;
  isOwner: boolean;
  token?: string;
}) {
  const [showShare, setShowShare] = useState(false);
  return (
    <div className="flex h-screen flex-col">
      <EditorTopBar
        docId={docId}
        initialName={name}
        canWrite={canWrite}
        isOwner={isOwner}
        onShare={() => setShowShare(true)}
      />
      <div className="flex-1 overflow-hidden">
        <DocEditor docId={docId} canWrite={canWrite} token={token} />
      </div>
      {showShare && (
        <ShareDialog docId={docId} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
