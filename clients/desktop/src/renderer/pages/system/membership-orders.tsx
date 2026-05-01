'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '@heroui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { membershipAdminApi, type Order } from '@autix/shared-lib';

const PAGE_SIZE = 15;

const STATUS_OPTIONS = ['', 'PENDING', 'PAID', 'CANCELLED', 'REFUNDED'] as const;
const TYPE_OPTIONS = ['', 'MEMBERSHIP', 'POINTS_PACKAGE'] as const;

const statusColorMap: Record<string, string> = {
  PENDING: '#f59e0b',
  PAID: '#22c55e',
  CANCELLED: '#6b7280',
  REFUNDED: '#ef4444',
};

export function SystemMembershipOrdersPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [filterUserId, setFilterUserId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  const fetchOrders = async (p = page) => {
    setLoading(true);
    try {
      const res = await membershipAdminApi.getOrders({
        page: p,
        pageSize: PAGE_SIZE,
        userId: filterUserId || undefined,
        status: filterStatus || undefined,
        orderType: filterType || undefined,
      });
      const data = res.data as any;
      setOrders(data.items ?? data ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(1); }, [filterStatus, filterType]);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      PENDING: t('orderStatusPending'),
      PAID: t('orderStatusPaid'),
      CANCELLED: t('orderStatusCancelled'),
      REFUNDED: t('orderStatusRefunded'),
    };
    return map[s] ?? s;
  };

  const typeLabel = (s: string) => {
    const map: Record<string, string> = {
      MEMBERSHIP: t('orderTypeMembership'),
      POINTS_PACKAGE: t('orderTypePackage'),
    };
    return map[s] ?? s;
  };

  const selectStyle = { border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' };
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 p-4 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('adminOrders')}</h1>
        <span className="flex-1" />
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('userId')}
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchOrders(1)}
            className="w-[160px]"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md outline-none"
            style={selectStyle}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s ? statusLabel(s) : tCommon('all')}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md outline-none"
            style={selectStyle}
          >
            {TYPE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s ? typeLabel(s) : tCommon('all')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('orderNo')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('userId')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('productName')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('amount')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('status')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('date')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{o.orderNo}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted)' }}>{o.userId}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{o.productName}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>¥{o.amount}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: `${statusColorMap[o.status] ?? '#6b7280'}20`,
                        color: statusColorMap[o.status] ?? '#6b7280',
                      }}
                    >
                      {statusLabel(o.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <Button size="sm" variant="ghost" isDisabled={page <= 1} onPress={() => fetchOrders(page - 1)} className="cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{page} / {totalPages}</span>
          <Button size="sm" variant="ghost" isDisabled={page >= totalPages} onPress={() => fetchOrders(page + 1)} className="cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
