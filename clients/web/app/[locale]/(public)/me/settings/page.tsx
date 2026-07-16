import { setRequestLocale } from 'next-intl/server';
import { AccountProfilePanel } from '@autix/shared-ui/growth';

export default async function AccountSettingsPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountProfilePanel />;
}
