import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LANGUAGE } from '@autix/i18n';

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = store.get('NEXT_LOCALE')?.value || DEFAULT_LANGUAGE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
