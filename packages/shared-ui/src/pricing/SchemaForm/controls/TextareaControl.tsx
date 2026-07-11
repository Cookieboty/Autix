import type { TextControlProps } from '../types';

export function TextareaControl({ label, value, placeholder, onChange, disabled }: TextControlProps) {
  return (
    <label className="grid gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <textarea
        className="min-h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs leading-5 outline-none placeholder:text-muted-foreground focus:border-primary"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
