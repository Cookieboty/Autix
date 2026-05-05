'use client';

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Crown } from 'lucide-react';
import { membershipApi, type MembershipLevel, type MembershipPlan } from '@autix/shared-lib';

type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

const CYCLE_KEYS: Record<BillingCycle, string> = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
};

export function MembershipUpgradePage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const navigate = useNavigate();

  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [autoRenew, setAutoRenew] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    membershipApi.getLevels()
      .then((res) => {
        const data = res.data as any;
        setLevels(data.levels ?? data ?? []);
        setIsFirstTime(data.isFirstTime ?? false);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getPlan = (level: MembershipLevel): MembershipPlan | undefined =>
    level.plans.find((p) => p.billingCycle === cycle && p.autoRenew === autoRenew);

  const handlePurchase = async (planId: string) => {
    setPurchasing(planId);
    try {
      await membershipApi.purchase(planId);
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
          {t('upgradeMembership')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>{t('choosePlan')}</p>

        {/* Billing cycle tabs */}
        <div className="flex gap-2 mb-4">
          {(['MONTHLY', 'QUARTERLY', 'YEARLY'] as BillingCycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: cycle === c ? 'var(--accent)' : 'var(--surface)',
                color: cycle === c ? '#fff' : 'var(--foreground)',
                border: cycle === c ? 'none' : '1px solid var(--border)',
              }}
            >
              {t(CYCLE_KEYS[c])}
            </button>
          ))}
        </div>

        {/* Auto-renew toggle */}
        <div className="flex gap-2 mb-6">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              onClick={() => setAutoRenew(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: autoRenew === v ? 'var(--accent)' : 'var(--surface)',
                color: autoRenew === v ? '#fff' : 'var(--foreground)',
                border: autoRenew === v ? 'none' : '1px solid var(--border)',
              }}
            >
              {v ? t('autoRenewLabel') : t('oneTimeLabel')}
            </button>
          ))}
        </div>

        {/* Level cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {levels.map((level) => {
            const plan = getPlan(level);
            const isHighlight = level.level === 2;
            return (
              <div
                key={level.id}
                className="rounded-xl p-5 flex flex-col"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: isHighlight ? '2px solid var(--accent)' : '1px solid var(--border)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Crown
                    className="w-4 h-4"
                    style={{ color: isHighlight ? 'var(--accent)' : 'var(--muted)' }}
                  />
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {level.name}
                  </span>
                  {isHighlight && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                    >
                      推荐
                    </span>
                  )}
                </div>

                {plan ? (
                  <>
                    <div className="mb-3">
                      <span className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                        ¥{plan.price}
                      </span>
                      {plan.originalPrice !== plan.price && (
                        <span
                          className="text-xs ml-2 line-through"
                          style={{ color: 'var(--muted)' }}
                        >
                          ¥{plan.originalPrice}
                        </span>
                      )}
                      {isFirstTime && plan.firstTimePrice && (
                        <span
                          className="text-[10px] ml-2 px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: '#f59e0b20', color: '#f59e0b' }}
                        >
                          {t('firstTimeDiscount')} ¥{plan.firstTimePrice}
                        </span>
                      )}
                    </div>

                    <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                      {plan.points} {t('pointsUnit')}
                    </p>
                  </>
                ) : (
                  <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>-</p>
                )}

                {level.features && level.features.length > 0 && (
                  <ul className="space-y-1.5 mb-4 flex-1">
                    {level.features.map((f, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--foreground)' }}>
                        <span style={{ color: 'var(--success)' }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}

                <Button
                  
                  size="sm"
                  className="w-full mt-auto cursor-pointer"
                  disabled={!plan || purchasing === plan?.id}
                  onClick={() => plan && handlePurchase(plan.id)}
                >
                  {t('subscribe')}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
