'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLanguageStore } from '@/store/language.store';
import { ThemeLogo } from '@autix/shared-ui/brand';
import { useChatEnabled } from '@autix/shared-ui/hooks';

export function Footer() {
  const t = useTranslations('landing');
  const { language } = useLanguageStore();
  const chatEnabled = useChatEnabled(false);
  const docsLocale = language === 'zh-CN' || language === 'zh-TW' ? 'zh-CN' : 'en';

  const footerLinks: Record<string, { label: string; href: string }[]> = {
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
      { label: t('navDocs'), href: `/${docsLocale}/docs` },
      { label: t('faqTitle'), href: '#faq' },
      { label: t('showcasePointsDetail'), href: '#' },
      { label: t('planContactUs'), href: '#' },
    ],
    [t('footerAbout')]: [
      { label: t('footerAbout'), href: '#' },
      { label: t('footerTerms'), href: '#' },
      { label: t('footerPrivacy'), href: '#' },
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
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-xs transition-colors" style={{ color: 'var(--muted)' }}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('footerCopyright')}</p>
          <div className="flex gap-4">
            <Link href="#" className="text-xs" style={{ color: 'var(--muted)' }}>{t('footerTerms')}</Link>
            <Link href="#" className="text-xs" style={{ color: 'var(--muted)' }}>{t('footerPrivacy')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
