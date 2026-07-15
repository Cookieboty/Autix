'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GalleryFeedItem } from '@autix/shared-store';
import { useLocalizePath } from '../../navigation';
import { galleryPostPath } from '../generator/image/gallery-url';

/**
 * 广场作品详情的「弹窗 + URL」。
 *
 * 站内点击**不做路由导航**：直接用列表里已有的 feed item 开弹窗（零请求、瞬开），
 * 只用 History API 把地址栏改成 /gallery/<id>。刷新时浏览器请求这个真实路由，
 * 由 gallery/[id]/page.tsx 渲染完整详情页。
 *
 * 为什么不用 Next 的拦截路由（@modal + (.)gallery）：那套每次点击都要发一次 RSC 请求、
 * 等服务端回包才出弹窗（慢），期间底下的页面还会被重渲染一遍（能看到生成器闪一下空白）。
 * 我们要的是「页面完全不动，只有地址栏变」，History API 才是对的工具。
 *
 * 关闭：本会话 push 过就 back()（把那条历史记录消掉，地址栏和后退栈都干净）；
 * 没 push 过（理论上到不了这条路径）就 replaceState 回原地址，绝不 back()——那会离站。
 */
export function useGalleryPostModal() {
  const localize = useLocalizePath();
  const [item, setItem] = useState<GalleryFeedItem | null>(null);
  /** 打开弹窗前的地址（含 query），关闭时用来还原。 */
  const originRef = useRef<string | null>(null);

  const open = useCallback(
    (next: GalleryFeedItem) => {
      setItem(next);
      if (typeof window === 'undefined') return;
      originRef.current = `${window.location.pathname}${window.location.search}`;
      window.history.pushState(null, '', localize(galleryPostPath(next.post.id)));
    },
    [localize],
  );

  const close = useCallback(() => {
    setItem(null);
    if (typeof window === 'undefined') return;
    if (originRef.current) {
      originRef.current = null;
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // 浏览器后退：地址栏回到原页面时把弹窗关掉（不 back()，否则会再退一格）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const onPostUrl = /\/gallery\/[^/]+$/.test(window.location.pathname);
      if (!onPostUrl) {
        originRef.current = null;
        setItem(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return { item, open, close };
}
