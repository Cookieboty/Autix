import { Loader2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VideoClip } from '@autix/shared-store';
import { Button } from '../../../ui/button';
import { VideoPreview } from '../../VideoPreview';

export function VideoProductPanel({
  selectedClip,
  clips,
  generatingClipIds,
  isGenerating,
  onAddSelectedVideoToMaterial,
}: {
  selectedClip: VideoClip | null;
  clips: VideoClip[];
  generatingClipIds: string[];
  isGenerating: boolean;
  onAddSelectedVideoToMaterial: () => void;
}) {
  const t = useTranslations('videoWorkbench.productPanel');
  const previewClip =
    clips.find((clip) => generatingClipIds.includes(clip.id)) ??
    selectedClip;
  const selectedHasVideo = Boolean(
    previewClip?.generations?.some((generation) => generation.status === 'completed' && generation.videoUrl),
  );

  if (!selectedHasVideo && !isGenerating) {
    return null;
  }

  return (
    <section className="flex min-h-[360px] flex-col rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t('title')}</h2>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isGenerating && (
            <div className="inline-flex h-8 items-center gap-2 rounded-md bg-primary/10 px-2.5 text-xs text-primary">
              <Loader2 className="size-3.5 animate-spin" />
              {t('generating')}
            </div>
          )}
          {selectedHasVideo && (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onAddSelectedVideoToMaterial}>
              <Upload className="size-3.5" />
              {t('addToLibrary')}
            </Button>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <VideoPreview clip={previewClip} forceGenerating={isGenerating} />
      </div>
    </section>
  );
}
