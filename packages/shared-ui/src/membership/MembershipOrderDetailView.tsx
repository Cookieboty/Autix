'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useCancelOrderMutation,
  useCreateOrderCheckoutMutation,
  useMembershipOrderQuery,
  useSyncStripeCheckoutMutation,
  type Order,
} from '@autix/shared-store';
import { formatCurrency } from '../format';
import { Badge, Button, SidebarTrigger, toast } from '../ui';

type MembershipOrderDetailViewProps = {
  orderId?: string;
  checkoutSessionId?: string;
  checkoutStatus?: 'success' | 'cancelled' | string | null;
  showSidebarTrigger?: boolean;
  onBack?: () => void;
};

function openCheckoutUrl(url: string) {
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function statusVariant(status?: Order['status']) {
  if (status === 'PAID') return 'default';
  if (status === 'PENDING') return 'secondary';
  if (status === 'CANCELLED' || status === 'REFUNDED') return 'outline';
  return 'secondary';
}

function statusIcon(status?: Order['status']) {
  if (status === 'PAID') return CheckCircle2;
  if (status === 'CANCELLED' || status === 'REFUNDED') return XCircle;
  return Clock3;
}

const STATUS_I18N: Record<Order['status'], string> = {
  PENDING: 'orderStatusPending',
  PAID: 'orderStatusPaid',
  CANCELLED: 'orderStatusCancelled',
  REFUNDED: 'orderStatusRefunded',
};

function detailRows(order: Order, t: (key: string) => string) {
  return [
    { label: t('orderNo'), value: order.orderNo },
    { label: t('orderProduct'), value: order.productName },
    {
      label: t('orderType'),
      value: t(order.orderType === 'POINTS_PACKAGE' ? 'orderTypePackage' : 'orderTypeMembership'),
    },
    { label: t('orderAmount'), value: formatCurrency(order.amount, order.currency) },
    { label: t('orderTime'), value: new Date(order.createdAt).toLocaleString() },
    {
      label: t('paidAt'),
      value: order.paidAt ? new Date(order.paidAt).toLocaleString() : '-',
    },
  ];
}

export function MembershipOrderDetailView({
  orderId,
  checkoutSessionId,
  checkoutStatus,
  showSidebarTrigger = false,
  onBack,
}: MembershipOrderDetailViewProps) {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const orderQuery = useMembershipOrderQuery(orderId);
  const syncMutation = useSyncStripeCheckoutMutation();
  const checkoutMutation = useCreateOrderCheckoutMutation();
  const cancelOrderMutation = useCancelOrderMutation();
  const [autoSyncStarted, setAutoSyncStarted] = useState(false);
  const order = syncMutation.data?.order ?? orderQuery.data ?? null;
  const isCheckoutReturn = Boolean(checkoutSessionId);
  const isSyncing = syncMutation.isPending;

  useEffect(() => {
    if (!checkoutSessionId) return;
    if (autoSyncStarted) return;
    setAutoSyncStarted(true);
    syncMutation.mutate(checkoutSessionId);
  }, [autoSyncStarted, checkoutSessionId, syncMutation]);

  const handlePay = async () => {
    if (!order?.id) return;
    try {
      const checkout = await checkoutMutation.mutateAsync(order.id);
      if (checkout.checkoutUrl) openCheckoutUrl(checkout.checkoutUrl);
    } catch (e) {
      console.error(e);
      toast.error(tCommon('operationFailed'));
    }
  };

  const handleCancel = async () => {
    if (!order?.id) return;
    try {
      await cancelOrderMutation.mutateAsync(order.id);
      await orderQuery.refetch();
    } catch (e) {
      console.error(e);
      toast.error(tCommon('operationFailed'));
    }
  };

  const handleRefresh = async () => {
    try {
      if (checkoutSessionId) {
        await syncMutation.mutateAsync(checkoutSessionId);
        return;
      }
      await orderQuery.refetch();
    } catch (e) {
      console.error(e);
      toast.error(tCommon('operationFailed'));
    }
  };

  const StatusIcon = statusIcon(order?.status);
  const headingKey = isCheckoutReturn
    ? checkoutStatus === 'cancelled' ? 'checkoutCancelledTitle' : 'checkoutResultTitle'
    : 'orderDetail';
  const descriptionKey =
    order?.status === 'PAID'
      ? 'checkoutPaidDesc'
      : isSyncing
        ? 'checkoutSyncingDesc'
        : 'checkoutPendingDesc';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className="flex h-12 shrink-0 items-center gap-2 px-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {showSidebarTrigger && <SidebarTrigger className="-ml-1" />}
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={onBack}
            aria-label={tCommon('back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {t(headingKey)}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <section
            className="rounded-lg p-5"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'var(--surface-secondary)' }}
                >
                  <StatusIcon className="h-5 w-5" style={{ color: 'var(--foreground)' }} />
                </div>
                <div>
                  <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                    {order?.productName ?? t('orderDetail')}
                  </p>
                  <p className="mt-1 text-xs leading-5" style={{ color: 'var(--muted)' }}>
                    {t(descriptionKey)}
                  </p>
                </div>
              </div>
              <Badge variant={statusVariant(order?.status)}>
                {order ? t(STATUS_I18N[order.status]) : tCommon('loading')}
              </Badge>
            </div>
          </section>

          <section
            className="rounded-lg overflow-hidden"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {orderQuery.isLoading && !order ? (
              <div className="p-5 text-sm" style={{ color: 'var(--muted)' }}>
                {tCommon('loading')}
              </div>
            ) : !order ? (
              <div className="p-5 text-sm" style={{ color: 'var(--muted)' }}>
                {t('orderNotFound')}
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {detailRows(order, t).map((row) => (
                  <div key={row.label} className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-[160px_1fr]">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{row.label}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={isSyncing || orderQuery.isFetching}
              onClick={handleRefresh}
            >
              <RefreshCw className="h-4 w-4" />
              {tCommon('refresh')}
            </Button>
            {order?.status === 'PENDING' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={cancelOrderMutation.isPending}
                  onClick={handleCancel}
                >
                  {t('cancelOrder')}
                </Button>
                <Button
                  type="button"
                  className="cursor-pointer"
                  disabled={checkoutMutation.isPending}
                  onClick={handlePay}
                >
                  <CreditCard className="h-4 w-4" />
                  {t('payNow')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
