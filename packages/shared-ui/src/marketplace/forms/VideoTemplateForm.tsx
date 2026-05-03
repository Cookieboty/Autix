'use client';

import { useState, useMemo } from 'react';
import { Button } from '@heroui/react';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { videoTemplateApi, type TemplateVariable } from '@autix/shared-lib';
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
  NumberField,
  VariablesEditor,
  initialCommonState,
  buildCommonPayload,
  type CommonFormState,
  type CategoryOption,
} from './shared';

const CATEGORY_KEYS = [
  'marketing',
  'education',
  'story',
  'festival',
  'product',
] as const;
const KEY_TO_VALUE: Record<(typeof CATEGORY_KEYS)[number], string> = {
  marketing: '营销',
  education: '教学',
  story: '故事',
  festival: '节日',
  product: '产品',
};

interface Props {
  onSaved: () => void;
}

export function VideoTemplateForm({ onSaved }: Props) {
  const t = useTranslations('publish');
  const tCat = useTranslations('videoCategoryOptions');
  const categories = useMemo<CategoryOption[]>(
    () =>
      CATEGORY_KEYS.map((k) => ({ value: KEY_TO_VALUE[k], label: tCat(k) })),
    [tCat],
  );

  const [common, setCommon] = useState<CommonFormState>(() =>
    initialCommonState(KEY_TO_VALUE.marketing),
  );
  const [prompt, setPrompt] = useState('');
  const [modelHint, setModelHint] = useState('');
  const [durationSec, setDurationSec] = useState<number | undefined>(15);
  const [exampleMedia, setExampleMedia] = useState<(string | undefined)[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!common.title.trim() && !!prompt.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await videoTemplateApi.create({
        ...buildCommonPayload(common),
        prompt: prompt.trim(),
        variables: variables.filter((v) => v.key && v.label),
        exampleMedia: exampleMedia.filter(Boolean) as string[],
        modelHint: modelHint.trim() || undefined,
        durationSec,
      } as Parameters<typeof videoTemplateApi.create>[0]);
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
            placeholder={t('videoTitlePlaceholder')}
          />
          <TextAreaField
            label={t('fieldDescription')}
            value={common.description}
            onChange={(v) => setCommon({ ...common, description: v })}
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
          placeholder={t('videoPromptPlaceholder')}
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
            folder="video-templates"
          />
          <ExampleMediaField
            label={t('videoExampleLabel')}
            values={exampleMedia}
            onChange={setExampleMedia}
            folder="video-templates"
          />
        </div>
      </DrawerSection>

      <DrawerSection title={t('sectionAdvanced')}>
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label={t('videoRecommendedModel')}
            value={modelHint}
            onChange={setModelHint}
            placeholder={t('videoModelPlaceholder')}
          />
          <NumberField
            label={t('videoDurationLabel')}
            value={durationSec}
            onChange={setDurationSec}
            min={3}
            max={600}
            placeholder={t('videoDurationPlaceholder')}
          />
          <TagsField
            value={common.tags}
            onChange={(v) => setCommon({ ...common, tags: v })}
          />
          <PointsCostField
            value={common.pointsCost}
            onChange={(v) => setCommon({ ...common, pointsCost: v })}
            hint={t('videoPointsHint')}
          />
          <div className="col-span-2">
            <RuntimeOverrideField
              value={common.runtimeOverride}
              onChange={(v) => setCommon({ ...common, runtimeOverride: v })}
              fixedReason={t('videoRuntimeFixed')}
            />
          </div>
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
          variant="primary"
          className="cursor-pointer"
          isDisabled={submitting || !canSubmit}
          onPress={handleSubmit}
        >
          <Send className="w-4 h-4 mr-1" />
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </DrawerBody>
  );
}
