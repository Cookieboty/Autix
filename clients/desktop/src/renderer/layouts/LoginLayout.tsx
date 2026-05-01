import { Outlet } from 'react-router-dom';
import { TitleBar } from '../components/TitleBar';

export function LoginLayout() {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)',
      }}
    >
      {/* TitleBar 浮在顶部，拖动区透明，不挤占内容 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        }}
      >
        <TitleBar />
      </div>
      <Outlet />
    </div>
  );
}
