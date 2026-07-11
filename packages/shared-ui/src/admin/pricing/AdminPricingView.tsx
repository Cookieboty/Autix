'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAdminDiscountsQuery,
  useAdminModelQuery,
  useAdminSystemModelsQuery,
  useAdminTaskModelBindingsQuery,
  useCreateAdminDiscountMutation,
  useDeleteAdminDiscountMutation,
  useDryRunAdminPricingMutation,
  useSaveAdminModelSchemasMutation,
  useUpdateAdminDiscountMutation,
  useUpdateAdminTaskModelBindingMutation,
  type ModelConfigItem,
} from '@autix/shared-store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';
import { ModelSchemaEditor } from './model-schema-editor';
import { TaskBindingsView } from './task-bindings-view';
import { DiscountsView } from './discounts-view';
import { PricingExcelScalars } from './pricing-excel-scalars';

/** Mirrors `mutationErrorMessage` in `task-costs-view.tsx` — axios errors surface a backend
 * `{ message }` body; fall back to the generic Error#message, then to the i18n fallback. */
function mutationErrorMessage(error: unknown, fallback: string) {
  const axiosErr = error as { response?: { data?: { message?: string } }; message?: string };
  return axiosErr?.response?.data?.message ?? axiosErr?.message ?? fallback;
}

function modelLabel(model: ModelConfigItem) {
  return `${model.name} (${model.provider}/${model.model})`;
}

/**
 * Container for the phase-3 schema-driven admin pricing surface. Orchestrates data fetching and
 * save wiring (via the `@autix/shared-store` pricing-admin query/mutation hooks); the four child
 * views only collect local form state and report it upward — same split as
 * `task-costs-view.tsx`'s `AdminTaskCostsView`.
 *
 * There is no `GET /admin/models` list endpoint (only `getModel(id)`), so the model picker reuses
 * the existing admin model list (`useAdminSystemModelsQuery`, backed by `GET /api/models/system`)
 * that `AdminTaskCostsView`/the system-models admin page already consume. The selected model's
 * editable schema state is then fetched individually via `useAdminModelQuery`.
 */
export function AdminPricingView() {
  const t = useTranslations('adminPricing');
  const tCommon = useTranslations('common');

  const { data: systemModels = [] } = useAdminSystemModelsQuery();
  const { data: bindings = [] } = useAdminTaskModelBindingsQuery();
  const { data: discounts = [] } = useAdminDiscountsQuery();

  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const effectiveModelId = selectedModelId ?? systemModels[0]?.id ?? null;
  const selectedModel = systemModels.find((model) => model.id === effectiveModelId) ?? null;

  const { data: modelDetail } = useAdminModelQuery(effectiveModelId ?? '', Boolean(effectiveModelId));

  const [discountError, setDiscountError] = useState<string | null>(null);

  const saveSchemas = useSaveAdminModelSchemasMutation();
  const dryRun = useDryRunAdminPricingMutation();
  const updateBinding = useUpdateAdminTaskModelBindingMutation();
  const createDiscount = useCreateAdminDiscountMutation({
    onError: (error) => setDiscountError(mutationErrorMessage(error, t('discounts.saveFailed'))),
  });
  const updateDiscount = useUpdateAdminDiscountMutation({
    onError: (error) => setDiscountError(mutationErrorMessage(error, t('discounts.saveFailed'))),
  });
  const deleteDiscount = useDeleteAdminDiscountMutation({
    onError: (error) => setDiscountError(mutationErrorMessage(error, t('discounts.deleteFailed'))),
  });

  const discountsSaving = createDiscount.isPending || updateDiscount.isPending || deleteDiscount.isPending;

  return (
    <div className="flex h-full flex-col gap-8 overflow-y-auto p-4">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{t('modelsHeading')}</h2>
          <Select value={effectiveModelId ?? undefined} onValueChange={(value) => setSelectedModelId(value)}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={t('selectModel')} />
            </SelectTrigger>
            <SelectContent>
              {systemModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {modelLabel(model)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedModel && !modelDetail && (
          <p className="text-xs text-muted-foreground">{tCommon('loading')}</p>
        )}
        {selectedModel && modelDetail && (
          <ModelSchemaEditor
            // Remount once `modelDetail` finishes loading, and again on every subsequent save
            // (phase-3 review Finding 3) — ModelSchemaEditor seeds its Monaco text buffers from
            // `initial*Schema` only once via useState, and `modelDetail` (from `useAdminModelQuery`,
            // a plain react-query fetch with no `keepPreviousData`) resolves asynchronously after
            // mount and goes back to `undefined` while switching models. Keying on
            // `selectedModel.id` alone remounts on model switch, but without also gating the render
            // on `modelDetail` being loaded (above) the editor would mount with `modelDetail` still
            // `undefined` -> seed from `null` -> empty schema, and never re-seed once the real
            // schema arrived — an admin could Save that empty state and clobber the real schemas.
            // `schemaVersion` changes whenever a save succeeds, so folding it into the key also
            // forces a fresh mount (re-seeded from the freshly saved schema) after Save.
            key={`${selectedModel.id}:${modelDetail.schemaVersion}`}
            modelConfigId={selectedModel.id}
            initialParamsSchema={modelDetail.paramsSchema}
            initialPricingSchema={modelDetail.pricingSchema}
            onSave={async (paramsSchema, pricingSchema) => {
              await saveSchemas.mutateAsync({
                id: selectedModel.id,
                data: { paramsSchema, pricingSchema },
              });
            }}
            onDryRun={(payload) => dryRun.mutateAsync(payload)}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t('bindingsHeading')}</h2>
        <TaskBindingsView
          bindings={bindings}
          onUpdate={(taskType, modelConfigId, patch) =>
            updateBinding.mutate({ taskType, modelConfigId, data: patch })
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t('discountsHeading')}</h2>
        <DiscountsView
          discounts={discounts}
          saving={discountsSaving}
          error={discountError}
          onCreate={(data) => {
            setDiscountError(null);
            createDiscount.mutate(data);
          }}
          onUpdate={(id, data) => {
            setDiscountError(null);
            updateDiscount.mutate({ id, data });
          }}
          onDelete={(id) => {
            setDiscountError(null);
            deleteDiscount.mutate(id);
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t('excelHeading')}</h2>
        <PricingExcelScalars
          bindings={bindings}
          discounts={discounts}
          onUpdateBinding={(taskType, modelConfigId, patch) =>
            updateBinding.mutateAsync({ taskType, modelConfigId, data: patch })
          }
          onUpdateDiscount={(id, patch) => updateDiscount.mutateAsync({ id, data: patch })}
        />
      </section>
    </div>
  );
}
