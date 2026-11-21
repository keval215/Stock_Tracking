export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'nse-pulse-theme';

export function resolveInitialTheme(
  storedValue: string | null | undefined,
  prefersDark = false,
): ThemeMode {
  if (storedValue === 'dark' || storedValue === 'light') {
    return storedValue;
  }
  return prefersDark ? 'dark' : 'light';
}

export function toggleThemeMode(current: ThemeMode): ThemeMode {
  return current === 'dark' ? 'light' : 'dark';
}
