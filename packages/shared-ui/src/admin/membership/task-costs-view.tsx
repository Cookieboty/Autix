'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAdminPricingRulesQuery,
  useAdminSystemMembershipLevelsQuery,
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
  canSharePricingRuleModels,
  modelKeyFromSystemModel,
  pricingScopeContext,
  pricingScopeModelsForForm,
  previewDefaultsForRule,
  ruleToForm,
  sanitizePayload,
  taskDefaults,
  type BusinessTask,
  type PreviewForm,
  type RuleForm,
  type ScopeField,
} from './task-costs-helpers';
import {
  TaskCostsHeader,
  TaskCostsLoading,
  TaskCostsPreviewModal,
  TaskCostsRuleModal,
  type RuleModalState,
} from './task-costs-presenters';
import { AdminPricingView } from '../pricing/AdminPricingView';

const SCOPE_FIELD_FORM_KEYS: Record<ScopeField, 'qualities' | 'resolutions' | 'modelTiers' | 'membershipLevels'> = {
  quality: 'qualities',
  resolution: 'resolutions',
  modelTier: 'modelTiers',
  membershipLevel: 'membershipLevels',
};

function mutationErrorMessage(error: unknown, fallback: string) {
  const axiosErr = error as { response?: { data?: { message?: string } }; message?: string };
  return axiosErr?.response?.data?.message ?? axiosErr?.message ?? fallback;
}

export function AdminTaskCostsView() {
  const t = useTranslations('adminTaskCosts');
  const tCommon = useTranslations('common');

  const { data: rules = [], isLoading: loading } = useAdminPricingRulesQuery();
  const { data: systemModels = [] } = useAdminSystemModelsQuery();
  const { data: membershipLevels = [] } = useAdminSystemMembershipLevelsQuery();

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
    hasVideoInput: false,
    hasAudioInput: false,
    priority: false,
    membershipLevel: 0,
  });
  const [previewResult, setPreviewResult] = useState<PricingRulePreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [ruleSaveError, setRuleSaveError] = useState<string | null>(null);

  const createMutation = useCreateAdminPricingRuleMutation();
  const updateMutation = useUpdateAdminPricingRuleMutation();
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

  const handleSaveRule = async () => {
    if (!ruleModal) return;
    const task = taskByType.get(ruleModal.taskType);
    if (!task) return;
    setRuleSaveError(null);
    try {
      for (const row of ruleModal.rows) {
        const payload = sanitizePayload(
          row,
          task,
          pricingScopeModelsForForm(task, systemModels, row.modelKeys),
          pricingScopeContext(membershipLevels),
        );
        if (row.id) {
          await updateMutation.mutateAsync({ id: row.id, data: payload });
        } else {
          await createMutation.mutateAsync(payload);
        }
      }
      setRuleModal(null);
    } catch (err) {
      setRuleSaveError(mutationErrorMessage(err, t('modal.saveFailed')));
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
          pricingScopeContext(membershipLevels),
        ),
      );
    }
  };

  const buildDefaultRuleForm = (task: BusinessTask, existingCount: number): RuleForm => {
    const defaults = taskDefaults(task);
    return {
      ...defaults,
      name: existingCount > 0 ? `${defaults.name} ${existingCount + 1}` : defaults.name,
    };
  };

  const openRuleModal = (task?: BusinessTask) => {
    if (!task) return;
    const selectedTask = task;
    const taskRules = rulesByTaskType.get(selectedTask.taskType) ?? [];
    setRuleModal({
      taskType: selectedTask.taskType,
      rows: taskRules.length > 0
        ? taskRules.map((rule) => ruleToForm(rule, selectedTask))
        : [buildDefaultRuleForm(selectedTask, 0)],
    });
    setRuleSaveError(null);
  };

  const changeRuleField = (index: number, field: keyof RuleForm, value: string | boolean) => {
    if (!ruleModal) return;
    setRuleModal({
      ...ruleModal,
      rows: ruleModal.rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    });
  };

  const changeRuleActive = (index: number, isActive: boolean) => {
    if (!ruleModal) return;
    setRuleModal({
      ...ruleModal,
      rows: ruleModal.rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, isActive } : row,
      ),
    });
  };

  const toggleRuleModel = (index: number, modelId: string, checked: boolean) => {
    if (!ruleModal) return;
    const model = systemModels.find((item: ModelConfigItem) => item.id === modelId);
    if (!model) return;
    const modelKey = model ? modelKeyFromSystemModel(model) : '';
    if (!modelKey) return;
    setRuleModal({
      ...ruleModal,
      rows: ruleModal.rows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        if (checked) {
          const selectedModels = systemModels.filter((item) =>
            row.modelKeys.includes(modelKeyFromSystemModel(item)),
          );
          if (!canSharePricingRuleModels(taskByType.get(ruleModal.taskType), [...selectedModels, model])) {
            return row;
          }
        }
        const nextKeys = checked
          ? Array.from(new Set([...row.modelKeys, modelKey]))
          : row.modelKeys.filter((key) => key !== modelKey);
        return { ...row, modelKeys: nextKeys };
      }),
    });
  };

  const clearRuleModels = (index: number) => {
    if (!ruleModal) return;
    setRuleModal({
      ...ruleModal,
      rows: ruleModal.rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, modelKeys: [] } : row,
      ),
    });
  };

  const toggleRuleScope = (index: number, field: ScopeField, value: string, checked: boolean) => {
    if (!ruleModal) return;
    const formKey = SCOPE_FIELD_FORM_KEYS[field];
    setRuleModal({
      ...ruleModal,
      rows: ruleModal.rows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const current = row[formKey];
        const next = checked
          ? Array.from(new Set([...current, value]))
          : current.filter((item) => item !== value);
        return { ...row, [formKey]: next };
      }),
    });
  };

  const clearRuleScope = (index: number, field: ScopeField) => {
    if (!ruleModal) return;
    const formKey = SCOPE_FIELD_FORM_KEYS[field];
    setRuleModal({
      ...ruleModal,
      rows: ruleModal.rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [formKey]: [] } : row,
      ),
    });
  };

  const addRuleRow = () => {
    if (!ruleModal) return;
    const task = taskByType.get(ruleModal.taskType);
    if (!task) return;
    setRuleModal({
      ...ruleModal,
      rows: [
        ...ruleModal.rows,
        buildDefaultRuleForm(task, ruleModal.rows.length),
      ],
    });
  };

  const removeRuleRow = (index: number) => {
    if (!ruleModal || ruleModal.rows.length <= 1) return;
    const row = ruleModal.rows[index];
    if (row?.id) return;
    setRuleModal({
      ...ruleModal,
      rows: ruleModal.rows.filter((_, rowIndex) => rowIndex !== index),
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
      setPreviewError(mutationErrorMessage(err, t('preview.failed')));
    }
  };

  const closePreview = () => {
    setPreviewRule(null);
    setPreviewResult(null);
    setPreviewError(null);
  };

  const selectedTask = ruleModal ? taskByType.get(ruleModal.taskType) : undefined;
  const previewTask = previewRule ? taskByType.get(previewRule.taskType) : undefined;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TaskCostsHeader
        saving={saving}
        missingTaskCount={missingTasks.length}
        onCreateMissingDefaults={handleCreateMissingDefaults}
        tAdmin={t}
      />

      <div className="flex-1 overflow-hidden">
        {loading ? <TaskCostsLoading label={tCommon('loading')} /> : <AdminPricingView />}
      </div>

      {ruleModal && (
        <TaskCostsRuleModal
          ruleModal={ruleModal}
          selectedTask={selectedTask}
          saving={saving}
          systemModels={systemModels}
          membershipLevels={membershipLevels}
          error={ruleSaveError}
          onClose={() => setRuleModal(null)}
          onFieldChange={changeRuleField}
          onActiveChange={changeRuleActive}
          onModelToggle={toggleRuleModel}
          onModelScopeClear={clearRuleModels}
          onScopeToggle={toggleRuleScope}
          onScopeClear={clearRuleScope}
          onAddRule={addRuleRow}
          onRemoveRule={removeRuleRow}
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
          membershipLevels={membershipLevels}
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
