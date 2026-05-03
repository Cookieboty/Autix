'use client';

import { useState } from 'react';
import { Bell, Search, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../navigation';
import type { MarketplaceTypeSlug } from '@autix/shared-lib';
import { PublishDrawer } from './forms/PublishDrawer';

const TYPES: {
  slug: string;
  labelKey:
    | 'topNavHome'
    | 'topNavSkills'
    | 'topNavMcp'
    | 'topNavAgents'
    | 'topNavImage'
    | 'topNavVideo';
}[] = [
  { slug: '', labelKey: 'topNavHome' },
  { slug: 'skills', labelKey: 'topNavSkills' },
  { slug: 'mcp', labelKey: 'topNavMcp' },
  { slug: 'agents', labelKey: 'topNavAgents' },
  { slug: 'image-templates', labelKey: 'topNavImage' },
  { slug: 'video-templates', labelKey: 'topNavVideo' },
];

const VALID_PUBLISH_TYPES: MarketplaceTypeSlug[] = [
  'skills',
  'mcp',
  'agents',
  'image-templates',
  'video-templates',
];

function slugToType(slug: string): MarketplaceTypeSlug {
  return (VALID_PUBLISH_TYPES as string[]).includes(slug)
    ? (slug as MarketplaceTypeSlug)
    : 'skills';
}

export function MarketplaceTopNav({
  currentSlug = '',
  onSearch,
  onPublished,
}: {
  currentSlug?: string;
  onSearch?: (q: string) => void;
  onPublished?: (type: MarketplaceTypeSlug) => void;
}) {
  const nav = useRouter();
  const t = useTranslations('publish');
  const [publishOpen, setPublishOpen] = useState(false);
  const initialType = slugToType(currentSlug);

  return (
    <header
      className="flex items-center gap-4 px-4 h-12 border-b"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--panel)' }}
    >
      <div
        className="font-semibold text-base cursor-pointer"
        onClick={() => nav.push('/marketplace')}
      >
        {t('topNavTitle')}
      </div>
      <nav className="flex items-center gap-1">
        {TYPES.map((item) => {
          const active =
            currentSlug === item.slug ||
            (item.slug === '' && (currentSlug === '' || currentSlug === 'home'));
          return (
            <button
              key={item.slug || 'home'}
              onClick={() =>
                nav.push(item.slug ? `/marketplace/${item.slug}` : '/marketplace')
              }
              className="px-3 py-1.5 text-sm rounded transition-colors"
              style={{
                color: active ? 'var(--accent)' : 'var(--muted)',
                backgroundColor: active ? 'var(--panel-muted)' : 'transparent',
              }}
            >
              {t(item.labelKey)}
            </button>
          );
        })}
      </nav>
      <div className="flex-1 max-w-md ml-auto">
        <div
          className="flex items-center gap-2 px-2 h-8 rounded"
          style={{
            backgroundColor: 'var(--panel-muted)',
            border: '1px solid var(--border)',
          }}
        >
          <Search className="w-4 h-4" style={{ color: 'var(--muted)' }} />
          <input
            placeholder={t('topNavSearchPlaceholder')}
            className="flex-1 bg-transparent outline-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch?.((e.target as HTMLInputElement).value);
            }}
          />
        </div>
      </div>
      <button
        onClick={() => setPublishOpen(true)}
        className="flex items-center gap-1 px-3 h-8 text-sm rounded cursor-pointer"
        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
      >
        <Upload className="w-4 h-4" /> {t('topNavPublish')}
      </button>
      <button
        className="p-2 rounded hover:bg-[var(--panel-muted)]"
        style={{ color: 'var(--muted)' }}
      >
        <Bell className="w-4 h-4" />
      </button>

      <PublishDrawer
        open={publishOpen}
        initialType={initialType}
        onClose={() => setPublishOpen(false)}
        onSaved={(type) => {
          onPublished?.(type);
          // 默认导航到该类型的列表页查看刚提交的内容
          nav.push(`/marketplace/${type}`);
        }}
      />
    </header>
  );
}
