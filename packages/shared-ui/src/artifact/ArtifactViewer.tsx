'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslations } from 'next-intl';
import { useArtifactStore } from '@autix/shared-store';

export function ArtifactViewer() {
  const t = useTranslations('artifact');
  const { activeArtifact } = useArtifactStore();

  if (!activeArtifact) {
    return null;
  }

  return (
    <div className="h-full w-full min-w-0 overflow-auto p-5">
      <div className="mx-auto min-h-full max-w-4xl rounded-lg px-8 py-8 bg-card border border-border">
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {t('previewLabel')}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            {activeArtifact.title}
          </h1>
        </div>

        <div className="artifact-prose text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeArtifact.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
