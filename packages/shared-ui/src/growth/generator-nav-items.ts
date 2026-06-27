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
    { key: 'supercomputer', href: '/supercomputer', active: false, badge: 'new' },
    { key: 'mcp', href: '/mcp', active: false, badge: 'new' },
    { key: 'collab', href: '/community', active: false },
    { key: 'plugins', href: '/marketplace', active: false, badge: 'new' },
    { key: 'marketing', href: '/marketing-studio', active: false },
    { key: 'cinema', href: '/original-series', active: false },
    { key: 'originals', href: '/original-series', active: false },
    { key: 'canvas', href: '/canvas', active: false },
    { key: 'influencer', href: '/community', active: false },
    { key: 'apps', href: '/marketplace', active: false },
  ];
}
