'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ModelConfigItem } from '@autix/shared-store';
import { ModelVendorIcon } from '../../../brand';
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover';

function ImageParamButton({
  icon,
  label,
  showArrow = false,
}: {
  icon: ReactNode;
  label: string;
  /** 是否展示下拉箭头（仅模型选择用；参数按钮不展示） */
  showArrow?: boolean;
}) {
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-border bg-background/22 px-3 text-sm font-semibold text-foreground/78">
      <span className="text-foreground/70">{icon}</span>
      <span>{label}</span>
      {showArrow ? <ChevronDown className="size-3.5 text-foreground/38" /> : null}
    </span>
  );
}

export function ImageModelParamMenu({
  label,
  models,
  selectedModelId,
  onChange,
}: {
  label: string;
  models: ModelConfigItem[];
  selectedModelId: string | null;
  onChange: (modelId: string) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // 模型列表未加载出来时不展示模型选项：不显示加载态，也不显示写死默认模型
  if (models.length === 0) return null;
  const selectedModel = models.find((model) => model.id === selectedModelId) ?? null;
  const keyword = query.trim().toLowerCase();
  const filtered = keyword
    ? models.filter((model) =>
        `${model.name} ${model.model} ${model.provider}`.toLowerCase().includes(keyword),
      )
    : models;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer text-left">
          {/* 触发按钮按当前所选模型的厂商渲染图标（灰度弱化，仅模型按钮带下拉箭头） */}
          <ImageParamButton
            icon={<ModelVendorIcon model={selectedModel} className="size-4 opacity-80 grayscale" />}
            label={label}
            showArrow
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="relative w-[360px] gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(28,30,32,0.86)] p-0 text-foreground backdrop-blur-[32px]"
      >
        {/* 泛青发光：顶部 + 下部各一团模糊青光 */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-9 rounded-full blur-[50px]"
          style={{ background: 'rgba(139, 213, 244, 0.24)' }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[35%] h-9 rounded-full blur-[50px]"
          style={{ background: 'rgba(139, 213, 244, 0.24)' }}
        />
        <div className="relative">
        {/* 顶部搜索 */}
        <div className="p-2">
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
        <div className="max-h-[60vh] overflow-y-auto px-1.5 pb-1.5">
          {filtered.map((model) => {
            const active = selectedModelId === model.id;
            const premium = (model.allowedMembershipLevels?.length ?? 0) > 0;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  onChange(model.id);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'}`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/5">
                  {/* 灰度 + 降透明：图标去色偏灰，不喧宾夺主 */}
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
                  <span className="mt-0.5 block truncate text-xs text-foreground/45">{model.model}</span>
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
