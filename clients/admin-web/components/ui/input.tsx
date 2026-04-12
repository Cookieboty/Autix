'use client';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-field border border-border bg-field-background px-3 py-2 text-sm text-field-foreground',
        'placeholder:text-field-placeholder',
        'focus:outline-none focus:ring-2 focus:ring-focus focus:border-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-colors',
        className
      )}
      {...props}
    />
  );
}

export { Input };
