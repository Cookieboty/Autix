'use client';

import { Hash, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DocumentWithChunks } from '@autix/shared-store';
import {
  DrawerShell,
  DrawerHero,
  DrawerBody,
  DrawerTag,
} from '../drawer-shell';

interface ChunksDrawerProps {
  doc: DocumentWithChunks;
  onClose: () => void;
}

export function ChunksDrawer({ doc, onClose }: ChunksDrawerProps) {
  const t = useTranslations('library');
  const chunks = doc.chunks ?? [];
  const totalChars = chunks.reduce(
    (sum, chunk) => sum + chunk.content.length,
    0,
  );

  return (
    <DrawerShell
      open
      onClose={onClose}
      width="md"
      header={
        <DrawerHero
          icon={<FileText className="h-5 w-5" strokeWidth={1.75} />}
          eyebrow={t('knowledgeChunks')}
          title={doc.filename}
          description={
            <span className="flex items-center gap-1.5">
              <span>{t('textBlockCount', { count: chunks.length })}</span>
              {totalChars > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{t('charCount', { count: totalChars.toLocaleString() })}</span>
                </>
              ) : null}
            </span>
          }
        />
      }
    >
      <DrawerBody className="space-y-3">
        {chunks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary border border-border">
              <Hash className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('noChunks')}
            </p>
          </div>
        ) : (
          chunks.map((chunk) => (
            <article
              key={chunk.id}
              className="rounded-md p-4 bg-secondary border border-border"
            >
              <header className="mb-2.5 flex items-center gap-2">
                <DrawerTag tone="accent">#{chunk.chunkIndex + 1}</DrawerTag>
                <span className="text-[11px] text-muted-foreground">
                  {t('charCount', { count: chunk.content.length.toLocaleString() })}
                </span>
              </header>
              <p className="whitespace-pre-wrap text-[13.5px] leading-6 text-foreground">
                {chunk.content}
              </p>
            </article>
          ))
        )}
      </DrawerBody>
    </DrawerShell>
  );
}
