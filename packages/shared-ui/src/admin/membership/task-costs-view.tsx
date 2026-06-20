'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAdminPricingRulesQuery,
  useCreateAdminPricingRuleMutation,
  useUpdateAdminPricingRuleMutation,
  usePreviewAdminPricingRuleMutation,
  type GenerationPricingRule,
  type PricingRulePreviewResult,
} from '@autix/shared-store';
import {
  BUSINESS_TASKS,
  buildPreviewPayload,
  previewDefaultsForRule,
  ruleToForm,
  sanitizePayload,
  taskDefaults,
  type BusinessTask,
  type PreviewForm,
  type RuleField,
} from './task-costs-helpers';
import {
  TaskCostsCategorySection,
  TaskCostsCustomRulesSection,
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

  const [ruleModal, setRuleModal] = useState<RuleModalState | null>(null);
  const [previewRule, setPreviewRule] = useState<GenerationPricingRule | null>(null);
  const [previewForm, setPreviewForm] = useState<PreviewForm>({
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

  const changeRuleField = (field: RuleField, value: string) => {
    if (!ruleModal) return;
    setRuleModal({ ...ruleModal, data: { ...ruleModal.data, [field]: value } });
  };

  const changeRuleActive = (isActive: boolean) => {
    if (!ruleModal) return;
    setRuleModal({ ...ruleModal, data: { ...ruleModal.data, isActive } });
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

            {customRules.length > 0 && (
              <TaskCostsCustomRulesSection
                rules={customRules}
                onPreview={openPreview}
                onEdit={(rule) => openRuleModal('edit', undefined, rule)}
                tAdmin={t}
                tMembership={tMembership}
              />
            )}
          </div>
        )}
      </div>

      {ruleModal && (
        <TaskCostsRuleModal
          ruleModal={ruleModal}
          selectedTask={selectedTask}
          saving={saving}
          onClose={() => setRuleModal(null)}
          onTaskChange={changeModalTask}
          onFieldChange={changeRuleField}
          onActiveChange={changeRuleActive}
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
