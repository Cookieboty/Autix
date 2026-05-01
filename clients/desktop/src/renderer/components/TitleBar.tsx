'use client';

/**
 * 桌面端可拖动标题栏。
 *
 * macOS：window 用 `titleBarStyle: 'hiddenInset'`，左上角交通灯按钮约 80px。
 * Win/Linux：默认有原生菜单栏，autoHideMenuBar=true，标题栏由我们绘制。
 */
export const TITLEBAR_HEIGHT = 36;

export function TitleBar({ children }: { children?: React.ReactNode }) {
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac');

  return (
    <div
      className="app-drag"
      style={{
        height: TITLEBAR_HEIGHT,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: isMac ? 80 : 12,
        paddingRight: 12,
        backgroundColor: 'transparent',
        userSelect: 'none',
        position: 'relative',
        zIndex: 100,
      }}
    >
      <div
        style={{
          flex: 1,
          fontSize: 12,
          color: 'var(--muted)',
          textAlign: 'center',
          letterSpacing: '0.05em',
          opacity: 0.6,
        }}
      >
        {children}
      </div>
    </div>
  );
}
