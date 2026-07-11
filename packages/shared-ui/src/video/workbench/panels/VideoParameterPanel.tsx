'use client';

import { useMemo } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import {
  SchemaForm,
  TotalPriceBar,
  translateSchemaKey,
  useSchemaForm,
  useSchemaFormExternalSync,
} from '../../../pricing';
import { cn } from '../../../ui/utils';
import { ParamCardGroup } from '../shared/ParamCardGroup';
import { PanelLabel } from '../shared/PanelLabel';
import { videoClipParamsToSchemaParams } from '../schema-params-mapping';
import type { VideoWorkspaceMode } from '../constants';

// The `videoPreset.paramsSchema` duration field is keyed `seconds` (see
// packages/domain/src/pricing/presets.ts), independent of its `pricing.params.duration` labelKey
// and of the `clipParams.duration` name `schema-params-mapping.ts` renames it to post-quote.
const STORYBOARD_HIDDEN_FIELDS = ['seconds'] as const;

export function VideoParameterPanel({
  open,
  taskType,
  modelConfigId,
  mode,
  paramsSchema,
  pricingSchema,
  pricingContext,
  clipParams,
  hasClip,
  onClose,
  onParamsChange,
  onClipParamChange,
}: {
  open: boolean;
  taskType: string;
  modelConfigId: string | undefined;
  /**
   * storyboard/first_last_frame/standard — not a pricing param (lives outside paramsSchema), only
   * needed here to restore the pre-refactor behavior of hiding the duration/seconds stepper in
   * storyboard mode (each storyboard clip has its own duration, so a single global stepper doesn't
   * apply — phase-3 review Minor 6).
   */
  mode: VideoWorkspaceMode;
  paramsSchema: ParamsSchema | undefined;
  pricingSchema: PricingSchema | undefined;
  pricingContext: { multiplier: number; discountFactor: number };
  /** 非计价参数（音频开关/seed）读写的全局视频参数包，见下方保留区块。 */
  clipParams: Record<string, unknown>;
  hasClip: boolean;
  onClose: () => void;
  onParamsChange: (params: Record<string, unknown>) => void;
  onClipParamChange: (partial: Record<string, unknown>, removeKeys?: string[]) => void;
}) {
  const t = useTranslations('videoWorkbench.parameterPanel');
  const tParams = useTranslations('pricing.params');
  const tOptions = useTranslations('pricing.options');
  const tTotal = useTranslations('pricing');

  // 用当前 clip 参数(反向映射，seconds←duration 等)作为表单初始值，并在 clipParams 被外部
  // 改动(切换 clip/历史恢复)时同步进表单——否则表单会用 schema 默认值覆盖已有 clip 设置(P1-3)。
  const externalParams = useMemo(
    () => videoClipParamsToSchemaParams(clipParams),
    [clipParams.duration, clipParams.resolution, clipParams.ratio],
  );
  const form = useSchemaForm(paramsSchema, externalParams);

  // 双向同步：外部 clipParams 变化 -> 表单；用户改表单 -> 上抛给父组件正向映射回 clip 参数。
  // 跳过挂载与外部同步的回声，避免默认值覆盖设置或 clipParams->form->clipParams 死循环。
  useSchemaFormExternalSync(form, externalParams, onParamsChange);

  // spec §6.8: schema 拉取失败 -> 禁用生成，不 fallback 到硬编码默认值。
  const schemaMissing = !paramsSchema || !pricingSchema;

  if (schemaMissing) {
    return (
      <aside className={cn('min-h-0 border-r border-border bg-muted/14 p-4 text-xs text-muted-foreground', open ? 'flex' : 'hidden', 'xl:flex')}>
        {t('schemaUnavailable')}
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        'min-h-0 border-r border-border bg-muted/14',
        open
          ? 'fixed inset-y-0 left-0 z-40 flex w-[min(92vw,360px)] flex-col bg-background shadow-xl'
          : 'hidden',
        'xl:static xl:z-auto xl:flex xl:flex-col xl:bg-muted/14 xl:shadow-none',
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <SlidersHorizontal className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{t('title')}</h2>
            <p className="truncate text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
          <button
            type="button"
            aria-label={t('closeAria')}
            className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground xl:hidden"
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
            hiddenFields={mode === 'storyboard' ? STORYBOARD_HIDDEN_FIELDS : undefined}
          />

          {/* 音频开关 + seed 不是计价参数（不在 videoPreset.paramsSchema 里），
              SchemaForm 渲染不出来，但真实生成链路仍然读它们
              （buildVideoEstimateInput 的 hasAudioInput / clip.params.seed）——
              保留自 63fa1100 版 VideoParameterPanel，绑定到同一个
              clipParams/onClipParamChange，只去掉了已经上移到 SchemaForm 里的
              时长/分辨率/比例控件。 */}
          <section className="space-y-3">
            <PanelLabel icon={<SlidersHorizontal className="size-3.5" />} label={t('basicsLabel')} />
            <ParamCardGroup
              label={t('audioLabel')}
              value={clipParams.generateAudio === false || clipParams.generate_audio === false ? 'off' : 'on'}
              options={[
                { label: t('audioOn'), value: 'on' },
                { label: t('audioOff'), value: 'off' },
              ]}
              onChange={(value) => onClipParamChange({ generateAudio: value === 'on' }, ['generate_audio'])}
              disabled={!hasClip}
            />
            <label className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">{t('seedLabel')}</span>
              <input
                className="h-9 rounded-md border border-border bg-background px-3 outline-none focus:border-primary"
                placeholder={t('seedPlaceholder')}
                value={clipParams.seed == null ? '' : String(clipParams.seed)}
                onChange={(event) => {
                  const value = event.target.value.trim();
                  onClipParamChange(value ? { seed: Number(value) } : {}, ['seed']);
                }}
                disabled={!hasClip}
              />
            </label>
          </section>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <TotalPriceBar
          taskType={taskType}
          modelConfigId={modelConfigId}
          params={form.params}
          translateTotal={(total) => (total === null ? '' : tTotal('totalPoints', { count: total }))}
        />
      </div>
    </aside>
  );
}
