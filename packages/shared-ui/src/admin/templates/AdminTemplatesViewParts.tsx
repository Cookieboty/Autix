import type { MouseEvent } from 'react';
import { Check, Eye, Flame, RotateCcw, X } from 'lucide-react';
import type {
  AdminTemplateItem,
  AdminTemplateResourceType,
  AdminTemplateStatus,
} from '@autix/shared-store';
import { getTemplateCategoryI18nKey } from '../../template';
import { Button, Checkbox } from '../../ui';
import { CdnImage } from '../../image';
import { filterButtonClass, statusStyle } from './template-review-helpers';

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;
type CommonTranslate = (key: string) => string;

interface Option<T extends string> {
  label: string;
  value: T;
}

export function AdminTemplatesToolbar({
  resourceOptions,
  resourceType,
  showResourceSwitcher,
  statusFilter,
  statusOptions,
  t,
  onResourceTypeChange,
  onStatusFilterChange,
}: {
  resourceOptions: Array<Option<AdminTemplateResourceType>>;
  resourceType: AdminTemplateResourceType;
  showResourceSwitcher: boolean;
  statusFilter: AdminTemplateStatus | '';
  statusOptions: Array<Option<AdminTemplateStatus | ''>>;
  t: Translate;
  onResourceTypeChange: (resourceType: AdminTemplateResourceType) => void;
  onStatusFilterChange: (status: AdminTemplateStatus | '') => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
      <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
        {t('title')}
      </h1>
      {showResourceSwitcher && (
        <div className="flex gap-1.5">
          {resourceOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={filterButtonClass(resourceType === opt.value)}
              onClick={() => onResourceTypeChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      <span className="flex-1" />
      <div className="flex gap-1.5">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={filterButtonClass(statusFilter === opt.value)}
            onClick={() => onStatusFilterChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdminTemplatesBatchBar({
  selectedCount,
  t,
  onApprove,
  onDelete,
  onReject,
  onRevise,
}: {
  selectedCount: number;
  t: Translate;
  onApprove: () => void;
  onDelete: () => void;
  onReject: () => void;
  onRevise: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2"
      style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--panel-muted)' }}
    >
      <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
        {t('selectedCount', { count: selectedCount })}
      </span>
      <span className="flex-1" />
      <Button size="sm" className="cursor-pointer" onClick={onApprove}>
        {t('batchApprove')}
      </Button>
      <Button size="sm" variant="ghost" className="cursor-pointer" style={{ color: 'var(--danger)' }} onClick={onReject}>
        {t('batchReject')}
      </Button>
      <Button size="sm" variant="ghost" className="cursor-pointer" onClick={onRevise}>
        {t('batchRevise')}
      </Button>
      <Button size="sm" variant="ghost" className="cursor-pointer" style={{ color: 'var(--danger)' }} onClick={onDelete}>
        {t('batchDelete')}
      </Button>
    </div>
  );
}

export function AdminTemplatesTable({
  batchActionsEnabled,
  hotEnabled,
  loading,
  selectedId,
  selectedIds,
  templates,
  t,
  tCat,
  tCommon,
  onSelect,
  onToggleHot,
  onToggleSelectAll,
  onToggleSelectId,
}: {
  batchActionsEnabled: boolean;
  hotEnabled: boolean;
  loading: boolean;
  selectedId?: string;
  selectedIds: Set<string>;
  templates: AdminTemplateItem[];
  t: Translate;
  tCat: Translate;
  tCommon: CommonTranslate;
  onSelect: (template: AdminTemplateItem) => void;
  onToggleHot: (template: AdminTemplateItem, event: MouseEvent) => void;
  onToggleSelectAll: () => void;
  onToggleSelectId: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {tCommon('loading')}
        </span>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {tCommon('noData')}
        </span>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          {batchActionsEnabled && (
            <th className="w-10 px-4 py-3">
              <Checkbox
                checked={templates.length > 0 && selectedIds.size === templates.length}
                onCheckedChange={onToggleSelectAll}
              />
            </th>
          )}
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerTitle')}</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerCategory')}</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerStatus')}</th>
          {hotEnabled && (
            <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: 'var(--muted)' }}>Hot</th>
          )}
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerSubmittedAt')}</th>
          <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerActions')}</th>
        </tr>
      </thead>
      <tbody>
        {templates.map((tpl) => (
          <tr
            key={tpl.id}
            className="cursor-pointer transition-colors"
            style={{
              borderBottom: '1px solid var(--border)',
              backgroundColor: selectedId === tpl.id ? 'var(--nav-item-active)' : 'transparent',
            }}
            onClick={() => onSelect(tpl)}
          >
            {batchActionsEnabled && (
              <td className="w-10 px-4 py-3" onClick={(event) => event.stopPropagation()}>
                <Checkbox checked={selectedIds.has(tpl.id)} onCheckedChange={() => onToggleSelectId(tpl.id)} />
              </td>
            )}
            <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{tpl.title}</td>
            <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{tCat(getTemplateCategoryI18nKey(tpl.category))}</td>
            <td className="px-4 py-3">
              <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={statusStyle[tpl.status]}>
                {tpl.status}
              </span>
            </td>
            {hotEnabled && (
              <td className="px-4 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="cursor-pointer rounded p-1 transition-colors hover:bg-white/10"
                  onClick={(event) => onToggleHot(tpl, event)}
                  title={tpl.isHot ? t('unsetHot') : t('setHot')}
                >
                  <Flame
                    className="h-4 w-4"
                    style={{ color: tpl.isHot ? 'var(--hot)' : 'var(--muted)' }}
                    fill={tpl.isHot ? 'var(--hot)' : 'none'}
                  />
                </button>
              </td>
            )}
            <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>
              {new Date(tpl.createdAt).toLocaleDateString()}
            </td>
            <td className="px-4 py-3 text-right">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => onSelect(tpl)}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AdminTemplateDetailAside({
  acting,
  mediaList,
  rejectReason,
  selected,
  t,
  tCat,
  tTemplate,
  onClose,
  onRejectReasonChange,
  onReview,
}: {
  acting: boolean;
  mediaList: string[];
  rejectReason: string;
  selected: AdminTemplateItem;
  t: Translate;
  tCat: Translate;
  tTemplate: Translate;
  onClose: () => void;
  onRejectReasonChange: (value: string) => void;
  onReview: (id: string, action: 'approve' | 'reject' | 'revise') => void;
}) {
  return (
    <aside
      className="w-[360px] flex-shrink-0 space-y-4 overflow-y-auto p-5"
      style={{ borderLeft: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {selected.title}
        </h2>
        <button type="button" className="cursor-pointer" onClick={onClose}>
          <X className="h-4 w-4" style={{ color: 'var(--muted)' }} />
        </button>
      </div>

      {selected.coverImage && (
        <CdnImage
          src={selected.coverImage}
          alt=""
          sizes="(max-width: 640px) 100vw, 400px"
          className="w-full rounded-lg"
          style={{ border: '1px solid var(--border)' }}
        />
      )}

      <div className="space-y-3">
        <div>
          <p className="mb-1 text-[11px] font-medium" style={{ color: 'var(--muted)' }}>{t('headerCategory')}</p>
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>{tCat(getTemplateCategoryI18nKey(selected.category))}</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Prompt</p>
          <div
            className="rounded-md p-3 font-mono text-xs leading-5"
            style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          >
            {selected.prompt}
          </div>
        </div>
        {selected.description && (
          <div>
            <p className="mb-1 text-[11px] font-medium" style={{ color: 'var(--muted)' }}>{tTemplate('description')}</p>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>{selected.description}</p>
          </div>
        )}
        {mediaList.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium" style={{ color: 'var(--muted)' }}>{tTemplate('exampleImages')}</p>
            <div className="grid grid-cols-2 gap-2">
              {mediaList.map((img, index) => (
                <CdnImage
                  key={index}
                  src={img}
                  alt=""
                  sizes="(max-width: 640px) 45vw, 200px"
                  className="aspect-square w-full rounded object-cover"
                />
              ))}
            </div>
          </div>
        )}
        {selected.rejectReason && (
          <div>
            <p className="mb-1 text-[11px] font-medium" style={{ color: 'var(--danger)' }}>{t('rejectReason')}</p>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>{selected.rejectReason}</p>
          </div>
        )}
      </div>

      {(selected.status === 'PENDING' || selected.status === 'IN_REVIEW') && (
        <div className="space-y-3 pt-2">
          <textarea
            value={rejectReason}
            onChange={(event) => onRejectReasonChange(event.target.value)}
            placeholder={t('rejectReasonPlaceholder')}
            rows={2}
            className="w-full resize-none rounded-md px-3 py-2 text-sm outline-none"
            style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
          />
          <div className="flex gap-2">
            <Button className="flex-1 cursor-pointer" disabled={acting} onClick={() => onReview(selected.id, 'approve')}>
              <Check className="mr-1 h-3.5 w-3.5" /> {t('approve')}
            </Button>
            <Button
              variant="ghost"
              className="flex-1 cursor-pointer"
              style={{ color: 'var(--danger)' }}
              disabled={acting}
              onClick={() => onReview(selected.id, 'reject')}
            >
              <X className="mr-1 h-3.5 w-3.5" /> {t('reject')}
            </Button>
            <Button
              variant="ghost"
              className="flex-1 cursor-pointer"
              disabled={acting}
              onClick={() => onReview(selected.id, 'revise')}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> {t('revise')}
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
