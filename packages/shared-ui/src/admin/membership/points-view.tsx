'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';
import { useAdminPointsRecordsQuery, type PointsRecord } from '@autix/shared-store';

const PAGE_SIZE = 15;

const SOURCE_OPTIONS = ['', 'MEMBERSHIP', 'PACKAGE', 'TASK', 'INVITATION', 'ADMIN_GRANT', 'AGENT_CALL'] as const;

export function AdminMembershipPointsView() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const [page, setPage] = useState(1);
  const [filterUserId, setFilterUserId] = useState('');
  const [searchUserId, setSearchUserId] = useState('');
  const [filterSource, setFilterSource] = useState('');

  const { data, isLoading } = useAdminPointsRecordsQuery({
    page,
    pageSize: PAGE_SIZE,
    userId: searchUserId || undefined,
    source: filterSource || undefined,
  });
  const records: PointsRecord[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = () => {
    setSearchUserId(filterUserId);
    setPage(1);
  };

  const sourceLabel = (s: string) => {
    const map: Record<string, string> = {
      MEMBERSHIP: t('sourceMembership'),
      PACKAGE: t('sourcePackage'),
      TASK: t('sourceTask'),
      INVITATION: t('sourceInvitation'),
      ADMIN_GRANT: t('sourceAdminGrant'),
      AGENT_CALL: t('sourceAgentCall'),
    };
    return map[s] ?? s;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b p-4" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('adminPointsRecords')}
        </h1>
        <span className="flex-1" />
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('userId')}
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-[160px]"
          />
          <Select
            value={filterSource || '_all_'}
            onValueChange={(val) => {
              setFilterSource(val === '_all_' ? '' : val);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((s) => (
                <SelectItem key={s || '_all_'} value={s || '_all_'}>
                  {s ? sourceLabel(s) : t('sourceAll')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : records.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('userId')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('type')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('amount')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('source')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('remark')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('balance')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('date')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted)' }}>{r.userId}</td>
                  <td className="px-4 py-3" style={{ color: r.type === 'EARN' ? 'var(--success)' : 'var(--danger)' }}>
                    {r.type === 'EARN' ? t('filterEarn') : t('filterConsume')}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                    {r.type === 'EARN' ? '+' : '-'}{r.amount}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{sourceLabel(r.source)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{r.remark ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{r.balance}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 border-t p-3" style={{ borderColor: 'var(--border)' }}>
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} className="cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{page} / {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="cursor-pointer">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
