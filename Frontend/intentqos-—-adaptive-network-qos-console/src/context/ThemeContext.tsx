import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'intentqos-theme';

export interface ThemePaletteTokens {
  bg: string;
  bgSubtle: string;
  surface: string;
  surfaceRaised: string;
  surfaceHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentHover: string;
  accentPressed: string;
  accentSoft: string;
  onAccent: string;
  focus: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chart6: string;
  chart7: string;
  gridStroke: string;
  axisStroke: string;
  tooltipBg: string;
  tooltipBorder: string;
}

export const LIGHT_L5_PALETTE: ThemePaletteTokens = {
  bg: '#FFFFFF',
  bgSubtle: '#F2F3F4',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceHover: '#F7F7F8',
  textPrimary: '#171717',
  textSecondary: '#62676D',
  textMuted: '#747980',
  border: '#DCDDDF',
  borderStrong: '#B8BCC1',
  accent: '#F26A21',
  accentHover: '#D95712',
  accentPressed: '#B9470C',
  accentSoft: '#FFF0E7',
  onAccent: '#171717',
  focus: '#B9470C',
  success: '#18794E',
  successSoft: '#E8F5EE',
  warning: '#8A4B08',
  warningSoft: '#FFF4D6',
  danger: '#B42332',
  dangerSoft: '#FDEBED',
  info: '#315C91',
  infoSoft: '#EAF2FB',
  chart1: '#F26A21',
  chart2: '#3F566B',
  chart3: '#198754',
  chart4: '#7558A6',
  chart5: '#B98721',
  chart6: '#B42332',
  chart7: '#747980',
  gridStroke: '#E4E5E7',
  axisStroke: '#747980',
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#B8BCC1',
};

export const DARK_D1_PALETTE: ThemePaletteTokens = {
  bg: '#0B0B0D',
  bgSubtle: '#111114',
  surface: '#17171B',
  surfaceRaised: '#202025',
  surfaceHover: '#27272D',
  textPrimary: '#F5F5F7',
  textSecondary: '#B0B0B8',
  textMuted: '#92929C',
  border: '#303036',
  borderStrong: '#484850',
  accent: '#D4D4D8',
  accentHover: '#E4E4E7',
  accentPressed: '#C4C4CC',
  accentSoft: '#29292F',
  onAccent: '#17171B',
  focus: '#E4E4E7',
  success: '#66D6A0',
  successSoft: '#14271E',
  warning: '#F0C36A',
  warningSoft: '#302616',
  danger: '#FF858D',
  dangerSoft: '#321A20',
  info: '#A9C6EE',
  infoSoft: '#182538',
  chart1: '#E4E4E7',
  chart2: '#A1A1AA',
  chart3: '#7BCFA4',
  chart4: '#B6A2E6',
  chart5: '#E3BE76',
  chart6: '#FF858D',
  chart7: '#71717A',
  gridStroke: '#27272D',
  axisStroke: '#92929C',
  tooltipBg: '#202025',
  tooltipBorder: '#484850',
};

/**
 * Pure helper to resolve initial theme mode.
 * 1. Uses explicit saved preference ('light' | 'dark') if valid.
 * 2. Otherwise checks system prefers-color-scheme, defaulting to 'light' (L5) when no dark preference is set.
 */
export function resolveInitialTheme(
  savedValue: string | null | undefined,
  systemPrefersDark: boolean = false
): ThemeMode {
  if (savedValue === 'light' || savedValue === 'dark') {
    return savedValue;
  }
  return systemPrefersDark ? 'dark' : 'light';
}

export function getThemePalette(theme: ThemeMode): ThemePaletteTokens {
  return theme === 'dark' ? DARK_D1_PALETTE : LIGHT_L5_PALETTE;
}

interface ThemeContextValue {
  theme: ThemeMode;
  tokens: ThemePaletteTokens;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  tokens: LIGHT_L5_PALETTE,
  setTheme: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      const prefersDark =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      return resolveInitialTheme(saved, prefersDark);
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // Ignore storage write errors in restricted contexts
      }
    }
  }, [theme]);

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      tokens: getThemePalette(theme),
      setTheme,
      toggleTheme,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
