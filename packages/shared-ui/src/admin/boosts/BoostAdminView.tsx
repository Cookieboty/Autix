'use client';

import { useMemo, useState } from 'react';
import { Flame, Plus, RefreshCw, Search, XCircle } from 'lucide-react';
import {
  useBoostAdmin,
  useBoostsList,
  type BoostReason,
  type MetricResourceType,
  type ResourceBoostAdminItem,
} from '@autix/shared-store';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from '../../ui/dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '../../ui/empty';

const RESOURCE_TYPE_OPTIONS: { value: MetricResourceType; label: string }[] = [
  { value: 'SKILL', label: '技能' },
  { value: 'MCP', label: 'MCP' },
  { value: 'AGENT', label: '智能体' },
  { value: 'IMAGE_TEMPLATE', label: '图片模板' },
  { value: 'VIDEO_TEMPLATE', label: '视频模板' },
  { value: 'GALLERY_POST', label: '广场作品' },
];

const REASON_OPTIONS: { value: BoostReason; label: string }[] = [
  { value: 'MANUAL', label: '人工加热' },
  { value: 'CAMPAIGN', label: '活动加热' },
  { value: 'EDITORIAL_PICK', label: '编辑精选' },
  { value: 'CORRECTION', label: '修正' },
];

/** 加热强度档位：小 / 中 / 大，对应 boostScore 数值。 */
const SCORE_TIERS: { value: string; label: string; score: number }[] = [
  { value: 'small', label: '小（+200）', score: 200 },
  { value: 'medium', label: '中（+500）', score: 500 },
  { value: 'large', label: '大（+1000）', score: 1000 },
];

type BoostForm = {
  resourceType: MetricResourceType;
  resourceId: string;
  tier: string;
  reason: BoostReason;
  note: string;
  endsAt: string;
};

const EMPTY_FORM: BoostForm = {
  resourceType: 'IMAGE_TEMPLATE',
  resourceId: '',
  tier: 'medium',
  reason: 'MANUAL',
  note: '',
  endsAt: '',
};

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN');
  } catch {
    return iso;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  const responseMessage = (error as { response?: { data?: { message?: unknown } } }).response
    ?.data?.message;
  if (typeof responseMessage === 'string') return responseMessage;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : fallback;
}

export function BoostAdminView() {
  const [typeFilter, setTypeFilter] = useState<MetricResourceType | ''>('');
  const [queryFilter, setQueryFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<BoostForm>({ ...EMPTY_FORM });
  const [error, setError] = useState<string | null>(null);

  const {
    data: boosts,
    isLoading,
    isFetching,
    refetch,
  } = useBoostsList({
    type: typeFilter || undefined,
    query: queryFilter || undefined,
  });

  const { create, revoke } = useBoostAdmin({
    onSuccess: () => {
      setCreateOpen(false);
      setForm({ ...EMPTY_FORM });
      setError(null);
    },
    onError: (err) => setError(errorMessage(err, '操作失败')),
  });

  const items = useMemo(() => boosts ?? [], [boosts]);
  const loading = isLoading || isFetching;

  const openCreate = () => {
    setError(null);
    setForm({ ...EMPTY_FORM });
    setCreateOpen(true);
  };

  const handleCreate = () => {
    if (!form.resourceId.trim() || !form.endsAt) return;
    const tier = SCORE_TIERS.find((t) => t.value === form.tier) ?? SCORE_TIERS[1];
    create.mutate({
      resourceType: form.resourceType,
      resourceId: form.resourceId.trim(),
      data: {
        boostScore: tier.score,
        reason: form.reason,
        note: form.note.trim() || null,
        endsAt: fromLocalInput(form.endsAt) ?? new Date().toISOString(),
      },
    });
  };

  const handleRevoke = (boost: ResourceBoostAdminItem) => {
    if (!window.confirm(`确定要撤销对《${boost.resourceType} ${boost.resourceId}》的加热吗？`)) return;
    revoke.mutate(boost.id);
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">内容加热</h1>
          <p className="text-xs text-muted-foreground">
            为指定资源手动提升热度分，支持设定有效期，到期自动失效。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
          <Button size="sm" className="cursor-pointer" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            新增加热
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
            <SelectValue placeholder="全部类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部类型</SelectItem>
            {RESOURCE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={queryFilter}
            onChange={(e) => setQueryFilter(e.target.value)}
            placeholder="按资源 ID 搜索"
            className="pl-8"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto rounded-lg border bg-surface">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            加载中…
          </div>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Flame />
              </EmptyMedia>
              <EmptyTitle>暂无加热记录</EmptyTitle>
              <EmptyDescription>点击右上角“新增加热”为资源提升热度分。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>资源</TableHead>
                <TableHead>加热分</TableHead>
                <TableHead>原因</TableHead>
                <TableHead>有效期</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((boost) => (
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
                    {REASON_OPTIONS.find((r) => r.value === boost.reason)?.label ?? boost.reason}
                    {boost.note && (
                      <div className="mt-0.5 max-w-40 truncate text-xs text-muted-foreground">
                        {boost.note}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatTime(boost.startsAt)} ~ {formatTime(boost.endsAt)}
                  </TableCell>
                  <TableCell>
                    {boost.isActive && boost.isCurrentlyActive ? (
                      <Badge variant="secondary">生效中</Badge>
                    ) : boost.isActive ? (
                      <Badge variant="outline">未在窗口期</Badge>
                    ) : (
                      <Badge variant="outline">已撤销</Badge>
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
                      撤销
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>新增加热</DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5">资源类型</Label>
                <Select
                  value={form.resourceType}
                  onValueChange={(value) =>
                    setForm({ ...form, resourceType: value as MetricResourceType })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5">资源 ID</Label>
                <Input
                  value={form.resourceId}
                  onChange={(e) => setForm({ ...form, resourceId: e.target.value })}
                  placeholder="目标资源 ID"
                />
              </div>
              <div>
                <Label className="mb-1.5">加热强度</Label>
                <Select value={form.tier} onValueChange={(value) => setForm({ ...form, tier: value })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORE_TIERS.map((tier) => (
                      <SelectItem key={tier.value} value={tier.value}>
                        {tier.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5">原因</Label>
                <Select
                  value={form.reason}
                  onValueChange={(value) => setForm({ ...form, reason: value as BoostReason })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="mb-1.5">结束时间</Label>
                <Input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label className="mb-1.5">备注</Label>
                <Textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="min-h-[70px]"
                  placeholder="加热原因说明，仅后台可见"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              className="cursor-pointer"
              disabled={create.isPending || !form.resourceId.trim() || !form.endsAt}
              onClick={handleCreate}
            >
              {create.isPending ? '保存中…' : '确认加热'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
