import { ThemeToggle } from './theme-toggle';

export function Header() {
  return (
    <header
      className="fixed left-[272px] right-0 top-0 z-10 h-[88px] px-3 pt-3"
      style={{ backgroundColor: 'var(--app-shell)' }}
    >
      <div
        className="flex h-full items-center justify-between rounded-lg px-6"
        style={{
          backgroundColor: 'var(--admin-header-bg)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
            Admin workspace
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
