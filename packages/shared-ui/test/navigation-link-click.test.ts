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

/**
 * `getNavigator` 是惰性求值的 thunk：真实的 `getNavigation()` 在
 * `registerPlatform()` 未调用时会 throw，所以只应在所有守卫（修饰键 /
 * 按钮判定、调用方 onClick、defaultPrevented）都通过、确定要导航时才调用一次。
 * 这里额外记录调用次数，用于断言修饰键点击 / preventDefault 场景下
 * thunk 完全不被调用——这正是本次要修复并钉住的回归。
 */
function createNavigatorThunk() {
  const { navigator, calls } = createNavigator();
  let resolveCount = 0;
  const getNavigator = () => {
    resolveCount += 1;
    return navigator;
  };
  // Exposed as a function, not a getter: destructuring a getter invokes it
  // once and binds the resulting primitive to a plain (now-frozen) constant,
  // so every later `expect(getNavigatorCalls).toBe(0)` would compare a stale
  // captured 0 forever, no matter how many times the thunk actually runs.
  // A function reference survives destructuring — each call reads the live
  // `resolveCount` through the closure.
  const getNavigatorCalls = () => resolveCount;
  return {
    getNavigator,
    calls,
    getNavigatorCalls,
  };
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
  const { getNavigator, calls } = createNavigatorThunk();
  const e = baseEvent();

  // localizedHref（"/ja/pricing"）只用于渲染 <a href>，命令期必须传原始 href。
  handleLinkNavigation(e, '/pricing', undefined, undefined, getNavigator);

  expect(calls).toEqual([{ method: 'push', path: '/pricing' }]);
});

test('replace 属性路由到 navigator.replace 而非 navigator.push', () => {
  const { getNavigator, calls } = createNavigatorThunk();
  const e = baseEvent();

  handleLinkNavigation(e, '/pricing', true, undefined, getNavigator);

  expect(calls).toEqual([{ method: 'replace', path: '/pricing' }]);
});

test.each([
  ['metaKey', { metaKey: true }],
  ['ctrlKey', { ctrlKey: true }],
  ['shiftKey', { shiftKey: true }],
  ['altKey', { altKey: true }],
  ['non-left button (middle click)', { button: 1 }],
])('%s 时不调用 navigator（交还原生导航），也不调用 getNavigator thunk', (_label, overrides) => {
  const { getNavigator, calls, getNavigatorCalls } = createNavigatorThunk();
  const e = baseEvent(overrides);

  handleLinkNavigation(e, '/pricing', undefined, undefined, getNavigator);

  expect(calls).toEqual([]);
  // 回归钉子：修饰键 / 非左键点击必须完全不触碰 navigator 解析。
  // getNavigation() 的真实实现在 registerPlatform() 未调用时会 throw，
  // 提前求值会让新标签页打开等原生行为在未初始化平台适配器时直接崩溃。
  expect(getNavigatorCalls()).toBe(0);
});

test('修饰键点击时不调用调用方的 onClick（与原生新标签页打开行为一致）', () => {
  const { getNavigator } = createNavigatorThunk();
  const e = baseEvent({ metaKey: true });
  let onClickCalled = false;

  handleLinkNavigation(
    e,
    '/pricing',
    undefined,
    () => {
      onClickCalled = true;
    },
    getNavigator,
  );

  expect(onClickCalled).toBe(false);
});

test('调用方 onClick 内 preventDefault() 会抑制 navigator 导航，且不调用 getNavigator thunk', () => {
  const { getNavigator, calls, getNavigatorCalls } = createNavigatorThunk();
  const e = baseEvent();

  handleLinkNavigation(
    e,
    '/pricing',
    undefined,
    (ev) => {
      ev.preventDefault();
    },
    getNavigator,
  );

  expect(calls).toEqual([]);
  // 回归钉子：调用方 preventDefault() 后必须不解析 navigator。
  expect(getNavigatorCalls()).toBe(0);
});

test('未 preventDefault 的 onClick 不影响正常导航', () => {
  const { getNavigator, calls } = createNavigatorThunk();
  const e = baseEvent();
  let onClickCalled = false;

  handleLinkNavigation(
    e,
    '/pricing',
    undefined,
    () => {
      onClickCalled = true;
    },
    getNavigator,
  );

  expect(onClickCalled).toBe(true);
  expect(calls).toEqual([{ method: 'push', path: '/pricing' }]);
});
