import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Gauge, TrendingDown, TrendingUp, HardDriveDownload, Info } from 'lucide-react';
import { CapacityEstimate, MetricPoint, ScenarioId } from '../types/qos';
import { SpotlightCard } from '../components/SpotlightCard';
import { useTheme } from '../context/ThemeContext';

interface CapacityCongestionPageProps {
  series: MetricPoint[];
  currentPoint: MetricPoint;
  capacityEstimate: CapacityEstimate;
  scenarioId: ScenarioId;
  reducedMotion: boolean;
  onSelectScenario: (id: ScenarioId) => void;
}

export const CapacityCongestionPage: React.FC<CapacityCongestionPageProps> = ({
  series,
  currentPoint,
  capacityEstimate,
  scenarioId,
  reducedMotion,
  onSelectScenario,
}) => {
  const { tokens } = useTheme();
  const recentSeries = series.slice(-24);
  const annotatedPoints = recentSeries.filter((p) => Boolean(p.annotation));

  return (
    <div className="space-y-6" data-testid="capacity-congestion-page">
      {/* Top Scenario Quick-Switch Bar for Capacity & Congestion */}
      <SpotlightCard reducedMotion={reducedMotion} className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <span>WAN Bottleneck & Queue Dynamics</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-[var(--color-accent)]">
                SIMULATED · DEMO
              </span>
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
              Capacity Estimation vs. Configured Shaping Ceiling
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)] mr-1">Test scenario:</span>
            <button
              type="button"
              onClick={() => onSelectScenario('SCENARIO_E_CAPACITY_DROP')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                scenarioId === 'SCENARIO_E_CAPACITY_DROP'
                  ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)] font-semibold'
                  : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border-[var(--color-border)]'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
              <span>WAN Capacity Drop (48 Mbps)</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectScenario('SCENARIO_G_CAPACITY_RECOVERY')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                scenarioId === 'SCENARIO_G_CAPACITY_RECOVERY'
                  ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)] font-semibold'
                  : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border-[var(--color-border)]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Capacity Recovery (48 → 120 Mbps)</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectScenario('SCENARIO_D_BULK_DOWNLOAD')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                scenarioId === 'SCENARIO_D_BULK_DOWNLOAD'
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] border-[var(--color-accent)] font-semibold'
                  : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border-[var(--color-border)]'
              }`}
            >
              <HardDriveDownload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Competing Bulk Transfer</span>
            </button>
          </div>
        </div>
      </SpotlightCard>

      {/* Distinct 4-Card Strip Separating Estimated Capacity, Shaping Ceiling, Observed Throughput, and Queue State */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SpotlightCard reducedMotion={reducedMotion} className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono font-semibold text-[var(--color-accent)]">
            <span>ESTIMATED WAN</span>
            <span>SIMULATED</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-[var(--color-text-primary)]">
              {capacityEstimate.estimatedWanMbps}
            </span>
            <span className="text-xs font-mono text-[var(--color-text-secondary)]">Mbps</span>
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            Simulated confidence: {capacityEstimate.confidencePct}% (±
            {capacityEstimate.errorBoundMbps} Mbps)
          </div>
        </SpotlightCard>

        <SpotlightCard reducedMotion={reducedMotion} className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono font-semibold text-[var(--color-info)]">
            <span>SHAPING RATE</span>
            <span>HTB CEILING</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-[var(--color-text-primary)]">
              {capacityEstimate.configuredShapingMbps}
            </span>
            <span className="text-xs font-mono text-[var(--color-text-secondary)]">Mbps</span>
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            Tracks {100 - capacityEstimate.headroomReservePct}% of estimated WAN (
            {capacityEstimate.headroomReservePct}% anti-bufferbloat reserve)
          </div>
        </SpotlightCard>

        <SpotlightCard reducedMotion={reducedMotion} className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono font-semibold text-[var(--color-success)]">
            <span>OBSERVED LOAD</span>
            <span>EGRESS RATE</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-[var(--color-text-primary)]">
              {capacityEstimate.observedThroughputMbps}
            </span>
            <span className="text-xs font-mono text-[var(--color-text-secondary)]">Mbps</span>
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            Utilization: {currentPoint.utilizationPct}% of estimated link capacity
          </div>
        </SpotlightCard>

        <SpotlightCard reducedMotion={reducedMotion} className="p-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-[var(--color-warning)]">
            <span>QUEUE DELAY & CONGESTION</span>
            <span>{capacityEstimate.congestionState}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-[var(--color-text-primary)]">
              {currentPoint.queueDelayMs}
            </span>
            <span className="text-xs font-mono text-[var(--color-text-secondary)]">
              ms queue delay
            </span>
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            Queue occupancy: {currentPoint.queueDepthPct}% · Loss: {currentPoint.packetLossPct}%
          </div>
        </SpotlightCard>
      </div>

      {/* Two Side-by-Side Operational Charts: Capacity vs Shaping vs Throughput + Queue Delay & Loss */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <SpotlightCard reducedMotion={reducedMotion} className="xl:col-span-6 p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span>Capacity vs. Shaping Ceiling vs. Observed Load</span>
              <span className="font-mono font-semibold text-[var(--color-accent)]">
                SIMULATED · DEMO
              </span>
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
              Bandwidth Headroom & Shaper Tracking (Mbps)
            </h3>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={recentSeries}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={tokens.gridStroke} strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  stroke={tokens.axisStroke}
                  tick={{ fill: tokens.textSecondary, fontSize: 11, fontFamily: 'JetBrains Mono' }}
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
                <Area
                  type="monotone"
                  dataKey="throughputMbps"
                  name="Observed Throughput (Mbps)"
                  fill={tokens.chart1}
                  fillOpacity={0.14}
                  stroke={tokens.chart1}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Line
                  type="stepAfter"
                  dataKey="estimatedCapacityMbps"
                  name="Est. WAN Capacity (Mbps)"
                  stroke={tokens.chart2}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="stepAfter"
                  dataKey="configuredShapingMbps"
                  name="Configured Shaper Rate (Mbps)"
                  stroke={tokens.chart3}
                  strokeWidth={1.8}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs font-mono text-[var(--color-text-secondary)] flex flex-wrap gap-4">
            <span>
              <strong style={{ color: tokens.chart2 }}>■</strong> Est. WAN Capacity
            </span>
            <span>
              <strong style={{ color: tokens.chart3 }}>●</strong> Configured Shaping Ceiling
            </span>
            <span>
              <strong style={{ color: tokens.chart1 }}>▲</strong> Observed Throughput
            </span>
          </div>
        </SpotlightCard>

        <SpotlightCard reducedMotion={reducedMotion} className="xl:col-span-6 p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span>Queueing Delay, Tail Latency & Packet Drops</span>
              <span className="font-mono font-semibold text-[var(--color-accent)]">
                SIMULATED · DEMO
              </span>
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
              Bufferbloat Mitigation & Queue Occupancy
            </h3>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={recentSeries}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={tokens.gridStroke} strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  stroke={tokens.axisStroke}
                  tick={{ fill: tokens.textSecondary, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis
                  yAxisId="ms"
                  stroke={tokens.axisStroke}
                  tick={{ fill: tokens.textSecondary, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  stroke={tokens.axisStroke}
                  tick={{ fill: tokens.warning, fontSize: 11, fontFamily: 'JetBrains Mono' }}
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
                <ReferenceLine yAxisId="ms" y={20} stroke={tokens.chart3} strokeDasharray="3 3" />
                <Bar
                  yAxisId="ms"
                  dataKey="queueDelayMs"
                  name="Queue Delay (ms)"
                  fill={tokens.chart4}
                  fillOpacity={0.35}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="ms"
                  type="monotone"
                  dataKey="p95LatencyMs"
                  name="p95 Latency (ms)"
                  stroke={tokens.chart4}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="packetLossPct"
                  name="Packet Loss (%)"
                  stroke={tokens.danger}
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs font-mono text-[var(--color-text-secondary)] flex flex-wrap gap-4">
            <span>
              <strong style={{ color: tokens.chart4 }}>■</strong> p95 RTT Latency (ms)
            </span>
            <span>▣ Queueing Delay (ms)</span>
            <span>
              <strong style={{ color: tokens.danger }}>●</strong> Packet Loss (%)
            </span>
          </div>
        </SpotlightCard>
      </div>

      {/* Capacity Change & Policy Adaptation Annotation Markers */}
      <SpotlightCard reducedMotion={reducedMotion} className="p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[var(--color-accent)]" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Capacity Step Markers & Shaper Adaptation Timeline
            </h3>
          </div>
          <span className="text-xs font-mono text-[var(--color-text-muted)]">
            {capacityEstimate.lastAdaptationReason}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {(annotatedPoints.length > 0 ? annotatedPoints.slice(-4) : recentSeries.slice(-4)).map(
            (pt, idx) => (
              <div
                key={`${pt.timestamp}-${idx}`}
                className="p-3 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] space-y-1"
              >
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-[var(--color-accent)]">
                  <span>{pt.timestamp} UTC</span>
                  <span>{pt.estimatedCapacityMbps} Mbps</span>
                </div>
                <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {pt.annotation || 'Periodic RTT Dispersion Probe'}
                </div>
                <div className="text-[11px] font-mono text-[var(--color-text-secondary)]">
                  Shaper: {pt.configuredShapingMbps}M · Q-Delay: {pt.queueDelayMs}ms · p95:{' '}
                  {pt.p95LatencyMs}ms
                </div>
              </div>
            )
          )}
        </div>

        <div className="pt-2 flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
          <Info
            className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>
            Note on estimator provenance: The Python repository does not yet include a live WAN capacity estimator daemon. These capacity step-downs, error bounds, and token-bucket rate adaptations are deterministic demo trajectories.
          </span>
        </div>
      </SpotlightCard>
    </div>
  );
};
