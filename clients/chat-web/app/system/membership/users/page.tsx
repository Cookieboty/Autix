'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@autix/shared-ui/ui';
import { Search, ChevronLeft, ChevronRight, Gift, Coins, X, CheckCircle, KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { membershipAdminApi, userApi, type MembershipLevel } from '@/lib/api';

const PAGE_SIZE = 15;

export default function AdminUsersPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [grantTarget, setGrantTarget] = useState<any>(null);
  const [grantType, setGrantType] = useState<'membership' | 'points' | null>(null);
  const [grantForm, setGrantForm] = useState({ levelId: '', months: 1, points: 0, remark: '' });
  const [granting, setGranting] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);

  const handleResetPassword = async (user: any) => {
    if (!user.email) return;
    setResettingPassword(user.id);
    try {
      await userApi.post('/auth/forgot-password', { email: user.email });
      toast.success(t('resetEmailSentToUser', { email: user.email }));
    } catch {
      toast.success(t('resetEmailSentToUser', { email: user.email }));
    } finally {
      setResettingPassword(null);
    }
  };

  const handleApprove = async (userId: string) => {
    setApproving(userId);
    try {
      await membershipAdminApi.approveUser(userId);
      fetchUsers();
    } finally {
      setApproving(null);
    }
  };

  const fetchUsers = async (p = page, s = search) => {
    setLoading(true);
    try {
      const res = await membershipAdminApi.getUsers({ page: p, pageSize: PAGE_SIZE, search: s || undefined });
      const data = res.data as any;
      setUsers(data.items ?? data ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(1); }, []);

  useEffect(() => {
    membershipAdminApi.getLevels().then(res => {
      const data = res.data as any;
      setLevels(Array.isArray(data) ? data : data?.items ?? []);
    });
  }, []);

  const handleSearch = () => fetchUsers(1, search);

  const openGrant = (user: any, type: 'membership' | 'points') => {
    setGrantTarget(user);
    setGrantType(type);
    setGrantForm({ levelId: levels[0]?.id ?? '', months: 1, points: 0, remark: '' });
  };

  const handleGrant = async () => {
    if (!grantTarget) return;
    setGranting(true);
    try {
      if (grantType === 'membership') {
        await membershipAdminApi.grantMembership(grantTarget.id, { levelId: grantForm.levelId, months: grantForm.months });
      } else {
        await membershipAdminApi.grantPoints(grantTarget.id, { points: grantForm.points, remark: grantForm.remark || undefined });
      }
      setGrantTarget(null);
      setGrantType(null);
      fetchUsers();
    } finally {
      setGranting(false);
    }
  };

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
        {loading ? (
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
                  onClick={() => router.push(`/system/membership/users/${user.id}`)}
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
                        <Button size="sm" variant="ghost" className="cursor-pointer" disabled={approving === user.id} onClick={() => handleApprove(user.id)}>
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />{t('approve')}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openGrant(user, 'membership')}>
                        <Gift className="w-3.5 h-3.5 mr-1" />{t('grantMembership')}
                      </Button>
                      <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openGrant(user, 'points')}>
                        <Coins className="w-3.5 h-3.5 mr-1" />{t('grantPoints')}
                      </Button>
                      <Button size="sm" variant="ghost" className="cursor-pointer" disabled={resettingPassword === user.id} onClick={() => handleResetPassword(user)}>
                        <KeyRound className="w-3.5 h-3.5 mr-1" />{t('sendResetEmail')}
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
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => fetchUsers(page - 1)} className="cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{page} / {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => fetchUsers(page + 1)} className="cursor-pointer">
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
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('selectLevel')}</label>
                  <Select
                    value={grantForm.levelId}
                    onValueChange={(val) => setGrantForm({ ...grantForm, levelId: val })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map((lv) => (
                        <SelectItem key={lv.id} value={lv.id}>{lv.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('months')}</label>
                  <Select
                    value={String(grantForm.months)}
                    onValueChange={(val) => setGrantForm({ ...grantForm, months: Number(val) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 3, 6, 12].map((m) => (
                        <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
