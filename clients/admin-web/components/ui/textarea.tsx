'use client';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex w-full rounded-field border border-border bg-field-background px-3 py-2 text-sm text-field-foreground',
        'placeholder:text-field-placeholder',
        'focus:outline-none focus:ring-2 focus:ring-focus focus:border-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-colors resize-none',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
