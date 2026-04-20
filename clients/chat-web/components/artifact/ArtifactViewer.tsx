'use client';

import ReactMarkdown from 'react-markdown';
import { useArtifactStore } from '@/store/artifact.store';

export function ArtifactViewer() {
  const { activeArtifact } = useArtifactStore();

  if (!activeArtifact) {
    return null;
  }

  return (
    <div className="h-full w-full overflow-auto p-6 prose prose-slate dark:prose-invert max-w-none">
      <ReactMarkdown>{activeArtifact.content}</ReactMarkdown>
    </div>
  );
}
