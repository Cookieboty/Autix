'use client';

import { useRef, useState } from 'react';
import { UploadCloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadDocument, processDocument } from '@/lib/api';
import { useDocumentStore } from '@/store/document.store';
import type { DocumentItem } from '@/store/document.store';

const ACCEPT = '.txt,.md,.pdf,.docx,.doc';
const MAX_MB = 10;

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function UploadZone() {
  const { addDocument, uploading, setUploading } = useDocumentStore();
  const [dragOver, setDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastFilename, setLastFilename] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorMsg(`文件过大，最大支持 ${MAX_MB}MB`);
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
      setErrorMsg(e?.msg || e?.response?.data?.msg || '上传失败，请重试');
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

  return (
    <div
      onClick={() => isIdle && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (isIdle) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className="relative flex items-center gap-4 px-5 py-4 rounded-xl transition-all"
      style={{
        border: `1.5px dashed ${
          uploadState === 'error'
            ? 'var(--danger)'
            : uploadState === 'success'
            ? 'var(--success)'
            : dragOver
            ? 'var(--accent)'
            : 'var(--border)'
        }`,
        backgroundColor: dragOver
          ? 'color-mix(in oklch, var(--accent) 6%, transparent)'
          : 'transparent',
        cursor: isIdle ? 'pointer' : 'default',
      }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
        style={{
          backgroundColor:
            uploadState === 'error'
              ? 'color-mix(in oklch, var(--danger) 12%, transparent)'
              : uploadState === 'success'
              ? 'color-mix(in oklch, var(--success) 12%, transparent)'
              : dragOver
              ? 'color-mix(in oklch, var(--accent) 15%, transparent)'
              : 'var(--surface)',
          color:
            uploadState === 'error'
              ? 'var(--danger)'
              : uploadState === 'success'
              ? 'var(--success)'
              : dragOver
              ? 'var(--accent)'
              : 'var(--muted)',
        }}
      >
        {uploadState === 'uploading' && <Loader2 className="w-5 h-5 animate-spin" />}
        {uploadState === 'success' && <CheckCircle2 className="w-5 h-5" />}
        {uploadState === 'error' && <AlertCircle className="w-5 h-5" />}
        {isIdle && <UploadCloud className="w-5 h-5" />}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        {uploadState === 'uploading' && (
          <>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              上传中...
            </p>
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>
              {lastFilename}
            </p>
          </>
        )}
        {uploadState === 'success' && (
          <>
            <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>
              上传成功
            </p>
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>
              {lastFilename} · 正在后台解析...
            </p>
          </>
        )}
        {uploadState === 'error' && (
          <>
            <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
              上传失败
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {errorMsg}
            </p>
          </>
        )}
        {isIdle && (
          <>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>
              拖拽文件至此，或{' '}
              <span style={{ color: 'var(--accent)' }}>点击选择</span>
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              支持 .txt .md .pdf .docx .doc（最大 {MAX_MB}MB）
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
