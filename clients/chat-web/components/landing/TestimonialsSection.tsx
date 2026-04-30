'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

const TESTIMONIALS = [
  { name: '@产品经理小王', title: '产品经理', content: 'Amux Studio 让我从写需求文档到出原型只用了 10 分钟，以前至少需要半天。AI 理解力远超预期！' },
  { name: '@全栈工程师 Leo', title: '独立开发者', content: '需求描述完直接生成代码框架，省去了大量前期搭建工作。已经成为我开新项目的第一步。' },
  { name: '@设计师小鹿', title: 'UI 设计师', content: '输入产品需求就能得到设计稿草案，再微调一下就能交付客户，效率提升了不止 3 倍。' },
];

const FAQs = [
  { q: 'Amux Studio 能生成什么？', a: '支持生成 PRD（产品需求文档）、代码、UI 设计稿、原型等多种产物，覆盖产品从需求到交付的全流程。' },
  { q: '生成的代码质量如何？', a: 'AI 基于最佳实践生成结构化代码，支持多种技术栈。生成后可在线预览、编辑、迭代，直到满意为止。' },
  { q: '积分如何获取和使用？', a: '积分可通过订阅套餐、邀请好友等方式获取；每次 AI 生成任务会消耗相应积分。' },
  { q: '可以团队协作吗？', a: '团队协作功能即将开放，届时支持多人共同编辑、权限管理和版本控制。' },
  { q: '数据安全和隐私如何保障？', a: '所有项目默认私有存储，不对外公开；企业版支持数据隔离与私有化部署，满足合规要求。' },
];

export function TestimonialsSection() {
  const t = useTranslations('landing');

  return (
    <section className="py-20 relative">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Testimonials */}
          <div>
            <motion.div className="mb-10" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55 }}>
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>{t('testimonialsTitle')}</h2>
              <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>{t('testimonialsDesc')}</p>
            </motion.div>
            <div className="space-y-4">
              {TESTIMONIALS.map(({ name, title, content }, i) => (
                <motion.div key={name} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: i * 0.1 }} className="rounded-xl p-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>{name[1]}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{name}</p>
                          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{title}</p>
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, si) => (
                            <Star key={si} className="w-3.5 h-3.5 fill-current" style={{ color: '#f59e0b' }} />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{content}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div id="faq">
            <motion.div className="mb-10" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55 }}>
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>{t('faqTitle')}</h2>
              <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>{t('faqDesc')}</p>
            </motion.div>
            <div className="space-y-3">
              {FAQs.map(({ q, a }, i) => (
                <motion.details key={q} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, delay: i * 0.07 }} className="group rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium select-none" style={{ color: 'var(--foreground)', backgroundColor: 'var(--surface)' }}>
                    <span>{q}</span>
                    <span className="text-lg" style={{ color: 'var(--muted)' }}>+</span>
                  </summary>
                  <div className="px-5 pb-4 text-xs leading-relaxed" style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--muted)' }}>{a}</div>
                </motion.details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
