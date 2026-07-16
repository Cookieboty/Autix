'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  CheckCircle,
  XCircle,
  EyeOff,
  Trash2,
  RefreshCw,
  ImageOff,
  Flame,
  Search,
} from 'lucide-react';
import {
  useGalleryAdminList,
  useGalleryCategories,
  useGalleryModeration,
  type GalleryAdminKind,
  type GalleryAdminListParams,
  type GalleryAdminSourceType,
  type GalleryAdminStatus,
  type GalleryPostAdminItem,
} from '@autix/shared-store';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Textarea } from '../../ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from '../../ui/dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '../../ui/empty';
import { BoostDialog } from '../boosts/BoostDialog';

const SOURCE_LABEL_KEY: Record<GalleryPostAdminItem['sourceType'], string> = {
  USER_UPLOAD: 'gallery.sources.USER_UPLOAD',
  FROM_GENERATION: 'gallery.sources.FROM_GENERATION',
  FROM_TEMPLATE: 'gallery.sources.FROM_TEMPLATE',
  ADMIN_CURATED: 'gallery.sources.ADMIN_CURATED',
};

const SOURCE_OPTIONS: { value: GalleryAdminSourceType; labelKey: string }[] = [
  { value: 'USER_UPLOAD', labelKey: 'gallery.sources.USER_UPLOAD' },
  { value: 'FROM_GENERATION', labelKey: 'gallery.sources.FROM_GENERATION' },
  { value: 'FROM_TEMPLATE', labelKey: 'gallery.sources.FROM_TEMPLATE' },
  { value: 'ADMIN_CURATED', labelKey: 'gallery.sources.ADMIN_CURATED' },
];

const PAGE_SIZE = 20;
const CONTROL_CLASS =
  'h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground';

function thumbnailOf(item: GalleryPostAdminItem): string | null {
  return item.coverImage ?? item.mediaUrls[0] ?? null;
}

function formatTime(iso: string | null, locale: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale);
  } catch {
    return iso;
  }
}

type GalleryAdminTab = Extract<GalleryAdminStatus, 'PENDING' | 'PUBLISHED'>;

const TABS: { value: GalleryAdminTab; labelKey: string }[] = [
  { value: 'PENDING', labelKey: 'gallery.tabs.pending' },
  { value: 'PUBLISHED', labelKey: 'gallery.tabs.published' },
];

export function GalleryModerationView() {
  const t = useTranslations('adminOperations');
  const [tab, setTab] = useState<GalleryAdminTab>('PENDING');

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">{t('gallery.title')}</h1>
          <p className="text-xs text-muted-foreground">
            {t('gallery.description')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-md border bg-muted/40 p-1">
            {TABS.map((tabOption) => (
              <button
                key={tabOption.value}
                type="button"
                className={`cursor-pointer rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === tabOption.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setTab(tabOption.value)}
              >
                {t(tabOption.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* key=tab 让切 tab 时面板重挂载，筛选/页码回到初始，避免串状态 */}
      <GalleryPanel key={tab} status={tab} />
    </div>
  );
}

type Filters = {
  kind: '' | GalleryAdminKind;
  category: string;
  sourceType: '' | GalleryAdminSourceType;
  externalOnly: boolean;
};

const EMPTY_FILTERS: Filters = { kind: '', category: '', sourceType: '', externalOnly: false };

function GalleryPanel({ status }: { status: GalleryAdminTab }) {
  const t = useTranslations('adminOperations');
  const locale = useLocale();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rejectTarget, setRejectTarget] = useState<GalleryPostAdminItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [boostTarget, setBoostTarget] = useState<GalleryPostAdminItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [batchRejectOpen, setBatchRejectOpen] = useState(false);
  const [batchReason, setBatchReason] = useState('');
  const [failures, setFailures] = useState<{ id: string; reason: string }[]>([]);

  // 搜索防抖：输入停 400ms 才应用，并回到第 1 页
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
      setSelectedIds(new Set());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const patchFilter = (patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
    setSelectedIds(new Set()); // 选中只对当前页有意义，换了筛选就作废
  };

  const params = useMemo<GalleryAdminListParams>(
    () => ({
      status,
      kind: filters.kind || undefined,
      category: filters.category || undefined,
      sourceType: filters.sourceType || undefined,
      search: search || undefined,
      externalOnly: filters.externalOnly || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [status, filters, search, page],
  );

  const { data, isLoading, isFetching, refetch } = useGalleryAdminList(params);
  const categoriesQuery = useGalleryCategories();
  const { approve, reject, hide, remove, batch, pendingIds } = useGalleryModeration({
    onSuccess: () => {
      setRejectTarget(null);
      setRejectReason('');
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const loading = isLoading || isFetching;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const isPending = status === 'PENDING';

  const selectedCount = selectedIds.size;
  const allOnPageSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const someOnPageSelected = items.some((i) => selectedIds.has(i.id));

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelectedIds(allOnPageSelected ? new Set() : new Set(items.map((i) => i.id)));
  };

  const handleReject = () => {
    if (!rejectTarget || rejectReason.trim().length === 0) return;
    reject.mutate({ id: rejectTarget.id, reason: rejectReason.trim() });
  };

  const handleHide = (item: GalleryPostAdminItem) => {
    if (!window.confirm(t('gallery.hideConfirm', { title: item.title ?? item.id }))) return;
    hide.mutate(item.id);
  };

  const handleRemove = (item: GalleryPostAdminItem) => {
    if (
      !window.confirm(
        t('gallery.removeConfirm', { title: item.title ?? item.id }),
      )
    )
      return;
    remove.mutate(item.id);
  };

  const runBatch = (action: 'approve' | 'reject' | 'hide' | 'remove', reason?: string) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    batch.mutate(
      { ids, action, reason },
      {
        onSuccess: (result) => {
          // 成功的取消选中、失败的留着，方便修正后重试。
          setSelectedIds(new Set(result.failed.map((f) => f.id)));
          setFailures(result.failed);
          if (result.failed.length === 0) {
            toast.success(t('gallery.batch.resultAllOk', { count: result.succeeded.length }));
          } else {
            toast.warning(
              t('gallery.batch.resultPartial', {
                succeeded: result.succeeded.length,
                failed: result.failed.length,
              }),
            );
          }
          setBatchRejectOpen(false);
          setBatchReason('');
        },
      },
    );
  };

  const handleBatchHide = () => {
    if (!window.confirm(t('gallery.batch.hideConfirm', { count: selectedCount }))) return;
    runBatch('hide');
  };

  const handleBatchRemove = () => {
    if (!window.confirm(t('gallery.batch.removeConfirm', { count: selectedCount }))) return;
    runBatch('remove');
  };

  return (
    <>
      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('gallery.searchPlaceholder')}
            className={`${CONTROL_CLASS} w-48 pl-7`}
          />
        </div>

        <select
          value={filters.kind}
          onChange={(e) => patchFilter({ kind: e.target.value as Filters['kind'] })}
          className={CONTROL_CLASS}
          aria-label={t('gallery.filters.type')}
        >
          <option value="">{t('gallery.filters.allTypes')}</option>
          <option value="IMAGE">{t('gallery.kind.image')}</option>
          <option value="VIDEO">{t('gallery.kind.video')}</option>
        </select>

        <select
          value={filters.category}
          onChange={(e) => patchFilter({ category: e.target.value })}
          className={CONTROL_CLASS}
          aria-label={t('gallery.filters.category')}
        >
          <option value="">{t('gallery.filters.allCategories')}</option>
          {(categoriesQuery.data ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={filters.sourceType}
          onChange={(e) => patchFilter({ sourceType: e.target.value as Filters['sourceType'] })}
          className={CONTROL_CLASS}
          aria-label={t('gallery.filters.source')}
        >
          <option value="">{t('gallery.filters.allSources')}</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.labelKey)}
            </option>
          ))}
        </select>

        <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={filters.externalOnly}
            onChange={(e) => patchFilter({ externalOnly: e.target.checked })}
            className="cursor-pointer"
          />
          {t('gallery.filters.externalOnly')}
        </label>

        {(filters.kind || filters.category || filters.sourceType || filters.externalOnly || search) && (
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setSearchInput('');
              setSearch('');
              setPage(1);
            }}
          >
            {t('gallery.filters.clear')}
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {total > 0
              ? t('gallery.rangeWithTotal', { total, start: rangeStart, end: rangeEnd })
              : t('gallery.totalOnly', { total })}
          </span>
          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium text-foreground">
            {t('gallery.batch.selected', { count: selectedCount })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={() => setSelectedIds(new Set())}
          >
            {t('gallery.batch.clear')}
          </Button>
          <div className="ml-auto flex items-center gap-1">
            {isPending && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={batch.isPending}
                  className="cursor-pointer hover:bg-success/10 hover:text-success"
                  onClick={() => runBatch('approve')}
                >
                  <CheckCircle className="mr-1 h-3.5 w-3.5" />
                  {t('gallery.batch.approve')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={batch.isPending}
                  className="cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    setBatchReason('');
                    setBatchRejectOpen(true);
                  }}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  {t('gallery.batch.reject')}
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={batch.isPending}
              className="cursor-pointer"
              onClick={handleBatchHide}
            >
              <EyeOff className="mr-1 h-3.5 w-3.5" />
              {isPending ? t('gallery.batch.unpublish') : t('gallery.batch.hide')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={batch.isPending}
              className="cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleBatchRemove}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {t('gallery.batch.remove')}
            </Button>
          </div>
        </div>
      )}

      {failures.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-destructive">
              {t('gallery.batch.failuresTitle', { count: failures.length })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer"
              onClick={() => setFailures([])}
            >
              {t('gallery.batch.failuresDismiss')}
            </Button>
          </div>
          <ul className="mt-1 space-y-0.5">
            {failures.map((f) => (
              <li key={f.id} className="text-xs text-muted-foreground">
                {items.find((i) => i.id === f.id)?.title || f.id} — {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 overflow-y-auto rounded-lg border bg-surface">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('common.loading')}
          </div>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImageOff />
              </EmptyMedia>
              <EmptyTitle>{isPending ? t('gallery.emptyPendingTitle') : t('gallery.emptyMatchedTitle')}</EmptyTitle>
              <EmptyDescription>
                {search || filters.kind || filters.category || filters.sourceType || filters.externalOnly
                  ? t('gallery.emptyFilteredDescription')
                  : isPending
                    ? t('gallery.emptyPendingDescription')
                    : t('gallery.emptyPublishedDescription')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    aria-label={t('gallery.batch.selectAll')}
                    checked={allOnPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
                    }}
                    onChange={toggleAllOnPage}
                  />
                </TableHead>
                <TableHead>{t('gallery.columns.work')}</TableHead>
                <TableHead>{t('gallery.columns.author')}</TableHead>
                <TableHead>{t('gallery.columns.category')}</TableHead>
                <TableHead>{t('gallery.columns.source')}</TableHead>
                <TableHead>{isPending ? t('gallery.columns.submittedAt') : t('gallery.columns.publishedAt')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const thumb = thumbnailOf(item);
                const rowBusy = pendingIds.has(item.id);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="w-10">
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        aria-label={t('gallery.batch.selectRow')}
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleRow(item.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={item.title ?? ''}
                            className="h-12 w-12 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                            <ImageOff className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {item.title || t('gallery.untitled')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.kind === 'IMAGE' ? t('gallery.kind.image') : t('gallery.kind.video')}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {item.author?.nickname ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {SOURCE_LABEL_KEY[item.sourceType] ? t(SOURCE_LABEL_KEY[item.sourceType]) : item.sourceType}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTime(isPending ? item.createdAt : item.publishedAt, locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isPending ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={rowBusy}
                              className="h-8 px-2 cursor-pointer hover:bg-success/10 hover:text-success"
                              onClick={() => approve.mutate(item.id)}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              {t('gallery.approve')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={rowBusy}
                              className="h-8 px-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => {
                                setRejectTarget(item);
                                setRejectReason('');
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              {t('gallery.reject')}
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={rowBusy}
                            className="h-8 px-2 cursor-pointer hover:bg-orange-500/10 hover:text-orange-500"
                            onClick={() => setBoostTarget(item)}
                          >
                            <Flame className="h-3.5 w-3.5 mr-1" />
                            {t('gallery.boost')}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={rowBusy}
                          className="h-8 px-2 cursor-pointer"
                          onClick={() => handleHide(item)}
                        >
                          <EyeOff className="h-3.5 w-3.5 mr-1" />
                          {isPending ? t('gallery.unpublish') : t('gallery.hide')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={rowBusy}
                          className="h-8 px-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleRemove(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          {t('common.remove')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={page <= 1 || loading}
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
              setSelectedIds(new Set());
            }}
          >
            {t('gallery.previousPage')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('gallery.pageIndicator', { page, totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={page >= totalPages || loading}
            onClick={() => {
              setPage((p) => Math.min(totalPages, p + 1));
              setSelectedIds(new Set());
            }}
          >
            {t('gallery.nextPage')}
          </Button>
        </div>
      )}

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>{t('gallery.rejectDialogTitle')}</DialogTitle></DialogHeader>
          <DialogBody>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t('gallery.rejectReason')}</label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('gallery.rejectReasonPlaceholder')}
              className="min-h-[80px]"
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={reject.isPending || rejectReason.trim().length === 0}
              onClick={handleReject}
            >
              {reject.isPending ? t('common.processing') : t('gallery.confirmReject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={batchRejectOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBatchRejectOpen(false);
            setBatchReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('gallery.batch.rejectDialogTitle', { count: selectedCount })}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="mb-2 text-xs text-muted-foreground">
              {t('gallery.batch.rejectDialogHint', { count: selectedCount })}
            </p>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {t('gallery.rejectReason')}
            </label>
            <Textarea
              value={batchReason}
              onChange={(e) => setBatchReason(e.target.value)}
              placeholder={t('gallery.rejectReasonPlaceholder')}
              className="min-h-[80px]"
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                setBatchRejectOpen(false);
                setBatchReason('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={batch.isPending || batchReason.trim().length === 0}
              onClick={() => runBatch('reject', batchReason.trim())}
            >
              {batch.isPending ? t('gallery.batch.processing') : t('gallery.confirmReject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BoostDialog
        open={!!boostTarget}
        onOpenChange={(open) => {
          if (!open) setBoostTarget(null);
        }}
        resourceType="GALLERY_POST"
        resourceId={boostTarget?.id ?? ''}
        resourceLabel={boostTarget ? t('gallery.resourceLabel', { title: boostTarget.title || t('gallery.untitled') }) : undefined}
        title={t('gallery.boostDialogTitle')}
      />
    </>
  );
}
