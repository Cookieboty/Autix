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
  buildRegistrationBonusCreateForm,
  campaignTotals,
  errorMessage,
  formFromCampaign,
  isFixedCampaign,
  payloadFromForm,
  type CampaignModalState,
} from './campaign-form';
import {
  AdminCampaignsHeader,
  CampaignDetailPanel,
  CampaignModal,
  CampaignsTable,
  RegistrationBonusCard,
} from './campaigns-view-parts';
import { AdminPaginationFooter, useClientPagination } from '../layout';

const REGISTRATION_BONUS_CODE = 'REGISTRATION_BONUS';
// Stable, locale-independent default name for the built-in registration bonus.
// Admins can rename it afterwards; we must not bake the creating admin's UI
// language into the persisted campaign name.
const REGISTRATION_BONUS_NAME = 'Registration Bonus';

export type AdminCampaignsViewProps = Record<string, never>;

export function AdminCampaignsView() {
  const t = useTranslations('adminCampaigns');
  const tCommon = useTranslations('common');
  const [modal, setModal] = useState<CampaignModalState | null>(null);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [campaignScope, setCampaignScope] = useState<'fixed' | 'dynamic'>('fixed');
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

  const saving =
    createCampaignMutation.isPending ||
    updateCampaignMutation.isPending ||
    grantCampaignOnceMutation.isPending;
  const currentError =
    error ?? (campaignsError ? errorMessage(campaignsError, t('loadFailed')) : null);

  const totals = useMemo(() => campaignTotals(campaigns), [campaigns]);
  const fixedCampaigns = useMemo(
    // The registration bonus has its own dedicated card above the table, so
    // exclude it here to avoid showing (and counting) it twice.
    () =>
      campaigns.filter(
        (campaign) =>
          isFixedCampaign(campaign) && campaign.code !== REGISTRATION_BONUS_CODE,
      ),
    [campaigns],
  );
  const dynamicCampaigns = useMemo(
    () => campaigns.filter((campaign) => !isFixedCampaign(campaign)),
    [campaigns],
  );
  const visibleCampaigns = campaignScope === 'fixed' ? fixedCampaigns : dynamicCampaigns;
  const {
    items: pagedCampaigns,
    page: campaignsPage,
    setPage: setCampaignsPage,
    pageSize: campaignsPageSize,
    total: campaignsTotal,
  } = useClientPagination(visibleCampaigns, 20, campaignScope);
  const fixedCampaignIds = useMemo(
    () => new Set(fixedCampaigns.map((campaign) => campaign.id)),
    [fixedCampaigns],
  );
  const modalCampaign = modal?.form.id
    ? campaigns.find((campaign) => campaign.id === modal.form.id) ?? null
    : null;
  const modalFixedCampaign = Boolean(modalCampaign && isFixedCampaign(modalCampaign));

  useEffect(() => {
    setSelected((cur) => {
      if (!visibleCampaigns.length) return null;
      if (!cur) return visibleCampaigns[0];
      return visibleCampaigns.find((item) => item.id === cur.id) ?? visibleCampaigns[0];
    });
  }, [visibleCampaigns]);

  const campaignTypeLabel = (type: CampaignType) => t(`type.${type}`);
  const campaignStatusLabel = (status: CampaignStatus) => t(`status.${status}`);

  const save = async () => {
    if (!modal) return;
    setError(null);
    try {
      const payload = payloadFromForm(modal.form);
      if (modalFixedCampaign) {
        delete payload.code;
        delete payload.type;
      }
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

  const saveRewardPoints = async (campaign: Campaign, points: number) => {
    setError(null);
    try {
      await updateCampaignMutation.mutateAsync({
        id: campaign.id,
        data: { rewardPoints: points },
      });
    } catch (saveError) {
      setError(errorMessage(saveError, t('saveFailed')));
    }
  };

  const openRegistrationBonusCreate = () => {
    setModal({
      mode: 'create',
      form: buildRegistrationBonusCreateForm(
        REGISTRATION_BONUS_CODE,
        REGISTRATION_BONUS_NAME,
      ),
    });
  };

  const registrationBonus =
    campaigns.find((campaign) => campaign.code === REGISTRATION_BONUS_CODE) ?? null;

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

      <RegistrationBonusCard
        campaign={registrationBonus}
        onCreate={openRegistrationBonusCreate}
        onEdit={(campaign) =>
          setModal({ mode: 'edit', form: formFromCampaign(campaign) })
        }
        onSaveRewardPoints={(campaign, points) =>
          void saveRewardPoints(campaign, points)
        }
        onToggleStatus={(campaign, status) => void updateStatus(campaign, status)}
        saving={saving}
        t={t}
        tCommon={tCommon}
      />

      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-sm"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: campaignScope === 'fixed' ? 'var(--surface)' : 'transparent',
            color: campaignScope === 'fixed' ? 'var(--foreground)' : 'var(--muted)',
          }}
          onClick={() => setCampaignScope('fixed')}
        >
          {t('fixedActivities', { count: fixedCampaigns.length })}
        </button>
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-sm"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: campaignScope === 'dynamic' ? 'var(--surface)' : 'transparent',
            color: campaignScope === 'dynamic' ? 'var(--foreground)' : 'var(--muted)',
          }}
          onClick={() => setCampaignScope('dynamic')}
        >
          {t('dynamicActivities', { count: dynamicCampaigns.length })}
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_420px]">
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CampaignsTable
              campaigns={pagedCampaigns}
              campaignStatusLabel={campaignStatusLabel}
              campaignTypeLabel={campaignTypeLabel}
              fixedCampaignIds={fixedCampaignIds}
              loading={loading}
              onEdit={(campaign) => setModal({ mode: 'edit', form: formFromCampaign(campaign) })}
              onSelect={setSelected}
              onStatusChange={(campaign, status) => void updateStatus(campaign, status)}
              selectedId={selected?.id}
              t={t}
              tCommon={tCommon}
            />
          </div>
          <AdminPaginationFooter
            page={campaignsPage}
            pageSize={campaignsPageSize}
            total={campaignsTotal}
            onPageChange={setCampaignsPage}
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
          fixedCampaign={modalFixedCampaign}
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
