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
  const [ratioDropdownOpen, setRatioDropdownOpen] = useState(false);
  const [durationDropdownOpen, setDurationDropdownOpen] = useState(false);

  const DURATION_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 15];

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
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.14] px-2.5 py-1 text-xs font-medium text-cyan-100 shadow-[0_10px_24px_rgba(34,211,238,0.12)]">
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.055] px-2.5 py-1 text-xs font-medium text-white/72 transition-colors hover:bg-white/[0.1] hover:text-white"
            >
              <Sparkles className="size-3.5 text-white/46" />
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs font-medium text-white/36"
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.055] px-2.5 py-1 text-xs font-medium text-white/72 transition-colors hover:bg-white/[0.1] hover:text-white"
          onClick={() => { setModeDropdownOpen(!modeDropdownOpen); setRatioDropdownOpen(false); setDurationDropdownOpen(false); }}
        >
          <span>{MODE_LABELS[mode]}</span>
          <ChevronDown className="size-3" />
        </button>
        {modeDropdownOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[140px] rounded-lg border border-white/12 bg-slate-950/88 p-1 text-white shadow-2xl backdrop-blur-xl">
            {(Object.entries(MODE_LABELS) as [VideoGenMode, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-white/10 ${
                  mode === key ? 'font-medium text-cyan-200' : 'text-white/72'
                }`}
                onClick={() => { onModeChange(key); setModeDropdownOpen(false); }}
              >
                {label}
                {mode === key && <span className="ml-auto text-cyan-200">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ratio */}
      <div className="relative">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.055] px-2.5 py-1 text-xs font-medium text-white/72 transition-colors hover:bg-white/[0.1] hover:text-white"
          onClick={() => { setRatioDropdownOpen(!ratioDropdownOpen); setDurationDropdownOpen(false); setModeDropdownOpen(false); }}
        >
          <span>{ratio}</span>
          <ChevronDown className="size-3" />
        </button>
        {ratioDropdownOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[100px] rounded-lg border border-white/12 bg-slate-950/88 p-1 text-white shadow-2xl backdrop-blur-xl">
            {RATIO_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-white/10 ${
                  ratio === r ? 'font-medium text-cyan-200' : 'text-white/72'
                }`}
                onClick={() => { onRatioChange(r); setRatioDropdownOpen(false); }}
              >
                {r}
                {ratio === r && <span className="ml-auto text-cyan-200">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Duration */}
      <div className="relative">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.055] px-2.5 py-1 text-xs font-medium text-white/72 transition-colors hover:bg-white/[0.1] hover:text-white"
          onClick={() => { setDurationDropdownOpen(!durationDropdownOpen); setRatioDropdownOpen(false); setModeDropdownOpen(false); }}
        >
          <span>{duration}s</span>
          <ChevronDown className="size-3" />
        </button>
        {durationDropdownOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[80px] rounded-lg border border-white/12 bg-slate-950/88 p-1 text-white shadow-2xl backdrop-blur-xl">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-white/10 ${
                  duration === d ? 'font-medium text-cyan-200' : 'text-white/72'
                }`}
                onClick={() => { onDurationChange(d); setDurationDropdownOpen(false); }}
              >
                {d}s
                {duration === d && <span className="ml-auto text-cyan-200">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Template */}
      {onOpenTemplateDrawer && (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.055] px-2.5 py-1 text-xs font-medium text-white/72 transition-colors hover:bg-white/[0.1] hover:text-white"
          onClick={onOpenTemplateDrawer}
        >
          <LayoutTemplate className="size-3.5 text-white/46" />
          <span className="max-w-[100px] truncate">
            {activeTemplateName ?? '选模板'}
          </span>
        </button>
      )}
    </div>
  );
}
