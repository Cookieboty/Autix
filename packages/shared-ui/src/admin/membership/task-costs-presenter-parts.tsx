'use client';

import type { ReactNode } from 'react';
import { Button } from '../../ui';
import { Pencil, Stethoscope } from 'lucide-react';
import type { GenerationPricingRule, PricingRulePreviewResult } from '@autix/shared-store';
import {
  formatRuleScope,
  formatRuleCost,
  getTaskDescription,
  getTaskName,
  type BusinessTask,
  type Translate,
} from './task-costs-helpers';
import { getStatusBadgePresentation } from './task-costs-presenter-helpers';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
      {label}
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] leading-4" style={{ color: 'var(--muted)' }}>{hint}</p>}
    </label>
  );
}

export function ReadonlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
      {label}
      <div className="mt-1 h-9 rounded-md border px-3 py-2 font-mono text-xs" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
        {value}
      </div>
    </div>
  );
}

export function BusinessTaskTable({
  tasks,
  rulesByTaskType,
  onEditTask,
  onPreview,
  tAdmin,
  tMembership,
}: {
  tasks: BusinessTask[];
  rulesByTaskType: Map<string, GenerationPricingRule[]>;
  onEditTask: (task: BusinessTask) => void;
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
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => {
          const taskRules = rulesByTaskType.get(task.taskType) ?? [];
          const hasActiveRule = taskRules.some((rule) => rule.isActive !== false);
          return (
            <tr key={task.taskType} style={{ borderBottom: '1px solid var(--border)' }}>
              <td className="px-4 py-3">
                <div className="font-medium" style={{ color: 'var(--foreground)' }}>{getTaskName(tAdmin, task)}</div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>{getTaskDescription(tAdmin, task)}</div>
              </td>
              <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{task.taskType}</td>
              <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{task.baseUnit}</td>
              <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                {taskRules.length > 0 ? (
                  <div className="space-y-2">
                    {taskRules.map((rule) => (
                      <div key={rule.id} className="rounded-md border p-2" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{rule.name}</span>
                          <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                            {formatRuleScope(rule, tAdmin)}
                          </span>
                        </div>
                        <div className="mt-1 font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                          {formatRuleCost(rule, tAdmin)}
                        </div>
                        <div className="mt-2 flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 cursor-pointer px-2 text-xs" onClick={() => onPreview(rule)}>
                            <Stethoscope className="mr-1 h-3.5 w-3.5" />{tAdmin('preview.action')}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 cursor-pointer px-2 text-xs" onClick={() => onEditTask(task)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 cursor-pointer px-2 text-xs" onClick={() => onEditTask(task)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />{tAdmin('create')}
                  </Button>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge active={hasActiveRule} missing={taskRules.length === 0} activeText={tMembership('active')} inactiveText={tMembership('inactive')} missingText={tAdmin('missing')} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function RulesTable({
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

export function PreviewResultPanel({
  previewResult,
  tAdmin,
}: {
  previewResult: PricingRulePreviewResult;
  tAdmin: Translate;
}) {
  return (
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
  const { label, color, backgroundColor } = getStatusBadgePresentation({
    active,
    missing,
    activeText,
    inactiveText,
    missingText,
  });

  return (
    <span className="inline-flex min-w-12 justify-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor, color }}>
      {label}
    </span>
  );
}
