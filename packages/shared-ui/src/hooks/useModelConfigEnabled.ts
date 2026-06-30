'use client';

import * as React from 'react';
import {
  usePublicSystemSettingsStore,
  type SystemFeatureKey,
} from '@autix/shared-store';

export function useSystemFeatureFlag(feature: SystemFeatureKey, defaultValue = true) {
  const [state, setState] = React.useState({ enabled: defaultValue, loading: true });
  const loadPublicSettings = usePublicSystemSettingsStore(
    (store) => store.loadPublicSettings,
  );

  React.useEffect(() => {
    let mounted = true;
    loadPublicSettings()
      .then((data) => {
        if (mounted) {
          setState({
            enabled: data?.features[feature] ?? defaultValue,
            loading: false,
          });
        }
      })
      .catch(() => {
        if (mounted) setState({ enabled: defaultValue, loading: false });
      });
    return () => {
      mounted = false;
    };
  }, [defaultValue, feature, loadPublicSettings]);

  return state;
}

export function useChatEnabled(defaultValue = true) {
  return useSystemFeatureFlag('chatEnabled', defaultValue).enabled;
}

export function useLibraryEnabled(defaultValue = true) {
  return useSystemFeatureFlag('libraryEnabled', defaultValue).enabled;
}

export function useInviteSharingEnabled(defaultValue = true) {
  return useSystemFeatureFlag('inviteSharingEnabled', defaultValue).enabled;
}
