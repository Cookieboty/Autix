import { Switch } from '../../../ui/switch';
import type { BooleanControlProps } from '../types';

export function SwitchControl({ label, value, onChange, disabled }: BooleanControlProps) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}
