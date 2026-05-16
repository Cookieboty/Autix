'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Lock } from 'lucide-react';
import type { VideoClip } from '@autix/shared-store';
import { useVideoProjectStore } from '@autix/shared-store';
import { Button } from '../ui/button';
import { MaterialSlot } from './MaterialSlot';
import { MaterialPicker } from './MaterialPicker';
import { VideoModelSelector } from './VideoModelSelector';

interface ClipEditorProps {
  clip: VideoClip | null;
  projectId: string;
}

const MATERIAL_SLOTS = [
  { role: 'first_frame', label: '首帧图片' },
  { role: 'reference_image', label: '风格参考' },
  { role: 'reference_video', label: '参考视频' },
  { role: 'reference_audio', label: '背景音频' },
] as const;

export function ClipEditor({ clip, projectId }: ClipEditorProps) {
  const { updateClip, generateClip, generatingClipIds } = useVideoProjectStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRole, setPickerRole] = useState<string>('first_frame');

  const isGenerating = clip ? generatingClipIds.includes(clip.id) : false;
  const isFailed = clip?.status === 'failed';

  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!clip) return;
      updateClip(clip.id, { prompt: e.target.value });
    },
    [clip, updateClip],
  );

  const handleParamChange = useCallback(
    (key: string, value: unknown) => {
      if (!clip) return;
      updateClip(clip.id, { params: { ...clip.params, [key]: value } });
    },
    [clip, updateClip],
  );

  const handleGenerate = useCallback(() => {
    if (!clip) return;
    generateClip(clip.id);
  }, [clip, generateClip]);

  const openPicker = (role: string) => {
    setPickerRole(role);
    setPickerOpen(true);
  };

  if (!clip) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        选择一个 Clip 进行编辑
      </div>
    );
  }

  const canGenerate = !!(clip.prompt || clip.materials.some((m) => m.role === 'first_frame'));

  return (
    <div className="relative rounded-lg border border-border p-4 space-y-4">
      {isGenerating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" />
            生成中，请等待...
          </div>
        </div>
      )}

      {isFailed && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          生成失败 — 可修改参数后重新生成
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MATERIAL_SLOTS.map((slot) => {
          const material = clip.materials.find((m) => m.role === slot.role);
          const isChainedFirstFrame = slot.role === 'first_frame' && clip.chainFromPrev;
          return (
            <MaterialSlot
              key={slot.role}
              label={slot.label}
              material={material ?? null}
              isChained={isChainedFirstFrame}
              onClick={() => openPicker(slot.role)}
            />
          );
        })}
      </div>

      <textarea
        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        rows={3}
        placeholder="输入视频描述提示词..."
        value={clip.prompt ?? ''}
        onChange={handlePromptChange}
        disabled={isGenerating}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">时长</span>
          <select
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            value={(clip.params as any)?.duration ?? 5}
            onChange={(e) => handleParamChange('duration', Number(e.target.value))}
            disabled={isGenerating}
          >
            {[4, 5, 6, 7, 8, 9, 10, 11, 12, 15].map((d) => (
              <option key={d} value={d}>{d}s</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">分辨率</span>
          <select
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            value={(clip.params as any)?.resolution ?? '720p'}
            onChange={(e) => handleParamChange('resolution', e.target.value)}
            disabled={isGenerating}
          >
            <option value="480p">480p</option>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">比例</span>
          <select
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            value={(clip.params as any)?.ratio ?? '16:9'}
            onChange={(e) => handleParamChange('ratio', e.target.value)}
            disabled={isGenerating}
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="4:3">4:3</option>
            <option value="3:4">3:4</option>
            <option value="1:1">1:1</option>
            <option value="21:9">21:9</option>
            <option value="adaptive">自适应</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">音频</span>
          <select
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            value={(clip.params as any)?.generate_audio === false ? 'off' : 'on'}
            onChange={(e) => handleParamChange('generate_audio', e.target.value === 'on')}
            disabled={isGenerating}
          >
            <option value="on">有声</option>
            <option value="off">无声</option>
          </select>
        </label>

        <VideoModelSelector
          value={(clip.params as any)?.modelConfigId ?? ''}
          onChange={(modelConfigId) => handleParamChange('modelConfigId', modelConfigId || undefined)}
          disabled={isGenerating}
        />
      </div>

      <div className="flex items-center justify-end">
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className="gap-2"
        >
          <Sparkles className="size-4" />
          {isFailed ? '重新生成' : '生成视频'}
        </Button>
      </div>

      <MaterialPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        role={pickerRole}
        clipId={clip.id}
        projectId={projectId}
      />
    </div>
  );
}
