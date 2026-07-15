'use client';

import { CreditCard, Download, ExternalLink, FileText, Loader2, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  useAuthStore,
  useCreateBillingPortalMutation,
  useMembershipOrdersQuery,
  useMyMembershipQuery,
} from '@autix/shared-store';
import { Link } from '../../navigation';
import { toast } from '../../ui';
import { Skeleton } from '../../ui/skeleton';

function isActive(
  m: NonNullable<ReturnType<typeof useMyMembershipQuery>['data']>['membership'] | null | undefined,
) {
  return Boolean(m && m.status === 'ACTIVE' && new Date(m.expiresAt).getTime() > Date.now());
}

export function AccountSubscriptionPanel() {
  const t = useTranslations('publicGrowth.accountSettings');
  const locale = useLocale();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const membershipQuery = useMyMembershipQuery(isAuthenticated);
  const ordersQuery = useMembershipOrdersQuery({ pageSize: 50 });
  const portal = useCreateBillingPortalMutation();

  const loading = membershipQuery.isLoading || ordersQuery.isLoading;

  const membership = membershipQuery.data?.membership ?? null;
  const active = isActive(membership);

  const invoices = (ordersQuery.data?.items ?? []).filter((o) => o.status === 'PAID');

  const dateFmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtDate = (iso?: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');
  const fmtMoney = (amount: string, currency: string) => {
    const n = Number(amount);
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'USD' }).format(n);
    } catch {
      return `${currency} ${n.toFixed(2)}`;
    }
  };

  const openPortal = async () => {
    try {
      const { url } = await portal.mutateAsync();
      if (url && typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error(t('subscription.portalError'));
    }
  };

  const statusLabel = !membership
    ? null
    : membership.status === 'ACTIVE'
      ? t('subscription.statusActive')
      : membership.status === 'CANCELLED'
        ? t('subscription.statusCancelled')
        : t('subscription.statusExpired');

  if (loading) return <SubscriptionSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">{t('subscription.title')}</h1>
        <p className="mt-1 text-sm text-foreground/55">{t('subscription.subtitle')}</p>
      </div>

      {/* 当前套餐 */}
      <div className="rounded-2xl bg-[rgb(24,25,28)] p-5">
        <p className="mb-4 text-sm font-medium text-foreground/70">{t('subscription.currentPlan')}</p>

        {active && membership ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="text-lg font-black text-foreground">{membership.level?.name}</span>
                <span className="rounded-full bg-growth-accent/15 px-2 py-0.5 text-xs font-bold text-growth-accent">
                  {statusLabel}
                </span>
              </div>
              <p className="mt-1 text-sm text-foreground/55">
                {membership.cancelAtPeriodEnd
                  ? t('subscription.cancelsOn', { date: fmtDate(membership.expiresAt) })
                  : membership.autoRenew
                    ? t('subscription.renewsOn', { date: fmtDate(membership.expiresAt) })
                    : t('subscription.expiresOn', { date: fmtDate(membership.expiresAt) })}
                {' · '}
                {membership.autoRenew ? t('subscription.autoRenewOn') : t('subscription.autoRenewOff')}
              </p>
            </div>
            <button
              type="button"
              onClick={openPortal}
              disabled={portal.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 disabled:opacity-60"
            >
              {portal.isPending ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
              {t('subscription.manage')}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-lg font-black text-foreground">{t('subscription.freePlan')}</span>
              <p className="mt-1 text-sm text-foreground/55">{t('subscription.freePlanBody')}</p>
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-growth-accent px-4 py-2 text-sm font-bold text-background transition hover:bg-growth-accent-hover"
            >
              <Sparkles className="size-4" />
              {t('subscription.upgrade')}
            </Link>
          </div>
        )}
      </div>

      {/* 发票 */}
      <div className="rounded-2xl bg-[rgb(24,25,28)] p-5">
        <p className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground/70">
          <FileText className="size-4" />
          {t('subscription.invoices')}
        </p>

        {invoices.length === 0 ? (
          <p className="py-8 text-center text-sm text-foreground/40">{t('subscription.invoiceEmpty')}</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {o.productName || o.orderNo}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/50">
                    {fmtDate(o.paidAt ?? o.createdAt)} · {t('subscription.statusPaid')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {fmtMoney(o.amount, o.currency)}
                  </span>
                  <button
                    type="button"
                    onClick={openPortal}
                    disabled={portal.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-foreground/80 transition hover:bg-white/10 hover:text-foreground disabled:opacity-60"
                  >
                    <Download className="size-3.5" />
                    {t('subscription.download')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 支付账单信息 → Stripe 门户 */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[rgb(24,25,28)] p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 text-foreground/50">
            <CreditCard className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{t('subscription.billingInfo')}</p>
            <p className="mt-0.5 text-xs leading-5 text-foreground/55">{t('subscription.billingInfoBody')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openPortal}
          disabled={portal.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 disabled:opacity-60"
        >
          {portal.isPending ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
          {t('subscription.manage')}
        </button>
      </div>
    </div>
  );
}

function SubscriptionSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-60" />
      </div>
      <Skeleton className="h-28 rounded-2xl" />
      <div className="space-y-3 rounded-2xl bg-[rgb(24,25,28)] p-5">
        <Skeleton className="h-4 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-20 rounded-2xl" />
    </div>
  );
}
