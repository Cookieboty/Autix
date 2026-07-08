'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  EyeOff,
  Trash2,
  RefreshCw,
  ImageOff,
  Flame,
  Upload,
  Search,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGalleryAdminList,
  useGalleryCategories,
  useGalleryModeration,
  useImportGalleryMutation,
  useGalleryBatchJobPoller,
  galleryAdminQueryKeys,
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
import { TemplateImportDialog } from '../TemplateImportDialog';

/** 广场作品 JSON 导入模板：与后端 GET /api/admin/gallery/import-template 返回结构保持一致。 */
const GALLERY_IMPORT_TEMPLATE = [
  {
    kind: 'IMAGE',
    title: '',
    description: '',
    category: '',
    tags: [],
    coverImage: '',
    mediaUrls: [],
    aspectRatio: '',
    durationSec: 0,
  },
];

const SOURCE_LABEL: Record<GalleryPostAdminItem['sourceType'], string> = {
  USER_UPLOAD: '用户上传',
  FROM_GENERATION: '生成结果',
  FROM_TEMPLATE: '模板作品',
  ADMIN_CURATED: '运营精选',
};

const SOURCE_OPTIONS: { value: GalleryAdminSourceType; label: string }[] = [
  { value: 'USER_UPLOAD', label: '用户上传' },
  { value: 'FROM_GENERATION', label: '生成结果' },
  { value: 'FROM_TEMPLATE', label: '模板作品' },
  { value: 'ADMIN_CURATED', label: '运营精选' },
];

const PAGE_SIZE = 20;
const CONTROL_CLASS =
  'h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground';

function thumbnailOf(item: GalleryPostAdminItem): string | null {
  return item.coverImage ?? item.mediaUrls[0] ?? null;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN');
  } catch {
    return iso;
  }
}

type GalleryAdminTab = Extract<GalleryAdminStatus, 'PENDING' | 'PUBLISHED'>;

const TABS: { value: GalleryAdminTab; label: string }[] = [
  { value: 'PENDING', label: '待审核' },
  { value: 'PUBLISHED', label: '已审核' },
];

export function GalleryModerationView() {
  const [tab, setTab] = useState<GalleryAdminTab>('PENDING');
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();
  const importGalleryMutation = useImportGalleryMutation();
  const pollBatchJob = useGalleryBatchJobPoller();

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">广场审核</h1>
          <p className="text-xs text-muted-foreground">
            审核用户投稿到广场的作品，管理已发布作品并支持内联加热。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            导入
          </Button>
          <div className="inline-flex items-center gap-1 rounded-md border bg-muted/40 p-1">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`cursor-pointer rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setTab(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* key=tab 让切 tab 时面板重挂载，筛选/页码回到初始，避免串状态 */}
      <GalleryPanel key={tab} status={tab} />

      <TemplateImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void queryClient.invalidateQueries({ queryKey: galleryAdminQueryKeys.root() });
        }}
        importFn={(items) => importGalleryMutation.mutateAsync(items).then((r) => r.data)}
        pollJob={pollBatchJob}
        template={GALLERY_IMPORT_TEMPLATE}
      />
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
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rejectTarget, setRejectTarget] = useState<GalleryPostAdminItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [boostTarget, setBoostTarget] = useState<GalleryPostAdminItem | null>(null);

  // 搜索防抖：输入停 400ms 才应用，并回到第 1 页
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const patchFilter = (patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
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
  const { approve, reject, hide, remove } = useGalleryModeration({
    onSuccess: () => {
      setRejectTarget(null);
      setRejectReason('');
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const loading = isLoading || isFetching;
  const acting = approve.isPending || reject.isPending || hide.isPending || remove.isPending;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const isPending = status === 'PENDING';

  const handleReject = () => {
    if (!rejectTarget || rejectReason.trim().length === 0) return;
    reject.mutate({ id: rejectTarget.id, reason: rejectReason.trim() });
  };

  const handleHide = (item: GalleryPostAdminItem) => {
    if (!window.confirm(`确定要下架《${item.title ?? item.id}》吗？`)) return;
    hide.mutate(item.id);
  };

  const handleRemove = (item: GalleryPostAdminItem) => {
    if (
      !window.confirm(
        `确定要移除《${item.title ?? item.id}》吗？仅从广场移除，不影响用户自己的生成记录。`,
      )
    )
      return;
    remove.mutate(item.id);
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
            placeholder="搜索标题"
            className={`${CONTROL_CLASS} w-48 pl-7`}
          />
        </div>

        <select
          value={filters.kind}
          onChange={(e) => patchFilter({ kind: e.target.value as Filters['kind'] })}
          className={CONTROL_CLASS}
          aria-label="类型"
        >
          <option value="">全部类型</option>
          <option value="IMAGE">图片</option>
          <option value="VIDEO">视频</option>
        </select>

        <select
          value={filters.category}
          onChange={(e) => patchFilter({ category: e.target.value })}
          className={CONTROL_CLASS}
          aria-label="分类"
        >
          <option value="">全部分类</option>
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
          aria-label="来源"
        >
          <option value="">全部来源</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
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
          仅非我域名
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
            清除筛选
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            共 {total} 条{total > 0 ? ` · 第 ${rangeStart}-${rangeEnd} 条` : ''}
          </span>
          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border bg-surface">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            加载中…
          </div>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImageOff />
              </EmptyMedia>
              <EmptyTitle>{isPending ? '暂无待审核作品' : '暂无匹配作品'}</EmptyTitle>
              <EmptyDescription>
                {search || filters.kind || filters.category || filters.sourceType || filters.externalOnly
                  ? '当前筛选下没有作品，试试调整筛选条件。'
                  : isPending
                    ? '广场投稿队列已清空，稍后再来看看吧。'
                    : '通过审核的作品会展示在这里。'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>作品</TableHead>
                <TableHead>作者</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>{isPending ? '提交时间' : '发布时间'}</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const thumb = thumbnailOf(item);
                return (
                  <TableRow key={item.id}>
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
                            {item.title || '未命名作品'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.kind === 'IMAGE' ? '图片' : '视频'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {item.authorSnapshot?.displayName ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {SOURCE_LABEL[item.sourceType] ?? item.sourceType}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTime(isPending ? item.createdAt : item.publishedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isPending ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={acting}
                              className="h-8 px-2 cursor-pointer hover:bg-success/10 hover:text-success"
                              onClick={() => approve.mutate(item.id)}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              通过
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={acting}
                              className="h-8 px-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => {
                                setRejectTarget(item);
                                setRejectReason('');
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              驳回
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={acting}
                            className="h-8 px-2 cursor-pointer hover:bg-orange-500/10 hover:text-orange-500"
                            onClick={() => setBoostTarget(item)}
                          >
                            <Flame className="h-3.5 w-3.5 mr-1" />
                            加热
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={acting}
                          className="h-8 px-2 cursor-pointer"
                          onClick={() => handleHide(item)}
                        >
                          <EyeOff className="h-3.5 w-3.5 mr-1" />
                          {isPending ? '下架' : '隐藏'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={acting}
                          className="h-8 px-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleRemove(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          移除
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
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
          <DialogHeader><DialogTitle>驳回作品</DialogTitle></DialogHeader>
          <DialogBody>
            <label className="mb-1.5 block text-sm font-medium text-foreground">驳回原因</label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请填写驳回原因，将展示给作者"
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
              取消
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={reject.isPending || rejectReason.trim().length === 0}
              onClick={handleReject}
            >
              {reject.isPending ? '处理中…' : '确认驳回'}
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
        resourceLabel={boostTarget ? `《${boostTarget.title || '未命名作品'}》` : undefined}
        title="加热作品"
      />
    </>
  );
}
