'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@autix/shared-ui/ui';
import { ChevronLeft, Gift, Pencil, Plus, RefreshCw, X } from 'lucide-react';
import {
  membershipAdminApi,
  type Campaign,
  type CampaignReward,
  type CampaignStatus,
  type CampaignType,
  type UpsertCampaignInput,
} from '@/lib/api';

type CampaignForm = {
  id?: string;
  code: string;
  name: string;
  description: string;
  type: CampaignType;
  status: CampaignStatus;
  startsAt: string;
  endsAt: string;
  dailyBudget: string;
  totalBudget: string;
  perUserDailyCap: string;
  perUserTotalCap: string;
  rewardPoints: string;
  rewardExpiresInDays: string;
  blockSeedance: boolean;
};

const EMPTY_FORM: CampaignForm = {
  code: '',
  name: '',
  description: '',
  type: 'CONTINUOUS_USE',
  status: 'DRAFT',
  startsAt: '',
  endsAt: '',
  dailyBudget: '',
  totalBudget: '',
  perUserDailyCap: '',
  perUserTotalCap: '',
  rewardPoints: '100',
  rewardExpiresInDays: '7',
  blockSeedance: true,
};

function rewardPoints(expression: unknown) {
  if (typeof expression === 'number') return expression;
  if (typeof expression === 'string') return Number(expression) || 0;
  if (expression && typeof expression === 'object') {
    const obj = expression as Record<string, unknown>;
    return Number(obj.fixed ?? obj.amount ?? obj.points ?? 0) || 0;
  }
  return 0;
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function toLocalInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formFromCampaign(campaign: Campaign): CampaignForm {
  const scope = campaign.rewardUsageScope ?? {};
  const prefixes = Array.isArray(scope.excludedTaskPrefixes) ? scope.excludedTaskPrefixes : [];
  return {
    id: campaign.id,
    code: campaign.code,
    name: campaign.name,
    description: campaign.description ?? '',
    type: campaign.type,
    status: campaign.status,
    startsAt: toLocalInput(campaign.startsAt),
    endsAt: toLocalInput(campaign.endsAt),
    dailyBudget: campaign.dailyBudget?.toString() ?? '',
    totalBudget: campaign.totalBudget?.toString() ?? '',
    perUserDailyCap: campaign.perUserDailyCap?.toString() ?? '',
    perUserTotalCap: campaign.perUserTotalCap?.toString() ?? '',
    rewardPoints: String(rewardPoints(campaign.rewardPointsExpression)),
    rewardExpiresInDays: String(campaign.rewardExpiresInDays ?? 7),
    blockSeedance: prefixes.includes('seedance_'),
  };
}

function payloadFromForm(form: CampaignForm): UpsertCampaignInput {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim() || null,
    type: form.type,
    status: form.status,
    startsAt: fromLocalInput(form.startsAt),
    endsAt: fromLocalInput(form.endsAt),
    dailyBudget: optionalNumber(form.dailyBudget),
    totalBudget: optionalNumber(form.totalBudget),
    perUserDailyCap: optionalNumber(form.perUserDailyCap),
    perUserTotalCap: optionalNumber(form.perUserTotalCap),
    rewardPoints: optionalNumber(form.rewardPoints) ?? 0,
    rewardExpiresInDays: optionalNumber(form.rewardExpiresInDays) ?? 7,
    rewardUsageScope: form.blockSeedance ? { excludedTaskPrefixes: ['seedance_'] } : null,
  };
}

export default function AdminCampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; form: CampaignForm } | null>(null);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [rewards, setRewards] = useState<CampaignReward[]>([]);
  const [manualUserId, setManualUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await membershipAdminApi.getCampaigns();
      const list = Array.isArray(res.data) ? res.data : [];
      setCampaigns(list);
      setSelected((cur) => (cur ? list.find((item) => item.id === cur.id) ?? list[0] ?? null : list[0] ?? null));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? '加载活动失败');
    } finally {
      setLoading(false);
    }
  };

  const loadRewards = async (campaignId: string) => {
    const res = await membershipAdminApi.getCampaignRewards(campaignId, { take: 80 });
    setRewards(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selected) void loadRewards(selected.id);
    else setRewards([]);
  }, [selected?.id]);

  const totals = useMemo(() => {
    const active = campaigns.filter((item) => item.status === 'ACTIVE').length;
    const used = campaigns.reduce((sum, item) => sum + (item.usedBudget ?? 0), 0);
    const rewardsCount = campaigns.reduce((sum, item) => sum + (item._count?.rewards ?? 0), 0);
    return { active, used, rewardsCount };
  }, [campaigns]);

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      const payload = payloadFromForm(modal.form);
      if (modal.mode === 'create') {
        await membershipAdminApi.createCampaign(payload);
      } else if (modal.form.id) {
        await membershipAdminApi.updateCampaign(modal.form.id, payload);
      }
      setModal(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? '保存活动失败');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (campaign: Campaign, status: CampaignStatus) => {
    await membershipAdminApi.updateCampaign(campaign.id, { status });
    await load();
  };

  const grantOnce = async () => {
    if (!selected || !manualUserId.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await membershipAdminApi.grantCampaignOnce(selected.id, { userId: manualUserId.trim() });
      setManualUserId('');
      await Promise.all([load(), loadRewards(selected.id)]);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? '手动补发失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => router.push('/admin')}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          返回
        </Button>
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>活动奖励配置</h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {campaigns.length} 个活动 · {totals.active} 个启用 · 已发放 {totals.used} 积分
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button size="sm" className="cursor-pointer" onClick={() => setModal({ mode: 'create', form: { ...EMPTY_FORM } })}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            新建活动
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_420px]">
        <div className="min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>加载中...</div>
          ) : campaigns.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>暂无活动</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>活动</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>类型</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--muted)' }}>奖励</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--muted)' }}>预算</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>状态</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--muted)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    onClick={() => setSelected(campaign)}
                    className="cursor-pointer"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: selected?.id === campaign.id ? 'var(--surface)' : 'transparent',
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: 'var(--foreground)' }}>{campaign.name}</div>
                      <div className="mt-0.5 font-mono text-xs" style={{ color: 'var(--muted)' }}>{campaign.code}</div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{campaign.type}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--foreground)' }}>
                      {rewardPoints(campaign.rewardPointsExpression)} 积分
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--muted)' }}>
                      {campaign.usedBudget}/{campaign.totalBudget ?? '不限'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={campaign.status}
                        className="rounded border px-2 py-1 text-xs"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => void updateStatus(campaign, event.target.value as CampaignStatus)}
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="PAUSED">PAUSED</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="cursor-pointer"
                        onClick={(event) => {
                          event.stopPropagation();
                          setModal({ mode: 'edit', form: formFromCampaign(campaign) });
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="min-h-0 overflow-y-auto p-4" style={{ borderLeft: '1px solid var(--border)' }}>
          {selected ? (
            <>
              <div className="mb-4 rounded-lg p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="mb-2 flex items-center gap-2">
                  <Gift className="h-4 w-4" style={{ color: 'var(--brand)' }} />
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{selected.name}</h2>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  <span>已发放 {selected.usedBudget} 积分</span>
                  <span>记录 {selected._count?.rewards ?? totals.rewardsCount} 条</span>
                  <span>日预算 {selected.dailyBudget ?? '不限'}</span>
                  <span>用户日上限 {selected.perUserDailyCap ?? '不限'}</span>
                  <span>奖励有效期 {selected.rewardExpiresInDays} 天</span>
                  <span>{selected.rewardUsageScope ? '限制高成本视频' : '无用途限制'}</span>
                </div>
              </div>

              <div className="mb-4 rounded-lg p-4" style={{ border: '1px solid var(--border)' }}>
                <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>手动补发</h3>
                <div className="flex gap-2">
                  <Input
                    value={manualUserId}
                    placeholder="用户 ID"
                    onChange={(event) => setManualUserId(event.target.value)}
                  />
                  <Button size="sm" disabled={saving || !manualUserId.trim()} onClick={() => void grantOnce()}>
                    发放
                  </Button>
                </div>
              </div>

              <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>近期发放记录</h3>
              {rewards.length ? (
                <div className="space-y-2">
                  {rewards.map((reward) => (
                    <div key={reward.id} className="rounded-lg p-3 text-xs" style={{ border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono" style={{ color: 'var(--foreground)' }}>{reward.userId}</span>
                        <strong style={{ color: 'var(--success)' }}>+{reward.pointsGranted}</strong>
                      </div>
                      <div className="mt-1" style={{ color: 'var(--muted)' }}>
                        {new Date(reward.grantedAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg p-4 text-sm" style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}>暂无发放记录</p>
              )}
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>选择一个活动查看记录。</p>
          )}
        </aside>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} />
          <div
            className="relative max-h-[90vh] w-[560px] max-w-[92vw] overflow-y-auto rounded-lg p-5"
            style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {modal.mode === 'create' ? '新建活动' : '编辑活动'}
              </h3>
              <button className="cursor-pointer" onClick={() => setModal(null)}>
                <X className="h-4 w-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                Code
                <Input className="mt-1" value={modal.form.code} onChange={(e) => setModal({ ...modal, form: { ...modal.form, code: e.target.value } })} />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                名称
                <Input className="mt-1" value={modal.form.name} onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })} />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                类型
                <select className="mt-1 h-9 w-full rounded border px-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} value={modal.form.type} onChange={(e) => setModal({ ...modal, form: { ...modal.form, type: e.target.value as CampaignType } })}>
                  <option value="CONTINUOUS_USE">连续使用</option>
                  <option value="INVITATION">邀请返利</option>
                  <option value="FEEDBACK">评价反馈</option>
                  <option value="CUSTOM">运营赠送</option>
                </select>
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                状态
                <select className="mt-1 h-9 w-full rounded border px-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} value={modal.form.status} onChange={(e) => setModal({ ...modal, form: { ...modal.form, status: e.target.value as CampaignStatus } })}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </label>
              <label className="text-xs md:col-span-2" style={{ color: 'var(--muted)' }}>
                描述
                <Input className="mt-1" value={modal.form.description} onChange={(e) => setModal({ ...modal, form: { ...modal.form, description: e.target.value } })} />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                开始时间
                <Input className="mt-1" type="datetime-local" value={modal.form.startsAt} onChange={(e) => setModal({ ...modal, form: { ...modal.form, startsAt: e.target.value } })} />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                结束时间
                <Input className="mt-1" type="datetime-local" value={modal.form.endsAt} onChange={(e) => setModal({ ...modal, form: { ...modal.form, endsAt: e.target.value } })} />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                奖励积分
                <Input className="mt-1" type="number" value={modal.form.rewardPoints} onChange={(e) => setModal({ ...modal, form: { ...modal.form, rewardPoints: e.target.value } })} />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                奖励有效期天数
                <Input className="mt-1" type="number" value={modal.form.rewardExpiresInDays} onChange={(e) => setModal({ ...modal, form: { ...modal.form, rewardExpiresInDays: e.target.value } })} />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                今日预算
                <Input className="mt-1" type="number" value={modal.form.dailyBudget} onChange={(e) => setModal({ ...modal, form: { ...modal.form, dailyBudget: e.target.value } })} />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                总预算
                <Input className="mt-1" type="number" value={modal.form.totalBudget} onChange={(e) => setModal({ ...modal, form: { ...modal.form, totalBudget: e.target.value } })} />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                用户日上限
                <Input className="mt-1" type="number" value={modal.form.perUserDailyCap} onChange={(e) => setModal({ ...modal, form: { ...modal.form, perUserDailyCap: e.target.value } })} />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                用户总上限
                <Input className="mt-1" type="number" value={modal.form.perUserTotalCap} onChange={(e) => setModal({ ...modal, form: { ...modal.form, perUserTotalCap: e.target.value } })} />
              </label>
              <label className="flex items-center gap-2 text-xs md:col-span-2" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={modal.form.blockSeedance} onChange={(e) => setModal({ ...modal, form: { ...modal.form, blockSeedance: e.target.checked } })} />
                赠送积分默认不可用于 Seedance 高成本视频
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setModal(null)}>取消</Button>
              <Button size="sm" disabled={saving || !modal.form.code.trim() || !modal.form.name.trim()} onClick={() => void save()}>
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
