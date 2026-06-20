import type { ModelConfigItem } from '@autix/shared-store';

export const CAPABILITY_KEYS: { value: string; key: string }[] = [
  { value: 'text', key: 'capText' },
  { value: 'vision', key: 'capVision' },
  { value: 'voice', key: 'capVoice' },
  { value: 'speech', key: 'capSpeech' },
  { value: 'code', key: 'capCode' },
  { value: 'reasoning', key: 'capReasoning' },
  { value: 'image', key: 'capImage' },
  { value: 'video', key: 'capVideo' },
  { value: 'embedding', key: 'capEmbedding' },
];

export const DEFAULT_MODEL_TYPE_OPTIONS = ['general', 'code', 'intent', 'embedding', 'video'];

export type ModelsViewVariant = 'web' | 'desktop';
export type ModelsDrawerMode = 'sheet' | 'overlay';

export interface EditingModel {
  id?: string;
  name: string;
  model: string;
  provider: string;
  type: string;
  priority: number;
  isDefault: boolean;
  capabilities: string[];
  baseUrl: string;
  apiKey: string;
}

export const variantClasses = {
  web: {
    icon: 'ml-1 h-4 w-4 text-muted-foreground',
    countBadge: 'rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground',
    skeleton: 'h-32 animate-pulse rounded-xl bg-muted',
    emptyIcon: 'h-12 w-12 text-muted-foreground opacity-20',
    emptyText: 'text-sm text-muted-foreground',
    fieldLabel: 'block text-xs font-medium text-muted-foreground',
    helperText: 'text-xs text-muted-foreground',
    sectionTitle: 'text-xs font-semibold uppercase tracking-wider text-muted-foreground',
    card: 'flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50',
    cardModel: 'mt-0.5 truncate font-mono text-xs text-muted-foreground',
    providerText: 'text-xs text-muted-foreground',
    dividerText: 'text-xs text-muted-foreground/60',
    chip: 'rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground',
    capChip: 'rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground',
  },
  desktop: {
    icon: 'w-4 h-4 text-foreground/50',
    countBadge: 'text-xs px-1.5 py-0.5 rounded-full bg-default-100 text-foreground/50',
    skeleton: 'h-32 rounded-xl animate-pulse bg-default-100',
    emptyIcon: 'w-12 h-12 opacity-20 text-foreground/50',
    emptyText: 'text-sm text-foreground/50',
    fieldLabel: 'block text-xs font-medium text-foreground/60',
    helperText: 'text-xs text-foreground/50',
    sectionTitle: 'text-xs font-semibold uppercase tracking-wider text-foreground/50',
    card: 'rounded-xl border border-default bg-default-50 p-4 flex flex-col gap-3 transition-colors hover:bg-default-100/50',
    cardModel: 'text-xs text-foreground/40 mt-0.5 truncate font-mono',
    providerText: 'text-xs text-foreground/50',
    dividerText: 'text-xs text-foreground/30',
    chip: 'text-xs px-1.5 py-0.5 rounded bg-default-100 text-foreground/50',
    capChip: 'text-[10px] px-1.5 py-0.5 rounded bg-default-100 text-foreground/50',
  },
} as const;

export function createEmptyEditing(amuxHost: string): EditingModel {
  return {
    name: '',
    model: '',
    provider: 'amux',
    type: 'general',
    priority: 0,
    isDefault: false,
    capabilities: ['text'],
    baseUrl: `${amuxHost.replace(/\/$/, '')}/v1`,
    apiKey: '',
  };
}

export function editingFromModel(model: ModelConfigItem): EditingModel {
  const metadata = model.metadata as { baseUrl?: string; apiKey?: string } | undefined;
  return {
    id: model.id,
    name: model.name,
    model: model.model,
    provider: model.provider,
    type: model.type,
    priority: model.priority,
    isDefault: model.isDefault,
    capabilities: model.capabilities,
    baseUrl: model.baseUrl ?? metadata?.baseUrl ?? '',
    apiKey: model.apiKey ?? metadata?.apiKey ?? '',
  };
}

export function buildModelPayload(editing: EditingModel): Record<string, unknown> {
  return {
    name: editing.name || editing.model,
    model: editing.model,
    provider: editing.provider,
    type: editing.type,
    priority: editing.priority,
    isDefault: editing.isDefault,
    capabilities: editing.capabilities,
    baseUrl: editing.baseUrl || undefined,
    apiKey: editing.apiKey || undefined,
  };
}
