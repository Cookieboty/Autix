import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { routing } from '@/i18n/routing';

/**
 * 同一文件内 pathname 与 router 必须同源，否则双重前缀。
 * 已知且正确的例外见 ALLOWED_MIXED。
 */
const ALLOWED_MIXED = new Set([
  'components/AuthModalHost.tsx', // returnTo 需要原始含前缀 pathname
]);

function filesUsing(sym: string): string[] {
  return execSync(`grep -rl "${sym}" app components || true`, { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
}

/**
 * 剥离行注释、块注释、JSX 注释，避免死代码/注释掉的代码触发下面的正则误报
 * （或反过来，被人为改写成绕过正则的样子）。
 */
function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '') // JSX comments: {/* ... */}
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments: /* ... */
    .replace(/(?<!:)\/\/.*$/gm, ''); // line comments: // ... (but not the `//` inside `https://`)
}

function readStripped(f: string): string {
  return stripComments(readFileSync(f, 'utf8'));
}

describe('stripComments', () => {
  it('不会把字符串字面量里的 "://" 误判成行注释起点，藏住同行的 offender', () => {
    // https://x 里的 // 不是注释；旧正则会把从这个 // 开始到行尾全部吃掉，
    // 连带把后面真正的 router.push('/ja/y') 一起吞掉，造成护栏漏报。
    const src = `<a href="https://x">{router.push('/ja/y')}</a>`;
    const stripped = stripComments(src);
    expect(stripped).toContain("router.push('/ja/y')");
  });
});

describe('locale-aware navigation', () => {
  it('没有文件从 next/navigation 取 useRouter 后跳转裸绝对路径', () => {
    const offenders = filesUsing('useRouter').filter((f) => {
      const src = readStripped(f);
      const rawRouter = /import\s*\{[^}]*useRouter[^}]*\}\s*from\s*'next\/navigation'/.test(src);
      const bareNav = /router\.(push|replace)\(\s*[`'"]\//.test(src);
      return rawRouter && bareNav;
    });
    expect(offenders).toEqual([]);
  });

  it('不混用两套 pathname/router：raw usePathname + intl useRouter（ALLOWED_MIXED 除外）', () => {
    const offenders = filesUsing('usePathname').filter((f) => {
      if (ALLOWED_MIXED.has(f)) return false;
      const src = readStripped(f);
      const rawPath = /usePathname[^;]*from\s*'next\/navigation'/.test(src);
      const intlRouter = /useRouter[^;]*from\s*'@\/i18n\/navigation'/.test(src);
      return rawPath && intlRouter;
    });
    expect(offenders).toEqual([]);
  });

  it('不混用两套 pathname/router（反向）：intl usePathname + raw useRouter（ALLOWED_MIXED 除外）', () => {
    // 与上一条对称：intl usePathname 拿到的是裸路径，交给 raw router 会字面导航、
    // 丢失 locale 前缀，同样是 iron law 1 的违反，只是方向相反。
    const offenders = filesUsing('usePathname').filter((f) => {
      if (ALLOWED_MIXED.has(f)) return false;
      const src = readStripped(f);
      const intlPath = /usePathname[^;]*from\s*'@\/i18n\/navigation'/.test(src);
      const rawRouter = /useRouter[^;]*from\s*'next\/navigation'/.test(src);
      return intlPath && rawRouter;
    });
    expect(offenders).toEqual([]);
  });

  it('intl router（@/i18n/navigation）的字符串字面量导航参数不得预置 locale 前缀', () => {
    // 同模块 intl usePathname + intl useRouter 会通过前两条检查，但如果字符串字面量
    // 硬编码了已带前缀的路径（如 router.push('/ja/pricing')），运行时会被 intl router
    // 再加一次前缀，双重前缀。locale 列表取自 @/i18n/routing，避免硬编码漂移。
    //
    // 变量名不要求恰好叫 router：只要求以 router/Router 结尾（大小写不敏感），
    // 这样 AuthModalHost.tsx 里 `const localeRouter = useRouter()` 这种别名也能被扫到，
    // 不会因为改了个变量名就绕过这条护栏。
    const locales = new Set<string>(routing.locales);
    const offenders: string[] = [];
    for (const f of filesUsing('useRouter')) {
      const src = readStripped(f);
      const intlRouterImport = /import\s*\{[^}]*useRouter[^}]*\}\s*from\s*'@\/i18n\/navigation'/.test(src);
      if (!intlRouterImport) continue;
      for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\.(?:push|replace)\(\s*[`'"](\/[^`'"]*)[`'"]/g)) {
        const identifier = m[1];
        if (!/router$/i.test(identifier)) continue;
        const firstSegment = m[2].split('/').filter(Boolean)[0];
        if (firstSegment && locales.has(firstSegment)) {
          offenders.push(`${f}: ${m[0]})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
