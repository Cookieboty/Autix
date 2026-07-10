import { test, expect } from 'bun:test';
import { renderToString } from 'react-dom/server';
import { Link, LocaleRoutingProvider } from '../src/navigation';

test('Link 的 href 属性经 context 本地化', () => {
  const html = renderToString(
    <LocaleRoutingProvider value={(p) => `/ja${p}`}>
      <Link href="/ai/video">go</Link>
    </LocaleRoutingProvider>,
  );
  expect(html).toContain('href="/ja/ai/video"');
});

test('无 Provider 时回落为恒等函数（desktop 场景）', () => {
  const html = renderToString(<Link href="/ai/video">go</Link>);
  expect(html).toContain('href="/ai/video"');
});
