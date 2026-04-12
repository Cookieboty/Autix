'use client';

import { useEffect, useState } from 'react';
import { BookOpen, FileX, Plus } from 'lucide-react';
import { getDocuments } from '@/lib/api';
import { useDocumentStore } from '@/store/document.store';
import type { DocumentItem, DocumentWithChunks } from '@/store/document.store';
import { DocumentCard } from './DocumentCard';
import { UploadZone } from './UploadZone';
import { ChunksDrawer } from './ChunksDrawer';

export function LibraryView() {
  const { documents, loading, setDocuments, setLoading } = useDocumentStore();
  const [chunksDoc, setChunksDoc] = useState<DocumentWithChunks | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    setLoading(true);
    getDocuments()
      .then(({ data }) => setDocuments(data as DocumentItem[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setDocuments, setLoading]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between flex-shrink-0 h-14 px-8"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" style={{ color: 'var(--muted)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            资料库
          </span>
          {documents.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--muted)' }}
            >
              {documents.length}
            </span>
          )}
        </div>

        {/* Upload toggle button */}
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          style={{
            backgroundColor: showUpload ? 'var(--accent)' : 'var(--surface)',
            color: showUpload ? 'var(--accent-foreground)' : 'var(--foreground)',
            border: `1px solid ${showUpload ? 'transparent' : 'var(--border)'}`,
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          上传文档
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Upload zone: shown when toggled or no documents */}
          {(showUpload || documents.length === 0) && (
            <UploadZone />
          )}

          {/* Document grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl h-36 animate-pulse"
                  style={{ backgroundColor: 'var(--surface)' }}
                />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FileX className="w-12 h-12 opacity-20" style={{ color: 'var(--muted)' }} />
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                还没有文档，上传一个开始吧
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onViewChunks={setChunksDoc}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Chunks drawer ── */}
      {chunksDoc && (
        <ChunksDrawer doc={chunksDoc} onClose={() => setChunksDoc(null)} />
      )}
    </div>
  );
}
