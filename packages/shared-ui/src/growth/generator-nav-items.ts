export type GeneratorNavItem = {
  key: string;
  href: string;
  active: boolean;
  badge?: 'new' | 'soon';
  disabled?: boolean;
  separatorAfter?: boolean;
};

export function buildGeneratorNavItems(
  kind: 'home' | 'image' | 'video',
  /**
   * explore 只在真正的首页高亮。kind 的 'home' 是「既不是 image 也不是 video」的兜底，
   * /pricing、/asset 这些页面也会落进来，不能跟着一起点亮。
   */
  isHomeRoute = kind === 'home',
): GeneratorNavItem[] {
  return [
    { key: 'explore', href: '/', active: isHomeRoute },
    { key: 'image', href: '/ai/image', active: kind === 'image' },
    { key: 'video', href: '/ai/video', active: kind === 'video' },
    // { key: 'marketing', href: '/marketing-studio', active: false, disabled: true },
    // { key: 'cinema', href: '/original-series', active: false, disabled: true },
    // { key: 'originals', href: '/original-series', active: false, disabled: true, badge: 'soon' },
    // { key: 'canvas', href: '/draw', active: false },
  ];
}
