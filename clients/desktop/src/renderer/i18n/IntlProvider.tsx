'use client';

import * as React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { DEFAULT_LANGUAGE, type SupportedLanguage } from '@autix/i18n';
import { useLanguageStore } from '@autix/shared-store';

type MessagesMap = Record<string, Record<string, unknown>>;

const loaders: Record<SupportedLanguage, () => Promise<MessagesMap>> = {
  'zh-CN': async () => (await import('./messages/zh-CN.json')).default,
  'zh-TW': async () => (await import('./messages/zh-TW.json')).default,
  en: async () => (await import('./messages/en.json')).default,
  fr: async () => (await import('./messages/fr.json')).default,
  ja: async () => (await import('./messages/ja.json')).default,
  ru: async () => (await import('./messages/ru.json')).default,
  vi: async () => (await import('./messages/vi.json')).default,
};

export function IntlProvider({ children }: { children: React.ReactNode }) {
  const language = useLanguageStore((s) => s.language);
  const hydrated = useLanguageStore((s) => s.hydrated);
  const [messages, setMessages] = React.useState<MessagesMap | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = loaders[language] ?? loaders[DEFAULT_LANGUAGE];
    load().then((m) => {
      if (!cancelled) setMessages(m);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  if (!hydrated || !messages) {
    return null;
  }

  return (
    <NextIntlClientProvider locale={language} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
