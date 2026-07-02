'use client';

import { useEffect, useState } from 'react';
import { drawBoardActions } from '@autix/shared-store';
import { DrawWorkspace } from '@autix/shared-ui/draw';

// Ensures a canvas board exists (reuses the most recent, else creates one),
// then mounts the workspace. Server persistence keys off this board id.
export default function DrawPage() {
  const [boardId, setBoardId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await drawBoardActions.ensureBoard('创作画布');
        if (!cancelled) setBoardId(id);
      } catch {
        if (!cancelled) setBoardId('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (boardId === null) return null;

  return <DrawWorkspace boardId={boardId} />;
}
