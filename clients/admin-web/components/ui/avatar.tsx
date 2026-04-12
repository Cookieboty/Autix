'use client';

import { cn } from '@/lib/utils';

interface AvatarProps {
  className?: string;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = { sm: 'h-8 w-8 text-sm', md: 'h-10 w-10 text-base', lg: 'h-12 w-12 text-lg' };

function Avatar({ className, children, size = 'md' }: AvatarProps) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full',
        sizeClasses[size],
        className
      )}
    >
      {children}
    </div>
  );
}

function AvatarImage({ className, src, alt, ...props }: React.ComponentProps<'img'>) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn('aspect-square w-full h-full object-cover', className)}
      {...props}
    />
  );
}

function AvatarFallback({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-muted font-medium',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Avatar, AvatarImage, AvatarFallback };
