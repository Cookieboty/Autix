'use client';

import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAdminTemplatesQuery,
  useBatchDeleteAdminTemplatesMutation,
  useBatchReviewAdminTemplatesMutation,
  useReviewAdminTemplateMutation,
  useSetAdminTemplateHotMutation,
  type AdminTemplateItem,
  type AdminTemplateResourceType,
  type AdminTemplateStatus,
} from '@autix/shared-store';
import {
  AdminTemplateDetailAside,
  AdminTemplatesBatchBar,
  AdminTemplatesPagination,
  AdminTemplatesTable,
  AdminTemplatesToolbar,
} from './AdminTemplatesViewParts';
import {
  PAGE_SIZE,
  defaultCapabilities,
  getTemplateMediaList,
  type TemplateCapability,
} from './template-review-helpers';

export interface AdminTemplatesViewProps {
  defaultResourceType?: AdminTemplateResourceType;
  resourceTypes?: AdminTemplateResourceType[];
  capabilities?: Partial<Record<TemplateCapability, boolean>>;
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

  const mediaList = getTemplateMediaList(selected, resourceType);
  const showBatchActions = enabled.batchActions && selectedIds.size > 0;
  const showResourceSwitcher = enabled.resourceSwitcher && resourceOptions.length > 1;
  const showPagination = total > PAGE_SIZE;

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTemplatesToolbar
          resourceOptions={resourceOptions}
          resourceType={resourceType}
          showResourceSwitcher={showResourceSwitcher}
          statusFilter={statusFilter}
          statusOptions={statusOptions}
          t={t}
          onResourceTypeChange={(nextResourceType) => {
            setResourceType(nextResourceType);
            setPage(1);
          }}
          onStatusFilterChange={setStatusFilter}
        />

        {showBatchActions && (
          <AdminTemplatesBatchBar
            selectedCount={selectedIds.size}
            t={t}
            onApprove={() => handleBatchReview('approve')}
            onDelete={handleBatchDelete}
            onReject={() => handleBatchReview('reject')}
            onRevise={() => handleBatchReview('revise')}
          />
        )}

        <div className="flex-1 overflow-y-auto">
          <AdminTemplatesTable
            batchActionsEnabled={enabled.batchActions}
            hotEnabled={enabled.hot}
            loading={loading}
            selectedId={selected?.id}
            selectedIds={selectedIds}
            templates={templates}
            t={t}
            tCat={tCat}
            tCommon={tCommon}
            onSelect={setSelected}
            onToggleHot={handleToggleHot}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelectId={toggleSelectId}
          />
        </div>

        {showPagination && (
          <AdminTemplatesPagination page={page} total={total} onPageChange={(nextPage) => void fetchList(nextPage)} />
        )}
      </div>

      {selected && (
        <AdminTemplateDetailAside
          acting={acting}
          mediaList={mediaList}
          rejectReason={rejectReason}
          selected={selected}
          t={t}
          tCat={tCat}
          tTemplate={tTemplate}
          onClose={() => setSelected(null)}
          onRejectReasonChange={setRejectReason}
          onReview={(id, action) => void handleReview(id, action)}
        />
      )}
    </div>
  );
}
