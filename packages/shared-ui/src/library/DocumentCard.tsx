'use client';

import { useState } from 'react';
import { FileText, FileType2, Trash2, Loader2, Zap, Layers, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useTranslations } from 'next-intl';
import { getDocumentWithChunks, deleteDocument, processDocument } from '@autix/shared-lib';
import { useDocumentStore } from '@autix/shared-store';
import type { DocumentItem, DocumentWithChunks } from '@autix/shared-store';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN');
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'statusPending',
  processing: 'statusProcessing',
  done: 'statusDone',
  error: 'statusError',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: 'bg-transparent text-muted-foreground',
  processing: 'bg-primary/10 text-primary',
  done: 'bg-success/10 text-success',
  error: 'bg-destructive/10 text-destructive',
};

interface DocumentCardProps {
  doc: DocumentItem;
  onViewChunks: (doc: DocumentWithChunks) => void;
}

export function DocumentCard({ doc, onViewChunks }: DocumentCardProps) {
  const t = useTranslations('library');
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
    <div className="group rounded-xl flex flex-col gap-0 overflow-hidden transition-all bg-card border border-border">
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isPdf
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {isPdf ? <FileType2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug text-foreground break-all">
              {doc.filename}
            </p>
            <p className="text-xs mt-0.5 text-muted-foreground">
              {formatSize(doc.size)} · {formatDate(doc.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={`text-xs ${STATUS_BADGE_CLASS[doc.status] ?? 'bg-transparent text-muted-foreground'}`}
          >
            {doc.status === 'processing' && <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />}
            {STATUS_LABEL_KEYS[doc.status] ? t(STATUS_LABEL_KEYS[doc.status]) : doc.status}
          </Badge>
          {doc.status === 'done' && chunkCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {t('chunkCount', { count: chunkCount })}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center px-4 py-2 gap-1 border-t border-border">
        {doc.status === 'done' && (
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 cursor-pointer text-xs h-8"
            disabled={loadingChunks}
            onClick={handleViewChunks}
          >
            <Layers className="w-3.5 h-3.5 mr-1" />
            {t('viewChunks')}
          </Button>
        )}

        {(doc.status === 'pending' || doc.status === 'error') && (
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 cursor-pointer text-xs h-8"
            disabled={processing}
            onClick={handleProcess}
          >
            <Zap className="w-3.5 h-3.5 mr-1" />
            {t('startParsing')}
          </Button>
        )}

        <div className="flex-1" />

        <Button
          size="sm"
          variant="ghost"
          disabled={deleting}
          aria-label={t('deleteDocument')}
          className="cursor-pointer p-0 min-w-8 h-8"
          onClick={() => setDeleteConfirmOpen(true)}
        >
          {deleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </Button>
      </div>

      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => !deleting && setDeleteConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {t('confirmDeleteFile')}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              {t.rich('confirmDeleteFileMsg', {
                filename: doc.filename,
                bold: (chunks) => <span className="font-medium text-foreground break-all">{chunks}</span>,
              })}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t('confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
