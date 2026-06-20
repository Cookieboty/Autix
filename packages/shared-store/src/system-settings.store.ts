import { create } from 'zustand';
import { systemSettingsApi, type PublicSystemSettings } from '@autix/sdk';

export type { PublicSystemSettings } from '@autix/sdk';

export type SystemFeatureKey = keyof PublicSystemSettings['features'];

export async function getPublicSystemSettings(): Promise<PublicSystemSettings> {
  const { data } = await systemSettingsApi.getPublic();
  return data;
}

interface PublicSystemSettingsState {
  publicSettings: PublicSystemSettings | null;
  loading: boolean;
  loadPublicSettings: () => Promise<PublicSystemSettings | null>;
  getFeatureFlag: (feature: SystemFeatureKey, defaultValue?: boolean) => boolean;
}

export const usePublicSystemSettingsStore = create<PublicSystemSettingsState>(
  (set, get) => ({
    publicSettings: null,
    loading: false,
    loadPublicSettings: async () => {
      set({ loading: true });
      try {
        const data = await getPublicSystemSettings();
        set({ publicSettings: data, loading: false });
        return data;
      } catch {
        set({ loading: false });
        return null;
      }
    },
    getFeatureFlag: (feature, defaultValue = true) => {
      const settings = get().publicSettings;
      return settings?.features[feature] ?? defaultValue;
    },
  }),
);
