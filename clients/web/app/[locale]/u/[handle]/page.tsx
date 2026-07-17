import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ProfilePublicView } from '@autix/shared-ui/growth';

type Props = { params: Promise<{ locale: string; handle: string }> };

export const metadata: Metadata = {
  // 个人页内容目前是客户端拉取的（先跑通链路），暂不做 per-user 的 SEO 元信息。
  // 要上 OG 卡片/收录，得把 getByUsername 挪到服务端 + generateMetadata + buildAlternates。
  robots: { index: false },
};

/**
 * 公开个人页落地路由。站内点击虚荣链接 `/@handle` 由 web proxy 改写到这里
 * （app/[locale]/u/[handle]）；刷新 / 外链直达也走这条路由。
 */
export default async function CreatorProfilePage({ params }: Props) {
  const { locale, handle } = await params;
  setRequestLocale(locale);
  return <ProfilePublicView username={handle} />;
}
