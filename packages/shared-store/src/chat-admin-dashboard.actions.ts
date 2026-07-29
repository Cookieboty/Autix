import type {
  ChatDashboardBillingSummary,
  ChatDashboardContentPulse,
  ChatDashboardGenerationHealth,
  ChatDashboardPendingInbox,
  ChatDashboardRangeQuery,
  ChatDashboardRiskSignals,
} from '@autix/domain/admin/chat-dashboard';
import { chatDashboardAdminApi } from '@autix/sdk';

export const chatAdminDashboardActions = {
  pendingInbox: async (): Promise<ChatDashboardPendingInbox> => {
    const { data } = await chatDashboardAdminApi.pendingInbox();
    return data;
  },
  generationHealth: async (
    query: ChatDashboardRangeQuery,
  ): Promise<ChatDashboardGenerationHealth> => {
    const { data } = await chatDashboardAdminApi.generationHealth(query);
    return data;
  },
  billingSummary: async (
    query: ChatDashboardRangeQuery,
  ): Promise<ChatDashboardBillingSummary> => {
    const { data } = await chatDashboardAdminApi.billingSummary(query);
    return data;
  },
  contentPulse: async (
    query: ChatDashboardRangeQuery,
  ): Promise<ChatDashboardContentPulse> => {
    const { data } = await chatDashboardAdminApi.contentPulse(query);
    return data;
  },
  riskSignals: async (
    query: ChatDashboardRangeQuery,
  ): Promise<ChatDashboardRiskSignals> => {
    const { data } = await chatDashboardAdminApi.riskSignals(query);
    return data;
  },
};
