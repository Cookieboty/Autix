'use client';

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { Button } from '@autix/shared-ui/ui';
import { Crown, Package } from 'lucide-react';
import {
  formatCurrency,
  membershipApi,
  orderApi,
  pointsApi,
  type MembershipInfo,
  type PointsPackage,
} from '@autix/shared-lib';

export function MembershipPackagesPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const navigate = useNavigate();

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
          new Date(membership.expiresAt) > new Date() &&
          Number(membership.level?.level ?? 0) > 0,
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (id: string) => {
    if (!isMember) {
      navigate('/membership/upgrade');
      return;
    }
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
      navigate('/membership/orders');
    } catch (e) {
      console.error(e);
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
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <h1 className="text-sm font-semibold text-foreground">{t('pointsPackages')}</h1>
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
              onClick={() => navigate('/membership/upgrade')}
            >
              {t('goSubscribe')}
            </Button>
          </div>
        )}

        <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>{t('packagesDesc')}</p>

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
                <Package className="w-6 h-6 mb-3" style={{ color: 'var(--accent)' }} />
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                  {pkg.name}
                </p>
                <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                  {pkg.points} {t('pointsUnit')}
                </p>
                <p className="text-lg font-bold mb-4" style={{ color: 'var(--foreground)' }}>
                  {formatCurrency(pkg.price)}
                </p>
                <Button
                  
                  size="sm"
                  className="w-full cursor-pointer"
                  disabled={purchasing === pkg.id}
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
