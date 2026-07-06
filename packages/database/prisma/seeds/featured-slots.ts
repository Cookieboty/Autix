import type { PrismaClient } from '@autix/database';

/**
 * Seed data mirroring `FEATURED_MODELS` in
 * packages/shared-ui/src/growth/home/FeaturedModelsShowcase.tsx.
 *
 * NOTE: packages/database is a leaf package and cannot import from
 * shared-ui, so this is a plain-literal copy. If FEATURED_MODELS changes,
 * this list must be updated by hand until the home hero fully migrates to
 * reading from `featured_slots`.
 */
type FeaturedHomeModel = {
  id: string;
  title: string;
  description: string;
  href: string;
  image?: string;
  video?: string;
};

const HOME_HERO_MODELS: FeaturedHomeModel[] = [
  {
    id: 'seedance-2',
    title: 'Seedance 2.0',
    description: 'Cinematic AI video generation — standard and lightning-fast variants.',
    href: '',
    video: 'https://cdn.amux.ai/playground/video/video/demo/short-film-mini.mp4',
  },
  {
    id: 'gemini-omni-flash',
    title: 'Gemini Omni Flash',
    description: 'Generate and edit video from any input, in a single flash.',
    href: '',
    video: 'https://cdn.amux.ai/background/gemini-omni__page-cover__hero.webm',
  },
  {
    id: 'nano-banana-2-lite',
    title: 'Nano Banana 2 Lite',
    description: 'Rapid generation with sharp in-image text.',
    href: '',
    image: 'https://cdn.amux.ai/background/unnamed.webp',
  },
  {
    id: 'nano-banana-pro',
    title: 'Nano Banana Pro',
    description: 'Studio-grade image generation and precise editing.',
    href: '',
    image: 'https://cdn.amux.ai/background/123.webp',
  },
  {
    id: 'nano-banana-2',
    title: 'Nano Banana 2',
    description: 'Balanced quality and speed for everyday visuals.',
    href: '',
    image: 'https://cdn.amux.ai/background/456.webp',
  },
  {
    id: 'gpt-image-2',
    title: 'GPT Image 2',
    description: 'Prompt-driven image creation with sharp fidelity.',
    href: '',
    image: 'https://cdn.amux.ai/background/16-9-6.webp',
  },
  {
    id: 'seedream-5-lite',
    title: 'Seedream 5 Lite',
    description: 'Fast, expressive image generation at scale.',
    href: '',
    image:
      'https://cdn.amux.ai/background/e71ada1e05b011f1bd68b8599f1d1fe2~tplv-d77oumduh0-watermark_ai.jpg',
  },
  {
    id: 'seedream-4-5',
    title: 'SeedReam 4.5',
    description: 'High-fidelity images with rich, detailed texture.',
    href: '',
    image:
      'https://cdn.amux.ai/background/a1104d22cdfd11f0ba0900163e56377f~tplv-d77oumduh0-watermark_ai.jpg',
  },
];

const HOME_HERO_PLACEMENT = 'home_hero';

/**
 * Idempotently seeds the 8 home-page hero slots as `featured_slots` rows
 * with placement='home_hero' and kind='CUSTOM'. Safe to run repeatedly:
 * each row has a stable id derived from the model id, so re-running only
 * updates existing rows rather than duplicating them.
 */
export async function seedFeaturedSlots(prisma: PrismaClient): Promise<void> {
  console.log('🖼️  Seeding home hero featured slots...');

  for (const [index, model] of HOME_HERO_MODELS.entries()) {
    const id = `home_hero_${model.id}`;
    const data = {
      placement: HOME_HERO_PLACEMENT,
      kind: 'CUSTOM' as const,
      resourceType: null,
      resourceId: null,
      overrideTitle: model.title,
      overrideDescription: model.description,
      overrideCoverImage: model.image ?? null,
      overrideCoverVideo: model.video ?? null,
      overrideCtaHref: model.href || null,
      position: index,
      isEnabled: true,
      createdById: 'system',
    };

    await prisma.featured_slots.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  console.log(`✅ Seeded ${HOME_HERO_MODELS.length} home hero featured slots`);
}
