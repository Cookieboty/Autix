'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface ImageParamOption {
  label: string;
  value: string;
}

interface ImageParamsPopoverProps {
  size: string;
  quality: string;
  sizeOptions: ImageParamOption[];
  qualityOptions: ImageParamOption[];
  onSizeChange: (v: string) => void;
  onQualityChange: (v: string) => void;
}

export function ImageParamsPopover({
  size,
  quality,
  sizeOptions,
  qualityOptions,
  onSizeChange,
  onQualityChange,
}: ImageParamsPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations('chat.imageParams');

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const sizeLabel = sizeOptions.find((r) => r.value === size)?.label ?? size;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card ${open ? 'bg-card' : ''}`}
      >
        <span>{t('summary', { size: sizeLabel })}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-[320px] rounded-xl border border-border bg-popover p-4 shadow-lg">
          <div className="space-y-4">
            {qualityOptions.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium text-foreground">{t('quality')}</div>
                <div className="flex gap-2">
                  {qualityOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onQualityChange(opt.value)}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs transition-colors ${
                        quality === opt.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-xs font-medium text-foreground">{t('size')}</div>
              <div className="grid grid-cols-4 gap-1.5">
                {sizeOptions.map((ratio) => (
                  <button
                    key={ratio.value}
                    type="button"
                    onClick={() => onSizeChange(ratio.value)}
                    className={`rounded-lg px-2 py-2 text-xs transition-colors ${
                      size === ratio.value
                        ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
