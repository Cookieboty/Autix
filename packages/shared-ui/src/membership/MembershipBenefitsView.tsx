'use client';

import { useState } from 'react';
import {
  Check,
  CircleSlash,
  Crown,
  Gauge,
  History,
  Package,
  ShieldCheck,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useMembershipLevelsQuery,
  useMyMembershipQuery,
  type MembershipLevel,
} from '@autix/shared-store';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  SidebarTrigger,
} from '../ui';
import { formatCurrency } from '../format';
import { MembershipPackagesView } from './MembershipPackagesView';
import { MembershipUpgradeView } from './MembershipUpgradeView';

type MembershipBenefitsViewProps = {
  showSidebarTrigger?: boolean;
  activeColorVar?: '--brand' | '--accent';
  onNavigateOrder?: (orderId: string) => void;
  onCheckoutFallback?: () => void;
};

type NormalizedFeatures = {
  removeWatermark: boolean;
  commercialLicense: boolean;
  teamSpace: boolean;
  seedance: {
    enabled: boolean;
    maxResolution: string;
    maxDurationSeconds: number;
    concurrency: number;
  };
  queuePriority: string;
  batchGeneration: string;
  historyRetentionDays: number | null;
  invoice: string;
};

type BenefitRow = {
  key: string;
  label: string;
  icon: typeof Crown;
  value: (level: MembershipLevel) => string | boolean;
};

function readNumber(value: unknown, fallback: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeFeatures(features: MembershipLevel['features']): NormalizedFeatures {
  if (!features || Array.isArray(features) || typeof features !== 'object') {
    return {
      removeWatermark: false,
      commercialLicense: false,
      teamSpace: false,
      seedance: {
        enabled: false,
        maxResolution: '720p',
        maxDurationSeconds: 5,
        concurrency: 1,
      },
      queuePriority: '',
      batchGeneration: '',
      historyRetentionDays: null,
      invoice: '',
    };
  }

  const source = features as Record<string, unknown>;
  const seedance = source.seedance && typeof source.seedance === 'object'
    ? source.seedance as Record<string, unknown>
    : {};

  return {
    removeWatermark: Boolean(source.removeWatermark),
    commercialLicense: Boolean(source.commercialLicense),
    teamSpace: Boolean(source.teamSpace),
    seedance: {
      enabled: Boolean(seedance.enabled),
      maxResolution: typeof seedance.maxResolution === 'string' ? seedance.maxResolution : '720p',
      maxDurationSeconds: readNumber(seedance.maxDurationSeconds, 5) ?? 5,
      concurrency: readNumber(seedance.concurrency, 1) ?? 1,
    },
    queuePriority: typeof source.queuePriority === 'string' ? source.queuePriority : '',
    batchGeneration: typeof source.batchGeneration === 'string' ? source.batchGeneration : '',
    historyRetentionDays: readNumber(source.historyRetentionDays, null),
    invoice: typeof source.invoice === 'string' ? source.invoice : '',
  };
}

function getPrimaryMonthlyPlan(level: MembershipLevel) {
  return level.plans.find((plan) => plan.billingCycle === 'MONTHLY' && plan.autoRenew)
    ?? level.plans.find((plan) => plan.billingCycle === 'MONTHLY')
    ?? level.plans[0];
}

function formatBoolean(value: boolean) {
  return value;
}

function BenefitValue({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="h-4 w-4" style={{ color: 'var(--success)' }} />
    ) : (
      <X className="h-4 w-4" style={{ color: 'var(--muted)' }} />
    );
  }

  return (
    <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
      {value}
    </span>
  );
}

export function MembershipBenefitsView({
  showSidebarTrigger = false,
  activeColorVar = '--brand',
  onNavigateOrder,
  onCheckoutFallback,
}: MembershipBenefitsViewProps) {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [packagesOpen, setPackagesOpen] = useState(false);
  const { data, isLoading: levelsLoading } = useMembershipLevelsQuery();
  const { data: membershipInfo, isLoading: membershipLoading } = useMyMembershipQuery();
  const levels = [...(data?.levels ?? [])].sort(
    (a, b) => (a.sort ?? a.level) - (b.sort ?? b.level),
  );
  const activeColor = `var(${activeColorVar})`;
  const membership = membershipInfo?.membership ?? null;
  const pointsBalance = membershipInfo?.pointsBalance ?? 0;
  const isActiveMembership = Boolean(
    membership &&
    membership.status === 'ACTIVE' &&
    new Date(membership.expiresAt) > new Date(),
  );

  const rows: BenefitRow[] = [
    {
      key: 'monthly-points',
      label: t('benefitsMonthlyPoints'),
      icon: Sparkles,
      value: (level) => t('pointsCount', { count: level.pointsPerMonth }),
    },
    {
      key: 'watermark',
      label: t('benefitRemoveWatermark'),
      icon: ShieldCheck,
      value: (level) => formatBoolean(normalizeFeatures(level.features).removeWatermark),
    },
    {
      key: 'commercial-license',
      label: t('benefitCommercialLicense'),
      icon: ShieldCheck,
      value: (level) => formatBoolean(normalizeFeatures(level.features).commercialLicense),
    },
    {
      key: 'video',
      label: t('benefitVideoGeneration'),
      icon: Video,
      value: (level) => {
        const videoFeature = normalizeFeatures(level.features).seedance;
        return videoFeature.enabled
          ? t('benefitsVideoLimit', {
            resolution: videoFeature.maxResolution,
            duration: videoFeature.maxDurationSeconds,
            concurrency: videoFeature.concurrency,
          })
          : false;
      },
    },
    {
      key: 'history',
      label: t('benefitHistoryRetentionDays'),
      icon: History,
      value: (level) => {
        const days = normalizeFeatures(level.features).historyRetentionDays;
        return days ? t('daysCount', { count: days }) : false;
      },
    },
    {
      key: 'queue',
      label: t('benefitQueuePriority'),
      icon: Gauge,
      value: (level) => normalizeFeatures(level.features).queuePriority || false,
    },
    {
      key: 'batch',
      label: t('benefitBatchGeneration'),
      icon: Sparkles,
      value: (level) => normalizeFeatures(level.features).batchGeneration || false,
    },
    {
      key: 'team',
      label: t('benefitTeamSpace'),
      icon: Crown,
      value: (level) => formatBoolean(normalizeFeatures(level.features).teamSpace),
    },
    {
      key: 'invoice',
      label: t('benefitInvoice'),
      icon: ShieldCheck,
      value: (level) => normalizeFeatures(level.features).invoice || false,
    },
  ];

  if (levelsLoading || membershipLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className="flex h-12 shrink-0 items-center gap-2 px-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {showSidebarTrigger && <SidebarTrigger className="-ml-1" />}
        <h1
          className={`${showSidebarTrigger ? 'ml-1 ' : ''}text-sm font-semibold`}
          style={{ color: 'var(--foreground)' }}
        >
          {t('benefitsOverview')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mb-5">
          <div>
            <p className="text-xs font-medium uppercase" style={{ color: activeColor }}>
              {t('benefitsCompare')}
            </p>
            <h2 className="mt-1 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('benefitsTitle')}
            </h2>
            <p className="mt-2 max-w-2xl text-xs leading-5" style={{ color: 'var(--muted)' }}>
              {t('benefitsDesc')}
            </p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section
            className="rounded-lg p-4"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4" style={{ color: activeColor }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {t('membershipInfo')}
                </h3>
              </div>
              <Button size="sm" className="h-8 cursor-pointer" onClick={() => setUpgradeOpen(true)}>
                {t('upgrade')}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="mb-1 text-xs" style={{ color: 'var(--muted)' }}>
                  {t('currentLevel')}
                </p>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {isActiveMembership ? membership?.level?.name : t('noMembership')}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs" style={{ color: 'var(--muted)' }}>
                  {t('expiresAt')}
                </p>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {isActiveMembership && membership?.expiresAt
                    ? new Date(membership.expiresAt).toLocaleDateString()
                    : '-'}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs" style={{ color: 'var(--muted)' }}>
                  {t('autoRenew')}
                </p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: membership?.autoRenew ? 'var(--success)' : 'var(--muted)' }}
                >
                  {isActiveMembership
                    ? membership?.autoRenew ? t('autoRenewOn') : t('autoRenewOff')
                    : '-'}
                </p>
              </div>
            </div>
          </section>

          <section
            className="rounded-lg p-4"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" style={{ color: activeColor }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {t('pointsBalance')}
                </h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 cursor-pointer"
                onClick={() => setPackagesOpen(true)}
              >
                {t('pointsPackages')}
              </Button>
            </div>
            <div>
              <p className="mb-1 text-xs" style={{ color: 'var(--muted)' }}>
                {t('balanceAvailable')}
              </p>
              <p className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {t('pointsCount', { count: pointsBalance })}
              </p>
            </div>
          </section>
        </div>

        {levels.length === 0 ? (
          <div
            className="flex min-h-60 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="text-center">
              <CircleSlash className="mx-auto mb-2 h-5 w-5" style={{ color: 'var(--muted)' }} />
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface)' }}>
                    <th className="w-48 px-4 py-4 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>
                      {t('benefitsTableFeature')}
                    </th>
                    {levels.map((level) => {
                      const plan = getPrimaryMonthlyPlan(level);
                      return (
                        <th key={level.id} className="px-4 py-4 text-left align-top">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4" style={{ color: activeColor }} />
                            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                              {level.name}
                            </span>
                          </div>
                          <div className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                            {plan ? formatCurrency(plan.price) : formatCurrency(level.monthlyPrice)}
                            <span className="ml-1">{t('monthly')}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const Icon = row.icon;
                    return (
                      <tr key={row.key} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" style={{ color: 'var(--muted)' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                              {row.label}
                            </span>
                          </div>
                        </td>
                        {levels.map((level) => (
                          <td key={`${level.id}-${row.key}`} className="px-4 py-3 align-middle">
                            <BenefitValue value={row.value(level)} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-3 md:hidden">
              {levels.map((level) => {
                const plan = getPrimaryMonthlyPlan(level);
                return (
                  <section
                    key={level.id}
                    className="rounded-lg p-4"
                    style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4" style={{ color: activeColor }} />
                          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                            {level.name}
                          </h3>
                        </div>
                        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                          {plan ? formatCurrency(plan.price) : formatCurrency(level.monthlyPrice)}
                          <span className="ml-1">{t('monthly')}</span>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {rows.map((row) => {
                        const Icon = row.icon;
                        return (
                          <div
                            key={`${level.id}-${row.key}`}
                            className="flex items-center justify-between gap-3 rounded-md px-3 py-2"
                            style={{ backgroundColor: 'var(--background)' }}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--muted)' }} />
                              <span className="truncate text-xs" style={{ color: 'var(--muted)' }}>
                                {row.label}
                              </span>
                            </div>
                            <div className="shrink-0 text-right">
                              <BenefitValue value={row.value(level)} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="flex max-h-[86vh] flex-col gap-0 overflow-hidden border-border bg-popover p-0 text-popover-foreground sm:max-w-[980px]">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              {t('upgradeMembership')}
            </DialogTitle>
            <DialogDescription>
              {t('choosePlan')}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <MembershipUpgradeView
              descriptionKey="choosePlan"
              descriptionVariant="plain"
              showDowngradeToast={false}
              onNavigateOrder={onNavigateOrder}
              onCheckoutFallback={onCheckoutFallback}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={packagesOpen} onOpenChange={setPackagesOpen}>
        <DialogContent className="flex max-h-[86vh] flex-col gap-0 overflow-hidden border-border bg-popover p-0 text-popover-foreground sm:max-w-[920px]">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {t('pointsPackages')}
            </DialogTitle>
            <DialogDescription>
              {t('packagesDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <MembershipPackagesView
              descriptionKey="packageTip"
              descriptionVariant="plain"
              requirePaidLevel
              onNavigateUpgrade={() => {
                setPackagesOpen(false);
                setUpgradeOpen(true);
              }}
              onNavigateOrder={onNavigateOrder}
              onCheckoutFallback={onCheckoutFallback}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
