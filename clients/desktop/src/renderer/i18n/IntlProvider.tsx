'use client';

import * as React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { DEFAULT_LANGUAGE, messageLoaders } from '@autix/i18n';
import { useLanguageStore } from '@autix/shared-store';

export function IntlProvider({ children }: { children: React.ReactNode }) {
  const language = useLanguageStore((s) => s.language);
  const hydrated = useLanguageStore((s) => s.hydrated);
  const [messages, setMessages] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = messageLoaders[language] ?? messageLoaders[DEFAULT_LANGUAGE];
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
