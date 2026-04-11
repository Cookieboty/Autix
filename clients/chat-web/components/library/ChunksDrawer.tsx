'use client';

import { useEffect, useRef } from 'react';
import { X, Hash, FileText } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { DocumentWithChunks } from '@/store/document.store';

interface ChunksDrawerProps {
  doc: DocumentWithChunks;
  onClose: () => void;
}

export function ChunksDrawer({ doc, onClose }: ChunksDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 h-full z-50 flex flex-col"
        style={{
          width: '480px',
          backgroundColor: 'var(--background)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start gap-3 px-6 py-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="p-2 rounded-lg flex-shrink-0"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--accent)' }}
          >
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
              {doc.filename}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {doc.chunks.length} 个文本块
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)';
              (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--muted)';
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chunks list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {doc.chunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Hash className="w-8 h-8 opacity-20" style={{ color: 'var(--muted)' }} />
              <p className="text-sm" style={{ color: 'var(--muted)' }}>暂无分块内容</p>
            </div>
          ) : (
            doc.chunks.map((chunk, i) => (
              <div
                key={chunk.id}
                className="rounded-xl p-4"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
                  >
                    #{chunk.chunkIndex + 1}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                    {chunk.content.length} 字符
                  </span>
                </div>
                <p
                  className="text-xs leading-relaxed whitespace-pre-wrap"
                  style={{ color: 'var(--foreground)' }}
                >
                  {chunk.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
