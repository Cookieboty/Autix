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
} from '@autix/shared-ui';
import { ArrowLeft, Gift, Coins, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { membershipAdminApi, type MembershipLevel, type PointsRecord, type Order } from '@/lib/api';

export default function AdminUserDetailPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState<MembershipLevel[]>([]);

  const [grantType, setGrantType] = useState<'membership' | 'points' | null>(null);
  const [grantForm, setGrantForm] = useState({ levelId: '', months: 1, points: 0, remark: '' });
  const [granting, setGranting] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await membershipAdminApi.getUserDetail(userId);
      setDetail(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    membershipAdminApi.getLevels().then(res => {
      const data = res.data as any;
      setLevels(Array.isArray(data) ? data : data?.items ?? []);
    });
  }, [userId]);

  const openGrant = (type: 'membership' | 'points') => {
    setGrantType(type);
    setGrantForm({ levelId: levels[0]?.id ?? '', months: 1, points: 0, remark: '' });
  };

  const handleGrant = async () => {
    setGranting(true);
    try {
      if (grantType === 'membership') {
        await membershipAdminApi.grantMembership(userId, { levelId: grantForm.levelId, months: grantForm.months });
      } else {
        await membershipAdminApi.grantPoints(userId, { points: grantForm.points, remark: grantForm.remark || undefined });
      }
      setGrantType(null);
      fetchDetail();
    } finally {
      setGranting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</span>
      </div>
    );
  }

  const membership = detail.membership;
  const pointsRecords: PointsRecord[] = detail.pointsRecords ?? [];
  const orders: Order[] = detail.orders ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => router.push('/system/membership/users')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('userDetail')} — {detail.username}
        </h1>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openGrant('membership')}>
          <Gift className="w-3.5 h-3.5 mr-1" />{t('grantMembership')}
        </Button>
        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openGrant('points')}>
          <Coins className="w-3.5 h-3.5 mr-1" />{t('grantPoints')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Membership Info */}
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>{t('membershipInfo')}</h2>
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

        {/* Points Balance */}
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>{t('pointsBalance')}</h2>
          <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{detail.pointsBalance ?? 0}</p>
        </div>

        {/* Recent Points Records */}
        <div>
          <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{t('recentPointsRecords')}</h2>
          {pointsRecords.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('type')}</th>
                  <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('amount')}</th>
                  <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('source')}</th>
                  <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('remark')}</th>
                  <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('balance')}</th>
                  <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('date')}</th>
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

        {/* Recent Orders */}
        <div>
          <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{t('recentOrders')}</h2>
          {orders.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('orderNo')}</th>
                  <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('productName')}</th>
                  <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('amount')}</th>
                  <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('status')}</th>
                  <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('date')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 10).map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{o.orderNo}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{o.productName}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>¥{o.amount}</td>
                    <td className="px-3 py-2">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: o.status === 'PAID' ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
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

      {/* Grant Modal */}
      {grantType && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setGrantType(null)} />
          <div style={{ position: 'relative', backgroundColor: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {grantType === 'membership' ? t('grantMembership') : t('grantPoints')}
              </h3>
              <button className="cursor-pointer" onClick={() => setGrantType(null)}>
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
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setGrantType(null)}>
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
