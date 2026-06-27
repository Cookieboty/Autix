import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const search = { value: '?channel=ch1&code=LC' };
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}));

async function renderPage() {
  const Page = (await import('../app/oauth/popup-callback/page')).default;
  return render(<Page />);
}

describe('oauth popup-callback relay', () => {
  const originalBC = globalThis.BroadcastChannel;
  const originalLocation = window.location;

  beforeEach(() => {
    vi.restoreAllMocks();
    search.value = '?channel=ch1&code=LC';
    globalThis.BroadcastChannel = originalBC;
  });
  afterEach(() => {
    globalThis.BroadcastChannel = originalBC;
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
  });

  it('广播到 BroadcastChannel(含 channel)+ opener.postMessage,随后延迟 close', async () => {
    const received: unknown[] = [];
    const listener = new BroadcastChannel('autix-oauth');
    listener.onmessage = (e) => received.push(e.data);

    const postMessage = vi.fn();
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    Object.defineProperty(window, 'opener', { value: { postMessage }, configurable: true });

    await renderPage();

    await waitFor(() => expect(received.length).toBe(1));
    expect(received[0]).toEqual({
      source: 'autix-oauth', channel: 'ch1', code: 'LC', linked: undefined, error: undefined,
    });
    expect(postMessage).toHaveBeenCalledWith(
      { source: 'autix-oauth', channel: 'ch1', code: 'LC', linked: undefined, error: undefined },
      window.location.origin,
    );
    await waitFor(() => expect(close).toHaveBeenCalled());
    listener.close();
  });

  it('无 opener 但有 BroadcastChannel:仅广播 + close,不 replace', async () => {
    const received: unknown[] = [];
    const listener = new BroadcastChannel('autix-oauth');
    listener.onmessage = (e) => received.push(e.data);

    Object.defineProperty(window, 'opener', { value: null, configurable: true });
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    const replace = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?channel=ch1&code=LC', origin: originalLocation.origin, replace },
      configurable: true,
    });

    await renderPage();

    await waitFor(() => expect(received.length).toBe(1));
    expect(replace).not.toHaveBeenCalled();
    await waitFor(() => expect(close).toHaveBeenCalled());
    listener.close();
  });

  it('无 opener 且无 BroadcastChannel:兜底 replace /oauth/callback 带原 query', async () => {
    // @ts-expect-error 模拟极旧环境
    globalThis.BroadcastChannel = undefined;
    Object.defineProperty(window, 'opener', { value: null, configurable: true });
    const replace = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?channel=ch1&code=LC', origin: originalLocation.origin, replace },
      configurable: true,
    });

    await renderPage();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/oauth/callback?channel=ch1&code=LC'));
  });
});
