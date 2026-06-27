import type { ReactNode } from 'react';

export function ComingSoonControl({
  label,
  icon,
  badgeLabel,
  className,
}: {
  label: string;
  icon?: ReactNode;
  badgeLabel: string;
  className?: string;
}) {
  return (
    <span
      aria-disabled="true"
      title={badgeLabel}
      className={`relative inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-md border border-white/8 bg-black/22 px-3 text-sm font-semibold text-white/40 ${className ?? ''}`}
    >
      {icon}
      {label}
      <span className="ml-1 rounded-sm border border-[#c9ff00]/40 px-1 text-[10px] font-bold uppercase tracking-wide text-[#c9ff00]/70">
        {badgeLabel}
      </span>
    </span>
  );
}
