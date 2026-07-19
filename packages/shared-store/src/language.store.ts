import { create } from 'zustand';
import { DEFAULT_LANGUAGE, type SupportedLanguage } from '@autix/i18n';
import { getAuth, getNavigation } from '@autix/platform';
import { updateMyLanguage } from '@autix/sdk';
import { resolveLanguage } from './language-resolution';

interface LanguageState {
  language: SupportedLanguage;
  hydrated: boolean;
  /** @param urlLocale 当前 URL 激活的 locale（web 传入；desktop 无 URL locale，省略）。 */
  hydrate: (urlLocale?: string) => Promise<void>;
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

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: DEFAULT_LANGUAGE,
  hydrated: false,

  hydrate: async (urlLocale?: string) => {
    // URL / cookie / localStorage 三个来源可能互相矛盾，交给 resolveLanguage 统一收敛
    // 并给出回写目标，否则会出现「页面英文、选择器中文」这类错位。
    const stored = (await getAuth().getLanguage()) ?? undefined;
    const resolution = resolveLanguage({ urlLocale, cookie: readCookie('NEXT_LOCALE'), stored });

    if (resolution.writeCookie) setCookie('NEXT_LOCALE', resolution.writeCookie);
    if (resolution.writeStored) await getAuth().setLanguage(resolution.writeStored);

    set({ language: resolution.language, hydrated: true });

    // 代理当时无 cookie 可依据，放行了裸路径（= 英文 SSR）；cookie 已补上，URL 也要跟上。
    if (resolution.switchUrlTo) {
      getNavigation().switchLocale(resolution.switchUrlTo);
    }
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
