import { Outlet } from 'react-router-dom';

const isMac =
  typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac');

export function LoginLayout() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* macOS 红绿灯专属 drag region：仅左上角 80×24 浮动透明区 */}
      {isMac && (
        <div
          className="app-drag pointer-events-none fixed left-0 top-0 z-100 h-6 w-20"
          aria-hidden
        />
      )}
      <Outlet />
    </div>
  );
}
