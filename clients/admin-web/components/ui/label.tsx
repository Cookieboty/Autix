'use client';

import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      className={cn('text-sm font-medium leading-none', className)}
      {...props}
    />
  );
}

export { Label };
