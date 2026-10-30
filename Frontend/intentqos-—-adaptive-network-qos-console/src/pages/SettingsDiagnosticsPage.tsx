import React, { useState } from 'react';
import {
  Terminal,
  RefreshCw,
  Download,
  RotateCcw,
  Eye,
  Server,
  ShieldCheck,
  AlertTriangle,
  Sun,
  Moon,
} from 'lucide-react';
import { DataMode, DiagnosticLog, SystemHealth } from '../types/qos';
import { DEMO_MODEL_EVALUATION } from '../services/demoEngine';
import { SpotlightCard } from '../components/SpotlightCard';
import { useTheme } from '../context/ThemeContext';

interface SettingsDiagnosticsPageProps {
  mode: DataMode;
  systemHealth: SystemHealth;
  logs: DiagnosticLog[];
  pollingIntervalMs: number;
  reducedMotion: boolean;
  isProbingLive: boolean;
  onChangeMode: (mode: DataMode) => void;
  onChangePollingInterval: (ms: number) => void;
  onToggleReducedMotion: () => void;
  onProbeLiveHealth: () => void;
  onResetAllDemoState: () => void;
}

export const SettingsDiagnosticsPage: React.FC<SettingsDiagnosticsPageProps> = ({
  mode,
  systemHealth,
  logs,
  pollingIntervalMs,
  reducedMotion,
  isProbingLive,
  onChangeMode,
  onChangePollingInterval,
  onToggleReducedMotion,
  onProbeLiveHealth,
  onResetAllDemoState,
}) => {
  const { theme, setTheme } = useTheme();
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [showResetModal, setShowResetModal] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const filteredLogs = logs.filter(
    (l) => severityFilter === 'ALL' || l.severity === severityFilter
  );

  const handleExportDiagnostics = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      activeMode: mode,
      activeTheme: theme,
      reducedMotion,
      pollingIntervalMs,
      systemHealth,
      modelConfig: {
        modelVersion: DEMO_MODEL_EVALUATION.modelVersion,
        featureSchemaVersion: DEMO_MODEL_EVALUATION.featureSchemaVersion,
        artifactId: DEMO_MODEL_EVALUATION.artifactId,
      },
      structuredLogs: logs,
      securityRedaction: 'All API keys, tokens, and packet payloads are omitted by design.',
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'intentqos-diagnostics-bundle.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportMessage('Exported sanitized diagnostics bundle to intentqos-diagnostics-bundle.json');
  };

  return (
    <div className="space-y-6" data-testid="settings-diagnostics-page">
      {/* Top Row: Data Mode & Connectivity + Accessibility, Theme & Polling Settings */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <SpotlightCard reducedMotion={reducedMotion} className="xl:col-span-7 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--color-accent)]">
                <Server className="w-4 h-4" aria-hidden="true" />
                <span>DATA PROVIDER & CONTROLLER CONNECTIVITY</span>
              </div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
                Telemetry Source & Endpoint Health Check
              </h2>
            </div>

            <button
              type="button"
              onClick={onProbeLiveHealth}
              disabled={isProbingLive}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[var(--color-accent)] ${
                  isProbingLive ? 'animate-spin' : ''
                }`}
                aria-hidden="true"
              />
              <span>{isProbingLive ? 'Probing...' : 'Test /api/health Now'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChangeMode('DEMO')}
              className={`p-3.5 rounded-xl text-left border transition-colors cursor-pointer ${
                mode === 'DEMO'
                  ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)]'
                  : 'bg-[var(--color-bg-subtle)] border-[var(--color-border)]'
              }`}
            >
              <div className="text-xs font-mono font-semibold text-[var(--color-accent)]">
                DEMO / REPLAY MODE
              </div>
              <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                Deterministic Seeded Simulation
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Replays repeatable home broadband scenarios (seed=42026) with explicit SIMULATED labels.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onChangeMode('LIVE')}
              className={`p-3.5 rounded-xl text-left border transition-colors cursor-pointer ${
                mode === 'LIVE'
                  ? 'bg-[var(--color-warning-soft)] border-[var(--color-warning)]'
                  : 'bg-[var(--color-bg-subtle)] border-[var(--color-border)]'
              }`}
            >
              <div className="text-xs font-mono font-semibold text-[var(--color-warning)]">
                LIVE BACKEND MODE
              </div>
              <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                Strict Backend API Adapter
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Connects to {systemHealth.apiBaseUrl}. Never falls back to synthetic data if disconnected.
              </p>
            </button>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">Configured Base API URL</span>
              <span className="text-[var(--color-text-primary)]">{systemHealth.apiBaseUrl}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">Live Endpoint Reachability</span>
              <span
                className={
                  systemHealth.connected
                    ? 'font-semibold text-[var(--color-success)]'
                    : 'font-semibold text-[var(--color-warning)]'
                }
              >
                {systemHealth.connected ? 'CONNECTED' : 'NOT CONNECTED (HONEST STATE)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">Ryu SDN Controller Bridge</span>
              <span className="text-[var(--color-text-muted)]">
                Unknown / Awaiting Live REST Bridge
              </span>
            </div>
          </div>
        </SpotlightCard>

        {/* Runtime Preferences, Theme, Reduced Motion & Safe Reset */}
        <SpotlightCard
          reducedMotion={reducedMotion}
          className="xl:col-span-5 p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3.5">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--color-info)]">
                <Eye className="w-4 h-4" aria-hidden="true" />
                <span>APPEARANCE, ACCESSIBILITY & SAFETY</span>
              </div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
                Theme, Motion & Refresh Interval
              </h2>
            </div>

            {/* Theme Selection Row */}
            <div className="p-3.5 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                  Color Theme (L5 Light / D1 Dark)
                </div>
                <div className="text-[11px] text-[var(--color-text-secondary)]">
                  Persisted in localStorage (`intentqos-theme`).
                </div>
              </div>
              <div
                role="group"
                aria-label="Select application color theme"
                className="inline-flex items-center p-0.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-strong)] shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                    theme === 'light'
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Light (L5)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Dark (D1)</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                  Reduced Motion & Pause Topology Pulse
                </div>
                <div className="text-[11px] text-[var(--color-text-secondary)]">
                  Disables SVG packet animations and spotlight hover effects (WCAG 2.2 AA).
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleReducedMotion}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                  reducedMotion
                    ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/40'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)]'
                }`}
              >
                {reducedMotion ? 'REDUCED MOTION: ON' : 'STANDARD MOTION'}
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <label
                  htmlFor="polling-select"
                  className="text-xs font-semibold text-[var(--color-text-primary)] block"
                >
                  Telemetry Tick / Poll Interval
                </label>
                <div className="text-[11px] text-[var(--color-text-secondary)]">
                  Controls simulation step cadence and Live HTTP polling interval.
                </div>
              </div>
              <select
                id="polling-select"
                value={pollingIntervalMs}
                onChange={(e) => onChangePollingInterval(Number(e.target.value))}
                className="bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] rounded-lg px-2.5 py-1.5 border border-[var(--color-border-strong)]"
              >
                <option value={1500}>1.5 seconds</option>
                <option value={2500}>2.5 seconds (Default)</option>
                <option value={5000}>5.0 seconds</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-danger-soft)] hover:opacity-90 border border-[var(--color-danger)]/40 text-xs font-semibold text-[var(--color-danger)] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset All Demo State</span>
            </button>

            <button
              type="button"
              onClick={handleExportDiagnostics}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-xs font-semibold text-[var(--color-on-accent)] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export Diagnostics JSON</span>
            </button>
          </div>
        </SpotlightCard>
      </div>

      {exportMessage && (
        <div
          role="status"
          className="rounded-xl bg-[var(--color-success-soft)] border border-[var(--color-success)]/40 px-4 py-3 text-xs font-mono font-semibold text-[var(--color-success)]"
        >
          {exportMessage}
        </div>
      )}

      {/* Structured Diagnostic Logs */}
      <SpotlightCard reducedMotion={reducedMotion} className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[var(--color-accent)]" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                Structured System & Adapter Logs
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Sanitized operational events with correlation IDs. No secrets or packet payloads are logged.
              </p>
            </div>
          </div>

          <div
            role="group"
            aria-label="Filter logs by severity"
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] self-start"
          >
            {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)]">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-2">Severity</th>
                <th className="py-2.5 px-3">Component</th>
                <th className="py-2.5 px-3">Event Message</th>
                <th className="py-2.5 px-3">Correlation ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[var(--color-surface-hover)]">
                  <td className="py-2.5 px-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-2.5 px-2">
                    <span
                      className={
                        log.severity === 'ERROR'
                          ? 'text-[var(--color-danger)] font-semibold'
                          : log.severity === 'WARN'
                            ? 'text-[var(--color-warning)] font-semibold'
                            : 'text-[var(--color-success)] font-semibold'
                      }
                    >
                      {log.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-[var(--color-accent)]">
                    {log.component}
                  </td>
                  <td className="py-2.5 px-3 text-[var(--color-text-primary)] font-sans">
                    {log.event}
                  </td>
                  <td className="py-2.5 px-3 text-[var(--color-text-muted)]">
                    {log.correlationId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <ShieldCheck
            className="w-4 h-4 text-[var(--color-success)] shrink-0"
            aria-hidden="true"
          />
          <span>
            Security & Privacy Guarantee: Zero API keys, controller credentials, or raw packet payloads are stored in browser storage or rendered in diagnostics.
          </span>
        </div>
      </SpotlightCard>

      {showResetModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="diag-reset-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'var(--color-overlay)' }}
        >
          <div
            style={{ boxShadow: 'var(--shadow-card)' }}
            className="w-full max-w-md rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--color-danger)]">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              <span>CONFIRM SIMULATION RESET</span>
            </div>
            <h3
              id="diag-reset-title"
              className="text-base font-semibold text-[var(--color-text-primary)]"
            >
              Reset Entire Demo Simulation & Policy State?
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              This rewinds the scenario clock to step 1, restores default HTB policies and intents, and clears transient log entries.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetAllDemoState();
                  setShowResetModal(false);
                }}
                className="px-4 py-2 rounded-lg bg-[var(--color-danger)] text-xs font-semibold text-white cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
