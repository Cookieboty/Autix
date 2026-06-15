'use client';

import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, MessageSquareText, Play, Workflow } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { VIDEO_DEMO_CDN } from '@/lib/constants';
const STEP_KEYS = ['step1', 'step2', 'step3', 'step4'] as const;

export function WorkflowSection() {
  const t = useTranslations('landing');

  return (
    <section className="relative overflow-hidden bg-black py-24 text-white md:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(14,165,233,0.28),transparent_34%),linear-gradient(180deg,#020617_0%,#050816_55%,#000_100%)]" />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.58, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <p className="mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/58">
              <span className="h-px w-8 bg-white/42" />
              Creation Flow
            </p>
            <h2 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              {t('workflowTitle')}
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/64 md:text-lg">
              {t('workflowDesc')}。模板、Chat、Agents 和 Workflow 串成一条连续链路，每一次生成都能继续编辑、复用和交付。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/chat" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.03]">
                打开工作台 <ArrowRight className="size-4" />
              </Link>
              <Link href="/video" className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur-md transition-transform hover:scale-[1.03]">
                查看视频链路 <Play className="size-4" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="overflow-hidden rounded-lg border border-white/14 bg-white/10 shadow-2xl backdrop-blur-xl"
            initial={{ opacity: 0, x: 34 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-white/12 px-5 py-3">
              <div className="flex items-center gap-2">
                <Workflow className="size-4 text-white/68" />
                <span className="text-sm font-medium text-white/72">Workspace timeline</span>
              </div>
              <span className="rounded-full bg-white/12 px-3 py-1 text-xs text-white/70">4 steps</span>
            </div>

            <div className="grid gap-0 lg:grid-cols-[0.86fr_1.14fr]">
              <div className="border-b border-white/12 p-4 lg:border-b-0 lg:border-r">
                <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-black">
                  <video className="absolute inset-0 h-full w-full object-cover" muted loop autoPlay playsInline preload="metadata">
                    <source src={`${VIDEO_DEMO_CDN}/03.mp4`} type="video/mp4" />
                  </video>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/50">Preview</p>
                    <p className="mt-2 text-2xl font-bold">Video + Product</p>
                    <p className="mt-2 text-sm leading-6 text-white/64">同一个会话里生成文档、界面、素材与视频版本</p>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="space-y-3">
                  {STEP_KEYS.map((key, index) => (
                    <motion.div
                      key={key}
                      className="rounded-lg border border-white/12 bg-white/[0.075] p-4"
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.42, delay: index * 0.08 }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-950">
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-white">{t(`${key}Title`)}</h3>
                          <p className="mt-1 text-xs leading-5 text-white/58">{t(`${key}Desc`)}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-4 rounded-lg border border-white/12 bg-white/[0.075] p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-slate-950">
                      <MessageSquareText className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">Chat keeps context</p>
                      <p className="mt-2 text-xs leading-5 text-white/56">每一次反馈都会进入当前项目上下文，下一轮生成直接沿用。</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {[
            ['需求', '结构化成 PRD 和任务'],
            ['素材', '图片、视频、音频统一管理'],
            ['交付', '作品、版本、记录自动归档'],
          ].map(([title, desc]) => (
            <div key={title} className="flex items-center gap-3 rounded-lg border border-white/12 bg-white/[0.065] px-4 py-3 text-white/72 backdrop-blur-xl">
              <CheckCircle2 className="size-4 shrink-0 text-white" />
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-white/48">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
