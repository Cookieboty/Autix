'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import { Search, Plus, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTemplateStore } from '@/store/template.store';
import { TemplateCard } from '@/components/template/TemplateCard';
import { AmuxConfigDialog } from '@/components/template/AmuxConfigDialog';
import { TemplateFormDrawer } from '@/components/template/TemplateFormDrawer';

const CATEGORY_KEYS = ['portrait', 'landscape', 'product', 'illustration', 'architecture', 'scifi', 'scene'] as const;
const CATEGORY_API_MAP: Record<string, string> = {
  portrait: '人像', landscape: '风景', product: '产品',
  illustration: '插画', architecture: '建筑', scifi: '科幻', scene: '场景',
};

export default function TemplateMarketPage() {
  const t = useTranslations('template');
  const tCommon = useTranslations('common');
  const tCat = useTranslations('categoryOptions');
  const router = useRouter();
  const {
    templates, loading, category, search, sort,
    setCategory, setSearch, setSort, fetchTemplates,
  } = useTemplateStore();
  const [searchInput, setSearchInput] = useState(search);
  const [activeView, setActiveView] = useState<string>('recommended');
  const [showFormDrawer, setShowFormDrawer] = useState(false);

  useEffect(() => { fetchTemplates(); }, []);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <aside
        className="w-[200px] flex-shrink-0 overflow-y-auto p-4 space-y-6"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
            {t('discover')}
          </p>
          <div className="space-y-1">
            {([
              { id: 'recommended', label: t('recommended'), sortKey: 'newest' as const },
              { id: 'all', label: t('allTemplates'), sortKey: 'newest' as const },
              { id: 'popular', label: t('popularRanking'), sortKey: 'popular' as const },
              { id: 'newest', label: t('latestPublished'), sortKey: 'newest' as const },
            ]).map(({ id, label, sortKey }) => (
              <button
                key={id}
                className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors"
                style={{
                  color: activeView === id ? 'var(--foreground)' : 'var(--muted)',
                  backgroundColor: activeView === id ? 'var(--nav-item-active)' : 'transparent',
                }}
                onClick={() => {
                  setActiveView(id);
                  setSort(sortKey);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
            {t('categories')}
          </p>
          <div className="space-y-1">
            {CATEGORY_KEYS.map((key) => {
              const apiVal = CATEGORY_API_MAP[key];
              return (
                <button
                  key={key}
                  className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors"
                  style={{
                    color: category === apiVal ? 'var(--foreground)' : 'var(--muted)',
                    backgroundColor: category === apiVal ? 'var(--nav-item-active)' : 'transparent',
                  }}
                  onClick={() => setCategory(category === apiVal ? '' : apiVal)}
                >
                  {tCat(key)}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          variant="primary"
          className="w-full cursor-pointer"
          onPress={() => setShowFormDrawer(true)}
        >
          <Plus className="w-4 h-4 mr-1" /> {t('publishTemplate')}
        </Button>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Banner */}
        <div
          className="rounded-xl p-6"
          style={{ background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, transparent) 100%)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-6 h-6" style={{ color: 'var(--foreground)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('headline')}
            </h2>
          </div>
          <p className="text-sm opacity-80" style={{ color: 'var(--foreground)' }}>
            {t('subline')}
          </p>
        </div>

        {/* Search + Category Tabs */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted)' }} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('searchPlaceholder')}
              className="w-full h-10 pl-10 pr-3 text-sm rounded-lg outline-none"
              style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                backgroundColor: !category ? 'var(--accent)' : 'var(--panel-muted)',
                color: !category ? '#fff' : 'var(--muted)',
              }}
              onClick={() => setCategory('')}
            >
              {tCommon('all')}
            </button>
            {CATEGORY_KEYS.map((key) => {
              const apiVal = CATEGORY_API_MAP[key];
              const isActive = category === apiVal;
              return (
                <button
                  key={key}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: isActive ? 'var(--accent)' : 'var(--panel-muted)',
                    color: isActive ? '#fff' : 'var(--muted)',
                  }}
                  onClick={() => setCategory(isActive ? '' : apiVal)}
                >
                  {tCat(key)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Template Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('noTemplates')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {templates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onClick={() => router.push(`/templates/${tpl.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <AmuxConfigDialog />
      <TemplateFormDrawer
        open={showFormDrawer}
        onClose={() => setShowFormDrawer(false)}
        onSaved={() => fetchTemplates()}
      />
    </div>
  );
}
