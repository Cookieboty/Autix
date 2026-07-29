import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '../../../../ui/skeleton';

export function DashboardSectionShell({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-card rounded-xl border">
      <header className="border-border border-b px-6 py-5">
        <div className="flex items-start gap-3">
          <Icon className="text-muted-foreground mt-0.5 h-4 w-4" />
          <div>
            <h2 className="text-foreground text-lg font-semibold">{title}</h2>
            {description ? <p className="text-muted-foreground mt-1 text-sm leading-6">{description}</p> : null}
          </div>
        </div>
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}
