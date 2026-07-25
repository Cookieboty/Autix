'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Filter, RefreshCw } from 'lucide-react';
import { useAdminAuditLogsController } from '@autix/shared-store';
import { Button, Input } from '../../ui';

const PAGE_SIZE = 50;

export interface AdminAuditLogsViewProps {
  onBack?: () => void;
}

export function AdminAuditLogsView({ onBack }: AdminAuditLogsViewProps) {
  const t = useTranslations('adminAuditLogs');
  const tCommon = useTranslations('common');

  const [filterAction, setFilterAction] = useState('');
  const [filterActorId, setFilterActorId] = useState('');
  const [appliedAction, setAppliedAction] = useState('');
  const [appliedActorId, setAppliedActorId] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const { items, total, nextCursor, loading, error, loadPage } =
    useAdminAuditLogsController({
      loadFailedMessage: t('loadFailed'),
      pageSize: PAGE_SIZE,
    });

  const fetchPage = useCallback(
    (cursor: number | null, append: boolean) =>
      loadPage({
        action: appliedAction,
        actorId: appliedActorId,
        append,
        cursor,
      }),
    [appliedAction, appliedActorId, loadPage],
  );

  useEffect(() => {
    void fetchPage(null, false);
  }, [fetchPage]);

  const applyFilter = () => {
    setAppliedAction(filterAction.trim());
    setAppliedActorId(filterActorId.trim());
  };

  const resetFilter = () => {
    setFilterAction('');
    setFilterActorId('');
    setAppliedAction('');
    setAppliedActorId('');
  };

  const fmt = useMemo(
    () => (v: string) => {
      try {
        return new Date(v).toLocaleString();
      } catch {
        return v;
      }
    },
    [],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          {tCommon('back')}
        </Button>
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('title')}
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('summary', { total, count: items.length })}
          </p>
        </div>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={() => fetchPage(null, false)}
            disabled={loading}
          >
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {tCommon('refresh')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>
          action
          <Input
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder={t('actionPlaceholder')}
            className="mt-1 w-56"
          />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>
          actorId
          <Input
            value={filterActorId}
            onChange={(e) => setFilterActorId(e.target.value)}
            placeholder={t('actorPlaceholder')}
            className="mt-1 w-72"
          />
        </label>
        <Button size="sm" className="cursor-pointer" onClick={applyFilter} disabled={loading}>
          <Filter className="mr-1 h-3.5 w-3.5" />
          {t('filter')}
        </Button>
        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={resetFilter} disabled={loading}>
          {tCommon('reset')}
        </Button>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && !loading ? (
          <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>
            {t('empty')}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  {t('columnId')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  {t('time')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  {t('columnAction')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  {t('columnActor')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  {t('columnPayload')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => {
                const isOpen = !!expanded[entry.id];
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                      {entry.id}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--foreground)' }}>
                      {fmt(entry.at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--foreground)' }}>
                      {entry.action}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                      {entry.actorId || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <button
                        type="button"
                        onClick={() => setExpanded((s) => ({ ...s, [entry.id]: !s[entry.id] }))}
                        className="cursor-pointer underline"
                        style={{ color: 'var(--brand)' }}
                      >
                        {isOpen ? t('hide') : t('viewJson')}
                      </button>
                      {isOpen && (
                        <pre
                          className="mt-2 overflow-x-auto rounded p-2 text-[11px]"
                          style={{
                            backgroundColor: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--foreground)',
                          }}
                        >
                          {JSON.stringify(entry.payload, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-center p-4" style={{ borderTop: '1px solid var(--border)' }}>
        {nextCursor != null ? (
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            disabled={loading}
            onClick={() => fetchPage(nextCursor, true)}
          >
            {loading ? t('loadingMore') : t('loadMore')}
          </Button>
        ) : (
          items.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {t('allLoaded')}
            </span>
          )
        )}
      </div>
    </div>
  );
}
