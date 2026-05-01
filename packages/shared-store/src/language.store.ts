import { create } from 'zustand';
import { DEFAULT_LANGUAGE, type SupportedLanguage } from '@autix/i18n';
import { getAuth, updateMyLanguage } from '@autix/shared-lib';

interface LanguageState {
  language: SupportedLanguage;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
}

/**
 * Web 端兼容：Next.js 服务端通过 NEXT_LOCALE cookie 决定语言；setLanguage 后调用
 * window.location.reload() 才能让服务端重新渲染。
 * Desktop 端无服务端渲染，setLanguage 直接生效（IntlProvider 重新加载 messages）。
 */
function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value};expires=${expires};path=/`;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: DEFAULT_LANGUAGE,
  hydrated: false,

  hydrate: async () => {
    const stored = (await getAuth().getLanguage()) as SupportedLanguage | null;
    const language = stored || DEFAULT_LANGUAGE;
    setCookie('NEXT_LOCALE', language);
    set({ language, hydrated: true });
  },

  setLanguage: async (lang) => {
    await getAuth().setLanguage(lang);
    setCookie('NEXT_LOCALE', lang);
    set({ language: lang });

    const token = await getAuth().getAccessToken();
    if (token) {
      updateMyLanguage(lang).catch(() => {});
    }

    if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
      window.location.reload();
    }
  },
}));
