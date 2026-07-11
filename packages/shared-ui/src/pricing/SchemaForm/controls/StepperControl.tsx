import { NumberStepper } from '../../../video/workbench/shared/NumberStepper';
import type { RangeControlProps } from '../types';

export function StepperControl({ label, value, min, max, step, onChange, disabled }: RangeControlProps) {
  return (
    <NumberStepper label={label} value={value} min={min} max={max} step={step ?? 1} onChange={onChange} disabled={disabled} />
  );
}
