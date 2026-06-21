'use client';

import type { ComponentProps } from 'react';
import { cn } from '../../ui/utils';
import { ImageStudioInspirationPanel } from './panels/ImageStudioInspirationPanel';

export function ImageStudioInspirationAside({
  open,
  panelProps,
}: {
  open: boolean;
  panelProps: ComponentProps<typeof ImageStudioInspirationPanel>;
}) {
  return (
    <aside
      className={cn(
        'min-h-0 border-l border-border bg-muted/14',
        open
          ? 'fixed inset-y-0 right-0 z-40 flex w-[min(90vw,360px)] flex-col bg-background shadow-xl'
          : 'hidden',
        'xl:static xl:z-auto xl:flex xl:flex-col xl:bg-muted/14 xl:shadow-none',
      )}
    >
      <ImageStudioInspirationPanel {...panelProps} />
    </aside>
  );
}
