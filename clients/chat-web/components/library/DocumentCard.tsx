'use client';

import { useState } from 'react';
import { FileText, FileType2, Trash2, Loader2, Zap, Layers, AlertTriangle } from 'lucide-react';
import { Modal, ModalBackdrop, ModalDialog, ModalHeader, ModalHeading, ModalBody, ModalFooter, Button, Chip } from '@heroui/react';
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
      const chunks = data.chunks ?? data.document_chunks ?? [];
      onViewChunks({ ...data, chunks } as DocumentWithChunks);
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
          <Chip
            size="sm"
            variant="soft"
            style={{
              backgroundColor: STATUS_BG[doc.status] ?? 'transparent',
              color: STATUS_COLOR[doc.status] ?? 'var(--muted)',
            }}
          >
            {doc.status === 'processing' && <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />}
            {STATUS_LABEL[doc.status] ?? doc.status}
          </Chip>
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
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 cursor-pointer text-xs h-8"
            {...({ isLoading: loadingChunks } as any)}
            onPress={handleViewChunks}
          >
            <Layers className="w-3.5 h-3.5 mr-1" />
            查看分块
          </Button>
        )}

        {/* Process button */}
        {(doc.status === 'pending' || doc.status === 'error') && (
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 cursor-pointer text-xs h-8"
            {...({ isLoading: processing } as any)}
            onPress={handleProcess}
          >
            <Zap className="w-3.5 h-3.5 mr-1" />
            开始解析
          </Button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Delete */}
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          isDisabled={deleting}
          aria-label="删除文档"
          className="cursor-pointer min-w-8 h-8"
          onPress={() => setDeleteConfirmOpen(true)}
        >
          {deleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
          )}
        </Button>
      </div>

      <Modal isOpen={deleteConfirmOpen} onOpenChange={(open) => !deleting && setDeleteConfirmOpen(open)}>
        <ModalBackdrop>
          <ModalDialog>
            <ModalHeader>
              <ModalHeading className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-danger" />
                确认删除文件
              </ModalHeading>
            </ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-600">
                确认删除文件 <span className="font-medium text-foreground break-all">{doc.filename}</span>？此操作不可撤销。
              </p>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="ghost"
                onPress={() => setDeleteConfirmOpen(false)}
                isDisabled={deleting}
              >
                取消
              </Button>
              <Button
                variant="danger"
                onPress={handleDelete}
                isDisabled={deleting}
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                确认删除
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
