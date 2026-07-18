'use client';

import { Crown, Gift, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMembershipPackagesController, type PointsPackage } from '@autix/shared-store';
import { formatCurrency } from '../format';
import { GROWTH_CTA_FOCUS } from '../growth/dialog-styles';
import { SidebarTrigger, toast } from '../ui';

type MembershipPackagesViewProps = {
  showSidebarTrigger?: boolean;
  /** @deprecated 卡片已统一走 /pricing 的 growth-accent 色调，该 prop 不再影响样式 */
  activeColorVar?: '--brand' | '--accent';
  descriptionKey?: 'packageTip' | 'packagesDesc';
  descriptionVariant?: 'card' | 'plain';
  showPackageDetails?: boolean;
  requirePaidLevel?: boolean;
  disablePurchaseForNonMember?: boolean;
  showOperationErrorToast?: boolean;
  onNavigateUpgrade?: () => void;
  onNavigateOrder?: (orderId: string) => void;
  onCheckoutFallback?: () => void;
};

function pointsPerUsd(pkg: PointsPackage) {
  const price = Number(pkg.price);
  if (!Number.isFinite(price) || price <= 0) return '-';
  return (pkg.points / price).toFixed(1);
}

export function MembershipPackagesView({
  showSidebarTrigger = false,
  descriptionKey = 'packageTip',
  descriptionVariant = 'card',
  showPackageDetails = true,
  requirePaidLevel = false,
  disablePurchaseForNonMember = true,
  showOperationErrorToast = true,
  onNavigateUpgrade,
  onNavigateOrder,
  onCheckoutFallback,
}: MembershipPackagesViewProps) {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const { packages, isLoading, isMember, purchasingId, purchasePackage } =
    useMembershipPackagesController({
      requirePaidLevel,
      onCheckoutFallback,
      navigateToOrder: onNavigateOrder,
    });

  const handlePurchase = async (id: string) => {
    if (!isMember) {
      onNavigateUpgrade?.();
      return;
    }

    try {
      await purchasePackage(id);
    } catch (e) {
      console.error(e);
      if (showOperationErrorToast) toast.error(tCommon('operationFailed'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        {showSidebarTrigger && <SidebarTrigger className="-ml-1" />}
        <h1
          className={`${showSidebarTrigger ? 'ml-1 ' : ''}text-sm font-black uppercase tracking-tight text-foreground`}
        >
          {t('pointsPackages')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {!isMember && (
          <div
            className="mb-5 flex flex-col items-center gap-3 rounded-2xl border p-5 text-center"
            style={{
              borderColor: 'color-mix(in srgb, var(--growth-accent) 42%, transparent)',
              backgroundImage:
                'linear-gradient(157deg, color-mix(in srgb, var(--growth-accent) 17%, transparent) 0%, color-mix(in srgb, var(--growth-accent) 5%, transparent) 42%, rgba(255,255,255,0.02) 100%)',
            }}
          >
            <Crown className="size-8 text-growth-accent" />
            <p className="text-sm font-bold text-foreground">
              {t('membershipRequiredForPackages')}
            </p>
            <p className="text-xs leading-5 text-foreground/55">
              {t('membershipRequiredForPackagesDesc')}
            </p>
            <button
              type="button"
              className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-growth-accent px-5 text-sm font-bold text-background transition hover:bg-growth-accent-hover ${GROWTH_CTA_FOCUS}`}
              onClick={() => onNavigateUpgrade?.()}
            >
              {t('goSubscribe')}
            </button>
          </div>
        )}

        {descriptionVariant === 'card' ? (
          <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-xs leading-5 text-foreground/60">{t(descriptionKey)}</p>
          </div>
        ) : (
          <p className="mb-5 text-xs leading-5 text-foreground/60">{t(descriptionKey)}</p>
        )}

        {packages.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-foreground/50">{tCommon('noData')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => {
              const disabled =
                purchasingId === pkg.id || (!isMember && disablePurchaseForNonMember);
              return (
                <div
                  key={pkg.id}
                  className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition duration-300 hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="grid size-9 place-items-center rounded-lg border border-white/8 bg-white/5 text-growth-accent">
                      <Gift className="size-5" />
                    </span>
                    {showPackageDetails && (
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-foreground/45">
                        {t('packageValidityDays', { days: pkg.validityDays ?? 180 })}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-foreground">{pkg.name}</h3>

                  <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-foreground">{pkg.points}</span>
                      <span className="text-xs font-medium text-foreground/45">
                        {t('pointsUnit')}
                      </span>
                    </div>
                    <div className="mt-1 text-lg font-bold text-foreground/85">
                      {formatCurrency(pkg.price)}
                    </div>
                  </div>

                  {showPackageDetails && (
                    <>
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-foreground/45">
                        <Zap className="size-3.5 text-growth-accent/80" />
                        {t('packagePerYuan', { ratio: pointsPerUsd(pkg) })}
                      </div>
                      <div className="mt-2 space-y-1 text-xs leading-5 text-foreground/45">
                        <p>{t('packageNoMembershipBenefits')}</p>
                        {pkg.showCommercialLicense && <p>{t('packageCommercialLicenseNote')}</p>}
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    className={`mt-5 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-growth-accent text-sm font-bold text-background transition hover:bg-growth-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${GROWTH_CTA_FOCUS}`}
                    disabled={disabled}
                    onClick={() => handlePurchase(pkg.id)}
                  >
                    {isMember ? t('buyNow') : t('goSubscribe')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
