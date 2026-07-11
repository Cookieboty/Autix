import { SliderRow } from '../../../image/studio/shared/PrimitiveControls';
import { cn } from '../../../ui/utils';
import type { RangeControlProps } from '../types';

export function SliderControl({ label, value, min, max, step, onChange, disabled }: RangeControlProps) {
  return (
    // SliderRow has no `disabled` prop (packages/shared-ui/src/image/studio/shared/PrimitiveControls.tsx);
    // adapt here rather than widening that shared primitive's contract.
    <div className={cn(disabled && 'pointer-events-none opacity-60')} aria-disabled={disabled}>
      <SliderRow label={label} value={value} min={min} max={max} step={step ?? 1} onChange={onChange} />
    </div>
  );
}
