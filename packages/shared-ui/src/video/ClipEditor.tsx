'use client';

import { useState, useCallback, useEffect } from 'react';
import { Coins, Loader2, Sparkles, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ModelConfigItem } from '@autix/shared-lib';
import type { VideoClip } from '@autix/shared-store';
import { useVideoProjectStore } from '@autix/shared-store';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { MaterialSlot } from './MaterialSlot';
import { MaterialPicker } from './MaterialPicker';
import { VideoModelSelector } from './VideoModelSelector';

interface ClipEditorProps {
  clip: VideoClip | null;
  projectId: string;
  onRequestGenerate?: (clip: VideoClip) => void;
  videoModels?: ModelConfigItem[];
  videoModelsLoading?: boolean;
  estimatedCost?: number | null;
  estimatingCost?: boolean;
}

const DURATION_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 15].map((duration) => ({
  label: `${duration}s`,
  value: String(duration),
}));

const RESOLUTION_OPTIONS = [
  { label: '480p', value: '480p' },
  { label: '720p', value: '720p' },
  { label: '1080p', value: '1080p' },
];

export function ClipEditor({
  clip,
  projectId,
  onRequestGenerate,
  videoModels = [],
  videoModelsLoading = false,
  estimatedCost = null,
  estimatingCost = false,
}: ClipEditorProps) {
  const t = useTranslations('videoWorkbench.legacy.clipEditor');
  const { updateClip, generateClip, generatingClipIds } = useVideoProjectStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRole, setPickerRole] = useState<string>('first_frame');
  const [titleDraft, setTitleDraft] = useState('');

  const isGenerating = clip ? generatingClipIds.includes(clip.id) : false;
  const isFailed = clip?.status === 'failed';
  const materialSlots = [
    { role: 'first_frame', label: t('slots.firstFrame') },
    { role: 'reference_image', label: t('slots.referenceImage') },
    { role: 'reference_video', label: t('slots.referenceVideo') },
    { role: 'reference_audio', label: t('slots.referenceAudio') },
  ] as const;
  const ratioOptions = [
    { label: '16:9', value: '16:9' },
    { label: '9:16', value: '9:16' },
    { label: '4:3', value: '4:3' },
    { label: '3:4', value: '3:4' },
    { label: '1:1', value: '1:1' },
    { label: '21:9', value: '21:9' },
    { label: t('ratioAdaptive'), value: 'adaptive' },
  ];
  const audioOptions = [
    { label: t('audioOn'), value: 'on' },
    { label: t('audioOff'), value: 'off' },
  ];

  useEffect(() => {
    setTitleDraft(clip?.title || (clip ? t('clipDefaultTitle', { order: clip.order }) : ''));
  }, [clip?.id, clip?.order, clip?.title, t]);

  const commitTitle = useCallback(() => {
    if (!clip) return;
    const nextTitle = titleDraft.trim();
    const currentTitle = (clip.title || t('clipDefaultTitle', { order: clip.order })).trim();
    if (!nextTitle) {
      setTitleDraft(currentTitle);
      return;
    }
    if (nextTitle === currentTitle) return;
    void updateClip(clip.id, { title: nextTitle });
  }, [clip, titleDraft, updateClip, t]);

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
      const currentParams =
        clip.params && typeof clip.params === 'object' && !Array.isArray(clip.params)
          ? clip.params
          : {};
      const nextParams = { ...currentParams, [key]: value };
      if (key === 'generateAudio') delete nextParams.generate_audio;
      updateClip(clip.id, { params: nextParams });
    },
    [clip, updateClip],
  );

  const handleModelChange = useCallback(
    (modelConfigId: string) => {
      if (!clip) return;
      const currentParams =
        clip.params && typeof clip.params === 'object' && !Array.isArray(clip.params)
          ? clip.params
          : {};
      const selectedModel = videoModels.find((model) => model.id === modelConfigId);
      const nextParams = { ...currentParams };
      if (modelConfigId) {
        nextParams.modelConfigId = modelConfigId;
        if (selectedModel?.model) nextParams.model = selectedModel.model;
      } else {
        delete nextParams.modelConfigId;
        delete nextParams.model;
      }
      updateClip(clip.id, { params: nextParams });
    },
    [clip, updateClip, videoModels],
  );

  const handleGenerate = useCallback(() => {
    if (!clip) return;
    if (onRequestGenerate) {
      onRequestGenerate(clip);
      return;
    }
    generateClip(clip.id);
  }, [clip, generateClip, onRequestGenerate]);

  const openPicker = (role: string) => {
    setPickerRole(role);
    setPickerOpen(true);
  };

  if (!clip) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {t('selectClip')}
      </div>
    );
  }

  const canGenerate = Boolean(clip.prompt?.trim() || clip.materials.length > 0);

  return (
    <div className="relative rounded-lg border border-border p-4 space-y-4">
      {isGenerating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" />
            {t('generating')}
          </div>
        </div>
      )}

      {isFailed && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {t('failed')}
        </div>
      )}

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t('titleLabel')}</span>
        <Input
          value={titleDraft}
          placeholder={t('clipDefaultTitle', { order: clip.order })}
          disabled={isGenerating}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className="h-10 border-border bg-background text-sm font-medium"
        />
      </label>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {materialSlots.map((slot) => {
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
        placeholder={t('promptPlaceholder')}
        value={clip.prompt ?? ''}
        onChange={handlePromptChange}
        disabled={isGenerating}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <ParamSelect
          label={t('durationLabel')}
          value={String((clip.params as any)?.duration ?? 5)}
          options={DURATION_OPTIONS}
          onChange={(value) => handleParamChange('duration', Number(value))}
          disabled={isGenerating}
        />

        <ParamSelect
          label={t('resolutionLabel')}
          value={(clip.params as any)?.resolution ?? '720p'}
          options={RESOLUTION_OPTIONS}
          onChange={(value) => handleParamChange('resolution', value)}
          disabled={isGenerating}
        />

        <ParamSelect
          label={t('ratioLabel')}
          value={(clip.params as any)?.ratio ?? '16:9'}
          options={ratioOptions}
          onChange={(value) => handleParamChange('ratio', value)}
          disabled={isGenerating}
        />

        <ParamSelect
          label={t('audioLabel')}
          value={(clip.params as any)?.generateAudio === false || (clip.params as any)?.generate_audio === false ? 'off' : 'on'}
          options={audioOptions}
          onChange={(value) => handleParamChange('generateAudio', value === 'on')}
          disabled={isGenerating}
        />

        <VideoModelSelector
          value={(clip.params as any)?.modelConfigId ?? ''}
          onChange={handleModelChange}
          disabled={isGenerating}
          models={videoModels}
          loading={videoModelsLoading}
        />
      </div>

      <div className="flex items-center justify-end">
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className="gap-2"
        >
          <Sparkles className="size-4" />
          <span>{isFailed ? t('regenerate') : t('generateVideo')}</span>
          {estimatingCost ? (
            <Loader2 className="size-3.5 animate-spin opacity-80" />
          ) : estimatedCost != null ? (
            <span className="inline-flex items-center gap-1 rounded bg-primary-foreground/15 px-1.5 py-0.5 text-[11px] leading-none">
              <Coins className="size-3" />
              {estimatedCost}
            </span>
          ) : null}
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

function ParamSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-8 w-[96px] border-border bg-background px-2.5 text-xs shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[70] rounded-lg">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
