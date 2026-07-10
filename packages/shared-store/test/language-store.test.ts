import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerPlatform } from '@autix/platform';
import { useLanguageStore } from '../src/language.store';

const switchLocale = vi.fn();

beforeEach(() => {
  switchLocale.mockClear();
  registerPlatform({
    auth: {
      getAccessToken: async () => null,
      getRefreshToken: async () => null,
      setTokens: async () => {},
      clearTokens: async () => {},
      getUser: async () => null,
      setUser: async () => {},
      getLanguage: async () => 'en',
      setLanguage: async () => {},
    },
    navigation: {
      push: vi.fn(),
      replace: vi.fn(),
      getPathname: () => '/pricing',
      switchLocale,
    },
    env: { apiUrl: '', chatApiUrl: '', userApiUrl: '' },
  });
});

describe('language.store', () => {
  it('setLanguage 调用适配器的 switchLocale', async () => {
    await useLanguageStore.getState().setLanguage('ja');
    expect(switchLocale).toHaveBeenCalledWith('ja');
  });

  it('setLanguage 不触发整页刷新', async () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      writable: true,
    });
    await useLanguageStore.getState().setLanguage('fr');
    expect(reload).not.toHaveBeenCalled();
  });

  it('仍写入 NEXT_LOCALE cookie 作为偏好提示', async () => {
    await useLanguageStore.getState().setLanguage('ru');
    expect(document.cookie).toContain('NEXT_LOCALE=ru');
  });
});
