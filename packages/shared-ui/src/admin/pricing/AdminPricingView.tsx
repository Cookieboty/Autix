'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAdminDiscountsQuery,
  useAdminTaskModelBindingsQuery,
  useCreateAdminDiscountMutation,
  useDeleteAdminDiscountMutation,
  useUpdateAdminDiscountMutation,
  useUpdateAdminTaskModelBindingMutation,
} from '@autix/shared-store';
import { TaskBindingsView } from './task-bindings-view';
import { DiscountsView } from './discounts-view';
import { PricingExcelScalars } from './pricing-excel-scalars';

/** Mirrors `mutationErrorMessage` in `task-costs-view.tsx` — axios errors surface a backend
 * `{ message }` body; fall back to the generic Error#message, then to the i18n fallback. */
function mutationErrorMessage(error: unknown, fallback: string) {
  const axiosErr = error as { response?: { data?: { message?: string } }; message?: string };
  return axiosErr?.response?.data?.message ?? axiosErr?.message ?? fallback;
}

/**
 * Container for the cross-model "task pricing" admin surface: task-model bindings, discounts, and
 * the bulk CSV Excel scalars. Orchestrates data fetching and save wiring (via the
 * `@autix/shared-store` pricing-admin query/mutation hooks); the child views only collect local
 * form state and report it upward — same split as `task-costs-view.tsx`'s `AdminTaskCostsView`.
 *
 * Per-model schema editing (params/pricing schema + dry-run) used to live here behind a model
 * picker, but has moved into the model config form itself
 * (`packages/shared-ui/src/admin/system/SystemModelFormSheet.tsx`) so editing a model and its
 * pricing schema is a single unified-save flow. See that file (and `models-view.tsx`) for the
 * `ModelSchemaEditor` embedding.
 */
export function AdminPricingView() {
  const t = useTranslations('adminPricing');

  const { data: bindings = [] } = useAdminTaskModelBindingsQuery();
  const { data: discounts = [] } = useAdminDiscountsQuery();

  const [discountError, setDiscountError] = useState<string | null>(null);

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
