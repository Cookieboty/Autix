'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PLAN_ACCENTS } from '../public-pricing-helpers';
import type { TFunc } from './pricing-parts';

export function UseCasesSection() {
  const t = useTranslations('publicGrowth.pricing') as TFunc;
  const useCaseKeys = ['image', 'video', 'publicGrowth'] as const;

  return (
    <section className="border-t border-foreground/10 growth-pricing-usecases-bg">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <h2 className="text-3xl font-black uppercase tracking-tight text-foreground md:text-4xl">
          {t('useCasesTitle')}
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {useCaseKeys.map((key, index) => (
            <div
              key={key}
              className="rounded-2xl border border-foreground/10 bg-background/35 p-5 transition duration-300 hover:border-foreground/22 hover:bg-background/55"
            >
              <div
                className="mb-4 flex size-10 items-center justify-center rounded-full bg-foreground/[0.08]"
                style={{ color: PLAN_ACCENTS[index % PLAN_ACCENTS.length] }}
              >
                <Sparkles className="size-5" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                {t((`useCases.${key}.title`) as Parameters<TFunc>[0])}
              </h3>
              <p className="mt-3 text-sm leading-6 text-foreground/60">
                {t((`useCases.${key}.body`) as Parameters<TFunc>[0])}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
