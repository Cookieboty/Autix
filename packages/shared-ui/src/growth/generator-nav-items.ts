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
): GeneratorNavItem[] {
  return [
    { key: 'explore', href: '/', active: kind === 'home' },
    { key: 'image', href: '/ai/image', active: kind === 'image' },
    { key: 'video', href: '/ai/video', active: kind === 'video', separatorAfter: true },
    // { key: 'marketing', href: '/marketing-studio', active: false, disabled: true },
    // { key: 'cinema', href: '/original-series', active: false, disabled: true },
    // { key: 'originals', href: '/original-series', active: false, disabled: true, badge: 'soon' },
    // { key: 'canvas', href: '/draw', active: false },
  ];
}
