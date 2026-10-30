import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false, className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const actionLabel = isLight ? 'Switch to dark theme' : 'Switch to light theme';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={actionLabel}
      title={actionLabel}
      data-testid="theme-toggle-btn"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${className}`}
    >
      {isLight ? (
        <>
          <Moon className="w-3.5 h-3.5 text-[var(--color-text-secondary)] shrink-0" aria-hidden="true" />
          {!compact && <span>Dark</span>}
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" aria-hidden="true" />
          {!compact && <span>Light</span>}
        </>
      )}
    </button>
  );
};
