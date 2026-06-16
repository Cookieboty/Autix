'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, SidebarTrigger, toast } from '@autix/shared-ui/ui';
import { Package, Crown } from 'lucide-react';
import {
  pointsApi,
  membershipApi,
  orderApi,
  type PointsPackage,
  type MembershipInfo,
} from '@/lib/api';

function pointsPerYuan(pkg: PointsPackage) {
  const price = Number(pkg.price);
  if (!Number.isFinite(price) || price <= 0) return '-';
  return (pkg.points / price).toFixed(1);
}

export default function PackagesPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [packages, setPackages] = useState<PointsPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    Promise.all([pointsApi.getPackages(), membershipApi.getMe()])
      .then(([pkgRes, meRes]) => {
        setPackages(pkgRes.data as any ?? []);
        const membership = (meRes.data as MembershipInfo).membership;
        setIsMember(
          !!membership &&
          membership.status === 'ACTIVE' &&
          new Date(membership.expiresAt) > new Date(),
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (id: string) => {
    setPurchasing(id);
    try {
      const res = await orderApi.createStripeCheckout({
        orderType: 'POINTS_PACKAGE',
        productId: id,
      });
      const checkout = res.data;
      if (checkout.checkoutUrl) {
        window.location.assign(checkout.checkoutUrl);
        return;
      }
      router.push('/membership/orders');
    } catch (e) {
      console.error(e);
      toast.error(tCommon('operationFailed'));
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 h-12 px-4 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <SidebarTrigger className="-ml-1" />
        <h1 className="ml-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
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
              onClick={() => router.push('/membership/upgrade')}
            >
              {t('goSubscribe')}
            </Button>
          </div>
        )}

        <div
          className="rounded-lg p-4 mb-5"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('packageTip')}
          </p>
        </div>

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
                <Package className="w-6 h-6 mb-3" style={{ color: 'var(--brand)' }} />
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                  {pkg.name}
                </p>
                <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                  {pkg.points} {t('pointsUnit')}
                </p>
                <div className="text-xs mb-3 space-y-1" style={{ color: 'var(--muted)' }}>
                  <p>{t('packageValidityDays', { days: pkg.validityDays ?? 180 })}</p>
                  <p>{t('packagePerYuan', { ratio: pointsPerYuan(pkg) })}</p>
                  <p>{t('packageNoMembershipBenefits')}</p>
                  {pkg.showCommercialLicense && <p>{t('packageCommercialLicenseNote')}</p>}
                </div>
                <p className="text-lg font-bold mb-4" style={{ color: 'var(--foreground)' }}>
                  ¥{pkg.price}
                </p>
                <Button
                  
                  size="sm"
                  className="w-full cursor-pointer"
                  disabled={purchasing === pkg.id || !isMember}
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
