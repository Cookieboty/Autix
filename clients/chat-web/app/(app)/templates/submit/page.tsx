'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import { ArrowLeft, Plus, Trash2, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { templateApi, type TemplateVariable } from '@/lib/api';
import { ImageUploader } from '@/components/template/ImageUploader';

const CATEGORY_KEYS = ['portrait', 'landscape', 'product', 'illustration', 'architecture', 'scifi', 'scene'] as const;
const CATEGORY_API_MAP: Record<string, string> = {
  portrait: '人像', landscape: '风景', product: '产品',
  illustration: '插画', architecture: '建筑', scifi: '科幻', scene: '场景',
};

export default function TemplateSubmitPage() {
  const t = useTranslations('template');
  const tCommon = useTranslations('common');
  const tCat = useTranslations('categoryOptions');
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORY_API_MAP['portrait']);
  const [prompt, setPrompt] = useState('');
  const [modelHint, setModelHint] = useState('');
  const [tags, setTags] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>();
  const [exampleImages, setExampleImages] = useState<(string | undefined)[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [submitting, setSubmitting] = useState(false);

  

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
      await templateApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        prompt: prompt.trim(),
        variables: variables.filter((v) => v.key && v.label),
        coverImage,
        exampleImages: exampleImages.filter(Boolean) as string[],
        modelHint: modelHint.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      router.push('/templates');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button isIconOnly variant="ghost" className="cursor-pointer" onPress={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('publishNewTemplate')}
          </h1>
        </div>

        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{t('title')} *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              className="w-full h-10 px-3 text-sm rounded-md outline-none"
              style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{t('description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none"
              style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{t('category')} *</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORY_KEYS.map((key) => {
                const apiVal = CATEGORY_API_MAP[key];
                return (
                  <button
                    key={key}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
                    style={{
                      backgroundColor: category === apiVal ? 'var(--accent)' : 'var(--panel-muted)',
                      color: category === apiVal ? '#fff' : 'var(--muted)',
                    }}
                    onClick={() => setCategory(apiVal)}
                  >
                    {tCat(key)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
              {t('prompt')} *
              <span className="ml-2 font-normal" style={{ color: 'var(--muted)' }}>
                {t('promptDescription')}
              </span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('promptPlaceholder')}
              rows={5}
              className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none font-mono"
              style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Variables */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{t('variableDefinition')}</label>
              <Button size="sm" variant="ghost" className="cursor-pointer" onPress={addVariable}>
                <Plus className="w-3.5 h-3.5 mr-1" /> {t('addVariable')}
              </Button>
            </div>
            {variables.map((v, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={v.key}
                  onChange={(e) => updateVariable(i, 'key', e.target.value)}
                  placeholder={t('variableName')}
                  className="flex-1 h-8 px-2 text-xs rounded-md outline-none font-mono"
                  style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                />
                <input
                  value={v.label}
                  onChange={(e) => updateVariable(i, 'label', e.target.value)}
                  placeholder={t('variableLabel')}
                  className="flex-1 h-8 px-2 text-xs rounded-md outline-none"
                  style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                />
                <select
                  value={v.type}
                  onChange={(e) => updateVariable(i, 'type', e.target.value)}
                  className="w-24 h-8 px-2 text-xs rounded-md outline-none"
                  style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                >
                  <option value="text">{t('typeText')}</option>
                  <option value="select">{t('typeSelect')}</option>
                  <option value="number">{t('typeNumber')}</option>
                </select>
                <button className="p-1 cursor-pointer" onClick={() => removeVariable(i)}>
                  <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
                </button>
              </div>
            ))}
          </div>

          {/* Cover Image */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{t('coverImage')}</label>
            <ImageUploader value={coverImage} onChange={setCoverImage} folder="templates" />
          </div>

          {/* Example Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{t('exampleImages')}</label>
              <Button size="sm" variant="ghost" className="cursor-pointer" onPress={addExampleSlot}>
                <Plus className="w-3.5 h-3.5 mr-1" /> {tCommon('add')}
              </Button>
            </div>
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
          </div>

          {/* Model Hint */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{t('recommendedModel')}</label>
            <input
              value={modelHint}
              onChange={(e) => setModelHint(e.target.value)}
              placeholder="dall-e-3"
              className="w-full h-9 px-3 text-sm rounded-md outline-none"
              style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{t('tags')}</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('tagsPlaceholder')}
              className="w-full h-9 px-3 text-sm rounded-md outline-none"
              style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 pb-10">
          <Button variant="ghost" className="cursor-pointer" onPress={() => router.back()}>
            {tCommon('cancel')}
          </Button>
          <Button
            variant="primary"
            className="cursor-pointer"
            isDisabled={submitting || !title.trim() || !prompt.trim()}
            onPress={handleSubmit}
          >
            <Send className="w-4 h-4 mr-1" /> {submitting ? t('submitting') : t('submitForReview')}
          </Button>
        </div>
      </div>
    </div>
  );
}
