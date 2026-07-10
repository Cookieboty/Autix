'use client';

import * as React from 'react';
import { getNavigation, type NavigationAdapter } from '@autix/platform';

/**
 * 与 `next/link` API 兼容的 <Link> 组件 — 内部走 NavigationAdapter，
 * 让共享组件可在 Next.js 和 react-router 双栈中无差别工作。
 */
export interface LinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> {
  href: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  children?: React.ReactNode;
}

/**
 * 渲染期本地化 context。`getNavigation()` 是模块级单例，SSR 时跨请求共享，
 * 因此 `<a href>` 的取值不能读单例（会在并发请求间串语言），必须走 React context。
 * 命令期（push/replace）只在浏览器事件回调中执行，读单例是安全的。
 */
const LocalizeCtx = React.createContext<(path: string) => string>((p) => p);
export const LocaleRoutingProvider = LocalizeCtx.Provider;
export function useLocalizePath(): (path: string) => string {
  return React.useContext(LocalizeCtx);
}

/**
 * `handleClick` 的最小事件形状——足以覆盖修饰键 / 按钮判定和
 * `preventDefault()` 读取，无需依赖真实 DOM MouseEvent。
 */
export interface LinkClickEvent {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
  readonly defaultPrevented: boolean;
  preventDefault(): void;
}

/**
 * `getNavigation()` 的最小子集，供 `handleLinkNavigation` 依赖注入以便单测。
 * 派生自 `NavigationAdapter` 而非手写重复字段，避免两处签名静默漂移。
 */
export type LinkNavigator = Pick<NavigationAdapter, 'push' | 'replace'>;

/**
 * `Link` 点击的命令期决策逻辑，从组件中抽出以便无 DOM 单测覆盖。
 *
 * @internal 仅为单测可注入而导出，不是包的公共 API 承诺，调用方不应依赖。
 *
 * - 修饰键（meta/ctrl/shift/alt）或非左键点击：不调用 `onClick`，交还原生导航
 *   （如新标签页打开），不触碰 navigator——也不调用 `getNavigator`。
 * - 调用方 `onClick` 若 `preventDefault()`，跳过 navigator 导航，同样不调用
 *   `getNavigator`。
 * - `getNavigator` 是惰性 thunk：真实的 `getNavigation()` 在
 *   `registerPlatform()` 未调用时会 throw，因此必须等所有守卫都通过、确定
 *   要导航时才求值，不能在函数入参处提前调用。
 * - 传给 `navigator.push`/`navigator.replace` 的必须是原始（未加 locale 前缀）
 *   `href`，不是渲染用的 `localizedHref`——适配器内部负责补前缀，传本地化后的
 *   href 会导致双重前缀（如 `/ja/ja/pricing`）。
 */
export function handleLinkNavigation<E extends LinkClickEvent>(
  e: E,
  href: string,
  replace: boolean | undefined,
  onClick: ((e: E) => void) | undefined,
  getNavigator: () => LinkNavigator,
): void {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  onClick?.(e);
  if (e.defaultPrevented) return;
  e.preventDefault();
  const navigator = getNavigator();
  if (replace) navigator.replace(href);
  else navigator.push(href);
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, replace, onClick, children, ...rest }, ref) => {
    const localize = useLocalizePath();

    // `href`（原始、未加 locale 前缀）刻意留在闭包里，不引入本地化后的标识符：
    // navigator.push/replace 必须收到原始 href，适配器内部会自己补前缀，传
    // 本地化后的路径会造成双重前缀（如 /ja/ja/pricing）。`getNavigation` 以
    // thunk 形式传入，只在 handleLinkNavigation 确认要导航时才惰性求值。
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      handleLinkNavigation(e, href, replace, onClick, getNavigation);
    };

    return (
      <a ref={ref} href={localize(href)} onClick={handleClick} {...rest}>
        {children}
      </a>
    );
  },
);
Link.displayName = 'Link';

export { Link as default };

/** 与 next/navigation 的 useRouter 形状兼容（最小子集） */
export function useRouter() {
  return React.useMemo(
    () => ({
      push: (path: string) => getNavigation().push(path),
      replace: (path: string) => getNavigation().replace(path),
      back: () => {
        if (typeof window !== 'undefined') window.history.back();
      },
      forward: () => {
        if (typeof window !== 'undefined') window.history.forward();
      },
      refresh: () => {
        if (typeof window !== 'undefined') window.location.reload();
      },
    }),
    [],
  );
}

/** 与 next/navigation 的 usePathname 兼容 */
export function usePathname(): string {
  const [pathname, setPathname] = React.useState<string>(() => {
    try {
      return getNavigation().getPathname();
    } catch {
      return '/';
    }
  });

  React.useEffect(() => {
    const handler = () => {
      try {
        setPathname(getNavigation().getPathname());
      } catch {
        // adapter not ready
      }
    };
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = getNavigation().subscribe?.(handler);
    } catch {
      // adapter not ready
    }
    handler();
    if (typeof window === 'undefined') return unsubscribe;
    window.addEventListener('popstate', handler);
    return () => {
      unsubscribe?.();
      window.removeEventListener('popstate', handler);
    };
  }, []);

  return pathname;
}

/** 与 next/navigation 的 useSearchParams 兼容（只读） */
export function useSearchParams(): URLSearchParams {
  const [params, setParams] = React.useState<URLSearchParams>(() => {
    try {
      return new URLSearchParams(getNavigation().getSearch?.() ?? window.location.search);
    } catch {
      if (typeof window === 'undefined') return new URLSearchParams();
      return new URLSearchParams(window.location.search);
    }
  });

  React.useEffect(() => {
    const handler = () => {
      try {
        setParams(new URLSearchParams(getNavigation().getSearch?.() ?? window.location.search));
      } catch {
        if (typeof window !== 'undefined') setParams(new URLSearchParams(window.location.search));
      }
    };
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = getNavigation().subscribe?.(handler);
    } catch {
      // adapter not ready
    }
    handler();
    if (typeof window === 'undefined') return unsubscribe;
    window.addEventListener('popstate', handler);
    return () => {
      unsubscribe?.();
      window.removeEventListener('popstate', handler);
    };
  }, []);

  return params;
}

export function useParams<T extends Record<string, string | string[]>>(): T {
  // 简化实现：从 pathname 解析不出参数，让调用方自行用 useParams from react-router 或 next/navigation
  return {} as T;
}
