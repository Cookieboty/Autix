'use client';

import { useEffect } from 'react';
import { BookOpen, FileX } from 'lucide-react';
import { getDocuments } from '@/lib/api';
import { useDocumentStore } from '@/store/document.store';
import type { DocumentItem } from '@/store/document.store';
import { DocumentCard } from './DocumentCard';
import { UploadZone } from './UploadZone';

export function LibraryView() {
  const { documents, loading, setDocuments, setLoading } = useDocumentStore();

  useEffect(() => {
    setLoading(true);
    getDocuments()
      .then(({ data }) => setDocuments(data as DocumentItem[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setDocuments, setLoading]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <div
        className="flex items-center flex-shrink-0 h-14 px-8"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" style={{ color: 'var(--muted)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Documents
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <UploadZone />

          {loading ? (
            <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
              <p className="text-sm">加载中...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 space-y-2" style={{ color: 'var(--muted)' }}>
              <FileX className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm">还没有文档，上传一个开始吧</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
