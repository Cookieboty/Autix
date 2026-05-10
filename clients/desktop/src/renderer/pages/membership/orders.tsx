'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@autix/shared-ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { orderApi, type Order } from '@autix/shared-lib';

type StatusFilter = '' | 'PENDING' | 'PAID' | 'CANCELLED';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: '', label: 'filterAll' },
  { key: 'PENDING', label: 'orderStatusPending' },
  { key: 'PAID', label: 'orderStatusPaid' },
  { key: 'CANCELLED', label: 'orderStatusCancelled' },
];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#f59e0b20', color: '#f59e0b' },
  PAID: { bg: '#22c55e20', color: '#22c55e' },
  CANCELLED: { bg: '#6b728020', color: '#6b7280' },
  REFUNDED: { bg: '#8b5cf620', color: '#8b5cf6' },
};

const STATUS_I18N: Record<string, string> = {
  PENDING: 'orderStatusPending',
  PAID: 'orderStatusPaid',
  CANCELLED: 'orderStatusCancelled',
  REFUNDED: 'orderStatusRefunded',
};

const PAGE_SIZE = 20;

export function MembershipOrdersPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOrders = useCallback(async (p: number, s: StatusFilter) => {
    setLoading(true);
    try {
      const res = await orderApi.list({
        page: p,
        pageSize: PAGE_SIZE,
        status: s || undefined,
      });
      const data = res.data as any;
      setOrders(data.items ?? data ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(page, status);
  }, [page, status, fetchOrders]);

  const handleCancel = async (id: string) => {
    setActionLoading(id);
    try {
      await orderApi.cancel(id);
      fetchOrders(page, status);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const pageCount = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <h1 className="text-sm font-semibold text-foreground">{t('orderHistory')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Status filter tabs */}
        <div className="flex gap-2 mb-4">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setStatus(key); setPage(1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: status === key ? 'var(--accent)' : 'var(--surface)',
                color: status === key ? '#fff' : 'var(--foreground)',
                border: status === key ? 'none' : '1px solid var(--border)',
              }}
            >
              {t(label)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-secondary)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('orderNo')}</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>商品</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('orderAmount')}</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('orderStatus')}</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('orderTime')}</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('operations')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--foreground)' }}>
                      {o.orderNo}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--foreground)' }}>
                      {o.productName}
                    </td>
                    <td className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--foreground)' }}>
                      ¥{o.amount}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                        style={STATUS_STYLE[o.status] ?? { bg: 'transparent', color: 'var(--muted)' }}
                      >
                        {t(STATUS_I18N[o.status] ?? 'orderStatusPending')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                    <td className="text-right px-4 py-2.5">
                      {o.status === 'PENDING' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="cursor-pointer"
                            disabled={actionLoading === o.id}
                            onClick={() => handleCancel(o.id)}
                          >
                            {t('cancelOrder')}
                          </Button>
                        </div>
                      )}
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
