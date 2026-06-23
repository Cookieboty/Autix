'use client';

import { Button, Input } from '../../ui';
import { CheckCircle2, Plus, X } from 'lucide-react';
import type { GenerationPricingRule, ModelConfigItem, PricingRulePreviewResult } from '@autix/shared-store';
import {
  BUSINESS_TASKS,
  FIELD_META,
  getTaskDescription,
  getTaskName,
  modelKeyFromSystemModel,
  modelsForBusinessTask,
  parsePricingModelKey,
  pricingScopeModelsForForm,
  scopeOptionsForTask,
  showScopeField,
  showUsesTemplateScope,
  type BusinessTask,
  type PreviewForm,
  type RuleField,
  type RuleForm,
  type ScopeField,
  type Translate,
} from './task-costs-helpers';
import {
  Field,
  PreviewResultPanel,
  ReadonlyValue,
  BusinessTaskTable,
} from './task-costs-presenter-parts';

export type RuleModalState = {
  mode: 'create' | 'edit';
  data: RuleForm;
};

export function TaskCostsHeader({
  saving,
  missingTaskCount,
  onCreateMissingDefaults,
  tAdmin,
}: {
  saving: boolean;
  missingTaskCount: number;
  onCreateMissingDefaults: () => void;
  tAdmin: Translate;
}) {
  return (
    <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
      <div>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{tAdmin('title')}</h1>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{tAdmin('description')}</p>
      </div>
      <span className="flex-1" />
      <Button size="sm" variant="outline" className="cursor-pointer" disabled={saving || missingTaskCount === 0} onClick={onCreateMissingDefaults}>
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />{tAdmin('fillDefaults')}
      </Button>
    </div>
  );
}

export function TaskCostsLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <span className="text-sm" style={{ color: 'var(--muted)' }}>{label}</span>
    </div>
  );
}

export function TaskCostsCategorySection({
  category,
  tasks,
  rulesByTaskType,
  onCreate,
  onEdit,
  onPreview,
  tAdmin,
  tMembership,
}: {
  category: BusinessTask['category'];
  tasks: BusinessTask[];
  rulesByTaskType: Map<string, GenerationPricingRule[]>;
  onCreate: (task: BusinessTask) => void;
  onEdit: (rule: GenerationPricingRule) => void;
  onPreview: (rule: GenerationPricingRule) => void;
  tAdmin: Translate;
  tMembership: Translate;
}) {
  return (
    <section>
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)', borderTop: category === 'chat' ? 0 : '1px solid var(--border)' }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{tAdmin(`categories.${category}.title`)}</h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{tAdmin('categoryDescription')}</p>
        </div>
        <span className="flex-1" />
        <Button size="sm" variant="outline" className="cursor-pointer whitespace-nowrap" onClick={() => onCreate(tasks[0])}>
          <Plus className="mr-1 h-3.5 w-3.5" />{tAdmin('create')}
        </Button>
      </div>
      <BusinessTaskTable
        tasks={tasks}
        rulesByTaskType={rulesByTaskType}
        onEdit={onEdit}
        onPreview={onPreview}
        tAdmin={tAdmin}
        tMembership={tMembership}
      />
    </section>
  );
}

function ScopeConditionField({
  selectedTask,
  scopeModels,
  field,
  value,
  onFieldChange,
  tAdmin,
}: {
  selectedTask?: BusinessTask;
  scopeModels: ModelConfigItem[];
  field: ScopeField;
  value: string;
  onFieldChange: (field: keyof RuleForm, value: string | boolean) => void;
  tAdmin: Translate;
}) {
  const options = scopeOptionsForTask(selectedTask, field, scopeModels);
  const showSelect = Boolean(selectedTask);
  return (
    <Field label={tAdmin(`labels.${field}`)}>
      {showSelect ? (
        <select
          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          value={value}
          onChange={(e) => onFieldChange(field, e.target.value)}
        >
          <option value="">{tAdmin('generalSpec')}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <Input value={value} onChange={(e) => onFieldChange(field, e.target.value)} />
      )}
    </Field>
  );
}

export function TaskCostsRuleModal({
  ruleModal,
  selectedTask,
  saving,
  systemModels,
  onClose,
  onTaskChange,
  onFieldChange,
  onActiveChange,
  onModelToggle,
  onModelScopeClear,
  onSave,
  tAdmin,
  tCommon,
}: {
  ruleModal: RuleModalState;
  selectedTask?: BusinessTask;
  saving: boolean;
  systemModels: ModelConfigItem[];
  onClose: () => void;
  onTaskChange: (taskType: string) => void;
  onFieldChange: (field: keyof RuleForm, value: string | boolean) => void;
  onActiveChange: (isActive: boolean) => void;
  onModelToggle: (modelId: string, checked: boolean) => void;
  onModelScopeClear: () => void;
  onSave: () => void;
  tAdmin: Translate;
  tCommon: Translate;
}) {
  const visibleFields = selectedTask?.fields ?? (['baseCost'] as RuleField[]);
  const selectableModels = modelsForBusinessTask(selectedTask, systemModels);
  const scopeModels = pricingScopeModelsForForm(selectedTask, systemModels, ruleModal.data.modelKeys);
  const selectedModelKeySet = new Set(ruleModal.data.modelKeys);
  const selectedModelLabels = ruleModal.data.modelKeys.map((key) => {
    const model = selectableModels.find((item) => modelKeyFromSystemModel(item) === key);
    const parsed = parsePricingModelKey(key);
    return model
      ? `${model.name} / ${model.provider} / ${model.model}`
      : parsed
        ? `${parsed.provider} / ${parsed.modelName}`
        : key;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--modal-backdrop)' }}>
      <div className="w-full max-w-2xl rounded-lg p-5" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {ruleModal.mode === 'create' ? tAdmin('modal.createTitle') : tAdmin('modal.editTitle')}
            </h3>
            {selectedTask && (
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{getTaskDescription(tAdmin, selectedTask)}</p>
            )}
          </div>
          <button className="cursor-pointer p-1" onClick={onClose}>
            <X className="h-4 w-4" style={{ color: 'var(--muted)' }} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <section>
            <h4 className="mb-3 text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
              {tAdmin('modal.basicSection')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {ruleModal.mode === 'create' ? (
                <Field label={tAdmin('labels.businessTask')}>
                  <select
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    value={ruleModal.data.taskType}
                    onChange={(e) => onTaskChange(e.target.value)}
                  >
                    {BUSINESS_TASKS.map((task) => <option key={task.taskType} value={task.taskType}>{getTaskName(tAdmin, task)}</option>)}
                  </select>
                </Field>
              ) : (
                <ReadonlyValue label={tAdmin('labels.businessTask')} value={selectedTask ? getTaskName(tAdmin, selectedTask) : ruleModal.data.taskType} />
              )}
              <ReadonlyValue label={tAdmin('labels.billingUnit')} value={selectedTask?.baseUnit ?? ruleModal.data.baseUnit} />
              <Field label={tAdmin('labels.ruleName')}>
                <Input value={ruleModal.data.name} onChange={(e) => onFieldChange('name', e.target.value)} />
              </Field>
              <Field label={tAdmin('labels.rulePriority')}>
                <Input type="number" min={0} step="1" value={ruleModal.data.priority} onChange={(e) => onFieldChange('priority', e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 pt-6 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                <input
                  type="checkbox"
                  checked={ruleModal.data.isActive !== false}
                  onChange={(e) => onActiveChange(e.target.checked)}
                />
                <span className="whitespace-nowrap">{tAdmin('modal.enableRule')}</span>
              </label>
            </div>
          </section>

          <section className="mt-5">
            <div className="mb-3 flex items-center gap-2">
              <h4 className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                {tAdmin('modal.modelScopeSection')}
              </h4>
              <span className="flex-1" />
              {ruleModal.data.modelKeys.length > 0 && (
                <Button size="sm" variant="ghost" className="h-7 cursor-pointer px-2 text-xs" onClick={onModelScopeClear}>
                  {tAdmin('modelScope.clear')}
                </Button>
              )}
            </div>
            <div className="rounded-md border p-3" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {selectedModelLabels.length > 0 ? (
                  selectedModelLabels.map((label) => (
                    <span
                      key={label}
                      className="max-w-full truncate rounded-full px-2 py-0.5 text-[11px]"
                      style={{ backgroundColor: 'var(--muted-soft)', color: 'var(--foreground)' }}
                    >
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{tAdmin('labels.anyModel')}</span>
                )}
              </div>
              {selectableModels.length > 0 ? (
                <div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {selectableModels.map((model) => {
                    const modelKey = modelKeyFromSystemModel(model);
                    return (
                      <label
                        key={model.id}
                        className="flex min-w-0 cursor-pointer items-start gap-2 rounded-md border px-2 py-2 text-xs"
                        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selectedModelKeySet.has(modelKey)}
                          onChange={(e) => onModelToggle(model.id, e.target.checked)}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{model.name}</span>
                          <span className="block truncate font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                            {model.provider} / {model.model}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{tAdmin('modelScope.empty')}</p>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {showScopeField(selectedTask, 'modelTier') && (
                <ScopeConditionField
                  selectedTask={selectedTask}
                  scopeModels={scopeModels}
                  field="modelTier"
                  value={ruleModal.data.modelTier}
                  onFieldChange={onFieldChange}
                  tAdmin={tAdmin}
                />
              )}
              {showScopeField(selectedTask, 'quality') && (
                <ScopeConditionField
                  selectedTask={selectedTask}
                  scopeModels={scopeModels}
                  field="quality"
                  value={ruleModal.data.quality}
                  onFieldChange={onFieldChange}
                  tAdmin={tAdmin}
                />
              )}
              {showScopeField(selectedTask, 'resolution') && (
                <ScopeConditionField
                  selectedTask={selectedTask}
                  scopeModels={scopeModels}
                  field="resolution"
                  value={ruleModal.data.resolution}
                  onFieldChange={onFieldChange}
                  tAdmin={tAdmin}
                />
              )}
              {showUsesTemplateScope(selectedTask) && (
                <Field label={tAdmin('labels.usesTemplate')}>
                  <select
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    value={ruleModal.data.usesTemplate === '' ? '' : String(ruleModal.data.usesTemplate)}
                    onChange={(e) =>
                      onFieldChange(
                        'usesTemplate',
                        e.target.value === ''
                          ? ''
                          : e.target.value === 'true',
                      )
                    }
                  >
                    <option value="">{tAdmin('labels.anyTemplateUsage')}</option>
                    <option value="true">{tAdmin('labels.mustUseTemplate')}</option>
                    <option value="false">{tAdmin('labels.mustNotUseTemplate')}</option>
                  </select>
                </Field>
              )}
              {selectedTask?.category === 'video' && (
                <>
                  <Field label={tAdmin('labels.minDurationSeconds')}>
                    <Input type="number" min={0} step="1" value={ruleModal.data.minDurationSeconds} onChange={(e) => onFieldChange('minDurationSeconds', e.target.value)} />
                  </Field>
                  <Field label={tAdmin('labels.maxDurationSeconds')}>
                    <Input type="number" min={0} step="1" value={ruleModal.data.maxDurationSeconds} onChange={(e) => onFieldChange('maxDurationSeconds', e.target.value)} />
                  </Field>
                </>
              )}
            </div>
          </section>

          <section className="mt-5">
            <h4 className="mb-3 text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
              {tAdmin('modal.costSection')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {visibleFields.map((field) => {
                const meta = FIELD_META[field];
                return (
                  <Field key={field} label={tAdmin(meta.labelKey)} hint={tAdmin(meta.hintKey)}>
                    <Input
                      type="number"
                      min={0}
                      step={meta.type === 'number' ? '0.1' : '1'}
                      value={ruleModal.data[field]}
                      onChange={(e) => onFieldChange(field, e.target.value)}
                    />
                  </Field>
                );
              })}
            </div>
          </section>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={onClose}>{tCommon('cancel')}</Button>
          <Button size="sm" className="cursor-pointer" disabled={saving} onClick={onSave}>{tCommon('save')}</Button>
        </div>
      </div>
    </div>
  );
}

export function TaskCostsPreviewModal({
  previewRule,
  previewTask,
  previewForm,
  previewResult,
  previewError,
  previewRunning,
  onPreviewFormChange,
  onRunPreview,
  onClose,
  tAdmin,
  tCommon,
}: {
  previewRule: GenerationPricingRule;
  previewTask?: BusinessTask;
  previewForm: PreviewForm;
  previewResult: PricingRulePreviewResult | null;
  previewError: string | null;
  previewRunning: boolean;
  onPreviewFormChange: (form: PreviewForm) => void;
  onRunPreview: () => void;
  onClose: () => void;
  tAdmin: Translate;
  tCommon: Translate;
}) {
  const hasComponent = (type: string) =>
    previewRule.components?.some((component) => component.componentType === type && component.isActive !== false);
  const showInputTokens = Boolean(hasComponent('input_token_per_1k'));
  const showOutputTokens = Boolean(hasComponent('output_token_per_1k'));
  const showContext = Boolean(hasComponent('context_token_per_1k'));
  const showToolCalls = Boolean(hasComponent('per_tool_call'));
  const showMcpCalls = hasComponent('per_mcp_call');
  const showSkillCalls = hasComponent('per_skill_call');
  const showBatch = Boolean(hasComponent('per_batch'));
  const showReferences = Boolean(
    hasComponent('per_reference_image') ||
    hasComponent('reference_image_multiplier'),
  );
  const showVideoFlags = Boolean(
    hasComponent('video_input_multiplier') ||
    hasComponent('audio_input_multiplier') ||
    hasComponent('priority_multiplier'),
  );
  const showUsesTemplate = previewTask?.taskType === 'image_generation' || previewTask?.taskType === 'video_generation';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--modal-backdrop)' }}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg p-5"
        style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {tAdmin('preview.title', { name: previewTask ? getTaskName(tAdmin, previewTask) : previewRule.name })}
            </h2>
            <p className="mt-0.5 font-mono text-xs" style={{ color: 'var(--muted)' }}>
              {previewRule.taskType} / {previewRule.baseUnit}
            </p>
          </div>
          <button onClick={onClose} className="cursor-pointer p-1" style={{ color: 'var(--muted)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          {previewRule.baseUnit === 'image' && (
            <Field label={tAdmin('preview.quantity')}>
              <Input type="number" min={1} value={previewForm.quantity} onChange={(e) => onPreviewFormChange({ ...previewForm, quantity: Number(e.target.value) })} />
            </Field>
          )}
          {previewRule.baseUnit === 'second' && (
            <Field label={tAdmin('preview.seconds')}>
              <Input type="number" min={1} value={previewForm.seconds} onChange={(e) => onPreviewFormChange({ ...previewForm, seconds: Number(e.target.value) })} />
            </Field>
          )}
          {showInputTokens && (
            <Field label={tAdmin('preview.inputTokens')}>
              <Input type="number" min={0} value={previewForm.inputTokens} onChange={(e) => onPreviewFormChange({ ...previewForm, inputTokens: Number(e.target.value) })} />
            </Field>
          )}
          {showOutputTokens && (
            <Field label={tAdmin('preview.outputTokens')}>
              <Input type="number" min={0} value={previewForm.outputTokens} onChange={(e) => onPreviewFormChange({ ...previewForm, outputTokens: Number(e.target.value) })} />
            </Field>
          )}
          {showContext && (
            <Field label={tAdmin('preview.contextTokens')}>
              <Input type="number" min={0} value={previewForm.contextTokens} onChange={(e) => onPreviewFormChange({ ...previewForm, contextTokens: Number(e.target.value) })} />
            </Field>
          )}
          {showToolCalls && (
            <Field label={tAdmin('preview.toolCalls')}>
              <Input type="number" min={0} value={previewForm.toolCalls} onChange={(e) => onPreviewFormChange({ ...previewForm, toolCalls: Number(e.target.value) })} />
            </Field>
          )}
          {showMcpCalls && (
            <Field label={tAdmin('preview.mcpCalls')}>
              <Input type="number" min={0} value={previewForm.mcpCalls} onChange={(e) => onPreviewFormChange({ ...previewForm, mcpCalls: Number(e.target.value) })} />
            </Field>
          )}
          {showSkillCalls && (
            <Field label={tAdmin('preview.skillCalls')}>
              <Input type="number" min={0} value={previewForm.skillCalls} onChange={(e) => onPreviewFormChange({ ...previewForm, skillCalls: Number(e.target.value) })} />
            </Field>
          )}
          {showBatch && (
            <Field label={tAdmin('preview.batchCount')}>
              <Input type="number" min={0} value={previewForm.batchCount} onChange={(e) => onPreviewFormChange({ ...previewForm, batchCount: Number(e.target.value) })} />
            </Field>
          )}
          {showReferences && (
            <Field label={tAdmin('preview.referenceImages')}>
              <Input type="number" min={0} value={previewForm.referenceImages} onChange={(e) => onPreviewFormChange({ ...previewForm, referenceImages: Number(e.target.value) })} />
            </Field>
          )}
          {showUsesTemplate && (
            <label className="flex items-center gap-2 pt-6 text-xs font-medium" style={{ color: 'var(--muted)' }}>
              <input type="checkbox" checked={previewForm.usesTemplate} onChange={(e) => onPreviewFormChange({ ...previewForm, usesTemplate: e.target.checked })} />
              {tAdmin('preview.usesTemplate')}
            </label>
          )}
          {showVideoFlags && (
            <div className="col-span-2 grid grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={previewForm.hasVideoInput} onChange={(e) => onPreviewFormChange({ ...previewForm, hasVideoInput: e.target.checked })} />
                {tAdmin('preview.hasVideoInput')}
              </label>
              <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={previewForm.hasAudioInput} onChange={(e) => onPreviewFormChange({ ...previewForm, hasAudioInput: e.target.checked })} />
                {tAdmin('preview.hasAudioInput')}
              </label>
              <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={previewForm.priority} onChange={(e) => onPreviewFormChange({ ...previewForm, priority: e.target.checked })} />
                {tAdmin('preview.priority')}
              </label>
            </div>
          )}
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Button size="sm" className="cursor-pointer" disabled={previewRunning} onClick={onRunPreview}>
            {previewRunning ? tAdmin('preview.running') : tAdmin('preview.run')}
          </Button>
          {previewError && (
            <span className="text-xs" style={{ color: 'var(--danger)' }}>
              {previewError}
            </span>
          )}
        </div>

        {previewResult && <PreviewResultPanel previewResult={previewResult} tAdmin={tAdmin} />}

        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={onClose}>{tCommon('close')}</Button>
        </div>
      </div>
    </div>
  );
}
