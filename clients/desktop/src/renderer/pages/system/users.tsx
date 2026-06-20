'use client';

import { useState } from 'react';
import { Button, Input } from '@autix/shared-ui/ui';
import { ChevronLeft, ChevronRight, Gift, Coins, X, CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useNavigate } from 'react-router-dom';
import {
  useAdminMembershipUsersQuery,
  useAdminMembershipLevelsQuery,
  useGrantAdminMembershipMutation,
  useGrantAdminPointsMutation,
  useApproveAdminMembershipUserMutation,
  type AdminMembershipUser,
} from '@autix/shared-store';

const PAGE_SIZE = 15;

export function SystemUsersPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [grantTarget, setGrantTarget] = useState<AdminMembershipUser | null>(null);
  const [grantType, setGrantType] = useState<'membership' | 'points' | null>(null);
  const [grantForm, setGrantForm] = useState({ levelId: '', months: 1, points: 0, remark: '' });

  const { data, isLoading } = useAdminMembershipUsersQuery({
    page,
    pageSize: PAGE_SIZE,
    search: appliedSearch || undefined,
  });

  const users: AdminMembershipUser[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const { data: levels = [] } = useAdminMembershipLevelsQuery();

  const approveMutation = useApproveAdminMembershipUserMutation();
  const grantMembershipMutation = useGrantAdminMembershipMutation();
  const grantPointsMutation = useGrantAdminPointsMutation();

  const handleApprove = (userId: string) => {
    approveMutation.mutate({ userId });
  };

  const handleSearch = () => { setAppliedSearch(search); setPage(1); };

  const openGrant = (user: AdminMembershipUser, type: 'membership' | 'points') => {
    setGrantTarget(user);
    setGrantType(type);
    setGrantForm({ levelId: levels[0]?.id ?? '', months: 1, points: 0, remark: '' });
  };

  const handleGrant = () => {
    if (!grantTarget) return;
    if (grantType === 'membership') {
      grantMembershipMutation.mutate(
        { userId: grantTarget.id, levelId: grantForm.levelId, months: grantForm.months },
        { onSuccess: () => { setGrantTarget(null); setGrantType(null); } },
      );
    } else {
      grantPointsMutation.mutate(
        { userId: grantTarget.id, points: grantForm.points, remark: grantForm.remark || undefined },
        { onSuccess: () => { setGrantTarget(null); setGrantType(null); } },
      );
    }
  };

  const granting = grantMembershipMutation.isPending || grantPointsMutation.isPending;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('adminUsers')}</h1>
        <span className="flex-1" />
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-[240px]"
          />
          <Button size="sm" variant="ghost" onClick={handleSearch} className="cursor-pointer">
            {tCommon('search')}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('username')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('email')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('status')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('memberLevel')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('pointsBalance')}</th>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('operations')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="transition-colors cursor-pointer"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onClick={() => navigate(`/system/membership/users/${user.id}`)}
                >
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{user.username}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{user.email}</td>
                  <td className="px-4 py-3">
                    {user.status === 'APPROVED' ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: 'rgb(34,197,94)' }}>
                        {t('statusApproved')}
                      </span>
                    ) : user.status === 'PENDING' ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: 'rgb(202,138,4)' }}>
                        {t('statusPending')}
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'rgb(239,68,68)' }}>
                        {user.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.membership?.level?.name ? (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                      >
                        {user.membership.level.name}
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{t('noMembershipShort')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{user.pointsBalance ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {user.status === 'PENDING' && (
                        <Button size="sm" variant="ghost" className="cursor-pointer" disabled={approveMutation.isPending && approveMutation.variables?.userId === user.id} onClick={() => handleApprove(user.id)}>
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />{t('approve')}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openGrant(user, 'membership')}>
                        <Gift className="w-3.5 h-3.5 mr-1" />{t('grantMembership')}
                      </Button>
                      <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openGrant(user, 'points')}>
                        <Coins className="w-3.5 h-3.5 mr-1" />{t('grantPoints')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} className="cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{page} / {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Grant Modal */}
      {grantTarget && grantType && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => { setGrantTarget(null); setGrantType(null); }} />
          <div style={{ position: 'relative', backgroundColor: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {grantType === 'membership' ? t('grantMembership') : t('grantPoints')} — {grantTarget.username}
              </h3>
              <button className="cursor-pointer" onClick={() => { setGrantTarget(null); setGrantType(null); }}>
                <X className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            {grantType === 'membership' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('selectLevel')}</label>
                  <select
                    value={grantForm.levelId}
                    onChange={(e) => setGrantForm({ ...grantForm, levelId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-md outline-none"
                    style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                  >
                    {levels.map((lv) => (
                      <option key={lv.id} value={lv.id}>{lv.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('months')}</label>
                  <select
                    value={grantForm.months}
                    onChange={(e) => setGrantForm({ ...grantForm, months: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-md outline-none"
                    style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                  >
                    {[1, 3, 6, 12].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('pointsAmount')}</label>
                  <Input
                    type="number"
                    value={String(grantForm.points)}
                    onChange={(e) => setGrantForm({ ...grantForm, points: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('remark')}</label>
                  <Input
                    placeholder={t('remarkPlaceholder')}
                    value={grantForm.remark}
                    onChange={(e) => setGrantForm({ ...grantForm, remark: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => { setGrantTarget(null); setGrantType(null); }}>
                {tCommon('cancel')}
              </Button>
              <Button size="sm"  className="cursor-pointer" disabled={granting} onClick={handleGrant}>
                {tCommon('confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
