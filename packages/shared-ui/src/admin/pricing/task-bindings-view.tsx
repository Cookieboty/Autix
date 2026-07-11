'use client';

import { useTranslations } from 'next-intl';
import { Switch } from '../../ui/switch';
import { Input } from '../../ui/input';
import type { TaskModelBinding, UpdateTaskModelBindingInput } from '@autix/shared-store';

export interface TaskBindingsViewProps {
  bindings: TaskModelBinding[];
  /**
   * `patch` is typed off `UpdateTaskModelBindingInput` (not `Pick<TaskModelBinding, ...>`) because
   * `TaskModelBinding.multiplier` is a wire-format string (Prisma Decimal) while the update input
   * expects a `number` — the caller forwards `patch` straight into the shared-store update action,
   * so the shapes must line up.
   */
  onUpdate: (
    taskType: string,
    modelConfigId: string,
    patch: Pick<UpdateTaskModelBindingInput, 'multiplier' | 'isDefault' | 'isActive'>,
  ) => void;
}

export function TaskBindingsView({ bindings, onUpdate }: TaskBindingsViewProps) {
  const t = useTranslations('adminPricing.bindings');
  const byTask = new Map<string, TaskModelBinding[]>();
  for (const binding of bindings) {
    const group = byTask.get(binding.taskType) ?? [];
    group.push(binding);
    byTask.set(binding.taskType, group);
  }

  return (
    <div className="space-y-6">
      {Array.from(byTask.entries()).map(([taskType, rows]) => (
        <section key={taskType} className="space-y-2">
          <h3 className="text-sm font-semibold">{taskType}</h3>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left font-medium">{t('model')}</th>
                <th className="text-left font-medium">{t('multiplier')}</th>
                <th className="text-left font-medium">{t('isDefault')}</th>
                <th className="text-left font-medium">{t('isActive')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.modelConfigId} className="border-t border-border">
                  <td className="py-2">{row.modelConfigId}</td>
                  <td className="py-2">
                    <Input
                      type="number"
                      step="0.001"
                      // `row.multiplier` arrives over the wire as a Decimal string (e.g. "1.000");
                      // convert to a number for display/editing, never do string arithmetic on it.
                      value={Number(row.multiplier)}
                      onChange={(e) =>
                        onUpdate(taskType, row.modelConfigId, { multiplier: Number(e.target.value) })
                      }
                      className="h-8 w-24"
                    />
                  </td>
                  <td className="py-2">
                    <Switch
                      checked={row.isDefault}
                      onCheckedChange={(checked) => {
                        // 本地互斥:同任务内新设为默认时把其余行的 isDefault 关掉。
                        // 真正的唯一性由 DB partial unique index 保证(spec §3.3),
                        // 这里只是让 UI 立即反映预期结果,不等一次网络往返。
                        if (checked) {
                          rows.forEach((sibling) => {
                            if (sibling.modelConfigId !== row.modelConfigId && sibling.isDefault) {
                              onUpdate(taskType, sibling.modelConfigId, { isDefault: false });
                            }
                          });
                        }
                        onUpdate(taskType, row.modelConfigId, { isDefault: checked });
                      }}
                    />
                  </td>
                  <td className="py-2">
                    <Switch
                      checked={row.isActive}
                      onCheckedChange={(checked) =>
                        onUpdate(taskType, row.modelConfigId, { isActive: checked })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
