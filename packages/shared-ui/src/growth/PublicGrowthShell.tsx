'use client';

import {
  Home,
  Image as ImageIcon,
  UserRound,
  Video,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore, useUiStore } from '@autix/shared-store';
import { Link, useRouter } from '../navigation';
import { PublicGeneratorAppNav } from './PublicGeneratorAppNav';
import { PublicPromoBar } from './PublicPromoBar';
import { IMAGE_NAV_FEATURES, imageModelHref, useImageNavModels } from './image-nav';
import { VIDEO_NAV_FEATURES, videoModelHref, useVideoNavModels } from './video-nav';

const FOOTER_YEAR = '2026';

/**
 * `labelKey` resolves against `publicGrowth.footer.links`; a plain `label` is a
 * proper noun (model name) that stays untranslated in every locale.
 */
type FooterLink = { labelKey?: string; label?: string; href: string };

type FooterGroup = { titleKey: string; links: FooterLink[] };

// 左侧 Amux Studio 列：只留 Explore / Profile / Assets / Pricing
const FOOTER_STUDIO_GROUP: FooterGroup = {
  titleKey: 'studio',
  links: [
    { labelKey: 'explore', href: '/' },
    { labelKey: 'profile', href: '/profile' },
    { labelKey: 'assets', href: '/asset' },
    { labelKey: 'pricing', href: '/pricing' },
  ],
};

// 社交超链只保留 X/Twitter + Youtube（移到底部法务区，隐私/用户协议左侧）
const FOOTER_SOCIAL: Array<[string, string]> = [
  ['X / Twitter', '#'],
  ['Youtube', '#'],
];

// 法务：去掉 Cookie Notice
const FOOTER_LEGAL: Array<[string, string]> = [
  ['privacy', '#'],
  ['terms', '#'],
];

const FOOTER_LINK_CLASS = 'text-sm text-background/80 transition hover:text-background';

/**
 * Video 列：与导航 Video 下拉一致——Features（Create / Gallery）+ 全部视频模型。
 *
 * 原来是一份静态硬编码：写死了 Seedance 2.0 与 Gemini Omni Flash 两条。前者的
 * hint 用的是 `?model=Seedance%202.0`（能匹配上），后者**库里根本没有这个模型** ——
 * 点过去匹配失败、静默落到默认模型。改成和 Image 列同源取真实模型列表后，
 * 列出来的必然是能选中的，也不用每接一个模型回来改一次页尾。
 */
function FooterVideoColumn() {
  const t = useTranslations('publicGrowth.footer');
  const tFlyout = useTranslations('publicGrowth.videoNavFlyout');
  const models = useVideoNavModels();
  const title = t('groups.video');
  return (
    <nav aria-label={title}>
      <h3 className="mb-4 text-sm font-semibold text-background/45">{title}</h3>
      <ul className="space-y-2.5">
        {VIDEO_NAV_FEATURES.map((feature) => (
          <li key={feature.key}>
            <Link href={feature.href} className={FOOTER_LINK_CLASS}>
              {tFlyout(feature.key)}
            </Link>
          </li>
        ))}
        {models.map((model) => (
          <li key={model.id}>
            <Link href={videoModelHref(model.name)} className={FOOTER_LINK_CLASS}>
              {model.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** 静态链接列（Studio） */
function FooterLinkColumn({ group }: { group: FooterGroup }) {
  const t = useTranslations('publicGrowth.footer');
  const groupTitle = t(`groups.${group.titleKey}`);
  return (
    <nav aria-label={groupTitle}>
      <h3 className="mb-4 text-sm font-semibold text-background/45">{groupTitle}</h3>
      <ul className="space-y-2.5">
        {group.links.map((link) => {
          const label = link.labelKey ? t(`links.${link.labelKey}`) : link.label!;
          return (
            <li key={`${link.labelKey ?? link.label}-${link.href}`}>
              <Link href={link.href} className={FOOTER_LINK_CLASS}>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Image 列：与导航 Image 下拉一致——Features（Create/Edit/Gallery）+ 全部图片模型，均可跳转 */
function FooterImageColumn() {
  const t = useTranslations('publicGrowth.footer');
  const tFlyout = useTranslations('publicGrowth.imageNavFlyout');
  const models = useImageNavModels();
  const title = t('groups.image');
  return (
    <nav aria-label={title}>
      <h3 className="mb-4 text-sm font-semibold text-background/45">{title}</h3>
      <ul className="space-y-2.5">
        {IMAGE_NAV_FEATURES.map((feature) => (
          <li key={feature.key}>
            <Link href={feature.href} className={FOOTER_LINK_CLASS}>
              {tFlyout(feature.key)}
            </Link>
          </li>
        ))}
        {models.map((model) => (
          <li key={model.id}>
            <Link href={imageModelHref(model.name)} className={FOOTER_LINK_CLASS}>
              {model.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PublicFooter() {
  const t = useTranslations('publicGrowth.footer');

  return (
    <footer className="bg-growth-accent text-background">
      <div className="mx-auto max-w-[1920px] px-6 py-14 md:px-10 md:py-20">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:pr-8">
            <h2 className="max-w-md text-3xl font-black uppercase leading-[1.05] tracking-tight md:text-4xl">
              {t('headline')}
            </h2>
          </div>
          <FooterLinkColumn group={FOOTER_STUDIO_GROUP} />
          <FooterImageColumn />
          <FooterVideoColumn />
        </div>
      </div>

      <div className="bg-background text-foreground/55">
        <div className="mx-auto flex max-w-[1920px] flex-col gap-3 px-6 pt-4 pb-24 text-xs md:flex-row md:items-center md:justify-between md:px-10 md:pb-4">
          <span>{t('copyright', { year: FOOTER_YEAR })}</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {FOOTER_SOCIAL.map(([label, href]) => (
              <a key={label} href={href} className="transition hover:text-foreground">
                {label}
              </a>
            ))}
            {FOOTER_LEGAL.map(([labelKey, href]) => (
              <a key={labelKey} href={href} className="transition hover:text-foreground">
                {t(`legal.${labelKey}`)}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export function MobilePublicTabs() {
  const t = useTranslations('publicGrowth.nav');
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const mobileTabs = [
    { id: 'home', label: t('home'), href: '/', icon: Home },
    { id: 'image', label: t('image'), href: '/ai/image', icon: ImageIcon },
    { id: 'video', label: t('video'), href: '/ai/video', icon: Video },
    { id: 'me', label: t('me'), href: '/profile', icon: UserRound, auth: true },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-4 gap-1">
        {mobileTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.auth && !isAuthenticated) {
                  openAuthModal({ mode: 'entry' });
                  return;
                }
                router.push(item.href);
              }}
              className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium text-foreground/62 hover:bg-secondary hover:text-foreground"
              aria-label={item.label}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function PublicGrowthShell({
  promo,
  children,
  navKind = 'home',
  navVariant,
  showNav = true,
  showPromo = true,
  showFooter = true,
}: {
  promo?: { label?: string; href?: string };
  children: React.ReactNode;
  navKind?: 'home' | 'image' | 'video';
  /** 传给导航的 variant：'fluid' 让导航默认收缩（不依赖滚动）。不传按 navKind 推导 */
  navVariant?: 'contained' | 'fluid';
  /** false 时不渲染导航（由外层持久 (public) layout 提供），用于纳入持久导航的页面（首页/pricing） */
  showNav?: boolean;
  /** false 时不渲染顶部横幅（由外层持久 (public) layout 在导航上方提供） */
  showPromo?: boolean;
  /** false 时不渲染站点页尾（如个人页这类沉浸式页面） */
  showFooter?: boolean;
}) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      {showPromo ? <PublicPromoBar label={promo?.label} href={promo?.href} /> : null}
      {showNav ? <PublicGeneratorAppNav kind={navKind} variant={navVariant} /> : null}
      {children}
      {showFooter ? <PublicFooter /> : null}
      <MobilePublicTabs />
    </div>
  );
}
