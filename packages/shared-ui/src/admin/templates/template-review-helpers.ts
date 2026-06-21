import type {
  AdminImageTemplate,
  AdminTemplateItem,
  AdminTemplateResourceType,
  AdminTemplateStatus,
  AdminVideoTemplate,
} from '@autix/shared-store';

export const PAGE_SIZE = 15;

export type TemplateCapability =
  | 'resourceSwitcher'
  | 'batchActions'
  | 'hot'
  | 'importExport'
  | 'sourceInfo';

export const defaultCapabilities: Record<TemplateCapability, boolean> = {
  resourceSwitcher: false,
  batchActions: false,
  hot: false,
  importExport: false,
  sourceInfo: false,
};

export const statusStyle: Record<AdminTemplateStatus, { backgroundColor: string; color: string }> = {
  PENDING: { backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' },
  IN_REVIEW: { backgroundColor: 'var(--info-bg)', color: 'var(--info-foreground)' },
  APPROVED: { backgroundColor: 'var(--success-soft)', color: 'var(--success)' },
  REJECTED: { backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' },
  ARCHIVED: { backgroundColor: 'var(--muted-soft)', color: 'var(--muted)' },
};

export const filterButtonClass = (active: boolean) =>
  [
    'cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
    active
      ? 'border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
  ].join(' ');

export function getTemplateMediaList(
  selected: AdminTemplateItem | null,
  resourceType: AdminTemplateResourceType,
) {
  if (!selected) return [];
  if (resourceType === 'image-templates') {
    return (selected as AdminImageTemplate).exampleImages ?? [];
  }
  return (selected as AdminVideoTemplate).exampleMedia ?? [];
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
