'use client';

import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Plus, Trash2, Send, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DrawerShell,
  DrawerHero,
  DrawerBody,
  DrawerSection,
  DrawerFooterRow,
} from '../drawer-shell';
import { templateApi, type TemplateVariable, type PromptTemplate } from '@autix/shared-lib';
import { ImageUploader } from './ImageUploader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const CATEGORY_KEYS = ['portrait', 'landscape', 'product', 'illustration', 'architecture', 'scifi', 'scene'] as const;
const CATEGORY_API_MAP: Record<string, string> = {
  portrait: '人像', landscape: '风景', product: '产品',
  illustration: '插画', architecture: '建筑', scifi: '科幻', scene: '场景',
};
const API_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_API_MAP).map(([k, v]) => [v, k]),
);

interface TemplateFormDrawerProps {
  open: boolean;
  onClose: () => void;
  template?: PromptTemplate | null;
  onSaved?: () => void;
}

export function TemplateFormDrawer({ open, onClose, template, onSaved }: TemplateFormDrawerProps) {
  const t = useTranslations('template');
  const tCommon = useTranslations('common');
  const tCat = useTranslations('categoryOptions');
  const isEdit = !!template;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('人像');
  const [prompt, setPrompt] = useState('');
  const [modelHint, setModelHint] = useState('');
  const [tags, setTags] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>();
  const [exampleImages, setExampleImages] = useState<(string | undefined)[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setTitle(template.title);
      setDescription(template.description ?? '');
      setCategory(template.category);
      setPrompt(template.prompt);
      setModelHint(template.modelHint ?? '');
      setTags(template.tags.join(', '));
      setCoverImage(template.coverImage);
      setExampleImages(template.exampleImages.length > 0 ? [...template.exampleImages] : []);
      setVariables(template.variables ?? []);
    } else {
      setTitle('');
      setDescription('');
      setCategory(CATEGORY_API_MAP['portrait']);
      setPrompt('');
      setModelHint('');
      setTags('');
      setCoverImage(undefined);
      setExampleImages([]);
      setVariables([]);
    }
  }, [open, template]);

  const addVariable = () => {
    setVariables([...variables, { key: '', label: '', type: 'text' }]);
  };
  const removeVariable = (i: number) => {
    setVariables(variables.filter((_, idx) => idx !== i));
  };
  const updateVariable = (i: number, field: keyof TemplateVariable, value: string) => {
    const copy = [...variables];
    (copy[i] as any)[field] = value;
    setVariables(copy);
  };

  const addExampleSlot = () => setExampleImages([...exampleImages, undefined]);

  const handleSubmit = async () => {
    if (!title.trim() || !prompt.trim() || !category) return;
    setSubmitting(true);
    try {
      const data = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        prompt: prompt.trim(),
        variables: variables.filter((v) => v.key && v.label),
        coverImage,
        exampleImages: exampleImages.filter(Boolean) as string[],
        modelHint: modelHint.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      };

      if (isEdit && template) {
        await templateApi.update(template.id, data);
      } else {
        await templateApi.create(data);
      }
      onSaved?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      width="2xl"
      header={
        <DrawerHero
          eyebrow={t('templateEyebrow')}
          title={isEdit ? t('editTemplate') : t('publishNewTemplate')}
          description={isEdit ? t('editDescription') : t('newDescription')}
        />
      }
      footer={
        <DrawerFooterRow
          aside={!isEdit ? t('reviewNote') : t('editSaveNote')}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="cursor-pointer" onClick={onClose}>
                {tCommon('cancel')}
              </Button>
              <Button
                variant="default"
                className="cursor-pointer"
                disabled={submitting || !title.trim() || !prompt.trim()}
                onClick={handleSubmit}
              >
                {isEdit ? <Save className="w-4 h-4 mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                {submitting ? tCommon('processing') : isEdit ? tCommon('save') : t('submitForReview')}
              </Button>
            </div>
          }
        />
      }
    >
      <DrawerBody>
        <DrawerSection title={t('basicInfo')}>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">{t('title')} *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
                className="w-full h-10 px-3 text-sm rounded-md outline-none border border-input bg-background text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">{t('description')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none border border-input bg-background text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">{t('category')} *</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORY_KEYS.map((key) => {
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
                      onClick={() => setCategory(apiVal)}
                    >
                      {tCat(key)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DrawerSection>

        <DrawerSection
          title={t('prompt')}
          description={t('promptDescription')}
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('promptPlaceholder')}
            rows={6}
            className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none font-mono border border-input bg-background text-foreground"
          />
        </DrawerSection>

        <DrawerSection title={t('variableDefinition')}>
          <div className="space-y-2">
            {variables.map((v, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={v.key}
                  onChange={(e) => updateVariable(i, 'key', e.target.value)}
                  placeholder={t('variableName')}
                  className="flex-1 h-8 px-2 text-xs rounded-md outline-none font-mono border border-input bg-background text-foreground"
                />
                <input
                  value={v.label}
                  onChange={(e) => updateVariable(i, 'label', e.target.value)}
                  placeholder={t('variableLabel')}
                  className="flex-1 h-8 px-2 text-xs rounded-md outline-none border border-input bg-background text-foreground"
                />
                <Select
                  value={v.type}
                  onValueChange={(val) => updateVariable(i, 'type', val)}
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
                  value={v.default ?? ''}
                  onChange={(e) => updateVariable(i, 'default', e.target.value)}
                  placeholder={t('defaultValue')}
                  className="flex-1 h-8 px-2 text-xs rounded-md outline-none border border-input bg-background text-foreground"
                />
                <button className="p-1 cursor-pointer" onClick={() => removeVariable(i)}>
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="cursor-pointer" onClick={addVariable}>
              <Plus className="w-3.5 h-3.5 mr-1" /> {t('addVariable')}
            </Button>
          </div>
        </DrawerSection>

        <DrawerSection title={t('images')}>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">{t('coverImage')}</label>
              <ImageUploader value={coverImage} onChange={setCoverImage} folder="templates" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">{t('exampleImages')}</label>
                <Button size="sm" variant="ghost" className="cursor-pointer" onClick={addExampleSlot}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> {tCommon('add')}
                </Button>
              </div>
              {exampleImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {exampleImages.map((img, i) => (
                    <ImageUploader
                      key={i}
                      value={img}
                      onChange={(url) => {
                        const copy = [...exampleImages];
                        copy[i] = url;
                        setExampleImages(copy);
                      }}
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
                onChange={(e) => setModelHint(e.target.value)}
                placeholder="gpt-image-1"
                className="w-full h-9 px-3 text-sm rounded-md outline-none border border-input bg-background text-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">{t('tags')}</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={t('tagsPlaceholder')}
                className="w-full h-9 px-3 text-sm rounded-md outline-none border border-input bg-background text-foreground"
              />
            </div>
          </div>
        </DrawerSection>
      </DrawerBody>
    </DrawerShell>
  );
}
