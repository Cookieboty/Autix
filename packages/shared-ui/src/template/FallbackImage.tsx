'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FallbackImageProps {
  src?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  fallbackText?: string;
}

export function FallbackImage({ src, alt, className, style, fallbackText }: FallbackImageProps) {
  const t = useTranslations('template');
  const resolvedFallback = fallbackText ?? t('noImage');
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-secondary border border-border ${className ?? ''}`}
        style={style}
      >
        <ImageOff className="w-6 h-6 text-muted-foreground/50" />
        <span className="text-[11px] text-muted-foreground/60">
          {resolvedFallback}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
