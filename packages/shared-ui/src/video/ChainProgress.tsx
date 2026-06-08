'use client';

import { CheckCircle2, Loader2, Clock } from 'lucide-react';
import type { VideoClip } from '@autix/shared-store';
import { Button } from '../ui/button';

interface ChainProgressProps {
  clips: VideoClip[];
  generatingClipIds: string[];
  onCancel?: () => void;
}

export function ChainProgress({ clips, generatingClipIds, onCancel }: ChainProgressProps) {
  if (generatingClipIds.length === 0) return null;

  const completedCount = clips.filter((c) => c.status === 'completed').length;
  const total = clips.length;
  const progressPercent = total > 0 ? (completedCount / total) * 100 : 0;

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">链式生成进度</h4>
        {onCancel && (
          <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={onCancel}>
            取消剩余
          </Button>
        )}
      </div>

      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="space-y-1">
        {clips.map((clip, idx) => {
          const isGenerating = generatingClipIds.includes(clip.id);
          const isCompleted = clip.status === 'completed';
          return (
            <div key={clip.id} className="flex items-center gap-2 text-xs">
              {isCompleted ? (
                <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
              ) : isGenerating ? (
                <Loader2 className="size-3.5 animate-spin text-foreground shrink-0" />
              ) : (
                <Clock className="size-3.5 text-muted-foreground shrink-0" />
              )}
              <span className={isGenerating ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                {clip.title || `Clip ${idx + 1}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
