import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Download, FileJson, FlaskConical, Info, CheckSquare, Square } from 'lucide-react';
import { BaselineProfileId, ExperimentRun } from '../types/qos';
import { DEMO_EXPERIMENT_RUNS, formatExperimentsCsv } from '../services/demoEngine';
import { SpotlightCard } from '../components/SpotlightCard';
import { useTheme } from '../context/ThemeContext';

interface ExperimentsBenchmarksPageProps {
  reducedMotion: boolean;
}

const ALL_PROFILES: BaselineProfileId[] = [
  'NO_SHAPING',
  'STATIC_QOS',
  'FQ_CODEL_SIM',
  'DETERMINISTIC_ADAPTIVE',
  'INTENT_QOS_PROPOSED',
];

export const ExperimentsBenchmarksPage: React.FC<ExperimentsBenchmarksPageProps> = ({
  reducedMotion,
}) => {
  const { tokens } = useTheme();
  const [selectedProfiles, setSelectedProfiles] = useState<BaselineProfileId[]>([
    'NO_SHAPING',
    'STATIC_QOS',
    'FQ_CODEL_SIM',
    'INTENT_QOS_PROPOSED',
  ]);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const toggleProfile = (id: BaselineProfileId) => {
    if (selectedProfiles.includes(id)) {
      if (selectedProfiles.length <= 2) return; // keep at least 2 for side-by-side comparison
      setSelectedProfiles(selectedProfiles.filter((p) => p !== id));
    } else {
      setSelectedProfiles([...selectedProfiles, id]);
    }
  };

  const activeRuns: ExperimentRun[] = ALL_PROFILES.filter((id) =>
    selectedProfiles.includes(id)
  ).map((id) => DEMO_EXPERIMENT_RUNS[id]);

  const latencyChartData = activeRuns.map((r) => ({
    name: r.profileId.replace(/_/g, ' '),
    Median: r.metrics.medianLatencyMs,
    p95: r.metrics.p95LatencyMs,
    p99: r.metrics.p99LatencyMs,
  }));

  const throughputChartData = activeRuns.map((r) => ({
    name: r.profileId.replace(/_/g, ' '),
    'Video Calls': r.metrics.classThroughputMbps['Video Calls'],
    Gaming: r.metrics.classThroughputMbps['Gaming'],
    Streaming: r.metrics.classThroughputMbps['Streaming'],
    'Bulk Downloads': r.metrics.classThroughputMbps['Bulk Downloads'],
  }));

  const triggerDownload = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const csv = formatExperimentsCsv(activeRuns);
    triggerDownload(
      'intentqos-benchmark-comparison-seed42026.csv',
      csv,
      'text/csv;charset=utf-8;'
    );
    setExportStatus(
      `Exported ${activeRuns.length} simulated benchmark profiles to intentqos-benchmark-comparison-seed42026.csv`
    );
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      provenance: 'ILLUSTRATIVE_SIMULATED_BENCHMARK',
      disclaimer:
        'Demo data illustrates the comparison interface and is not empirical testbed evidence. Linux CAKE/FQ-CoDel did not execute in the browser.',
      seed: 42026,
      runs: activeRuns,
    };
    triggerDownload(
      'intentqos-benchmark-comparison-seed42026.json',
      JSON.stringify(payload, null, 2),
      'application/json'
    );
    setExportStatus(
      `Exported ${activeRuns.length} simulated benchmark profiles with run metadata to JSON.`
    );
  };

  return (
    <div className="space-y-6" data-testid="experiments-benchmarks-page">
      {/* Honesty & Provenance Notice */}
      <SpotlightCard reducedMotion={reducedMotion} className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <FlaskConical
              className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-semibold text-[var(--color-accent)]">
                <span>ILLUSTRATIVE SIMULATED BASELINES</span>
                <span aria-hidden="true">·</span>
                <span>SEED 42026</span>
                <span aria-hidden="true">·</span>
                <span>WAN BOTTLENECK 52 MBPS</span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                Important methodology note: Linux kernel{' '}
                <code className="font-mono text-[var(--color-text-primary)]">
                  FQ-CoDel / CAKE
                </code>{' '}
                and OpenFlow shapers do not run inside the web browser. The profiles below are deterministic reference simulations illustrating how IntentQoS compares against static and unshaped baselines under a 120 → 52 Mbps capacity drop.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-pressed)] text-xs font-semibold text-[var(--color-on-accent)] cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileJson className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export JSON Summary</span>
            </button>
          </div>
        </div>

        {exportStatus && (
          <div
            role="status"
            className="mt-3 pt-3 border-t border-[var(--color-border)] text-xs font-mono font-semibold text-[var(--color-success)]"
          >
            {exportStatus}
          </div>
        )}
      </SpotlightCard>

      {/* Profile Comparison Selector (Minimum 2) */}
      <SpotlightCard reducedMotion={reducedMotion} className="p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--color-text-primary)]">
            Select Profiles to Compare Side by Side (Select ≥ 2):
          </span>
          <span className="font-mono text-[var(--color-text-muted)]">
            {selectedProfiles.length} of 5 profiles selected
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {ALL_PROFILES.map((id) => {
            const run = DEMO_EXPERIMENT_RUNS[id];
            const isChecked = selectedProfiles.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleProfile(id)}
                className={`p-3 rounded-xl text-left border transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                  isChecked
                    ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)]'
                    : 'bg-[var(--color-bg-subtle)] border-[var(--color-border)] opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] leading-snug">
                    {run.profileName}
                  </span>
                  {isChecked ? (
                    <CheckSquare
                      className="w-4 h-4 text-[var(--color-accent)] shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <Square
                      className="w-4 h-4 text-[var(--color-text-muted)] shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="text-[11px] font-mono text-[var(--color-text-secondary)]">
                  p95: {run.metrics.p95LatencyMs}ms · Fair: {run.metrics.jainsFairnessIndex}
                </div>
              </button>
            );
          })}
        </div>
      </SpotlightCard>

      {/* Comparison Charts: Latency (Median/p95/p99) + Per-Class Throughput */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <SpotlightCard reducedMotion={reducedMotion} className="xl:col-span-6 p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span>Latency Distribution Under 52 Mbps Bottleneck</span>
              <span className="font-mono font-semibold text-[var(--color-accent)]">
                SIMULATED BASELINES
              </span>
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
              Median, p95 & p99 RTT Latency by Profile (ms, lower is better)
            </h3>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={latencyChartData}
                margin={{ top: 10, right: 12, left: 0, bottom: 5 }}
              >
                <CartesianGrid stroke={tokens.gridStroke} strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  stroke={tokens.axisStroke}
                  tick={{ fill: tokens.textSecondary, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis
                  stroke={tokens.axisStroke}
                  tick={{ fill: tokens.textSecondary, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tokens.tooltipBg,
                    borderColor: tokens.tooltipBorder,
                    borderRadius: '10px',
                    color: tokens.textPrimary,
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }} />
                <Bar dataKey="Median" fill={tokens.chart3} isAnimationActive={false} />
                <Bar dataKey="p95" fill={tokens.chart1} isAnimationActive={false} />
                <Bar dataKey="p99" fill={tokens.chart4} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SpotlightCard>

        <SpotlightCard reducedMotion={reducedMotion} className="xl:col-span-6 p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span>Per-Class Egress Allocation</span>
              <span className="font-mono font-semibold text-[var(--color-accent)]">
                SIMULATED BASELINES
              </span>
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
              Interactive Protection vs. Bulk Containment (Mbps)
            </h3>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={throughputChartData}
                margin={{ top: 10, right: 12, left: 0, bottom: 5 }}
              >
                <CartesianGrid stroke={tokens.gridStroke} strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  stroke={tokens.axisStroke}
                  tick={{ fill: tokens.textSecondary, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis
                  stroke={tokens.axisStroke}
                  tick={{ fill: tokens.textSecondary, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tokens.tooltipBg,
                    borderColor: tokens.tooltipBorder,
                    borderRadius: '10px',
                    color: tokens.textPrimary,
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }} />
                <Bar
                  dataKey="Video Calls"
                  stackId="a"
                  fill={tokens.chart1}
                  isAnimationActive={false}
                />
                <Bar dataKey="Gaming" stackId="a" fill={tokens.chart3} isAnimationActive={false} />
                <Bar
                  dataKey="Streaming"
                  stackId="a"
                  fill={tokens.chart4}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="Bulk Downloads"
                  stackId="a"
                  fill={tokens.chart5}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SpotlightCard>
      </div>

      {/* Side-by-Side Quantitative Matrix Table */}
      <SpotlightCard reducedMotion={reducedMotion} className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-mono font-semibold text-[var(--color-accent)]">
              SIDE-BY-SIDE BENCHMARK SUMMARY TABLE (SIMULATED)
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
              Reproducibility Metadata & Comparative Metrics
            </h3>
          </div>
          <span className="text-xs font-mono text-[var(--color-text-muted)]">
            Scenario: STORY_8STEP · Duration: 240s · Seed: 42026
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] font-mono text-[11px] text-[var(--color-text-secondary)]">
                <th className="py-3 px-3">Profile / Run ID</th>
                <th className="py-3 px-3">Queue & Classifier</th>
                <th className="py-3 px-2 text-right">Median RTT</th>
                <th className="py-3 px-2 text-right">p95 / p99 RTT</th>
                <th className="py-3 px-2 text-right">Jitter</th>
                <th className="py-3 px-2 text-right">Loss</th>
                <th className="py-3 px-2 text-right">Jain’s Index</th>
                <th className="py-3 px-2 text-right">Recovery</th>
                <th className="py-3 px-2 text-right">CPU / Inf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {activeRuns.map((run) => (
                <tr key={run.id} className="hover:bg-[var(--color-surface-hover)]">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-[var(--color-text-primary)]">
                      {run.profileName}
                    </div>
                    <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                      {run.id} · Simulated Baseline
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-[var(--color-text-secondary)]">
                    <div>{run.config.queueDiscipline}</div>
                    <div className="font-semibold text-[var(--color-accent)]">
                      {run.config.modelVersion}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums text-[var(--color-text-primary)]">
                    {run.metrics.medianLatencyMs} ms
                  </td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums text-[var(--color-text-secondary)]">
                    <span className="text-[var(--color-text-primary)] font-semibold">
                      {run.metrics.p95LatencyMs}
                    </span>{' '}
                    / {run.metrics.p99LatencyMs} ms
                  </td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums text-[var(--color-text-secondary)]">
                    {run.metrics.jitterMs} ms
                  </td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums text-[var(--color-text-secondary)]">
                    {run.metrics.packetLossPct}%
                  </td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums font-semibold text-[var(--color-success)]">
                    {run.metrics.jainsFairnessIndex.toFixed(2)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums font-semibold text-[var(--color-accent)]">
                    {run.metrics.recoveryTimeSec}s
                  </td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums text-[11px] text-[var(--color-text-secondary)]">
                    <div>{run.metrics.cpuOverheadPct}% CPU</div>
                    <div className="text-[var(--color-text-muted)]">
                      {run.metrics.inferenceLatencyUs} µs
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-2 flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
          <Info
            className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>
            Each row carries an explicit{' '}
            <code className="font-mono text-[var(--color-text-primary)]">
              isSimulatedBaseline: true
            </code>{' '}
            flag in CSV/JSON exports so benchmark reports never conflate UI walkthrough profiles with physical Mininet/Linux router experiments.
          </span>
        </div>
      </SpotlightCard>
    </div>
  );
};
