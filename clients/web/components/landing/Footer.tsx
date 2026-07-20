'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useLanguageStore } from '@autix/shared-store';
import { ThemeLogo } from '@autix/shared-ui/brand';
import { useChatEnabled } from '@autix/shared-ui/hooks';

export function Footer() {
  const t = useTranslations('landing');
  const { language } = useLanguageStore();
  const chatEnabled = useChatEnabled(false);
  const docsLocale = language === 'zh-CN' || language === 'zh-TW' ? 'zh-CN' : 'en';

  const footerLinks: Record<string, { label: string; href: string; plain?: boolean }[]> = {
    [t('footerProduct')]: [
      ...(chatEnabled
        ? [
            { label: t('navWorkspace'), href: '/chat' },
            { label: t('showcaseGallery'), href: '/chat' },
          ]
        : []),
      { label: t('navPricing'), href: '#pricing' },
      { label: t('showcasePoints'), href: '/register' },
    ],
    [t('footerHelp')]: [
      // 与 Navbar 同理：href 已带 docs 专属 locale 前缀（docs 只有 en/zh-CN 两版），
      // 标记 plain 以渲染裸 <a>，避免 next-intl <Link> 再叠一层当前站点 locale 前缀。
      { label: t('navDocs'), href: `/${docsLocale}/docs`, plain: true },
      { label: t('faqTitle'), href: '#faq' },
      { label: t('showcasePointsDetail'), href: '#' },
      { label: t('planContactUs'), href: '#' },
    ],
    [t('footerAbout')]: [
      { label: t('footerAbout'), href: '#' },
      // 与上面 navDocs 同理：法律文档也在 /docs 下，只有 en/zh-CN 两版，
      // 需要 plain + 显式 docs-locale 前缀，避免 next-intl <Link> 再叠一层站点 locale。
      { label: t('footerTerms'), href: `/${docsLocale}/docs/terms`, plain: true },
      { label: t('footerPrivacy'), href: `/${docsLocale}/docs/privacy`, plain: true },
    ],
  };

  return (
    <footer className="pt-16 pb-8" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <ThemeLogo alt="Amux Studio" size={28} />
              <span className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>{t('brand')}</span>
            </div>
            <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'var(--muted)' }}>{t('footerDesc')}</p>
          </div>

          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <p className="text-xs font-semibold mb-4" style={{ color: 'var(--foreground)' }}>{group}</p>
              <ul className="space-y-2.5">
                {links.map(({ label, href, plain }) => (
                  <li key={label}>
                    {plain ? (
                      <a href={href} className="text-xs transition-colors" style={{ color: 'var(--muted)' }}>{label}</a>
                    ) : (
                      <Link href={href} className="text-xs transition-colors" style={{ color: 'var(--muted)' }}>{label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('footerCopyright')}</p>
          <div className="flex gap-4">
            {/* 裸 <a> + 显式 docs-locale 前缀：/docs 下的路径已带 locale，
                next-intl 的 <Link> 会再叠一层站点 locale 造成双重前缀 404。 */}
            <a href={`/${docsLocale}/docs/terms`} className="text-xs" style={{ color: 'var(--muted)' }}>{t('footerTerms')}</a>
            <a href={`/${docsLocale}/docs/privacy`} className="text-xs" style={{ color: 'var(--muted)' }}>{t('footerPrivacy')}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
