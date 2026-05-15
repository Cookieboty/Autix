'use client';

import { Plus, X, Link2 } from 'lucide-react';
import type { VideoClipMaterial } from '@autix/shared-store';
import { useVideoProjectStore } from '@autix/shared-store';

interface MaterialSlotProps {
  label: string;
  material: VideoClipMaterial | null;
  isChained?: boolean;
  onClick: () => void;
}

export function MaterialSlot({ label, material, isChained, onClick }: MaterialSlotProps) {
  const { removeMaterial } = useVideoProjectStore();

  if (isChained) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2 text-center min-h-[80px]">
        <Link2 className="size-4 text-primary mb-1" />
        <span className="text-[10px] text-primary">来自上一 Clip 尾帧</span>
      </div>
    );
  }

  if (material) {
    const isImage = material.role === 'first_frame' || material.role === 'reference_image';
    return (
      <div className="relative group rounded-lg border border-border overflow-hidden min-h-[80px]">
        {isImage ? (
          <img src={material.url} alt={material.name ?? label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-muted/30 p-2">
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">
              {material.name ?? label}
            </span>
          </div>
        )}
        <button
          type="button"
          className="absolute right-1 top-1 hidden group-hover:flex size-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); removeMaterial(material.id); }}
        >
          <X className="size-3" />
        </button>
        <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1.5 py-0.5">
          <span className="text-[9px] text-white">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-2 text-center min-h-[80px] hover:border-primary/40 hover:bg-accent transition-colors"
      onClick={onClick}
    >
      <Plus className="size-4 text-muted-foreground mb-1" />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </button>
  );
}
