'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Check,
  Edit2,
  Globe,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  Button,
} from '../../ui';
import {
  useAdminModelQuery,
  useAdminSystemMembershipLevelsQuery,
  useAdminSystemModelsQuery,
  useCreateAdminSystemModelMutation,
  useDeleteAdminSystemModelMutation,
  useDryRunAdminPricingMutation,
  useSaveAdminModelSchemasMutation,
  useUpdateAdminSystemModelMutation,
  type ModelConfigItem,
  type MembershipLevel,
  type ParamsSchema,
  type PricingSchema,
} from '@autix/shared-store';
import { parseJsonOrNull } from '../pricing/pricing-admin-helpers';
import { SystemModelFormSheet } from './SystemModelFormSheet';
import {
  buildSystemModelPayload,
  createEmptySystemModelForm,
  groupSystemModels,
  readModelError,
  seedSystemModelFormSchemas,
  systemModelFormFromModel,
  type SystemModelForm,
} from './system-models-helpers';

export function AdminSystemModelsView() {
  const t = useTranslations('adminSystemModels');
  const tCommon = useTranslations('common');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<SystemModelForm>(() =>
    createEmptySystemModelForm(),
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const modelsQuery = useAdminSystemModelsQuery();
  const membershipLevelsQuery = useAdminSystemMembershipLevelsQuery();
  const createModelMutation = useCreateAdminSystemModelMutation();
  const updateModelMutation = useUpdateAdminSystemModelMutation();
  const deleteModelMutation = useDeleteAdminSystemModelMutation();
  // Backs the paramsSchema/pricingSchema editors embedded in the model form (unified save —
  // product decision: one save button persists the model AND its schemas). Only enabled while
  // editing an existing model with the drawer open; a brand-new model has no server-side schema
  // to fetch (createEmptySystemModelForm already seeds `schemaLoaded: true` with defaults).
  const modelDetailQuery = useAdminModelQuery(form.id ?? '', drawerOpen && Boolean(form.id));
  const saveSchemasMutation = useSaveAdminModelSchemasMutation();
  const dryRunMutation = useDryRunAdminPricingMutation();
  const models = modelsQuery.data ?? [];
  const membershipLevels = (membershipLevelsQuery.data ?? [])
    .filter((level) => level.isActive !== false);
  const loading = modelsQuery.isLoading || modelsQuery.isFetching;
  const queryError = modelsQuery.error
    ? readModelError(modelsQuery.error, t('loadFailed'))
    : null;
  const displayError = error ?? queryError;

  const groupedModels = useMemo(() => groupSystemModels(models), [models]);

  const openCreate = () => {
    setForm(createEmptySystemModelForm());
    setDrawerOpen(true);
  };

  const openEdit = (model: ModelConfigItem) => {
    const allowedMembershipLevelIds = membershipLevelsQuery.data
      ? new Set(membershipLevels.map((level) => level.id))
      : undefined;
    setForm(systemModelFormFromModel(model, { allowedMembershipLevelIds }));
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setForm(createEmptySystemModelForm());
  };

  // Seeds the schema editors from the loaded AdminModelDetail exactly once per edit session.
  // `seedSystemModelFormSchemas` no-ops if the detail belongs to a different model (stale
  // response after navigating away) or the form was already seeded (avoids clobbering in-flight
  // edits on a background refetch) — see its doc comment in system-models-helpers.ts.
  useEffect(() => {
    if (!drawerOpen || !form.id || form.schemaLoaded) return;
    const detail = modelDetailQuery.data;
    if (!detail) return;
    setForm((prev) => seedSystemModelFormSchemas(prev, detail));
  }, [drawerOpen, form.id, form.schemaLoaded, modelDetailQuery.data]);

  const save = async () => {
    if (!form.model.trim()) return;
    const paramsSchema = parseJsonOrNull(form.paramsSchemaText) as ParamsSchema | null;
    const pricingSchema = parseJsonOrNull(form.pricingSchemaText) as PricingSchema | null;
    if (!paramsSchema || !pricingSchema) {
      setError(t('invalidSchemaJson'));
      return;
    }

    setSaving(true);
    setError(null);
    // Captured up front — `form.id` in the enclosing closure never mutates during this call
    // even after the `setForm` promotion below, so this is the one reliable way to tell the
    // create and edit paths apart for the error message picked in the schema catch block.
    const wasCreate = !form.id;
    try {
      const payload = buildSystemModelPayload(form);
      let modelId = form.id;

      if (modelId) {
        // Edit path: the model already has an id, so the update and the schema save are two
        // independent PUTs against the same resource. Update first — if it fails, bail out
        // before touching the schema endpoint at all (surfaces the model-field error as-is,
        // same as before this change).
        await updateModelMutation.mutateAsync({ id: modelId, data: payload });
      } else {
        // Create path: there is no id to save schemas against until the model itself exists.
        // If create fails, throw before ever calling the schemas endpoint.
        const created = await createModelMutation.mutateAsync(payload);
        const createdId = created?.data?.id;
        if (!createdId) {
          throw new Error(t('saveFailed'));
        }
        modelId = createdId;
        // Promote the form to "editing this model" immediately so that if the schema save below
        // fails, a retry (or just re-opening this same drawer state) PUTs the schema against the
        // real id instead of POSTing a duplicate model.
        setForm((prev) => ({ ...prev, id: createdId }));
      }

      try {
        await saveSchemasMutation.mutateAsync({
          id: modelId,
          data: { paramsSchema, pricingSchema },
        });
      } catch (schemaErr) {
        // Model create/update already succeeded at this point — report the partial state
        // explicitly instead of swallowing it, and keep the drawer open (now promoted to "edit"
        // mode for the create path, since `form.id` was just set to `createdId` above) so the
        // admin can retry just the schema save without re-entering the model fields.
        const schemaMessage = readModelError(schemaErr, t('schemaSaveFailed'));
        setError(
          wasCreate
            ? t('modelCreatedSchemaFailed', { error: schemaMessage })
            : t('schemaSaveFailedAfterUpdate', { error: schemaMessage }),
        );
        return;
      }

      closeDrawer();
    } catch (err) {
      setError(readModelError(err, t('saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await deleteModelMutation.mutateAsync(id);
      setDeletingId(null);
    } catch (err) {
      setError(readModelError(err, t('deleteFailed')));
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-border flex items-center justify-between gap-4 border-b pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-foreground text-lg font-semibold">{t('title')}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('description')}
            </p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t('addModel')}
        </Button>
      </div>

      {displayError && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-lg border px-4 py-3 text-sm">
          {displayError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-5">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="bg-muted h-36 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : models.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3">
            <Globe className="text-muted-foreground h-12 w-12 opacity-25" />
            <p className="text-muted-foreground text-sm">{t('empty')}</p>
          </div>
        ) : (
          <div className="space-y-7">
            {Object.entries(groupedModels).map(([type, items]) => (
              <section key={type} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.18em]">
                    {type}
                  </span>
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                    {items.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((model) => (
                    <SystemModelCard
                      key={model.id}
                      model={model}
                      membershipLevels={membershipLevels}
                      deletingId={deletingId}
                      onEdit={openEdit}
                      onDelete={setDeletingId}
                      onCancelDelete={() => setDeletingId(null)}
                      onConfirmDelete={remove}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <SystemModelFormSheet
        form={form}
        open={drawerOpen}
        saving={saving}
        membershipLevels={membershipLevels}
        membershipLevelsLoading={
          membershipLevelsQuery.isLoading || membershipLevelsQuery.isFetching
        }
        t={t}
        tCommon={tCommon}
        onClose={closeDrawer}
        onFormChange={setForm}
        onDryRun={(dryRunPayload) => dryRunMutation.mutateAsync(dryRunPayload)}
        onSave={() => void save()}
      />
    </div>
  );
}

function SystemModelCard({
  model,
  membershipLevels,
  deletingId,
  onEdit,
  onDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  model: ModelConfigItem;
  membershipLevels: MembershipLevel[];
  deletingId: string | null;
  onEdit: (model: ModelConfigItem) => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
}) {
  const t = useTranslations('adminSystemModels');
  const isDeleting = deletingId === model.id;
  const isActive = (model as { isActive?: boolean }).isActive ?? true;
  const accessLabel = formatModelMembershipAccess(model, membershipLevels, t);

  return (
    <div className="border-border bg-card flex min-h-[154px] flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-foreground truncate text-sm font-semibold">{model.name}</h3>
            {model.isDefault && (
              <span className="bg-primary text-primary-foreground rounded px-1.5 py-0.5 text-[10px]">
                {t('defaultBadge')}
              </span>
            )}
            {!isActive && (
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                {t('inactiveBadge')}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1 truncate font-mono text-xs">{model.model}</p>
        </div>
        {isDeleting ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              className="bg-destructive h-8 w-8 p-0 text-white"
              onClick={() => onConfirmDelete(model.id)}
              aria-label={t('confirmDelete')}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={onCancelDelete}
              aria-label={t('cancelDelete')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => onEdit(model)}
              aria-label={t('editAction')}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:text-destructive"
              onClick={() => onDelete(model.id)}
              aria-label={t('deleteAction')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">{model.provider}</span>
        <span className="text-muted-foreground/60 text-xs">·</span>
        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
          priority {model.priority}
        </span>
      </div>

      <p className="text-muted-foreground truncate text-xs">{accessLabel}</p>

      {model.capabilities.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1">
          {model.capabilities.map((capability) => (
            <span
              key={capability}
              className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]"
            >
              {capability}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatModelMembershipAccess(
  model: ModelConfigItem,
  membershipLevels: MembershipLevel[],
  t: (key: string, values?: Record<string, string | number | Date>) => string,
) {
  const allowedLevelIds = (model.allowedMembershipLevels ?? [])
    .map((item) => item.levelId ?? item.level?.id)
    .filter((levelId): levelId is string => typeof levelId === 'string' && levelId.length > 0);
  if (allowedLevelIds.length === 0) return t('membershipAccessAll');

  const byId = new Map(membershipLevels.map((level) => [level.id, level.name]));
  const names = allowedLevelIds.map((id) => byId.get(id) ?? id);
  return t('membershipAccessLimited', { levels: names.join(', ') });
}
