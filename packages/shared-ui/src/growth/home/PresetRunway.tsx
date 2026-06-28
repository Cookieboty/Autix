import { Layers3, Sparkles } from 'lucide-react';
import { HomeSectionIntro } from './home-parts';

function LoopingTagRow({
  tags,
  reverse = false,
}: {
  tags: Array<{ label: string; href: string }>;
  reverse?: boolean;
}) {
  if (!tags.length) return null;
  const loopTags = [...tags, ...tags, ...tags];

  return (
    <div className="growth-mask-fade overflow-hidden py-1">
      <div
        className={`growth-preset-ribbon flex w-max items-center gap-3 ${
          reverse ? 'growth-preset-ribbon-reverse' : ''
        }`}
      >
        {loopTags.map((tag, index) => (
          <a
            key={`${tag.href}-${index}`}
            href={tag.href}
            className="growth-rb-card growth-preset-tag-shadow inline-flex min-h-12 max-w-[260px] items-center gap-3 whitespace-nowrap rounded-md border border-border bg-secondary px-5 text-sm font-semibold text-muted-foreground backdrop-blur transition hover:border-input hover:bg-accent hover:text-foreground"
            aria-hidden={index >= tags.length ? true : undefined}
            tabIndex={index >= tags.length ? -1 : undefined}
          >
            <Sparkles className="size-4 shrink-0 text-info" />
            <span className="truncate">{tag.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function PresetRunway({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  tags,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  tags: Array<{ label: string; href: string }>;
}) {
  return (
    <section className="relative overflow-hidden bg-background py-12 md:py-20">
      <div className="absolute inset-x-0 top-0 h-px bg-border" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
      <div className="growth-rb-ambient pointer-events-none absolute inset-0 opacity-60" />
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <HomeSectionIntro
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          center
          actions={
            <a
              href="/presets"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-primary px-4 py-2 text-sm font-black text-primary-foreground transition hover:bg-info"
            >
              <Layers3 className="size-4" />
              {actionLabel}
            </a>
          }
        />
      </div>
      <div className="relative mt-8 grid gap-3">
        <LoopingTagRow tags={tags} />
        <LoopingTagRow tags={[...tags].reverse()} reverse />
      </div>
    </section>
  );
}
