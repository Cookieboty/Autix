'use client';

import { useEffect, useState } from 'react';
import {
  type MaterialAsset,
  type MaterialAssetType,
  videoWorkbenchActions,
} from '@autix/shared-store';
import type {
  VideoInspirationTab,
  VideoMaterialTarget,
} from './constants';

interface UseVideoWorkbenchMaterialsOptions {
  open: boolean;
  tab: VideoInspirationTab;
}

export function useVideoWorkbenchMaterials({ open, tab }: UseVideoWorkbenchMaterialsOptions) {
  const [materials, setMaterials] = useState<MaterialAsset[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialType, setMaterialType] = useState<MaterialAssetType | 'all'>('all');
  const [materialTarget, setMaterialTarget] = useState<VideoMaterialTarget>('first_frame');

  useEffect(() => {
    if (!open || tab !== 'materials') return;
    let cancelled = false;
    setMaterialsLoading(true);
    const timer = window.setTimeout(() => {
      videoWorkbenchActions
        .listMaterials({
          type: materialType,
          search: materialSearch.trim() || undefined,
          pageSize: 80,
        })
        .then((items) => {
          if (!cancelled) setMaterials(items);
        })
        .catch(() => {
          if (!cancelled) setMaterials([]);
        })
        .finally(() => {
          if (!cancelled) setMaterialsLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [materialSearch, materialType, open, tab]);

  return {
    materials,
    materialsLoading,
    materialSearch,
    setMaterialSearch,
    materialType,
    setMaterialType,
    materialTarget,
    setMaterialTarget,
  };
}
