'use client';

import { Hash, FileText } from 'lucide-react';
import type { DocumentWithChunks } from '@/store/document.store';
import {
  DrawerShell,
  DrawerHero,
  DrawerBody,
  DrawerTag,
} from '@/components/drawer-shell';

interface ChunksDrawerProps {
  doc: DocumentWithChunks;
  onClose: () => void;
}

export function ChunksDrawer({ doc, onClose }: ChunksDrawerProps) {
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
          eyebrow="Knowledge chunks"
          title={doc.filename}
          description={
            <span className="flex items-center gap-1.5">
              <span>{chunks.length} 个文本块</span>
              {totalChars > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{totalChars.toLocaleString()} 字符</span>
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
            <div
              className="flex h-10 w-10 items-center justify-center rounded-md"
              style={{
                backgroundColor: 'var(--panel-muted)',
                border: '1px solid var(--border)',
              }}
            >
              <Hash
                className="h-5 w-5"
                style={{ color: 'var(--muted)' }}
                strokeWidth={1.75}
              />
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              暂无分块内容
            </p>
          </div>
        ) : (
          chunks.map((chunk) => (
            <article
              key={chunk.id}
              className="rounded-md p-4"
              style={{
                backgroundColor: 'var(--panel-muted)',
                border: '1px solid var(--border)',
              }}
            >
              <header className="mb-2.5 flex items-center gap-2">
                <DrawerTag tone="accent">#{chunk.chunkIndex + 1}</DrawerTag>
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--muted)' }}
                >
                  {chunk.content.length.toLocaleString()} 字符
                </span>
              </header>
              <p
                className="whitespace-pre-wrap text-[13.5px] leading-6"
                style={{ color: 'var(--foreground)' }}
              >
                {chunk.content}
              </p>
            </article>
          ))
        )}
      </DrawerBody>
    </DrawerShell>
  );
}
