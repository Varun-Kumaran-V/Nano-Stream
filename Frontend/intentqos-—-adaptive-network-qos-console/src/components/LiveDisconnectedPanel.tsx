import React from 'react';
import { AlertTriangle, RefreshCw, PlayCircle, ServerOff } from 'lucide-react';
import { SystemHealth } from '../types/qos';

interface LiveDisconnectedPanelProps {
  health: SystemHealth;
  isProbing: boolean;
  onRetry: () => void;
  onSwitchToDemo: () => void;
}

export const LiveDisconnectedPanel: React.FC<LiveDisconnectedPanelProps> = ({
  health,
  isProbing,
  onRetry,
  onSwitchToDemo,
}) => {
  return (
    <div
      role="alert"
      data-testid="live-disconnected-banner"
      style={{ boxShadow: 'var(--shadow-card)' }}
      className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-danger)] p-6 text-[var(--color-text-primary)]"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-[var(--color-danger-soft)] text-[var(--color-danger)] shrink-0 mt-0.5">
            <ServerOff className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-semibold text-[var(--color-danger)]">
              <span>LIVE TELEMETRY DISCONNECTED</span>
              <span aria-hidden="true">·</span>
              <span>NO SYNTHETIC FALLBACK ACTIVE</span>
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Backend not connected ({health.apiBaseUrl})
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
              {health.error?.message ||
                'Live mode requires a verified Python Ryu SDN controller and feature-extraction REST bridge. In compliance with operational honesty rules, IntentQoS never displays synthetic demo data while in LIVE mode.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-mono text-[var(--color-text-muted)]">
              <span>Probe target: {health.apiBaseUrl}/health</span>
              <span aria-hidden="true">·</span>
              <span>Last checked: {health.lastUpdated}</span>
              <span aria-hidden="true">·</span>
              <span>Status: {health.error?.code || 'ERR_BACKEND_UNREACHABLE'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onRetry}
            disabled={isProbing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isProbing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isProbing ? 'Probing Endpoint...' : 'Retry Connection'}</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToDemo}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-pressed)] text-xs font-semibold text-[var(--color-on-accent)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <PlayCircle className="w-4 h-4" aria-hidden="true" />
            <span>Switch to Demo / Replay Mode</span>
          </button>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {health.components.map((comp) => (
          <div
            key={comp.id}
            className="p-3 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] flex flex-col justify-between gap-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                {comp.name}
              </span>
              <AlertTriangle
                className={`w-3.5 h-3.5 shrink-0 ${
                  comp.state === 'OPERATIONAL'
                    ? 'text-[var(--color-success)]'
                    : 'text-[var(--color-warning)]'
                }`}
                aria-hidden="true"
              />
            </div>
            <div className="text-[11px] font-mono text-[var(--color-text-secondary)]">
              {comp.state}
            </div>
            <div
              className="text-[11px] text-[var(--color-text-muted)] truncate"
              title={comp.detail}
            >
              {comp.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
