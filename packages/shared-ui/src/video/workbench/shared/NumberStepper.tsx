export function NumberStepper({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const safeValue = Number.isFinite(value) ? clamp(value) : min;
  const decrease = () => {
    if (disabled) return;
    onChange(clamp(safeValue - step));
  };
  const increase = () => {
    if (disabled) return;
    onChange(clamp(safeValue + step));
  };
  return (
    <div className="grid gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex h-9 items-stretch overflow-hidden rounded-md border border-border bg-background">
        <button
          type="button"
          disabled={disabled || safeValue <= min}
          onClick={decrease}
          className="flex w-9 items-center justify-center text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          −
        </button>
        <div className="flex flex-1 items-center justify-center border-x border-border text-xs font-medium text-foreground">
          {safeValue}
          {suffix ?? ''}
        </div>
        <button
          type="button"
          disabled={disabled || safeValue >= max}
          onClick={increase}
          className="flex w-9 items-center justify-center text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          +
        </button>
      </div>
    </div>
  );
}
