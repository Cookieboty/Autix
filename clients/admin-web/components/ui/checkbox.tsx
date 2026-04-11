'use client';

import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  'data-state'?: string;
}

function Checkbox({ className, checked, onCheckedChange, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={cn(
        'h-4 w-4 rounded border border-border bg-field-background',
        'checked:bg-accent checked:border-accent',
        'focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1',
        'cursor-pointer transition-colors',
        className
      )}
      {...props}
    />
  );
}

export { Checkbox };
