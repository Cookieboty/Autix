import { test, expect } from 'bun:test';
import { handleLinkNavigation, type LinkNavigator } from '../src/navigation';

/**
 * 覆盖 Link 点击的“命令期”行为——这部分 navigation-localize.test.tsx 没有覆盖
 * （它只 renderToString 断言 href，即“渲染期”）。
 *
 * 关键不变量：传给 navigator.push/replace 的必须是原始（未加 locale 前缀）href，
 * 而不是渲染用的 localizedHref——适配器内部会自己加前缀，传本地化后的 href 会
 * 导致双重前缀（如 /ja/ja/pricing）。
 */

function createNavigator() {
  const calls: { method: 'push' | 'replace'; path: string }[] = [];
  const navigator: LinkNavigator = {
    push: (path: string) => calls.push({ method: 'push', path }),
    replace: (path: string) => calls.push({ method: 'replace', path }),
  };
  return { navigator, calls };
}

function baseEvent(overrides: Partial<Record<string, unknown>> = {}) {
  let defaultPrevented = false;
  return {
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    button: 0,
    get defaultPrevented() {
      return defaultPrevented;
    },
    preventDefault() {
      defaultPrevented = true;
    },
    ...overrides,
  };
}

test('plain left-click 调用 navigator.push，传的是原始未加前缀的 href（不是 localizedHref）', () => {
  const { navigator, calls } = createNavigator();
  const e = baseEvent();

  // localizedHref（"/ja/pricing"）只用于渲染 <a href>，命令期必须传原始 href。
  handleLinkNavigation(e, '/pricing', undefined, undefined, navigator);

  expect(calls).toEqual([{ method: 'push', path: '/pricing' }]);
});

test('replace 属性路由到 navigator.replace 而非 navigator.push', () => {
  const { navigator, calls } = createNavigator();
  const e = baseEvent();

  handleLinkNavigation(e, '/pricing', true, undefined, navigator);

  expect(calls).toEqual([{ method: 'replace', path: '/pricing' }]);
});

test.each([
  ['metaKey', { metaKey: true }],
  ['ctrlKey', { ctrlKey: true }],
  ['shiftKey', { shiftKey: true }],
  ['altKey', { altKey: true }],
  ['non-left button (middle click)', { button: 1 }],
])('%s 时不调用 navigator（交还原生导航）', (_label, overrides) => {
  const { navigator, calls } = createNavigator();
  const e = baseEvent(overrides);

  handleLinkNavigation(e, '/pricing', undefined, undefined, navigator);

  expect(calls).toEqual([]);
});

test('修饰键点击时不调用调用方的 onClick（与原生新标签页打开行为一致）', () => {
  const { navigator } = createNavigator();
  const e = baseEvent({ metaKey: true });
  let onClickCalled = false;

  handleLinkNavigation(
    e,
    '/pricing',
    undefined,
    () => {
      onClickCalled = true;
    },
    navigator,
  );

  expect(onClickCalled).toBe(false);
});

test('调用方 onClick 内 preventDefault() 会抑制 navigator 导航', () => {
  const { navigator, calls } = createNavigator();
  const e = baseEvent();

  handleLinkNavigation(
    e,
    '/pricing',
    undefined,
    (ev) => {
      ev.preventDefault();
    },
    navigator,
  );

  expect(calls).toEqual([]);
});

test('未 preventDefault 的 onClick 不影响正常导航', () => {
  const { navigator, calls } = createNavigator();
  const e = baseEvent();
  let onClickCalled = false;

  handleLinkNavigation(
    e,
    '/pricing',
    undefined,
    () => {
      onClickCalled = true;
    },
    navigator,
  );

  expect(onClickCalled).toBe(true);
  expect(calls).toEqual([{ method: 'push', path: '/pricing' }]);
});
