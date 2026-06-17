import { cn } from '../../../ui/utils';

export function ParamCardGroup({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-lg border px-3 py-2 text-center text-xs transition-colors',
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
