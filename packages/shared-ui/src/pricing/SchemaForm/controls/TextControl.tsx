import type { TextControlProps } from '../types';

export function TextControl({ label, value, placeholder, onChange, disabled }: TextControlProps) {
  return (
    <label className="grid gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        className="h-9 rounded-md border border-border bg-background px-3 outline-none focus:border-primary"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
