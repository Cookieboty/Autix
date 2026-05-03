'use client';

import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { skillApi, type TemplateVariable } from '@autix/shared-lib';
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
  'engineering',
  'writing',
  'design',
  'data',
  'ops',
  'other',
] as const;
const KEY_TO_VALUE: Record<(typeof CATEGORY_KEYS)[number], string> = {
  engineering: '研发',
  writing: '写作',
  design: '设计',
  data: '数据',
  ops: '运营',
  other: '其他',
};

const DEFAULT_MARKDOWN = `---
name: Code Review Expert
description: Review PR diffs with a senior engineer lens
model: gpt-5
tags:
  - code-review
---

# Instructions

Review code for correctness, risks, tests, and maintainability. Lead with concrete findings, cite file paths when available, and keep summaries brief.`;

interface Props {
  onSaved: () => void;
}

export function SkillForm({ onSaved }: Props) {
  const t = useTranslations('publish');
  const tCat = useTranslations('skillCategoryOptions');
  const categories = useMemo<CategoryOption[]>(
    () =>
      CATEGORY_KEYS.map((k) => ({ value: KEY_TO_VALUE[k], label: tCat(k) })),
    [tCat],
  );

  const [common, setCommon] = useState<CommonFormState>(() =>
    initialCommonState(KEY_TO_VALUE.engineering),
  );
  const [rawMarkdown, setRawMarkdown] = useState(DEFAULT_MARKDOWN);
  const [modelHint, setModelHint] = useState('');
  const [exampleMedia, setExampleMedia] = useState<(string | undefined)[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!rawMarkdown.trim() && !!common.category;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await skillApi.create({
        ...buildCommonPayload(common),
        rawMarkdown: rawMarkdown.trim(),
        sourceFormat: 'skill_md',
        variables: variables.filter((v) => v.key && v.label),
        exampleMedia: exampleMedia.filter(Boolean) as string[],
        modelHint: modelHint.trim() || undefined,
      } as Parameters<typeof skillApi.create>[0]);
      onSaved();
    } catch (e) {
      const err = e as {
        code?: string;
        msg?: string;
        response?: { data?: { code?: string; message?: string; msg?: string } };
        message?: string;
      };
      const code = err.code ?? err.response?.data?.code;
      const message =
        err.msg ?? err.response?.data?.message ?? err.response?.data?.msg ?? err.message;
      if (code === 'SUSPECTED_DESKTOP') {
        setError(
          t('skillSuspectedDesktop', {
            reason: message ?? t('skillSuspectedReasonUnknown'),
          }),
        );
      } else {
        setError(message ?? t('submitFailed'));
      }
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
            hint={t('skillTitleOptionalHint')}
            value={common.title}
            onChange={(v) => setCommon({ ...common, title: v })}
            placeholder={t('skillTitlePlaceholder')}
          />
          <TextAreaField
            label={t('fieldDescription')}
            value={common.description}
            onChange={(v) => setCommon({ ...common, description: v })}
            rows={3}
            placeholder={t('skillDescriptionPlaceholder')}
          />
          <CategoryPicker
            value={common.category}
            onChange={(v) => setCommon({ ...common, category: v })}
            options={categories}
          />
        </div>
      </DrawerSection>

      <DrawerSection
        title={t('sectionSkillInstructions')}
        description={t('skillMarkdownDescription')}
      >
        <TextAreaField
          label={t('skillMarkdownLabel')}
          required
          value={rawMarkdown}
          onChange={setRawMarkdown}
          rows={16}
          mono
          placeholder={t('skillMarkdownPlaceholder')}
        />
      </DrawerSection>

      <DrawerSection
        title={t('sectionVariablesOptional')}
        description={t('skillVariablesDescription')}
      >
        <VariablesEditor variables={variables} onChange={setVariables} />
      </DrawerSection>

      <DrawerSection title={t('sectionCoverExample')}>
        <div className="space-y-4">
          <CoverField
            value={common.coverImage}
            onChange={(v) => setCommon({ ...common, coverImage: v })}
            folder="skills"
          />
          <ExampleMediaField
            label={t('skillExampleLabel')}
            values={exampleMedia}
            onChange={setExampleMedia}
            folder="skills"
          />
        </div>
      </DrawerSection>

      <DrawerSection title={t('sectionAdvanced')}>
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label={t('skillRecommendedModel')}
            value={modelHint}
            onChange={setModelHint}
            placeholder={t('skillModelPlaceholder')}
          />
          <TagsField
            value={common.tags}
            onChange={(v) => setCommon({ ...common, tags: v })}
          />
          <PointsCostField
            value={common.pointsCost}
            onChange={(v) => setCommon({ ...common, pointsCost: v })}
            hint={t('skillPointsHint')}
          />
          <RuntimeOverrideField
            value={common.runtimeOverride}
            onChange={(v) => setCommon({ ...common, runtimeOverride: v })}
            detectionHint={t('skillRuntimeDetectionHint')}
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
