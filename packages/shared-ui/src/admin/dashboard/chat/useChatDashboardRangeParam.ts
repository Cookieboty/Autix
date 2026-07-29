'use client';

import { useCallback } from 'react';
import type { ChatDashboardPresetWindow } from '@autix/domain/admin/chat-dashboard';
import { usePathname, useRouter, useSearchParams } from '../../../navigation';
import type { ChatDashboardRangeState } from './chat-dashboard.types';

const WINDOWS = new Set(['today', 'yesterday', 'last7d', 'custom']);

export function useChatDashboardRangeParam() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawWindow = searchParams.get('window');
  const window = WINDOWS.has(rawWindow ?? '')
    ? (rawWindow as ChatDashboardRangeState['window'])
    : 'today';
  const range: ChatDashboardRangeState = window === 'custom'
    ? { window, from: searchParams.get('from') ?? '', to: searchParams.get('to') ?? '' }
    : { window };

  const replaceParams = useCallback((mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  const setPreset = useCallback((preset: ChatDashboardPresetWindow) => {
    replaceParams((params) => {
      params.set('window', preset);
      params.delete('from');
      params.delete('to');
    });
  }, [replaceParams]);

  const setCustom = useCallback((from: string, to: string) => {
    replaceParams((params) => {
      params.set('window', 'custom');
      params.set('from', from);
      params.set('to', to);
    });
  }, [replaceParams]);

  return { range, setPreset, setCustom };
}
