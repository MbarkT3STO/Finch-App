import type { AppSettings } from './types';

/**
 * Resolves the app theme setting to a concrete 'light' | 'dark' value.
 *
 * Pure function — no Electron imports. The caller is responsible for
 * reading `nativeTheme.shouldUseDarkColors` and passing it as `systemIsDark`.
 *
 * @param theme       The theme setting from AppSettings ('light' | 'dark' | 'system')
 * @param systemIsDark Whether the OS prefers dark mode (only used when theme === 'system')
 * @returns 'light' or 'dark'
 */
export function resolveTheme(
  theme: AppSettings['theme'],
  systemIsDark: boolean,
): 'light' | 'dark' {
  if (theme === 'dark') return 'dark';
  if (theme === 'system') return systemIsDark ? 'dark' : 'light';
  // 'light' or any unknown value falls back to 'light'
  return 'light';
}
