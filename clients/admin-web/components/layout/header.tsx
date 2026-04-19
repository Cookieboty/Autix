import { UserMenu } from './user-menu';
import { ThemeToggle } from './theme-toggle';

export function Header() {
  return (
    <header
      className="fixed left-60 right-0 top-0 z-10 h-16 border-b backdrop-blur"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--background) 95%, transparent)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex h-full items-center justify-end gap-4 px-6">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
