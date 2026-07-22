'use client';

import { useMemo, useState } from 'react';
import { Flame, Plus, RefreshCw, Search, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  useBoostAdmin,
  useBoostsList,
  type MetricResourceType,
  type ResourceBoostAdminItem,
} from '@autix/shared-store';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '../../ui/empty';
import { AdminPaginationFooter, useClientPagination } from '../layout';
import { BoostDialog, BOOST_RESOURCE_TYPE_OPTIONS, BOOST_REASON_OPTIONS } from './BoostDialog';

const RESOURCE_TYPE_OPTIONS = BOOST_RESOURCE_TYPE_OPTIONS;
const REASON_OPTIONS = BOOST_REASON_OPTIONS;

function formatTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale);
  } catch {
    return iso;
  }
}

export function BoostAdminView() {
  const t = useTranslations('adminOperations');
  const locale = useLocale();
  const [typeFilter, setTypeFilter] = useState<MetricResourceType | ''>('');
  const [queryFilter, setQueryFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const {
    data: boosts,
    isLoading,
    isFetching,
    refetch,
  } = useBoostsList({
    type: typeFilter || undefined,
    query: queryFilter || undefined,
  });

  const { revoke } = useBoostAdmin();

  const allBoosts = useMemo(() => boosts ?? [], [boosts]);
  const { items, page, setPage, pageSize, total } = useClientPagination(allBoosts, 20);
  const loading = isLoading || isFetching;

  const handleRevoke = (boost: ResourceBoostAdminItem) => {
    if (!window.confirm(t('boost.revokeConfirm', { resource: `${boost.resourceType} ${boost.resourceId}` }))) return;
    revoke.mutate(boost.id);
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">{t('boost.title')}</h1>
          <p className="text-xs text-muted-foreground">
            {t('boost.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t('common.refresh')}
          </Button>
          <Button size="sm" className="cursor-pointer" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            {t('boost.add')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={typeFilter || 'ALL'}
          onValueChange={(value) =>
            setTypeFilter(value === 'ALL' ? '' : (value as MetricResourceType))
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('boost.allTypes')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('boost.allTypes')}</SelectItem>
            {RESOURCE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={queryFilter}
            onChange={(e) => setQueryFilter(e.target.value)}
            placeholder={t('boost.searchPlaceholder')}
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border bg-surface">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('common.loading')}
          </div>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Flame />
              </EmptyMedia>
              <EmptyTitle>{t('boost.emptyTitle')}</EmptyTitle>
              <EmptyDescription>{t('boost.emptyDescription')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('boost.columns.resource')}</TableHead>
                <TableHead>{t('boost.columns.score')}</TableHead>
                <TableHead>{t('boost.columns.reason')}</TableHead>
                <TableHead>{t('boost.columns.validity')}</TableHead>
                <TableHead>{t('boost.columns.status')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((boost) => {
                const reasonOption = REASON_OPTIONS.find((r) => r.value === boost.reason);
                return (
                  <TableRow key={boost.id}>
                    <TableCell>
                      <div className="text-sm font-medium text-foreground">{boost.resourceType}</div>
                      <div className="font-mono text-xs text-muted-foreground">{boost.resourceId}</div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      <div className="flex items-center gap-1">
                        <Flame className="h-3.5 w-3.5 text-orange-500" />
                        {boost.boostScore}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {reasonOption ? t(reasonOption.labelKey) : boost.reason}
                      {boost.note && (
                        <div className="mt-0.5 max-w-40 truncate text-xs text-muted-foreground">
                          {boost.note}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTime(boost.startsAt, locale)} ~ {formatTime(boost.endsAt, locale)}
                    </TableCell>
                    <TableCell>
                      {boost.isActive && boost.isCurrentlyActive ? (
                        <Badge variant="secondary">{t('boost.status.active')}</Badge>
                      ) : boost.isActive ? (
                        <Badge variant="outline">{t('boost.status.outsideWindow')}</Badge>
                      ) : (
                        <Badge variant="outline">{t('boost.status.revoked')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!boost.isActive || revoke.isPending}
                        className="h-8 px-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleRevoke(boost)}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        {t('boost.revoke')}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <AdminPaginationFooter page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <BoostDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
