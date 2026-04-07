'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="cursor-pointer"
      title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
    >
      <Sun
        className={cn(
          'h-5 w-5 transition-all',
          theme === 'dark' ? 'rotate-90 scale-0' : 'rotate-0 scale-100'
        )}
      />
      <Moon
        className={cn(
          'absolute h-5 w-5 transition-all',
          theme === 'dark' ? 'rotate-0 scale-100' : '-rotate-90 scale-0'
        )}
      />
    </Button>
  );
}
