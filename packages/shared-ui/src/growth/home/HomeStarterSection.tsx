'use client';

import { type ComponentType, type SVGProps } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Clock, Image as ImageIcon, LoaderCircle, Video } from 'lucide-react';
import {
  useClaimHomeStarterTaskMutation,
  useHomeStarterTasksQuery,
  type HomeStarterTask,
} from '@autix/shared-store';
import { ByteDanceIcon, GoogleGeminiIcon, OpenAIIcon } from '../../brand';
import { Link } from '../../navigation';
import { imageModelHref } from '../image-nav';
import { videoModelHref } from '../video-nav';
import { KNOWN_MODEL_TITLES } from './known-models';

/* ----------------------------- 数据 ----------------------------- */

type QualityModel = {
  id: string;
  title: string;
  description: string;
  /** 媒体类型，决定跳转到 image / video 生成页 */
  kind: 'image' | 'video';
  /** 跳转地址（留空则按 kind + id 自动生成，跳转到对应生成页并预选该模型） */
  href?: string;
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
    kind: 'video',
    Icon: ByteDanceIcon,
    mediaType: 'video',
  },
  {
    id: 'gemini-omni-flash',
    title: 'Gemini Omni Flash',
    description: 'Generate and edit video from any input.',
    kind: 'video',
    Icon: GoogleGeminiIcon,
    badge: 'new',
  },
  {
    id: 'nano-banana-2-lite',
    title: 'Nano Banana 2 Lite',
    description: 'Lightweight image generation at speed.',
    kind: 'image',
    Icon: GoogleGeminiIcon,
    badge: 'new',
  },
  {
    id: 'nano-banana-pro',
    title: 'Nano Banana Pro',
    description: 'Studio-grade image generation and editing.',
    kind: 'image',
    Icon: GoogleGeminiIcon,
    mediaType: 'image',
  },
  {
    id: 'gpt-image-2',
    title: 'GPT Image 2',
    description: 'Precise prompt-driven image creation.',
    kind: 'image',
    Icon: OpenAIIcon,
    iconClass: 'text-foreground',
    mediaType: 'image',
  },
  {
    id: 'seedream-5-lite',
    title: 'Seedream 5.0 Lite',
    description: 'Fast, expressive image generation.',
    kind: 'image',
    Icon: ByteDanceIcon,
    mediaType: 'image',
  },
];

type StarterTask = Pick<
  HomeStarterTask,
  | 'code'
  | 'titleI18nKey'
  | 'subtitleI18nKey'
  | 'ctaI18nKey'
  | 'modelLabel'
  | 'hrefPath'
  | 'points'
  | 'status'
  | 'completed'
>;

const FALLBACK_ONBOARDING_TASKS = [
  {
    code: 'HOME_QUEST_NANO_BANANA_PRO',
    modelLabel: 'Nano Banana Pro',
    titleI18nKey: 'onboardTryModel',
    subtitleI18nKey: 'onboardSubBestImage',
    ctaI18nKey: 'onboardCtaTry',
    hrefPath: '/ai/image',
    points: 50,
    status: 'LOCKED',
    completed: false,
  },
  {
    code: 'HOME_QUEST_SEEDANCE',
    modelLabel: 'Seedance 2.0',
    titleI18nKey: 'onboardExploreModel',
    subtitleI18nKey: 'onboardSubBestVideo',
    ctaI18nKey: 'onboardCtaExplore',
    hrefPath: '/ai/video',
    points: 80,
    status: 'LOCKED',
    completed: false,
  },
  {
    code: 'HOME_QUEST_MARKETING',
    modelLabel: 'Marketing Studio',
    titleI18nKey: 'onboardExploreModel',
    subtitleI18nKey: 'onboardSubPromptCampaign',
    ctaI18nKey: 'onboardCtaExplore',
    hrefPath: '/marketing-studio',
    points: 20,
    status: 'DISABLED',
    completed: false,
  },
] satisfies StarterTask[];

function translateHome(
  t: ReturnType<typeof useTranslations>,
  key: string,
  values?: Record<string, string | number>,
) {
  return (t as unknown as (key: string, values?: Record<string, string | number>) => string)(
    key,
    values,
  );
}

function taskTitle(t: ReturnType<typeof useTranslations>, task: StarterTask) {
  return translateHome(t, task.titleI18nKey, { model: task.modelLabel });
}

function TaskAction({
  task,
  isPending,
  onClaim,
}: {
  task: StarterTask;
  isPending: boolean;
  onClaim: (task: StarterTask) => void;
}) {
  const t = useTranslations('publicGrowth.home');
  const baseClass =
    'inline-flex h-8 min-w-16 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold transition';

  if (task.status === 'CLAIMED') {
    return (
      <button
        type="button"
        disabled
        className={`${baseClass} bg-white/12 text-white/55`}
        aria-label={translateHome(t, 'onboardCtaClaimed')}
      >
        <Check className="size-3.5" />
        {translateHome(t, 'onboardCtaClaimed')}
      </button>
    );
  }

  if (task.status === 'CLAIMABLE') {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => onClaim(task)}
        className={`${baseClass} bg-white text-neutral-900 hover:bg-white/90 disabled:cursor-wait disabled:bg-white/70`}
      >
        {isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
        {translateHome(t, 'onboardCtaClaim')}
      </button>
    );
  }

  if (task.status === 'DISABLED') {
    return (
      <button
        type="button"
        disabled
        className={`${baseClass} bg-white/10 text-white/40`}
      >
        {translateHome(t, task.ctaI18nKey)}
      </button>
    );
  }

  return (
    <Link
      href={task.hrefPath}
      className={`${baseClass} bg-white text-neutral-900 hover:bg-white/90`}
    >
      {translateHome(t, task.ctaI18nKey)}
    </Link>
  );
}

/* ----------------------------- 组件 ----------------------------- */

function OnboardingPanel() {
  const t = useTranslations('publicGrowth.home');
  const tasksQuery = useHomeStarterTasksQuery();
  const claimTask = useClaimHomeStarterTaskMutation();
  const queryTasks = tasksQuery.data?.items ?? [];
  const tasks: StarterTask[] = queryTasks.length > 0 ? queryTasks : FALLBACK_ONBOARDING_TASKS;
  const total =
    tasksQuery.data?.summary.availablePoints ??
    tasks.reduce((sum, task) => sum + (task.status !== 'DISABLED' ? task.points : 0), 0);
  const completed =
    tasksQuery.data?.summary.completed ??
    tasks.filter((task) => task.status === 'CLAIMED').length;
  const nextTask =
    tasks.find((task) => task.status !== 'CLAIMED' && task.status !== 'DISABLED') ??
    tasks[0];
  const nextTaskTitle = nextTask ? taskTitle(t, nextTask) : '';

  return (
    <div className="growth-sheen relative overflow-hidden rounded-2xl border border-growth-accent/25 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--growth-accent)_38%,#0a1206)_0%,color-mix(in_srgb,var(--growth-accent)_16%,#0a1206)_48%,#0a1206_100%)] p-2 lg:h-full lg:w-[544px] lg:shrink-0">
      <div className="flex h-full flex-col sm:flex-row">
        {/* 促销/进度列（直接叠在渐变上） */}
        <div className="flex min-w-0 flex-col justify-between p-3 sm:w-[44%]">
          <div>
            <h3 className="text-xl font-black uppercase leading-[1.1] text-white">
              {t('welcomeBonusTitle')}
            </h3>
            <p className="mt-2 text-xs leading-5 text-white/65">{t('welcomeBonusDesc')}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#6d1533]/90 px-2.5 py-1.5 text-xs font-bold text-[#ff6b98]">
              <Clock className="size-3.5" />
              {t('earnUpToCredits', { count: total })}
            </div>
          </div>
          <div className="border-l-2 border-white/30 pl-2.5">
            <div className="text-[13px] font-bold text-white">
              {t('tasksCompleted', { completed, total: tasks.length })}
            </div>
            <div className="mt-0.5 text-xs text-white/55">
              {t('nextTask', { task: nextTaskTitle })}
            </div>
          </div>
        </div>

        {/* 任务列表列（半透明深色内嵌面板，叠在渐变上） */}
        <div className="flex min-w-0 flex-1 flex-col justify-center rounded-xl bg-[#0a1206]/60 px-4 py-2">
          {tasks.map((task, index) => (
            <div key={task.code}>
              <div className="flex items-center gap-3 py-2.5">
                <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                  task.status === 'CLAIMED'
                    ? 'border-white bg-white text-[#0a1206]'
                    : task.status === 'CLAIMABLE'
                      ? 'border-white bg-white/15'
                      : 'border-white/25'
                }`}
                >
                  {task.status === 'CLAIMED' ? <Check className="size-3.5" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-white">
                    {taskTitle(t, task)}
                  </div>
                  <div className="truncate text-xs text-white/45">
                    {translateHome(t, task.subtitleI18nKey)}
                  </div>
                </div>
                <TaskAction
                  task={task}
                  isPending={claimTask.isPending && claimTask.variables === task.code}
                  onClaim={(target) => claimTask.mutate(target.code)}
                />
              </div>
              {index < tasks.length - 1 ? (
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
  // 图片模型走共享的 `?model=<模型名>` 约定（与导航下拉一致，可被 page 精确预选）；video 暂沿用旧 href
  /**
   * 图片与视频统一走 `?model=<模型名，空格转下划线>` 约定（与两个导航下拉、页尾同源），
   * 落地页按模型名精确匹配预选。
   *
   * 关键是用 **title 而不是 id**：id 是这里自己编的展示用短名（如 'seedance-2'），
   * 归一化后是 "seedance2"，与库里的 "Seedance 2.0"（"seedance20"）精确匹配不上，
   * 只能退到模糊匹配 —— 而 "seedance2" 同时是 "Seedance 2.0 Fast" 的子串，
   * 选中哪个取决于列表顺序，跳过去很可能对不上。title 能精确命中。
   *
   * 库里没有的模型（如尚未接入的 Gemini Omni Flash）不带 model 参数：
   * 带一个匹配不到的 hint，落地页会静默回落到默认模型，用户以为点错了。
   */
  const href =
    model.href ??
    (KNOWN_MODEL_TITLES.has(model.title)
      ? model.kind === 'image'
        ? imageModelHref(model.title)
        : videoModelHref(model.title)
      : model.kind === 'image'
        ? '/ai/image'
        : '/ai/video');
  return (
    <Link
      href={href}
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
    </Link>
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
