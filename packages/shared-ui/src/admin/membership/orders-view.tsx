'use client';

import { useState } from 'react';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui';
import { formatCurrency } from '../../format';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useAdminMembershipOrdersQuery,
  useFulfillAdminMembershipOrderMutation,
  useRefundAdminMembershipOrderMutation,
  type Order,
} from '@autix/shared-store';

const PAGE_SIZE = 15;

const STATUS_OPTIONS = ['', 'PENDING', 'PAID', 'CANCELLED', 'REFUNDED'] as const;
const TYPE_OPTIONS = ['', 'MEMBERSHIP', 'POINTS_PACKAGE'] as const;

const statusStyleMap: Record<string, { backgroundColor: string; color: string }> = {
  PENDING: { backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' },
  PAID: { backgroundColor: 'var(--success-soft)', color: 'var(--success)' },
  CANCELLED: { backgroundColor: 'var(--muted-soft)', color: 'var(--muted)' },
  REFUNDED: { backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' },
};

type OrderWithAdminFields = Order & {
  businessType?: string | null;
  paidAmount?: string | null;
  productName?: string | null;
  refundedAt?: string | null;
};

export function MembershipOrdersView() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const [page, setPage] = useState(1);
  const [filterUserId, setFilterUserId] = useState('');
  const [submittedUserId, setSubmittedUserId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [fulfilling, setFulfilling] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);

  const fulfillOrderMutation = useFulfillAdminMembershipOrderMutation();
  const refundOrderMutation = useRefundAdminMembershipOrderMutation();
  const { data, isLoading: loading } = useAdminMembershipOrdersQuery({
    page,
    pageSize: PAGE_SIZE,
    userId: submittedUserId || undefined,
    status: filterStatus || undefined,
    orderType: filterType || undefined,
  });
  const orders = data?.items ?? [];
  const total = data?.total ?? 0;

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

  const businessTypeLabel = (s?: string | null) => {
    const map: Record<string, string> = {
      subscription_order: t('businessTypeSubscription'),
      points_order: t('businessTypePoints'),
      renewal_order: t('businessTypeRenewal'),
      upgrade_order: t('businessTypeUpgrade'),
      refund_order: t('businessTypeRefund'),
    };
    return s ? map[s] ?? s : '-';
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleFulfill = async (order: Order) => {
    setFulfilling(order.id);
    try {
      await fulfillOrderMutation.mutateAsync({
        id: order.id,
        confirm: 'CONFIRM_MANUAL_FULFILL',
        amount: order.amount,
        currency: order.currency ?? 'USD',
        remark: 'admin manual payment confirmation',
      });
    } finally {
      setFulfilling(null);
    }
  };

  const handleRefund = async (order: Order) => {
    const ok = window.confirm(t('refundConfirm'));
    if (!ok) return;
    const adminOrder = order as OrderWithAdminFields;
    setRefunding(order.id);
    try {
      await refundOrderMutation.mutateAsync({
        id: order.id,
        confirm: 'CONFIRM_REFUND',
        amount: adminOrder.paidAmount ?? order.amount,
        currency: order.currency ?? 'USD',
        reclaimPoints: true,
        reason: 'admin refund',
      });
    } finally {
      setRefunding(null);
    }
  };

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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSubmittedUserId(filterUserId);
                setPage(1);
              }
            }}
            className="w-[160px]"
          />
          <Select
            value={filterStatus || '_all_'}
            onValueChange={(val) => {
              setFilterStatus(val === '_all_' ? '' : val);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s || '_all_'} value={s || '_all_'}>
                  {s ? statusLabel(s) : tCommon('all')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterType || '_all_'}
            onValueChange={(val) => {
              setFilterType(val === '_all_' ? '' : val);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((s) => (
                <SelectItem key={s || '_all_'} value={s || '_all_'}>
                  {s ? typeLabel(s) : tCommon('all')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('businessType')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('amount')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('status')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('fulfillment')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('date')}</th>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('operations')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const order = o as OrderWithAdminFields;
                return (
                <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{o.orderNo}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted)' }}>{o.userId}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{order.productName}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{businessTypeLabel(order.businessType)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{formatCurrency(o.amount, o.currency)}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={statusStyleMap[o.status] ?? { backgroundColor: 'var(--muted-soft)', color: 'var(--muted)' }}
                    >
                      {statusLabel(o.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: o.fulfilledAt ? 'var(--success)' : 'var(--muted)' }}>
                    {o.fulfilledAt ? t('fulfilled') : t('unfulfilled')}
                    {order.refundedAt ? <span className="ml-2" style={{ color: 'var(--danger)' }}>{t('refunded')}</span> : null}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {o.status === 'PENDING' && !o.fulfilledAt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="cursor-pointer"
                        disabled={fulfilling === o.id}
                        onClick={() => handleFulfill(o)}
                      >
                        {t('confirmPayment')}
                      </Button>
                    )}
                    {o.status === 'PAID' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-2 cursor-pointer"
                        disabled={refunding === o.id}
                        onClick={() => handleRefund(o)}
                      >
                        {t('refund')}
                      </Button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} className="cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{page} / {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
