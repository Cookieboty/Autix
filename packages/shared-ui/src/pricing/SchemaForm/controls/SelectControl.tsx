import { SelectLike } from '../primitives/SelectLike';
import { cn } from '../../../ui/utils';
import type { ChoiceControlProps } from '../types';

export function SelectControl({ label, value, options, onChange, disabled }: ChoiceControlProps) {
  return (
    <div className="grid gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {/* SelectLike has no `disabled` prop (packages/shared-ui/src/pricing/SchemaForm/primitives/SelectLike.tsx);
          adapt here rather than widening that shared primitive's contract. */}
      <div className={cn(disabled && 'pointer-events-none opacity-60')} aria-disabled={disabled}>
        <SelectLike
          value={String(value)}
          options={options.map((option) => ({
            value: String(option.value),
            label: option.label,
          }))}
          onChange={(next) => {
            if (disabled) return;
            const matched = options.find((option) => String(option.value) === next);
            onChange(matched ? matched.value : next);
          }}
        />
      </div>
    </div>
  );
}
