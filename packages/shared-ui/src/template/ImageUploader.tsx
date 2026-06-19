'use client';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { uploadFileToStorage } from '@autix/shared-store';

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
      const { publicUrl } = await uploadFileToStorage(file, {
        folder,
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
        <div className="relative rounded-lg overflow-hidden border border-border">
          <img src={value} alt="" className="w-full h-32 object-cover" />
          <button
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-card text-foreground"
            onClick={() => onChange(undefined)}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-2 h-28 rounded-lg cursor-pointer border-2 border-dashed border-border bg-secondary"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <Upload className="w-5 h-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
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
