'use client';

import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import type { TemplateVariable } from '@autix/shared-store';
import { DrawerSection } from '../drawer-shell';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { ImageUploader } from './ImageUploader';
import { LEGACY_TEMPLATE_CATEGORY_VALUES, TEMPLATE_CATEGORY_KEYS } from './category-utils';

const CATEGORY_API_MAP = LEGACY_TEMPLATE_CATEGORY_VALUES;

interface TemplateFormFieldsProps {
  title: string;
  description: string;
  category: string;
  prompt: string;
  variables: TemplateVariable[];
  coverImage?: string;
  exampleImages: (string | undefined)[];
  modelHint: string;
  tags: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onAddVariable: () => void;
  onRemoveVariable: (index: number) => void;
  onVariableChange: (index: number, field: keyof TemplateVariable, value: string) => void;
  onCoverImageChange: (value: string | undefined) => void;
  onAddExampleSlot: () => void;
  onExampleImageChange: (index: number, value: string | undefined) => void;
  onModelHintChange: (value: string) => void;
  onTagsChange: (value: string) => void;
}

export function TemplateFormFields({
  title,
  description,
  category,
  prompt,
  variables,
  coverImage,
  exampleImages,
  modelHint,
  tags,
  onTitleChange,
  onDescriptionChange,
  onCategoryChange,
  onPromptChange,
  onAddVariable,
  onRemoveVariable,
  onVariableChange,
  onCoverImageChange,
  onAddExampleSlot,
  onExampleImageChange,
  onModelHintChange,
  onTagsChange,
}: TemplateFormFieldsProps) {
  const t = useTranslations('template');
  const tCommon = useTranslations('common');
  const tCat = useTranslations('categoryOptions');

  return (
    <>
      <DrawerSection title={t('basicInfo')}>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">{t('title')} *</label>
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={t('titlePlaceholder')}
              className="w-full h-10 px-3 text-sm rounded-md outline-none border border-input bg-background text-foreground"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">{t('description')}</label>
            <textarea
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none border border-input bg-background text-foreground"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">{t('category')} *</label>
            <div className="flex gap-2 flex-wrap">
              {TEMPLATE_CATEGORY_KEYS.map((key) => {
                const apiVal = CATEGORY_API_MAP[key];
                const active = category === apiVal;
                return (
                  <button
                    key={key}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                    onClick={() => onCategoryChange(apiVal)}
                  >
                    {tCat(key)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DrawerSection>

      <DrawerSection title={t('prompt')} description={t('promptDescription')}>
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder={t('promptPlaceholder')}
          rows={6}
          className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none font-mono border border-input bg-background text-foreground"
        />
      </DrawerSection>

      <DrawerSection title={t('variableDefinition')}>
        <div className="space-y-2">
          {variables.map((variable, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                value={variable.key}
                onChange={(event) => onVariableChange(index, 'key', event.target.value)}
                placeholder={t('variableName')}
                className="flex-1 h-8 px-2 text-xs rounded-md outline-none font-mono border border-input bg-background text-foreground"
              />
              <input
                value={variable.label}
                onChange={(event) => onVariableChange(index, 'label', event.target.value)}
                placeholder={t('variableLabel')}
                className="flex-1 h-8 px-2 text-xs rounded-md outline-none border border-input bg-background text-foreground"
              />
              <Select
                value={variable.type}
                onValueChange={(value) => onVariableChange(index, 'type', value)}
              >
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">{t('typeText')}</SelectItem>
                  <SelectItem value="select">{t('typeSelect')}</SelectItem>
                  <SelectItem value="number">{t('typeNumber')}</SelectItem>
                </SelectContent>
              </Select>
              <input
                value={variable.default ?? ''}
                onChange={(event) => onVariableChange(index, 'default', event.target.value)}
                placeholder={t('defaultValue')}
                className="flex-1 h-8 px-2 text-xs rounded-md outline-none border border-input bg-background text-foreground"
              />
              <button className="p-1 cursor-pointer" onClick={() => onRemoveVariable(index)}>
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={onAddVariable}>
            <Plus className="w-3.5 h-3.5 mr-1" /> {t('addVariable')}
          </Button>
        </div>
      </DrawerSection>

      <DrawerSection title={t('images')}>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">{t('coverImage')}</label>
            <ImageUploader value={coverImage} onChange={onCoverImageChange} folder="templates" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">{t('exampleImages')}</label>
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={onAddExampleSlot}>
                <Plus className="w-3.5 h-3.5 mr-1" /> {tCommon('add')}
              </Button>
            </div>
            {exampleImages.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {exampleImages.map((image, index) => (
                  <ImageUploader
                    key={index}
                    value={image}
                    onChange={(url) => onExampleImageChange(index, url)}
                    folder="templates"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DrawerSection>

      <DrawerSection title={t('other')}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">{t('recommendedModel')}</label>
            <input
              value={modelHint}
              onChange={(event) => onModelHintChange(event.target.value)}
              placeholder="gpt-image-1"
              className="w-full h-9 px-3 text-sm rounded-md outline-none border border-input bg-background text-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">{t('tags')}</label>
            <input
              value={tags}
              onChange={(event) => onTagsChange(event.target.value)}
              placeholder={t('tagsPlaceholder')}
              className="w-full h-9 px-3 text-sm rounded-md outline-none border border-input bg-background text-foreground"
            />
          </div>
        </div>
      </DrawerSection>
    </>
  );
}
