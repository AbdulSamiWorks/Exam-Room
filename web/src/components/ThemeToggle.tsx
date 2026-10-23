import { useState } from 'react';
import { chooseTheme, currentTheme, type Theme } from '../lib/theme';
import { Button } from './Button';

const TOGGLE_LABELS: Record<Theme, string> = {
  light: '☾ Dark',
  dark: '☀ Light',
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const otherTheme: Theme = theme === 'dark' ? 'light' : 'dark';

  function switchTheme() {
    chooseTheme(otherTheme);
    setTheme(otherTheme);
  }

  return (
    <Button variant="secondary" onClick={switchTheme} aria-label={`Use the ${otherTheme} theme`}>
      {TOGGLE_LABELS[theme]}
    </Button>
  );
}
