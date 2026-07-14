import { buildSizeGridView } from '../schema-form-logic';
import { cn } from '../../../ui/utils';
import type { SizeGridControlProps } from '../types';

/**
 * 只负责把 `buildSizeGridView` 的结果画成「分辨率档位 chips + 长宽比 grid」——
 * **组件里不得有分组逻辑**，那样就测不到了（分组规则的单测覆盖见
 * schema-form-size-grid.test.ts 的 buildSizeGridView 用例）。
 */
export function SizeGridControl({ label, value, options, groupBy, onChange, disabled }: SizeGridControlProps) {
  const view = buildSizeGridView(options, groupBy, value);
  const showTiers = view.groups.length > 1;

  return (
    <div className="grid gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>

      {showTiers && (
        <div className="flex flex-wrap gap-2">
          {view.groups.map((group) => {
            const active = group.value === view.selectedTier;
            return (
              <button
                key={group.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange(view.pickTier(group.value))}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                {group.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {view.aspectOptions.map((option) => {
          const active = option.aspectValue === view.selectedAspect;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(view.pickAspect(option.aspectValue))}
              className={cn(
                'relative rounded-lg border px-3 py-2 text-center text-xs transition-colors',
                active
                  ? 'border-primary bg-primary/8 text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
