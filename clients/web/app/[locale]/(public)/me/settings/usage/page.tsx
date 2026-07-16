import { setRequestLocale } from 'next-intl/server';
import { AccountUsagePanel } from '@autix/shared-ui/growth';

export default async function AccountUsagePage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountUsagePanel />;
}
