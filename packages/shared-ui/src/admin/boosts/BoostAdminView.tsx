'use client';

import { useMemo, useState } from 'react';
import { Flame, Plus, RefreshCw, Search, XCircle } from 'lucide-react';
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
import { BoostDialog, BOOST_RESOURCE_TYPE_OPTIONS, BOOST_REASON_OPTIONS } from './BoostDialog';

const RESOURCE_TYPE_OPTIONS = BOOST_RESOURCE_TYPE_OPTIONS;
const REASON_OPTIONS = BOOST_REASON_OPTIONS;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN');
  } catch {
    return iso;
  }
}

export function BoostAdminView() {
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

  const items = useMemo(() => boosts ?? [], [boosts]);
  const loading = isLoading || isFetching;

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
          <Button size="sm" className="cursor-pointer" onClick={() => setCreateOpen(true)}>
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

      <BoostDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
