import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// i18n: 返回 key 本身，断言用逻辑 key（accept / reject / message）。
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
// @/i18n/navigation 的 Link：渲染成普通 <a>。
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
// framer-motion：去掉动画的异步性，AnimatePresence 直接透传，motion.div 退化为 <div>。
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({
          children,
          role,
          className,
          'aria-label': ariaLabel,
        }: {
          children: React.ReactNode;
          role?: string;
          className?: string;
          'aria-label'?: string;
        }) => (
          <div role={role} className={className} aria-label={ariaLabel}>
            {children}
          </div>
        ),
    },
  ),
}));

const STORAGE_KEY = 'cookie-consent';

async function renderBanner() {
  const { CookieConsent } = await import('../components/CookieConsent');
  return render(<CookieConsent />);
}

describe('CookieConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('无历史选择时渲染 banner', async () => {
    await renderBanner();
    expect(await screen.findByText('accept')).toBeTruthy();
    expect(screen.getByText('reject')).toBeTruthy();
  });

  it('已有选择时不渲染 banner', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'accepted');
    await renderBanner();
    await waitFor(() => {
      expect(screen.queryByText('accept')).toBeNull();
    });
  });

  it('点「接受」写入 accepted 并隐藏', async () => {
    await renderBanner();
    fireEvent.click(await screen.findByText('accept'));
    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('accepted');
      expect(screen.queryByText('accept')).toBeNull();
    });
  });

  it('点「拒绝」写入 rejected 并隐藏', async () => {
    await renderBanner();
    fireEvent.click(await screen.findByText('reject'));
    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('rejected');
      expect(screen.queryByText('reject')).toBeNull();
    });
  });
});
