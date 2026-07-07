import type {
  Campaign,
  CampaignReward,
  CampaignStatus,
  CampaignType,
  UpsertCampaignInput,
} from '@autix/shared-store';

export type CampaignForm = {
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

export type CampaignModalState = {
  mode: 'create' | 'edit';
  form: CampaignForm;
};

export const EMPTY_FORM: CampaignForm = {
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

export const EMPTY_CAMPAIGNS: Campaign[] = [];
export const EMPTY_REWARDS: CampaignReward[] = [];
export const CAMPAIGN_REWARDS_PARAMS = { take: 80 };
export const BUILTIN_CAMPAIGN_CODES = [
  'INVITATION_REWARD',
  'REGISTRATION_BONUS',
  'HOME_QUEST_NANO_BANANA_PRO',
  'HOME_QUEST_SEEDANCE',
  'HOME_QUEST_MARKETING',
] as const;

export function isBuiltinCampaignCode(code?: string | null) {
  const normalized = String(code ?? '').trim();
  return (
    BUILTIN_CAMPAIGN_CODES.includes(normalized as (typeof BUILTIN_CAMPAIGN_CODES)[number]) ||
    normalized.startsWith('HOME_QUEST_')
  );
}

export function isFixedCampaign(campaign: Pick<Campaign, 'code' | 'metadata'>) {
  const metadata = campaign.metadata;
  const metadataRecord =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata as Record<string, unknown>
      : null;
  return (
    isBuiltinCampaignCode(campaign.code) ||
    metadataRecord?.fixed === true ||
    metadataRecord?.builtin === true
  );
}

export function rewardPoints(expression: unknown) {
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

export function formFromCampaign(campaign: Campaign): CampaignForm {
  const scope = campaign.rewardUsageScope ?? {};
  const taskTypes = Array.isArray(scope.excludedTaskTypes) ? scope.excludedTaskTypes : [];
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
    blockSeedance: taskTypes.includes('video_generation'),
  };
}

export function payloadFromForm(form: CampaignForm): UpsertCampaignInput {
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
    rewardUsageScope: form.blockSeedance ? { excludedTaskTypes: ['video_generation'] } : null,
  };
}

export function campaignTotals(campaigns: Campaign[]) {
  const active = campaigns.filter((item) => item.status === 'ACTIVE').length;
  const used = campaigns.reduce((sum, item) => sum + (item.usedBudget ?? 0), 0);
  const rewardsCount = campaigns.reduce((sum, item) => sum + (item._count?.rewards ?? 0), 0);
  return { active, used, rewardsCount };
}

export function errorMessage(error: unknown, fallback: string) {
  const responseMessage = (error as { response?: { data?: { message?: unknown } } })
    .response?.data?.message;
  if (typeof responseMessage === 'string') return responseMessage;

  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : fallback;
}
