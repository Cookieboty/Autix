import { create } from 'zustand';
import { DEFAULT_LANGUAGE, type SupportedLanguage } from '@autix/i18n';
import { getAuth, getNavigation } from '@autix/platform';
import { updateMyLanguage } from '@autix/sdk';

interface LanguageState {
  language: SupportedLanguage;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
}

/**
 * locale 的真值源是 URL 路径段，不是 cookie。
 * Web 端：switchLocale 触发 next-intl 的 router.replace(pathname, { locale })，软导航。
 * Desktop 端：无 URL locale，switchLocale 仅重载 IntlProvider。
 * NEXT_LOCALE cookie 降级为偏好提示，供语言建议横幅与 desktop 持久化使用。
 */
function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value};expires=${expires};path=/;SameSite=Lax`;
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

    getNavigation().switchLocale(lang);
  },
}));
