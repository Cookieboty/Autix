'use client';

import type { VideoClip } from '@autix/shared-store';
import { VideoPlayer } from './VideoPlayer';

interface VideoPreviewProps {
  clip: VideoClip | null;
}

export function VideoPreview({ clip }: VideoPreviewProps) {
  if (!clip) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
        <p className="text-sm text-muted-foreground">选择一个 Clip 查看预览</p>
      </div>
    );
  }

  const latestGeneration = clip.generations
    .filter((g) => g.status === 'completed' && g.videoUrl)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const generatingGen = clip.generations.find(
    (g) => g.status === 'queued' || g.status === 'running' || g.status === 'pending',
  );

  const failedGen = clip.generations.find((g) => g.status === 'failed');

  if (generatingGen) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-lg border border-border bg-muted/30 gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          {generatingGen.externalStatus === 'queued' ? '排队中...' : '视频生成中...'}
        </p>
      </div>
    );
  }

  if (latestGeneration?.videoUrl) {
    return (
      <VideoPlayer
        src={latestGeneration.videoUrl}
        poster={latestGeneration.thumbnailUrl ?? undefined}
        className="w-full rounded-lg"
      />
    );
  }

  if (failedGen) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 gap-2">
        <p className="text-sm text-destructive">生成失败</p>
        <p className="text-xs text-muted-foreground max-w-xs text-center">{failedGen.error}</p>
      </div>
    );
  }

  const firstFrameMaterial = clip.materials.find((m) => m.role === 'first_frame');
  if (firstFrameMaterial) {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden border border-border">
        <img src={firstFrameMaterial.url} alt="首帧" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
      <p className="text-sm text-muted-foreground">添加素材或提示词后开始生成</p>
    </div>
  );
}
