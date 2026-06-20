'use client';

import type { ReactNode } from 'react';
import { Button, Input } from '../../ui';
import { CheckCircle2, Pencil, Plus, Stethoscope, X } from 'lucide-react';
import type { GenerationPricingRule, PricingRulePreviewResult } from '@autix/shared-store';
import {
  BUSINESS_TASKS,
  FIELD_META,
  formatRuleCost,
  getTaskDescription,
  getTaskName,
  type BusinessTask,
  type PreviewForm,
  type RuleField,
  type RuleForm,
  type Translate,
} from './task-costs-helpers';

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
  rulesByTaskType: Map<string, GenerationPricingRule>;
  onCreate: (task: BusinessTask) => void;
  onEdit: (rule: GenerationPricingRule) => void;
  onPreview: (rule: GenerationPricingRule) => void;
  tAdmin: Translate;
  tMembership: Translate;
}) {
  return (
    <section>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', borderTop: category === 'chat' ? 0 : '1px solid var(--border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{tAdmin(`categories.${category}.title`)}</h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{tAdmin('categoryDescription')}</p>
      </div>
      <BusinessTaskTable
        tasks={tasks}
        rulesByTaskType={rulesByTaskType}
        onCreate={onCreate}
        onEdit={onEdit}
        onPreview={onPreview}
        tAdmin={tAdmin}
        tMembership={tMembership}
      />
    </section>
  );
}

export function TaskCostsCustomRulesSection({
  rules,
  onPreview,
  onEdit,
  tAdmin,
  tMembership,
}: {
  rules: GenerationPricingRule[];
  onPreview: (rule: GenerationPricingRule) => void;
  onEdit: (rule: GenerationPricingRule) => void;
  tAdmin: Translate;
  tMembership: Translate;
}) {
  return (
    <section>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{tAdmin('customRules.title')}</h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{tAdmin('customRules.description')}</p>
      </div>
      <RulesTable rules={rules} onPreview={onPreview} onEdit={onEdit} tAdmin={tAdmin} tMembership={tMembership} />
    </section>
  );
}

export function TaskCostsRuleModal({
  ruleModal,
  selectedTask,
  saving,
  onClose,
  onTaskChange,
  onFieldChange,
  onActiveChange,
  onSave,
  tAdmin,
  tCommon,
}: {
  ruleModal: RuleModalState;
  selectedTask?: BusinessTask;
  saving: boolean;
  onClose: () => void;
  onTaskChange: (taskType: string) => void;
  onFieldChange: (field: RuleField, value: string) => void;
  onActiveChange: (isActive: boolean) => void;
  onSave: () => void;
  tAdmin: Translate;
  tCommon: Translate;
}) {
  const visibleFields = selectedTask?.fields ?? (['baseCost'] as RuleField[]);

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

        <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
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
            <ReadonlyValue label={tAdmin('labels.businessTask')} value={selectedTask ? getTaskName(tAdmin, selectedTask) : tAdmin('unboundRule')} />
          )}
          <ReadonlyValue label="taskType" value={ruleModal.data.taskType} />
          <ReadonlyValue label={tAdmin('labels.billingUnit')} value={selectedTask?.baseUnit ?? ruleModal.data.baseUnit} />
          <ReadonlyValue label={tAdmin('labels.spec')} value={[ruleModal.data.modelTier, ruleModal.data.quality, ruleModal.data.resolution].filter(Boolean).join(' / ') || tAdmin('generalSpec')} />

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

          <label className="flex items-center gap-2 pt-6 text-xs font-medium" style={{ color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={ruleModal.data.isActive !== false}
              onChange={(e) => onActiveChange(e.target.checked)}
            />
            {tAdmin('modal.enableRule')}
          </label>
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
          {previewRule.inputTokenCostPerK && (
            <Field label={tAdmin('preview.inputTokens')}>
              <Input type="number" min={0} value={previewForm.inputTokens} onChange={(e) => onPreviewFormChange({ ...previewForm, inputTokens: Number(e.target.value) })} />
            </Field>
          )}
          {previewRule.outputTokenCostPerK && (
            <Field label={tAdmin('preview.outputTokens')}>
              <Input type="number" min={0} value={previewForm.outputTokens} onChange={(e) => onPreviewFormChange({ ...previewForm, outputTokens: Number(e.target.value) })} />
            </Field>
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

        {previewResult && (
          <div className="space-y-4">
            {previewResult.warnings && previewResult.warnings.length > 0 ? (
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--warning-soft)', border: '1px solid var(--warning-border)' }}>
                <h3 className="mb-2 text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{tAdmin('preview.warnings')}</h3>
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
                {tAdmin('preview.noWarnings')}
              </div>
            )}

            {previewResult.estimateError && (
              <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'var(--danger-soft)', border: '1px solid var(--danger-border)', color: 'var(--foreground)' }}>
                {tAdmin('preview.estimateFailed', { error: previewResult.estimateError })}
              </div>
            )}

            {previewResult.estimate && (
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <h3 className="mb-2 text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{tAdmin('preview.estimateResult')}</h3>
                <div className="mb-2 text-sm" style={{ color: 'var(--foreground)' }}>
                  {tAdmin('preview.estimatedCostPrefix')}<span className="font-semibold" style={{ color: 'var(--brand)' }}>{previewResult.estimate.estimatedCost}</span> {tAdmin('pointsUnit')}
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
                {tAdmin('preview.matchedRule', { name: previewResult.matchedRule.name, id: previewResult.matchedRule.id })}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={onClose}>{tCommon('close')}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
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
  tMembership,
}: {
  tasks: BusinessTask[];
  rulesByTaskType: Map<string, GenerationPricingRule>;
  onCreate: (task: BusinessTask) => void;
  onEdit: (rule: GenerationPricingRule) => void;
  onPreview: (rule: GenerationPricingRule) => void;
  tAdmin: Translate;
  tMembership: Translate;
}) {
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
                <StatusBadge active={rule?.isActive} missing={!rule} activeText={tMembership('active')} inactiveText={tMembership('inactive')} missingText={tAdmin('missing')} />
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
  tAdmin,
  tMembership,
}: {
  rules: GenerationPricingRule[];
  onPreview: (rule: GenerationPricingRule) => void;
  onEdit: (rule: GenerationPricingRule) => void;
  tAdmin: Translate;
  tMembership: Translate;
}) {
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
              <StatusBadge active={rule.isActive} activeText={tMembership('active')} inactiveText={tMembership('inactive')} />
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
