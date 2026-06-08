import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LANGUAGE, normalizeLang } from '@autix/i18n';

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get('NEXT_LOCALE')?.value;
  const locale = (raw && normalizeLang(raw)) || DEFAULT_LANGUAGE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
