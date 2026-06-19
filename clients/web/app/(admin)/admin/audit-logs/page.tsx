'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@autix/shared-ui/ui';
import { RefreshCw, Filter, ChevronLeft } from 'lucide-react';
import {
  membershipAdminApi,
  type AdminAuditEntry,
  type AdminAuditLogPage,
} from '@autix/sdk';

const PAGE_SIZE = 50;

export default function AdminAuditLogsPage() {
  const t = useTranslations('adminAuditLogs');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [items, setItems] = useState<AdminAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterAction, setFilterAction] = useState('');
  const [filterActorId, setFilterActorId] = useState('');
  const [appliedAction, setAppliedAction] = useState('');
  const [appliedActorId, setAppliedActorId] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const fetchPage = async (cursor: number | null, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await membershipAdminApi.getAuditLogs({
        action: appliedAction || undefined,
        actorId: appliedActorId || undefined,
        limit: PAGE_SIZE,
        cursor: cursor ?? undefined,
      });
      const data: AdminAuditLogPage = res.data;
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setTotal(data.total ?? 0);
      setNextCursor(data.nextCursor ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? t('loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedAction, appliedActorId]);

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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Button
          size="sm"
          variant="ghost"
          className="cursor-pointer"
          onClick={() => router.push('/admin')}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {tCommon('back')}
        </Button>
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
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
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
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
          <Filter className="w-3.5 h-3.5 mr-1" />
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
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('time')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>Actor</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => {
                const isOpen = !!expanded[entry.id];
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted)' }}>{entry.id}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--foreground)' }}>{fmt(entry.at)}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{entry.action}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted)' }}>{entry.actorId || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      <button
                        onClick={() => setExpanded((s) => ({ ...s, [entry.id]: !s[entry.id] }))}
                        className="cursor-pointer underline"
                        style={{ color: 'var(--brand)' }}
                      >
                        {isOpen ? t('hide') : t('viewJson')}
                      </button>
                      {isOpen && (
                        <pre
                          className="mt-2 p-2 rounded text-[11px] overflow-x-auto"
                          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
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

      <div className="p-4 flex justify-center" style={{ borderTop: '1px solid var(--border)' }}>
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
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('allLoaded')}</span>
          )
        )}
      </div>
    </div>
  );
}
