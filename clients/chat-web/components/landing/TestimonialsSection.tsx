'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

const TESTIMONIALS = [
  { name: '@设计师阿杰', title: '平面设计师', content: 'Amux Design 帮我节省了大量给甲方调整的时间。模板和复用功能，让我的工作流大幅提升效率！' },
  { name: '@小鹿的运营日记', title: '新媒体运营', content: '每天需要定出高质量配图，支持商用授权且一共才花三碗拉面了！' },
  { name: '@峰影师 Leo', title: '摄影师', content: 'AI 出图质量最高最稳当，二次编辑也很方便，已经成为我工作流里不可缺少的一部分。' },
];

const FAQs = [
  { q: 'Amux Design 支持哪些生成类型？', a: '支持文生图、图生图、局部重绘、风格迁移等多种 AI 生成方式，覆盖海报、头像、产品图、封面等主流场景。' },
  { q: '生成的图片可以商用吗？', a: '基础版及以上套餐生成的图片均可商业使用，并提供版权说明文件，满足各类商业交付需求。' },
  { q: '积分如何获取和使用？', a: '积分可通过订阅套餐、每日签到、完成任务、邀请好友等方式获取；每次生成任务会消耗相应积分。' },
  { q: '可以开具真实发票吗？', a: '支持对公增值税专用发票和普通发票，企业版可申请月度账单汇总开票。' },
  { q: '数据安全和隐私如何保障？', a: '所有作品默认私有存储，不对外公开；企业版支持数据隔离与私有化部署，满足合规要求。' },
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
