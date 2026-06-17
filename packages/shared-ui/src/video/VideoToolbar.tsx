'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Globe, Sparkles, LayoutTemplate } from 'lucide-react';
import { getAvailableModels, isVideoModel, type ModelConfigItem } from '@autix/shared-lib';
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
  models?: ModelConfigItem[];
  modelsLoading?: boolean;
  labels?: {
    modelPicker?: {
      searchPlaceholder?: string;
      empty?: string;
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
  models,
  modelsLoading = false,
  labels,
}: VideoToolbarProps) {
  const [localVideoModels, setLocalVideoModels] = useState<ModelConfigItem[]>([]);
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const [ratioDropdownOpen, setRatioDropdownOpen] = useState(false);
  const [durationDropdownOpen, setDurationDropdownOpen] = useState(false);
  const videoModels = models ?? localVideoModels;
  const controlledModels = models !== undefined;

  const DURATION_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 15];

  useEffect(() => {
    if (controlledModels) return;
    getAvailableModels().then((res) => {
      setLocalVideoModels(
        (res.data ?? []).filter(isVideoModel),
      );
    });
  }, [controlledModels]);

  useEffect(() => {
    if (!model && videoModels[0]?.id) {
      onModelChange(videoModels[0].id);
    }
  }, [model, onModelChange, videoModels]);

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      {/* Model Picker */}
      {videoModels.length > 0 ? (
        <ModelPickerPopover
          candidates={videoModels}
          value={model}
          onChange={(id) => id && onModelChange(id)}
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
          {modelsLoading ? '加载视频模型' : '暂无视频模型'}
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
          <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[140px] rounded-lg border border-white/12 bg-black/90 p-1 text-white shadow-2xl backdrop-blur-xl">
            {(Object.entries(MODE_LABELS) as [VideoGenMode, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-white/10 ${
                  mode === key ? 'font-medium text-white' : 'text-white/72'
                }`}
                onClick={() => { onModeChange(key); setModeDropdownOpen(false); }}
              >
                {label}
                {mode === key && <span className="ml-auto text-white">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ratio */}
      <div className="relative">
        <button
          type="button"
          className="inline-flex min-w-[84px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-white/12 bg-white/[0.055] px-2.5 py-1 text-xs font-medium text-white/72 transition-colors hover:bg-white/[0.1] hover:text-white"
          onClick={() => { setRatioDropdownOpen(!ratioDropdownOpen); setDurationDropdownOpen(false); setModeDropdownOpen(false); }}
        >
          <span className="whitespace-nowrap">{ratio}</span>
          <ChevronDown className="size-3" />
        </button>
        {ratioDropdownOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[132px] rounded-lg border border-white/12 bg-black/90 p-1 text-white shadow-2xl backdrop-blur-xl">
            {RATIO_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs whitespace-nowrap transition-colors hover:bg-white/10 ${
                  ratio === r ? 'font-medium text-white' : 'text-white/72'
                }`}
                onClick={() => { onRatioChange(r); setRatioDropdownOpen(false); }}
              >
                <span className="whitespace-nowrap">{r}</span>
                {ratio === r && <span className="ml-auto text-white">✓</span>}
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
          <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[80px] rounded-lg border border-white/12 bg-black/90 p-1 text-white shadow-2xl backdrop-blur-xl">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-white/10 ${
                  duration === d ? 'font-medium text-white' : 'text-white/72'
                }`}
                onClick={() => { onDurationChange(d); setDurationDropdownOpen(false); }}
              >
                {d}s
                {duration === d && <span className="ml-auto text-white">✓</span>}
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
