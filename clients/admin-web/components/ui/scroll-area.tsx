'use client';

import { cn } from '@/lib/utils';

interface ScrollAreaProps {
  className?: string;
  children?: React.ReactNode;
}

function ScrollArea({ className, children }: ScrollAreaProps) {
  return (
    <div className={cn('overflow-auto', className)}>
      {children}
    </div>
  );
}

export { ScrollArea };
