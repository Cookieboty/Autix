'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Check, Download, ExternalLink, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface PreviewImageSource {
  url: string;
  alt?: string;
}

function filenameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('/').filter(Boolean).pop() || 'image.png';
  } catch {
    return 'image.png';
  }
}

function ImagePreviewOverlay({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const tp = useTranslations('chat.preview');
  const fileName = filenameFromUrl(src);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const copyLink = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(src)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {
        /* no-op */
      });
  };

  return (
    <div
      className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[94vh] w-full max-w-6xl flex-col gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs text-white backdrop-blur transition-colors hover:bg-white/20"
            onClick={copyLink}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? tp('linkCopied') : tp('copyLink')}
          </button>
          <a
            href={src}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <Download className="h-3.5 w-3.5" />
            {tp('download')}
          </a>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {tp('openOriginal')}
          </a>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur transition-colors hover:bg-white/20"
            onClick={onClose}
            aria-label={tp('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black/35 p-2">
          <img
            src={src}
            alt={alt ?? ''}
            className="max-h-[85vh] max-w-[92vw] object-contain"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 命令式 hook：由外部触发 openPreview(src)，返回需要渲染的 portal 元素。
 * 所有使用方共用同一份 overlay 代码与样式，保证 UX 一致。
 */
export function useImagePreview() {
  const [current, setCurrent] = useState<PreviewImageSource | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openPreview = useCallback((src: string, alt?: string) => {
    if (!src) return;
    setCurrent({ url: src, alt });
  }, []);

  const closePreview = useCallback(() => {
    setCurrent(null);
  }, []);

  const element =
    mounted && current
      ? createPortal(
          <ImagePreviewOverlay
            src={current.url}
            alt={current.alt}
            onClose={closePreview}
          />,
          document.body,
        )
      : null;

  return { openPreview, closePreview, element, isOpen: Boolean(current) };
}
