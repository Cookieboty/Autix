'use client';

import { useState } from 'react';
import {
  FileText, FileType, Trash2, ChevronDown, ChevronUp, Loader2, Zap,
} from 'lucide-react';
import { getDocumentWithChunks, deleteDocument, processDocument } from '@/lib/api';
import { useDocumentStore } from '@/store/document.store';
import type { DocumentItem, DocumentWithChunks } from '@/store/document.store';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN');
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  processing: '处理中...',
  done: '已完成',
  error: '处理失败',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--muted)',
  processing: 'var(--accent)',
  done: 'var(--success)',
  error: 'var(--danger)',
};

export function DocumentCard({ doc }: { doc: DocumentItem }) {
  const { expandedDoc, setExpandedDoc, removeDocument, updateDocument } = useDocumentStore();
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [processing, setProcessing] = useState(false);

  const isExpanded = expandedDoc?.id === doc.id;
  const isPdf = doc.mimeType === 'application/pdf';

  const handleToggle = async () => {
    if (isExpanded) { setExpandedDoc(null); return; }
    setLoadingChunks(true);
    try {
      const { data } = await getDocumentWithChunks(doc.id);
      setExpandedDoc(data as DocumentWithChunks);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await deleteDocument(doc.id);
      removeDocument(doc.id);
    } finally {
      setDeleting(false);
    }
  };

  const handleProcess = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessing(true);
    updateDocument(doc.id, { status: 'processing' });
    try {
      await processDocument(doc.id);
      // 轮询直到完成
      const poll = setInterval(async () => {
        const { data } = await getDocumentWithChunks(doc.id);
        if (data.status === 'done' || data.status === 'error') {
          updateDocument(doc.id, { status: data.status, chunkCount: data.chunkCount });
          clearInterval(poll);
          setProcessing(false);
        }
      }, 2000);
    } catch {
      updateDocument(doc.id, { status: 'error' });
      setProcessing(false);
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {isPdf
            ? <FileType className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
            : <FileText className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--muted)' }} />
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
              {doc.filename}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {formatSize(doc.size)} · {formatDate(doc.createdAt)}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs" style={{ color: STATUS_COLOR[doc.status] ?? 'var(--muted)' }}>
                {STATUS_LABEL[doc.status] ?? doc.status}
              </span>
              {doc.status === 'done' && (
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  · {doc.chunkCount || doc._count?.chunks || 0} chunks
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* 手动触发 process（pending / error 状态显示） */}
            {(doc.status === 'pending' || doc.status === 'error') && (
              <button
                onClick={handleProcess}
                disabled={processing}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: 'var(--muted)' }}
                title="触发解析与向量化"
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--muted)')}
              >
                {processing
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Zap className="w-3.5 h-3.5" />
                }
              </button>
            )}

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--danger)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--muted)')}
            >
              {deleting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />
              }
            </button>

            {doc.status === 'done' && (
              <button
                onClick={handleToggle}
                disabled={loadingChunks}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--foreground)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--muted)')}
              >
                {loadingChunks
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : isExpanded
                  ? <ChevronUp className="w-3.5 h-3.5" />
                  : <ChevronDown className="w-3.5 h-3.5" />
                }
              </button>
            )}
          </div>
        </div>
      </div>

      {isExpanded && expandedDoc && (
        <div
          className="border-t overflow-y-auto"
          style={{ borderColor: 'var(--border)', maxHeight: '400px' }}
        >
          {expandedDoc.chunks.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>暂无分块内容</p>
            </div>
          ) : (
            expandedDoc.chunks.map((chunk, i) => (
              <div
                key={chunk.id}
                className="px-4 py-3"
                style={{ borderBottom: i < expandedDoc.chunks.length - 1 ? '1px solid var(--border)' : undefined }}
              >
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>
                  Chunk {chunk.chunkIndex + 1}
                </p>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>
                  {chunk.content}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
