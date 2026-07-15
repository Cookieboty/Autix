import { GalleryDetailSkeleton } from '@autix/shared-ui/growth';

/**
 * 路由级加载态：与 GalleryPostView 客户端拉数据时用的是同一个骨架，
 * 所以「服务端 loading → 客户端 fetching → 内容」三段之间没有形状跳变。
 */
export default function GalleryPostLoading() {
  return <GalleryDetailSkeleton />;
}
