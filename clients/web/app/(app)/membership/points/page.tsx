'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, SidebarTrigger } from '@autix/shared-ui/ui';
import { ChevronLeft, ChevronRight, Gift } from 'lucide-react';
import { pointsApi, type PointAccountSummary, type PointsRecord } from '@/lib/api';

type SourceFilter = '' | 'MEMBERSHIP' | 'PACKAGE' | 'TASK' | 'INVITATION' | 'ADMIN_GRANT' | 'AGENT_CALL' | 'CAMPAIGN' | 'EXPIRATION';

const SOURCE_OPTIONS: { key: SourceFilter; label: string }[] = [
  { key: '', label: 'sourceAll' },
  { key: 'MEMBERSHIP', label: 'sourceMembership' },
  { key: 'PACKAGE', label: 'sourcePackage' },
  { key: 'TASK', label: 'sourceTask' },
  { key: 'INVITATION', label: 'sourceInvitation' },
  { key: 'ADMIN_GRANT', label: 'sourceAdminGrant' },
  { key: 'AGENT_CALL', label: 'sourceAgentCall' },
  { key: 'CAMPAIGN', label: 'sourceCampaign' },
  { key: 'EXPIRATION', label: 'sourceExpiration' },
];

const PAGE_SIZE = 20;

const GRANT_TYPE_LABEL: Record<string, string> = {
  SUBSCRIPTION: '订阅积分',
  PURCHASED: '购买积分',
  GIFT: '赠送积分',
  COMPENSATION: '补偿积分',
};

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    MEMBERSHIP: '会员订阅',
    PACKAGE: '积分包',
    TASK: '任务消耗',
    INVITATION: '邀请奖励',
    ADMIN_GRANT: '后台调整',
    AGENT_CALL: 'AI 对话',
    CAMPAIGN: '活动赠送',
    EXPIRATION: '积分过期',
  };
  return labels[source] ?? source;
}

function usageScopeLabel(scope: Record<string, unknown> | null) {
  const excluded = Array.isArray(scope?.excludedTaskTypes) ? scope.excludedTaskTypes : [];
  const excludedPrefixes = Array.isArray(scope?.excludedTaskPrefixes) ? scope.excludedTaskPrefixes : [];
  if (excluded.length === 0 && excludedPrefixes.length === 0) return '常规生成';
  return '有限用途';
}

export default function PointsHistoryPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [summary, setSummary] = useState<PointAccountSummary | null>(null);
  const [records, setRecords] = useState<PointsRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<SourceFilter>('');
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async (p: number, s: SourceFilter) => {
    setLoading(true);
    try {
      const res = await pointsApi.getRecords({
        page: p,
        pageSize: PAGE_SIZE,
        source: s || undefined,
      });
      const data = res.data as any;
      setRecords(data.items ?? data ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    pointsApi.getSummary()
      .then((res) => setSummary(res.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchRecords(page, source);
  }, [page, source, fetchRecords]);

  const pageCount = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 h-12 px-4 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <SidebarTrigger className="-ml-1" />
        <h1 className="ml-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('pointsDetail')}
        </h1>
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={() => router.push('/membership/rewards')}>
            <Gift className="w-3.5 h-3.5 mr-1" />
            奖励中心
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            ['总可用积分', summary?.balances.available ?? 0],
            ['冻结积分', summary?.balances.frozen ?? 0],
            ['订阅积分', summary?.balances.subscription ?? 0],
            ['购买积分', summary?.balances.purchased ?? 0],
            ['赠送积分', summary?.balances.gift ?? 0],
            ['补偿积分', summary?.balances.compensation ?? 0],
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
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>积分批次</h2>
          </div>
          {summary?.grants?.length ? (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderTop: '1px solid var(--border)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>类型</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>可用</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>冻结</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('validityPeriod')}</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>用途</th>
                </tr>
              </thead>
              <tbody>
                {summary.grants.slice(0, 8).map((grant) => (
                  <tr key={grant.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5" style={{ color: 'var(--foreground)' }}>
                      {GRANT_TYPE_LABEL[grant.grantType] ?? grant.grantType}
                    </td>
                    <td className="text-right px-4 py-2.5" style={{ color: 'var(--foreground)' }}>
                      {grant.availableAmount}
                    </td>
                    <td className="text-right px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                      {grant.frozenAmount}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                      {grant.expiresAt ? new Date(grant.expiresAt).toLocaleDateString() : '长期'}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                      {usageScopeLabel(grant.usageScope)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-5 text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</p>
          )}
        </div>

        {/* Source filter tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {SOURCE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setSource(key); setPage(1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: source === key ? 'var(--brand)' : 'var(--surface)',
                color: source === key ? 'var(--brand-foreground)' : 'var(--foreground)',
                border: source === key ? 'none' : '1px solid var(--border)',
              }}
            >
              {t(label)}
            </button>
          ))}
        </div>

        {/* Records table */}
        {loading ? (
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
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>类型</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>数量</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>来源</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>备注</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>时间</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: r.type === 'EARN' ? 'var(--success-soft)' : 'var(--danger-soft)',
                          color: r.type === 'EARN' ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {r.type === 'EARN' ? '+' : '-'}
                      </span>
                    </td>
                    <td
                      className="text-right px-4 py-2.5 font-medium"
                      style={{ color: r.type === 'EARN' ? 'var(--success)' : 'var(--danger)' }}
                    >
                      {r.type === 'EARN' ? '+' : '-'}{r.amount}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--foreground)' }}>
                      {sourceLabel(r.source)}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                      {r.remark || '-'}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
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
