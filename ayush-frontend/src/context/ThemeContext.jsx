/* eslint-disable react-refresh/only-export-components -- provider + hook are one unit */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Dark = "Aged Sheesham & Espresso", light = "Bhojpatra Parchment & Ayur-Linen".
// The colours themselves live in tailwind.config.js; this only flips `html.dark`.
export const THEME_STORAGE_KEY = 'vrrtant_theme';

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

function readStoredTheme() {
  try {
    return (localStorage.getItem(THEME_STORAGE_KEY) || 'dark') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark'; // storage blocked (private mode, kiosk lockdown)
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme);
  const fadeTimer = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  // Printing is always clinical light, whatever the on-screen theme.
  useEffect(() => {
    const root = document.documentElement;
    const toLight = () => root.classList.remove('dark');
    const restore = () => root.classList.toggle('dark', theme === 'dark');
    window.addEventListener('beforeprint', toLight);
    window.addEventListener('afterprint', restore);
    return () => {
      window.removeEventListener('beforeprint', toLight);
      window.removeEventListener('afterprint', restore);
    };
  }, [theme]);

  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => root.classList.remove('theme-transition'), 260);
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
