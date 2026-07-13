'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Bookmark, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  MeTab,
  ProfileResourceItem,
  ResourceType,
} from '@autix/shared-store';
import { RESOURCE_TYPE_TO_SLUG, TYPE_LABEL_KEY } from '../marketplace/resource-utils';
import {
  Badge,
  Button,
  Card,
  SidebarTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui';

type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const STATUS_LABEL: Record<string, { label: string; variant: StatusVariant }> = {
  PENDING: { label: 'statusPending', variant: 'secondary' },
  IN_REVIEW: { label: 'statusInReview', variant: 'secondary' },
  APPROVED: { label: 'statusApproved', variant: 'default' },
  REJECTED: { label: 'statusRejected', variant: 'destructive' },
  ARCHIVED: { label: 'statusArchived', variant: 'outline' },
};

export type ProfileResourcesTab = {
  key: MeTab;
  labelKey: string;
  icon?: ReactNode;
};

export type ProfileResourceRow = {
  key: string;
  title: string;
  cover?: string | null;
  resourceType?: ResourceType;
  resourceId?: string;
  category?: string | null;
  pointsCost?: number;
  useCount?: number;
  status?: string;
  pointsPaid?: number;
  timestamp?: string;
};

export type ProfileResourceRowLabels = {
  resource: string;
  archivedResource: string;
  generationRecord: string;
};

// 只保留生成历史与浏览历史:我的资源/我的发布/我的收藏 tab 已移除(收藏入口收敛到素材库)。
export const DEFAULT_PROFILE_RESOURCE_TABS: ProfileResourcesTab[] = [
  { key: 'generations', labelKey: 'tabGenerations', icon: <Clock className="h-3.5 w-3.5" /> },
  { key: 'history', labelKey: 'tabHistory', icon: <Bookmark className="h-3.5 w-3.5" /> },
];

export function normalizeProfileResourceRows(
  items: ProfileResourceItem[],
  tab: MeTab,
  labels: ProfileResourceRowLabels,
): ProfileResourceRow[] {
  return items.map((it, idx) => {
    if (tab === 'acquired') {
      const resource = (it as { resource?: { id: string; title: string } }).resource;
      const r = resource || (it as unknown as { id: string; title: string });
      return {
        key: `${(it as { id?: string; resourceId?: string }).id ?? it.resourceId ?? idx}`,
        title: r?.title ?? labels.resource,
        cover: (r as { coverImage?: string | null })?.coverImage ?? null,
        resourceType: it.resourceType,
        resourceId: it.resourceId ?? r?.id,
        category: (r as { category?: string | null })?.category ?? undefined,
        pointsPaid: it.pointsPaid,
        timestamp: it.acquiredAt,
      };
    }

    if (tab === 'favorites' || tab === 'history') {
      const r = it.resource;
      return {
        key: `${it.id ?? idx}`,
        title: r?.title ?? labels.archivedResource,
        cover: r?.coverImage ?? null,
        resourceType: it.resourceType,
        resourceId: it.resourceId ?? r?.id,
        category: r?.category,
        pointsCost: r?.pointsCost,
        useCount: r?.useCount,
        timestamp: tab === 'favorites' ? it.createdAt : it.viewedAt,
      };
    }

    if (tab === 'published') {
      return {
        key: `${it.id ?? idx}`,
        title: it.title ?? labels.resource,
        cover: it.coverImage,
        resourceType: it.resourceType,
        resourceId: it.id,
        category: it.category,
        pointsCost: it.pointsCost,
        useCount: it.useCount,
        status: it.status,
        timestamp: it.updatedAt,
      };
    }

    if (tab === 'generations') {
      const tpl = it.template;
      return {
        key: `${it.id ?? idx}`,
        title: tpl?.title ?? labels.generationRecord,
        cover: tpl?.coverImage,
        resourceType: it.generationType,
        resourceId: it.templateId,
        category: tpl?.category,
        timestamp: it.createdAt,
      };
    }

    return { key: `${idx}`, title: '—' };
  });
}

export function useProfileResourceRows(
  items: ProfileResourceItem[],
  tab: MeTab,
): ProfileResourceRow[] {
  const t = useTranslations('profile.resources');
  const rowLabels = useMemo(
    () => ({
      resource: t('defaultResource'),
      archivedResource: t('archivedResource'),
      generationRecord: t('generationRecord'),
    }),
    [t],
  );

  return useMemo(
    () => normalizeProfileResourceRows(items, tab, rowLabels),
    [items, tab, rowLabels],
  );
}

export function ProfileResourcesTabStrip({
  tabs = DEFAULT_PROFILE_RESOURCE_TABS,
  activeTab,
  onTabChange,
}: {
  tabs?: ProfileResourcesTab[];
  activeTab: MeTab;
  onTabChange: (tab: MeTab) => void;
}) {
  const t = useTranslations('profile.resources');

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tabItem) => {
        const active = activeTab === tabItem.key;
        return (
          <button
            key={tabItem.key}
            type="button"
            onClick={() => onTabChange(tabItem.key)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tabItem.icon} {t(`tabs.${tabItem.labelKey}`)}
          </button>
        );
      })}
    </div>
  );
}

export function ProfileResourceTable({
  rows,
  tab,
  onClickRow,
}: {
  rows: ProfileResourceRow[];
  tab: MeTab;
  onClickRow: (type: ResourceType | undefined, id: string | undefined) => void;
}) {
  const t = useTranslations('profile.resources');
  const tMarketplace = useTranslations('marketplace');

  return (
    <Card className="gap-0 p-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>{t('table.resource')}</TableHead>
            <TableHead>{t('table.type')}</TableHead>
            <TableHead>{t('table.category')}</TableHead>
            {tab === 'acquired' && (
              <TableHead className="text-right">{t('table.pointsSpent')}</TableHead>
            )}
            {tab === 'published' && (
              <>
                <TableHead className="text-right">{t('table.usage')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
              </>
            )}
            {(tab === 'favorites' || tab === 'history') && (
              <TableHead className="text-right">{t('table.usage')}</TableHead>
            )}
            <TableHead className="text-right">{t('table.time')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const status = row.status ? STATUS_LABEL[row.status] : null;
            return (
              <TableRow
                key={row.key}
                onClick={() => onClickRow(row.resourceType, row.resourceId)}
                className="cursor-pointer"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-muted">
                      {row.cover && (
                        <img src={row.cover} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{row.title}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.resourceType
                    ? tMarketplace(
                        `resourceType.${TYPE_LABEL_KEY[RESOURCE_TYPE_TO_SLUG[row.resourceType]]}`,
                      )
                    : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.category ?? '—'}</TableCell>
                {tab === 'acquired' && (
                  <TableCell className="text-right text-foreground">{row.pointsPaid ?? 0}</TableCell>
                )}
                {tab === 'published' && (
                  <>
                    <TableCell className="text-right text-foreground">
                      {row.useCount ?? 0}
                    </TableCell>
                    <TableCell>
                      {status ? (
                        <Badge variant={status.variant}>{t(`status.${status.label}`)}</Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </>
                )}
                {(tab === 'favorites' || tab === 'history') && (
                  <TableCell className="text-right text-foreground">{row.useCount ?? 0}</TableCell>
                )}
                <TableCell className="text-right text-xs text-muted-foreground">
                  {row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

export function ProfileResourcesPanel({
  rows,
  tab,
  loading,
  onClickRow,
}: {
  rows: ProfileResourceRow[];
  tab: MeTab;
  loading: boolean;
  onClickRow: (type: ResourceType | undefined, id: string | undefined) => void;
}) {
  const t = useTranslations('profile.resources');

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t('loading')}</div>;
  }

  if (rows.length === 0) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t('empty')}</div>;
  }

  return <ProfileResourceTable rows={rows} tab={tab} onClickRow={onClickRow} />;
}

export type ProfileResourcesPagination = {
  page: number;
  pageSize: number;
  total: number;
};

export function ProfileResourcesPaginationBar({
  pagination,
  onPageChange,
}: {
  pagination: ProfileResourcesPagination;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations('profile.resources');
  const { page, pageSize, total } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-muted-foreground">
        {t('pagination.info', { total, page, totalPages })}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          {t('pagination.prev')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          {t('pagination.next')}
        </Button>
      </div>
    </div>
  );
}

export function ProfileResourcesView({
  titleKey = 'contentTitle',
  activeTab,
  rows,
  loading,
  tabs = DEFAULT_PROFILE_RESOURCE_TABS,
  showSidebarTrigger = true,
  pagination,
  onPageChange,
  onTabChange,
  onClickRow,
}: {
  titleKey?: string;
  activeTab: MeTab;
  rows: ProfileResourceRow[];
  loading: boolean;
  tabs?: ProfileResourcesTab[];
  showSidebarTrigger?: boolean;
  pagination?: ProfileResourcesPagination;
  onPageChange?: (page: number) => void;
  onTabChange: (tab: MeTab) => void;
  onClickRow: (type: ResourceType | undefined, id: string | undefined) => void;
}) {
  const t = useTranslations('profile.resources');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        {showSidebarTrigger && <SidebarTrigger className="-ml-1" />}
        <h1 className={`${showSidebarTrigger ? 'ml-1 ' : ''}text-sm font-semibold text-foreground`}>
          {t(titleKey)}
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <ProfileResourcesTabStrip
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />

        <div className="mt-4">
          <ProfileResourcesPanel
            rows={rows}
            tab={activeTab}
            loading={loading}
            onClickRow={onClickRow}
          />

          {!loading && pagination && onPageChange && (
            <ProfileResourcesPaginationBar
              pagination={pagination}
              onPageChange={onPageChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
