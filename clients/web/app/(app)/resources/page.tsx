'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sparkles, Star, Clock, Upload, Bookmark } from 'lucide-react';
import {
  Badge,
  Card,
  SidebarTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@autix/shared-ui/ui';
import { meApi, type MeTab, type ResourceType } from '@/lib/api';
import { TYPE_TO_SLUG } from '@/lib/resource-types';

interface AggregatedItem {
  id?: string;
  resourceType?: ResourceType;
  resourceId?: string;
  resource?: {
    id: string;
    title: string;
    coverImage?: string | null;
    category?: string | null;
    pointsCost?: number;
    useCount?: number;
    status?: string;
    updatedAt?: string;
  };
  title?: string;
  coverImage?: string | null;
  category?: string | null;
  pointsCost?: number;
  useCount?: number;
  status?: string;
  updatedAt?: string;
  pointsPaid?: number;
  acquiredAt?: string;
  createdAt?: string;
  viewedAt?: string;
  generationType?: ResourceType;
  templateId?: string;
  template?: { title?: string; coverImage?: string | null; category?: string | null };
}

type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const STATUS_LABEL: Record<string, { label: string; variant: StatusVariant }> = {
  PENDING: { label: 'statusPending', variant: 'secondary' },
  IN_REVIEW: { label: 'statusInReview', variant: 'secondary' },
  APPROVED: { label: 'statusApproved', variant: 'default' },
  REJECTED: { label: 'statusRejected', variant: 'destructive' },
  ARCHIVED: { label: 'statusArchived', variant: 'outline' },
};

const TABS: { key: MeTab; labelKey: string; icon: React.ReactNode }[] = [
  { key: 'acquired', labelKey: 'tabAcquired', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { key: 'favorites', labelKey: 'tabFavorites', icon: <Star className="h-3.5 w-3.5" /> },
  { key: 'published', labelKey: 'tabPublished', icon: <Upload className="h-3.5 w-3.5" /> },
  { key: 'generations', labelKey: 'tabGenerations', icon: <Clock className="h-3.5 w-3.5" /> },
  { key: 'history', labelKey: 'tabHistory', icon: <Bookmark className="h-3.5 w-3.5" /> },
];

const RESOURCE_TYPE_LABEL_KEY: Record<ResourceType, string> = {
  SKILL: 'skill',
  MCP: 'mcp',
  AGENT: 'agent',
  IMAGE_TEMPLATE: 'imageTemplate',
  VIDEO_TEMPLATE: 'videoTemplate',
};

export default function ResourcesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('profile.resources');

  const initialTab = (searchParams?.get('tab') as MeTab) || 'acquired';
  const [tab, setTab] = useState<MeTab>(initialTab);
  const [items, setItems] = useState<AggregatedItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    meApi
      .resources(tab, { page: 1, pageSize: 30 })
      .then((res) => {
        if (cancelled) return;
        const data = res.data as { items: AggregatedItem[] };
        setItems(data.items ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const rowLabels = useMemo(
    () => ({
      resource: t('defaultResource'),
      archivedResource: t('archivedResource'),
      generationRecord: t('generationRecord'),
    }),
    [t],
  );
  const rows = useMemo(() => normalizeRows(items, tab, rowLabels), [items, tab, rowLabels]);

  const goDetail = (resourceType: ResourceType | undefined, resourceId: string | undefined) => {
    if (!resourceType || !resourceId) return;
    const slug = TYPE_TO_SLUG[resourceType];
    if (!slug) return;
    router.push(`/marketplace/${slug}/${resourceId}`);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <h1 className="ml-1 text-sm font-semibold text-foreground">{t('contentTitle')}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
          {TABS.map((tabItem) => {
            const active = tab === tabItem.key;
            return (
              <button
                key={tabItem.key}
                onClick={() => {
                  setTab(tabItem.key);
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', tabItem.key);
                  window.history.replaceState({}, '', url.toString());
                }}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors -mb-px ${
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

        <div className="mt-4">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{t('loading')}</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{t('empty')}</div>
          ) : (
            <ResourceTable rows={rows} tab={tab} onClickRow={goDetail} />
          )}
        </div>
      </div>
    </div>
  );
}

interface NormalizedRow {
  key: string;
  title: string;
  cover?: string | null;
  resourceType?: ResourceType;
  resourceId?: string;
  category?: string;
  pointsCost?: number;
  useCount?: number;
  status?: string;
  pointsPaid?: number;
  timestamp?: string;
}

function normalizeRows(
  items: AggregatedItem[],
  tab: MeTab,
  labels: { resource: string; archivedResource: string; generationRecord: string },
): NormalizedRow[] {
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
        category: (r as { category?: string })?.category ?? undefined,
        pointsPaid: it.pointsPaid,
        timestamp: it.acquiredAt,
      };
    }
    if (tab === 'favorites' || tab === 'history') {
      const r = it.resource as
        | { id: string; title: string; coverImage?: string | null; category?: string; pointsCost?: number; useCount?: number }
        | undefined;
      return {
        key: `${(it as { id?: string }).id ?? idx}`,
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
        key: `${(it as { id?: string }).id ?? idx}`,
        title: it.title ?? labels.resource,
        cover: it.coverImage,
        resourceType: it.resourceType,
        resourceId: (it as { id?: string }).id,
        category: it.category ?? undefined,
        pointsCost: it.pointsCost,
        useCount: it.useCount,
        status: it.status,
        timestamp: it.updatedAt,
      };
    }
    if (tab === 'generations') {
      const tpl = it.template;
      return {
        key: `${(it as { id?: string }).id ?? idx}`,
        title: tpl?.title ?? labels.generationRecord,
        cover: tpl?.coverImage,
        resourceType: it.generationType,
        resourceId: it.templateId,
        category: tpl?.category ?? undefined,
        timestamp: it.createdAt,
      };
    }
    return { key: `${idx}`, title: '—' };
  });
}

function ResourceTable({
  rows,
  tab,
  onClickRow,
}: {
  rows: NormalizedRow[];
  tab: MeTab;
  onClickRow: (type: ResourceType | undefined, id: string | undefined) => void;
}) {
  const t = useTranslations('profile.resources');
  const tMarketplace = useTranslations('marketplace');

  return (
    <Card className="p-0 gap-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>{t('table.resource')}</TableHead>
            <TableHead>{t('table.type')}</TableHead>
            <TableHead>{t('table.category')}</TableHead>
            {tab === 'acquired' && <TableHead className="text-right">{t('table.pointsSpent')}</TableHead>}
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
                  {row.resourceType ? tMarketplace(`resourceType.${RESOURCE_TYPE_LABEL_KEY[row.resourceType]}`) : '—'}
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
                      {status ? <Badge variant={status.variant}>{t(`status.${status.label}`)}</Badge> : '—'}
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
