"use client";

import { useState } from "react";
import EditorTopBar from "./EditorTopBar";
import ShareDialog from "./ShareDialog";
import DocEditor from "./editors/DocEditor";
import VersionHistory from "./VersionHistory";

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
        <DocEditor docId={docId} canWrite={canWrite} token={token} docName={name} />
      </div>
      {showShare && (
        <ShareDialog docId={docId} onClose={() => setShowShare(false)} />
      )}
      {showHistory && (
        <VersionHistory
          docId={docId}
          canWrite={canWrite}
          isOwner={isOwner}
          token={token}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
