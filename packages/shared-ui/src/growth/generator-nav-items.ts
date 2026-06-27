export type GeneratorNavItem = {
  key: string;
  href: string;
  active: boolean;
  badge?: 'new';
};

export function buildGeneratorNavItems(kind: 'home' | 'image' | 'video'): GeneratorNavItem[] {
  return [
    { key: 'image', href: '/ai/image', active: kind === 'image' },
    { key: 'video', href: '/ai/video', active: kind === 'video' },
    { key: 'marketing', href: '/marketing-studio', active: false },
    { key: 'cinema', href: '/original-series', active: false },
    { key: 'originals', href: '/original-series', active: false },
    { key: 'canvas', href: '/canvas', active: false },
    { key: 'influencer', href: '/community', active: false },
  ];
}
