'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Gift, Pencil, Plus, RefreshCw, X } from 'lucide-react';
import {
  useAdminCampaignRewardsQuery,
  useAdminCampaignsQuery,
  useCreateAdminCampaignMutation,
  useGrantAdminCampaignOnceMutation,
  useUpdateAdminCampaignMutation,
  type Campaign,
  type CampaignReward,
  type CampaignStatus,
  type CampaignType,
  type UpsertCampaignInput,
} from '@autix/shared-store';
import { Button, Input } from '../../ui';

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

const EMPTY_CAMPAIGNS: Campaign[] = [];
const EMPTY_REWARDS: CampaignReward[] = [];
const CAMPAIGN_REWARDS_PARAMS = { take: 80 };

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

function errorMessage(error: unknown, fallback: string) {
  const responseMessage = (error as { response?: { data?: { message?: unknown } } })
    .response?.data?.message;
  if (typeof responseMessage === 'string') return responseMessage;

  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : fallback;
}

export interface AdminCampaignsViewProps {
  onBack?: () => void;
}

export function AdminCampaignsView({ onBack }: AdminCampaignsViewProps) {
  const t = useTranslations('adminCampaigns');
  const tCommon = useTranslations('common');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; form: CampaignForm } | null>(null);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [manualUserId, setManualUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    data: campaigns = EMPTY_CAMPAIGNS,
    error: campaignsError,
    isFetching: loading,
    refetch,
  } = useAdminCampaignsQuery();
  const { data: rewards = EMPTY_REWARDS } = useAdminCampaignRewardsQuery(
    selected?.id ?? '',
    CAMPAIGN_REWARDS_PARAMS,
    Boolean(selected),
  );
  const createCampaignMutation = useCreateAdminCampaignMutation();
  const updateCampaignMutation = useUpdateAdminCampaignMutation();
  const grantCampaignOnceMutation = useGrantAdminCampaignOnceMutation();

  useEffect(() => {
    setSelected((cur) => {
      if (!campaigns.length) return null;
      if (!cur) return campaigns[0];
      return campaigns.find((item) => item.id === cur.id) ?? campaigns[0];
    });
  }, [campaigns]);

  const saving =
    createCampaignMutation.isPending ||
    updateCampaignMutation.isPending ||
    grantCampaignOnceMutation.isPending;
  const currentError =
    error ?? (campaignsError ? errorMessage(campaignsError, t('loadFailed')) : null);

  const totals = useMemo(() => {
    const active = campaigns.filter((item) => item.status === 'ACTIVE').length;
    const used = campaigns.reduce((sum, item) => sum + (item.usedBudget ?? 0), 0);
    const rewardsCount = campaigns.reduce((sum, item) => sum + (item._count?.rewards ?? 0), 0);
    return { active, used, rewardsCount };
  }, [campaigns]);

  const campaignTypeLabel = (type: CampaignType) => t(`type.${type}`);
  const campaignStatusLabel = (status: CampaignStatus) => t(`status.${status}`);

  const save = async () => {
    if (!modal) return;
    setError(null);
    try {
      const payload = payloadFromForm(modal.form);
      if (modal.mode === 'create') {
        await createCampaignMutation.mutateAsync(payload);
      } else if (modal.form.id) {
        await updateCampaignMutation.mutateAsync({ id: modal.form.id, data: payload });
      }
      setModal(null);
    } catch (saveError) {
      setError(errorMessage(saveError, t('saveFailed')));
    }
  };

  const updateStatus = async (campaign: Campaign, status: CampaignStatus) => {
    setError(null);
    try {
      await updateCampaignMutation.mutateAsync({
        id: campaign.id,
        data: { status },
      });
    } catch (saveError) {
      setError(errorMessage(saveError, t('saveFailed')));
    }
  };

  const grantOnce = async () => {
    if (!selected || !manualUserId.trim()) return;
    setError(null);
    try {
      await grantCampaignOnceMutation.mutateAsync({
        campaignId: selected.id,
        userId: manualUserId.trim(),
      });
      setManualUserId('');
    } catch (grantError) {
      setError(errorMessage(grantError, t('manualGrantFailed')));
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          {tCommon('back')}
        </Button>
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('title')}
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('summary', { count: campaigns.length, active: totals.active, used: totals.used })}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => {
              setError(null);
              void refetch();
            }}
          >
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {tCommon('refresh')}
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            onClick={() => setModal({ mode: 'create', form: { ...EMPTY_FORM } })}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('createCampaign')}
          </Button>
        </div>
      </div>

      {currentError && (
        <div className="px-4 py-2 text-xs" style={{ color: 'var(--danger)' }}>
          {currentError}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_420px]">
        <div className="min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>
              {tCommon('loading')}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>
              {t('empty')}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>
                    {t('campaign')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>
                    {t('typeLabel')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--muted)' }}>
                    {t('reward')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--muted)' }}>
                    {t('budget')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>
                    {t('statusLabel')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--muted)' }}>
                    {t('operations')}
                  </th>
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
                      <div className="font-medium" style={{ color: 'var(--foreground)' }}>
                        {campaign.name}
                      </div>
                      <div className="mt-0.5 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                        {campaign.code}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                      {campaignTypeLabel(campaign.type)}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--foreground)' }}>
                      {t('pointsValue', { points: rewardPoints(campaign.rewardPointsExpression) })}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--muted)' }}>
                      {campaign.usedBudget}/{campaign.totalBudget ?? t('unlimited')}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={campaign.status}
                        className="rounded border px-2 py-1 text-xs"
                        style={{
                          borderColor: 'var(--border)',
                          backgroundColor: 'var(--surface)',
                          color: 'var(--foreground)',
                        }}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => void updateStatus(campaign, event.target.value as CampaignStatus)}
                      >
                        <option value="DRAFT">{campaignStatusLabel('DRAFT')}</option>
                        <option value="ACTIVE">{campaignStatusLabel('ACTIVE')}</option>
                        <option value="PAUSED">{campaignStatusLabel('PAUSED')}</option>
                        <option value="ARCHIVED">{campaignStatusLabel('ARCHIVED')}</option>
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
              <div
                className="mb-4 rounded-lg p-4"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Gift className="h-4 w-4" style={{ color: 'var(--brand)' }} />
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {selected.name}
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  <span>{t('issuedPoints', { points: selected.usedBudget })}</span>
                  <span>{t('recordsCount', { count: selected._count?.rewards ?? totals.rewardsCount })}</span>
                  <span>{t('dailyBudgetValue', { value: selected.dailyBudget ?? t('unlimited') })}</span>
                  <span>{t('userDailyCapValue', { value: selected.perUserDailyCap ?? t('unlimited') })}</span>
                  <span>{t('rewardValidityValue', { days: selected.rewardExpiresInDays })}</span>
                  <span>{selected.rewardUsageScope ? t('limitedHighCostVideo') : t('noUsageLimit')}</span>
                </div>
              </div>

              <div className="mb-4 rounded-lg p-4" style={{ border: '1px solid var(--border)' }}>
                <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {t('manualGrant')}
                </h3>
                <div className="flex gap-2">
                  <Input
                    value={manualUserId}
                    placeholder={t('userIdPlaceholder')}
                    onChange={(event) => setManualUserId(event.target.value)}
                  />
                  <Button size="sm" disabled={saving || !manualUserId.trim()} onClick={() => void grantOnce()}>
                    {t('grant')}
                  </Button>
                </div>
              </div>

              <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {t('recentRewards')}
              </h3>
              {rewards.length ? (
                <div className="space-y-2">
                  {rewards.map((reward) => (
                    <div key={reward.id} className="rounded-lg p-3 text-xs" style={{ border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono" style={{ color: 'var(--foreground)' }}>
                          {reward.userId}
                        </span>
                        <strong style={{ color: 'var(--success)' }}>+{reward.pointsGranted}</strong>
                      </div>
                      <div className="mt-1" style={{ color: 'var(--muted)' }}>
                        {new Date(reward.grantedAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg p-4 text-sm" style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}>
                  {t('noRewards')}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {t('selectHint')}
            </p>
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
                {modal.mode === 'create' ? t('createCampaign') : t('editCampaign')}
              </h3>
              <button type="button" className="cursor-pointer" onClick={() => setModal(null)}>
                <X className="h-4 w-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('code')}
                <Input
                  className="mt-1"
                  value={modal.form.code}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, code: e.target.value } })}
                />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('name')}
                <Input
                  className="mt-1"
                  value={modal.form.name}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })}
                />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('typeLabel')}
                <select
                  className="mt-1 h-9 w-full rounded border px-2"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--foreground)',
                  }}
                  value={modal.form.type}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, type: e.target.value as CampaignType } })}
                >
                  <option value="CONTINUOUS_USE">{campaignTypeLabel('CONTINUOUS_USE')}</option>
                  <option value="INVITATION">{campaignTypeLabel('INVITATION')}</option>
                  <option value="FEEDBACK">{campaignTypeLabel('FEEDBACK')}</option>
                  <option value="CUSTOM">{campaignTypeLabel('CUSTOM')}</option>
                </select>
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('statusLabel')}
                <select
                  className="mt-1 h-9 w-full rounded border px-2"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--foreground)',
                  }}
                  value={modal.form.status}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, status: e.target.value as CampaignStatus } })}
                >
                  <option value="DRAFT">{campaignStatusLabel('DRAFT')}</option>
                  <option value="ACTIVE">{campaignStatusLabel('ACTIVE')}</option>
                  <option value="PAUSED">{campaignStatusLabel('PAUSED')}</option>
                  <option value="ARCHIVED">{campaignStatusLabel('ARCHIVED')}</option>
                </select>
              </label>
              <label className="text-xs md:col-span-2" style={{ color: 'var(--muted)' }}>
                {t('description')}
                <Input
                  className="mt-1"
                  value={modal.form.description}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, description: e.target.value } })}
                />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('startsAt')}
                <Input
                  className="mt-1"
                  type="datetime-local"
                  value={modal.form.startsAt}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, startsAt: e.target.value } })}
                />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('endsAt')}
                <Input
                  className="mt-1"
                  type="datetime-local"
                  value={modal.form.endsAt}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, endsAt: e.target.value } })}
                />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('rewardPoints')}
                <Input
                  className="mt-1"
                  type="number"
                  value={modal.form.rewardPoints}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, rewardPoints: e.target.value } })}
                />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('rewardExpiresInDays')}
                <Input
                  className="mt-1"
                  type="number"
                  value={modal.form.rewardExpiresInDays}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, rewardExpiresInDays: e.target.value } })}
                />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('dailyBudget')}
                <Input
                  className="mt-1"
                  type="number"
                  value={modal.form.dailyBudget}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, dailyBudget: e.target.value } })}
                />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('totalBudget')}
                <Input
                  className="mt-1"
                  type="number"
                  value={modal.form.totalBudget}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, totalBudget: e.target.value } })}
                />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('perUserDailyCap')}
                <Input
                  className="mt-1"
                  type="number"
                  value={modal.form.perUserDailyCap}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, perUserDailyCap: e.target.value } })}
                />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('perUserTotalCap')}
                <Input
                  className="mt-1"
                  type="number"
                  value={modal.form.perUserTotalCap}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, perUserTotalCap: e.target.value } })}
                />
              </label>
              <label className="flex items-center gap-2 text-xs md:col-span-2" style={{ color: 'var(--muted)' }}>
                <input
                  type="checkbox"
                  checked={modal.form.blockSeedance}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, blockSeedance: e.target.checked } })}
                />
                {t('blockSeedance')}
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
                {tCommon('cancel')}
              </Button>
              <Button
                size="sm"
                disabled={saving || !modal.form.code.trim() || !modal.form.name.trim()}
                onClick={() => void save()}
              >
                {tCommon('save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
