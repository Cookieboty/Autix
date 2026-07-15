import { setRequestLocale } from 'next-intl/server';
import { AccountGiftsPanel } from '@autix/shared-ui/growth';

export default async function AccountGiftsPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountGiftsPanel />;
}
