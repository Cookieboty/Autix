'use client';

import { useState, useMemo } from 'react';
import { Button } from '@heroui/react';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { agentApi, type TemplateVariable } from '@autix/shared-lib';
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
  'product',
  'engineering',
  'marketing',
  'support',
  'hr',
  'other',
] as const;
const KEY_TO_VALUE: Record<(typeof CATEGORY_KEYS)[number], string> = {
  product: '产品',
  engineering: '研发',
  marketing: '营销',
  support: '客服',
  hr: '人事',
  other: '其他',
};

interface Props {
  onSaved: () => void;
}

export function AgentForm({ onSaved }: Props) {
  const t = useTranslations('publish');
  const tCat = useTranslations('agentCategoryOptions');
  const categories = useMemo<CategoryOption[]>(
    () =>
      CATEGORY_KEYS.map((k) => ({ value: KEY_TO_VALUE[k], label: tCat(k) })),
    [tCat],
  );

  const [common, setCommon] = useState<CommonFormState>(() =>
    initialCommonState(KEY_TO_VALUE.product),
  );
  const [systemPrompt, setSystemPrompt] = useState('');
  const [defaultModel, setDefaultModel] = useState('gpt-5');
  const [mcpIdsRaw, setMcpIdsRaw] = useState('');
  const [skillIdsRaw, setSkillIdsRaw] = useState('');
  const [exampleMedia, setExampleMedia] = useState<(string | undefined)[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!common.title.trim() && !!systemPrompt.trim();

  const parseIds = (raw: string) =>
    raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const toolBindings = {
      mcps: parseIds(mcpIdsRaw),
      skills: parseIds(skillIdsRaw),
    };

    setSubmitting(true);
    setError(null);
    try {
      await agentApi.create({
        ...buildCommonPayload(common),
        systemPrompt: systemPrompt.trim(),
        defaultModel: defaultModel.trim() || undefined,
        toolBindings,
        variables: variables.filter((v) => v.key && v.label),
        exampleMedia: exampleMedia.filter(Boolean) as string[],
      } as Parameters<typeof agentApi.create>[0]);
      onSaved();
    } catch (e) {
      const err = e as {
        msg?: string;
        response?: { data?: { message?: string; msg?: string } };
        message?: string;
      };
      setError(
        err.msg ??
          err.response?.data?.message ??
          err.response?.data?.msg ??
          err.message ??
          t('submitFailed'),
      );
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
            placeholder={t('agentTitlePlaceholder')}
          />
          <TextAreaField
            label={t('fieldDescription')}
            value={common.description}
            onChange={(v) => setCommon({ ...common, description: v })}
            rows={3}
            placeholder={t('agentDescriptionPlaceholder')}
          />
          <CategoryPicker
            value={common.category}
            onChange={(v) => setCommon({ ...common, category: v })}
            options={categories}
          />
        </div>
      </DrawerSection>

      <DrawerSection
        title={t('sectionAgentSystemPrompt')}
        description={t('agentSystemPromptDescription')}
      >
        <TextAreaField
          label={t('agentSystemPromptLabel')}
          required
          value={systemPrompt}
          onChange={setSystemPrompt}
          rows={12}
          placeholder={t('agentSystemPromptPlaceholder')}
        />
      </DrawerSection>

      <DrawerSection
        title={t('sectionAgentTools')}
        description={t('agentToolsDescription')}
      >
        <div className="grid grid-cols-2 gap-4">
          <TextAreaField
            label={t('agentMcpIds')}
            hint={t('agentIdsHint')}
            value={mcpIdsRaw}
            onChange={setMcpIdsRaw}
            rows={3}
            mono
            placeholder={t('agentMcpIdsPlaceholder')}
          />
          <TextAreaField
            label={t('agentSkillIds')}
            hint={t('agentIdsHint')}
            value={skillIdsRaw}
            onChange={setSkillIdsRaw}
            rows={3}
            mono
            placeholder={t('agentSkillIdsPlaceholder')}
          />
        </div>
      </DrawerSection>

      <DrawerSection
        title={t('sectionVariablesOptional')}
        description={t('agentVariablesDescription')}
      >
        <VariablesEditor variables={variables} onChange={setVariables} />
      </DrawerSection>

      <DrawerSection title={t('sectionCoverExample')}>
        <div className="space-y-4">
          <CoverField
            value={common.coverImage}
            onChange={(v) => setCommon({ ...common, coverImage: v })}
            folder="agents"
          />
          <ExampleMediaField
            label={t('agentExampleLabel')}
            values={exampleMedia}
            onChange={setExampleMedia}
            folder="agents"
          />
        </div>
      </DrawerSection>

      <DrawerSection title={t('sectionAdvanced')}>
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label={t('agentDefaultModel')}
            value={defaultModel}
            onChange={setDefaultModel}
            placeholder={t('agentDefaultModelPlaceholder')}
          />
          <TagsField
            value={common.tags}
            onChange={(v) => setCommon({ ...common, tags: v })}
          />
          <PointsCostField
            value={common.pointsCost}
            onChange={(v) => setCommon({ ...common, pointsCost: v })}
            hint={t('agentPointsHint')}
          />
          <RuntimeOverrideField
            value={common.runtimeOverride}
            onChange={(v) => setCommon({ ...common, runtimeOverride: v })}
            detectionHint={t('agentDetectionHint')}
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
