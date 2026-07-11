import type {
  AdminSystemModelInput,
  LocalizedText,
  ModelConfigItem,
  ParamsSchema,
  PricingSchema,
} from '@autix/shared-store';

/**
 * Default empty schema shapes for a brand-new model, kept here (not imported from
 * `pricing/model-schema-editor.tsx`) so this plain helper module — pulled in by
 * `admin-system-models-helpers.test.ts` under `bun test` — never has to load the schema
 * editor's React/Monaco module graph just to read two JSON literals.
 */
export const DEFAULT_PARAMS_SCHEMA: ParamsSchema = { type: 'object', properties: {} };
export const DEFAULT_PRICING_SCHEMA: PricingSchema = { terms: [] };

export const CAPABILITY_OPTIONS = [
  { value: 'text', key: 'text' },
  { value: 'vision', key: 'vision' },
  { value: 'voice', key: 'voice' },
  { value: 'speech', key: 'speech' },
  { value: 'code', key: 'code' },
  { value: 'reasoning', key: 'reasoning' },
  { value: 'image', key: 'image' },
  { value: 'video', key: 'video' },
  { value: 'embedding', key: 'embedding' },
];

export const MODEL_TYPES = ['general', 'code', 'intent', 'embedding', 'video'];

export type SystemModelForm = {
  id?: string;
  name: string;
  model: string;
  provider: string;
  type: string;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
  capabilities: string[];
  allowedMembershipLevelIds: string[];
  baseUrl: string;
  apiKey: string;
  credentialFieldsDirty: {
    baseUrl: boolean;
    apiKey: boolean;
  };
  /** Raw Monaco JSON text for the params/pricing schema editors embedded in the model form
   * (unified save persists these alongside the model fields — see models-view.tsx `save()`). */
  paramsSchemaText: string;
  pricingSchemaText: string;
  /**
   * Multi-locale model description (`model_configs.description`), edited via a per-locale field
   * in the model form. Persisted through its own endpoint (`PUT /admin/models/:id/description`)
   * as part of the same unified save — see models-view.tsx `save()`. Like the schema fields below,
   * `ModelConfigItem` (the list-view shape) doesn't carry this, so it's only ever populated from
   * `AdminModelDetail` (`useAdminModelQuery`), gated by `schemaLoaded`.
   */
  description: LocalizedText;
  /**
   * True once the schema editors and description fields are safe to render/save. A brand-new
   * model has no server-side schema/description to wait on, so this starts `true` from
   * `createEmptySystemModelForm`. An existing model's schema/description is fetched asynchronously
   * (`useAdminModelQuery`) — `systemModelFormFromModel` starts this `false` and the container
   * flips it to `true` only after seeding `paramsSchemaText`/`pricingSchemaText`/`description`
   * from the loaded detail, so an empty editor can never mount and have its blank text saved over
   * the real schema/description.
   */
  schemaLoaded: boolean;
};

export function createEmptySystemModelForm(): SystemModelForm {
  return {
    name: '',
    model: '',
    provider: 'openai',
    type: 'general',
    priority: 0,
    isDefault: false,
    isActive: true,
    capabilities: ['text'],
    allowedMembershipLevelIds: [],
    baseUrl: '',
    apiKey: '',
    credentialFieldsDirty: {
      baseUrl: false,
      apiKey: false,
    },
    paramsSchemaText: JSON.stringify(DEFAULT_PARAMS_SCHEMA, null, 2),
    pricingSchemaText: JSON.stringify(DEFAULT_PRICING_SCHEMA, null, 2),
    description: {},
    schemaLoaded: true,
  };
}

export function systemModelFormFromModel(
  model: ModelConfigItem,
  options: { allowedMembershipLevelIds?: Set<string> } = {},
): SystemModelForm {
  const allowedMembershipLevelIds = (model.allowedMembershipLevels ?? [])
    .map((item) => item.levelId ?? item.level?.id)
    .filter((levelId): levelId is string => typeof levelId === 'string' && levelId.length > 0)
    .filter((levelId) => !options.allowedMembershipLevelIds
      || options.allowedMembershipLevelIds.has(levelId));

  return {
    id: model.id,
    name: model.name,
    model: model.model,
    provider: model.provider,
    type: model.type,
    priority: model.priority,
    isDefault: model.isDefault,
    isActive: (model as { isActive?: boolean }).isActive ?? true,
    capabilities: model.capabilities,
    allowedMembershipLevelIds,
    baseUrl: '',
    apiKey: '',
    credentialFieldsDirty: {
      baseUrl: false,
      apiKey: false,
    },
    // Seeded once the container's useAdminModelQuery(model.id) resolves — see models-view.tsx.
    paramsSchemaText: '',
    pricingSchemaText: '',
    description: {},
    schemaLoaded: false,
  };
}

/**
 * Seeds the schema editors and the description fields from a loaded `AdminModelDetail`
 * (`useAdminModelQuery`), once. Pulled out as a pure function so the load-gate logic — never let
 * an empty editor mount and then have a save clobber the real schema/description with `{}` — is
 * unit-testable without mounting React/Monaco.
 *
 * No-ops (returns `form` unchanged) when:
 * - the detail belongs to a different model than the form currently represents (stale response
 *   for a model the admin already navigated away from), or
 * - the form has already been seeded (`schemaLoaded`) — a background refetch of the same model
 *   must not stomp on text the admin is actively editing.
 */
export function seedSystemModelFormSchemas(
  form: SystemModelForm,
  detail: {
    id: string;
    paramsSchema: ParamsSchema | null;
    pricingSchema: PricingSchema | null;
    description: LocalizedText;
  },
): SystemModelForm {
  if (form.id !== detail.id || form.schemaLoaded) return form;
  return {
    ...form,
    paramsSchemaText: JSON.stringify(detail.paramsSchema ?? DEFAULT_PARAMS_SCHEMA, null, 2),
    pricingSchemaText: JSON.stringify(detail.pricingSchema ?? DEFAULT_PRICING_SCHEMA, null, 2),
    description: detail.description ?? {},
    schemaLoaded: true,
  };
}

export function buildSystemModelPayload(form: SystemModelForm): AdminSystemModelInput {
  const payload: AdminSystemModelInput = {
    name: form.name.trim() || form.model.trim(),
    model: form.model.trim(),
    provider: form.provider.trim() || 'openai',
    type: form.type,
    priority: form.priority,
    isDefault: form.isDefault,
    isActive: form.isActive,
    capabilities: form.capabilities.length > 0 ? form.capabilities : ['text'],
    allowedMembershipLevelIds: form.allowedMembershipLevelIds,
  };

  if (!form.id || form.credentialFieldsDirty.baseUrl) {
    const baseUrl = form.baseUrl.trim();
    if (baseUrl) payload.baseUrl = baseUrl;
  }
  if (!form.id || form.credentialFieldsDirty.apiKey) {
    const apiKey = form.apiKey.trim();
    if (apiKey) payload.apiKey = apiKey;
  }

  return payload;
}

export function groupSystemModels(models: ModelConfigItem[]) {
  return models.reduce<Record<string, ModelConfigItem[]>>((acc, model) => {
    const key = model.type || 'general';
    acc[key] = acc[key] ?? [];
    acc[key].push(model);
    return acc;
  }, {});
}

export function readModelError(error: unknown, fallback: string) {
  const err = error as {
    response?: { data?: { message?: unknown; msg?: unknown } };
    message?: unknown;
  };
  const responseMessage = err?.response?.data?.message ?? err?.response?.data?.msg;
  if (typeof responseMessage === 'string') return responseMessage;
  return typeof err?.message === 'string' ? err.message : fallback;
}
