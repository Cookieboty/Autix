import { app } from 'electron';
import log from 'electron-log/main';
import { getMainWindow } from './window';

const PROTOCOL = 'autix';

/** 白名单 — 只允许这些只读路径 */
const ALLOWED_PATHS: RegExp[] = [
  /^\/chat$/,
  /^\/chat\/[a-zA-Z0-9_-]+$/,
  /^\/notifications$/,
  /^\/templates$/,
  /^\/templates\/[a-zA-Z0-9_-]+$/,
  /^\/membership$/,
];

export function registerDeepLink(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }

  // macOS：协议触发时浏览器/系统会发 open-url 事件
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });
}

export function handleDeepLink(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${PROTOCOL}:`) {
      log.warn(`[deep-link] rejected non-${PROTOCOL} url: ${url}`);
      return;
    }
    // autix://chat/abc → host="chat", pathname="/abc" → path = "/chat/abc"
    const path = `/${parsed.host}${parsed.pathname}`.replace(/\/+$/, '') || '/';

    if (!ALLOWED_PATHS.some((re) => re.test(path))) {
      log.warn(`[deep-link] path not in whitelist: ${path}`);
      return;
    }

    // 拒绝带 query string 的副作用调用
    if (parsed.search) {
      log.warn(`[deep-link] query params not allowed: ${parsed.search}`);
      return;
    }

    const win = getMainWindow();
    if (!win) {
      log.warn('[deep-link] no main window to navigate');
      return;
    }
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    // 渲染层会校验登录态，未登录则忽略
    win.webContents.send('deep-link:navigate', path);
  } catch (err) {
    log.warn('[deep-link] parse failed', err);
  }
}
