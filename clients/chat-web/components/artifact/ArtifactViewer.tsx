'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useArtifactStore } from '@/store/artifact.store';

export function ArtifactViewer() {
  const { activeArtifact } = useArtifactStore();

  if (!activeArtifact) {
    return null;
  }

  return (
    <div className="h-full w-full overflow-auto p-5" style={{ minWidth: 0, width: '100%' }}>
      <div
        className="mx-auto min-h-full max-w-4xl rounded-lg px-8 py-8"
        style={{
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
            Preview
          </p>
          <h1 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {activeArtifact.title}
          </h1>
        </div>

        <div className="artifact-prose" style={{ color: 'var(--foreground)' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeArtifact.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
