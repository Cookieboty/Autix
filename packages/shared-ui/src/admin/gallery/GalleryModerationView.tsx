'use client';

import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  EyeOff,
  Trash2,
  RefreshCw,
  ImageOff,
  Flame,
} from 'lucide-react';
import {
  useGalleryPendingQueue,
  useGalleryByStatus,
  useGalleryModeration,
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

const SOURCE_LABEL: Record<GalleryPostAdminItem['sourceType'], string> = {
  USER_UPLOAD: '用户上传',
  FROM_GENERATION: '生成结果',
  FROM_TEMPLATE: '模板作品',
  ADMIN_CURATED: '运营精选',
};

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

type GalleryAdminTab = 'PENDING' | 'PUBLISHED';

const TABS: { value: GalleryAdminTab; label: string }[] = [
  { value: 'PENDING', label: '待审核' },
  { value: 'PUBLISHED', label: '已审核' },
];

export function GalleryModerationView() {
  const [tab, setTab] = useState<GalleryAdminTab>('PENDING');

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">广场审核</h1>
          <p className="text-xs text-muted-foreground">
            审核用户投稿到广场的作品，管理已发布作品并支持内联加热。
          </p>
        </div>
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

      {tab === 'PENDING' ? <PendingPanel /> : <PublishedPanel />}
    </div>
  );
}

function PendingPanel() {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);
  const [rejectTarget, setRejectTarget] = useState<GalleryPostAdminItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading, isFetching, refetch } = useGalleryPendingQueue(cursor);
  const { approve, reject, hide, remove } = useGalleryModeration({
    onSuccess: () => {
      setRejectTarget(null);
      setRejectReason('');
    },
  });

  const items = data?.items ?? [];
  const nextCursor = data?.nextCursor ?? null;
  const loading = isLoading || isFetching;
  const acting =
    approve.isPending || reject.isPending || hide.isPending || remove.isPending;

  const handleNextPage = () => {
    if (!nextCursor) return;
    setCursorStack((prev) => [...prev, cursor]);
    setCursor(nextCursor);
  };

  const handlePrevPage = () => {
    setCursorStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const prevCursor = next.pop();
      setCursor(prevCursor);
      return next;
    });
  };

  const handleReject = () => {
    if (!rejectTarget || rejectReason.trim().length === 0) return;
    reject.mutate({ id: rejectTarget.id, reason: rejectReason.trim() });
  };

  const handleHide = (item: GalleryPostAdminItem) => {
    if (!window.confirm(`确定要下架《${item.title ?? item.id}》吗？`)) return;
    hide.mutate(item.id);
  };

  const handleRemove = (item: GalleryPostAdminItem) => {
    if (!window.confirm(`确定要移除《${item.title ?? item.id}》吗？此操作不可撤销。`)) return;
    remove.mutate(item.id);
  };

  return (
    <>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </Button>
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
              <EmptyTitle>暂无待审核作品</EmptyTitle>
              <EmptyDescription>广场投稿队列已清空，稍后再来看看吧。</EmptyDescription>
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
                <TableHead>提交时间</TableHead>
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
                          // eslint-disable-next-line @next/next/no-img-element
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
                      {formatTime(item.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={acting}
                          className="h-8 px-2 cursor-pointer"
                          onClick={() => handleHide(item)}
                        >
                          <EyeOff className="h-3.5 w-3.5 mr-1" />
                          下架
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

      {(cursorStack.length > 0 || nextCursor) && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={cursorStack.length === 0 || loading}
            onClick={handlePrevPage}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={!nextCursor || loading}
            onClick={handleNextPage}
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
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              驳回原因
            </label>
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
    </>
  );
}

/** 已审核（PUBLISHED）列表：支持内联加热 / 隐藏 / 移除。 */
function PublishedPanel() {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);
  const [boostTarget, setBoostTarget] = useState<GalleryPostAdminItem | null>(null);

  const { data, isLoading, isFetching, refetch } = useGalleryByStatus('PUBLISHED', cursor);
  const { hide, remove } = useGalleryModeration();

  const items = data?.items ?? [];
  const nextCursor = data?.nextCursor ?? null;
  const loading = isLoading || isFetching;
  const acting = hide.isPending || remove.isPending;

  const handleNextPage = () => {
    if (!nextCursor) return;
    setCursorStack((prev) => [...prev, cursor]);
    setCursor(nextCursor);
  };

  const handlePrevPage = () => {
    setCursorStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const prevCursor = next.pop();
      setCursor(prevCursor);
      return next;
    });
  };

  const handleHide = (item: GalleryPostAdminItem) => {
    if (!window.confirm(`确定要下架《${item.title ?? item.id}》吗？`)) return;
    hide.mutate(item.id);
  };

  const handleRemove = (item: GalleryPostAdminItem) => {
    if (!window.confirm(`确定要移除《${item.title ?? item.id}》吗？此操作不可撤销。`)) return;
    remove.mutate(item.id);
  };

  return (
    <>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </Button>
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
              <EmptyTitle>暂无已审核作品</EmptyTitle>
              <EmptyDescription>通过审核的作品会展示在这里。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>作品</TableHead>
                <TableHead>作者</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>发布时间</TableHead>
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
                          // eslint-disable-next-line @next/next/no-img-element
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
                      {formatTime(item.publishedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={acting}
                          className="h-8 px-2 cursor-pointer"
                          onClick={() => handleHide(item)}
                        >
                          <EyeOff className="h-3.5 w-3.5 mr-1" />
                          隐藏
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

      {(cursorStack.length > 0 || nextCursor) && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={cursorStack.length === 0 || loading}
            onClick={handlePrevPage}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={!nextCursor || loading}
            onClick={handleNextPage}
          >
            下一页
          </Button>
        </div>
      )}

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
