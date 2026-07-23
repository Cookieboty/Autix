'use client';

import { useState, useMemo } from 'react';
import { Button } from '../../ui/button';
import { Send, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  marketplaceActions,
  type AgentCreateInput,
  type AgentExecutionMode,
  type AgentKind,
  type TemplateVariable,
  type WorkflowStepDef,
} from '@autix/shared-store';
import { DrawerBody, DrawerSection } from '../../drawer-shell';
import {
  TextField,
  TextAreaField,
  SelectField,
  NumberField,
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
const ARTIFACT_TYPE_KEYS = ['MARKDOWN', 'HTML', 'CODE'] as const;

function WorkflowStepEditor({
  step,
  index,
  allStepKeys,
  onUpdate,
  onRemove,
}: {
  step: WorkflowStepDef;
  index: number;
  allStepKeys: string[];
  onUpdate: (patch: Partial<WorkflowStepDef>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const t = useTranslations('publish');
  const artifactTypeOptions = ARTIFACT_TYPE_KEYS.map((value) => ({
    value,
    label: value === 'CODE' ? t('artifactTypeCode') : value,
  }));

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {t('workflowStepTitle', { index: index + 1 })}{step.displayName ? `: ${step.displayName}` : ''}
        </button>
        <button
          type="button"
          className="text-red-500 hover:text-red-700 cursor-pointer"
          onClick={onRemove}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t('workflowStepKey')}
              required
              value={step.stepKey}
              onChange={(v) => onUpdate({ stepKey: v })}
              placeholder={t('workflowStepKeyPlaceholder')}
            />
            <TextField
              label={t('workflowDisplayName')}
              required
              value={step.displayName}
              onChange={(v) => onUpdate({ displayName: v })}
              placeholder={t('workflowDisplayNamePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <SelectField
              label={t('workflowArtifactType')}
              value={step.artifactType}
              onChange={(v) => onUpdate({ artifactType: v })}
              options={artifactTypeOptions as unknown as { value: string; label: string }[]}
            />
            <NumberField
              label={t('workflowSortOrder')}
              value={step.sortOrder}
              onChange={(v) => onUpdate({ sortOrder: v })}
              placeholder="0"
            />
            <SelectField
              label={t('workflowOptional')}
              value={step.isOptional ? 'yes' : 'no'}
              onChange={(v) => onUpdate({ isOptional: v === 'yes' })}
              options={[
                { value: 'no', label: t('workflowRequired') },
                { value: 'yes', label: t('workflowOptionalYes') },
              ]}
            />
          </div>

          <TextField
            label={t('workflowDependencies')}
            value={(step.dependencies ?? []).join(', ')}
            onChange={(v) =>
              onUpdate({
                dependencies: v
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s && allStepKeys.includes(s) && s !== step.stepKey),
              })
            }
            placeholder={t('workflowStepKeyPlaceholder')}
          />

          <TextAreaField
            label={t('workflowPromptTemplate')}
            required
            value={step.promptTemplate}
            onChange={(v) => onUpdate({ promptTemplate: v })}
            rows={6}
            placeholder={t('workflowPromptPlaceholder')}
          />

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label={t('workflowCritic')}
              value={step.criticEnabled ? 'yes' : 'no'}
              onChange={(v) => onUpdate({ criticEnabled: v === 'yes' })}
              options={[
                { value: 'no', label: t('workflowCriticOff') },
                { value: 'yes', label: t('workflowCriticOn') },
              ]}
            />
            <NumberField
              label={t('workflowMaxRefine')}
              value={step.maxRefineAttempts ?? 2}
              onChange={(v) => onUpdate({ maxRefineAttempts: v })}
              placeholder="2"
            />
          </div>

          {step.criticEnabled && (
            <TextAreaField
              label={t('workflowCriticPromptLabel')}
              value={step.criticPromptTemplate ?? ''}
              onChange={(v) => onUpdate({ criticPromptTemplate: v })}
              rows={4}
              placeholder={t('workflowCriticPromptPlaceholder')}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  onSaved: () => void;
}

export function AgentForm({ onSaved }: Props) {
  const t = useTranslations('publish');
  const tCat = useTranslations('agentCategoryOptions');
  const categories = useMemo<CategoryOption[]>(
    () =>
      CATEGORY_KEYS.map((k) => ({ value: k, label: tCat(k) })),
    [tCat],
  );

  const [common, setCommon] = useState<CommonFormState>(() =>
    initialCommonState('product'),
  );
  const [systemPrompt, setSystemPrompt] = useState('');
  const [kind, setKind] = useState<AgentKind>('chat');
  const [defaultModel, setDefaultModel] = useState('gpt-5');
  const [mcpIdsRaw, setMcpIdsRaw] = useState('');
  const [skillIdsRaw, setSkillIdsRaw] = useState('');
  const [exampleMedia, setExampleMedia] = useState<(string | undefined)[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [executionMode, setExecutionMode] = useState<AgentExecutionMode>('single');
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepDef[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !!common.title.trim() &&
    !!systemPrompt.trim() &&
    (executionMode === 'single' || workflowSteps.length > 0);

  const parseIds = (raw: string) =>
    raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const addStep = () =>
    setWorkflowSteps((prev) => [
      ...prev,
      {
        stepKey: '',
        displayName: '',
        sortOrder: prev.length,
        artifactType: 'MARKDOWN',
        promptTemplate: '',
      },
    ]);

  const removeStep = (idx: number) =>
    setWorkflowSteps((prev) => prev.filter((_, i) => i !== idx));

  const updateStep = (idx: number, patch: Partial<WorkflowStepDef>) =>
    setWorkflowSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const toolBindings = {
      mcps: parseIds(mcpIdsRaw),
      skills: parseIds(skillIdsRaw),
    };

    setSubmitting(true);
    setError(null);
    try {
      await marketplaceActions.createAgent({
        ...buildCommonPayload(common),
        kind,
        systemPrompt: systemPrompt.trim(),
        defaultModel: defaultModel.trim() || undefined,
        toolBindings,
        variables: variables.filter((v) => v.key && v.label),
        exampleMedia: exampleMedia.filter(Boolean) as string[],
        executionMode,
        ...(executionMode === 'workflow'
          ? { workflowSteps: workflowSteps.filter((s) => s.stepKey && s.promptTemplate) }
          : {}),
      } as AgentCreateInput);
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

      <DrawerSection title={t('agentTypeSection')}>
        <SelectField
          label={t('agentKindLabel')}
          value={kind}
          onChange={(v) => setKind(v as AgentKind)}
          options={[
            { value: 'chat' as AgentKind, label: t('agentKindChat') },
            { value: 'image' as AgentKind, label: t('agentKindImage') },
            { value: 'video' as AgentKind, label: t('agentKindVideo') },
            { value: 'avatar' as AgentKind, label: t('agentKindAvatar') },
          ]}
        />
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

      <DrawerSection title={t('executionModeSection')}>
        <SelectField
          label={t('executionModeLabel')}
          value={executionMode}
          onChange={(v) => {
            setExecutionMode(v);
            if (v === 'single') setWorkflowSteps([]);
          }}
          options={[
            { value: 'single' as AgentExecutionMode, label: t('executionModeSingle') },
            { value: 'workflow' as AgentExecutionMode, label: t('executionModeWorkflow') },
          ]}
        />
      </DrawerSection>

      {executionMode === 'workflow' && (
        <DrawerSection title={t('workflowStepsSection')} description={t('workflowStepsDescription')}>
          <div className="space-y-4">
            {workflowSteps.map((step, idx) => (
              <WorkflowStepEditor
                key={idx}
                step={step}
                index={idx}
                allStepKeys={workflowSteps.map((s) => s.stepKey).filter(Boolean)}
                onUpdate={(patch) => updateStep(idx, patch)}
                onRemove={() => removeStep(idx)}
              />
            ))}
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={addStep}
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('workflowAddStep')}
            </Button>
          </div>
        </DrawerSection>
      )}

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
