'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Eye, Heart, Pencil, Play } from 'lucide-react';
import { useAuthStore, useTemplateStore } from '@autix/shared-store';
import { Button } from '../ui';
import { InteractionActions, MetricsBar } from '../metrics';
import { FallbackImage } from './FallbackImage';
import { TemplateFormDrawer } from './TemplateFormDrawer';
import { VariableEditor } from './VariableEditor';
import { getTemplateCategoryI18nKey } from './category-utils';

// TemplateDetailView 目前只服务图片模板（templateApi === imageTemplateApi，见
// packages/sdk/src/client.ts）。等视频模板走同一视图时，再从 tpl 上派生真实 kind。
const TEMPLATE_RESOURCE_TYPE = 'IMAGE_TEMPLATE' as const;

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
      (tpl.variables ?? []).forEach((variable) => {
        defaults[variable.key] = variable.default ?? '';
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

        <div
          className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg"
          style={{ backgroundColor: 'var(--panel-muted)', border: '1px solid var(--border)' }}
        >
          <MetricsBar type={TEMPLATE_RESOURCE_TYPE} id={tpl.id} />
          <InteractionActions type={TEMPLATE_RESOURCE_TYPE} id={tpl.id} />
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
                  onChange={(event) => setModelUsed(event.target.value)}
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
                {tpl.exampleImages.map((imgSrc, index) => (
                  <FallbackImage
                    key={index}
                    src={imgSrc}
                    alt={t('exampleNumber', { n: index + 1 })}
                    className="w-full rounded-lg object-cover"
                    style={{ border: '1px solid var(--border)', minHeight: '120px' }}
                    fallbackText={t('exampleNumber', { n: index + 1 })}
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
              <button
                className="flex items-center gap-1.5 cursor-pointer"
                onClick={() => likeTemplate(tpl.id)}
              >
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
