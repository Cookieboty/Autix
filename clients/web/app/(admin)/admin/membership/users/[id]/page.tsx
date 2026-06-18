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
import { ArrowLeft, Gift, Coins, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { membershipAdminApi, type MembershipLevel, type PointsRecord, type Order, type AdminUserPointsDetail } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function AdminUserDetailPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [detail, setDetail] = useState<any>(null);
  const [pointsDetail, setPointsDetail] = useState<AdminUserPointsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState<MembershipLevel[]>([]);

  const [grantType, setGrantType] = useState<'membership' | 'points' | null>(null);
  const [grantForm, setGrantForm] = useState({ levelId: '', months: 1, points: 0, remark: '' });
  const [granting, setGranting] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      // P2-C-2: 同步拉取基础 detail 与 P2-A1 聚合的积分明细（一屏直达批次/冻结/汇总）
      const [res, pointsRes] = await Promise.all([
        membershipAdminApi.getUserDetail(userId),
        membershipAdminApi
          .getUserPointsDetail(userId, { grantTake: 50, holdTake: 20, recordTake: 50 })
          .catch(() => null),
      ]);
      setDetail(res.data);
      setPointsDetail(pointsRes?.data ?? null);
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
        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => router.push('/admin/membership/users')}>
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
          <p className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>{detail.pointsBalance ?? 0}</p>
        </div>

        {/* P2-C-2: Points Detail（批次 / 冻结 / 汇总） */}
        {pointsDetail && (
          <PointsDetailSection detail={pointsDetail} />
        )}

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
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{formatCurrency(o.amount, o.currency)}</td>
                    <td className="px-3 py-2">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium"
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

      {/* Grant Modal */}
      {grantType && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--modal-backdrop)' }} onClick={() => setGrantType(null)} />
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

// P2-C-2: 点击进来时一屏直达 — 在用批次 / 冻结中 / 流水汇总
function PointsDetailSection({ detail }: { detail: AdminUserPointsDetail }) {
  const grantSummary = detail.grantSummary ?? [];
  const holdSummary = detail.holdSummary ?? [];
  const grants = detail.grants ?? [];
  const holds = detail.holds ?? [];

  const fmtNum = (v: number | null | undefined) =>
    typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString() : '0';
  const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleString() : '—');

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>积分总览</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>账户余额</div>
            <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {fmtNum(detail.account?.balance)}
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>账户冻结</div>
            <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {fmtNum(detail.account?.frozen)}
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>在用批次</div>
            <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {grants.length}
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>冻结/进行中 Hold</div>
            <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {holds.length}
            </div>
          </div>
        </div>
      </div>

      {grantSummary.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>各类型批次汇总</h3>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>类型</th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>授予合计</th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>可用</th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>冻结</th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>已消耗</th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>已过期</th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>已退回</th>
              </tr>
            </thead>
            <tbody>
              {grantSummary.map((g) => (
                <tr key={g.grantType} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{g.grantType}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{fmtNum(g._sum?.totalAmount)}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--success)' }}>{fmtNum(g._sum?.availableAmount)}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{fmtNum(g._sum?.frozenAmount)}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{fmtNum(g._sum?.consumedAmount)}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{fmtNum(g._sum?.expiredAmount)}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{fmtNum(g._sum?.refundedAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {holdSummary.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>冻结状态汇总</h3>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>状态</th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>条数</th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>预估冻结合计</th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>已确认合计</th>
              </tr>
            </thead>
            <tbody>
              {holdSummary.map((h) => (
                <tr key={h.status} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{h.status}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{h._count?._all ?? 0}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{fmtNum(h._sum?.estimatedAmount)}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{fmtNum(h._sum?.confirmedAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {grants.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>积分批次（按过期时间升序）</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>类型</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>来源</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>授予</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>可用</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>冻结</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>已消耗</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>过期时间</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>usageScope</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((g) => (
                  <tr key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--foreground)' }}>{g.grantType}</td>
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--muted)' }}>{g.source}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{fmtNum(g.totalAmount)}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--success)' }}>{fmtNum(g.availableAmount)}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{fmtNum(g.frozenAmount)}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{fmtNum(g.consumedAmount)}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{fmtDate(g.expiresAt)}</td>
                    <td className="px-3 py-2 font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                      {g.usageScope ? JSON.stringify(g.usageScope) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {holds.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>冻结/进行中 Holds</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>Hold ID</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>状态</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>任务类型</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>预估</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>已确认</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {holds.map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--foreground)' }}>{h.id.slice(0, 8)}…</td>
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--foreground)' }}>{h.status}</td>
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--muted)' }}>{h.taskType ?? '—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{fmtNum(h.estimatedAmount)}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{fmtNum(h.confirmedAmount)}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{fmtDate(h.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
