'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Eye, Heart, Pencil, Play, Plus, Search, Sparkles } from 'lucide-react';
import { useAuthStore, useTemplateStore } from '@autix/shared-store';
import { Button } from '../ui';
import { FallbackImage } from './FallbackImage';
import { TemplateCard } from './TemplateCard';
import { TemplateFormDrawer } from './TemplateFormDrawer';
import { VariableEditor } from './VariableEditor';
import {
  LEGACY_TEMPLATE_CATEGORY_VALUES,
  TEMPLATE_CATEGORY_KEYS,
  getTemplateCategoryI18nKey,
} from './category-utils';

const CATEGORY_API_MAP = LEGACY_TEMPLATE_CATEGORY_VALUES;

export interface TemplatesMarketplaceViewProps {
  onOpenTemplate: (id: string) => void;
}

export function TemplatesMarketplaceView({ onOpenTemplate }: TemplatesMarketplaceViewProps) {
  const t = useTranslations('template');
  const tCommon = useTranslations('common');
  const tCat = useTranslations('categoryOptions');
  const {
    templates,
    loading,
    category,
    search,
    setCategory,
    setSearch,
    setSort,
    fetchTemplates,
  } = useTemplateStore();
  const [searchInput, setSearchInput] = useState(search);
  const [activeView, setActiveView] = useState<string>('recommended');
  const [showFormDrawer, setShowFormDrawer] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSearch = () => setSearch(searchInput);

  return (
    <div className="flex h-full overflow-hidden">
      <aside
        className="w-[200px] flex-shrink-0 overflow-y-auto p-4 space-y-6"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        <div>
          <p
            className="text-[11px] font-medium uppercase tracking-widest mb-3"
            style={{ color: 'var(--muted)' }}
          >
            {t('discover')}
          </p>
          <div className="space-y-1">
            {(
              [
                { id: 'recommended', label: t('recommended'), sortKey: 'newest' as const },
                { id: 'all', label: t('allTemplates'), sortKey: 'newest' as const },
                { id: 'popular', label: t('popularRanking'), sortKey: 'popular' as const },
                { id: 'newest', label: t('latestPublished'), sortKey: 'newest' as const },
              ] as const
            ).map(({ id, label, sortKey }) => (
              <button
                key={id}
                className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors"
                style={{
                  color: activeView === id ? 'var(--foreground)' : 'var(--muted)',
                  backgroundColor:
                    activeView === id ? 'var(--nav-item-active)' : 'transparent',
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
          <p
            className="text-[11px] font-medium uppercase tracking-widest mb-3"
            style={{ color: 'var(--muted)' }}
          >
            {t('categories')}
          </p>
          <div className="space-y-1">
            {TEMPLATE_CATEGORY_KEYS.map((key) => {
              const apiVal = CATEGORY_API_MAP[key];
              return (
                <button
                  key={key}
                  className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors"
                  style={{
                    color: category === apiVal ? 'var(--foreground)' : 'var(--muted)',
                    backgroundColor:
                      category === apiVal ? 'var(--nav-item-active)' : 'transparent',
                  }}
                  onClick={() => setCategory(category === apiVal ? '' : apiVal)}
                >
                  {tCat(key)}
                </button>
              );
            })}
          </div>
        </div>

        <Button className="w-full cursor-pointer" onClick={() => setShowFormDrawer(true)}>
          <Plus className="w-4 h-4 mr-1" /> {t('publishTemplate')}
        </Button>
      </aside>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div
          className="rounded-xl p-6"
          style={{
            background:
              'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, transparent) 100%)',
          }}
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

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--muted)' }}
            />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('searchPlaceholder')}
              className="w-full h-10 pl-10 pr-3 text-sm rounded-lg outline-none"
              style={{
                border: '1px solid var(--input-border)',
                backgroundColor: 'var(--input-bg)',
                color: 'var(--foreground)',
              }}
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
            {TEMPLATE_CATEGORY_KEYS.map((key) => {
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

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>
              {tCommon('loading')}
            </span>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {t('noTemplates')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {templates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onClick={() => onOpenTemplate(tpl.id)}
              />
            ))}
          </div>
        )}
      </div>

      <TemplateFormDrawer
        open={showFormDrawer}
        onClose={() => setShowFormDrawer(false)}
        onSaved={() => fetchTemplates()}
      />
    </div>
  );
}

export interface TemplateDetailViewProps {
  templateId?: string;
  onBackToList: () => void;
  onOpenWorkspace: (generationId: string) => void;
}

export function TemplateDetailView({
  templateId,
  onBackToList,
  onOpenWorkspace,
}: TemplateDetailViewProps) {
  const t = useTranslations('template');
  const tCommon = useTranslations('common');
  const tCat = useTranslations('categoryOptions');
  const {
    currentTemplate: tpl,
    fetchTemplate,
    likeTemplate,
    createGeneration,
  } = useTemplateStore();

  const [variables, setVariables] = useState<Record<string, string>>({});
  const [modelUsed, setModelUsed] = useState('');
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const { user, isAdmin } = useAuthStore();

  useEffect(() => {
    if (templateId) fetchTemplate(templateId);
  }, [templateId, fetchTemplate]);

  useEffect(() => {
    if (tpl) {
      const defaults: Record<string, string> = {};
      (tpl.variables ?? []).forEach((v) => {
        defaults[v.key] = v.default ?? '';
      });
      setVariables(defaults);
      setModelUsed(tpl.modelHint ?? '');
    }
  }, [tpl]);

  if (!tpl) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {tCommon('loading')}
        </span>
      </div>
    );
  }

  const handleGenerate = async () => {
    const gen = await createGeneration(tpl.id, {
      modelUsed: modelUsed || 'gpt-image-2',
      variables,
    });
    onOpenWorkspace(gen.id);
  };

  const userId = (user as { id?: string } | null)?.id;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            className="p-0 w-9 h-9 cursor-pointer mt-1"
            onClick={onBackToList}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                {tpl.title}
              </h1>
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor:
                    tpl.status === 'APPROVED'
                      ? 'color-mix(in srgb, green 20%, transparent)'
                      : 'var(--panel-muted)',
                  color: tpl.status === 'APPROVED' ? 'green' : 'var(--muted)',
                }}
              >
                {tpl.status === 'APPROVED' ? t('approved') : tpl.status}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--muted)' }}>
              <span>
                {t('categoryLabel', {
                  category: tCat(getTemplateCategoryI18nKey(tpl.category)),
                })}
              </span>
              <span>v{tpl.version}</span>
              {tpl.publishedAt && (
                <span>
                  {t('publishedAt', {
                    date: new Date(tpl.publishedAt).toLocaleDateString(),
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(isAdmin || userId === tpl.authorId) && (
              <Button
                variant="ghost"
                className="cursor-pointer"
                onClick={() => setShowEditDrawer(true)}
              >
                <Pencil className="w-4 h-4 mr-1" /> {tCommon('edit')}
              </Button>
            )}
            <Button className="cursor-pointer" onClick={handleGenerate}>
              <Play className="w-4 h-4 mr-1" /> {t('selectTemplateGenerate')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_300px] gap-6">
          <div className="space-y-6">
            {tpl.description && (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {tpl.description}
              </p>
            )}

            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t('prompt')}
              </h3>
              <div
                className="p-4 rounded-lg text-sm leading-7"
                style={{
                  backgroundColor: 'var(--panel-muted)',
                  color: 'var(--foreground)',
                  fontFamily: 'monospace',
                  border: '1px solid var(--border)',
                }}
              >
                {tpl.prompt}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>
                {t('variables')}
              </h3>
              <VariableEditor
                variables={tpl.variables ?? []}
                values={variables}
                onChange={setVariables}
              />
            </div>

            {tpl.modelHint && (
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  {t('recommendedModel')}
                </h3>
                <input
                  value={modelUsed}
                  onChange={(e) => setModelUsed(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-md outline-none"
                  style={{
                    border: '1px solid var(--input-border)',
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {t('exampleImages')}
            </h3>
            {tpl.exampleImages.length > 0 ? (
              <div className="space-y-3">
                {tpl.exampleImages.map((imgSrc, i) => (
                  <FallbackImage
                    key={i}
                    src={imgSrc}
                    alt={t('exampleNumber', { n: i + 1 })}
                    className="w-full rounded-lg object-cover"
                    style={{ border: '1px solid var(--border)', minHeight: '120px' }}
                    fallbackText={t('exampleNumber', { n: i + 1 })}
                  />
                ))}
              </div>
            ) : (
              <div
                className="flex items-center justify-center h-48 rounded-lg"
                style={{
                  backgroundColor: 'var(--panel-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  {t('noExamples')}
                </span>
              </div>
            )}

            <div
              className="flex items-center gap-6 p-3 rounded-lg"
              style={{
                backgroundColor: 'var(--panel-muted)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" style={{ color: 'var(--muted)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {tpl.useCount}
                </span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  {t('uses')}
                </span>
              </div>
              <button className="flex items-center gap-1.5 cursor-pointer" onClick={() => likeTemplate(tpl.id)}>
                <Heart className="w-4 h-4" style={{ color: 'var(--muted)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {tpl.likeCount}
                </span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  {t('likes')}
                </span>
              </button>
            </div>

            {tpl.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tpl.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--panel-muted)',
                      color: 'var(--muted)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <TemplateFormDrawer
        open={showEditDrawer}
        onClose={() => setShowEditDrawer(false)}
        template={tpl}
        onSaved={() => templateId && fetchTemplate(templateId)}
      />
    </div>
  );
}
