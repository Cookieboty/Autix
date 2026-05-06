'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '@autix/shared-ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { membershipAdminApi, type PointsRecord } from '@/lib/api';

const PAGE_SIZE = 15;

const SOURCE_OPTIONS = ['', 'MEMBERSHIP', 'PACKAGE', 'TASK', 'INVITATION', 'ADMIN_GRANT', 'AGENT_CALL'] as const;

export default function AdminPointsRecordsPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const [records, setRecords] = useState<PointsRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [filterUserId, setFilterUserId] = useState('');
  const [filterSource, setFilterSource] = useState('');

  const fetchRecords = async (p = page) => {
    setLoading(true);
    try {
      const res = await membershipAdminApi.getPointsRecords({
        page: p,
        pageSize: PAGE_SIZE,
        userId: filterUserId || undefined,
        source: filterSource || undefined,
      });
      const data = res.data as any;
      setRecords(data.items ?? data ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(1); }, [filterSource]);

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

  const selectStyle = { border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' };
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 p-4 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('adminPointsRecords')}</h1>
        <span className="flex-1" />
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('userId')}
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchRecords(1)}
            className="w-[160px]"
          />
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md outline-none"
            style={selectStyle}
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s ? sourceLabel(s) : t('sourceAll')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
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
        <div className="flex items-center justify-center gap-2 p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => fetchRecords(page - 1)} className="cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{page} / {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => fetchRecords(page + 1)} className="cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
