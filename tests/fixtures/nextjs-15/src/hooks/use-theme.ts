import { useCallback, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme(initial: Theme = 'system') {
  const [theme, setTheme] = useState<Theme>(initial);

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  const resolvedTheme =
    theme === 'system'
      ? typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

  return { theme, resolvedTheme, setTheme, toggle };
}
