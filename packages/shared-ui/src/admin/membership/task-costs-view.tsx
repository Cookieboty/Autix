'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAdminPricingRulesQuery,
  useAdminSystemModelsQuery,
  useCreateAdminPricingRuleMutation,
  useUpdateAdminPricingRuleMutation,
  usePreviewAdminPricingRuleMutation,
  type GenerationPricingRule,
  type ModelConfigItem,
  type PricingRulePreviewResult,
} from '@autix/shared-store';
import {
  BUSINESS_TASKS,
  buildPreviewPayload,
  modelKeyFromSystemModel,
  pricingScopeModelsForForm,
  previewDefaultsForRule,
  ruleToForm,
  sanitizePayload,
  taskDefaults,
  type BusinessTask,
  type PreviewForm,
  type RuleForm,
} from './task-costs-helpers';
import {
  TaskCostsCategorySection,
  TaskCostsHeader,
  TaskCostsLoading,
  TaskCostsPreviewModal,
  TaskCostsRuleModal,
  type RuleModalState,
} from './task-costs-presenters';

const TASK_COST_CATEGORIES: BusinessTask['category'][] = ['chat', 'image', 'video', 'prompt'];

export function AdminTaskCostsView() {
  const t = useTranslations('adminTaskCosts');
  const tCommon = useTranslations('common');
  const tMembership = useTranslations('membership');

  const { data: rules = [], isLoading: loading } = useAdminPricingRulesQuery();
  const { data: systemModels = [] } = useAdminSystemModelsQuery();

  const [ruleModal, setRuleModal] = useState<RuleModalState | null>(null);
  const [previewRule, setPreviewRule] = useState<GenerationPricingRule | null>(null);
  const [previewForm, setPreviewForm] = useState<PreviewForm>({
    quantity: 1,
    seconds: 5,
    inputTokens: 1000,
    outputTokens: 500,
    contextTokens: 0,
    toolCalls: 0,
    mcpCalls: 0,
    skillCalls: 0,
    batchCount: 0,
    referenceImages: 0,
    usesTemplate: false,
    hasVideoInput: false,
    hasAudioInput: false,
    priority: false,
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
    const map = new Map<string, GenerationPricingRule[]>();
    for (const rule of rules) {
      const group = map.get(rule.taskType) ?? [];
      group.push(rule);
      map.set(rule.taskType, group);
    }
    return map;
  }, [rules]);
  const missingTasks = useMemo(
    () => BUSINESS_TASKS.filter((task) => (rulesByTaskType.get(task.taskType)?.length ?? 0) === 0),
    [rulesByTaskType],
  );

  const handleSaveRule = () => {
    if (!ruleModal) return;
    const task = taskByType.get(ruleModal.data.taskType);
    if (!task) return;
    const payload = sanitizePayload(
      ruleModal.data,
      task,
      pricingScopeModelsForForm(task, systemModels, ruleModal.data.modelKeys),
    );
    if (ruleModal.mode === 'create') {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: ruleModal.data.id!, data: payload });
    }
  };

  const handleCreateMissingDefaults = async () => {
    if (missingTasks.length === 0) return;
    for (const task of missingTasks) {
      await createMutation.mutateAsync(
        sanitizePayload(
          taskDefaults(task),
          task,
          pricingScopeModelsForForm(task, systemModels, []),
        ),
      );
    }
  };

  const openRuleModal = (mode: 'create' | 'edit', task?: BusinessTask, rule?: GenerationPricingRule) => {
    if (!task) return;
    const selectedTask = task;
    const existingCount = rulesByTaskType.get(selectedTask.taskType)?.length ?? 0;
    const defaults = taskDefaults(selectedTask);
    setRuleModal({
      mode,
      data: rule
        ? ruleToForm(rule, selectedTask)
        : {
            ...defaults,
            name: existingCount > 0 ? `${defaults.name} ${existingCount + 1}` : defaults.name,
          },
    });
  };

  const changeModalTask = (taskType: string) => {
    const task = taskByType.get(taskType);
    if (!ruleModal || !task) return;
    setRuleModal({ ...ruleModal, data: taskDefaults(task) });
  };

  const changeRuleField = (field: keyof RuleForm, value: string | boolean) => {
    if (!ruleModal) return;
    setRuleModal({ ...ruleModal, data: { ...ruleModal.data, [field]: value } });
  };

  const changeRuleActive = (isActive: boolean) => {
    if (!ruleModal) return;
    setRuleModal({ ...ruleModal, data: { ...ruleModal.data, isActive } });
  };

  const toggleRuleModel = (modelId: string, checked: boolean) => {
    if (!ruleModal) return;
    const model = systemModels.find((item: ModelConfigItem) => item.id === modelId);
    const modelKey = model ? modelKeyFromSystemModel(model) : '';
    if (!modelKey) return;
    const nextKeys = checked
      ? Array.from(new Set([...ruleModal.data.modelKeys, modelKey]))
      : ruleModal.data.modelKeys.filter((key) => key !== modelKey);
    setRuleModal({
      ...ruleModal,
      data: {
        ...ruleModal.data,
        modelKeys: nextKeys,
      },
    });
  };

  const clearRuleModels = () => {
    if (!ruleModal) return;
    setRuleModal({
      ...ruleModal,
      data: { ...ruleModal.data, modelKeys: [] },
    });
  };

  const openPreview = (rule: GenerationPricingRule) => {
    setPreviewRule(rule);
    setPreviewResult(null);
    setPreviewError(null);
    setPreviewForm(previewDefaultsForRule(rule));
  };

  const runPreview = async () => {
    if (!previewRule) return;
    setPreviewError(null);
    try {
      const res = await previewMutation.mutateAsync(buildPreviewPayload(previewRule, previewForm));
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
      <TaskCostsHeader
        saving={saving}
        missingTaskCount={missingTasks.length}
        onCreateMissingDefaults={handleCreateMissingDefaults}
        tAdmin={t}
      />

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <TaskCostsLoading label={tCommon('loading')} />
        ) : (
          <div>
            {TASK_COST_CATEGORIES.map((category) => (
              <TaskCostsCategorySection
                key={category}
                category={category}
                tasks={BUSINESS_TASKS.filter((task) => task.category === category)}
                rulesByTaskType={rulesByTaskType}
                onCreate={(task) => openRuleModal('create', task)}
                onEdit={(rule) => openRuleModal('edit', taskByType.get(rule.taskType), rule)}
                onPreview={openPreview}
                tAdmin={t}
                tMembership={tMembership}
              />
            ))}
          </div>
        )}
      </div>

      {ruleModal && (
        <TaskCostsRuleModal
          ruleModal={ruleModal}
          selectedTask={selectedTask}
          saving={saving}
          systemModels={systemModels}
          onClose={() => setRuleModal(null)}
          onTaskChange={changeModalTask}
          onFieldChange={changeRuleField}
          onActiveChange={changeRuleActive}
          onModelToggle={toggleRuleModel}
          onModelScopeClear={clearRuleModels}
          onSave={handleSaveRule}
          tAdmin={t}
          tCommon={tCommon}
        />
      )}

      {previewRule && (
        <TaskCostsPreviewModal
          previewRule={previewRule}
          previewTask={previewTask}
          previewForm={previewForm}
          previewResult={previewResult}
          previewError={previewError}
          previewRunning={previewMutation.isPending}
          onPreviewFormChange={setPreviewForm}
          onRunPreview={runPreview}
          onClose={closePreview}
          tAdmin={t}
          tCommon={tCommon}
        />
      )}
    </div>
  );
}
