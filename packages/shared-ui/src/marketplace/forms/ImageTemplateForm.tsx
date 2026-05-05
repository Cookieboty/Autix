'use client';

import { useState, useMemo } from 'react';
import { Button } from '../../ui/button';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { imageTemplateApi, type TemplateVariable } from '@autix/shared-lib';
import { DrawerBody, DrawerSection } from '../../drawer-shell';
import {
  TextField,
  TextAreaField,
  TagsField,
  CategoryPicker,
  CoverField,
  ExampleMediaField,
  PointsCostField,
  RuntimeOverrideField,
  VariablesEditor,
  initialCommonState,
  buildCommonPayload,
  type CommonFormState,
  type CategoryOption,
} from './shared';

const CATEGORY_KEYS = [
  'portrait',
  'landscape',
  'product',
  'illustration',
  'architecture',
  'scifi',
  'scene',
] as const;
const KEY_TO_VALUE: Record<(typeof CATEGORY_KEYS)[number], string> = {
  portrait: '人像',
  landscape: '风景',
  product: '产品',
  illustration: '插画',
  architecture: '建筑',
  scifi: '科幻',
  scene: '场景',
};

interface Props {
  onSaved: () => void;
}

export function ImageTemplateForm({ onSaved }: Props) {
  const t = useTranslations('publish');
  const tCat = useTranslations('categoryOptions');
  const categories = useMemo<CategoryOption[]>(
    () =>
      CATEGORY_KEYS.map((k) => ({ value: KEY_TO_VALUE[k], label: tCat(k) })),
    [tCat],
  );

  const [common, setCommon] = useState<CommonFormState>(() =>
    initialCommonState(KEY_TO_VALUE.portrait),
  );
  const [prompt, setPrompt] = useState('');
  const [modelHint, setModelHint] = useState('');
  const [exampleImages, setExampleImages] = useState<(string | undefined)[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!common.title.trim() && !!prompt.trim() && !!common.category;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await imageTemplateApi.create({
        ...buildCommonPayload(common),
        prompt: prompt.trim(),
        variables: variables.filter((v) => v.key && v.label),
        exampleImages: exampleImages.filter(Boolean) as string[],
        modelHint: modelHint.trim() || undefined,
      } as Parameters<typeof imageTemplateApi.create>[0]);
      onSaved();
    } catch (e) {
      setError((e as Error).message ?? t('submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DrawerBody>
      <DrawerSection title={t('sectionBasic')}>
        <div className="space-y-4">
          <TextField
            label={t('fieldTitle')}
            required
            value={common.title}
            onChange={(v) => setCommon({ ...common, title: v })}
            placeholder={t('imageTitlePlaceholder')}
          />
          <TextAreaField
            label={t('fieldDescription')}
            value={common.description}
            onChange={(v) => setCommon({ ...common, description: v })}
            placeholder={t('imageDescriptionPlaceholder')}
            rows={3}
          />
          <CategoryPicker
            value={common.category}
            onChange={(v) => setCommon({ ...common, category: v })}
            options={categories}
          />
        </div>
      </DrawerSection>

      <DrawerSection
        title={t('sectionPrompt')}
        description={t('imagePromptDescription')}
      >
        <TextAreaField
          label="Prompt"
          required
          value={prompt}
          onChange={setPrompt}
          rows={6}
          mono
          placeholder={t('imagePromptPlaceholder')}
        />
      </DrawerSection>

      <DrawerSection title={t('sectionVariables')}>
        <VariablesEditor
          variables={variables}
          onChange={setVariables}
          description={t('imageVariablesDescription')}
        />
      </DrawerSection>

      <DrawerSection title={t('sectionCoverExample')}>
        <div className="space-y-4">
          <CoverField
            value={common.coverImage}
            onChange={(v) => setCommon({ ...common, coverImage: v })}
            folder="image-templates"
          />
          <ExampleMediaField
            label={t('imageExampleLabel')}
            values={exampleImages}
            onChange={setExampleImages}
            folder="image-templates"
          />
        </div>
      </DrawerSection>

      <DrawerSection title={t('sectionAdvanced')}>
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label={t('imageRecommendedModel')}
            value={modelHint}
            onChange={setModelHint}
            placeholder={t('imageModelPlaceholder')}
          />
          <TagsField
            value={common.tags}
            onChange={(v) => setCommon({ ...common, tags: v })}
          />
          <PointsCostField
            value={common.pointsCost}
            onChange={(v) => setCommon({ ...common, pointsCost: v })}
            hint={t('imagePointsHint')}
          />
          <RuntimeOverrideField
            value={common.runtimeOverride}
            onChange={(v) => setCommon({ ...common, runtimeOverride: v })}
            fixedReason={t('imageRuntimeFixed')}
          />
        </div>
      </DrawerSection>

      {error ? (
        <div
          className="rounded-md px-3 py-2 text-xs"
          style={{
            border: '1px solid var(--danger)',
            backgroundColor: 'var(--panel)',
            color: 'var(--danger)',
          }}
        >
          {error}
        </div>
      ) : null}

      <div className="flex justify-end pt-2">
        <Button
          variant="default"
          className="cursor-pointer"
          disabled={submitting || !canSubmit}
          onClick={handleSubmit}
        >
          <Send className="w-4 h-4 mr-1" />
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </DrawerBody>
  );
}
