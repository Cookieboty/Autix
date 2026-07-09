import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

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

describe('locale-aware navigation', () => {
  it('没有文件从 next/navigation 取 useRouter 后跳转裸绝对路径', () => {
    const offenders = filesUsing('useRouter').filter((f) => {
      const src = readFileSync(f, 'utf8');
      const rawRouter = /import\s*\{[^}]*useRouter[^}]*\}\s*from\s*'next\/navigation'/.test(src);
      const bareNav = /router\.(push|replace)\(\s*[`'"]\//.test(src);
      return rawRouter && bareNav;
    });
    expect(offenders).toEqual([]);
  });

  it('不混用两套 pathname/router（ALLOWED_MIXED 除外）', () => {
    const offenders = filesUsing('usePathname').filter((f) => {
      if (ALLOWED_MIXED.has(f)) return false;
      const src = readFileSync(f, 'utf8');
      const rawPath = /usePathname[^;]*from\s*'next\/navigation'/.test(src);
      const intlRouter = /useRouter[^;]*from\s*'@\/i18n\/navigation'/.test(src);
      return rawPath && intlRouter;
    });
    expect(offenders).toEqual([]);
  });
});
