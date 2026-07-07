import { ChevronLeft, Gift, Pencil, Plus, RefreshCw, X } from 'lucide-react';
import type {
  Campaign,
  CampaignReward,
  CampaignStatus,
  CampaignType,
} from '@autix/shared-store';
import { Button, Input } from '../../ui';
import type { CampaignForm, CampaignModalState } from './campaign-form';
import { rewardPoints } from './campaign-form';

type TranslateValues = Record<string, string | number | Date>;
type Translate = (key: string, values?: TranslateValues) => string;
type CommonTranslate = (key: string) => string;

type LabelFor<T extends string> = (value: T) => string;

export function AdminCampaignsHeader({
  active,
  campaignsCount,
  loading,
  onBack,
  onCreate,
  onRefresh,
  t,
  tCommon,
  used,
}: {
  active: number;
  campaignsCount: number;
  loading: boolean;
  onBack?: () => void;
  onCreate: () => void;
  onRefresh: () => void;
  t: Translate;
  tCommon: CommonTranslate;
  used: number;
}) {
  return (
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
          {t('summary', { count: campaignsCount, active, used })}
        </p>
      </div>
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" disabled={loading} onClick={onRefresh}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {tCommon('refresh')}
        </Button>
        <Button size="sm" className="cursor-pointer" onClick={onCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('createCampaign')}
        </Button>
      </div>
    </div>
  );
}

export function CampaignsTable({
  campaigns,
  campaignStatusLabel,
  campaignTypeLabel,
  fixedCampaignIds,
  loading,
  onEdit,
  onSelect,
  onStatusChange,
  selectedId,
  t,
  tCommon,
}: {
  campaigns: Campaign[];
  campaignStatusLabel: LabelFor<CampaignStatus>;
  campaignTypeLabel: LabelFor<CampaignType>;
  fixedCampaignIds: Set<string>;
  loading: boolean;
  onEdit: (campaign: Campaign) => void;
  onSelect: (campaign: Campaign) => void;
  onStatusChange: (campaign: Campaign, status: CampaignStatus) => void;
  selectedId?: string;
  t: Translate;
  tCommon: CommonTranslate;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>
        {tCommon('loading')}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>
        {t('empty')}
      </div>
    );
  }

  return (
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
            onClick={() => onSelect(campaign)}
            className="cursor-pointer"
            style={{
              borderBottom: '1px solid var(--border)',
              backgroundColor: selectedId === campaign.id ? 'var(--surface)' : 'transparent',
            }}
          >
            <td className="px-4 py-3">
              <div className="font-medium" style={{ color: 'var(--foreground)' }}>
                {campaign.name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  {campaign.code}
                </span>
                <span
                  className="rounded border px-1.5 py-0.5 text-[11px]"
                  style={{
                    borderColor: 'var(--border)',
                    color: fixedCampaignIds.has(campaign.id) ? 'var(--brand)' : 'var(--muted)',
                  }}
                >
                  {fixedCampaignIds.has(campaign.id) ? t('fixedActivity') : t('dynamicActivity')}
                </span>
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
                onChange={(event) => onStatusChange(campaign, event.target.value as CampaignStatus)}
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
                  onEdit(campaign);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CampaignDetailPanel({
  manualUserId,
  onGrantOnce,
  onManualUserIdChange,
  rewards,
  rewardsCount,
  saving,
  selected,
  t,
}: {
  manualUserId: string;
  onGrantOnce: () => void;
  onManualUserIdChange: (value: string) => void;
  rewards: CampaignReward[];
  rewardsCount: number;
  saving: boolean;
  selected: Campaign | null;
  t: Translate;
}) {
  if (!selected) {
    return (
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        {t('selectHint')}
      </p>
    );
  }

  return (
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
          <span>{t('recordsCount', { count: selected._count?.rewards ?? rewardsCount })}</span>
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
            onChange={(event) => onManualUserIdChange(event.target.value)}
          />
          <Button size="sm" disabled={saving || !manualUserId.trim()} onClick={onGrantOnce}>
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
  );
}

export function CampaignModal({
  campaignStatusLabel,
  campaignTypeLabel,
  fixedCampaign,
  modal,
  onChange,
  onClose,
  onSave,
  saving,
  t,
  tCommon,
}: {
  campaignStatusLabel: LabelFor<CampaignStatus>;
  campaignTypeLabel: LabelFor<CampaignType>;
  fixedCampaign: boolean;
  modal: CampaignModalState;
  onChange: (form: CampaignForm) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  t: Translate;
  tCommon: CommonTranslate;
}) {
  const updateForm = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => {
    onChange({ ...modal.form, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative max-h-[90vh] w-[560px] max-w-[92vw] overflow-y-auto rounded-lg p-5"
        style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {modal.mode === 'create' ? t('createCampaign') : t('editCampaign')}
          </h3>
          <button type="button" className="cursor-pointer" onClick={onClose}>
            <X className="h-4 w-4" style={{ color: 'var(--muted)' }} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('code')}
            <Input
              className="mt-1"
              disabled={fixedCampaign}
              value={modal.form.code}
              onChange={(event) => updateForm('code', event.target.value)}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('name')}
            <Input className="mt-1" value={modal.form.name} onChange={(event) => updateForm('name', event.target.value)} />
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
              disabled={fixedCampaign}
              value={modal.form.type}
              onChange={(event) => updateForm('type', event.target.value as CampaignType)}
            >
              <option value="CONTINUOUS_USE">{campaignTypeLabel('CONTINUOUS_USE')}</option>
              <option value="INVITATION">{campaignTypeLabel('INVITATION')}</option>
              <option value="FEEDBACK">{campaignTypeLabel('FEEDBACK')}</option>
              <option value="REGISTRATION">{campaignTypeLabel('REGISTRATION')}</option>
              <option value="QUEST">{campaignTypeLabel('QUEST')}</option>
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
              onChange={(event) => updateForm('status', event.target.value as CampaignStatus)}
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
              onChange={(event) => updateForm('description', event.target.value)}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('startsAt')}
            <Input
              className="mt-1"
              type="datetime-local"
              value={modal.form.startsAt}
              onChange={(event) => updateForm('startsAt', event.target.value)}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('endsAt')}
            <Input
              className="mt-1"
              type="datetime-local"
              value={modal.form.endsAt}
              onChange={(event) => updateForm('endsAt', event.target.value)}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('rewardPoints')}
            <Input
              className="mt-1"
              type="number"
              value={modal.form.rewardPoints}
              onChange={(event) => updateForm('rewardPoints', event.target.value)}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('rewardExpiresInDays')}
            <Input
              className="mt-1"
              type="number"
              value={modal.form.rewardExpiresInDays}
              onChange={(event) => updateForm('rewardExpiresInDays', event.target.value)}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('dailyBudget')}
            <Input
              className="mt-1"
              type="number"
              value={modal.form.dailyBudget}
              onChange={(event) => updateForm('dailyBudget', event.target.value)}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('totalBudget')}
            <Input
              className="mt-1"
              type="number"
              value={modal.form.totalBudget}
              onChange={(event) => updateForm('totalBudget', event.target.value)}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('perUserDailyCap')}
            <Input
              className="mt-1"
              type="number"
              value={modal.form.perUserDailyCap}
              onChange={(event) => updateForm('perUserDailyCap', event.target.value)}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('perUserTotalCap')}
            <Input
              className="mt-1"
              type="number"
              value={modal.form.perUserTotalCap}
              onChange={(event) => updateForm('perUserTotalCap', event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-xs md:col-span-2" style={{ color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={modal.form.blockSeedance}
              onChange={(event) => updateForm('blockSeedance', event.target.checked)}
            />
            {t('blockSeedance')}
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button
            size="sm"
            disabled={saving || !modal.form.code.trim() || !modal.form.name.trim()}
            onClick={onSave}
          >
            {tCommon('save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
