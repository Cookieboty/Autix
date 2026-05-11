'use client';

import {
  Sparkles,
  Wrench,
  Bot,
  ImageIcon,
  Video,
  Star,
  Bookmark,
  Upload,
  Clock,
  User,
} from 'lucide-react';
import { useRouter, usePathname } from '../navigation';
import { cn } from '../ui/utils';

interface NavSection {
  label: string;
  items: { slug: string; label: string; icon: React.ReactNode }[];
}

const SECTIONS: NavSection[] = [
  {
    label: '资源类型',
    items: [
      { slug: 'skills', label: 'Skills', icon: <Sparkles className="h-4 w-4" /> },
      { slug: 'mcp', label: 'MCP', icon: <Wrench className="h-4 w-4" /> },
      { slug: 'agents', label: 'Agents', icon: <Bot className="h-4 w-4" /> },
      {
        slug: 'image-templates',
        label: '图片模板',
        icon: <ImageIcon className="h-4 w-4" />,
      },
      {
        slug: 'video-templates',
        label: '视频模板',
        icon: <Video className="h-4 w-4" />,
      },
    ],
  },
];

const PROFILE_ITEMS = [
  { tab: 'acquired', label: '我的资源', icon: <Sparkles className="h-4 w-4" /> },
  { tab: 'favorites', label: '我的收藏', icon: <Star className="h-4 w-4" /> },
  { tab: 'generations', label: '生成历史', icon: <Clock className="h-4 w-4" /> },
  { tab: 'published', label: '我的发布', icon: <Upload className="h-4 w-4" /> },
  { tab: 'history', label: '浏览历史', icon: <Bookmark className="h-4 w-4" /> },
];

export function MarketplaceSidebar() {
  const nav = useRouter();
  const pathname = usePathname() ?? '';
  const currentSlug = pathname.match(/\/marketplace\/([^/?]+)/)?.[1] ?? '';

  return (
    <aside className="flex h-full w-60 flex-col gap-4 border-r border-border bg-card px-3 py-4">
      <div>
        <button
          onClick={() => nav.push('/marketplace')}
          className={cn(
            'w-full rounded px-2 py-1.5 text-left text-sm font-medium transition-colors',
            pathname === '/marketplace'
              ? 'bg-muted text-primary'
              : 'text-foreground hover:bg-muted',
          )}
        >
          推荐首页
        </button>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.label}>
          <div className="mb-1 px-2 text-[11px] font-semibold uppercase text-muted-foreground">
            {section.label}
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
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div>
        <div className="mb-1 px-2 text-[11px] font-semibold uppercase text-muted-foreground">
          我的
        </div>
        <ul className="space-y-0.5">
          {PROFILE_ITEMS.map((item) => (
            <li key={item.tab}>
              <button
                onClick={() => nav.push(`/profile?tab=${item.tab}`)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
          <li>
            <button
              onClick={() => nav.push('/profile')}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <User className="h-4 w-4" /> 个人主页
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
