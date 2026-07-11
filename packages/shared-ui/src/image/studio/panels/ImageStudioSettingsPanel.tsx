'use client';

import { useMemo } from 'react';
import { SlidersHorizontal, Wand2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import type { ImageModelCapability } from '@autix/domain/image';
import {
  SchemaForm,
  TotalPriceBar,
  translateSchemaKey,
  useSchemaForm,
  useSchemaFormExternalSync,
} from '../../../pricing';
import { cn } from '../../../ui/utils';
import { STYLE_PRESET_VALUES, type ImageStudioModelSettings } from '../constants';
import { imageSettingsToSchemaParams } from '../schema-params-mapping';
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
  referenceImageCount,
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
  /**
   * 当前已选的源图/参考图张数。referenceImages 是隐藏计价参数（perUnit 收费），
   * 权威 hold 按 source+reference 实际数量扣费（image-generation-flow.holds.ts）；
   * 面板报价必须带上它，否则显示总价会低于真实 hold。
   */
  referenceImageCount: number;
  onClose: () => void;
  onParamsChange: (params: Record<string, unknown>) => void;
  onSettingsChange: (partial: Partial<ImageStudioModelSettings>) => void;
}) {
  const t = useTranslations('imageStudio');
  const tStyle = useTranslations('imageStudio.stylePresets');
  const tParams = useTranslations('pricing.params');
  const tOptions = useTranslations('pricing.options');
  const tTotal = useTranslations('pricing');

  // 用当前设置(反向映射)作为表单初始值，并在 settings 被外部改动(模板应用/历史恢复)时
  // 同步进表单——否则表单会用 schema 默认值覆盖已有设置(P1-3)。
  const externalParams = useMemo(
    () => imageSettingsToSchemaParams(settings),
    // count 已不再是计价参数(生成张数由业务逻辑吃掉)，映射不读它，故不入依赖。
    [settings.size, settings.quality],
  );
  const form = useSchemaForm(paramsSchema, externalParams);

  // 双向同步：外部 settings 变化 -> 表单；用户改表单 -> 上抛给父组件正向映射回 settings。
  // 跳过挂载与外部同步的回声，避免默认值覆盖设置或 settings->form->settings 死循环。
  useSchemaFormExternalSync(form, externalParams, onParamsChange);

  // 报价参数 = 表单参数 + 真实参考图张数（referenceImages 是隐藏计价参数，表单里恒为
  // 默认 0，必须用实际张数覆盖，才能和后端 hold 的收费口径一致）。
  const quoteParams = useMemo(
    () => ({ ...form.params, referenceImages: referenceImageCount }),
    [form.params, referenceImageCount],
  );

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
            translateLabel={(labelKey, fallback) => translateSchemaKey(tParams, 'pricing.params.', labelKey, fallback)}
            translateOption={(optionLabelKey, fallback) =>
              translateSchemaKey(tOptions, 'pricing.options.', optionLabelKey, fallback)
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
          params={quoteParams}
          translateTotal={(total) => (total === null ? '' : tTotal('totalPoints', { count: total }))}
        />
      </div>
    </aside>
  );
}
