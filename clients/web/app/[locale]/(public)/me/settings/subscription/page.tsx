import { setRequestLocale } from 'next-intl/server';
import { AccountSubscriptionPanel } from '@autix/shared-ui/growth';

export default async function AccountSubscriptionPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountSubscriptionPanel />;
}
