import { SliderRow } from '../primitives/PrimitiveControls';
import { cn } from '../../../ui/utils';
import type { RangeControlProps } from '../types';

export function SliderControl({ label, value, min, max, step, onChange, disabled }: RangeControlProps) {
  return (
    // SliderRow has no `disabled` prop (packages/shared-ui/src/pricing/SchemaForm/primitives/PrimitiveControls.tsx);
    // adapt here rather than widening that shared primitive's contract.
    <div className={cn(disabled && 'pointer-events-none opacity-60')} aria-disabled={disabled}>
      <SliderRow label={label} value={value} min={min} max={max} step={step ?? 1} onChange={onChange} />
    </div>
  );
}
