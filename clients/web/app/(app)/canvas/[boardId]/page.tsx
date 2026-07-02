'use client';

import { useParams } from 'next/navigation';
import { CreativeCanvasWorkspace } from '@autix/shared-ui/canvas';

// The unified `/canvas` entry (growth / paywall for non-members) lives at
// app/canvas/page.tsx. This authenticated sub-route hosts a real board; the
// (app) layout enforces auth, and the workspace degrades generation to a
// disabled state for expired/non-members via server-returned entitlement.
export default function CanvasBoardPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = String(params.boardId);

  // TODO(canvas): resolve the user's default image model config id instead of
  // an empty string (image-generate stays server-guarded until it is set).
  return <CreativeCanvasWorkspace boardId={boardId} modelConfigId="" />;
}
