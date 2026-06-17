import { Loader2, Upload } from 'lucide-react';
import type { VideoClip } from '@autix/shared-store';
import { Button } from '../../../ui/button';
import { VideoPreview } from '../../VideoPreview';

export function VideoProductPanel({
  selectedClip,
  isGenerating,
  onAddSelectedVideoToMaterial,
}: {
  selectedClip: VideoClip | null;
  isGenerating: boolean;
  onAddSelectedVideoToMaterial: () => void;
}) {
  const selectedHasVideo = Boolean(
    selectedClip?.generations?.some((generation) => generation.status === 'completed' && generation.videoUrl),
  );

  if (!selectedHasVideo && !isGenerating) {
    return null;
  }

  return (
    <section className="flex min-h-[360px] flex-col rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">视频产物</h2>
          <p className="text-xs text-muted-foreground">当前视频预览和生成状态会在这里显示</p>
        </div>
        <div className="flex items-center gap-2">
          {isGenerating && (
            <div className="inline-flex h-8 items-center gap-2 rounded-md bg-primary/10 px-2.5 text-xs text-primary">
              <Loader2 className="size-3.5 animate-spin" />
              生成中
            </div>
          )}
          {selectedHasVideo && (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onAddSelectedVideoToMaterial}>
              <Upload className="size-3.5" />
              加入素材库
            </Button>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <VideoPreview clip={selectedClip} />
      </div>
    </section>
  );
}
