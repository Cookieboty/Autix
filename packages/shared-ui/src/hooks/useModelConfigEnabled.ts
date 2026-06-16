'use client';

import * as React from 'react';
import { systemSettingsApi, type PublicSystemSettings } from '@autix/shared-lib';

type SystemFeatureKey = keyof PublicSystemSettings['features'];

export function useSystemFeatureFlag(feature: SystemFeatureKey, defaultValue = true) {
  const [state, setState] = React.useState({ enabled: defaultValue, loading: true });

  React.useEffect(() => {
    let mounted = true;
    systemSettingsApi
      .getPublic()
      .then(({ data }) => {
        if (mounted) {
          setState({
            enabled: data.features[feature] ?? defaultValue,
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
  }, [defaultValue, feature]);

  return state;
}

export function useModelConfigEnabled(defaultValue = true) {
  return useSystemFeatureFlag('modelConfigEnabled', defaultValue).enabled;
}

export function useChatEnabled(defaultValue = true) {
  return useSystemFeatureFlag('chatEnabled', defaultValue).enabled;
}

export function useLibraryEnabled(defaultValue = true) {
  return useSystemFeatureFlag('libraryEnabled', defaultValue).enabled;
}
