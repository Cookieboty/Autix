'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { PublicPromoBar } from './PublicPromoBar';

export type PublicTopPromoContent = { label?: string; href?: string } | null;

const useTopPromoStore = create<{
  promo: PublicTopPromoContent;
  setPromo: (promo: PublicTopPromoContent) => void;
}>((set) => ({
  promo: null,
  setPromo: (promo) => set({ promo }),
}));

/**
 * 页面声明本页顶部横幅内容（挂载时设置、卸载时清空）。
 * 本组件渲染 null，可放在服务端组件里（它自身是 client）。
 */
export function SetPublicTopPromo({ label, href }: { label?: string; href?: string }) {
  const setPromo = useTopPromoStore((state) => state.setPromo);
  useEffect(() => {
    setPromo(label ? { label, href } : null);
    return () => setPromo(null);
  }, [label, href, setPromo]);
  return null;
}

/**
 * 由 (public) layout 在导航条**上方**渲染：读取当前页声明的横幅内容。
 * 每个页面内容可不同；没有声明时不渲染（不占空间）。
 */
export function PublicTopPromo() {
  const promo = useTopPromoStore((state) => state.promo);
  if (!promo?.label) return null;
  return <PublicPromoBar label={promo.label} href={promo.href} />;
}
