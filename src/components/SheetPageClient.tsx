"use client";

import { useState } from "react";
import EditorTopBar from "./EditorTopBar";
import ShareDialog from "./ShareDialog";
import SheetEditor from "./editors/SheetEditor";
import VersionHistory from "./VersionHistory";

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
  const [showHistory, setShowHistory] = useState(false);
  return (
    <div className="flex h-screen flex-col">
      <EditorTopBar
        docId={docId}
        initialName={name}
        canWrite={canWrite}
        isOwner={isOwner}
        onShare={() => setShowShare(true)}
        onHistory={() => setShowHistory(true)}
      />
      <div className="flex-1 overflow-hidden">
        <SheetEditor docId={docId} canWrite={canWrite} />
      </div>
      {showShare && (
        <ShareDialog docId={docId} onClose={() => setShowShare(false)} />
      )}
      {showHistory && (
        <VersionHistory
          docId={docId}
          canWrite={canWrite}
          isOwner={isOwner}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
