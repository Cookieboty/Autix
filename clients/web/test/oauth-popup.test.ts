import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { newChannel, openBlankPopup, driveOAuthPopup } from '../lib/oauth-popup';

function fakePopup() {
  return { closed: false, close: vi.fn(), location: { href: '' } } as unknown as Window & { closed: boolean; location: { href: string } };
}
function postFrom(source: unknown, data: unknown, origin = window.location.origin) {
  const ev = new MessageEvent('message', { data, origin });
  Object.defineProperty(ev, 'source', { value: source });
  window.dispatchEvent(ev);
}

describe('oauth-popup mechanics', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.useRealTimers());

  it('newChannel 每次不同', () => {
    expect(newChannel()).not.toEqual(newChannel());
  });

  it('openBlankPopup 用同步 window.open + 不含 noopener', () => {
    const spy = vi.spyOn(window, 'open').mockReturnValue(null);
    openBlankPopup();
    const features = String(spy.mock.calls[0][2] ?? '');
    expect(features).not.toMatch(/noopener|noreferrer/);
    expect(spy.mock.calls[0][0]).toBe(''); // 空白页,稍后设 location
  });

  it('driveOAuthPopup: 合法 message(channel 匹配)→ resolve code', async () => {
    const popup = fakePopup();
    const p = driveOAuthPopup(popup, 'https://accounts.google/x', 'ch1');
    expect(popup.location.href).toBe('https://accounts.google/x');
    postFrom(popup, { source: 'autix-oauth', channel: 'ch1', code: 'LC' });
    await expect(p).resolves.toEqual({ code: 'LC', linked: undefined, error: undefined });
  });

  it('driveOAuthPopup: 错 channel(旧流程晚到)→ 忽略', async () => {
    vi.useFakeTimers();
    const popup = fakePopup();
    const p = driveOAuthPopup(popup, 'u', 'ch1');
    postFrom(popup, { source: 'autix-oauth', channel: 'OLD', code: 'STALE' });
    popup.closed = true;
    vi.advanceTimersByTime(500); // 触发 closed 轮询
    await expect(p).resolves.toEqual({ cancelled: true });
  });

  it('driveOAuthPopup: 错 origin / 错 source / 错 data.source → 忽略', async () => {
    vi.useFakeTimers();
    const popup = fakePopup();
    const p = driveOAuthPopup(popup, 'u', 'ch1');
    postFrom(popup, { source: 'autix-oauth', channel: 'ch1', code: 'X' }, 'https://evil.example'); // 错 origin
    postFrom({}, { source: 'autix-oauth', channel: 'ch1', code: 'X' }); // 错 source
    postFrom(popup, { source: 'other', channel: 'ch1', code: 'X' }); // 错 data.source
    popup.closed = true;
    vi.advanceTimersByTime(500);
    await expect(p).resolves.toEqual({ cancelled: true });
  });

  it('driveOAuthPopup: 用户关闭 popup → cancelled', async () => {
    vi.useFakeTimers();
    const popup = fakePopup();
    const p = driveOAuthPopup(popup, 'u', 'ch1');
    popup.closed = true;
    vi.advanceTimersByTime(500);
    await expect(p).resolves.toEqual({ cancelled: true });
  });

  it('driveOAuthPopup: location 抛错 → error result', async () => {
    const popup = fakePopup();
    Object.defineProperty(popup, 'location', { get: () => { throw new DOMException('blocked'); } });
    await expect(driveOAuthPopup(popup, 'u', 'ch1')).resolves.toEqual({ error: 'OAUTH_POPUP_NAVIGATION_FAILED' });
  });

  it('driveOAuthPopup: 超时 → cancelled', async () => {
    vi.useFakeTimers();
    const popup = fakePopup();
    const p = driveOAuthPopup(popup, 'u', 'ch1');
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    await expect(p).resolves.toEqual({ cancelled: true });
  });

  it('driveOAuthPopup: 已结算后再触发 closed 不二次结算', async () => {
    vi.useFakeTimers();
    const popup = fakePopup();
    const p = driveOAuthPopup(popup, 'u', 'ch1');
    postFrom(popup, { source: 'autix-oauth', channel: 'ch1', code: 'LC' });
    await expect(p).resolves.toEqual({ code: 'LC', linked: undefined, error: undefined });
    popup.closed = true;
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
  });
});
