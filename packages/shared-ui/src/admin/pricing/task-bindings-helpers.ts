import type {
  ModelConfigItem,
  TaskDefinition,
  TaskModelBinding,
  UpdateTaskModelBindingInput,
} from '@autix/shared-store';
import { hasChatCapability, hasImageCapability, isVideoModel } from '@autix/domain';

export type BindingStatusFilter = 'all' | 'active' | 'inactive';

export interface BindingDraft {
  multiplierText?: string;
  isActive?: boolean;
}

export type BindingDraftMap = Record<string, BindingDraft>;
export type DefaultDraftMap = Record<string, string>;

export interface TaskBindingPatch {
  taskType: string;
  modelConfigId: string;
  data: Pick<UpdateTaskModelBindingInput, 'multiplier' | 'isDefault' | 'isActive'>;
}

export interface TaskBindingSummary {
  taskType: string;
  name: string;
  category: TaskDefinition['category'] | 'other';
  isTaskActive: boolean;
  totalCount: number;
  activeCount: number;
  defaultModelName: string | null;
}

export interface AddModelsBatchResult {
  succeededIds: string[];
  failedIds: string[];
}

export function bindingDraftKey(taskType: string, modelConfigId: string): string {
  return `${taskType}\u0000${modelConfigId}`;
}

export function formatMultiplier(value: string | number): string {
  const multiplier = Number(value);
  return Number.isFinite(multiplier) ? String(multiplier) : String(value);
}

export async function addTaskModelsSequentially(
  modelConfigIds: string[],
  hasDefault: boolean,
  addModel: (modelConfigId: string, isDefault: boolean) => Promise<unknown>,
): Promise<AddModelsBatchResult> {
  const succeededIds: string[] = [];
  const failedIds: string[] = [];
  let defaultAssigned = hasDefault;

  for (const modelConfigId of modelConfigIds) {
    const shouldSetDefault = !defaultAssigned;
    try {
      await addModel(modelConfigId, shouldSetDefault);
      if (shouldSetDefault) defaultAssigned = true;
      succeededIds.push(modelConfigId);
    } catch {
      failedIds.push(modelConfigId);
    }
  }

  return { succeededIds, failedIds };
}

export function applyBulkBindingDraft(
  current: BindingDraftMap,
  rows: TaskModelBinding[],
  selectedModelConfigIds: Set<string>,
  patch: BindingDraft,
  protectedDefaultId?: string,
): { drafts: BindingDraftMap; skippedDefault: boolean } {
  const next = { ...current };
  let skippedDefault = false;

  for (const row of rows) {
    if (!selectedModelConfigIds.has(row.modelConfigId)) continue;
    if (patch.isActive === false && row.modelConfigId === protectedDefaultId) {
      skippedDefault = true;
      continue;
    }

    const key = bindingDraftKey(row.taskType, row.modelConfigId);
    const nextDraft = { ...(next[key] ?? {}), ...patch };
    if (
      nextDraft.multiplierText !== undefined
      && Number(nextDraft.multiplierText) === Number(row.multiplier)
      && nextDraft.multiplierText.trim()
    ) {
      delete nextDraft.multiplierText;
    }
    if (nextDraft.isActive === row.isActive) delete nextDraft.isActive;
    if (Object.keys(nextDraft).length === 0) delete next[key];
    else next[key] = nextDraft;
  }

  return { drafts: next, skippedDefault };
}

export function buildTaskBindingSummaries(
  bindings: TaskModelBinding[],
  definitions: TaskDefinition[],
): TaskBindingSummary[] {
  const rowsByTask = new Map<string, TaskModelBinding[]>();
  for (const binding of bindings) {
    const rows = rowsByTask.get(binding.taskType) ?? [];
    rows.push(binding);
    rowsByTask.set(binding.taskType, rows);
  }

  const definitionByTask = new Map(definitions.map((definition) => [definition.taskType, definition]));
  const orderedTaskTypes = [
    ...definitions
      .slice()
      .sort((a, b) => a.sort - b.sort || a.taskType.localeCompare(b.taskType))
      .map((definition) => definition.taskType),
    ...Array.from(rowsByTask.keys())
      .filter((taskType) => !definitionByTask.has(taskType))
      .sort(),
  ];

  return orderedTaskTypes.map((taskType) => {
    const definition = definitionByTask.get(taskType);
    const rows = rowsByTask.get(taskType) ?? [];
    const defaultBinding = rows.find((row) => row.isDefault);
    return {
      taskType,
      name: definition?.name || taskType,
      category: definition?.category ?? 'other',
      isTaskActive: definition?.isActive ?? true,
      totalCount: rows.length,
      activeCount: rows.filter((row) => row.isActive).length,
      defaultModelName: defaultBinding?.modelName || defaultBinding?.model || null,
    };
  });
}

export function filterTaskBindings(
  rows: TaskModelBinding[],
  query: string,
  status: BindingStatusFilter,
  drafts: BindingDraftMap,
): TaskModelBinding[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const draft = drafts[bindingDraftKey(row.taskType, row.modelConfigId)];
    const isActive = draft?.isActive ?? row.isActive;
    if (status === 'active' && !isActive) return false;
    if (status === 'inactive' && isActive) return false;
    if (!normalizedQuery) return true;
    return [row.modelName, row.model, row.modelConfigId]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

export function filterAddableModels(
  models: ModelConfigItem[],
  boundModelConfigIds: Set<string>,
  category: TaskBindingSummary['category'],
  query: string,
): ModelConfigItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return models
    .filter((model) => model.isActive !== false && !boundModelConfigIds.has(model.id))
    .filter((model) => {
      const capabilities = model.capabilities ?? [];
      if (category === 'image') {
        return hasImageCapability(capabilities) || Boolean(model.metadata?.imageModelKind);
      }
      if (category === 'video') return isVideoModel(model);
      if (category === 'chat' || category === 'prompt') {
        return model.type !== 'embedding'
          && hasChatCapability(capabilities)
          && !hasImageCapability(capabilities)
          && !model.metadata?.imageModelKind
          && !isVideoModel(model);
      }
      return model.type !== 'embedding';
    })
    .filter((model) => {
      if (!normalizedQuery) return true;
      return [model.name, model.model, model.provider]
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.model.localeCompare(b.model));
}

export function buildTaskBindingPatches(
  bindings: TaskModelBinding[],
  drafts: BindingDraftMap,
  defaultDrafts: DefaultDraftMap,
): { patches: TaskBindingPatch[]; invalidKeys: string[] } {
  const bindingByKey = new Map(
    bindings.map((binding) => [bindingDraftKey(binding.taskType, binding.modelConfigId), binding]),
  );
  const patchByKey = new Map<string, TaskBindingPatch>();
  const invalidKeys: string[] = [];

  for (const [key, draft] of Object.entries(drafts)) {
    const binding = bindingByKey.get(key);
    if (!binding) continue;
    const data: TaskBindingPatch['data'] = {};

    if (draft.multiplierText !== undefined) {
      const multiplier = Number(draft.multiplierText);
      if (!draft.multiplierText.trim() || !Number.isFinite(multiplier) || multiplier <= 0) {
        invalidKeys.push(key);
      } else if (multiplier !== Number(binding.multiplier)) {
        data.multiplier = multiplier;
      }
    }
    if (draft.isActive !== undefined && draft.isActive !== binding.isActive) {
      data.isActive = draft.isActive;
    }
    if (Object.keys(data).length > 0) {
      patchByKey.set(key, {
        taskType: binding.taskType,
        modelConfigId: binding.modelConfigId,
        data,
      });
    }
  }

  for (const [taskType, modelConfigId] of Object.entries(defaultDrafts)) {
    const currentDefault = bindings.find((binding) => binding.taskType === taskType && binding.isDefault);
    if (currentDefault?.modelConfigId === modelConfigId) continue;
    const key = bindingDraftKey(taskType, modelConfigId);
    const target = bindingByKey.get(key);
    if (!target) continue;
    const existing = patchByKey.get(key);
    patchByKey.set(key, {
      taskType,
      modelConfigId,
      data: { ...(existing?.data ?? {}), isDefault: true },
    });
  }

  const patches = Array.from(patchByKey.values()).sort(
    (left, right) => Number(Boolean(right.data.isDefault)) - Number(Boolean(left.data.isDefault)),
  );
  return { patches, invalidKeys };
}
