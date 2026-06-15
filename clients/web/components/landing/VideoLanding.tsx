'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Film,
  Layers3,
  MessageSquareText,
  Play,
  Scissors,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { VIDEO_DEMO_CDN } from '@/lib/constants';

const heroVideos = [
  `${VIDEO_DEMO_CDN}/01.mp4`,
  `${VIDEO_DEMO_CDN}/02.mp4`,
  `${VIDEO_DEMO_CDN}/03.mp4`,
  `${VIDEO_DEMO_CDN}/04.mp4`,
  `${VIDEO_DEMO_CDN}/05.mp4`,
  `${VIDEO_DEMO_CDN}/06.mp4`,
] as const;

const showcaseVideos = [
  {
    title: '电影短片叙事',
    desc: '多镜头连贯推进，人物、场景和氛围保持一致，适合品牌短片与故事广告。',
    src: `${VIDEO_DEMO_CDN}/short-film-mini.mp4`,
  },
  {
    title: '动态运镜复刻',
    desc: '跟踪、环绕、快速转场和运动节奏都可以作为参考进入创作流程。',
    src: `${VIDEO_DEMO_CDN}/03.mp4`,
  },
  {
    title: '动作与物理表现',
    desc: '复杂动作、碰撞、速度变化更稳定，适合高冲击力视觉内容。',
    src: `${VIDEO_DEMO_CDN}/action-v2-mini.mp4`,
  },
  {
    title: '活动推广视频',
    desc: '将品牌主张、活动主题和商品素材组合成可投放的推广短片。',
    src: `${VIDEO_DEMO_CDN}/compaign-mini.mp4`,
  },
  {
    title: '产品广告变体',
    desc: '围绕产品图片生成多条广告变体，保留品牌识别并快速测试不同卖点。',
    src: `${VIDEO_DEMO_CDN}/high-impact-mini.mp4`,
  },
  {
    title: '音频节奏引导',
    desc: '让画面动作、剪辑点和音乐情绪对齐，适合 MV、卡点和节日内容。',
    src: `${VIDEO_DEMO_CDN}/1770627047985_WYEvEd7j.mp4`,
  },
] as const;

const templateCards = [
  { title: '品牌开场', meta: '6s · 16:9', desc: 'Logo、口号、产品氛围一次生成' },
  { title: '产品展示', meta: '12s · 9:16', desc: '商品图转短视频，适合电商投放' },
  { title: '节日祝福', meta: '15s · 9:16', desc: '节日主题、祝福语、品牌收尾' },
  { title: '知识口播', meta: '30s · 1:1', desc: '脚本拆段、镜头节奏、字幕提示' },
] as const;

const workflow = [
  { title: '选模板', desc: '从视频模板市场选择品牌、营销、电商、节日等场景。' },
  { title: '放素材', desc: '上传首帧、尾帧、参考图、音频或参考视频。' },
  { title: 'AI 导演', desc: '用会话拆镜头、改 Prompt、补齐比例和时长参数。' },
  { title: '生成交付', desc: '在同一会话里生成、预览、复用并归档视频结果。' },
] as const;

const quickStartSteps = [
  {
    icon: Layers3,
    label: 'Templates',
    title: '从模板开始',
    desc: '选择品牌开场、产品广告、节日祝福或知识口播模板，先把结构定下来。',
    meta: '模板市场 · 变量 · 素材槽',
  },
  {
    icon: MessageSquareText,
    label: 'Chat',
    title: '在 Chat 里对齐创意',
    desc: '直接和 AI 导演聊受众、卖点、画面风格和分镜节奏，边说边改。',
    meta: 'Prompt · 分镜 · 参考素材',
  },
  {
    icon: WandSparkles,
    label: 'Agents',
    title: '让 Agents 接住细节',
    desc: '脚本、分镜、素材检查、版本评审都可以交给不同 Agent 协作完成。',
    meta: '编剧 · 分镜 · 审校',
  },
  {
    icon: Film,
    label: 'Workflow',
    title: '沉淀为视频工作流',
    desc: '把模板、会话、素材和生成步骤保存下来，下一次直接复用或继续迭代。',
    meta: '复用 · 版本 · 交付',
  },
] as const;

const contentClass = 'mx-auto max-w-[88rem] px-6';
const railPadding = {
  paddingLeft: 'max(1.5rem, calc((100vw - 88rem) / 2 + 1.5rem))',
  paddingRight: 'max(1.5rem, calc((100vw - 88rem) / 2 + 1.5rem))',
  scrollPaddingLeft: 'max(1.5rem, calc((100vw - 88rem) / 2 + 1.5rem))',
};

function useInViewOnce() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.unobserve(element);
        }
      },
      { threshold: 0.16 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, inView] as const;
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [ref, inView] = useInViewOnce();

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ${
        inView ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--brand)' }}>
      <span className="h-px w-8" style={{ backgroundColor: 'var(--brand)', opacity: 0.55 }} />
      {children}
    </p>
  );
}

function HoverSoundVideo({ src, label, className = '' }: { src: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (typeof IntersectionObserver === 'undefined') {
      void video.play().catch(() => {});
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.24 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      aria-label={label}
      className={className}
      muted
      loop
      playsInline
      preload="metadata"
      onMouseEnter={() => {
        if (ref.current) ref.current.muted = false;
      }}
      onMouseLeave={() => {
        if (ref.current) ref.current.muted = true;
      }}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}

function VideoHero() {
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [inView, setInView] = useState(true);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === active && inView) {
        video.muted = muted;
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [active, inView, muted]);

  useEffect(() => {
    const element = heroRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting);
        setInView(visible);
        if (!visible) setMuted(true);
      },
      { threshold: 0.05 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const next = () => setActive((current) => (current + 1) % heroVideos.length);

  return (
    <section
      ref={heroRef}
      className="relative min-h-[640px] overflow-hidden"
      style={{ height: '100dvh' }}
      onMouseEnter={() => setMuted(false)}
      onMouseLeave={() => setMuted(true)}
    >
      <div
        className="fixed inset-0 bg-black transition-opacity duration-500"
        style={{ zIndex: 0, opacity: inView ? 1 : 0 }}
        aria-hidden="true"
      >
        {heroVideos.map((src, index) => (
          <video
            key={src}
            ref={(element) => {
              videoRefs.current[index] = element;
            }}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
            style={{ opacity: active === index ? 1 : 0 }}
            muted
            playsInline
            preload={index === 0 ? 'auto' : 'metadata'}
            onEnded={active === index ? next : undefined}
          >
            <source src={src} type="video/mp4" />
          </video>
        ))}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.08) 34%, rgba(0,0,0,0.7) 100%)',
          }}
        />
      </div>

      <div className="relative z-10 flex h-full items-end">
        <div className="w-full pb-10 md:pb-14" style={railPadding}>
          <motion.div
            className="grid gap-8 lg:grid-cols-[1fr_28rem] lg:items-end"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <div>
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.26em] text-white/70">
                + VIDEO PRODUCT STUDIO
              </p>
              <h1 className="max-w-5xl text-5xl font-bold leading-none tracking-tight text-white md:text-7xl">
                视频模板、AI 导演和素材生成，
                <br className="hidden md:block" />
                放在一个会话里完成。
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/76 md:text-lg">
                面向营销短片、产品展示、节日祝福和知识口播。用模板定义结构，用素材锁定视觉，用视频 Chat 迭代镜头、Prompt 和生成参数。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/marketplace/video-templates"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.03]"
                >
                  浏览视频模板 <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur-md transition-transform hover:scale-[1.03]"
                >
                  打开视频工作台 <Play className="size-4" />
                </Link>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur-md transition-transform hover:scale-[1.03]"
                  onClick={() => setMuted((value) => !value)}
                >
                  {muted ? '开启声音' : '静音预览'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-white/16 bg-black/28 p-4 text-white shadow-2xl backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-md bg-white text-slate-950">
                    <Film className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">当前镜头板</p>
                    <p className="text-xs text-white/58">6 条视频参考正在轮播</p>
                  </div>
                </div>
                <span className="rounded-full bg-white/12 px-2.5 py-1 text-xs text-white/76">1080p</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {heroVideos.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    className="h-1.5 rounded-full transition-colors"
                    style={{ backgroundColor: active === index ? '#fff' : 'rgba(255,255,255,0.24)' }}
                    aria-label={`切换到视频 ${index + 1}`}
                    onClick={() => setActive(index)}
                  />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                {[
                  ['模板', '品牌/电商'],
                  ['素材', '图/音/视频'],
                  ['输出', '9:16/16:9'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-white/10 px-2 py-2">
                    <p className="text-white/56">{label}</p>
                    <p className="mt-1 font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function OverviewSection() {
  return (
    <section className="relative py-24 md:py-32">
      <Reveal className={contentClass}>
        <Eyebrow>VIDEO PIPELINE</Eyebrow>
        <h2 className="max-w-5xl text-4xl font-bold leading-tight tracking-tight md:text-6xl" style={{ color: 'var(--foreground)' }}>
          不只是“生成一个视频”，而是把素材、镜头、模板和交付沉淀成一条可复用的视频生产线。
        </h2>
        <p className="mt-6 max-w-3xl text-base leading-8 md:text-xl" style={{ color: 'var(--muted)' }}>
          参考素材进入项目，AI 导演拆解镜头，生成结果回到会话继续迭代。团队可以围绕同一套模板与素材库稳定产出短视频内容。
        </p>
      </Reveal>
    </section>
  );
}

function ShowcaseRail() {
  const scroller = useRef<HTMLDivElement | null>(null);

  const scrollByCard = (direction: -1 | 1) => {
    const element = scroller.current;
    if (!element) return;
    const card = element.querySelector<HTMLElement>('[data-video-card]');
    const step = card ? card.offsetWidth + 20 : element.clientWidth * 0.82;
    element.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  return (
    <section className="py-16 md:py-24">
      <Reveal className={`${contentClass} mb-10 md:mb-12`}>
        <Eyebrow>VIDEO SHOWCASE</Eyebrow>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h2 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl" style={{ color: 'var(--foreground)' }}>
              真实视频效果，直接进入创作判断
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7" style={{ color: 'var(--muted)' }}>
              集中展示短片叙事、动态运镜、产品广告和音频节奏等模板效果，帮助团队快速确定创作方向。
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              aria-label="上一组视频"
              className="flex size-11 items-center justify-center rounded-full border transition-colors hover:bg-white/10"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              onClick={() => scrollByCard(-1)}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="下一组视频"
              className="flex size-11 items-center justify-center rounded-full border transition-colors hover:bg-white/10"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              onClick={() => scrollByCard(1)}
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      </Reveal>

      <div
        ref={scroller}
        className="hide-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto"
        style={railPadding}
      >
        {showcaseVideos.map((item) => (
          <article key={item.title} data-video-card className="shrink-0 snap-start" style={{ width: 'clamp(320px, 54vw, 980px)' }}>
            <div className="group relative aspect-video overflow-hidden rounded-lg bg-black">
              <HoverSoundVideo
                src={item.src}
                label={item.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/72 to-transparent p-5 text-white">
                <p className="text-lg font-semibold">{item.title}</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72">{item.desc}</p>
              </div>
              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-3 py-1 text-xs text-white/80 backdrop-blur-md">
                悬浮播放声音
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StudioWorkflowSection() {
  return (
    <section className="py-20 md:py-28" style={{ backgroundColor: 'var(--surface-secondary)' }}>
      <div className={contentClass}>
        <Reveal>
          <Eyebrow>AI DIRECTOR</Eyebrow>
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div>
              <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl" style={{ color: 'var(--foreground)' }}>
                视频 Chat 负责把“想法”变成可执行镜头
              </h2>
              <p className="mt-5 text-base leading-8" style={{ color: 'var(--muted)' }}>
                不是简单套模板，而是在会话里持续调整镜头、素材、比例、时长和音频策略。生成结果绑定当前会话，后续改镜头、补素材、复用片段都能接着做。
              </p>
              <div className="mt-8 grid gap-3">
                {workflow.map((item, index) => (
                  <div key={item.title} className="flex gap-4 rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}>
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>{item.title}</h3>
                      <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border shadow-2xl" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-md" style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}>
                    <Scissors className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>新品发布短视频</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>模板 · 素材 · 镜头板</p>
                  </div>
                </div>
                <span className="rounded-full px-2.5 py-1 text-xs" style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--foreground)' }}>
                  15s 竖屏
                </span>
              </div>

              <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-3 border-b p-4 lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--border)' }}>
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                    <p className="mb-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>参考素材</p>
                    <div className="grid grid-cols-3 gap-2">
                      {showcaseVideos.slice(0, 3).map((item) => (
                        <div key={item.title} className="relative aspect-square overflow-hidden rounded-md bg-black">
                          <HoverSoundVideo src={item.src} label={`素材 ${item.title}`} className="absolute inset-0 h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {[
                    ['镜头 01', '产品首帧进入，镜头缓慢推进'],
                    ['镜头 02', '卖点文字与细节特写同步出现'],
                    ['镜头 03', '品牌收尾，保留最后一帧复用'],
                  ].map(([title, desc]) => (
                    <div key={title} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{title}</p>
                      <p className="mt-1 text-xs leading-5" style={{ color: 'var(--muted)' }}>{desc}</p>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                    <Upload className="size-4" style={{ color: 'var(--brand)' }} />
                    <span className="text-xs" style={{ color: 'var(--foreground)' }}>产品图、海报图、参考音频已就绪</span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                    <HoverSoundVideo src={showcaseVideos[4].src} label="产品广告预览" className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 text-white">
                      <p className="text-2xl font-bold">新品上市</p>
                      <p className="mt-2 max-w-xs text-sm text-white/75">根据模板变量和参考素材生成品牌短片</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs leading-5" style={{ color: 'var(--muted)' }}>
                      “把这个产品图做成小红书 15 秒新品发布短片，保留品牌蓝，第二段突出轻量化卖点。”
                    </p>
                  </div>
                  <button
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
                    style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}
                    type="button"
                  >
                    <Sparkles className="size-4" /> 发送给 AI 导演
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function TemplateSection() {
  return (
    <section className="py-20 md:py-28">
      <div className={contentClass}>
        <Reveal>
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <Eyebrow>VIDEO TEMPLATES</Eyebrow>
              <h2 className="text-4xl font-bold tracking-tight md:text-5xl" style={{ color: 'var(--foreground)' }}>
                从业务模板开始，不从空白 Prompt 开始
              </h2>
            </div>
            <Link href="/marketplace/video-templates" className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--brand)' }}>
              查看全部模板 <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {templateCards.map((item) => (
              <div key={item.title} className="rounded-lg border p-5 transition-transform hover:-translate-y-1" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                <div className="mb-5 flex size-10 items-center justify-center rounded-md" style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand)' }}>
                  <Layers3 className="size-5" />
                </div>
                <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{item.title}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--brand)' }}>{item.meta}</p>
                <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function QuickStartSection() {
  return (
    <section className="py-20 md:py-28" style={{ backgroundColor: 'var(--surface-secondary)' }}>
      <div className={contentClass}>
        <Reveal className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Eyebrow>QUICK START</Eyebrow>
            <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl" style={{ color: 'var(--foreground)' }}>
              从模板进入，用 Chat、Agents 和 Workflow 把视频做完
            </h2>
            <p className="mt-5 text-base leading-8" style={{ color: 'var(--muted)' }}>
              面向团队的视频创作入口。模板负责确定业务结构，Chat 负责快速沟通创意，Agents 负责拆解和校验，Workflow 负责把整套流程保存成可复用资产。
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {quickStartSteps.map(({ icon: Icon, label, title, desc }) => (
                <div key={label} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--brand)' }}>{label}</span>
                    <span className="flex size-8 items-center justify-center rounded-md" style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand)' }}>
                      <Icon className="size-4" />
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h3>
                  <p className="mt-2 text-xs leading-5" style={{ color: 'var(--muted)' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border shadow-2xl" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full bg-[#ff5f57]" />
                  <span className="size-3 rounded-full bg-[#febc2e]" />
                  <span className="size-3 rounded-full bg-[#28c840]" />
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Amux Video Workspace</span>
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--foreground)' }}>
                无需 API 接入
              </span>
            </div>
            <div className="grid gap-0 lg:grid-cols-[0.96fr_1.04fr]">
              <div className="border-b p-4 lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--border)' }}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-black">
                  <HoverSoundVideo src={showcaseVideos[3].src} label="模板视频预览" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/12 to-transparent" />
                  <div className="absolute inset-x-4 bottom-4 text-white">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/62">Selected Template</p>
                    <h3 className="mt-2 text-2xl font-bold">新品发布短视频</h3>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-white/72">15 秒竖屏 · 产品图 + 卖点文案 + 品牌收尾</p>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="space-y-3">
                  {quickStartSteps.map(({ icon: Icon, label, title, meta }, index) => (
                    <div key={label} className="relative rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: index === 0 ? 'var(--brand-soft)' : 'var(--surface-secondary)' }}>
                      {index < quickStartSteps.length - 1 ? (
                        <span className="absolute -bottom-3 left-8 h-3 w-px" style={{ backgroundColor: 'var(--border)' }} />
                      ) : null}
                      <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: index === 0 ? 'var(--brand)' : 'var(--surface)', color: index === 0 ? 'var(--brand-foreground)' : 'var(--foreground)' }}>
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Icon className="size-4" style={{ color: 'var(--brand)' }} />
                            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</p>
                          </div>
                          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--muted)' }}>{meta}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}>
                      <MessageSquareText className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Chat 指令</p>
                      <p className="mt-2 text-xs leading-5" style={{ color: 'var(--muted)' }}>
                        “用这个模板生成小红书新品短片，第二镜头突出轻量化卖点，让分镜 Agent 帮我检查节奏。”
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section className="py-20 md:py-28">
      <div className={contentClass}>
        <Reveal>
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <div className="grid lg:grid-cols-2">
              <div className="flex flex-col justify-center px-6 py-12 md:px-12 md:py-16">
                <BadgeCheck className="mb-5 size-9" style={{ color: 'var(--brand)' }} />
                <h2 className="max-w-xl text-4xl font-bold leading-tight tracking-tight md:text-5xl" style={{ color: 'var(--foreground)' }}>
                  让视频模板成为你的创作入口
                </h2>
                <p className="mt-5 max-w-xl text-base leading-8" style={{ color: 'var(--muted)' }}>
                  创建模板、上传素材、让 AI 导演拆镜头，然后在聊天里完成生成和后续修改。把灵感、素材和交付结果沉淀到同一条视频生产线里。
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/marketplace/video-templates"
                    className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold"
                    style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
                  >
                    进入视频模板 <Layers3 className="size-4" />
                  </Link>
                  <Link
                    href="/chat"
                    className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    立即开始创作 <Check className="size-4" />
                  </Link>
                </div>
              </div>
              <div className="relative min-h-[300px] bg-black lg:min-h-[520px]">
                <HoverSoundVideo src={showcaseVideos[0].src} label="最终视频展示" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between text-white">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs backdrop-blur-md">
                    <Play className="size-3" /> 00:08 / 00:15
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-950">Amux Studio</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function VideoLanding() {
  return (
    <div className="w-full overflow-x-hidden">
      <VideoHero />
      <div className="relative z-[1]" style={{ backgroundColor: 'var(--background)' }}>
        <OverviewSection />
        <ShowcaseRail />
        <StudioWorkflowSection />
        <TemplateSection />
        <QuickStartSection />
        <FinalCTASection />
      </div>
    </div>
  );
}
