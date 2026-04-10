'use client';

import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { uploadDocument, processDocument } from '@/lib/api';
import { useDocumentStore } from '@/store/document.store';
import type { DocumentItem } from '@/store/document.store';

export function UploadZone() {
  const { addDocument, uploading, setUploading } = useDocumentStore();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const { data } = await uploadDocument(file);
      addDocument(data as DocumentItem);
      // 上传后自动触发 process（不阻塞）
      processDocument((data as DocumentItem).id).catch(() => {});
    } catch (e: any) {
      setError(e?.msg || e?.response?.data?.msg || '上传失败，请重试');
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

  return (
    <div>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className="flex flex-col items-center justify-center gap-2 p-8 rounded-xl cursor-pointer transition-colors"
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          backgroundColor: dragOver ? 'var(--surface)' : 'transparent',
          color: 'var(--muted)',
        }}
      >
        {uploading ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
            <span className="text-sm">上传中...</span>
          </>
        ) : (
          <>
            <Upload className="w-6 h-6" />
            <span className="text-sm">
              拖拽文件至此或{' '}
              <span style={{ color: 'var(--accent)' }}>点击选择</span>
            </span>
            <span className="text-xs">支持 .txt .md .pdf .docx .doc（最大 10MB）</span>
          </>
        )}
      </div>
      {error && (
        <p className="text-xs mt-2 text-center" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.md,.pdf,.docx,.doc"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { handleFile(file); e.target.value = ''; }
        }}
      />
    </div>
  );
}
