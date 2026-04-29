import { create } from 'zustand';
import { DEFAULT_LANGUAGE, type SupportedLanguage } from '@autix/i18n';
import { updateMyLanguage } from '@/lib/api';

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value};expires=${expires};path=/`;
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1];
}

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const fromStorage = localStorage.getItem('language') as SupportedLanguage | null;
  const fromCookie = getCookie('NEXT_LOCALE') as SupportedLanguage | null;
  const lang = fromStorage || fromCookie || DEFAULT_LANGUAGE;
  if (fromStorage && fromCookie !== fromStorage) {
    setCookie('NEXT_LOCALE', lang);
  }
  if (!fromStorage && !fromCookie) {
    localStorage.setItem('language', lang);
    setCookie('NEXT_LOCALE', lang);
  }
  return lang;
}

interface LanguageState {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: getInitialLanguage(),
  setLanguage: (lang) => {
    localStorage.setItem('language', lang);
    setCookie('NEXT_LOCALE', lang);
    set({ language: lang });

    const token = localStorage.getItem('accessToken');
    if (token) {
      updateMyLanguage(lang).catch(() => {});
    }

    window.location.reload();
  },
}));
