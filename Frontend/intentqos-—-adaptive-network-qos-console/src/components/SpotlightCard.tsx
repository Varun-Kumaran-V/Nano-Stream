import React, { useRef, useState } from 'react';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  reducedMotion?: boolean;
  as?: 'div' | 'section' | 'article';
  'data-testid'?: string;
}

/**
 * SpotlightCard adapted for L5 Light and D1 Dark operations console.
 * Respects reducedMotion preference and uses subtle theme-aware radial highlight on hover.
 */
export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  reducedMotion = false,
  as: Component = 'div',
  'data-testid': testId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <Component
      ref={containerRef}
      data-testid={testId}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => !reducedMotion && setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      style={{ boxShadow: 'var(--shadow-card)' }}
      className={`relative overflow-hidden rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors duration-150 ${className}`}
    >
      {!reducedMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px transition-opacity duration-200"
          style={{
            opacity,
            background: `radial-gradient(480px circle at ${position.x}px ${position.y}px, var(--spotlight-radial), transparent 45%)`,
          }}
        />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </Component>
  );
};
