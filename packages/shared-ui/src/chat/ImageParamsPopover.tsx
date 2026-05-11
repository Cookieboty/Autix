'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ASPECT_RATIOS = [
  { label: '智能比例', value: 'auto' },
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
  { label: '标准画质', value: 'standard' },
  { label: '高画质', value: 'hd' },
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const sizeLabel = ASPECT_RATIOS.find((r) => r.value === size)?.label ?? size;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card ${open ? 'bg-card' : ''}`}
      >
        <span>{sizeLabel} · {count}张</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-[320px] rounded-xl border border-border bg-popover p-4 shadow-lg">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-medium text-foreground">图像质量</div>
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
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-foreground">图片尺寸</div>
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
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-foreground">生成数量</div>
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
                    {n} 张
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
