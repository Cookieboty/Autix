import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GalleryPostView } from '@autix/shared-ui/growth';

type Props = { params: Promise<{ locale: string; id: string }> };

export const metadata: Metadata = {
  // 详情内容目前是客户端拉取的（先跑通链路），所以不做 per-post 的 SEO 元信息。
  // 要上 OG 卡片/收录，得把 getDetail 挪到服务端 + generateMetadata。
  robots: { index: false },
};

/**
 * 广场作品详情（完整页）：刷新 / 外链 / 分享链接直接落地时走这里。
 *
 * **刻意放在 (public) 路由组之外** —— 那个 layout 会套上顶部促销横幅和站点导航栏，
 * 而这是一个全屏沉浸式详情页，不该有导航。
 *
 * 站内点开根本不会走这条路由：那是本地弹窗 + history.pushState 改地址栏
 * （见 useGalleryPostModal），页面一动不动。
 */
export default async function GalleryPostPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <GalleryPostView postId={id} />;
}
