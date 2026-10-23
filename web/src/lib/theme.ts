export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'exam-room:theme';
const THEME_COLORS: Record<Theme, string> = { light: '#ffffff', dark: '#000000' };

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function chooseTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}
