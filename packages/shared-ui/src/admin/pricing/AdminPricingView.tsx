'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAdminDiscountsQuery,
  useAdminSystemModelsQuery,
  useAdminTaskDefinitionsQuery,
  useAdminTaskModelBindingsQuery,
  useCreateAdminTaskModelBindingMutation,
  useCreateAdminDiscountMutation,
  useDeleteAdminDiscountMutation,
  useUpdateAdminDiscountMutation,
  useUpdateAdminTaskModelBindingMutation,
} from '@autix/shared-store';
import { TaskBindingsView } from './task-bindings-view';
import { DiscountsView } from './discounts-view';
import { PricingExcelScalars } from './pricing-excel-scalars';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import type { TaskBindingPatch } from './task-bindings-helpers';

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

  const { data: bindings = [], isLoading: bindingsLoading } = useAdminTaskModelBindingsQuery();
  const { data: taskDefinitions = [], isLoading: taskDefinitionsLoading } = useAdminTaskDefinitionsQuery();
  const { data: discounts = [] } = useAdminDiscountsQuery();
  const { data: systemModels = [], isLoading: systemModelsLoading } = useAdminSystemModelsQuery();

  const [discountError, setDiscountError] = useState<string | null>(null);
  const [bindingError, setBindingError] = useState<string | null>(null);
  const [addBindingError, setAddBindingError] = useState<string | null>(null);

  const updateBinding = useUpdateAdminTaskModelBindingMutation({
    onError: (error) => setBindingError(mutationErrorMessage(error, t('bindings.saveFailed'))),
  });
  const createBinding = useCreateAdminTaskModelBindingMutation({
    onError: (error) => setAddBindingError(mutationErrorMessage(error, t('bindings.addFailed'))),
  });
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

  const saveBindingPatches = async (patches: TaskBindingPatch[]) => {
    setBindingError(null);
    for (const patch of patches) {
      await updateBinding.mutateAsync({
        taskType: patch.taskType,
        modelConfigId: patch.modelConfigId,
        data: patch.data,
      });
    }
  };

  const addTaskModel = async (
    taskType: string,
    modelConfigId: string,
    multiplier: number,
    isDefault: boolean,
  ) => {
    await createBinding.mutateAsync({ taskType, modelConfigId, multiplier, isDefault });
  };

  return (
    <Tabs defaultValue="bindings" className="h-full min-h-0 gap-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">{t('pageTitle')}</h1>
          <p className="text-xs text-muted-foreground">{t('pageDescription')}</p>
        </div>
        <TabsList className="h-9 rounded-md bg-muted/60">
          <TabsTrigger value="bindings">{t('bindingsHeading')}</TabsTrigger>
          <TabsTrigger value="discounts">{t('discountsHeading')}</TabsTrigger>
          <TabsTrigger value="excel">{t('excelHeading')}</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="bindings" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
        <TaskBindingsView
          bindings={bindings}
          taskDefinitions={taskDefinitions}
          loading={taskDefinitionsLoading || bindingsLoading}
          saving={updateBinding.isPending}
          error={bindingError}
          availableModels={systemModels}
          modelsLoading={systemModelsLoading}
          adding={createBinding.isPending}
          addError={addBindingError}
          onSave={saveBindingPatches}
          onAddModel={addTaskModel}
          onClearError={() => setBindingError(null)}
          onClearAddError={() => setAddBindingError(null)}
        />
      </TabsContent>

      <TabsContent value="discounts" forceMount className="min-h-0 flex-1 overflow-y-auto p-4 data-[state=inactive]:hidden">
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
      </TabsContent>

      <TabsContent value="excel" forceMount className="min-h-0 flex-1 overflow-y-auto py-3 data-[state=inactive]:hidden">
        <PricingExcelScalars
          bindings={bindings}
          discounts={discounts}
          onUpdateBinding={(taskType, modelConfigId, patch) =>
            updateBinding.mutateAsync({ taskType, modelConfigId, data: patch })
          }
          onUpdateDiscount={(id, patch) => updateDiscount.mutateAsync({ id, data: patch })}
        />
      </TabsContent>
    </Tabs>
  );
}
