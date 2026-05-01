import { ipcMain, Notification } from 'electron';
import { z } from 'zod';
import { getMainWindow } from '../window';

const notifySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(1000),
  taskId: z.string().max(128).optional(),
  route: z
    .string()
    .max(256)
    .regex(/^\//, 'route 必须以 / 开头')
    .optional(),
});

export function registerNotificationsIpc(): void {
  ipcMain.handle('notify:show', (_e, raw) => {
    const opts = notifySchema.parse(raw);
    if (!Notification.isSupported()) return;

    const n = new Notification({
      title: opts.title,
      body: opts.body,
      silent: false,
    });

    n.on('click', () => {
      const win = getMainWindow();
      if (!win) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      if (opts.route) {
        // 路由白名单交由渲染进程的 deep-link 模块统一校验
        win.webContents.send('deep-link:navigate', opts.route);
      }
    });

    n.show();
  });
}
