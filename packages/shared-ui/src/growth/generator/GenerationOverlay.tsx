'use client';

import { Loader2, Sparkles } from 'lucide-react';

export function GenerationOverlay({
  active,
  title,
  description,
}: {
  active: boolean;
  title: string;
  description: string;
}) {
  if (!active) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[90] flex items-center justify-center bg-background/78 px-4 text-foreground backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <div className="growth-flow-border relative w-full max-w-xl overflow-hidden rounded-[18px] border border-border bg-card/92 p-5 text-center shadow-[0_36px_140px_rgba(0,0,0,0.55)]">
        <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-28 opacity-30" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(201,255,0,0.16),transparent_42%),linear-gradient(120deg,transparent,rgba(255,255,255,0.08),transparent)]" />
        <div className="relative mx-auto mb-4 grid size-16 place-items-center rounded-full border border-growth-accent/40 bg-growth-accent/12 text-growth-accent shadow-[0_0_46px_rgba(201,255,0,0.25)]">
          <Loader2 className="size-7 animate-spin" />
          <Sparkles className="absolute -right-1 top-1 size-4 fill-growth-accent" />
        </div>
        <h2 className="relative text-2xl font-black uppercase leading-none md:text-3xl">
          {title}
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-foreground/52">
          {description}
        </p>
        <div className="relative mt-5 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <span
              key={index}
              className="growth-clip-pulse h-1.5 rounded-full bg-growth-accent/70"
              style={{ animationDelay: `${index * 120}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
