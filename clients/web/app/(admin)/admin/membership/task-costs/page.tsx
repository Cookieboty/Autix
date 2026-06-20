'use client';

import { useMemo, useState } from 'react';
import { Button, Input } from '@autix/shared-ui/ui';
import { CheckCircle2, Pencil, Plus, Stethoscope, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useAdminPricingRulesQuery,
  useCreateAdminPricingRuleMutation,
  useUpdateAdminPricingRuleMutation,
  usePreviewAdminPricingRuleMutation,
  type GenerationPricingRule,
  type PricingRulePreviewResult,
} from '@autix/shared-store';

type RuleField =
  | 'baseCost'
  | 'inputTokenCostPerK'
  | 'outputTokenCostPerK'
  | 'contextTokenCostPerK'
  | 'reasoningMultiplier'
  | 'fixedExtraCost'
  | 'referenceImageFixedCost'
  | 'referenceImageMultiplier'
  | 'videoInputMultiplier'
  | 'audioInputMultiplier';

type RuleForm = {
  id?: string;
  taskType: string;
  name: string;
  modelProvider: string;
  modelName: string;
  quality: string;
  resolution: string;
  modelTier: string;
  baseUnit: string;
  baseCost: number | string;
  fixedExtraCost: number | string;
  inputTokenCostPerK: number | string;
  outputTokenCostPerK: number | string;
  contextTokenCostPerK: number | string;
  reasoningMultiplier: number | string;
  referenceImageFixedCost: number | string;
  referenceImageMultiplier: number | string;
  videoInputMultiplier: number | string;
  audioInputMultiplier: number | string;
  isActive: boolean;
};

type BusinessTask = {
  category: 'chat' | 'image' | 'video' | 'prompt';
  taskType: string;
  defaultName: string;
  baseUnit: string;
  defaults: Partial<RuleForm>;
  fields: RuleField[];
};

type Translate = (key: string, values?: Record<string, string | number>) => string;

const EMPTY_RULE: RuleForm = {
  taskType: '',
  name: '',
  modelProvider: '',
  modelName: '',
  quality: '',
  resolution: '',
  modelTier: '',
  baseUnit: 'task',
  baseCost: 0,
  fixedExtraCost: 0,
  inputTokenCostPerK: '',
  outputTokenCostPerK: '',
  contextTokenCostPerK: '',
  reasoningMultiplier: 1,
  referenceImageFixedCost: '',
  referenceImageMultiplier: '',
  videoInputMultiplier: '',
  audioInputMultiplier: '',
  isActive: true,
};

const BUSINESS_TASKS: BusinessTask[] = [
  {
    category: 'chat',
    taskType: 'chat_message_fast',
    defaultName: 'Fast chat',
    baseUnit: 'message',
    defaults: { baseCost: 1, modelTier: 'fast', inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK'],
  },
  {
    category: 'chat',
    taskType: 'chat_message_standard',
    defaultName: 'Standard chat',
    baseUnit: 'message',
    defaults: { baseCost: 3, modelTier: 'standard', inputTokenCostPerK: 1, outputTokenCostPerK: 5 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK'],
  },
  {
    category: 'chat',
    taskType: 'chat_message_reasoning',
    defaultName: 'Reasoning chat',
    baseUnit: 'message',
    defaults: { baseCost: 10, modelTier: 'pro_reasoning', inputTokenCostPerK: 3, outputTokenCostPerK: 15, reasoningMultiplier: 1.2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK', 'reasoningMultiplier'],
  },
  {
    category: 'image',
    taskType: 'gpt_image_2_low',
    defaultName: 'Image workbench Low',
    baseUnit: 'image',
    defaults: { baseCost: 15, quality: 'low' },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'image',
    taskType: 'gpt_image_2_medium',
    defaultName: 'Image workbench Medium',
    baseUnit: 'image',
    defaults: { baseCost: 90, quality: 'medium' },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'image',
    taskType: 'gpt_image_2_high',
    defaultName: 'Image workbench High',
    baseUnit: 'image',
    defaults: { baseCost: 350, quality: 'high' },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'image',
    taskType: 'image_generation',
    defaultName: 'Image template generation',
    baseUnit: 'image',
    defaults: { baseCost: 90 },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'video',
    taskType: 'seedance_fast_720p',
    defaultName: 'Seedance Fast 720p',
    baseUnit: 'second',
    defaults: { baseCost: 260, resolution: '720p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier'],
  },
  {
    category: 'video',
    taskType: 'seedance_480p',
    defaultName: 'Seedance 480p',
    baseUnit: 'second',
    defaults: { baseCost: 160, resolution: '480p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier'],
  },
  {
    category: 'video',
    taskType: 'seedance_720p',
    defaultName: 'Seedance 720p',
    baseUnit: 'second',
    defaults: { baseCost: 320, resolution: '720p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier'],
  },
  {
    category: 'video',
    taskType: 'seedance_1080p',
    defaultName: 'Seedance 1080p',
    baseUnit: 'second',
    defaults: { baseCost: 800, resolution: '1080p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier'],
  },
  {
    category: 'video',
    taskType: 'video_generation',
    defaultName: 'Video template generation',
    baseUnit: 'second',
    defaults: { baseCost: 320 },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'prompt',
    taskType: 'prompt_optimize_generation',
    defaultName: 'Image prompt optimization',
    baseUnit: 'task',
    defaults: { baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK'],
  },
  {
    category: 'prompt',
    taskType: 'prompt_optimize_pro',
    defaultName: 'Artifact document AI optimization',
    baseUnit: 'task',
    defaults: { baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK'],
  },
];

const FIELD_META: Record<RuleField, { labelKey: string; type: 'int' | 'number'; hintKey: string }> = {
  baseCost: { labelKey: 'fields.baseCost.label', type: 'int', hintKey: 'fields.baseCost.hint' },
  inputTokenCostPerK: { labelKey: 'fields.inputTokenCostPerK.label', type: 'number', hintKey: 'fields.inputTokenCostPerK.hint' },
  outputTokenCostPerK: { labelKey: 'fields.outputTokenCostPerK.label', type: 'number', hintKey: 'fields.outputTokenCostPerK.hint' },
  contextTokenCostPerK: { labelKey: 'fields.contextTokenCostPerK.label', type: 'number', hintKey: 'fields.contextTokenCostPerK.hint' },
  reasoningMultiplier: { labelKey: 'fields.reasoningMultiplier.label', type: 'number', hintKey: 'fields.reasoningMultiplier.hint' },
  fixedExtraCost: { labelKey: 'fields.fixedExtraCost.label', type: 'int', hintKey: 'fields.fixedExtraCost.hint' },
  referenceImageFixedCost: { labelKey: 'fields.referenceImageFixedCost.label', type: 'int', hintKey: 'fields.referenceImageFixedCost.hint' },
  referenceImageMultiplier: { labelKey: 'fields.referenceImageMultiplier.label', type: 'number', hintKey: 'fields.referenceImageMultiplier.hint' },
  videoInputMultiplier: { labelKey: 'fields.videoInputMultiplier.label', type: 'number', hintKey: 'fields.videoInputMultiplier.hint' },
  audioInputMultiplier: { labelKey: 'fields.audioInputMultiplier.label', type: 'number', hintKey: 'fields.audioInputMultiplier.hint' },
};

function getTaskName(t: Translate, task: BusinessTask) {
  return t(`tasks.${task.taskType}.name`);
}

function getTaskDescription(t: Translate, task: BusinessTask) {
  return t(`tasks.${task.taskType}.description`);
}

function optionalText(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text : undefined;
}

function toInt(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function optionalInt(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return toInt(text);
}

function optionalNumber(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return Math.max(0, Number(text) || 0);
}

function taskDefaults(task: BusinessTask): RuleForm {
  return {
    ...EMPTY_RULE,
    taskType: task.taskType,
    name: task.defaultName,
    baseUnit: task.baseUnit,
    ...task.defaults,
  };
}

function ruleToForm(rule: GenerationPricingRule, task?: BusinessTask): RuleForm {
  return {
    ...taskDefaults(task ?? {
      category: 'prompt',
      taskType: rule.taskType,
      defaultName: rule.name,
      baseUnit: rule.baseUnit,
      defaults: {},
      fields: ['baseCost'],
    }),
    id: rule.id,
    taskType: rule.taskType,
    name: rule.name,
    modelProvider: rule.modelProvider ?? '',
    modelName: rule.modelName ?? '',
    quality: rule.quality ?? task?.defaults.quality ?? '',
    resolution: rule.resolution ?? task?.defaults.resolution ?? '',
    modelTier: rule.modelTier ?? task?.defaults.modelTier ?? '',
    baseUnit: rule.baseUnit,
    baseCost: rule.baseCost,
    fixedExtraCost: rule.fixedExtraCost ?? 0,
    inputTokenCostPerK: rule.inputTokenCostPerK ?? '',
    outputTokenCostPerK: rule.outputTokenCostPerK ?? '',
    contextTokenCostPerK: rule.contextTokenCostPerK ?? '',
    reasoningMultiplier: rule.reasoningMultiplier ?? 1,
    referenceImageFixedCost: rule.referenceImageFixedCost ?? '',
    referenceImageMultiplier: rule.referenceImageMultiplier ?? '',
    videoInputMultiplier: rule.videoInputMultiplier ?? '',
    audioInputMultiplier: rule.audioInputMultiplier ?? '',
    isActive: rule.isActive !== false,
  };
}

function sanitizePayload(data: RuleForm, task?: BusinessTask) {
  const fields = new Set(task?.fields ?? ['baseCost']);
  return {
    taskType: task?.taskType ?? String(data.taskType ?? '').trim(),
    name: task?.defaultName ?? String(data.name ?? '').trim(),
    modelProvider: task ? undefined : optionalText(data.modelProvider),
    modelName: task ? undefined : optionalText(data.modelName),
    quality: optionalText(task?.defaults.quality ?? data.quality),
    resolution: optionalText(task?.defaults.resolution ?? data.resolution),
    modelTier: optionalText(task?.defaults.modelTier ?? data.modelTier),
    baseUnit: (task?.baseUnit ?? data.baseUnit) || 'task',
    baseCost: toInt(data.baseCost),
    fixedExtraCost: fields.has('fixedExtraCost') ? toInt(data.fixedExtraCost) : 0,
    inputTokenCostPerK: fields.has('inputTokenCostPerK') ? optionalNumber(data.inputTokenCostPerK) : null,
    outputTokenCostPerK: fields.has('outputTokenCostPerK') ? optionalNumber(data.outputTokenCostPerK) : null,
    contextTokenCostPerK: fields.has('contextTokenCostPerK') ? optionalNumber(data.contextTokenCostPerK) : null,
    reasoningMultiplier: fields.has('reasoningMultiplier') ? optionalNumber(data.reasoningMultiplier) ?? 1 : 1,
    referenceImageFixedCost: fields.has('referenceImageFixedCost') ? optionalInt(data.referenceImageFixedCost) : null,
    referenceImageMultiplier: fields.has('referenceImageMultiplier') ? optionalNumber(data.referenceImageMultiplier) : null,
    videoInputMultiplier: fields.has('videoInputMultiplier') ? optionalNumber(data.videoInputMultiplier) : null,
    audioInputMultiplier: fields.has('audioInputMultiplier') ? optionalNumber(data.audioInputMultiplier) : null,
    isActive: data.isActive !== false,
  };
}

function formatRuleCost(rule: GenerationPricingRule, t: Translate) {
  const extras = [
    rule.inputTokenCostPerK ? t('cost.inputPerK', { value: rule.inputTokenCostPerK }) : '',
    rule.outputTokenCostPerK ? t('cost.outputPerK', { value: rule.outputTokenCostPerK }) : '',
    rule.referenceImageFixedCost ? t('cost.referenceImageFixed', { value: rule.referenceImageFixedCost }) : '',
  ].filter(Boolean);
  return extras.length > 0 ? t('cost.baseWithExtras', { base: rule.baseCost, extras: extras.join(' / ') }) : String(rule.baseCost);
}

export default function AdminTaskCostsPage() {
  const t = useTranslations('adminTaskCosts');
  const tCommon = useTranslations('common');

  const { data: rules = [], isLoading: loading } = useAdminPricingRulesQuery();

  const [ruleModal, setRuleModal] = useState<{ mode: 'create' | 'edit'; data: RuleForm } | null>(null);

  const [previewRule, setPreviewRule] = useState<GenerationPricingRule | null>(null);
  const [previewForm, setPreviewForm] = useState({
    quantity: 1,
    seconds: 5,
    inputTokens: 1000,
    outputTokens: 500,
  });
  const [previewResult, setPreviewResult] = useState<PricingRulePreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const createMutation = useCreateAdminPricingRuleMutation({
    onSuccess: () => setRuleModal(null),
  });
  const updateMutation = useUpdateAdminPricingRuleMutation({
    onSuccess: () => setRuleModal(null),
  });
  const previewMutation = usePreviewAdminPricingRuleMutation();

  const saving = createMutation.isPending || updateMutation.isPending;

  const taskByType = useMemo(
    () => new Map(BUSINESS_TASKS.map((task) => [task.taskType, task])),
    [],
  );
  const rulesByTaskType = useMemo(() => {
    const map = new Map<string, GenerationPricingRule>();
    for (const rule of rules) {
      if (!map.has(rule.taskType)) map.set(rule.taskType, rule);
    }
    return map;
  }, [rules]);
  const customRules = useMemo(
    () => rules.filter((rule) => !taskByType.has(rule.taskType)),
    [rules, taskByType],
  );
  const missingTasks = useMemo(
    () => BUSINESS_TASKS.filter((task) => !rulesByTaskType.has(task.taskType)),
    [rulesByTaskType],
  );

  const handleSaveRule = () => {
    if (!ruleModal) return;
    const task = taskByType.get(ruleModal.data.taskType);
    const payload = sanitizePayload(ruleModal.data, task);
    if (ruleModal.mode === 'create') {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: ruleModal.data.id!, data: payload });
    }
  };

  const handleCreateMissingDefaults = async () => {
    if (missingTasks.length === 0) return;
    for (const task of missingTasks) {
      await createMutation.mutateAsync(sanitizePayload(taskDefaults(task), task));
    }
  };

  const openRuleModal = (mode: 'create' | 'edit', task?: BusinessTask, rule?: GenerationPricingRule) => {
    if (mode === 'create' && !task) return;
    const selectedTask = task ?? BUSINESS_TASKS[0];
    setRuleModal({
      mode,
      data: rule ? ruleToForm(rule, taskByType.get(rule.taskType)) : taskDefaults(selectedTask),
    });
  };

  const changeModalTask = (taskType: string) => {
    const task = taskByType.get(taskType);
    if (!ruleModal || !task) return;
    setRuleModal({ ...ruleModal, data: taskDefaults(task) });
  };

  const openPreview = (rule: GenerationPricingRule) => {
    setPreviewRule(rule);
    setPreviewResult(null);
    setPreviewError(null);
    setPreviewForm({
      quantity: rule.baseUnit === 'image' ? 1 : 0,
      seconds: rule.baseUnit === 'second' ? 5 : 0,
      inputTokens: rule.inputTokenCostPerK ? 1000 : 0,
      outputTokens: rule.outputTokenCostPerK ? 500 : 0,
    });
  };

  const runPreview = async () => {
    if (!previewRule) return;
    setPreviewError(null);
    try {
      const payload: Record<string, unknown> = {
        taskType: previewRule.taskType,
        modelProvider: previewRule.modelProvider ?? undefined,
        modelName: previewRule.modelName ?? undefined,
        quality: previewRule.quality ?? undefined,
        resolution: previewRule.resolution ?? undefined,
        modelTier: previewRule.modelTier ?? undefined,
      };
      if (previewForm.quantity > 0) payload.quantity = Number(previewForm.quantity);
      if (previewForm.seconds > 0) payload.seconds = Number(previewForm.seconds);
      if (previewForm.inputTokens > 0) payload.inputTokens = Number(previewForm.inputTokens);
      if (previewForm.outputTokens > 0) payload.outputTokens = Number(previewForm.outputTokens);

      const res = await previewMutation.mutateAsync(payload);
      setPreviewResult(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      setPreviewError(axiosErr?.response?.data?.message ?? axiosErr?.message ?? t('preview.failed'));
    }
  };

  const closePreview = () => {
    setPreviewRule(null);
    setPreviewResult(null);
    setPreviewError(null);
  };

  const selectedTask = ruleModal ? taskByType.get(ruleModal.data.taskType) : undefined;
  const previewTask = previewRule ? taskByType.get(previewRule.taskType) : undefined;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{t('description')}</p>
        </div>
        <span className="flex-1" />
        <Button size="sm" variant="outline" className="cursor-pointer" disabled={saving || missingTasks.length === 0} onClick={handleCreateMissingDefaults}>
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />{t('fillDefaults')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : (
          <div>
            {(['chat', 'image', 'video', 'prompt'] as BusinessTask['category'][]).map((category) => (
              <section key={category}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', borderTop: category === 'chat' ? 0 : '1px solid var(--border)' }}>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t(`categories.${category}.title`)}</h2>
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{t('categoryDescription')}</p>
                </div>
                <BusinessTaskTable
                  tasks={BUSINESS_TASKS.filter((task) => task.category === category)}
                  rulesByTaskType={rulesByTaskType}
                  onCreate={(task) => openRuleModal('create', task)}
                  onEdit={(rule) => openRuleModal('edit', taskByType.get(rule.taskType), rule)}
                  onPreview={openPreview}
                  tAdmin={t}
                />
              </section>
            ))}

            {customRules.length > 0 && (
              <section>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('customRules.title')}</h2>
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{t('customRules.description')}</p>
                </div>
                <RulesTable rules={customRules} onPreview={openPreview} onEdit={(rule) => openRuleModal('edit', undefined, rule)} />
              </section>
            )}
          </div>
        )}
      </div>

      {ruleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--modal-backdrop)' }}>
          <div className="w-full max-w-2xl rounded-lg p-5" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {ruleModal.mode === 'create' ? t('modal.createTitle') : t('modal.editTitle')}
                </h3>
                {selectedTask && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{getTaskDescription(t, selectedTask)}</p>
                )}
              </div>
              <button className="cursor-pointer p-1" onClick={() => setRuleModal(null)}>
                <X className="h-4 w-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
              {ruleModal.mode === 'create' ? (
                <Field label={t('labels.businessTask')}>
                  <select
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    value={ruleModal.data.taskType}
                    onChange={(e) => changeModalTask(e.target.value)}
                  >
                    {BUSINESS_TASKS.map((task) => <option key={task.taskType} value={task.taskType}>{getTaskName(t, task)}</option>)}
                  </select>
                </Field>
              ) : (
                <ReadonlyValue label={t('labels.businessTask')} value={selectedTask ? getTaskName(t, selectedTask) : t('unboundRule')} />
              )}
              <ReadonlyValue label="taskType" value={ruleModal.data.taskType} />
              <ReadonlyValue label={t('labels.billingUnit')} value={selectedTask?.baseUnit ?? ruleModal.data.baseUnit} />
              <ReadonlyValue label={t('labels.spec')} value={[ruleModal.data.modelTier, ruleModal.data.quality, ruleModal.data.resolution].filter(Boolean).join(' / ') || t('generalSpec')} />

              {(selectedTask?.fields ?? ['baseCost']).map((field) => {
                const meta = FIELD_META[field];
                return (
                  <Field key={field} label={t(meta.labelKey)} hint={t(meta.hintKey)}>
                    <Input
                      type="number"
                      min={0}
                      step={meta.type === 'number' ? '0.1' : '1'}
                      value={ruleModal.data[field]}
                      onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, [field]: e.target.value } })}
                    />
                  </Field>
                );
              })}

              <label className="flex items-center gap-2 pt-6 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                <input
                  type="checkbox"
                  checked={ruleModal.data.isActive !== false}
                  onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, isActive: e.target.checked } })}
                />
                {t('modal.enableRule')}
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setRuleModal(null)}>{tCommon('cancel')}</Button>
              <Button size="sm" className="cursor-pointer" disabled={saving} onClick={handleSaveRule}>{tCommon('save')}</Button>
            </div>
          </div>
        </div>
      )}

      {previewRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--modal-backdrop)' }}>
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg p-5"
            style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {t('preview.title', { name: previewTask ? getTaskName(t, previewTask) : previewRule.name })}
                </h2>
                <p className="mt-0.5 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  {previewRule.taskType} / {previewRule.baseUnit}
                </p>
              </div>
              <button onClick={closePreview} className="cursor-pointer p-1" style={{ color: 'var(--muted)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              {previewRule.baseUnit === 'image' && (
                <Field label={t('preview.quantity')}>
                  <Input type="number" min={1} value={previewForm.quantity} onChange={(e) => setPreviewForm({ ...previewForm, quantity: Number(e.target.value) })} />
                </Field>
              )}
              {previewRule.baseUnit === 'second' && (
                <Field label={t('preview.seconds')}>
                  <Input type="number" min={1} value={previewForm.seconds} onChange={(e) => setPreviewForm({ ...previewForm, seconds: Number(e.target.value) })} />
                </Field>
              )}
              {previewRule.inputTokenCostPerK && (
                <Field label={t('preview.inputTokens')}>
                  <Input type="number" min={0} value={previewForm.inputTokens} onChange={(e) => setPreviewForm({ ...previewForm, inputTokens: Number(e.target.value) })} />
                </Field>
              )}
              {previewRule.outputTokenCostPerK && (
                <Field label={t('preview.outputTokens')}>
                  <Input type="number" min={0} value={previewForm.outputTokens} onChange={(e) => setPreviewForm({ ...previewForm, outputTokens: Number(e.target.value) })} />
                </Field>
              )}
            </div>

            <div className="mb-4 flex items-center gap-2">
              <Button size="sm" className="cursor-pointer" disabled={previewMutation.isPending} onClick={runPreview}>
                {previewMutation.isPending ? t('preview.running') : t('preview.run')}
              </Button>
              {previewError && (
                <span className="text-xs" style={{ color: 'var(--danger)' }}>
                  {previewError}
                </span>
              )}
            </div>

            {previewResult && (
              <div className="space-y-4">
                {previewResult.warnings && previewResult.warnings.length > 0 ? (
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--warning-soft)', border: '1px solid var(--warning-border)' }}>
                    <h3 className="mb-2 text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{t('preview.warnings')}</h3>
                    <ul className="space-y-1 text-xs">
                      {previewResult.warnings.map((w, idx) => (
                        <li key={idx} style={{ color: 'var(--foreground)' }}>
                          <span className="mr-2 font-mono" style={{ color: 'var(--muted)' }}>[{w.code}]</span>
                          {w.message}
                          {w.field && <span className="ml-2 font-mono" style={{ color: 'var(--muted)' }}>({w.field})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'var(--success-soft)', border: '1px solid var(--success-border)', color: 'var(--foreground)' }}>
                    {t('preview.noWarnings')}
                  </div>
                )}

                {previewResult.estimateError && (
                  <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'var(--danger-soft)', border: '1px solid var(--danger-border)', color: 'var(--foreground)' }}>
                    {t('preview.estimateFailed', { error: previewResult.estimateError })}
                  </div>
                )}

                {previewResult.estimate && (
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <h3 className="mb-2 text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{t('preview.estimateResult')}</h3>
                    <div className="mb-2 text-sm" style={{ color: 'var(--foreground)' }}>
                      {t('preview.estimatedCostPrefix')}<span className="font-semibold" style={{ color: 'var(--brand)' }}>{previewResult.estimate.estimatedCost}</span> {t('pointsUnit')}
                    </div>
                    {previewResult.estimate.breakdown && previewResult.estimate.breakdown.length > 0 && (
                      <table className="w-full text-xs">
                        <tbody>
                          {previewResult.estimate.breakdown.map((b, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td className="py-1.5" style={{ color: 'var(--muted)' }}>{b.label}</td>
                              <td className="py-1.5 text-right font-mono" style={{ color: 'var(--foreground)' }}>{b.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {previewResult.matchedRule && (
                  <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                    {t('preview.matchedRule', { name: previewResult.matchedRule.name, id: previewResult.matchedRule.id })}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={closePreview}>{tCommon('close')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
      {label}
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] leading-4" style={{ color: 'var(--muted)' }}>{hint}</p>}
    </label>
  );
}

function ReadonlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
      {label}
      <div className="mt-1 h-9 rounded-md border px-3 py-2 font-mono text-xs" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
        {value}
      </div>
    </div>
  );
}

function BusinessTaskTable({
  tasks,
  rulesByTaskType,
  onCreate,
  onEdit,
  onPreview,
  tAdmin,
}: {
  tasks: BusinessTask[];
  rulesByTaskType: Map<string, GenerationPricingRule>;
  onCreate: (task: BusinessTask) => void;
  onEdit: (rule: GenerationPricingRule) => void;
  onPreview: (rule: GenerationPricingRule) => void;
  tAdmin: Translate;
}) {
  const t = useTranslations('membership');

  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{tAdmin('labels.businessTask')}</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>taskType</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{tAdmin('labels.unit')}</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{tAdmin('labels.currentCost')}</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{tAdmin('labels.status')}</th>
          <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--muted)' }}>{tAdmin('labels.actions')}</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => {
          const rule = rulesByTaskType.get(task.taskType);
          return (
            <tr key={task.taskType} style={{ borderBottom: '1px solid var(--border)' }}>
              <td className="px-4 py-3">
                <div className="font-medium" style={{ color: 'var(--foreground)' }}>{getTaskName(tAdmin, task)}</div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>{getTaskDescription(tAdmin, task)}</div>
              </td>
              <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{task.taskType}</td>
              <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{task.baseUnit}</td>
              <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{rule ? formatRuleCost(rule, tAdmin) : '-'}</td>
              <td className="px-4 py-3">
                <StatusBadge active={rule?.isActive} missing={!rule} activeText={t('active')} inactiveText={t('inactive')} missingText={tAdmin('missing')} />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1">
                  {rule && (
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => onPreview(rule)}>
                      <Stethoscope className="mr-1 h-3.5 w-3.5" />{tAdmin('preview.action')}
                    </Button>
                  )}
                  {rule ? (
                    <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => onEdit(rule)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => onCreate(task)}>
                      <Plus className="mr-1 h-3.5 w-3.5" />{tAdmin('create')}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RulesTable({
  rules,
  onPreview,
  onEdit,
}: {
  rules: GenerationPricingRule[];
  onPreview: (rule: GenerationPricingRule) => void;
  onEdit: (rule: GenerationPricingRule) => void;
}) {
  const t = useTranslations('membership');
  const tAdmin = useTranslations('adminTaskCosts');

  return (
    <table className="w-full text-sm">
      <tbody>
        {rules.map((rule) => (
          <tr key={rule.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{rule.taskType}</td>
            <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{rule.name}</td>
            <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{rule.baseUnit}</td>
            <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{formatRuleCost(rule, tAdmin)}</td>
            <td className="px-4 py-3">
              <StatusBadge active={rule.isActive} activeText={t('active')} inactiveText={t('inactive')} />
            </td>
            <td className="px-4 py-3 text-right">
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => onPreview(rule)}>
                  <Stethoscope className="mr-1 h-3.5 w-3.5" />{tAdmin('preview.action')}
                </Button>
                <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => onEdit(rule)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusBadge({
  active,
  missing = false,
  activeText,
  inactiveText,
  missingText,
}: {
  active?: boolean;
  missing?: boolean;
  activeText: string;
  inactiveText: string;
  missingText?: string;
}) {
  const label = missing ? missingText : active !== false ? activeText : inactiveText;
  const color = missing
    ? 'var(--danger)'
    : active !== false
      ? 'var(--success)'
      : 'var(--muted)';
  const backgroundColor = missing
    ? 'var(--danger-soft)'
    : active !== false
      ? 'var(--success-soft)'
      : 'var(--muted-soft)';

  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor, color }}>
      {label}
    </span>
  );
}
