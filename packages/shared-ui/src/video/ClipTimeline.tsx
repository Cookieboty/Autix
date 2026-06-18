'use client';

import { Plus, ArrowRight, CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VideoClip } from '@autix/shared-store';
import { useVideoProjectStore } from '@autix/shared-store';
import { Button } from '../ui/button';

interface ClipTimelineProps {
  clips: VideoClip[];
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
}

function ClipStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-3.5 text-green-500" />;
    case 'generating':
      return <Loader2 className="size-3.5 animate-spin text-foreground" />;
    case 'failed':
      return <AlertCircle className="size-3.5 text-destructive" />;
    default:
      return <Clock className="size-3.5 text-muted-foreground" />;
  }
}

export function ClipTimeline({ clips, selectedClipId, onSelectClip }: ClipTimelineProps) {
  const t = useTranslations('videoWorkbench.legacy.clipTimeline');
  const { addClip } = useVideoProjectStore();

  const handleAddClip = async () => {
    await addClip({ params: {}, chainFromPrev: clips.length > 0 });
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2 px-1">
      {clips.map((clip, idx) => (
        <div key={clip.id} className="flex items-center shrink-0">
          {idx > 0 && clip.chainFromPrev && (
            <ArrowRight className="size-4 text-muted-foreground mx-1 shrink-0" />
          )}
          {idx > 0 && !clip.chainFromPrev && (
            <div className="w-2 shrink-0" />
          )}
          <button
            type="button"
            className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors min-w-[120px] ${
              selectedClipId === clip.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border hover:border-primary/40 hover:bg-accent'
            }`}
            onClick={() => onSelectClip(clip.id)}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-xs font-medium truncate">
                {clip.title || `Clip ${idx + 1}`}
              </span>
              <ClipStatusIcon status={clip.status} />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {(clip.params as any)?.duration ? `${(clip.params as any).duration}s` : '5s'}
            </span>
          </button>
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 ml-1 gap-1 text-xs"
        onClick={handleAddClip}
      >
        <Plus className="size-3.5" />
        {t('addClip')}
      </Button>
    </div>
  );
}
