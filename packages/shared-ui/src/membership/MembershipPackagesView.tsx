'use client';

import { Crown, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMembershipPackagesController, type PointsPackage } from '@autix/shared-store';
import { formatCurrency } from '../format';
import { Button, SidebarTrigger, toast } from '../ui';

type MembershipPackagesViewProps = {
  showSidebarTrigger?: boolean;
  activeColorVar?: '--brand' | '--accent';
  descriptionKey?: 'packageTip' | 'packagesDesc';
  descriptionVariant?: 'card' | 'plain';
  showPackageDetails?: boolean;
  requirePaidLevel?: boolean;
  disablePurchaseForNonMember?: boolean;
  showOperationErrorToast?: boolean;
  onNavigateUpgrade?: () => void;
  onCheckoutFallback?: () => void;
};

function pointsPerUsd(pkg: PointsPackage) {
  const price = Number(pkg.price);
  if (!Number.isFinite(price) || price <= 0) return '-';
  return (pkg.points / price).toFixed(1);
}

export function MembershipPackagesView({
  showSidebarTrigger = false,
  activeColorVar = '--brand',
  descriptionKey = 'packageTip',
  descriptionVariant = 'card',
  showPackageDetails = true,
  requirePaidLevel = false,
  disablePurchaseForNonMember = true,
  showOperationErrorToast = true,
  onNavigateUpgrade,
  onCheckoutFallback,
}: MembershipPackagesViewProps) {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const { packages, isLoading, isMember, purchasingId, purchasePackage } =
    useMembershipPackagesController({
      requirePaidLevel,
      onCheckoutFallback,
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

  const iconColor = `var(${activeColorVar})`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 h-12 px-4 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {showSidebarTrigger && <SidebarTrigger className="-ml-1" />}
        <h1
          className={`${showSidebarTrigger ? 'ml-1 ' : ''}text-sm font-semibold`}
          style={{ color: 'var(--foreground)' }}
        >
          {t('pointsPackages')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {!isMember && (
          <div
            className="rounded-lg p-5 mb-5 flex flex-col items-center text-center gap-3"
            style={{ backgroundColor: 'var(--warning-soft)', border: '1px solid var(--warning-border)' }}
          >
            <Crown className="w-8 h-8" style={{ color: 'var(--warning)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('membershipRequiredForPackages')}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {t('membershipRequiredForPackagesDesc')}
            </p>
            <Button
              size="sm"
              className="cursor-pointer"
              onClick={() => onNavigateUpgrade?.()}
            >
              {t('goSubscribe')}
            </Button>
          </div>
        )}

        {descriptionVariant === 'card' ? (
          <div
            className="rounded-lg p-4 mb-5"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {t(descriptionKey)}
            </p>
          </div>
        ) : (
          <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>{t(descriptionKey)}</p>
        )}

        {packages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="rounded-xl p-5 flex flex-col items-center text-center"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <Package className="w-6 h-6 mb-3" style={{ color: iconColor }} />
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                  {pkg.name}
                </p>
                <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                  {pkg.points} {t('pointsUnit')}
                </p>
                {showPackageDetails && (
                  <div className="text-xs mb-3 space-y-1" style={{ color: 'var(--muted)' }}>
                    <p>{t('packageValidityDays', { days: pkg.validityDays ?? 180 })}</p>
                    <p>{t('packagePerYuan', { ratio: pointsPerUsd(pkg) })}</p>
                    <p>{t('packageNoMembershipBenefits')}</p>
                    {pkg.showCommercialLicense && <p>{t('packageCommercialLicenseNote')}</p>}
                  </div>
                )}
                <p className="text-lg font-bold mb-4" style={{ color: 'var(--foreground)' }}>
                  {formatCurrency(pkg.price)}
                </p>
                <Button
                  size="sm"
                  className="w-full cursor-pointer"
                  disabled={purchasingId === pkg.id || (!isMember && disablePurchaseForNonMember)}
                  onClick={() => handlePurchase(pkg.id)}
                >
                  {isMember ? t('buyNow') : t('goSubscribe')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
