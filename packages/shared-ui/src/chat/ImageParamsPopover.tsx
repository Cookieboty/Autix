'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

const ASPECT_RATIOS = [
  { labelKey: 'smartRatio', value: 'auto' },
  { label: '1:1', value: '1024x1024' },
  { label: '1:2', value: '1024x2048' },
  { label: '2:1', value: '2048x1024' },
  { label: '9:16', value: '1024x1792' },
  { label: '16:9', value: '1792x1024' },
  { label: '3:4', value: '768x1024' },
  { label: '4:3', value: '1024x768' },
  { label: '3:2', value: '1536x1024' },
  { label: '2:3', value: '1024x1536' },
  { label: '5:4', value: '1280x1024' },
  { label: '4:5', value: '1024x1280' },
] as const;

const QUALITY_OPTIONS = [
  { labelKey: 'qualityStandard', value: 'standard' },
  { labelKey: 'qualityHd', value: 'hd' },
] as const;

const COUNT_OPTIONS = [1, 2, 4] as const;

interface ImageParamsPopoverProps {
  size: string;
  quality: string;
  count: number;
  onSizeChange: (v: string) => void;
  onQualityChange: (v: string) => void;
  onCountChange: (v: number) => void;
}

export function ImageParamsPopover({
  size,
  quality,
  count,
  onSizeChange,
  onQualityChange,
  onCountChange,
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

  const sizeOption = ASPECT_RATIOS.find((r) => r.value === size);
  const sizeLabel = sizeOption
    ? ('labelKey' in sizeOption ? t(sizeOption.labelKey) : sizeOption.label)
    : size;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card ${open ? 'bg-card' : ''}`}
      >
        <span>{t('summary', { size: sizeLabel, count })}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-[320px] rounded-xl border border-border bg-popover p-4 shadow-lg">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-medium text-foreground">{t('quality')}</div>
              <div className="flex gap-2">
                {QUALITY_OPTIONS.map((opt) => (
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
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-foreground">{t('size')}</div>
              <div className="grid grid-cols-4 gap-1.5">
                {ASPECT_RATIOS.map((ratio) => (
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
                    {'labelKey' in ratio ? t(ratio.labelKey) : ratio.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-foreground">{t('count')}</div>
              <div className="flex gap-2">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onCountChange(n)}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs transition-colors ${
                      count === n
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {t('countOption', { count: n })}
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
