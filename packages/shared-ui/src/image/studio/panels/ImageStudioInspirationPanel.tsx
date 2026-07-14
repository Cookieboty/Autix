'use client';

import {
  Images,
  LayoutTemplate,
  Loader2,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  ImageTemplate,
  ImageWorkbenchHistoryItem,
  MaterialAsset,
} from '@autix/shared-store';
import type { ImageResultItem } from '../../../chat/MessageBubble';
import type { InspirationTab } from '../constants';
import { TEMPLATE_SORT_VALUES } from '../constants';
import { TabButton } from '../../../pricing/SchemaForm/primitives/PrimitiveControls';
import { SelectLike } from '../../../pricing/SchemaForm/primitives/SelectLike';
import { ImageTemplateCard } from '../cards/ImageTemplateCard';
import {
  ImageHistoryTaskCard,
  MaterialImageCard,
} from '../cards/ImageResultCards';

export function ImageStudioInspirationPanel({
  tab,
  onTabChange,
  onClose,
  historyItems,
  materialImages,
  materialsLoading,
  templates,
  templatesLoading,
  templateSearch,
  onTemplateSearchChange,
  templateCategory,
  onTemplateCategoryChange,
  templateSort,
  onTemplateSortChange,
  templateCategories,
  selectedSourceUrls,
  onPreviewImage,
  onPreviewMaterial,
  onUseHistoryImage,
  onApplyHistoryTask,
  onAddImageToMaterial,
  onDeleteHistoryTask,
  onUseMaterial,
  onDeleteMaterial,
  onApplyTemplate,
}: {
  tab: InspirationTab;
  onTabChange: (tab: InspirationTab) => void;
  onClose: () => void;
  historyItems: ImageWorkbenchHistoryItem[];
  materialImages: MaterialAsset[];
  materialsLoading: boolean;
  templates: ImageTemplate[];
  templatesLoading: boolean;
  templateSearch: string;
  onTemplateSearchChange: (value: string) => void;
  templateCategory: string;
  onTemplateCategoryChange: (value: string) => void;
  templateSort: string;
  onTemplateSortChange: (value: string) => void;
  templateCategories: string[];
  selectedSourceUrls: Set<string>;
  onPreviewImage: (image: ImageResultItem) => void;
  onPreviewMaterial: (asset: MaterialAsset) => void;
  onUseHistoryImage: (image: ImageResultItem) => void;
  onApplyHistoryTask: (item: ImageWorkbenchHistoryItem) => void;
  onAddImageToMaterial?: (image: ImageResultItem) => void;
  onDeleteHistoryTask?: (item: ImageWorkbenchHistoryItem) => void;
  onUseMaterial: (asset: MaterialAsset) => void;
  onDeleteMaterial?: (asset: MaterialAsset) => void;
  onApplyTemplate: (template: ImageTemplate) => void;
}) {
  const t = useTranslations('imageStudio');
  const tTemplateSort = useTranslations('imageStudio.templateSort');

  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{t('inspiration.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('inspiration.subtitle')}</p>
          </div>
          <button
            type="button"
            aria-label={t('inspiration.close')}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground xl:hidden"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
          <TabButton
            active={tab === 'history'}
            onClick={() => onTabChange('history')}
            icon={<Images className="size-3.5" />}
          >
            {t('inspiration.tabs.history')}
          </TabButton>
          <TabButton
            active={tab === 'materials'}
            onClick={() => onTabChange('materials')}
            icon={<Upload className="size-3.5" />}
          >
            {t('inspiration.tabs.materials')}
          </TabButton>
          <TabButton
            active={tab === 'templates'}
            onClick={() => onTabChange('templates')}
            icon={<LayoutTemplate className="size-3.5" />}
          >
            {t('inspiration.tabs.templates')}
          </TabButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'history' ? (
          historyItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border px-8 text-center">
              <Images className="mb-2 size-8 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">{t('inspiration.history.empty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyItems.map((item) => (
                <ImageHistoryTaskCard
                  key={item.id}
                  item={item}
                  selectedUrls={selectedSourceUrls}
                  onPreview={onPreviewImage}
                  onUseAsSource={onUseHistoryImage}
                  onApplyTask={() => onApplyHistoryTask(item)}
                  onAddToMaterial={onAddImageToMaterial}
                  onDeleteTask={onDeleteHistoryTask ? () => onDeleteHistoryTask(item) : undefined}
                />
              ))}
            </div>
          )
        ) : tab === 'materials' ? (
          materialsLoading ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-12 text-xs text-muted-foreground">
              <Loader2 className="mr-2 size-3.5 animate-spin" />
              {t('inspiration.materials.loading')}
            </div>
          ) : materialImages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border px-8 text-center">
              <Upload className="mb-2 size-8 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">{t('inspiration.materials.empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {materialImages.map((asset, index) => (
                <MaterialImageCard
                  key={asset.id}
                  asset={asset}
                  index={index}
                  selected={selectedSourceUrls.has(asset.url)}
                  onPreview={() => onPreviewMaterial(asset)}
                  onUseAsSource={() => onUseMaterial(asset)}
                  onDelete={onDeleteMaterial ? () => onDeleteMaterial(asset) : undefined}
                />
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
                  placeholder={t('template.searchPlaceholder')}
                  value={templateSearch}
                  onChange={(event) => onTemplateSearchChange(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SelectLike
                  value={templateCategory}
                  options={[
                    { label: t('template.allCategories'), value: 'all' },
                    ...templateCategories.map((category) => ({ label: category, value: category })),
                  ]}
                  onChange={onTemplateCategoryChange}
                />
                <SelectLike
                  value={templateSort}
                  options={TEMPLATE_SORT_VALUES.map((value) => ({ label: tTemplateSort(value), value }))}
                  onChange={onTemplateSortChange}
                />
              </div>
            </div>

            {templatesLoading ? (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-12 text-xs text-muted-foreground">
                <Loader2 className="mr-2 size-3.5 animate-spin" />
                {t('template.loading')}
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-8 py-12 text-center">
                <LayoutTemplate className="mb-2 size-8 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground">{t('template.empty')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <ImageTemplateCard
                    key={template.id}
                    template={template}
                    onApply={() => onApplyTemplate(template)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
