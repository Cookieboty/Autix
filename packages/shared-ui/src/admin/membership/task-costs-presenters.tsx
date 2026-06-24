'use client';

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui';
import { CheckCircle2, Plus, Trash2, X } from 'lucide-react';
import type { GenerationPricingRule, MembershipLevel, ModelConfigItem, PricingRulePreviewResult } from '@autix/shared-store';
import {
  FIELD_META,
  canSharePricingRuleModels,
  getTaskDescription,
  getTaskName,
  modelKeyFromSystemModel,
  modelsForBusinessTask,
  parsePricingModelKey,
  pricingScopeContext,
  pricingScopeModelsForForm,
  scopeOptionsForTask,
  showScopeField,
  unknownConditionKeys,
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
  taskType: string;
  rows: RuleForm[];
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
  onEditTask,
  onPreview,
  tAdmin,
  tMembership,
}: {
  category: BusinessTask['category'];
  tasks: BusinessTask[];
  rulesByTaskType: Map<string, GenerationPricingRule[]>;
  onCreate: (task: BusinessTask) => void;
  onEditTask: (task: BusinessTask) => void;
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
        onEditTask={onEditTask}
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
  membershipLevels,
  field,
  modelKeys,
  values,
  onValueToggle,
  onClear,
  tAdmin,
}: {
  selectedTask?: BusinessTask;
  scopeModels: ModelConfigItem[];
  membershipLevels: MembershipLevel[];
  field: ScopeField;
  modelKeys: string[];
  values: string[];
  onValueToggle: (field: ScopeField, value: string, checked: boolean) => void;
  onClear: (field: ScopeField) => void;
  tAdmin: Translate;
}) {
  const options = scopeOptionsForTask(
    selectedTask,
    field,
    field === 'membershipLevel' && modelKeys.length === 0 ? undefined : scopeModels,
    pricingScopeContext(membershipLevels),
  );
  const selected = new Set(values);
  if (!selectedTask || options.length === 0) return null;
  return (
    <Field label={tAdmin(`labels.${field}`)}>
      <div className="rounded-md border p-2" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {values.length > 0 ? tAdmin('labels.selectedCount', { count: values.length }) : tAdmin('generalSpec')}
          </span>
          <span className="flex-1" />
          {values.length > 0 && (
            <Button size="sm" variant="ghost" className="h-6 cursor-pointer px-2 text-[11px]" onClick={() => onClear(field)}>
              {tAdmin(`labels.clearScope.${field}` as any)}
            </Button>
          )}
        </div>
        <div className="grid max-h-28 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs"
              style={{ color: 'var(--foreground)' }}
            >
              <input
                type="checkbox"
                checked={selected.has(option.value)}
                onChange={(e) => onValueToggle(field, option.value, e.target.checked)}
              />
              <span className="truncate">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </Field>
  );
}

function RuleEditorCard({
  index,
  row,
  selectedTask,
  systemModels,
  membershipLevels,
  canRemove,
  onFieldChange,
  onActiveChange,
  onModelToggle,
  onModelScopeClear,
  onScopeToggle,
  onScopeClear,
  onRemove,
  tAdmin,
}: {
  index: number;
  row: RuleForm;
  selectedTask?: BusinessTask;
  systemModels: ModelConfigItem[];
  membershipLevels: MembershipLevel[];
  canRemove: boolean;
  onFieldChange: (index: number, field: keyof RuleForm, value: string | boolean) => void;
  onActiveChange: (index: number, isActive: boolean) => void;
  onModelToggle: (index: number, modelId: string, checked: boolean) => void;
  onModelScopeClear: (index: number) => void;
  onScopeToggle: (index: number, field: ScopeField, value: string, checked: boolean) => void;
  onScopeClear: (index: number, field: ScopeField) => void;
  onRemove: (index: number) => void;
  tAdmin: Translate;
}) {
  const visibleFields = selectedTask?.fields ?? (['baseCost'] as RuleField[]);
  const selectableModels = modelsForBusinessTask(selectedTask, systemModels);
  const scopeModels = pricingScopeModelsForForm(selectedTask, systemModels, row.modelKeys);
  const selectedModelKeySet = new Set(row.modelKeys);
  const selectedModels = selectableModels.filter((item) =>
    selectedModelKeySet.has(modelKeyFromSystemModel(item)),
  );
  const selectedModelLabels = row.modelKeys.map((key) => {
    const model = selectableModels.find((item) => modelKeyFromSystemModel(item) === key);
    const parsed = parsePricingModelKey(key);
    return model
      ? `${model.name} / ${model.provider} / ${model.model}`
      : parsed
        ? `${parsed.provider} / ${parsed.modelName}`
        : key;
  });
  const unknownKeys = unknownConditionKeys(selectedTask, row.conditions);

  return (
    <article className="rounded-md border p-3" style={{ borderColor: 'var(--border)' }}>
      <div className="mb-3 flex items-center gap-2">
        <div>
          <h4 className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
            {tAdmin('modal.subRuleTitle', { index: index + 1 })}
          </h4>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
            {row.id ? row.id : tAdmin('modal.newSubRule')}
          </p>
        </div>
        <span className="flex-1" />
        <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
          <input
            type="checkbox"
            checked={row.isActive !== false}
            onChange={(e) => onActiveChange(index, e.target.checked)}
          />
          <span className="whitespace-nowrap">{tAdmin('modal.enableRule')}</span>
        </label>
        {canRemove && !row.id && (
          <Button size="sm" variant="ghost" className="h-7 cursor-pointer px-2 text-xs" onClick={() => onRemove(index)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(220px,0.9fr)_minmax(260px,1fr)_minmax(260px,1fr)_minmax(260px,1fr)]">
        <section className="min-w-0">
          <h5 className="mb-2 text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
            {tAdmin('modal.basicSection')}
          </h5>
          <div className="grid gap-2">
          <Field label={tAdmin('labels.ruleName')}>
            <Input value={row.name} onChange={(e) => onFieldChange(index, 'name', e.target.value)} />
          </Field>
          <Field label={tAdmin('labels.rulePriority')}>
            <Input type="number" min={0} step="1" value={row.priority} onChange={(e) => onFieldChange(index, 'priority', e.target.value)} />
          </Field>
          </div>
        </section>

        <section className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <h5 className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
            {tAdmin('modal.modelScopeSection')}
          </h5>
          <span className="flex-1" />
          {row.modelKeys.length > 0 && (
            <Button size="sm" variant="ghost" className="h-7 cursor-pointer px-2 text-xs" onClick={() => onModelScopeClear(index)}>
              {tAdmin('modelScope.clear')}
            </Button>
          )}
        </div>
        <div className="rounded-md border p-2" style={{ borderColor: 'var(--border)' }}>
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
            <div className="grid max-h-44 gap-1.5 overflow-y-auto pr-1">
              {selectableModels.map((model) => {
                const modelKey = modelKeyFromSystemModel(model);
                const checked = selectedModelKeySet.has(modelKey);
                const disabled = !checked && !canSharePricingRuleModels(selectedTask, [...selectedModels, model]);
                return (
                  <label
                    key={model.id}
                    className={`flex min-w-0 items-start gap-2 rounded-md border px-2 py-2 text-xs ${disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
                    title={disabled ? tAdmin('modelScope.incompatible') : undefined}
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => onModelToggle(index, model.id, e.target.checked)}
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
        </section>

        <section className="min-w-0">
          <h5 className="mb-2 text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
            {tAdmin('modal.conditionSection')}
          </h5>
        <div className="grid gap-2">
          {showScopeField(selectedTask, 'modelTier') && (
            <ScopeConditionField
              selectedTask={selectedTask}
              scopeModels={scopeModels}
              membershipLevels={membershipLevels}
              field="modelTier"
              modelKeys={row.modelKeys}
              values={row.modelTiers}
              onValueToggle={(field, value, checked) => onScopeToggle(index, field, value, checked)}
              onClear={(field) => onScopeClear(index, field)}
              tAdmin={tAdmin}
            />
          )}
          {showScopeField(selectedTask, 'quality') && (
            <ScopeConditionField
              selectedTask={selectedTask}
              scopeModels={scopeModels}
              membershipLevels={membershipLevels}
              field="quality"
              modelKeys={row.modelKeys}
              values={row.qualities}
              onValueToggle={(field, value, checked) => onScopeToggle(index, field, value, checked)}
              onClear={(field) => onScopeClear(index, field)}
              tAdmin={tAdmin}
            />
          )}
          {showScopeField(selectedTask, 'resolution') && (
            <ScopeConditionField
              selectedTask={selectedTask}
              scopeModels={scopeModels}
              membershipLevels={membershipLevels}
              field="resolution"
              modelKeys={row.modelKeys}
              values={row.resolutions}
              onValueToggle={(field, value, checked) => onScopeToggle(index, field, value, checked)}
              onClear={(field) => onScopeClear(index, field)}
              tAdmin={tAdmin}
            />
          )}
          {showScopeField(selectedTask, 'membershipLevel') && (
            <ScopeConditionField
              selectedTask={selectedTask}
              scopeModels={scopeModels}
              membershipLevels={membershipLevels}
              field="membershipLevel"
              modelKeys={row.modelKeys}
              values={row.membershipLevels}
              onValueToggle={(field, value, checked) => onScopeToggle(index, field, value, checked)}
              onClear={(field) => onScopeClear(index, field)}
              tAdmin={tAdmin}
            />
          )}
          {selectedTask?.category === 'video' && (
            <>
              <Field label={tAdmin('labels.minDurationSeconds')}>
                <Input type="number" min={0} step="1" value={row.minDurationSeconds} onChange={(e) => onFieldChange(index, 'minDurationSeconds', e.target.value)} />
              </Field>
              <Field label={tAdmin('labels.maxDurationSeconds')}>
                <Input type="number" min={0} step="1" value={row.maxDurationSeconds} onChange={(e) => onFieldChange(index, 'maxDurationSeconds', e.target.value)} />
              </Field>
              <div className="grid gap-2 rounded-md border p-2" style={{ borderColor: 'var(--border)' }}>
                <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  <input type="checkbox" checked={row.requireVideoInput} onChange={(e) => onFieldChange(index, 'requireVideoInput', e.target.checked)} />
                  {tAdmin('labels.requireVideoInput')}
                </label>
                <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  <input type="checkbox" checked={row.requireAudioInput} onChange={(e) => onFieldChange(index, 'requireAudioInput', e.target.checked)} />
                  {tAdmin('labels.requireAudioInput')}
                </label>
                <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  <input type="checkbox" checked={row.requirePriority} onChange={(e) => onFieldChange(index, 'requirePriority', e.target.checked)} />
                  {tAdmin('labels.requirePriority')}
                </label>
              </div>
            </>
          )}
          {unknownKeys.length > 0 && (
            <div className="rounded-md border p-2 text-[11px]" style={{ borderColor: 'var(--warning-border)', backgroundColor: 'var(--warning-soft)', color: 'var(--foreground)' }}>
              <div className="font-medium">{tAdmin('labels.unknownConditions')}</div>
              <div className="mt-1 font-mono" style={{ color: 'var(--muted)' }}>
                {unknownKeys.join(', ')}
              </div>
            </div>
          )}
        </div>
        </section>

      <section className="min-w-0">
        <h5 className="mb-2 text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
          {tAdmin('modal.costSection')}
        </h5>
        <div className="grid gap-2">
          {visibleFields.map((field) => {
            const meta = FIELD_META[field];
            return (
              <Field key={field} label={tAdmin(meta.labelKey)} hint={tAdmin(meta.hintKey)}>
                <Input
                  type="number"
                  min={0}
                  step={meta.type === 'number' ? '0.1' : '1'}
                  value={row[field]}
                  onChange={(e) => onFieldChange(index, field, e.target.value)}
                />
              </Field>
            );
          })}
        </div>
      </section>
      </div>
    </article>
  );
}

export function TaskCostsRuleModal({
  ruleModal,
  selectedTask,
  saving,
  systemModels,
  membershipLevels,
  error,
  onClose,
  onFieldChange,
  onActiveChange,
  onModelToggle,
  onModelScopeClear,
  onScopeToggle,
  onScopeClear,
  onAddRule,
  onRemoveRule,
  onSave,
  tAdmin,
  tCommon,
}: {
  ruleModal: RuleModalState;
  selectedTask?: BusinessTask;
  saving: boolean;
  systemModels: ModelConfigItem[];
  membershipLevels: MembershipLevel[];
  error: string | null;
  onClose: () => void;
  onFieldChange: (index: number, field: keyof RuleForm, value: string | boolean) => void;
  onActiveChange: (index: number, isActive: boolean) => void;
  onModelToggle: (index: number, modelId: string, checked: boolean) => void;
  onModelScopeClear: (index: number) => void;
  onScopeToggle: (index: number, field: ScopeField, value: string, checked: boolean) => void;
  onScopeClear: (index: number, field: ScopeField) => void;
  onAddRule: () => void;
  onRemoveRule: (index: number) => void;
  onSave: () => void;
  tAdmin: Translate;
  tCommon: Translate;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--modal-backdrop)' }}>
      <div className="w-full max-w-7xl rounded-lg p-5" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {tAdmin('modal.editTitle')}
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
          <section className="mb-5 grid grid-cols-2 gap-3">
            <ReadonlyValue label={tAdmin('labels.businessTask')} value={selectedTask ? getTaskName(tAdmin, selectedTask) : ruleModal.taskType} />
            <ReadonlyValue label={tAdmin('labels.billingUnit')} value={selectedTask?.baseUnit ?? 'task'} />
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                {tAdmin('modal.subRulesSection')}
              </h4>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {tAdmin('modal.subRulesCount', { count: ruleModal.rows.length })}
              </span>
              <span className="flex-1" />
              <Button size="sm" variant="outline" className="h-8 cursor-pointer px-3 text-xs" onClick={onAddRule}>
                <Plus className="mr-1 h-3.5 w-3.5" />{tAdmin('modal.addSubRule')}
              </Button>
            </div>
            {ruleModal.rows.map((row, index) => (
              <RuleEditorCard
                key={row.id ?? `new-${index}`}
                index={index}
                row={row}
                selectedTask={selectedTask}
                systemModels={systemModels}
                membershipLevels={membershipLevels}
                canRemove={ruleModal.rows.length > 1}
                onFieldChange={onFieldChange}
                onActiveChange={onActiveChange}
                onModelToggle={onModelToggle}
                onModelScopeClear={onModelScopeClear}
                onScopeToggle={onScopeToggle}
                onScopeClear={onScopeClear}
                onRemove={onRemoveRule}
                tAdmin={tAdmin}
              />
            ))}
          </section>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          {error && (
            <span className="mr-auto text-xs" style={{ color: 'var(--danger)' }}>
              {error}
            </span>
          )}
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
  membershipLevels,
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
  membershipLevels: MembershipLevel[];
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
          {previewRule.baseUnit === 'second' && (
            <Field label={tAdmin('preview.seconds')}>
              <Input type="number" min={1} value={previewForm.seconds} onChange={(e) => onPreviewFormChange({ ...previewForm, seconds: Number(e.target.value) })} />
            </Field>
          )}
          {membershipLevels.length > 0 && (
            <Field label={tAdmin('preview.membershipLevel')}>
              <Select
                value={String(previewForm.membershipLevel || 0)}
                onValueChange={(value) => onPreviewFormChange({ ...previewForm, membershipLevel: Number(value) || 0 })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{tAdmin('generalSpec')}</SelectItem>
                  {membershipLevels
                    .filter((level) => level.isActive !== false)
                    .sort((a, b) => a.level - b.level)
                    .map((level) => (
                      <SelectItem key={level.id} value={String(level.level)}>
                        {level.name} ({level.level})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
