'use client';

import * as React from 'react';
import { getNavigation } from '@autix/platform';

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

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, replace, onClick, children, ...rest }, ref) => {
    const localize = useLocalizePath();
    const localizedHref = localize(href);

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      onClick?.(e);
      if (e.defaultPrevented) return;
      e.preventDefault();
      const nav = getNavigation();
      // 传原始（未加前缀）href：适配器内部负责补 locale 前缀，避免双重前缀。
      if (replace) nav.replace(href);
      else nav.push(href);
    };

    return (
      <a ref={ref} href={localizedHref} onClick={handleClick} {...rest}>
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
