import { create } from 'zustand';
import { membershipApi } from '@autix/sdk';

interface MembershipGateState {
  isActiveMember: boolean | null;
  loading: boolean;
  loadMembershipGate: () => Promise<boolean>;
  resetMembershipGate: () => void;
}

export const useMembershipGateStore = create<MembershipGateState>((set) => ({
  isActiveMember: null,
  loading: false,
  loadMembershipGate: async () => {
    set({ loading: true });
    try {
      const { data } = await membershipApi.getMe();
      const membership = data.membership;
      const isActiveMember =
        !!membership &&
        membership.status === 'ACTIVE' &&
        new Date(membership.expiresAt) > new Date();
      set({ isActiveMember, loading: false });
      return isActiveMember;
    } catch {
      set({ isActiveMember: false, loading: false });
      return false;
    }
  },
  resetMembershipGate: () => set({ isActiveMember: null, loading: false }),
}));
