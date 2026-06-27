'use client';

import {
  Sparkles,
  Wrench,
  ImageIcon,
  Video,
  Star,
  Bookmark,
  Upload,
  Clock,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '../navigation';
import { cn } from '../ui/utils';

interface NavSection {
  labelKey: 'resourceTypes';
  items: { slug: string; labelKey: 'skills' | 'mcp' | 'imageTemplates' | 'videoTemplates'; icon: React.ReactNode }[];
}

const SECTIONS: NavSection[] = [
  {
    labelKey: 'resourceTypes',
    items: [
      { slug: 'skills', labelKey: 'skills', icon: <Sparkles className="h-4 w-4" /> },
      { slug: 'mcp', labelKey: 'mcp', icon: <Wrench className="h-4 w-4" /> },
      // 暂时移除 agents 模板市场入口，保留图片与视频模板
      // { slug: 'agents', label: 'Agents', icon: <Bot className="h-4 w-4" /> },
      {
        slug: 'image-templates',
        labelKey: 'imageTemplates',
        icon: <ImageIcon className="h-4 w-4" />,
      },
      {
        slug: 'video-templates',
        labelKey: 'videoTemplates',
        icon: <Video className="h-4 w-4" />,
      },
    ],
  },
];

const PROFILE_ITEMS = [
  { tab: 'acquired', labelKey: 'acquired', icon: <Sparkles className="h-4 w-4" /> },
  { tab: 'favorites', labelKey: 'favorites', icon: <Star className="h-4 w-4" /> },
  { tab: 'generations', labelKey: 'generations', icon: <Clock className="h-4 w-4" /> },
  { tab: 'published', labelKey: 'published', icon: <Upload className="h-4 w-4" /> },
  { tab: 'history', labelKey: 'history', icon: <Bookmark className="h-4 w-4" /> },
];

export function MarketplaceSidebar() {
  const nav = useRouter();
  const pathname = usePathname() ?? '';
  const currentSlug = pathname.match(/\/marketplace\/([^/?]+)/)?.[1] ?? '';
  const t = useTranslations('marketplace.sidebar');

  return (
    <aside className="flex h-full w-60 flex-col gap-4 border-r border-border bg-card px-3 py-4">
      <div>
        <button
          onClick={() => nav.push('/community')}
          className={cn(
            'w-full rounded px-2 py-1.5 text-left text-sm font-medium transition-colors',
            pathname === '/community'
              ? 'bg-muted text-primary'
              : 'text-foreground hover:bg-muted',
          )}
        >
          {t('home')}
        </button>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.labelKey}>
          <div className="mb-1 px-2 text-[11px] font-semibold uppercase text-muted-foreground">
            {t(section.labelKey)}
          </div>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = currentSlug === item.slug;
              return (
                <li key={item.slug}>
                  <button
                    onClick={() => nav.push(`/marketplace/${item.slug}`)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-muted text-primary'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    {item.icon}
                    {t(item.labelKey)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div>
        <div className="mb-1 px-2 text-[11px] font-semibold uppercase text-muted-foreground">
          {t('mine')}
        </div>
        <ul className="space-y-0.5">
          {PROFILE_ITEMS.map((item) => (
            <li key={item.tab}>
              <button
                onClick={() => nav.push(`/profile?tab=${item.tab}`)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                {item.icon}
                {t(item.labelKey)}
              </button>
            </li>
          ))}
          <li>
            <button
              onClick={() => nav.push('/profile')}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <User className="h-4 w-4" /> {t('profile')}
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
