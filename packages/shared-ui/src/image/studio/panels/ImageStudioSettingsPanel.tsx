'use client';

import { Wand2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import { SchemaForm, TotalPriceBar, useSchemaForm } from '../../../pricing';
import { cn } from '../../../ui/utils';

export function ImageStudioSettingsPanel({
  open,
  taskType,
  modelConfigId,
  paramsSchema,
  pricingSchema,
  pricingContext,
  onClose,
  onParamsChange,
}: {
  open: boolean;
  taskType: string;
  modelConfigId: string | undefined;
  paramsSchema: ParamsSchema | undefined;
  pricingSchema: PricingSchema | undefined;
  pricingContext: { multiplier: number; discountFactor: number };
  onClose: () => void;
  onParamsChange: (params: Record<string, unknown>) => void;
}) {
  const t = useTranslations('imageStudio');
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
      </div>

      <div className="border-t border-border px-4 py-3">
        <TotalPriceBar
          taskType={taskType}
          modelConfigId={modelConfigId}
          params={form.params}
          onQuote={() => onParamsChange(form.params)}
          translateTotal={(total) => (total === null ? '' : tTotal('totalPoints', { count: total }))}
        />
      </div>
    </aside>
  );
}
