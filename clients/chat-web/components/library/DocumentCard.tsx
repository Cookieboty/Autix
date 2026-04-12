'use client';

import { useState } from 'react';
import { FileText, FileType2, Trash2, Loader2, Zap, Layers, AlertTriangle } from 'lucide-react';
import { getDocumentWithChunks, deleteDocument, processDocument } from '@/lib/api';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  processing: '处理中',
  done: '已完成',
  error: '处理失败',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--muted)',
  processing: 'var(--accent)',
  done: 'var(--success)',
  error: 'var(--danger)',
};

const STATUS_BG: Record<string, string> = {
  pending: 'transparent',
  processing: 'color-mix(in oklch, var(--accent) 12%, transparent)',
  done: 'color-mix(in oklch, var(--success) 12%, transparent)',
  error: 'color-mix(in oklch, var(--danger) 12%, transparent)',
};

interface DocumentCardProps {
  doc: DocumentItem;
  onViewChunks: (doc: DocumentWithChunks) => void;
}

export function DocumentCard({ doc, onViewChunks }: DocumentCardProps) {
  const { removeDocument, updateDocument } = useDocumentStore();
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isPdf = doc.mimeType === 'application/pdf';
  const chunkCount = doc.chunkCount || doc._count?.chunks || 0;

  const handleViewChunks = async () => {
    setLoadingChunks(true);
    try {
      const { data } = await getDocumentWithChunks(doc.id);
      onViewChunks(data as DocumentWithChunks);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDocument(doc.id);
      removeDocument(doc.id);
      setDeleteConfirmOpen(false);
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
      className="group rounded-xl flex flex-col gap-0 overflow-hidden transition-all"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Card body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* File icon + name */}
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: isPdf
                ? 'color-mix(in oklch, var(--danger) 12%, transparent)'
                : 'color-mix(in oklch, var(--accent) 12%, transparent)',
              color: isPdf ? 'var(--danger)' : 'var(--accent)',
            }}
          >
            {isPdf ? <FileType2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium leading-snug"
              style={{ color: 'var(--foreground)', wordBreak: 'break-all' }}
            >
              {doc.filename}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {formatSize(doc.size)} · {formatDate(doc.createdAt)}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              color: STATUS_COLOR[doc.status] ?? 'var(--muted)',
              backgroundColor: STATUS_BG[doc.status] ?? 'transparent',
            }}
          >
            {doc.status === 'processing' && (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            )}
            {STATUS_LABEL[doc.status] ?? doc.status}
          </span>
          {doc.status === 'done' && chunkCount > 0 && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {chunkCount} chunks
            </span>
          )}
        </div>
      </div>

      {/* Divider + action row */}
      <div
        className="flex items-center px-4 py-2 gap-1"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {/* View chunks button */}
        {doc.status === 'done' && (
          <button
            onClick={handleViewChunks}
            disabled={loadingChunks}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex-1"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--background)';
              (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--muted)';
            }}
          >
            {loadingChunks ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Layers className="w-3.5 h-3.5" />
            )}
            <span>查看分块</span>
          </button>
        )}

        {/* Process button */}
        {(doc.status === 'pending' || doc.status === 'error') && (
          <button
            onClick={handleProcess}
            disabled={processing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex-1"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--background)';
              (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--muted)';
            }}
          >
            {processing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            <span>开始解析</span>
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirmOpen(true);
          }}
          disabled={deleting}
          className="p-1.5 rounded-lg transition-colors cursor-pointer"
          style={{ color: 'var(--muted)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--danger)';
            (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in oklch, var(--danger) 10%, transparent)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--muted)';
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          {deleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => !deleting && setDeleteConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" style={{ color: 'var(--danger)' }} />
              确认删除文件
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription>
              确认删除文件 <span className="font-medium" style={{ color: 'var(--foreground)', wordBreak: 'break-all' }}>{doc.filename}</span>？此操作不可撤销。
            </DialogDescription>
          </DialogBody>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                color: 'var(--foreground)',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                color: 'var(--accent-foreground)',
                backgroundColor: 'var(--danger)',
              }}
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              确认删除
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
