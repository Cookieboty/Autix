import { UserMenu } from './user-menu';

export function Header() {
  return (
    <header className="fixed left-60 right-0 top-0 z-10 h-16 border-b bg-white/95 backdrop-blur">
      <div className="flex h-full items-center justify-end px-6">
        <UserMenu />
      </div>
    </header>
  );
}
