'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@autix/shared-ui/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pointsApi, type PointsBalance, type PointsRecord } from '@autix/shared-lib';

type SourceFilter = '' | 'MEMBERSHIP' | 'PACKAGE' | 'TASK' | 'INVITATION' | 'ADMIN_GRANT';

const SOURCE_OPTIONS: { key: SourceFilter; label: string }[] = [
  { key: '', label: 'sourceAll' },
  { key: 'MEMBERSHIP', label: 'sourceMembership' },
  { key: 'PACKAGE', label: 'sourcePackage' },
  { key: 'TASK', label: 'sourceTask' },
  { key: 'INVITATION', label: 'sourceInvitation' },
  { key: 'ADMIN_GRANT', label: 'sourceAdminGrant' },
];

const PAGE_SIZE = 20;

export function MembershipPointsPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [records, setRecords] = useState<PointsRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<SourceFilter>('');
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async (p: number, s: SourceFilter) => {
    setLoading(true);
    try {
      const res = await pointsApi.getRecords({
        page: p,
        pageSize: PAGE_SIZE,
        source: s || undefined,
      });
      const data = res.data as any;
      setRecords(data.items ?? data ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    pointsApi.getBalance()
      .then((res) => setBalance(res.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchRecords(page, source);
  }, [page, source, fetchRecords]);

  const pageCount = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <h1 className="text-sm font-semibold text-foreground">{t('pointsDetail')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Balance card */}
        <div
          className="rounded-xl p-5 mb-6"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('pointsBalance')}</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            {balance?.balance ?? 0}
          </p>
        </div>

        {/* Source filter tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {SOURCE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setSource(key); setPage(1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: source === key ? 'var(--accent)' : 'var(--surface)',
                color: source === key ? '#fff' : 'var(--foreground)',
                border: source === key ? 'none' : '1px solid var(--border)',
              }}
            >
              {t(label)}
            </button>
          ))}
        </div>

        {/* Records table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-secondary)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>类型</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>数量</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>来源</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>备注</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>时间</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: r.type === 'EARN' ? '#22c55e20' : '#ef444420',
                          color: r.type === 'EARN' ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {r.type === 'EARN' ? '+' : '-'}
                      </span>
                    </td>
                    <td
                      className="text-right px-4 py-2.5 font-medium"
                      style={{ color: r.type === 'EARN' ? 'var(--success)' : 'var(--danger)' }}
                    >
                      {r.type === 'EARN' ? '+' : '-'}{r.amount}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--foreground)' }}>
                      {t(`source${r.source.charAt(0)}${r.source.slice(1).toLowerCase().replace(/_./g, (m) => m[1].toUpperCase())}` as any)}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                      {r.remark || '-'}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div
          className="flex items-center justify-center gap-2 px-6 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} className="cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{page} / {pageCount}</span>
          <Button size="sm" variant="ghost" disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
