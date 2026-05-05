'use client';

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { pointsApi, type PointsPackage } from '@autix/shared-lib';

export function MembershipPackagesPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const navigate = useNavigate();

  const [packages, setPackages] = useState<PointsPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    pointsApi.getPackages()
      .then((res) => setPackages(res.data as any ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (id: string) => {
    setPurchasing(id);
    try {
      await pointsApi.purchasePackage(id);
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
      <div
        className="flex-shrink-0 h-14 px-6 flex items-center"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h1 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('pointsPackages')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
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
                  ¥{pkg.price}
                </p>
                <Button
                  
                  size="sm"
                  className="w-full cursor-pointer"
                  disabled={purchasing === pkg.id}
                  onClick={() => handlePurchase(pkg.id)}
                >
                  {t('buyNow')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
