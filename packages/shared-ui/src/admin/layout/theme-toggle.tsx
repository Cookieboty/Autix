'use client';

import { useTheme } from '../../theme';
import { useTranslations } from 'next-intl';
import { Moon, Sun } from 'lucide-react';
import { Button } from '../../ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('layout');

  return (
    <Button
      variant="ghost"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="cursor-pointer p-0 w-9 h-9"
      aria-label={theme === 'dark' ? t('switchLightMode') : t('switchDarkMode')}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5" style={{ color: 'var(--muted)' }} />
      ) : (
        <Moon className="h-5 w-5" style={{ color: 'var(--muted)' }} />
      )}
    </Button>
  );
}
