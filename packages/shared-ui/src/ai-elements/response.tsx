'use client';

import { memo, type ComponentProps } from 'react';
import { Streamdown } from 'streamdown';
import { cn } from '../ui/utils';

export type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
      className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}
      {...props}
    />
  ),
  (prev, next) => prev.children === next.children,
);

Response.displayName = 'Response';
