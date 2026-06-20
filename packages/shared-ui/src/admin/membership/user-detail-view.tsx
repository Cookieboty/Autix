'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Gift, Coins, X } from 'lucide-react';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';
import { formatCurrency } from '../../format';
import {
  useAdminMembershipLevelsQuery,
  useAdminMembershipUserDetailQuery,
  useAdminUserPointsDetailQuery,
  useGrantAdminMembershipMutation,
  useGrantAdminPointsMutation,
  type AdminUserPointsDetail,
  type MembershipLevel,
  type PointsRecord,
  type Order,
} from '@autix/shared-store';

type AdminMembershipUserDetail = {
  username?: string;
  membership?: {
    level?: { name?: string } | null;
    status?: string | null;
    expiresAt?: string | null;
    autoRenew?: boolean | null;
  } | null;
  points?: number | null;
  pointsBalance?: number | null;
  recentRecords?: PointsRecord[] | null;
  pointsRecords?: PointsRecord[] | null;
  recentOrders?: Order[] | null;
  orders?: Order[] | null;
};

type Props = {
  userId: string;
  onBack: () => void;
};

export function AdminMembershipUserDetailView({ userId, onBack }: Props) {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const { data: detail, isLoading: loading } = useAdminMembershipUserDetailQuery(userId);
  const { data: pointsDetail } = useAdminUserPointsDetailQuery(
    userId,
    { grantTake: 50, holdTake: 20, recordTake: 50 },
  );
  const { data: levels = [] } = useAdminMembershipLevelsQuery();

  const [grantType, setGrantType] = useState<'membership' | 'points' | null>(null);
  const [grantForm, setGrantForm] = useState({ levelId: '', months: 1, points: 0, remark: '' });

  const grantMembershipMutation = useGrantAdminMembershipMutation({
    onSuccess: () => setGrantType(null),
  });
  const grantPointsMutation = useGrantAdminPointsMutation({
    onSuccess: () => setGrantType(null),
  });
  const granting = grantMembershipMutation.isPending || grantPointsMutation.isPending;

  const openGrant = (type: 'membership' | 'points') => {
    setGrantType(type);
    setGrantForm({ levelId: levels[0]?.id ?? '', months: 1, points: 0, remark: '' });
  };

  const handleGrant = () => {
    if (grantType === 'membership') {
      grantMembershipMutation.mutate({
        userId,
        levelId: grantForm.levelId,
        months: grantForm.months,
      });
    } else {
      grantPointsMutation.mutate({
        userId,
        points: grantForm.points,
        remark: grantForm.remark || undefined,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</span>
      </div>
    );
  }

  const userDetail = detail as AdminMembershipUserDetail;
  const membership = userDetail.membership;
  const pointsBalance = userDetail.points ?? userDetail.pointsBalance ?? 0;
  const pointsRecords = userDetail.recentRecords ?? userDetail.pointsRecords ?? [];
  const orders = userDetail.recentOrders ?? userDetail.orders ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b p-4" style={{ borderColor: 'var(--border)' }}>
        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('userDetail')} — {userDetail.username}
        </h1>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openGrant('membership')}>
          <Gift className="mr-1 h-3.5 w-3.5" />{t('grantMembership')}
        </Button>
        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openGrant('points')}>
          <Coins className="mr-1 h-3.5 w-3.5" />{t('grantPoints')}
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('membershipInfo')}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span style={{ color: 'var(--muted)' }}>{t('memberLevel')}:</span>{' '}
              <span style={{ color: 'var(--foreground)' }}>{membership?.level?.name ?? t('noMembershipShort')}</span>
            </div>
            <div>
              <span style={{ color: 'var(--muted)' }}>{t('status')}:</span>{' '}
              <span style={{ color: membership?.status === 'ACTIVE' ? 'var(--success)' : 'var(--muted)' }}>
                {membership?.status ?? '—'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--muted)' }}>{t('expiresAt')}:</span>{' '}
              <span style={{ color: 'var(--foreground)' }}>
                {membership?.expiresAt ? new Date(membership.expiresAt).toLocaleDateString() : '—'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--muted)' }}>{t('autoRenew')}:</span>{' '}
              <span style={{ color: 'var(--foreground)' }}>
                {membership ? (membership.autoRenew ? t('autoRenewOn') : t('autoRenewOff')) : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="mb-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('pointsBalance')}</h2>
          <p className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>{pointsBalance}</p>
        </div>

        {pointsDetail && <PointsDetailSection detail={pointsDetail} />}

        <div>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('recentPointsRecords')}</h2>
          {pointsRecords.length === 0 ? (
            <p className="py-4 text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('type')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('amount')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('source')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('remark')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('balance')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('date')}</th>
                </tr>
              </thead>
              <tbody>
                {pointsRecords.slice(0, 10).map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-3 py-2" style={{ color: r.type === 'EARN' ? 'var(--success)' : 'var(--danger)' }}>
                      {r.type === 'EARN' ? '+' : '-'}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{r.amount}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{r.source}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{r.remark ?? '—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{r.balance}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('recentOrders')}</h2>
          {orders.length === 0 ? (
            <p className="py-4 text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('orderNo')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('productName')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('amount')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('status')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('date')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 10).map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{o.orderNo}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{o.productName}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{formatCurrency(o.amount, o.currency)}</td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: o.status === 'PAID' ? 'var(--success-soft)' : 'var(--muted-soft)',
                          color: o.status === 'PAID' ? 'var(--success)' : 'var(--muted)',
                        }}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {grantType && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--modal-backdrop)' }} onClick={() => setGrantType(null)} />
          <div style={{ position: 'relative', backgroundColor: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw' }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {grantType === 'membership' ? t('grantMembership') : t('grantPoints')}
              </h3>
              <button className="cursor-pointer" onClick={() => setGrantType(null)}>
                <X className="h-4 w-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            {grantType === 'membership' ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('selectLevel')}</label>
                  <Select
                    value={grantForm.levelId}
                    onValueChange={(val) => setGrantForm({ ...grantForm, levelId: val })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map((lv: MembershipLevel) => (
                        <SelectItem key={lv.id} value={lv.id}>{lv.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('months')}</label>
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
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('pointsAmount')}</label>
                  <Input
                    type="number"
                    value={String(grantForm.points)}
                    onChange={(e) => setGrantForm({ ...grantForm, points: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('remark')}</label>
                  <Input
                    placeholder={t('remarkPlaceholder')}
                    value={grantForm.remark}
                    onChange={(e) => setGrantForm({ ...grantForm, remark: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setGrantType(null)}>
                {tCommon('cancel')}
              </Button>
              <Button size="sm" className="cursor-pointer" disabled={granting} onClick={handleGrant}>
                {tCommon('confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PointsDetailSection({ detail }: { detail: AdminUserPointsDetail }) {
  const t = useTranslations('membership');

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('pointsDetail')}</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <InfoBlock label={t('grantPoints')} value={detail.grantSummary?.length ?? 0} />
        <InfoBlock label={t('holdPoints')} value={detail.holdSummary?.length ?? 0} />
        <InfoBlock label={t('recordCount')} value={detail.records?.length ?? 0} />
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--panel-muted)' }}>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{value}</p>
    </div>
  );
}
