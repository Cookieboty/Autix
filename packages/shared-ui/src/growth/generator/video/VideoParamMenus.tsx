'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Diamond,
  Search,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ModelConfigItem } from '@autix/shared-store';
import { ModelVendorIcon } from '../../../brand';
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover';
import { resolveModelDescription } from '../model-description';

/** 分辨率档位排序权重，用于挑出模型支持的最高分辨率 */
const RESOLUTION_RANK: Record<string, number> = {
  '360p': 1, '480p': 2, '540p': 3, '720p': 4, '1080p': 5, '2k': 6, '1440p': 6, '4k': 7, '2160p': 7,
};

/**
 * 列表里每行的能力胶囊，全部从该模型自己的 `paramsSchema` 推导。
 *
 * `/api/models/public/available` 对每个模型都整行返回 paramsSchema，所以这些值
 * 都是真实的、随后端配置走的，不是前端写死的映射表。取不到就不渲染对应胶囊。
 */
function resolveModelCapabilities(model: ModelConfigItem): {
  resolution?: string;
  duration?: string;
  audio: boolean;
} {
  const properties = model.paramsSchema?.properties;
  if (!properties) return { audio: false };

  // 分辨率：enum 里挑档位最高的一个
  const resolutionEnum = properties.resolution?.enum;
  const resolution = Array.isArray(resolutionEnum) && resolutionEnum.length > 0
    ? [...resolutionEnum]
      .map(String)
      .sort((a, b) => (RESOLUTION_RANK[b.toLowerCase()] ?? 0) - (RESOLUTION_RANK[a.toLowerCase()] ?? 0))[0]
    : undefined;

  // 时长：两种形态 —— 离散 enum（如 [4,6,8]）或连续 minimum/maximum（如 4~15）
  const durationProp = properties.duration;
  let duration: string | undefined;
  if (durationProp) {
    const values = Array.isArray(durationProp.enum) ? durationProp.enum.map(Number) : [];
    if (values.length > 0) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      duration = min === max ? `${min}s` : `${min}s-${max}s`;
    } else if (typeof durationProp.minimum === 'number' && typeof durationProp.maximum === 'number') {
      duration = `${durationProp.minimum}s-${durationProp.maximum}s`;
    }
  }

  return { resolution, duration, audio: 'generate_audio' in properties };
}

/** Model 行：上行小标题、下行型号名 + 厂商图标（保留品牌色），右侧箭头 */
function VideoModelRow({
  label,
  value,
  model,
  interactive = false,
}: {
  label: string;
  value: string;
  /** 用于渲染厂商图标；模型未加载出来时为 null */
  model?: ModelConfigItem | null;
  interactive?: boolean;
}) {
  return (
    <div className="growth-panel-item flex min-h-[52px] w-full items-center justify-between gap-2 rounded-[11px] px-3 py-2 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold leading-none text-foreground/42">{label}</span>
        <span className="mt-1.5 flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-bold leading-none text-foreground">{value}</span>
          {model ? <ModelVendorIcon model={model} className="size-3.5 shrink-0" /> : null}
        </span>
      </span>
      {interactive ? <ChevronRight className="size-4 shrink-0 text-foreground/45" /> : null}
    </div>
  );
}

function VideoParamButton({
  icon,
  label,
  trailing,
  pill = false,
}: {
  icon?: ReactNode;
  label: string;
  trailing?: ReactNode;
  /** 胶囊形态：无边框、圆角全开、更紧凑，用于 Prompt 卡片内嵌 */
  pill?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold text-foreground/78 transition ${pill
        // 嵌在 Prompt 卡片内的小号参数按钮：黑底、按内容收宽，尽量省空间
        ? 'min-h-6 w-auto rounded-[7px] bg-black/30 px-1.5 py-0 text-[11px] leading-none hover:bg-black/45 hover:text-foreground'
        : 'growth-panel-item min-h-9 w-full rounded-[11px] px-2 text-xs hover:brightness-125'
        } ${trailing ? 'justify-between' : 'justify-center'}`}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        {icon ? <span className="shrink-0 text-foreground/52">{icon}</span> : null}
        <span className="min-w-0 truncate leading-none">{label}</span>
      </span>
      {trailing ? <span className="shrink-0 text-foreground/45">{trailing}</span> : null}
    </span>
  );
}

export function VideoModelParamMenu({
  label,
  models,
  selectedModelId,
  loading,
  onChange,
  fallbackLabel,
}: {
  label: string;
  models: ModelConfigItem[];
  selectedModelId: string | null;
  loading: boolean;
  onChange: (modelId: string) => void;
  fallbackLabel: string;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  if (models.length === 0) {
    return <VideoModelRow label={t('model')} value={loading ? t('modelLoading') : label || fallbackLabel} />;
  }

  const selectedModel = models.find((item) => item.id === selectedModelId) ?? null;
  const keyword = query.trim().toLowerCase();
  // 与 image 侧一致：id / 厂商仍可被搜到，只是不再显示出来
  const filtered = keyword
    ? models.filter((model) =>
      `${model.name} ${model.model} ${model.provider} ${resolveModelDescription(model, locale) ?? ''}`
        .toLowerCase()
        .includes(keyword),
    )
    : models;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full min-w-0 cursor-pointer text-left transition hover:brightness-110"
        >
          <VideoModelRow label={t('model')} value={label} model={selectedModel} interactive />
        </button>
      </PopoverTrigger>
      {/* 面板样式与 ai/image 的模型下拉一致：玻璃底 + 双团青光 + 搜索。
          默认从触发器右侧展开（空间不足时 Radix 自动翻边），整体限高、超出滚动。 */}
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        collisionPadding={16}
        className="relative flex max-h-[min(78vh,640px)] w-[360px] flex-col gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(28,30,32,0.86)] p-0 text-foreground backdrop-blur-[32px]"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-9 rounded-full blur-[50px]"
          style={{ background: 'rgba(139, 213, 244, 0.24)' }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[35%] h-9 rounded-full blur-[50px]"
          style={{ background: 'rgba(139, 213, 244, 0.24)' }}
        />
        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* 搜索框固定，不随列表滚动 */}
          <div className="shrink-0 p-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <Search className="size-4 shrink-0 text-foreground/40" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('selectModel')}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/40"
              />
            </div>
          </div>
          <div className="growth-dark-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
            {filtered.map((model) => {
              const active = selectedModelId === model.id;
              const premium = (model.allowedMembershipLevels?.length ?? 0) > 0;
              const capabilities = resolveModelCapabilities(model);
              const description = resolveModelDescription(model, locale);
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    onChange(model.id);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                    }`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/5">
                    <ModelVendorIcon model={model} className="size-5 opacity-70 grayscale" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{model.name}</span>
                      {premium ? (
                        <span className="shrink-0 rounded bg-growth-accent px-1.5 py-0.5 text-[10px] font-black uppercase italic text-background">
                          Premium
                        </span>
                      ) : null}
                    </span>
                    {description ? (
                      <span className="mt-0.5 block truncate text-xs text-foreground/45">{description}</span>
                    ) : null}
                    {/* 能力胶囊：分辨率 / 时长 / 音频，全部由该模型的 paramsSchema 推导 */}
                    {capabilities.resolution || capabilities.duration || capabilities.audio ? (
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        {capabilities.resolution ? (
                          <span className="inline-flex items-center gap-1 rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-bold text-foreground/60">
                            <Diamond className="size-2.5" />
                            {capabilities.resolution}
                          </span>
                        ) : null}
                        {capabilities.duration ? (
                          <span className="inline-flex items-center gap-1 rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-bold text-foreground/60">
                            <Clock3 className="size-2.5" />
                            {capabilities.duration}
                          </span>
                        ) : null}
                        {capabilities.audio ? (
                          <span className="inline-flex items-center rounded bg-white/8 px-1.5 py-0.5 text-foreground/60">
                            <Volume2 className="size-2.5" />
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                  {active ? <Check className="size-4 shrink-0 text-growth-accent" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function VideoOptionParamMenu({
  icon,
  label,
  title,
  options,
  value,
  onChange,
  showChevron = false,
  contentClassName,
  pill = false,
  renderOptionIcon,
}: {
  icon?: ReactNode;
  label: string;
  title: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
  showChevron?: boolean;
  contentClassName?: string;
  /** 胶囊形态（Prompt 卡片内嵌）：不显示图标 */
  pill?: boolean;
  /** 每个选项前的图标（比例菜单用它渲染对应比例的矩形） */
  renderOptionIcon?: (value: string) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // pill 形态不带图标；常规形态未指定时回落到通用图标
  const resolvedIcon = pill ? undefined : (icon ?? <SlidersHorizontal className="size-4" />);

  if (options.length === 0) {
    return (
      <button type="button" className={`min-w-0 cursor-default text-left ${pill ? '' : 'w-full'}`} disabled>
        <VideoParamButton icon={resolvedIcon} label={label} pill={pill} />
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={`min-w-0 cursor-pointer text-left ${pill ? '' : 'w-full'}`}>
          <VideoParamButton
            icon={resolvedIcon}
            label={label}
            pill={pill}
            trailing={showChevron ? <ChevronDown className="size-4" /> : undefined}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={`w-56 gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(28,30,32,0.86)] p-1.5 text-foreground backdrop-blur-[32px]${contentClassName ? ` ${contentClassName}` : ''}`}
      >
        <div className="px-2.5 py-1.5 text-xs font-semibold text-foreground/45">{title}</div>
        <div className="max-h-80 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 text-left text-sm font-semibold transition ${value === option.value
                ? 'bg-white/[0.06] text-foreground'
                : 'text-foreground/82 hover:bg-white/[0.04]'
                }`}
            >
              {renderOptionIcon ? (
                <span className="shrink-0 text-foreground/70">{renderOptionIcon(option.value)}</span>
              ) : null}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {value === option.value ? <Check className="size-4 shrink-0 text-growth-accent" /> : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * 长方形滑块轨道：整条是一个圆角矩形，左侧已选区域略微提亮，
 * 当前值直接显示在条内，手柄是一根竖白条。离散/连续两种滑块共用。
 *
 * 手柄是**自绘的**而非原生 thumb：值仍按 step 取整，但填充宽度与手柄位置都走
 * CSS 补间，所以拖动时视觉是连续的，不会跟着步长一格格硬跳（原生 thumb 无法补间）。
 */
function VideoSliderTrack({
  valueLabel,
  min,
  max,
  step = 1,
  value,
  onChange,
  ariaLabel,
}: {
  valueLabel: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="relative mt-2 h-9 w-full overflow-hidden rounded-[12px] border border-white/8 bg-black/30 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-growth-accent/45">
      {/* 已选区域 */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-white/[0.14] transition-[width] duration-100 ease-out"
        style={{ width: `${percent}%` }}
      />
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground">
        {valueLabel}
      </span>
      {/* 自绘手柄：left/transform 的组合让它在 0% 与 100% 处都完整落在轨道内 */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 h-6 w-1 rounded-[3px] bg-white transition-[left,transform] duration-100 ease-out"
        style={{ left: `${percent}%`, transform: `translate(-${percent}%, -50%)` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={ariaLabel}
        className="growth-range absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
      />
    </div>
  );
}

/**
 * 连续区间参数（x-ui.control === 'stepper'）：schema 只给 minimum/maximum/step，没有 enum。
 * 例如 Seedance 的 duration 是 4~15 任意整数——不能用离散 slider 的档位刻度来渲染。
 */
export function VideoRangeParamMenu({
  icon,
  label,
  title,
  min,
  max,
  step = 1,
  value,
  onChange,
  formatValue,
}: {
  icon?: ReactNode;
  label: string;
  title: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const display = formatValue ?? ((v: number) => `${v}s`);
  const safeValue = Math.min(Math.max(value, min), max);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="w-full min-w-0 cursor-pointer text-left">
          <VideoParamButton icon={icon ?? <SlidersHorizontal className="size-4" />} label={label} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(28,30,32,0.86)] p-3 text-foreground backdrop-blur-[32px]"
      >
        <div className="px-1 pb-0.5 text-xs font-semibold text-foreground/45">{title}</div>
        <VideoSliderTrack
          valueLabel={display(safeValue)}
          min={min}
          max={max}
          step={step}
          value={safeValue}
          onChange={onChange}
          ariaLabel={title}
        />
      </PopoverContent>
    </Popover>
  );
}

export function VideoSliderParamMenu({
  icon,
  label,
  title,
  options,
  value,
  onChange,
  formatValue,
}: {
  icon?: ReactNode;
  label: string;
  title: string;
  options: number[];
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}) {
  const [open, setOpen] = useState(false);

  const safeOptions = useMemo(() => (options.length > 0 ? options : [value]), [options, value]);
  const maxIndex = Math.max(0, safeOptions.length - 1);
  const currentIndex = useMemo(() => {
    const idx = safeOptions.indexOf(value);
    return idx >= 0 ? idx : 0;
  }, [safeOptions, value]);
  const display = formatValue ?? ((v: number) => `${v}s`);

  if (safeOptions.length <= 1) {
    return (
      <button type="button" className="min-w-0 cursor-default text-left" disabled>
        <VideoParamButton icon={icon ?? <SlidersHorizontal className="size-4" />} label={label} />
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="min-w-0 cursor-pointer text-left">
          <VideoParamButton icon={icon ?? <SlidersHorizontal className="size-4" />} label={label} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(28,30,32,0.86)] p-3 text-foreground backdrop-blur-[32px]"
      >
        <div className="px-1 pb-0.5 text-xs font-semibold text-foreground/45">{title}</div>
        {/* 离散档位：滑块按下标推进，标签显示实际值 */}
        <VideoSliderTrack
          valueLabel={display(safeOptions[currentIndex] ?? value)}
          min={0}
          max={maxIndex}
          step={1}
          value={currentIndex}
          onChange={(index) => {
            const next = safeOptions[index];
            if (next != null) onChange(next);
          }}
          ariaLabel={title}
        />
        {/* 档位少时给可点的刻度，方便直接跳档 */}
        <div className="mt-2 flex justify-between px-1 text-[11px] font-bold text-foreground/45">
          {safeOptions.map((opt, idx) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`min-w-6 cursor-pointer rounded px-1 py-0.5 transition hover:text-foreground ${idx === currentIndex ? 'text-foreground' : ''}`}
            >
              {display(opt)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
