'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, SidebarTrigger } from '@autix/shared-ui/ui';
import { Gift, RefreshCw, Trophy } from 'lucide-react';
import {
  campaignApi,
  type CampaignProgress,
  type UserActivityStreak,
} from '@autix/sdk';

function rewardPoints(expression: unknown) {
  if (typeof expression === 'number') return expression;
  if (typeof expression === 'string') return Number(expression) || 0;
  if (expression && typeof expression === 'object') {
    const obj = expression as Record<string, unknown>;
    return Number(obj.fixed ?? obj.amount ?? obj.points ?? 0) || 0;
  }
  return 0;
}

function formatDate(value: string | null | undefined, t: (key: string) => string) {
  if (!value) return t('longTerm');
  return new Date(value).toLocaleDateString();
}

function findSuccessfulStreak(streaks: UserActivityStreak[]) {
  return streaks.find((item) => item.streakType === 'successful_generation');
}

export default function RewardsCenterPage() {
  const t = useTranslations('membership');
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await campaignApi.getMyProgress();
      setProgress(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? t('rewardsLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const streak = useMemo(
    () => findSuccessfulStreak(progress?.streaks ?? []),
    [progress?.streaks],
  );
  const currentStreak = streak?.currentStreak ?? 0;
  const streakStep = currentStreak % 7 === 0 && currentStreak > 0 ? 7 : currentStreak % 7;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className="flex h-12 flex-shrink-0 items-center gap-2 px-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <SidebarTrigger className="-ml-1" />
        <h1 className="ml-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('rewardsCenter')}
        </h1>
        <div className="ml-auto">
          <Button size="sm" variant="ghost" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ color: 'var(--danger)', border: '1px solid var(--border)' }}>
            {error}
          </div>
        )}

        <section className="mb-5 rounded-lg p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('successfulGenerationStreak')}</p>
              <h2 className="mt-1 text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
                {t('daysCount', { count: currentStreak })}
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                {t('streakHint')}
              </p>
            </div>
            <div className="min-w-[220px]">
              <div className="mb-2 flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
                <span>{t('roundProgress')}</span>
                <span>{streakStep}/7</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (streakStep / 7) * 100)}%`,
                    backgroundColor: 'var(--brand)',
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4" style={{ color: 'var(--brand)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('activeCampaigns')}</h2>
          </div>
          {loading ? (
            <p className="py-8 text-sm" style={{ color: 'var(--muted)' }}>{t('loading')}</p>
          ) : progress?.activeCampaigns.length ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {progress.activeCampaigns.map((campaign) => (
                <article
                  key={campaign.id}
                  className="rounded-lg p-4"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {campaign.name}
                      </h3>
                      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                        {campaign.description || t('campaignDefaultDescription')}
                      </p>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>
                      {t('pointsCount', { count: rewardPoints(campaign.rewardPointsExpression) })}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                    <span>{t('validUntil', { date: formatDate(campaign.endsAt, t) })}</span>
                    <span>{t('rewardValidDays', { count: campaign.rewardExpiresInDays })}</span>
                    <span>{t('issuedPoints', { count: campaign.usedBudget })}</span>
                    <span>{campaign.rewardUsageScope ? t('usageLimited') : t('usageRegular')}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-lg px-4 py-8 text-sm" style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}>
              {t('noActiveCampaigns')}
            </p>
          )}
        </section>

        <section className="mb-5">
          <div className="mb-3 flex items-center gap-2">
            <Gift className="h-4 w-4" style={{ color: 'var(--brand)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('pendingInvites')}</h2>
          </div>
          {progress?.pendingInvites.length ? (
            <div className="rounded-lg" style={{ border: '1px solid var(--border)' }}>
              {progress.pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between px-4 py-3 text-sm" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--foreground)' }}>{t('invitedUser', { userId: invite.inviteeUserId })}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    {t('pendingInviteReward', { count: invite.rewardPoints })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg px-4 py-6 text-sm" style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}>
              {t('noPendingInvites')}
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('rewardRecords')}</h2>
          {progress?.rewards.length ? (
            <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-secondary)' }}>
                    <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('campaign')}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('points')}</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('pointsRecordTime')}</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.rewards.map((reward) => (
                    <tr key={reward.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="px-4 py-2.5" style={{ color: 'var(--foreground)' }}>
                        {reward.campaign?.name ?? reward.campaignId}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--success)' }}>
                        +{reward.pointsGranted}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                        {new Date(reward.grantedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg px-4 py-8 text-sm" style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}>
              {t('noRewardRecords')}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
