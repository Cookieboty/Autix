'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Globe, Video, Sparkles, LayoutTemplate } from 'lucide-react';
import { getAvailableModels, type ModelConfigItem } from '@autix/shared-lib';
import { ModelPickerPopover } from '../chat/ModelPickerPopover';

export type VideoGenMode = 'reference' | 'first_last_frame' | 'smart_multiframe';

interface VideoToolbarProps {
  model: string;
  onModelChange: (id: string) => void;
  mode: VideoGenMode;
  onModeChange: (mode: VideoGenMode) => void;
  ratio: string;
  onRatioChange: (ratio: string) => void;
  duration: number;
  onDurationChange: (dur: number) => void;
  onOpenTemplateDrawer?: () => void;
  activeTemplateName?: string;
  labels?: {
    modelPicker?: {
      searchPlaceholder?: string;
      recent?: string;
      empty?: string;
      clearSelection?: string;
    };
  };
}

const MODE_LABELS: Record<VideoGenMode, string> = {
  reference: '全能参考',
  first_last_frame: '首尾帧',
  smart_multiframe: '智能多帧',
};

const RATIO_OPTIONS = ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9', '自动匹配'];

export function VideoToolbar({
  model,
  onModelChange,
  mode,
  onModeChange,
  ratio,
  onRatioChange,
  duration,
  onDurationChange,
  onOpenTemplateDrawer,
  activeTemplateName,
  labels,
}: VideoToolbarProps) {
  const [videoModels, setVideoModels] = useState<ModelConfigItem[]>([]);
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);

  useEffect(() => {
    getAvailableModels().then((res) => {
      setVideoModels(
        (res.data ?? []).filter((m) => m.type === 'video' && m.provider === 'amux'),
      );
    });
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      {/* 视频生成 badge */}
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        <Video className="size-3.5" />
        视频生成
      </span>

      {/* Model Picker */}
      {videoModels.length > 0 ? (
        <ModelPickerPopover
          candidates={videoModels}
          value={model}
          onChange={(id) => id && onModelChange(id)}
          memoryKey="video"
          disabledClear
          labels={labels?.modelPicker}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
            >
              <Sparkles className="size-3.5 text-muted-foreground" />
              <span className="max-w-[140px] truncate">
                {videoModels.find((m) => m.id === model)?.name ?? '选择模型'}
              </span>
              <ChevronDown className="size-3" />
            </button>
          }
        />
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground"
          disabled
        >
          <Globe className="size-3.5" />
          暂无视频模型
        </button>
      )}

      {/* Mode Picker */}
      <div className="relative">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
          onClick={() => setModeDropdownOpen(!modeDropdownOpen)}
        >
          <span>{MODE_LABELS[mode]}</span>
          <ChevronDown className="size-3" />
        </button>
        {modeDropdownOpen && (
          <div className="absolute left-0 bottom-full z-50 mb-1 min-w-[140px] rounded-lg border border-border bg-popover p-1 shadow-md">
            {(Object.entries(MODE_LABELS) as [VideoGenMode, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-accent ${
                  mode === key ? 'font-medium text-primary' : 'text-foreground'
                }`}
                onClick={() => { onModeChange(key); setModeDropdownOpen(false); }}
              >
                {label}
                {mode === key && <span className="ml-auto text-primary">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ratio */}
      <select
        className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
        value={ratio}
        onChange={(e) => onRatioChange(e.target.value)}
      >
        {RATIO_OPTIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      {/* Duration */}
      <select
        className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
        value={duration}
        onChange={(e) => onDurationChange(Number(e.target.value))}
      >
        {[4, 5, 6, 7, 8, 9, 10, 11, 12, 15].map((d) => (
          <option key={d} value={d}>{d}s</option>
        ))}
      </select>

      {/* Template */}
      {onOpenTemplateDrawer && (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
          onClick={onOpenTemplateDrawer}
        >
          <LayoutTemplate className="size-3.5 text-muted-foreground" />
          <span className="max-w-[100px] truncate">
            {activeTemplateName ?? '选模板'}
          </span>
        </button>
      )}
    </div>
  );
}
