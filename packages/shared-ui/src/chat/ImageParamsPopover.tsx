'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { buildImageSizeView, type ImageModelCapability } from '@autix/domain/image';

export interface ImageParamOption {
  label: string;
  value: string;
}

interface ImageParamsPopoverProps {
  size: string;
  quality: string;
  capability: ImageModelCapability;
  qualityOptions: ImageParamOption[];
  onSizeChange: (v: string) => void;
  onQualityChange: (v: string) => void;
}

export function ImageParamsPopover({
  size,
  quality,
  capability,
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

  // 与图片工作台共用同一套计算规则：按「分辨率档位 → 长宽比」分组，
  // 避免对话模式下把 Gemini 的几十个尺寸铺成一整片。样式各站点自定，规则同源。
  const sizeView = useMemo(() => buildImageSizeView(capability, size), [capability, size]);
  const { hasResolutionTiers, selectedTier, selectedAspect } = sizeView;
  const aspectOptions = selectedTier?.options ?? [];
  const sizeLabel = sizeView.displayLabel;

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

            {hasResolutionTiers && (
              <div>
                <div className="mb-2 text-xs font-medium text-foreground">{t('resolution')}</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {sizeView.groups.map((group) => (
                    <button
                      key={group.value}
                      type="button"
                      onClick={() => onSizeChange(sizeView.pickResolution(group.value))}
                      className={`rounded-lg px-2 py-2 text-xs transition-colors ${
                        selectedTier?.value === group.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-xs font-medium text-foreground">{t('size')}</div>
              <div className="grid grid-cols-4 gap-1.5">
                {aspectOptions.map((ratio) => (
                  <button
                    key={ratio.value}
                    type="button"
                    onClick={() => onSizeChange(ratio.value)}
                    className={`rounded-lg px-2 py-2 text-xs transition-colors ${
                      selectedAspect?.value === ratio.value
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
