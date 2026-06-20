'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getNavigation } from '@autix/platform';
import {
  useCancelOrderMutation,
  useCreateOrderCheckoutMutation,
  useMembershipOrdersQuery,
  type Order,
} from '@autix/shared-store';
import { formatCurrency } from '../format';
import { Button, SidebarTrigger, toast } from '../ui';

type StatusFilter = '' | 'PENDING' | 'PAID' | 'CANCELLED';

type MembershipOrdersViewProps = {
  showSidebarTrigger?: boolean;
  showPayAction?: boolean;
  activeColorVar?: '--brand' | '--accent';
};

const PAGE_SIZE = 20;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: '', label: 'filterAll' },
  { key: 'PENDING', label: 'orderStatusPending' },
  { key: 'PAID', label: 'orderStatusPaid' },
  { key: 'CANCELLED', label: 'orderStatusCancelled' },
];

const STATUS_STYLE: Record<string, { backgroundColor: string; color: string }> = {
  PENDING: { backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' },
  PAID: { backgroundColor: 'var(--success-soft)', color: 'var(--success)' },
  CANCELLED: { backgroundColor: 'var(--muted-soft)', color: 'var(--muted)' },
  REFUNDED: { backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' },
};

const STATUS_STYLE_FALLBACK: Record<string, { backgroundColor: string; color: string }> = {
  PENDING: { backgroundColor: 'transparent', color: '#f59e0b' },
  PAID: { backgroundColor: 'transparent', color: '#22c55e' },
  CANCELLED: { backgroundColor: 'transparent', color: '#6b7280' },
  REFUNDED: { backgroundColor: 'transparent', color: '#8b5cf6' },
};

const STATUS_I18N: Record<string, string> = {
  PENDING: 'orderStatusPending',
  PAID: 'orderStatusPaid',
  CANCELLED: 'orderStatusCancelled',
  REFUNDED: 'orderStatusRefunded',
};

function statusStyle(order: Order, activeColorVar: MembershipOrdersViewProps['activeColorVar']) {
  if (activeColorVar === '--accent') {
    return STATUS_STYLE_FALLBACK[order.status] ?? {
      backgroundColor: 'transparent',
      color: 'var(--muted)',
    };
  }

  return STATUS_STYLE[order.status] ?? {
    backgroundColor: 'transparent',
    color: 'var(--muted)',
  };
}

export function MembershipOrdersView({
  showSidebarTrigger = false,
  showPayAction = true,
  activeColorVar = '--brand',
}: MembershipOrdersViewProps) {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data, isLoading } = useMembershipOrdersQuery({
    page,
    pageSize: PAGE_SIZE,
    status: status || undefined,
  });
  const orders = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const cancelOrderMutation = useCancelOrderMutation();
  const checkoutMutation = useCreateOrderCheckoutMutation();

  const handleCancel = async (id: string) => {
    setActionLoading(id);
    try {
      await cancelOrderMutation.mutateAsync(id);
    } catch (e) {
      console.error(e);
      if (showPayAction) toast.error(tCommon('operationFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePay = async (id: string) => {
    setActionLoading(id);
    try {
      const checkout = await checkoutMutation.mutateAsync(id);
      if (checkout.checkoutUrl) {
        const navigation = getNavigation();
        if (navigation.assign) navigation.assign(checkout.checkoutUrl);
        else navigation.push(checkout.checkoutUrl);
      }
    } catch (e) {
      console.error(e);
      toast.error(tCommon('operationFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  const activeBackground = `var(${activeColorVar})`;
  const activeForeground =
    activeColorVar === '--brand' ? 'var(--brand-foreground)' : '#fff';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 h-12 px-4 flex items-center gap-2 border-b border-border"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {showSidebarTrigger && <SidebarTrigger className="-ml-1" />}
        <h1
          className={`${showSidebarTrigger ? 'ml-1 ' : ''}text-sm font-semibold text-foreground`}
          style={{ color: 'var(--foreground)' }}
        >
          {t('orderHistory')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex gap-2 mb-4">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setStatus(key);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: status === key ? activeBackground : 'var(--surface)',
                color: status === key ? activeForeground : 'var(--foreground)',
                border: status === key ? 'none' : '1px solid var(--border)',
              }}
            >
              {t(label)}
            </button>
          ))}
        </div>

        {isLoading ? (
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
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('orderProduct')}</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('orderAmount')}</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('orderStatus')}</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('orderTime')}</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('operations')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--foreground)' }}>
                      {order.orderNo}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--foreground)' }}>
                      {order.productName}
                    </td>
                    <td className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--foreground)' }}>
                      {formatCurrency(order.amount, order.currency)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                        style={statusStyle(order, activeColorVar)}
                      >
                        {t(STATUS_I18N[order.status] ?? 'orderStatusPending')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="text-right px-4 py-2.5">
                      {order.status === 'PENDING' && (
                        <div className="flex items-center justify-end gap-1.5">
                          {showPayAction && (
                            <Button
                              size="sm"
                              className="cursor-pointer"
                              disabled={actionLoading === order.id}
                              onClick={() => handlePay(order.id)}
                            >
                              {t('payNow')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="cursor-pointer"
                            disabled={actionLoading === order.id}
                            onClick={() => handleCancel(order.id)}
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
