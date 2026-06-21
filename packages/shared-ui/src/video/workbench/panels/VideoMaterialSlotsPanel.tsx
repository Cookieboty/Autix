'use client';

import { ArrowLeftRight, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useVideoProjectStore, type VideoClip, type VideoClipMaterial } from '@autix/shared-store';
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
  const { removeMaterial } = useVideoProjectStore();

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
          {materialSlots.map((slot) => {
            if (mode === 'standard' && slot.role === 'reference_image') {
              const referenceImages = selectedClip.materials.filter(
                (material) => material.role === 'reference_image',
              );
              return (
                <ReferenceImagesGroup
                  key={slot.role}
                  label={slot.label}
                  materials={referenceImages}
                  onAdd={() => onOpenPicker(slot.role)}
                  onRemove={(materialId) => {
                    void removeMaterial(materialId);
                  }}
                />
              );
            }
            return (
              <MaterialSlot
                key={slot.role}
                label={slot.label}
                material={selectedClip.materials.find((material) => material.role === slot.role) ?? null}
                isChained={slot.role === 'first_frame' && selectedClip.chainFromPrev}
                onClick={() => onOpenPicker(slot.role)}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-8 text-center text-xs text-muted-foreground">
          {t('materials.preparingSlots')}
        </div>
      )}
    </div>
  );
}

function ReferenceImagesGroup({
  label,
  materials,
  onAdd,
  onRemove,
}: {
  label: string;
  materials: VideoClipMaterial[];
  onAdd: () => void;
  onRemove: (materialId: string) => void;
}) {
  if (materials.length === 0) {
    return (
      <button
        type="button"
        className="flex min-h-[80px] flex-col items-center justify-center rounded-lg border border-dashed border-border p-2 text-center transition-colors hover:border-primary/40 hover:bg-accent"
        onClick={onAdd}
      >
        <Plus className="mb-1 size-4 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-muted/10 p-1.5">
      <div className="grid grid-cols-3 gap-1.5">
        {materials.map((material) => (
          <div
            key={material.id}
            className="group relative min-h-[60px] overflow-hidden rounded-md border border-border"
          >
            <img
              src={material.url}
              alt={material.name ?? label}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              className="absolute right-0.5 top-0.5 hidden size-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-destructive group-hover:flex"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(material.id);
              }}
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="flex min-h-[60px] flex-col items-center justify-center rounded-md border border-dashed border-border p-1 text-center transition-colors hover:border-primary/40 hover:bg-accent"
          onClick={onAdd}
          aria-label={label}
        >
          <Plus className="size-4 text-muted-foreground" />
        </button>
      </div>
      <div className="mt-1 px-1 text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
