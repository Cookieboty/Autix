import {
  riskAdminApi,
  type RiskLevel,
  type RiskUserDetail,
  type RiskUserListItem,
  type RiskUserListResult,
} from '@autix/sdk';

export type {
  RiskLevel,
  RiskUserDetail,
  RiskUserListItem,
  RiskUserListResult,
};

export interface RiskUsersParams {
  level?: string;
  page?: number;
  pageSize?: number;
}

export const riskAdminActions = {
  async listUsers(params: RiskUsersParams): Promise<RiskUserListResult> {
    const { data } = await riskAdminApi.listUsers(params);
    return data;
  },
  async getUser(userId: string): Promise<RiskUserDetail> {
    const { data } = await riskAdminApi.getUser(userId);
    return data;
  },
  async setLevel(userId: string, level: RiskLevel, reason?: string) {
    const { data } = await riskAdminApi.setLevel(userId, { level, reason });
    return data;
  },
  async block(userId: string, reason?: string) {
    const { data } = await riskAdminApi.block(userId, { reason });
    return data;
  },
  async unblock(userId: string, reason?: string) {
    const { data } = await riskAdminApi.unblock(userId, { reason });
    return data;
  },
};
