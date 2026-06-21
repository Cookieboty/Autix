'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAdminCampaignRewardsQuery,
  useAdminCampaignsQuery,
  useCreateAdminCampaignMutation,
  useGrantAdminCampaignOnceMutation,
  useUpdateAdminCampaignMutation,
  type Campaign,
  type CampaignStatus,
  type CampaignType,
} from '@autix/shared-store';
import {
  CAMPAIGN_REWARDS_PARAMS,
  EMPTY_CAMPAIGNS,
  EMPTY_FORM,
  EMPTY_REWARDS,
  campaignTotals,
  errorMessage,
  formFromCampaign,
  payloadFromForm,
  type CampaignModalState,
} from './campaign-form';
import {
  AdminCampaignsHeader,
  CampaignDetailPanel,
  CampaignModal,
  CampaignsTable,
} from './campaigns-view-parts';

export interface AdminCampaignsViewProps {
  onBack?: () => void;
}

export function AdminCampaignsView({ onBack }: AdminCampaignsViewProps) {
  const t = useTranslations('adminCampaigns');
  const tCommon = useTranslations('common');
  const [modal, setModal] = useState<CampaignModalState | null>(null);
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

  const totals = useMemo(() => campaignTotals(campaigns), [campaigns]);

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
      <AdminCampaignsHeader
        active={totals.active}
        campaignsCount={campaigns.length}
        loading={loading}
        onBack={onBack}
        onCreate={() => setModal({ mode: 'create', form: { ...EMPTY_FORM } })}
        onRefresh={() => {
          setError(null);
          void refetch();
        }}
        t={t}
        tCommon={tCommon}
        used={totals.used}
      />

      {currentError && (
        <div className="px-4 py-2 text-xs" style={{ color: 'var(--danger)' }}>
          {currentError}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_420px]">
        <div className="min-h-0 overflow-y-auto">
          <CampaignsTable
            campaigns={campaigns}
            campaignStatusLabel={campaignStatusLabel}
            campaignTypeLabel={campaignTypeLabel}
            loading={loading}
            onEdit={(campaign) => setModal({ mode: 'edit', form: formFromCampaign(campaign) })}
            onSelect={setSelected}
            onStatusChange={(campaign, status) => void updateStatus(campaign, status)}
            selectedId={selected?.id}
            t={t}
            tCommon={tCommon}
          />
        </div>

        <aside className="min-h-0 overflow-y-auto p-4" style={{ borderLeft: '1px solid var(--border)' }}>
          <CampaignDetailPanel
            manualUserId={manualUserId}
            onGrantOnce={() => void grantOnce()}
            onManualUserIdChange={setManualUserId}
            rewards={rewards}
            rewardsCount={totals.rewardsCount}
            saving={saving}
            selected={selected}
            t={t}
          />
        </aside>
      </div>

      {modal && (
        <CampaignModal
          campaignStatusLabel={campaignStatusLabel}
          campaignTypeLabel={campaignTypeLabel}
          modal={modal}
          onChange={(form) => setModal({ ...modal, form })}
          onClose={() => setModal(null)}
          onSave={() => void save()}
          saving={saving}
          t={t}
          tCommon={tCommon}
        />
      )}
    </div>
  );
}
