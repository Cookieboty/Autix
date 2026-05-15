'use client';

import { Play, Check } from 'lucide-react';
import type { VideoClipGeneration } from '@autix/shared-store';
import { Button } from '../ui/button';

interface VariantGridProps {
  generations: VideoClipGeneration[];
  onSelect: (generationId: string) => void;
  onGenerateNew: () => void;
  primaryId?: string;
}

export function VariantGrid({ generations, onSelect, onGenerateNew, primaryId }: VariantGridProps) {
  const completed = generations.filter((g) => g.status === 'completed' && g.videoUrl);

  if (completed.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">生成 Variant ({completed.length})</h4>
        <Button variant="outline" size="sm" className="text-xs" onClick={onGenerateNew}>
          + 生成新 Variant
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {completed.map((gen) => (
          <div
            key={gen.id}
            className={`relative group rounded-lg border overflow-hidden ${
              gen.id === primaryId ? 'border-primary ring-1 ring-primary/20' : 'border-border'
            }`}
          >
            <div className="aspect-video bg-muted relative">
              {gen.thumbnailUrl ? (
                <img src={gen.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Play className="size-6 text-muted-foreground" />
                </div>
              )}
              {gen.id === primaryId && (
                <div className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </div>
              )}
            </div>
            <div className="p-2 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {gen.variantLabel ?? `#${gen.id.slice(0, 6)}`}
              </span>
              {gen.id !== primaryId && (
                <button
                  type="button"
                  className="text-[10px] text-primary hover:underline"
                  onClick={() => onSelect(gen.id)}
                >
                  选为主
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
