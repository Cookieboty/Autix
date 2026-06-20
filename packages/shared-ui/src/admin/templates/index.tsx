'use client';

import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, Eye, Flame, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useAdminTemplateBatchJobPoller,
  useAdminTemplatesQuery,
  useBatchDeleteAdminTemplatesMutation,
  useBatchReviewAdminTemplatesMutation,
  useDownloadAdminTemplateImportTemplateMutation,
  useExportAdminTemplatesMutation,
  useImportAdminTemplatesMutation,
  useReviewAdminTemplateMutation,
  useSetAdminTemplateHotMutation,
  type AdminImageTemplate,
  type AdminTemplateItem,
  type AdminTemplateResourceType,
  type AdminTemplateStatus,
  type AdminVideoTemplate,
} from '@autix/shared-store';
import { getTemplateCategoryI18nKey } from '../../template';
import { Button, Checkbox } from '../../ui';
import { TemplateImportDialog } from '../TemplateImportDialog';

const PAGE_SIZE = 15;

type TemplateCapability = 'resourceSwitcher' | 'batchActions' | 'hot' | 'importExport' | 'sourceInfo';

export interface AdminTemplatesViewProps {
  defaultResourceType?: AdminTemplateResourceType;
  resourceTypes?: AdminTemplateResourceType[];
  capabilities?: Partial<Record<TemplateCapability, boolean>>;
}

const defaultCapabilities: Record<TemplateCapability, boolean> = {
  resourceSwitcher: false,
  batchActions: false,
  hot: false,
  importExport: false,
  sourceInfo: false,
};

const statusStyle: Record<AdminTemplateStatus, { backgroundColor: string; color: string }> = {
  PENDING: { backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' },
  IN_REVIEW: { backgroundColor: 'var(--info-bg)', color: 'var(--info-foreground)' },
  APPROVED: { backgroundColor: 'var(--success-soft)', color: 'var(--success)' },
  REJECTED: { backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' },
  ARCHIVED: { backgroundColor: 'var(--muted-soft)', color: 'var(--muted)' },
};

const filterButtonClass = (active: boolean) =>
  [
    'cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
    active
      ? 'border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
  ].join(' ');

function getMediaList(selected: AdminTemplateItem | null, resourceType: AdminTemplateResourceType) {
  if (!selected) return [];
  if (resourceType === 'image-templates') {
    return (selected as AdminImageTemplate).exampleImages ?? [];
  }
  return (selected as AdminVideoTemplate).exampleMedia ?? [];
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminTemplatesView({
  defaultResourceType = 'image-templates',
  resourceTypes = ['image-templates'],
  capabilities,
}: AdminTemplatesViewProps) {
  const t = useTranslations('templateReview');
  const tCommon = useTranslations('common');
  const tCat = useTranslations('categoryOptions');
  const tTemplate = useTranslations('template');

  const enabled = { ...defaultCapabilities, ...capabilities };
  const availableResourceTypes: AdminTemplateResourceType[] =
    resourceTypes.length > 0 ? resourceTypes : ['image-templates'];
  const [resourceType, setResourceType] = useState<AdminTemplateResourceType>(
    availableResourceTypes.includes(defaultResourceType) ? defaultResourceType : availableResourceTypes[0],
  );
  const [templates, setTemplates] = useState<AdminTemplateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<AdminTemplateStatus | ''>('');
  const [selected, setSelected] = useState<AdminTemplateItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);

  const statusOptions = useMemo(
    () => [
      { label: tCommon('all'), value: '' as const },
      { label: t('pending'), value: 'PENDING' as const },
      { label: t('inReview'), value: 'IN_REVIEW' as const },
      { label: t('approved'), value: 'APPROVED' as const },
      { label: t('rejected'), value: 'REJECTED' as const },
    ],
    [t, tCommon],
  );

  const resourceOptions = useMemo(
    () =>
      availableResourceTypes.map((value) => ({
        value,
        label: value === 'image-templates' ? t('imageTemplates') : t('videoTemplates'),
      })),
    [availableResourceTypes, t],
  );

  const listParams = {
    resourceType,
    status: statusFilter || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, isLoading, isFetching, refetch } = useAdminTemplatesQuery(listParams);
  const loading = isLoading || isFetching;
  const reviewMutation = useReviewAdminTemplateMutation();
  const batchReviewMutation = useBatchReviewAdminTemplatesMutation();
  const batchDeleteMutation = useBatchDeleteAdminTemplatesMutation();
  const setHotMutation = useSetAdminTemplateHotMutation();
  const downloadTemplateMutation = useDownloadAdminTemplateImportTemplateMutation();
  const exportMutation = useExportAdminTemplatesMutation();
  const importTemplatesMutation = useImportAdminTemplatesMutation(resourceType);
  const pollBatchJob = useAdminTemplateBatchJobPoller();

  useEffect(() => {
    if (!data) return;
    setTemplates(data.items ?? []);
    setTotal(data.total ?? 0);
    setPage(data.page ?? page);
  }, [data, page]);

  useEffect(() => {
    setSelected(null);
    setSelectedIds(new Set());
    setPage(1);
  }, [statusFilter, resourceType]);

  const fetchList = async (p = page) => {
    if (p !== page) {
      setPage(p);
      return;
    }
    await refetch();
  };

  const handleReview = async (id: string, action: 'approve' | 'reject' | 'revise') => {
    setActing(true);
    try {
      await reviewMutation.mutateAsync({
        resourceType,
        id,
        action,
        reason: action !== 'approve' ? rejectReason : undefined,
      });
      setRejectReason('');
      setSelected(null);
    } finally {
      setActing(false);
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === templates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(templates.map((tpl) => tpl.id)));
    }
  };

  const handleBatchReview = async (action: 'approve' | 'reject' | 'revise') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    let reason: string | undefined;
    if (action !== 'approve') {
      reason = window.prompt(t('rejectReasonPlaceholder')) ?? undefined;
    }
    await batchReviewMutation.mutateAsync({ resourceType, ids, action, reason });
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(t('confirmBatchDelete', { count: ids.length }))) return;
    await batchDeleteMutation.mutateAsync({ resourceType, ids });
    setSelectedIds(new Set());
  };

  const handleToggleHot = async (tpl: AdminTemplateItem, e: MouseEvent) => {
    e.stopPropagation();
    const newVal = !tpl.isHot;
    setTemplates((prev) =>
      prev.map((item) => (item.id === tpl.id ? { ...item, isHot: newVal } : item)),
    );
    try {
      await setHotMutation.mutateAsync({ resourceType, id: tpl.id, isHot: newVal });
    } catch {
      setTemplates((prev) =>
        prev.map((item) => (item.id === tpl.id ? { ...item, isHot: !newVal } : item)),
      );
    }
  };

  const handleDownloadTemplate = async () => {
    const payload = await downloadTemplateMutation.mutateAsync(resourceType);
    downloadJson(payload, `${resourceType}-template.json`);
  };

  const handleExport = async () => {
    const payload = await exportMutation.mutateAsync({
      resourceType,
      status: statusFilter || undefined,
    });
    downloadJson(payload, `${resourceType}-export.json`);
  };

  const mediaList = getMediaList(selected, resourceType);
  const showBatchActions = enabled.batchActions && selectedIds.size > 0;
  const showResourceSwitcher = enabled.resourceSwitcher && resourceOptions.length > 1;
  const showPagination = total > PAGE_SIZE;

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-4 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
          {showResourceSwitcher && (
            <div className="flex gap-1.5">
              {resourceOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={filterButtonClass(resourceType === opt.value)}
                  onClick={() => {
                    setResourceType(opt.value);
                    setPage(1);
                  }}
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
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {enabled.importExport && (
            <>
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setImportOpen(true)}>
                {t('batchImport')}
              </Button>
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={handleDownloadTemplate}>
                {t('downloadTemplate')}
              </Button>
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={handleExport}>
                {t('exportTemplates')}
              </Button>
            </>
          )}
        </div>

        {showBatchActions && (
          <div
            className="flex items-center gap-3 px-4 py-2"
            style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--panel-muted)' }}
          >
            <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
              {t('selectedCount', { count: selectedIds.size })}
            </span>
            <span className="flex-1" />
            <Button size="sm" className="cursor-pointer" onClick={() => handleBatchReview('approve')}>
              {t('batchApprove')}
            </Button>
            <Button size="sm" variant="ghost" className="cursor-pointer" style={{ color: 'var(--danger)' }} onClick={() => handleBatchReview('reject')}>
              {t('batchReject')}
            </Button>
            <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => handleBatchReview('revise')}>
              {t('batchRevise')}
            </Button>
            <Button size="sm" variant="ghost" className="cursor-pointer" style={{ color: 'var(--danger)' }} onClick={handleBatchDelete}>
              {t('batchDelete')}
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {enabled.batchActions && (
                    <th className="w-10 px-4 py-3">
                      <Checkbox
                        checked={templates.length > 0 && selectedIds.size === templates.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerTitle')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerCategory')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerStatus')}</th>
                  {enabled.hot && (
                    <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>Hot</th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerSubmittedAt')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerActions')}</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => (
                  <tr
                    key={tpl.id}
                    className="transition-colors cursor-pointer"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: selected?.id === tpl.id ? 'var(--nav-item-active)' : 'transparent',
                    }}
                    onClick={() => setSelected(tpl)}
                  >
                    {enabled.batchActions && (
                      <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(tpl.id)}
                          onCheckedChange={() => toggleSelectId(tpl.id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{tpl.title}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{tCat(getTemplateCategoryI18nKey(tpl.category))}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={statusStyle[tpl.status]}
                      >
                        {tpl.status}
                      </span>
                    </td>
                    {enabled.hot && (
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="cursor-pointer p-1 rounded transition-colors hover:bg-white/10"
                          onClick={(e) => handleToggleHot(tpl, e)}
                          title={tpl.isHot ? t('unsetHot') : t('setHot')}
                        >
                          <Flame
                            className="w-4 h-4"
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
                      <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setSelected(tpl)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showPagination && (
          <div className="flex items-center justify-center gap-2 p-3" style={{ borderTop: '1px solid var(--border)' }}>
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => fetchList(page - 1)} className="cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{page} / {Math.ceil(total / PAGE_SIZE)}</span>
            <Button size="sm" variant="ghost" disabled={page * PAGE_SIZE >= total} onClick={() => fetchList(page + 1)} className="cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {selected && (
        <aside
          className="w-[360px] flex-shrink-0 overflow-y-auto p-5 space-y-4"
          style={{ borderLeft: '1px solid var(--border)' }}
        >
          <div className="flex items-start justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{selected.title}</h2>
            <button type="button" className="cursor-pointer" onClick={() => setSelected(null)}>
              <X className="w-4 h-4" style={{ color: 'var(--muted)' }} />
            </button>
          </div>

          {selected.coverImage && (
            <img src={selected.coverImage} alt="" className="w-full rounded-lg" style={{ border: '1px solid var(--border)' }} />
          )}

          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--muted)' }}>{t('headerCategory')}</p>
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>{tCat(getTemplateCategoryI18nKey(selected.category))}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--muted)' }}>Prompt</p>
              <div
                className="p-3 rounded-md text-xs leading-5 font-mono"
                style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              >
                {selected.prompt}
              </div>
            </div>
            {selected.description && (
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--muted)' }}>{tTemplate('description')}</p>
                <p className="text-sm" style={{ color: 'var(--foreground)' }}>{selected.description}</p>
              </div>
            )}
            {mediaList.length > 0 && (
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--muted)' }}>{tTemplate('exampleImages')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {mediaList.map((img, i) => (
                    <img key={i} src={img} alt="" className="w-full rounded object-cover aspect-square" />
                  ))}
                </div>
              </div>
            )}
            {selected.rejectReason && (
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--danger)' }}>{t('rejectReason')}</p>
                <p className="text-sm" style={{ color: 'var(--foreground)' }}>{selected.rejectReason}</p>
              </div>
            )}

            {enabled.sourceInfo && (selected.originalUrl || selected.authorName || selected.sourcePlatform || selected.externalId) && (
              <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>{t('sourceInfo')}</p>
                {selected.authorName && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('authorName')}:</span>
                    {selected.authorUrl ? (
                      <a href={selected.authorUrl} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: 'var(--link)' }}>
                        {selected.authorName}
                      </a>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--foreground)' }}>{selected.authorName}</span>
                    )}
                  </div>
                )}
                {selected.sourcePlatform && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('sourcePlatform')}:</span>
                    <span className="text-xs" style={{ color: 'var(--foreground)' }}>{selected.sourcePlatform}</span>
                  </div>
                )}
                {selected.originalUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('originalUrl')}:</span>
                    <a href={selected.originalUrl} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline truncate" style={{ color: 'var(--link)' }}>
                      {t('viewSource')}
                    </a>
                  </div>
                )}
                {selected.externalId && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('externalId')}:</span>
                    <span className="text-xs font-mono" style={{ color: 'var(--foreground)' }}>{selected.externalId}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {(selected.status === 'PENDING' || selected.status === 'IN_REVIEW') && (
            <div className="space-y-3 pt-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('rejectReasonPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none"
                style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1 cursor-pointer"
                  disabled={acting}
                  onClick={() => handleReview(selected.id, 'approve')}
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> {t('approve')}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 cursor-pointer"
                  style={{ color: 'var(--danger)' }}
                  disabled={acting}
                  onClick={() => handleReview(selected.id, 'reject')}
                >
                  <X className="w-3.5 h-3.5 mr-1" /> {t('reject')}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 cursor-pointer"
                  disabled={acting}
                  onClick={() => handleReview(selected.id, 'revise')}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> {t('revise')}
                </Button>
              </div>
            </div>
          )}
        </aside>
      )}

      {enabled.importExport && (
        <TemplateImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => fetchList()}
          importFn={(items) => importTemplatesMutation.mutateAsync(items).then((r) => r.data)}
          pollJob={pollBatchJob}
        />
      )}
    </div>
  );
}
