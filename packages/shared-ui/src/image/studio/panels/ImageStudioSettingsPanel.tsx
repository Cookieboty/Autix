'use client';

import { SlidersHorizontal, Wand2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import type { ImageModelCapability } from '@autix/domain/image';
import { SchemaForm, TotalPriceBar, useSchemaForm } from '../../../pricing';
import { cn } from '../../../ui/utils';
import { STYLE_PRESET_VALUES, type ImageStudioModelSettings } from '../constants';
import { PanelLabel, SliderRow } from '../shared/PrimitiveControls';
import { SelectLike } from '../shared/SelectLike';

export function ImageStudioSettingsPanel({
  open,
  taskType,
  modelConfigId,
  paramsSchema,
  pricingSchema,
  pricingContext,
  settings,
  capability,
  onClose,
  onParamsChange,
  onSettingsChange,
}: {
  open: boolean;
  taskType: string;
  modelConfigId: string | undefined;
  paramsSchema: ParamsSchema | undefined;
  pricingSchema: PricingSchema | undefined;
  pricingContext: { multiplier: number; discountFactor: number };
  settings: ImageStudioModelSettings;
  capability: ImageModelCapability;
  onClose: () => void;
  onParamsChange: (params: Record<string, unknown>) => void;
  onSettingsChange: (partial: Partial<ImageStudioModelSettings>) => void;
}) {
  const t = useTranslations('imageStudio');
  const tStyle = useTranslations('imageStudio.stylePresets');
  const tParams = useTranslations('pricing.params');
  const tOptions = useTranslations('pricing.options');
  const tTotal = useTranslations('pricing');

  const form = useSchemaForm(paramsSchema);

  // spec §6.8: schema 拉取失败 -> 禁用生成，不 fallback 到硬编码默认值。
  const schemaMissing = !paramsSchema || !pricingSchema;

  if (schemaMissing) {
    return (
      <aside className={cn('h-full w-[300px] shrink-0 border-r border-border bg-muted/18 p-4 text-xs text-muted-foreground', open ? 'flex' : 'hidden', 'lg:flex')}>
        {t('panel.schemaUnavailable')}
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        'h-full w-[300px] shrink-0 flex-col border-r border-border bg-muted/18',
        open
          ? 'fixed inset-y-0 left-0 z-40 flex bg-background shadow-xl'
          : 'hidden',
        'lg:static lg:z-auto lg:flex lg:bg-muted/18 lg:shadow-none',
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wand2 className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{t('panel.title')}</h2>
            <p className="truncate text-xs text-muted-foreground">{t('panel.subtitle')}</p>
          </div>
          <button
            type="button"
            aria-label={t('panel.close')}
            className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-5">
          <SchemaForm
            paramsSchema={paramsSchema}
            pricingSchema={pricingSchema}
            pricingContext={pricingContext}
            form={form}
            translateLabel={(labelKey, fallback) => (labelKey ? tParams(labelKey.replace('pricing.params.', '')) : fallback)}
            translateOption={(optionLabelKey, fallback) =>
              optionLabelKey ? tOptions(optionLabelKey.replace('pricing.options.', '')) : fallback
            }
          />

          {/* 以下控件不是计价参数（不在 imagePreset.paramsSchema 里），SchemaForm
              渲染不出来，但真实生成链路仍然读它们（buildImageWorkbenchPrompt /
              buildImageWorkbenchRequestSettings）——保留自 63fa1100 版
              ImageStudioSettingsPanel，绑定到同一个 settings 状态，仅去掉了已经
              上移到 SchemaForm 里的 size/aspect/quality 控件。 */}
          {capability.showAdvancedSliders && (
            <section className="space-y-3">
              <PanelLabel icon={<SlidersHorizontal className="size-3.5" />} label={t('panel.advanced.label')} />
              <SliderRow
                label="CFG"
                value={settings.guidanceScale}
                min={1}
                max={20}
                step={0.5}
                onChange={(value) => onSettingsChange({ guidanceScale: value })}
              />
              <SliderRow
                label="Steps"
                value={settings.steps}
                min={4}
                max={60}
                step={1}
                onChange={(value) => onSettingsChange({ steps: value })}
              />
              <input
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                placeholder={t('panel.advanced.seedPlaceholder')}
                value={settings.seed}
                onChange={(e) => onSettingsChange({ seed: e.target.value })}
              />
            </section>
          )}

          <section className="space-y-2">
            <PanelLabel icon={<Wand2 className="size-3.5" />} label={t('panel.style.label')} />
            <SelectLike
              value={settings.stylePreset}
              options={STYLE_PRESET_VALUES.map((value) => ({ label: tStyle(value), value }))}
              onChange={(stylePreset) => onSettingsChange({ stylePreset })}
            />
            {capability.supportsNegativePrompt !== 'none' && (
              <div className="space-y-1">
                <textarea
                  className="min-h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs leading-5 outline-none placeholder:text-muted-foreground focus:border-primary"
                  placeholder={t('panel.style.negativePlaceholder')}
                  value={settings.negativePrompt}
                  onChange={(e) => onSettingsChange({ negativePrompt: e.target.value })}
                />
                {capability.supportsNegativePrompt === 'prompt-injected' && settings.negativePrompt.trim() && (
                  <p className="text-[11px] text-muted-foreground">
                    {t('panel.style.negativeHint')}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <TotalPriceBar
          taskType={taskType}
          modelConfigId={modelConfigId}
          params={form.params}
          onQuote={(result) => onParamsChange(result.snapshot)}
          translateTotal={(total) => (total === null ? '' : tTotal('totalPoints', { count: total }))}
        />
      </div>
    </aside>
  );
}
