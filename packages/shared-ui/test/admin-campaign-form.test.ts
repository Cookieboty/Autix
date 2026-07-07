import { describe, expect, test } from 'bun:test';
import type { Campaign } from '@autix/shared-store';
import {
  campaignTotals,
  formFromCampaign,
  isFixedCampaign,
  payloadFromForm,
  rewardPoints,
} from '../src/admin/campaigns/campaign-form';

function campaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'campaign-1',
    code: 'daily-use',
    name: 'Daily use',
    description: null,
    type: 'CONTINUOUS_USE',
    status: 'ACTIVE',
    startsAt: null,
    endsAt: null,
    dailyBudget: null,
    totalBudget: 1000,
    usedBudget: 120,
    perUserDailyCap: null,
    perUserTotalCap: 500,
    rewardGrantType: 'GIFT',
    rewardSourceEvent: 'manual',
    rewardPointsExpression: { fixed: 100 },
    rewardExpiresInDays: 7,
    rewardUsageScope: { excludedTaskTypes: ['video_generation'] },
    eligibility: null,
    metadata: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: { rewards: 2 },
    ...overrides,
  };
}

describe('admin campaign form helpers', () => {
  test('reads reward points from supported expressions', () => {
    expect(rewardPoints(12)).toBe(12);
    expect(rewardPoints('15')).toBe(15);
    expect(rewardPoints({ amount: 30 })).toBe(30);
    expect(rewardPoints({ points: 40 })).toBe(40);
    expect(rewardPoints({ fixed: 50 })).toBe(50);
    expect(rewardPoints(null)).toBe(0);
  });

  test('maps campaigns to editable form values without changing limits', () => {
    expect(formFromCampaign(campaign())).toMatchObject({
      id: 'campaign-1',
      code: 'daily-use',
      name: 'Daily use',
      description: '',
      dailyBudget: '',
      totalBudget: '1000',
      perUserTotalCap: '500',
      rewardPoints: '100',
      rewardExpiresInDays: '7',
      blockSeedance: true,
    });
  });

  test('sanitizes form payloads using existing campaign semantics', () => {
    const form = formFromCampaign(campaign());

    expect(
      payloadFromForm({
        ...form,
        code: ' daily-use ',
        name: ' Daily use ',
        description: ' ',
        rewardPoints: '99.8',
        dailyBudget: '-5',
        totalBudget: '',
        blockSeedance: false,
      }),
    ).toMatchObject({
      code: 'daily-use',
      name: 'Daily use',
      description: null,
      rewardPoints: 99,
      dailyBudget: 0,
      totalBudget: null,
      rewardUsageScope: null,
    });
  });

  test('summarizes campaign totals for the header', () => {
    expect(
      campaignTotals([
        campaign(),
        campaign({ id: 'campaign-2', status: 'DRAFT', usedBudget: 5, _count: { rewards: 3 } }),
      ]),
    ).toEqual({ active: 1, used: 125, rewardsCount: 5 });
  });

  test('detects fixed built-in campaigns by code or metadata', () => {
    expect(isFixedCampaign(campaign({ code: 'INVITATION_REWARD' }))).toBe(true);
    expect(isFixedCampaign(campaign({ code: 'HOME_QUEST_CUSTOM_MODEL' }))).toBe(true);
    expect(isFixedCampaign(campaign({ code: 'custom', metadata: { fixed: true } }))).toBe(true);
    expect(isFixedCampaign(campaign({ code: 'custom', metadata: { builtin: true } }))).toBe(true);
    expect(isFixedCampaign(campaign({ code: 'custom', metadata: null }))).toBe(false);
  });
});
