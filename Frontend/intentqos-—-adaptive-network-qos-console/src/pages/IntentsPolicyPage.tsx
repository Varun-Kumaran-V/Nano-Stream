import React, { useState } from 'react';
import {
  Shield,
  PlusCircle,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Trash2,
} from 'lucide-react';
import { DataMode, MetricPoint, QoSPolicy, TrafficClass, UserIntent } from '../types/qos';
import {
  TRAFFIC_CLASSES,
  computeJainsFairnessIndex,
  validateIntentInput,
  IntentFormInput,
} from '../services/demoEngine';
import { SpotlightCard } from '../components/SpotlightCard';

interface IntentsPolicyPageProps {
  mode: DataMode;
  policies: QoSPolicy[];
  intents: UserIntent[];
  currentPoint: MetricPoint;
  reducedMotion: boolean;
  onTogglePolicyEnabled: (policyId: string) => void;
  onUpdatePolicyMaxRate: (policyId: string, maxRateMbps: number) => void;
  onAddIntent: (intent: UserIntent) => void;
  onRemoveIntent: (intentId: string) => void;
  onExpireIntentNow: (intentId: string) => void;
  onResetPolicies: () => void;
}

export const IntentsPolicyPage: React.FC<IntentsPolicyPageProps> = ({
  mode,
  policies,
  intents,
  currentPoint,
  reducedMotion,
  onTogglePolicyEnabled,
  onUpdatePolicyMaxRate,
  onAddIntent,
  onRemoveIntent,
  onExpireIntentNow,
  onResetPolicies,
}) => {
  const [formInput, setFormInput] = useState<IntentFormInput>({
    name: 'Prioritize Telehealth Consultation',
    trafficClass: 'Video Calls',
    priorityTier: 1,
    minFloorMbps: 18,
    maxCeilingMbps: 45,
    targetLatencyMs: 16,
    durationMinutes: 30,
    rationale: 'Ensure low-jitter UDP video during afternoon household bandwidth contention.',
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const isLiveDisconnected = mode === 'LIVE';

  const allocations = Object.values(currentPoint.classThroughputMbps);
  const jainsIndex = computeJainsFairnessIndex(allocations);

  const handlePreviewAndConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateIntentInput(formInput);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setShowConfirmModal(true);
  };

  const handleConfirmApplyIntent = () => {
    if (isLiveDisconnected) return;
    const newIntent: UserIntent = {
      id: `intent-${Date.now().toString().slice(-4)}`,
      name: formInput.name.trim(),
      trafficClass: formInput.trafficClass,
      priorityTier: formInput.priorityTier,
      minFloorMbps: formInput.minFloorMbps,
      maxCeilingMbps: formInput.maxCeilingMbps,
      targetLatencyMs: formInput.targetLatencyMs,
      durationMinutes: formInput.durationMinutes,
      remainingSeconds: formInput.durationMinutes * 60,
      status: 'ACTIVE',
      rationale: formInput.rationale.trim(),
      createdAt: `${currentPoint.timestamp} UTC`,
      provenance: 'SIMULATED_DEMO',
    };
    onAddIntent(newIntent);
    setShowConfirmModal(false);
    setStatusBanner(
      `Simulated policy transition applied: "${newIntent.name}" is now active in Demo mode.`
    );
  };

  const handleConfirmReset = () => {
    onResetPolicies();
    setShowResetConfirm(false);
    setStatusBanner('Policies and temporary intents reset to baseline Demo configuration.');
  };

  return (
    <div className="space-y-6" data-testid="intents-policy-page">
      {statusBanner && (
        <div
          role="status"
          style={{ boxShadow: 'var(--shadow-card)' }}
          className="rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-accent)] px-4 py-3 flex items-center justify-between gap-3 text-xs text-[var(--color-text-primary)]"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2
              className="w-4 h-4 text-[var(--color-success)] shrink-0"
              aria-hidden="true"
            />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-mono cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Row: Active Temporary Intents + Create Intent Form & Policy Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Active Intents & Class Policy Table */}
        <div className="xl:col-span-7 space-y-6">
          <SpotlightCard reducedMotion={reducedMotion} className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span>Active Human-Intent Overrides</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-[var(--color-accent)]">
                    SIMULATED · DEMO
                  </span>
                </div>
                <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
                  Temporary Session Intents & Expiry Lifecycle
                </h2>
              </div>

              <button
                type="button"
                disabled={isLiveDisconnected}
                onClick={() => setShowResetConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw
                  className="w-3.5 h-3.5 text-[var(--color-text-secondary)]"
                  aria-hidden="true"
                />
                <span>Reset to Baseline</span>
              </button>
            </div>

            <div className="space-y-3" data-testid="active-intents-list">
              {intents.map((intent) => {
                const mins = Math.floor(intent.remainingSeconds / 60);
                const secs = intent.remainingSeconds % 60;
                return (
                  <div
                    key={intent.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      intent.status === 'ACTIVE'
                        ? 'bg-[var(--color-bg-subtle)] border-[var(--color-border-strong)]'
                        : 'bg-[var(--color-bg-subtle)]/60 border-[var(--color-border)] opacity-75'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                          <span
                            className={
                              intent.status === 'ACTIVE'
                                ? 'font-semibold text-[var(--color-success)]'
                                : 'font-semibold text-[var(--color-warning)]'
                            }
                          >
                            {intent.status}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[var(--color-accent)]">
                            Tier {intent.priorityTier}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[var(--color-text-secondary)]">
                            {intent.trafficClass}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[var(--color-text-muted)]">SIMULATED</span>
                        </div>
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                          {intent.name}
                        </h3>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          {intent.rationale}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 text-xs font-mono tabular-nums text-[var(--color-text-primary)] bg-[var(--color-surface)] border border-[var(--color-border)] px-2.5 py-1 rounded-md">
                          <Clock
                            className="w-3.5 h-3.5 text-[var(--color-accent)]"
                            aria-hidden="true"
                          />
                          <span>
                            {intent.status === 'EXPIRED'
                              ? '00:00 (Expired)'
                              : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
                          </span>
                        </div>
                        {intent.status === 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => onExpireIntentNow(intent.id)}
                            className="px-2.5 py-1 rounded-md bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/40 text-[11px] font-mono font-semibold text-[var(--color-warning)] cursor-pointer"
                            title="Simulate immediate TTL expiration in Demo mode"
                          >
                            Simulate Expiry
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`Remove intent ${intent.name}`}
                          onClick={() => onRemoveIntent(intent.id)}
                          className="p-1.5 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-danger-soft)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[var(--color-border)] flex flex-wrap items-center gap-4 text-xs font-mono text-[var(--color-text-secondary)]">
                      <span>Floor: {intent.minFloorMbps ?? 10} Mbps</span>
                      <span>Ceiling: {intent.maxCeilingMbps ?? 40} Mbps</span>
                      <span>Target Latency: ≤{intent.targetLatencyMs} ms</span>
                      <span>Created: {intent.createdAt}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </SpotlightCard>

          {/* Class Policy Schedule Table */}
          <SpotlightCard reducedMotion={reducedMotion} className="p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                <span>Per-Class Queue Discipline & Rate Bounds</span>
                <span className="font-mono font-semibold text-[var(--color-accent)]">
                  SIMULATED · DEMO
                </span>
              </div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
                7-Class Hierarchical Token Bucket (HTB) Policy Table
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] font-mono text-[11px] text-[var(--color-text-secondary)]">
                    <th className="py-2.5 px-3">Traffic Class</th>
                    <th className="py-2.5 px-2 text-center">Priority</th>
                    <th className="py-2.5 px-2 text-right">Min Share</th>
                    <th className="py-2.5 px-3 text-right">Max Ceiling (Mbps)</th>
                    <th className="py-2.5 px-2 text-right">SLA Target</th>
                    <th className="py-2.5 px-3">Discipline</th>
                    <th className="py-2.5 px-3 text-center">Enabled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {policies.map((pol) => (
                    <tr key={pol.id} className="hover:bg-[var(--color-surface-hover)]">
                      <td className="py-2.5 px-3 font-medium text-[var(--color-text-primary)]">
                        <div>{pol.trafficClass}</div>
                        <div className="text-[10px] font-mono text-[var(--color-text-muted)]">
                          Updated {pol.lastChanged}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-semibold text-[var(--color-accent)]">
                        Tier {pol.priorityTier}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[var(--color-text-secondary)]">
                        {pol.minSharePct}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <input
                          type="number"
                          min={5}
                          max={120}
                          aria-label={`Max rate ceiling for ${pol.trafficClass}`}
                          disabled={isLiveDisconnected}
                          value={pol.maxRateMbps}
                          onChange={(e) =>
                            onUpdatePolicyMaxRate(
                              pol.id,
                              Math.max(5, Math.min(120, Number(e.target.value) || 10))
                            )
                          }
                          className="w-16 text-right bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] rounded px-1.5 py-1 text-xs font-mono text-[var(--color-text-primary)]"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-[var(--color-success)]">
                        ≤{pol.targetLatencyMs} ms
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {pol.queueDiscipline}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          disabled={isLiveDisconnected}
                          onClick={() => onTogglePolicyEnabled(pol.id)}
                          aria-label={`Toggle policy for ${pol.trafficClass}`}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold cursor-pointer ${
                            pol.enabled
                              ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/40'
                              : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                          }`}
                        >
                          {pol.enabled ? 'ENABLED' : 'BYPASSED'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SpotlightCard>
        </div>

        {/* Right 5 Cols: Create Intent Form + Policy Preview + Jain's Fairness */}
        <div className="xl:col-span-5 space-y-6">
          <SpotlightCard reducedMotion={reducedMotion} className="p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                <span>Create Temporary QoS Intent</span>
                <span className="font-mono font-semibold text-[var(--color-accent)]">
                  {isLiveDisconnected ? 'DISABLED IN LIVE' : 'SIMULATED · DEMO'}
                </span>
              </div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
                Define Session SLA & Preview Impact
              </h2>
            </div>

            <form onSubmit={handlePreviewAndConfirm} className="space-y-3">
              <div>
                <label
                  htmlFor="intent-name"
                  className="block text-xs font-medium text-[var(--color-text-secondary)]"
                >
                  Intent Name
                </label>
                <input
                  id="intent-name"
                  type="text"
                  value={formInput.name}
                  onChange={(e) => setFormInput({ ...formInput, name: e.target.value })}
                  className="mt-1 w-full rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-focus)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="intent-class"
                    className="block text-xs font-medium text-[var(--color-text-secondary)]"
                  >
                    Target Traffic Class
                  </label>
                  <select
                    id="intent-class"
                    value={formInput.trafficClass}
                    onChange={(e) =>
                      setFormInput({ ...formInput, trafficClass: e.target.value as TrafficClass })
                    }
                    className="mt-1 w-full rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] px-2.5 py-2 text-xs text-[var(--color-text-primary)]"
                  >
                    {TRAFFIC_CLASSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="intent-priority"
                    className="block text-xs font-medium text-[var(--color-text-secondary)]"
                  >
                    Priority Tier
                  </label>
                  <select
                    id="intent-priority"
                    value={formInput.priorityTier}
                    onChange={(e) =>
                      setFormInput({
                        ...formInput,
                        priorityTier: Number(e.target.value) as 1 | 2 | 3,
                      })
                    }
                    className="mt-1 w-full rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] px-2.5 py-2 text-xs text-[var(--color-text-primary)]"
                  >
                    <option value={1}>Tier 1 (Real-Time EF)</option>
                    <option value={2}>Tier 2 (Interactive AF)</option>
                    <option value={3}>Tier 3 (Assured Stream)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label
                    htmlFor="intent-floor"
                    className="block text-[11px] text-[var(--color-text-secondary)]"
                  >
                    Floor (Mbps)
                  </label>
                  <input
                    id="intent-floor"
                    type="number"
                    value={formInput.minFloorMbps}
                    onChange={(e) =>
                      setFormInput({ ...formInput, minFloorMbps: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] px-2.5 py-1.5 text-xs font-mono text-[var(--color-text-primary)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="intent-ceiling"
                    className="block text-[11px] text-[var(--color-text-secondary)]"
                  >
                    Ceiling (Mbps)
                  </label>
                  <input
                    id="intent-ceiling"
                    type="number"
                    value={formInput.maxCeilingMbps}
                    onChange={(e) =>
                      setFormInput({ ...formInput, maxCeilingMbps: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] px-2.5 py-1.5 text-xs font-mono text-[var(--color-text-primary)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="intent-latency"
                    className="block text-[11px] text-[var(--color-text-secondary)]"
                  >
                    Max RTT (ms)
                  </label>
                  <input
                    id="intent-latency"
                    type="number"
                    value={formInput.targetLatencyMs}
                    onChange={(e) =>
                      setFormInput({ ...formInput, targetLatencyMs: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] px-2.5 py-1.5 text-xs font-mono text-[var(--color-text-primary)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="intent-ttl"
                    className="block text-[11px] text-[var(--color-text-secondary)]"
                  >
                    Expiry (min)
                  </label>
                  <input
                    id="intent-ttl"
                    type="number"
                    value={formInput.durationMinutes}
                    onChange={(e) =>
                      setFormInput({ ...formInput, durationMinutes: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] px-2.5 py-1.5 text-xs font-mono text-[var(--color-text-primary)]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="intent-rationale"
                  className="block text-xs font-medium text-[var(--color-text-secondary)]"
                >
                  Operational Rationale
                </label>
                <input
                  id="intent-rationale"
                  type="text"
                  value={formInput.rationale}
                  onChange={(e) => setFormInput({ ...formInput, rationale: e.target.value })}
                  className="mt-1 w-full rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] px-3 py-2 text-xs text-[var(--color-text-primary)]"
                />
              </div>

              {validationError && (
                <div
                  role="alert"
                  className="p-2.5 rounded-lg bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/40 text-xs font-medium text-[var(--color-danger)]"
                >
                  {validationError}
                </div>
              )}

              {/* Policy Preview Impact Box */}
              <div className="p-3.5 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] space-y-1.5">
                <div className="text-[11px] font-mono font-semibold text-[var(--color-accent)]">
                  POLICY PREVIEW (BEFORE APPLY)
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Reserves{' '}
                  <strong className="text-[var(--color-text-primary)] font-mono">
                    {formInput.minFloorMbps} Mbps
                  </strong>{' '}
                  minimum floor and caps burst at{' '}
                  <strong className="text-[var(--color-text-primary)] font-mono">
                    {formInput.maxCeilingMbps} Mbps
                  </strong>{' '}
                  for{' '}
                  <strong className="text-[var(--color-text-primary)]">
                    {formInput.trafficClass}
                  </strong>{' '}
                  (Tier {formInput.priorityTier}) for {formInput.durationMinutes} minutes.
                </p>
                <div className="text-[11px] font-mono font-semibold text-[var(--color-success)]">
                  Safety check: Leaves ≥
                  {(currentPoint.configuredShapingMbps - formInput.minFloorMbps).toFixed(1)} Mbps
                  for remaining classes (no starvation).
                </div>
              </div>

              <button
                type="submit"
                disabled={isLiveDisconnected}
                title={
                  isLiveDisconnected
                    ? 'Disabled in Live mode until POST /api/intents is connected'
                    : 'Preview and confirm simulated intent application'
                }
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-pressed)] text-xs font-semibold text-[var(--color-on-accent)] transition-colors cursor-pointer disabled:opacity-40"
              >
                <PlusCircle className="w-4 h-4" aria-hidden="true" />
                <span>
                  {isLiveDisconnected
                    ? 'Apply Disabled (Live Backend Not Connected)'
                    : 'Review & Apply Intent (Simulated)'}
                </span>
              </button>
            </form>
          </SpotlightCard>

          {/* Jain's Fairness Index Panel */}
          <SpotlightCard reducedMotion={reducedMotion} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-[var(--color-accent)]" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Jain’s Fairness Index & Class Allocation
                </h3>
              </div>
              <span className="text-xs font-mono font-semibold text-[var(--color-accent)]">
                SIMULATED · DEMO
              </span>
            </div>

            <div className="flex items-baseline justify-between p-3 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
              <div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  Jain’s Index Across 7 Traffic Classes
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)]">
                  Population: n = 7 active classes · Window: current 5s sample
                </div>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[var(--color-success)]">
                {jainsIndex.toFixed(2)}
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Computed from simulated per-class allocations via{' '}
              <code className="font-mono text-[var(--color-text-primary)]">(Σxᵢ)² / (n·Σxᵢ²)</code>.
              Under IntentQoS policy, Bulk Downloads and Background Sync yield during capacity drops while preserving minimum guaranteed shares so no class is completely starved.
            </p>
          </SpotlightCard>
        </div>
      </div>

      {/* Confirmation Dialog Modal for Applying Intent */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-intent-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'var(--color-overlay)' }}
        >
          <div
            style={{ boxShadow: 'var(--shadow-card)' }}
            className="w-full max-w-md rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--color-accent)]">
              <Shield className="w-4 h-4" aria-hidden="true" />
              <span>CONFIRM SIMULATED POLICY CHANGE</span>
            </div>
            <h3
              id="confirm-intent-title"
              className="text-base font-semibold text-[var(--color-text-primary)]"
            >
              Apply Temporary Intent: {formInput.name}?
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              This action updates the deterministic Demo state machine for{' '}
              <strong className="text-[var(--color-text-primary)]">{formInput.trafficClass}</strong>{' '}
              (Priority Tier {formInput.priorityTier}, Floor {formInput.minFloorMbps} Mbps, Ceiling{' '}
              {formInput.maxCeilingMbps} Mbps). No live router or SDN switch rules are modified in Demo mode.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApplyIntent}
                className="px-4 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-xs font-semibold text-[var(--color-on-accent)] cursor-pointer"
              >
                Confirm Simulated Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal for Resetting Policies */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-policy-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'var(--color-overlay)' }}
        >
          <div
            style={{ boxShadow: 'var(--shadow-card)' }}
            className="w-full max-w-md rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--color-warning)]">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              <span>CONFIRM BASELINE RESET</span>
            </div>
            <h3
              id="reset-policy-title"
              className="text-base font-semibold text-[var(--color-text-primary)]"
            >
              Revert All Policies & Intents to Baseline?
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              This restores all 7 traffic class ceilings and active temporary intents to their default seeded demonstration state.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-xs font-semibold text-[var(--color-on-accent)] cursor-pointer"
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
