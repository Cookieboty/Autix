'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useGenerationTaskAdminList } from '@autix/shared-store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Button } from '../../ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../ui/empty';
import { GenerationTaskDetailDrawer } from './generation-task-detail-drawer';
import {
  buildListParams,
  formatDuration,
  statusTone,
  type GenerationTaskFilters,
} from './generation-task-view.helpers';

// 与 GalleryModerationView.tsx:83-84 保持一致的输入控件类名。
const CONTROL_CLASS =
  'h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2';

const TONE_CLASS: Record<string, string> = {
  success: 'text-emerald-600',
  danger: 'text-red-600',
  neutral: 'text-muted-foreground',
};

export function GenerationTaskAdminView() {
  const t = useTranslations('adminOperations');
  const [filters, setFilters] = useState<GenerationTaskFilters>({});
  // 游标栈支持"上一页"：栈顶是当前页的游标，null 表示第一页。
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const cursor = cursorStack[cursorStack.length - 1];
  const params = useMemo(() => buildListParams(filters, cursor), [filters, cursor]);
  const { data, isLoading, isError, refetch } = useGenerationTaskAdminList(params);

  // 改筛选必须重置游标栈——否则会拿着旧条件的游标去查新条件，结果错乱。
  function patchFilter(key: keyof GenerationTaskFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCursorStack([null]);
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">{t('generationTasks.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('generationTasks.description')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className={CONTROL_CLASS}
          value={filters.kind ?? ''}
          onChange={(e) => patchFilter('kind', e.target.value)}
        >
          <option value="">{t('generationTasks.filters.allKinds')}</option>
          <option value="IMAGE">IMAGE</option>
          <option value="VIDEO">VIDEO</option>
        </select>

        <select
          className={CONTROL_CLASS}
          value={filters.status ?? ''}
          onChange={(e) => patchFilter('status', e.target.value)}
        >
          <option value="">{t('generationTasks.filters.allStatuses')}</option>
          {['PENDING', 'QUEUED', 'SUCCEEDED', 'FAILED', 'EXPIRED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          className={CONTROL_CLASS}
          value={filters.errorStage ?? ''}
          onChange={(e) => patchFilter('errorStage', e.target.value)}
        >
          <option value="">{t('generationTasks.filters.allStages')}</option>
          {['SUBMIT', 'POLL', 'CALLBACK', 'PERSIST', 'BILLING'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <input
          className={CONTROL_CLASS}
          placeholder={t('generationTasks.filters.userId')}
          value={filters.userId ?? ''}
          onChange={(e) => patchFilter('userId', e.target.value)}
        />
        <input
          className={CONTROL_CLASS}
          placeholder={t('generationTasks.filters.model')}
          value={filters.model ?? ''}
          onChange={(e) => patchFilter('model', e.target.value)}
        />
        <input
          className={CONTROL_CLASS}
          placeholder={t('generationTasks.filters.search')}
          value={filters.q ?? ''}
          onChange={(e) => patchFilter('q', e.target.value)}
        />
        <input
          type="date"
          className={CONTROL_CLASS}
          value={filters.from ?? ''}
          onChange={(e) => patchFilter('from', e.target.value ? new Date(e.target.value).toISOString() : '')}
        />
        <input
          type="date"
          className={CONTROL_CLASS}
          value={filters.to ?? ''}
          onChange={(e) => patchFilter('to', e.target.value ? new Date(e.target.value).toISOString() : '')}
        />
        <Button variant="outline" onClick={() => { setFilters({}); setCursorStack([null]); }}>
          {t('generationTasks.filters.reset')}
        </Button>
      </div>

      {isError ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t('common.loadFailed')}</EmptyTitle>
            <EmptyDescription>
              <Button variant="outline" onClick={() => refetch()}>{t('common.refresh')}</Button>
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : !isLoading && (data?.items.length ?? 0) === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t('generationTasks.empty.title')}</EmptyTitle>
            <EmptyDescription>{t('generationTasks.empty.description')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('generationTasks.table.status')}</TableHead>
              <TableHead>{t('generationTasks.table.kind')}</TableHead>
              <TableHead>{t('generationTasks.table.model')}</TableHead>
              <TableHead>{t('generationTasks.table.user')}</TableHead>
              <TableHead>{t('generationTasks.table.stage')}</TableHead>
              <TableHead>{t('generationTasks.table.upstreamStatus')}</TableHead>
              <TableHead>{t('generationTasks.table.duration')}</TableHead>
              <TableHead>{t('generationTasks.table.createdAt')}</TableHead>
              <TableHead>{t('generationTasks.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className={TONE_CLASS[statusTone(item.status)]}>{item.status}</TableCell>
                <TableCell>{item.kind}</TableCell>
                <TableCell>{item.model}</TableCell>
                <TableCell className="font-mono text-xs">{item.userId}</TableCell>
                <TableCell>{item.errorStage ?? '—'}</TableCell>
                <TableCell>{item.upstreamStatus ?? '—'}</TableCell>
                <TableCell>{formatDuration(item.durationMs)}</TableCell>
                <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openDetail(item.id)}>
                    {t('generationTasks.table.detail')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={cursorStack.length <= 1}
          onClick={() => setCursorStack((prev) => prev.slice(0, -1))}
        >
          {t('generationTasks.pager.prev')}
        </Button>
        <Button
          variant="outline"
          disabled={!data?.nextCursor}
          onClick={() => setCursorStack((prev) => [...prev, data!.nextCursor])}
        >
          {t('generationTasks.pager.next')}
        </Button>
      </div>

      <GenerationTaskDetailDrawer
        taskId={selectedId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
