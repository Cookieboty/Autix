'use client';

import { useId, type ComponentType, type SVGProps } from 'react';
import { Clock, Image as ImageIcon, Video } from 'lucide-react';

/* ----------------------------- 厂商图标（官方品牌 SVG） ----------------------------- */

const GEMINI_PATH =
  'M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z';

function GeminiIcon({ className }: { className?: string }) {
  // 该图标含 3 个渐变，会被多次渲染，id 必须唯一
  const uid = useId();
  const g0 = `${uid}-0`;
  const g1 = `${uid}-1`;
  const g2 = `${uid}-2`;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d={GEMINI_PATH} fill="#3186FF" />
      <path d={GEMINI_PATH} fill={`url(#${g0})`} />
      <path d={GEMINI_PATH} fill={`url(#${g1})`} />
      <path d={GEMINI_PATH} fill={`url(#${g2})`} />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={g0} x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={g1} x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={g2} x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ByteDanceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M14.944 18.587l-1.704-.445V10.01l1.824-.462c1-.254 1.84-.461 1.88-.453.032 0 .056 2.235.056 4.972v4.973l-.176-.008c-.104 0-.952-.207-1.88-.446z"
        fill="#00C8D2"
        fillRule="nonzero"
      />
      <path
        d="M7 16.542c0-2.736.024-4.98.064-4.98.032-.008.872.2 1.88.454l1.816.461-.016 4.05-.024 4.049-1.632.422c-.896.23-1.736.445-1.856.469L7 21.523v-4.98z"
        fill="#3C8CFF"
        fillRule="nonzero"
      />
      <path
        d="M19.24 12.477c0-9.03.008-9.515.144-9.475.072.024.784.207 1.576.406.792.207 1.576.405 1.744.445l.296.08-.016 8.56-.024 8.568-1.624.414c-.888.23-1.728.437-1.856.47l-.24.055v-9.523z"
        fill="#78E6DC"
        fillRule="nonzero"
      />
      <path
        d="M1 12.509c0-4.678.024-8.505.064-8.505.032 0 .872.207 1.872.454l1.824.461v7.582c0 4.16-.016 7.574-.032 7.574-.024 0-.872.215-1.88.47L1 21.013v-8.505z"
        fill="#325AB4"
      />
    </svg>
  );
}

function OpenAIIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z" />
    </svg>
  );
}

/* ----------------------------- 数据 ----------------------------- */

type QualityModel = {
  id: string;
  title: string;
  description: string;
  href: string;
  /** 厂商图标 */
  Icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
  /** 图标颜色类（Gemini 自带渐变，无需设置） */
  iconClass?: string;
  /** 右上角徽章：new 优先，其次媒体类型 */
  badge?: 'new';
  mediaType?: 'image' | 'video';
};

const QUALITY_MODELS: QualityModel[] = [
  {
    id: 'seedance-2',
    title: 'Seedance 2.0',
    description: 'Create high-quality videos in seconds.',
    href: '',
    Icon: ByteDanceIcon,
    mediaType: 'video',
  },
  {
    id: 'gemini-omni-flash',
    title: 'Gemini Omni Flash',
    description: 'Generate and edit video from any input.',
    href: '',
    Icon: GeminiIcon,
    badge: 'new',
  },
  {
    id: 'nano-banana-2-lite',
    title: 'Nano Banana 2 Lite',
    description: 'Lightweight image generation at speed.',
    href: '',
    Icon: GeminiIcon,
    badge: 'new',
  },
  {
    id: 'nano-banana-pro',
    title: 'Nano Banana Pro',
    description: 'Studio-grade image generation and editing.',
    href: '',
    Icon: GeminiIcon,
    mediaType: 'image',
  },
  {
    id: 'gpt-image-2',
    title: 'GPT Image 2',
    description: 'Precise prompt-driven image creation.',
    href: '',
    Icon: OpenAIIcon,
    iconClass: 'text-foreground',
    mediaType: 'image',
  },
  {
    id: 'seedream-5-lite',
    title: 'Seedream 5 Lite',
    description: 'Fast, expressive image generation.',
    href: '',
    Icon: ByteDanceIcon,
    mediaType: 'image',
  },
];

// 新手引导任务（样式占位，逻辑后续对接）
const ONBOARDING_TASKS = [
  { id: 'nano-banana-pro', title: 'Try Nano Banana Pro', subtitle: 'The best image model', cta: 'Try it', points: 50 },
  { id: 'seedance', title: 'Explore Seedance 2.0', subtitle: 'The best AI video model', cta: 'Explore', points: 80 },
  { id: 'marketing', title: 'Explore Marketing Studio', subtitle: 'From prompt to campaign', cta: 'Explore', points: 20 },
];

/* ----------------------------- 组件 ----------------------------- */

function OnboardingPanel() {
  const total = ONBOARDING_TASKS.reduce((sum, task) => sum + task.points, 0);
  const completed = 0;

  return (
    <div className="growth-sheen relative overflow-hidden rounded-2xl border border-growth-accent/25 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--growth-accent)_38%,#0a1206)_0%,color-mix(in_srgb,var(--growth-accent)_16%,#0a1206)_48%,#0a1206_100%)] p-2 lg:h-full lg:w-[544px] lg:shrink-0">
      <div className="flex h-full flex-col sm:flex-row">
        {/* 促销/进度列（直接叠在渐变上） */}
        <div className="flex min-w-0 flex-col justify-between p-3 sm:w-[44%]">
          <div>
            <h3 className="text-xl font-black uppercase leading-[1.1] text-white">Welcome Bonus</h3>
            <p className="mt-2 text-xs leading-5 text-white/65">
              Complete guided tasks and earn credits.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#6d1533]/90 px-2.5 py-1.5 text-xs font-bold text-[#ff6b98]">
              <Clock className="size-3.5" />
              Earn up to {total} credits
            </div>
          </div>
          <div className="border-l-2 border-white/30 pl-2.5">
            <div className="text-[13px] font-bold text-white">
              {completed} of {ONBOARDING_TASKS.length} completed
            </div>
            <div className="mt-0.5 text-xs text-white/55">Next task: {ONBOARDING_TASKS[0].title}</div>
          </div>
        </div>

        {/* 任务列表列（半透明深色内嵌面板，叠在渐变上） */}
        <div className="flex min-w-0 flex-1 flex-col justify-center rounded-xl bg-[#0a1206]/60 px-4 py-2">
          {ONBOARDING_TASKS.map((task, index) => (
            <div key={task.id}>
              <div className="flex items-center gap-3 py-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-white/25" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-white">{task.title}</div>
                  <div className="truncate text-xs text-white/45">{task.subtitle}</div>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-neutral-900 transition hover:bg-white/90"
                >
                  {task.cta}
                </button>
              </div>
              {index < ONBOARDING_TASKS.length - 1 ? (
                <div className="h-px bg-white/10" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QualityModelCard({ model }: { model: QualityModel }) {
  const Icon = model.Icon;
  return (
    <a
      href={model.href}
      aria-label={model.title}
      className="group/card flex flex-col justify-between rounded-2xl border border-border bg-[#1c1e20] p-4 transition duration-300 hover:bg-[#23252a]"
    >
      <div className="flex items-start justify-between gap-3">
        <Icon className={`size-6 ${model.iconClass ?? ''}`} />
        {model.badge === 'new' ? (
          <span className="rounded-md bg-growth-accent px-2 py-0.5 text-[11px] font-black uppercase italic text-background">
            New
          </span>
        ) : model.mediaType ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {model.mediaType === 'video' ? (
              <Video className="size-3" />
            ) : (
              <ImageIcon className="size-3" />
            )}
            {model.mediaType === 'video' ? 'Video' : 'Image'}
          </span>
        ) : null}
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground transition-colors duration-300 group-hover/card:text-growth-accent">
          {model.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{model.description}</p>
      </div>
    </a>
  );
}

export function HomeStarterSection() {
  return (
    <section className="bg-background pb-8 md:pb-10">
      <div className="mx-auto max-w-[1920px] px-4 md:px-6">
        <div className="flex flex-col gap-4 lg:h-[264px] lg:flex-row">
          <OnboardingPanel />
          <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:h-full lg:grid-cols-3 lg:grid-rows-2">
            {QUALITY_MODELS.map((model) => (
              <QualityModelCard key={model.id} model={model} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
