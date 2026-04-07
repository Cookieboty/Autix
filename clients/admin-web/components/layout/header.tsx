import { UserMenu } from './user-menu';
import { ThemeToggle } from './theme-toggle';

export function Header() {
  return (
    <header className="fixed left-60 right-0 top-0 z-10 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-end gap-4 px-6">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
