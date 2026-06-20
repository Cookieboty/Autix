'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Gift } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useMembershipPointsRecordsQuery,
  usePointsBalanceQuery,
  usePointsSummaryQuery,
} from '@autix/shared-store';
import { Button, SidebarTrigger } from '../ui';

type SourceFilter =
  | ''
  | 'MEMBERSHIP'
  | 'PACKAGE'
  | 'TASK'
  | 'INVITATION'
  | 'ADMIN_GRANT'
  | 'AGENT_CALL'
  | 'CAMPAIGN'
  | 'EXPIRATION';

type MembershipPointsViewProps = {
  showSidebarTrigger?: boolean;
  showRewardsAction?: boolean;
  variant?: 'summary' | 'balance';
  activeColorVar?: '--brand' | '--accent';
  onNavigateRewards?: () => void;
};

const PAGE_SIZE = 20;

const BASE_SOURCE_OPTIONS: { key: SourceFilter; label: string }[] = [
  { key: '', label: 'sourceAll' },
  { key: 'MEMBERSHIP', label: 'sourceMembership' },
  { key: 'PACKAGE', label: 'sourcePackage' },
  { key: 'TASK', label: 'sourceTask' },
  { key: 'INVITATION', label: 'sourceInvitation' },
  { key: 'ADMIN_GRANT', label: 'sourceAdminGrant' },
];

const SUMMARY_SOURCE_OPTIONS: { key: SourceFilter; label: string }[] = [
  ...BASE_SOURCE_OPTIONS,
  { key: 'AGENT_CALL', label: 'sourceAgentCall' },
  { key: 'CAMPAIGN', label: 'sourceCampaign' },
  { key: 'EXPIRATION', label: 'sourceExpiration' },
];

const GRANT_TYPE_LABEL: Record<string, string> = {
  SUBSCRIPTION: 'grantSubscription',
  PURCHASED: 'grantPurchased',
  GIFT: 'grantGift',
  COMPENSATION: 'grantCompensation',
};

function sourceLabel(source: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    MEMBERSHIP: 'sourceMembership',
    PACKAGE: 'sourcePackage',
    TASK: 'sourceTask',
    INVITATION: 'sourceInvitation',
    ADMIN_GRANT: 'sourceAdminGrant',
    AGENT_CALL: 'sourceAgentCall',
    CAMPAIGN: 'sourceCampaign',
    EXPIRATION: 'sourceExpiration',
  };
  return labels[source] ? t(labels[source]) : source;
}

function sourceCamelLabel(source: string, t: (key: string) => string) {
  const key = `source${source.charAt(0)}${source
    .slice(1)
    .toLowerCase()
    .replace(/_./g, (match) => match[1].toUpperCase())}`;
  return t(key);
}

function usageScopeLabel(scope: Record<string, unknown> | null, t: (key: string) => string) {
  const excluded = Array.isArray(scope?.excludedTaskTypes) ? scope.excludedTaskTypes : [];
  const excludedPrefixes = Array.isArray(scope?.excludedTaskPrefixes)
    ? scope.excludedTaskPrefixes
    : [];
  if (excluded.length === 0 && excludedPrefixes.length === 0) return t('usageRegularGeneration');
  return t('usageLimited');
}

export function MembershipPointsView({
  showSidebarTrigger = false,
  showRewardsAction = false,
  variant = 'summary',
  activeColorVar = '--brand',
  onNavigateRewards,
}: MembershipPointsViewProps) {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const [page, setPage] = useState(1);
  const [source, setSource] = useState<SourceFilter>('');

  const { data: summary } = usePointsSummaryQuery(variant === 'summary');
  const { data: balance } = usePointsBalanceQuery(variant === 'balance');
  const { data, isLoading } = useMembershipPointsRecordsQuery({
    page,
    pageSize: PAGE_SIZE,
    source: source || undefined,
  });

  const records = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const sourceOptions = variant === 'summary' ? SUMMARY_SOURCE_OPTIONS : BASE_SOURCE_OPTIONS;
  const activeBackground = `var(${activeColorVar})`;
  const activeForeground =
    activeColorVar === '--brand' ? 'var(--brand-foreground)' : '#fff';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 h-12 px-4 flex items-center gap-2 border-b border-border"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {showSidebarTrigger && <SidebarTrigger className="-ml-1" />}
        <h1
          className={`${showSidebarTrigger ? 'ml-1 ' : ''}text-sm font-semibold text-foreground`}
          style={{ color: 'var(--foreground)' }}
        >
          {t('pointsDetail')}
        </h1>
        {showRewardsAction && (
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={onNavigateRewards}>
              <Gift className="w-3.5 h-3.5 mr-1" />
              {t('rewardsCenter')}
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {variant === 'summary' ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              {[
                [t('balanceAvailable'), summary?.balances.available ?? 0],
                [t('balanceFrozen'), summary?.balances.frozen ?? 0],
                [t('grantSubscription'), summary?.balances.subscription ?? 0],
                [t('grantPurchased'), summary?.balances.purchased ?? 0],
                [t('grantGift'), summary?.balances.gift ?? 0],
                [t('grantCompensation'), summary?.balances.compensation ?? 0],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg p-4"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
                  <p className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>{value}</p>
                </div>
              ))}
            </div>

            <div
              className="rounded-lg overflow-hidden mb-6"
              style={{ border: '1px solid var(--border)' }}
            >
              <div className="px-4 py-3" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('pointsGrants')}</h2>
              </div>
              {summary?.grants?.length ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                      <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('pointsRecordType')}</th>
                      <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('available')}</th>
                      <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('frozen')}</th>
                      <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('validityPeriod')}</th>
                      <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('usageScope')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.grants.slice(0, 8).map((grant) => (
                      <tr key={grant.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="px-4 py-2.5" style={{ color: 'var(--foreground)' }}>
                          {GRANT_TYPE_LABEL[grant.grantType] ? t(GRANT_TYPE_LABEL[grant.grantType]) : grant.grantType}
                        </td>
                        <td className="text-right px-4 py-2.5" style={{ color: 'var(--foreground)' }}>
                          {grant.availableAmount}
                        </td>
                        <td className="text-right px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                          {grant.frozenAmount}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                          {grant.expiresAt ? new Date(grant.expiresAt).toLocaleDateString() : t('longTerm')}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                          {usageScopeLabel(grant.usageScope, t)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-4 py-5 text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</p>
              )}
            </div>
          </>
        ) : (
          <div
            className="rounded-xl p-5 mb-6"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('pointsBalance')}</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {balance?.balance ?? 0}
            </p>
          </div>
        )}

        <div className="flex gap-2 mb-4 flex-wrap">
          {sourceOptions.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setSource(key);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: source === key ? activeBackground : 'var(--surface)',
                color: source === key ? activeForeground : 'var(--foreground)',
                border: source === key ? 'none' : '1px solid var(--border)',
              }}
            >
              {t(label)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-secondary)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('pointsRecordType')}</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('pointsRecordAmount')}</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('pointsRecordSource')}</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('pointsRecordRemark')}</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('pointsRecordTime')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor:
                            record.type === 'EARN'
                              ? activeColorVar === '--accent'
                                ? '#22c55e20'
                                : 'var(--success-soft)'
                              : activeColorVar === '--accent'
                                ? '#ef444420'
                                : 'var(--danger-soft)',
                          color: record.type === 'EARN' ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {record.type === 'EARN' ? '+' : '-'}
                      </span>
                    </td>
                    <td
                      className="text-right px-4 py-2.5 font-medium"
                      style={{ color: record.type === 'EARN' ? 'var(--success)' : 'var(--danger)' }}
                    >
                      {record.type === 'EARN' ? '+' : '-'}{record.amount}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--foreground)' }}>
                      {variant === 'summary'
                        ? sourceLabel(record.source, t)
                        : sourceCamelLabel(record.source, t)}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                      {record.remark || '-'}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                      {new Date(record.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <div
          className="flex items-center justify-center gap-2 px-6 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} className="cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{page} / {pageCount}</span>
          <Button size="sm" variant="ghost" disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
