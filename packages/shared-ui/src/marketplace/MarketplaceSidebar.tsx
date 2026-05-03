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

interface NavSection {
  label: string;
  items: { slug: string; label: string; icon: React.ReactNode }[];
}

const SECTIONS: NavSection[] = [
  {
    label: '资源类型',
    items: [
      { slug: 'skills', label: 'Skills', icon: <Sparkles className="w-4 h-4" /> },
      { slug: 'mcp', label: 'MCP', icon: <Wrench className="w-4 h-4" /> },
      { slug: 'agents', label: 'Agents', icon: <Bot className="w-4 h-4" /> },
      {
        slug: 'image-templates',
        label: '图片模板',
        icon: <ImageIcon className="w-4 h-4" />,
      },
      {
        slug: 'video-templates',
        label: '视频模板',
        icon: <Video className="w-4 h-4" />,
      },
    ],
  },
];

const PROFILE_ITEMS = [
  { tab: 'acquired', label: '我的资源', icon: <Sparkles className="w-4 h-4" /> },
  { tab: 'favorites', label: '我的收藏', icon: <Star className="w-4 h-4" /> },
  { tab: 'generations', label: '生成历史', icon: <Clock className="w-4 h-4" /> },
  { tab: 'published', label: '我的发布', icon: <Upload className="w-4 h-4" /> },
  { tab: 'history', label: '浏览历史', icon: <Bookmark className="w-4 h-4" /> },
];

export function MarketplaceSidebar() {
  const nav = useRouter();
  const pathname = usePathname() ?? '';
  const currentSlug = pathname.match(/\/marketplace\/([^/?]+)/)?.[1] ?? '';

  return (
    <aside
      className="w-60 h-full flex flex-col gap-4 px-3 py-4 border-r"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--panel)' }}
    >
      <div>
        <button
          onClick={() => nav.push('/marketplace')}
          className="w-full text-left px-2 py-1.5 text-sm rounded font-medium transition-colors"
          style={{
            color:
              pathname === '/marketplace' ? 'var(--accent)' : 'var(--foreground)',
            backgroundColor:
              pathname === '/marketplace' ? 'var(--panel-muted)' : 'transparent',
          }}
        >
          推荐首页
        </button>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.label}>
          <div
            className="px-2 mb-1 text-[11px] uppercase font-semibold"
            style={{ color: 'var(--muted)' }}
          >
            {section.label}
          </div>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = currentSlug === item.slug;
              return (
                <li key={item.slug}>
                  <button
                    onClick={() => nav.push(`/marketplace/${item.slug}`)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors"
                    style={{
                      color: active ? 'var(--accent)' : 'var(--foreground)',
                      backgroundColor: active
                        ? 'var(--panel-muted)'
                        : 'transparent',
                    }}
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
        <div
          className="px-2 mb-1 text-[11px] uppercase font-semibold"
          style={{ color: 'var(--muted)' }}
        >
          我的
        </div>
        <ul className="space-y-0.5">
          {PROFILE_ITEMS.map((item) => (
            <li key={item.tab}>
              <button
                onClick={() => nav.push(`/profile?tab=${item.tab}`)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors hover:bg-[var(--panel-muted)]"
                style={{ color: 'var(--foreground)' }}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
          <li>
            <button
              onClick={() => nav.push('/profile')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors hover:bg-[var(--panel-muted)]"
              style={{ color: 'var(--foreground)' }}
            >
              <User className="w-4 h-4" /> 个人主页
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
