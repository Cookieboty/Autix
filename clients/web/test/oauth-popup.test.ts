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
function broadcast(data: unknown) {
  const bc = new BroadcastChannel('autix-oauth');
  bc.postMessage(data);
  bc.close();
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

  it('driveOAuthPopup: 设置 popup.location 为 authorizeUrl', () => {
    const popup = fakePopup();
    void driveOAuthPopup(popup, 'https://accounts.google/x', 'ch1');
    expect(popup.location.href).toBe('https://accounts.google/x');
  });

  it('driveOAuthPopup: BroadcastChannel 合法消息(channel 匹配)→ resolve', async () => {
    const popup = fakePopup();
    const p = driveOAuthPopup(popup, 'u', 'ch1');
    broadcast({ source: 'autix-oauth', channel: 'ch1', code: 'LC' });
    await expect(p).resolves.toEqual({ code: 'LC', linked: undefined, error: undefined });
  });

  it('driveOAuthPopup: BroadcastChannel 错 channel 忽略,正确 channel 才结算', async () => {
    const popup = fakePopup();
    const p = driveOAuthPopup(popup, 'u', 'ch1');
    const bc = new BroadcastChannel('autix-oauth');
    bc.postMessage({ source: 'autix-oauth', channel: 'OLD', code: 'STALE' });
    bc.postMessage({ source: 'autix-oauth', channel: 'ch1', code: 'GOOD' });
    bc.close();
    await expect(p).resolves.toEqual({ code: 'GOOD', linked: undefined, error: undefined });
  });

  it('driveOAuthPopup: postMessage 兼容信道(opener 未切断)→ resolve', async () => {
    const popup = fakePopup();
    const p = driveOAuthPopup(popup, 'u', 'ch1');
    postFrom(popup, { source: 'autix-oauth', channel: 'ch1', linked: 'github' });
    await expect(p).resolves.toEqual({ code: undefined, linked: 'github', error: undefined });
  });

  it('driveOAuthPopup: postMessage 错 origin/错 source/错 data.source → 忽略 → 超时 cancelled', async () => {
    vi.useFakeTimers();
    const popup = fakePopup();
    const p = driveOAuthPopup(popup, 'u', 'ch1');
    postFrom(popup, { source: 'autix-oauth', channel: 'ch1', code: 'X' }, 'https://evil.example'); // 错 origin
    postFrom({}, { source: 'autix-oauth', channel: 'ch1', code: 'X' }); // 错 source
    postFrom(popup, { source: 'other', channel: 'ch1', code: 'X' }); // 错 data.source
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
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

  it('driveOAuthPopup: 已结算后再次广播不二次结算', async () => {
    const popup = fakePopup();
    const p = driveOAuthPopup(popup, 'u', 'ch1');
    broadcast({ source: 'autix-oauth', channel: 'ch1', code: 'FIRST' });
    await expect(p).resolves.toEqual({ code: 'FIRST', linked: undefined, error: undefined });
    // 二次广播:已 settled,accept 提前返回,不应抛错也不改变结果
    expect(() => broadcast({ source: 'autix-oauth', channel: 'ch1', code: 'SECOND' })).not.toThrow();
    await expect(p).resolves.toEqual({ code: 'FIRST', linked: undefined, error: undefined });
  });
});
