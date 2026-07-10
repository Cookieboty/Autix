'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: string) => void;
  themes: Theme[];
  forcedTheme?: Theme;
  systemTheme?: Theme;
}

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: 'data-theme' | 'class' | string;
  defaultTheme?: Theme;
  themes?: Theme[];
  enableSystem?: boolean;
  storageKey?: string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(storageKey: string, fallback: Theme): Theme {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(storageKey);
  return stored === 'dark' || stored === 'light' ? stored : fallback;
}

function applyTheme(theme: Theme, attribute: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (attribute === 'class') {
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  } else {
    root.setAttribute(attribute, theme);
  }
  root.style.colorScheme = theme;
}

export function ThemeProvider({
  children,
  attribute = 'data-theme',
  defaultTheme = 'light',
  themes = ['light', 'dark'],
  storageKey = 'theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme(storageKey, defaultTheme));

  useEffect(() => {
    applyTheme(theme, attribute);
    window.localStorage.setItem(storageKey, theme);
  }, [attribute, storageKey, theme]);

  const setTheme = useCallback((next: string) => {
    setThemeState(next === 'dark' ? 'dark' : 'light');
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme: theme,
      setTheme,
      themes: themes.filter((item): item is Theme => item === 'light' || item === 'dark'),
      systemTheme: undefined,
      forcedTheme: undefined,
    }),
    [setTheme, theme, themes],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? {
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: () => {},
    themes: ['light', 'dark'],
  };
}
