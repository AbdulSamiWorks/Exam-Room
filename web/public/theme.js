(function applySavedTheme() {
  const THEME_STORAGE_KEY = 'exam-room:theme';
  const THEME_COLORS = { light: '#ffffff', dark: '#131a2a' };

  function readSavedTheme() {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  const savedTheme = readSavedTheme();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const systemTheme = prefersDark ? 'dark' : 'light';
  const theme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : systemTheme;

  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
})();
