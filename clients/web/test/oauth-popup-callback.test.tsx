import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const search = { value: '?channel=ch1&code=LC' };
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}));

async function renderPage() {
  const Page = (await import('../app/oauth/popup-callback/page')).default;
  return render(<Page />);
}

describe('oauth popup-callback relay', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    search.value = '?channel=ch1&code=LC';
  });

  it('有 opener: postMessage 回传 channel+code 并 close', async () => {
    const postMessage = vi.fn();
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    Object.defineProperty(window, 'opener', { value: { postMessage }, configurable: true });
    await renderPage();
    expect(postMessage).toHaveBeenCalledWith(
      { source: 'autix-oauth', channel: 'ch1', code: 'LC', linked: undefined, error: undefined },
      window.location.origin,
    );
    expect(close).toHaveBeenCalled();
  });

  it('无 opener: 兜底 replace 到 /oauth/callback 带原 query', async () => {
    Object.defineProperty(window, 'opener', { value: null, configurable: true });
    const replace = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?channel=ch1&code=LC', origin: window.location.origin, replace },
      configurable: true,
    });
    await renderPage();
    expect(replace).toHaveBeenCalledWith('/oauth/callback?channel=ch1&code=LC');
  });
});
