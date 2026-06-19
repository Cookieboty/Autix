'use client';

import { useState, useMemo } from 'react';
import { Button } from '../../ui/button';
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
const VIDEO_MODES = [
  { value: 'reference', labelKey: 'videoModeReference' },
  { value: 'first_last_frame', labelKey: 'videoModeFirstLastFrame' },
  { value: 'smart_multiframe', labelKey: 'videoModeSmartMultiframe' },
] as const;

const RATIO_OPTIONS = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '1:1', label: '1:1' },
  { value: '21:9', label: '21:9' },
  { value: 'adaptive', labelKey: 'videoRatioAdaptive' },
] as const;
const RESOLUTION_OPTIONS = ['720p', '1080p'];

const SLOT_OPTIONS = [
  { role: 'first_frame', labelKey: 'videoSlotFirstFrame' },
  { role: 'last_frame', labelKey: 'videoSlotLastFrame' },
  { role: 'reference_image', labelKey: 'videoSlotReferenceImage' },
  { role: 'reference_video', labelKey: 'videoSlotReferenceVideo' },
  { role: 'reference_audio', labelKey: 'videoSlotReferenceAudio' },
] as const;

type MaterialSlotDraft = {
  role: string;
  label: string;
  required: boolean;
};

interface Props {
  onSaved: () => void;
}

export function VideoTemplateForm({ onSaved }: Props) {
  const t = useTranslations('publish');
  const tCat = useTranslations('videoCategoryOptions');
  const categories = useMemo<CategoryOption[]>(
    () =>
      CATEGORY_KEYS.map((k) => ({ value: k, label: tCat(k) })),
    [tCat],
  );

  const [common, setCommon] = useState<CommonFormState>(() =>
    initialCommonState('marketing'),
  );
  const [prompt, setPrompt] = useState('');
  const [modelHint, setModelHint] = useState('');
  const [durationSec, setDurationSec] = useState<number | undefined>(15);
  const [exampleMedia, setExampleMedia] = useState<(string | undefined)[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [defaultParams, setDefaultParams] = useState({
    mode: 'reference',
    ratio: '16:9',
    resolution: '1080p',
    generateAudio: true,
  });
  const [materialSlots, setMaterialSlots] = useState<MaterialSlotDraft[]>([
    { role: 'reference_image', label: t('videoSlotReferenceImage'), required: false },
    { role: 'reference_video', label: t('videoSlotReferenceVideo'), required: false },
    { role: 'reference_audio', label: t('videoSlotReferenceAudio'), required: false },
  ]);
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
        defaultParams,
        materialSlots,
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
        <div className="mt-5 space-y-4 rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">{t('videoParamsPresetTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('videoParamsPresetDescription')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">{t('videoInputMode')}</span>
              <select
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                value={defaultParams.mode}
                onChange={(e) => setDefaultParams({ ...defaultParams, mode: e.target.value })}
              >
                {VIDEO_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {t(mode.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">{t('videoRatio')}</span>
              <select
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                value={defaultParams.ratio}
                onChange={(e) => setDefaultParams({ ...defaultParams, ratio: e.target.value })}
              >
                {RATIO_OPTIONS.map((ratio) => (
                  <option key={ratio.value} value={ratio.value}>
                    {'labelKey' in ratio ? t(ratio.labelKey) : ratio.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">{t('videoResolution')}</span>
              <select
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                value={defaultParams.resolution}
                onChange={(e) => setDefaultParams({ ...defaultParams, resolution: e.target.value })}
              >
                {RESOLUTION_OPTIONS.map((resolution) => (
                  <option key={resolution} value={resolution}>
                    {resolution}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end rounded-md border border-border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={defaultParams.generateAudio}
                onChange={(e) =>
                  setDefaultParams({ ...defaultParams, generateAudio: e.target.checked })
                }
              />
              {t('videoGenerateAudio')}
            </label>
          </div>
        </div>

        <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">{t('videoMaterialSlotsTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('videoMaterialSlotsDescription')}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SLOT_OPTIONS.map((slot) => {
              const selected = materialSlots.some((item) => item.role === slot.role);
              const required = materialSlots.find((item) => item.role === slot.role)?.required ?? false;
              return (
                <div key={slot.role} className="rounded-md border border-border px-3 py-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setMaterialSlots((cur) => [
                            ...cur,
                            { role: slot.role, label: t(slot.labelKey), required: false },
                          ]);
                        } else {
                          setMaterialSlots((cur) => cur.filter((item) => item.role !== slot.role));
                        }
                      }}
                    />
                    {t(slot.labelKey)}
                  </label>
                  {selected && (
                    <label className="mt-2 flex items-center gap-2 pl-6 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={required}
                        onChange={(e) =>
                          setMaterialSlots((cur) =>
                            cur.map((item) =>
                              item.role === slot.role
                                ? { ...item, required: e.target.checked }
                                : item,
                            ),
                          )
                        }
                      />
                      {t('videoRequiredMaterial')}
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DrawerSection>

      {error ? (
        <div className="rounded-md border border-destructive bg-card px-3 py-2 text-xs text-destructive">
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
