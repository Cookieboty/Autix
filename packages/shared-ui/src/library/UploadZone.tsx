'use client';

import { useRef, useState } from 'react';
import { UploadCloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { uploadDocument, processDocument } from '@autix/shared-lib';
import { useDocumentStore } from '@autix/shared-store';
import type { DocumentItem } from '@autix/shared-store';

const ACCEPT = '.txt,.md,.pdf,.docx,.doc';
const MAX_MB = 10;

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function UploadZone() {
  const t = useTranslations('library');
  const { addDocument, uploading, setUploading } = useDocumentStore();
  const [dragOver, setDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastFilename, setLastFilename] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorMsg(t('fileTooLarge', { maxSize: MAX_MB }));
      setUploadState('error');
      setTimeout(() => setUploadState('idle'), 3000);
      return;
    }
    setErrorMsg('');
    setLastFilename(file.name);
    setUploadState('uploading');
    setUploading(true);
    try {
      const { data } = await uploadDocument(file);
      addDocument(data as DocumentItem);
      processDocument((data as DocumentItem).id).catch(() => {});
      setUploadState('success');
      setTimeout(() => setUploadState('idle'), 2500);
    } catch (e: any) {
      setErrorMsg(e?.msg || e?.response?.data?.msg || t('uploadFailedRetry'));
      setUploadState('error');
      setTimeout(() => setUploadState('idle'), 3000);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const isIdle = uploadState === 'idle';

  const borderClass =
    uploadState === 'error'
      ? 'border-destructive'
      : uploadState === 'success'
      ? 'border-success'
      : dragOver
      ? 'border-primary'
      : 'border-border';

  const iconWrapClass =
    uploadState === 'error'
      ? 'bg-destructive/10 text-destructive'
      : uploadState === 'success'
      ? 'bg-success/10 text-success'
      : dragOver
      ? 'bg-primary/15 text-primary'
      : 'bg-card text-muted-foreground';

  return (
    <div
      onClick={() => isIdle && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (isIdle) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`relative flex items-center gap-4 px-5 py-4 rounded-xl transition-all border-[1.5px] border-dashed ${borderClass} ${
        dragOver ? 'bg-primary/5' : 'bg-transparent'
      } ${isIdle ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${iconWrapClass}`}>
        {uploadState === 'uploading' && <Loader2 className="w-5 h-5 animate-spin" />}
        {uploadState === 'success' && <CheckCircle2 className="w-5 h-5" />}
        {uploadState === 'error' && <AlertCircle className="w-5 h-5" />}
        {isIdle && <UploadCloud className="w-5 h-5" />}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        {uploadState === 'uploading' && (
          <>
            <p className="text-sm font-medium text-foreground">
              {t('uploading')}
            </p>
            <p className="text-xs truncate mt-0.5 text-muted-foreground">
              {lastFilename}
            </p>
          </>
        )}
        {uploadState === 'success' && (
          <>
            <p className="text-sm font-medium text-success">
              {t('uploadSuccess')}
            </p>
            <p className="text-xs truncate mt-0.5 text-muted-foreground">
              {t('parsingInBackground', { filename: lastFilename })}
            </p>
          </>
        )}
        {uploadState === 'error' && (
          <>
            <p className="text-sm font-medium text-destructive">
              {t('uploadFailedTitle')}
            </p>
            <p className="text-xs mt-0.5 text-muted-foreground">
              {errorMsg}
            </p>
          </>
        )}
        {isIdle && (
          <>
            <p className="text-sm text-foreground">
              {t.rich('dragOrClick', {
                click: (chunks) => <span className="text-primary">{chunks}</span>,
              })}
            </p>
            <p className="text-xs mt-0.5 text-muted-foreground">
              {t('supportedFormats', { maxSize: MAX_MB })}
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { handleFile(file); e.target.value = ''; }
        }}
      />
    </div>
  );
}
