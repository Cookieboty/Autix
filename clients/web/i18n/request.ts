import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { messageLoaders, type SupportedLanguage } from '@autix/i18n';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: SupportedLanguage = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: await messageLoaders[locale](),
  };
});
