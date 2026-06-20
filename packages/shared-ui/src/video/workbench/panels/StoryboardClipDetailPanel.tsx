'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VideoClip } from '@autix/shared-store';
import { cn } from '../../../ui/utils';
import { MaterialSlot } from '../../MaterialSlot';
import type { VideoMaterialTarget } from '../constants';
import { ImeSafeInput, ImeSafeTextarea } from '../shared/ImeSafeControls';

export function StoryboardClipDetailPanel({
  clip,
  open,
  promptSummary,
  materialCount,
  imageSlots,
  onToggle,
  onTitleChange,
  onPromptChange,
  onOpenPicker,
}: {
  clip: VideoClip;
  open: boolean;
  promptSummary: string;
  materialCount: number;
  imageSlots: Array<{ role: VideoMaterialTarget; label: string }>;
  onToggle: () => void;
  onTitleChange: (clip: VideoClip, title: string) => void;
  onPromptChange: (clip: VideoClip, prompt: string) => void;
  onOpenPicker: (role: VideoMaterialTarget, clipId?: string | null) => void;
}) {
  const t = useTranslations('videoWorkbench.configPanel');

  return (
    <div className="mt-3 rounded-lg border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-accent"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="min-w-0">
          <span className="block text-xs font-medium">{t('storyboard.detail.title')}</span>
          <span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-muted-foreground">
            {t('storyboard.detail.promptSummary', { prompt: promptSummary })}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {clip.title || t('clipDefaultTitle', { order: clip.order })} · {materialCount > 0
              ? t('storyboard.detail.materialCount', { count: materialCount })
              : t('storyboard.detail.noMaterials')}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border p-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t('storyboard.detail.titleLabel')}</span>
            <ImeSafeInput
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary"
              value={clip.title ?? t('clipDefaultTitle', { order: clip.order })}
              onValueChange={(value) => onTitleChange(clip, value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t('storyboard.detail.promptLabel')}</span>
            <ImeSafeTextarea
              className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
              placeholder={t('storyboard.detail.promptInputPlaceholder')}
              value={clip.prompt ?? ''}
              onValueChange={(value) => onPromptChange(clip, value)}
            />
          </label>
          <div className="space-y-2">
            <div>
              <h3 className="text-xs font-medium">{t('storyboard.detail.imagesTitle')}</h3>
              <p className="text-[11px] text-muted-foreground">
                {t('storyboard.detail.imagesDescription')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {imageSlots.map((slot) => (
                <MaterialSlot
                  key={slot.role}
                  label={slot.label}
                  material={clip.materials.find((material) => material.role === slot.role) ?? null}
                  isChained={slot.role === 'first_frame' && clip.chainFromPrev}
                  onClick={() => onOpenPicker(slot.role, clip.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
