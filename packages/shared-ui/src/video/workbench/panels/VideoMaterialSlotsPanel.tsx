'use client';

import { ArrowLeftRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VideoClip } from '@autix/shared-store';
import { Button } from '../../../ui/button';
import { MaterialSlot } from '../../MaterialSlot';
import type { VideoMaterialTarget, VideoWorkspaceMode } from '../constants';

export function VideoMaterialSlotsPanel({
  mode,
  selectedClip,
  materialSlots,
  onOpenPicker,
  onSwapFirstLastFrame,
}: {
  mode: VideoWorkspaceMode;
  selectedClip: VideoClip | null;
  materialSlots: Array<{ role: VideoMaterialTarget; label: string }>;
  onOpenPicker: (role: VideoMaterialTarget) => void;
  onSwapFirstLastFrame: () => void;
}) {
  const t = useTranslations('videoWorkbench.configPanel');

  return (
    <div className="mb-4 rounded-lg border border-border bg-background p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium">
            {mode === 'first_last_frame' ? t('materials.firstLastTitle') : t('materials.referenceTitle')}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {mode === 'first_last_frame'
              ? t('materials.firstLastDescription')
              : t('materials.referenceDescription')}
          </p>
        </div>
        {mode === 'first_last_frame' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onSwapFirstLastFrame}
            disabled={!selectedClip}
          >
            <ArrowLeftRight className="size-3" />
            {t('materials.swapFrames')}
          </Button>
        )}
      </div>
      {selectedClip ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {materialSlots.map((slot) => (
            <MaterialSlot
              key={slot.role}
              label={slot.label}
              material={selectedClip.materials.find((material) => material.role === slot.role) ?? null}
              isChained={slot.role === 'first_frame' && selectedClip.chainFromPrev}
              onClick={() => onOpenPicker(slot.role)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-8 text-center text-xs text-muted-foreground">
          {t('materials.preparingSlots')}
        </div>
      )}
    </div>
  );
}
