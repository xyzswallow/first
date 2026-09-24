"use client";

import { useState } from "react";
import EditorTopBar from "./EditorTopBar";
import ShareDialog from "./ShareDialog";
import SheetEditor from "./editors/SheetEditor";

export default function SheetPageClient({
  docId,
  name,
  canWrite,
  isOwner,
}: {
  docId: string;
  name: string;
  canWrite: boolean;
  isOwner: boolean;
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
        <SheetEditor docId={docId} canWrite={canWrite} />
      </div>
      {showShare && (
        <ShareDialog docId={docId} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
