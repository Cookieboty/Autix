'use client';

import { useState, useMemo } from 'react';
import { Button } from '../../ui/button';
import { Send, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  agentApi,
  type TemplateVariable,
  type AgentExecutionMode,
  type WorkflowStepDef,
} from '@autix/shared-lib';
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
const KEY_TO_VALUE: Record<(typeof CATEGORY_KEYS)[number], string> = {
  product: '产品',
  engineering: '研发',
  marketing: '营销',
  support: '客服',
  hr: '人事',
  other: '其他',
};

const ARTIFACT_TYPE_OPTIONS = [
  { value: 'MARKDOWN', label: 'Markdown' },
  { value: 'HTML', label: 'HTML' },
  { value: 'CODE', label: '代码' },
] as const;

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

  return (
    <div
      className="rounded-lg p-3 space-y-3"
      style={{ border: '1px solid var(--border)', backgroundColor: 'var(--panel)' }}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          步骤 {index + 1}{step.displayName ? `: ${step.displayName}` : ''}
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
              label="Step Key"
              required
              value={step.stepKey}
              onChange={(v) => onUpdate({ stepKey: v })}
              placeholder="e.g. prd, visual_design"
            />
            <TextField
              label="显示名称"
              required
              value={step.displayName}
              onChange={(v) => onUpdate({ displayName: v })}
              placeholder="e.g. 需求文档"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <SelectField
              label="产物类型"
              value={step.artifactType}
              onChange={(v) => onUpdate({ artifactType: v })}
              options={ARTIFACT_TYPE_OPTIONS as unknown as { value: string; label: string }[]}
            />
            <NumberField
              label="排序"
              value={step.sortOrder}
              onChange={(v) => onUpdate({ sortOrder: v })}
              placeholder="0"
            />
            <SelectField
              label="可选"
              value={step.isOptional ? 'yes' : 'no'}
              onChange={(v) => onUpdate({ isOptional: v === 'yes' })}
              options={[
                { value: 'no', label: '必需' },
                { value: 'yes', label: '可选' },
              ]}
            />
          </div>

          <TextField
            label="依赖 (逗号分隔 stepKey)"
            value={(step.dependencies ?? []).join(', ')}
            onChange={(v) =>
              onUpdate({
                dependencies: v
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s && allStepKeys.includes(s) && s !== step.stepKey),
              })
            }
            placeholder="e.g. prd, visual_design"
          />

          <TextAreaField
            label="Prompt 模板"
            required
            value={step.promptTemplate}
            onChange={(v) => onUpdate({ promptTemplate: v })}
            rows={6}
            placeholder="占位符: {{userInput}} {{artifact:prd}} {{resources}}"
          />

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Critic 评审"
              value={step.criticEnabled ? 'yes' : 'no'}
              onChange={(v) => onUpdate({ criticEnabled: v === 'yes' })}
              options={[
                { value: 'no', label: '关闭' },
                { value: 'yes', label: '启用 (深度模式)' },
              ]}
            />
            <NumberField
              label="最大 Refine 次数"
              value={step.maxRefineAttempts ?? 2}
              onChange={(v) => onUpdate({ maxRefineAttempts: v })}
              placeholder="2"
            />
          </div>

          {step.criticEnabled && (
            <TextAreaField
              label="Critic Prompt"
              value={step.criticPromptTemplate ?? ''}
              onChange={(v) => onUpdate({ criticPromptTemplate: v })}
              rows={4}
              placeholder="评审标准与评分指引…"
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
      await agentApi.create({
        ...buildCommonPayload(common),
        systemPrompt: systemPrompt.trim(),
        defaultModel: defaultModel.trim() || undefined,
        toolBindings,
        variables: variables.filter((v) => v.key && v.label),
        exampleMedia: exampleMedia.filter(Boolean) as string[],
        executionMode,
        ...(executionMode === 'workflow'
          ? { workflowSteps: workflowSteps.filter((s) => s.stepKey && s.promptTemplate) }
          : {}),
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

      <DrawerSection title="执行模式">
        <SelectField
          label="模式"
          value={executionMode}
          onChange={(v) => {
            setExecutionMode(v);
            if (v === 'single') setWorkflowSteps([]);
          }}
          options={[
            { value: 'single' as AgentExecutionMode, label: '单步 Agent' },
            { value: 'workflow' as AgentExecutionMode, label: '多阶段 Workflow' },
          ]}
        />
      </DrawerSection>

      {executionMode === 'workflow' && (
        <DrawerSection title="工作流步骤" description="定义工作流的各个阶段，每个阶段产出独立的 artifact">
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
              添加步骤
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
