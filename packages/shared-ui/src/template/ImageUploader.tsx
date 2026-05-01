'use client';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { storageApi } from '@autix/shared-lib';

export function ImageUploader({
  value,
  onChange,
  folder = 'references',
  label,
}: {
  value?: string;
  onChange: (url: string | undefined) => void;
  folder?: string;
  label?: string;
}) {
  const t = useTranslations('imageUploader');
  const resolvedLabel = label ?? t('defaultLabel');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const presignRes = await storageApi.presign({
        fileName: file.name,
        contentType: file.type,
        folder,
      });
      const { uploadUrl, publicUrl } = presignRes.data as any;
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      onChange(publicUrl);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative">
      {value ? (
        <div className="relative rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <img src={value} alt="" className="w-full h-32 object-cover" />
          <button
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--panel)', color: 'var(--foreground)' }}
            onClick={() => onChange(undefined)}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-2 h-28 rounded-lg cursor-pointer"
          style={{ border: '2px dashed var(--border)', backgroundColor: 'var(--panel-muted)' }}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <Upload className="w-5 h-5" style={{ color: 'var(--muted)' }} />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {uploading ? t('uploading') : resolvedLabel}
          </span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}
