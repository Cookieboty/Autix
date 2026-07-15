type FeatureTag = { label: string; href: string };

// 站内功能 tag（真实路由）
const FEATURE_TAGS: FeatureTag[] = [
  { label: 'Image', href: '/ai/image' },
  { label: 'Video', href: '/ai/video' },
  { label: 'Canvas', href: '/draw' },
  { label: 'Templates', href: '/ai/image?mode=gallery' },
  { label: 'Presets', href: '/presets' },
  { label: 'Viral Presets', href: '/viral-presets' },
  { label: 'Marketing Studio', href: '/marketing-studio' },
  { label: 'Cinema Studio', href: '/original-series' },
  { label: 'Originals', href: '/original-series' },
  { label: 'Edit Image', href: '/ai/image' },
  { label: 'Upscale', href: '/ai/image' },
  { label: 'Multi Reference', href: '/ai/image' },
  { label: 'Pricing', href: '/pricing' },
];

// 模型 tag（跳转到对应生成器并带上 model 提示）
const IMAGE_MODELS = [
  'Nano Banana Pro',
  'Nano Banana 2',
  'Nano Banana 2 Lite',
  'GPT Image 2',
  'Seedream 5 Lite',
  'SeedReam 4.5',
];
const VIDEO_MODELS = ['Seedance 2.0', 'Gemini Omni Flash'];

const MODEL_TAGS: FeatureTag[] = [
  ...IMAGE_MODELS.map((label) => ({ label, href: `/ai/image?model=${encodeURIComponent(label)}` })),
  ...VIDEO_MODELS.map((label) => ({ label, href: `/ai/video?model=${encodeURIComponent(label)}` })),
];

const ALL_TAGS: FeatureTag[] = [...FEATURE_TAGS, ...MODEL_TAGS];

/**
 * 「EXPLORE MORE AI FEATURES」：站内功能 tag + 模型 tag 的药丸云。
 * 目前为策展式静态列表，后续可接入真实的功能导航 / 模型接口。
 */
export function HomeFeatureTags({ title }: { title: string }) {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="mx-auto max-w-[1200px] px-4 text-center md:px-6">
        <h2 className="mb-8 text-3xl font-black uppercase tracking-tight text-foreground md:text-5xl">
          {title}
        </h2>
        <div className="flex flex-wrap justify-center gap-2.5">
          {ALL_TAGS.map((tag) => (
            <a
              key={tag.label}
              href={tag.href}
              className="rounded-lg border border-border bg-secondary px-3.5 py-1.5 text-sm font-medium text-foreground/65 transition hover:border-input hover:bg-accent hover:text-foreground"
            >
              {tag.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
