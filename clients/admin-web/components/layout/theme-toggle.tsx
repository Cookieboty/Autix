'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@heroui/react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      isIconOnly
      variant="ghost"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="cursor-pointer"
      aria-label={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5" style={{ color: 'var(--muted)' }} />
      ) : (
        <Moon className="h-5 w-5" style={{ color: 'var(--muted)' }} />
      )}
    </Button>
  );
}
