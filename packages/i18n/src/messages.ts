import type { SupportedLanguage } from './constants.js';

type MessagesMap = Record<string, unknown>;

export const messageLoaders: Record<SupportedLanguage, () => Promise<MessagesMap>> = {
  'zh-CN': async () => (await import('./messages/zh-CN.json')).default,
  'zh-TW': async () => (await import('./messages/zh-TW.json')).default,
  en: async () => (await import('./messages/en.json')).default,
  fr: async () => (await import('./messages/fr.json')).default,
  ja: async () => (await import('./messages/ja.json')).default,
  ru: async () => (await import('./messages/ru.json')).default,
  vi: async () => (await import('./messages/vi.json')).default,
};
