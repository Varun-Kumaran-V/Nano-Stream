import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Layers,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import {
  MetricPoint,
  PolicyEvent,
  ScenarioId,
  SystemHealth,
  TrafficClass,
  PageId,
} from '../types/qos';
import { SpotlightCard } from '../components/SpotlightCard';
import { NetworkTopology2D } from '../components/NetworkTopology2D';
import { ScenarioControlBar } from '../components/ScenarioControlBar';
import { TRAFFIC_CLASSES } from '../services/demoEngine';
import { useTheme } from '../context/ThemeContext';

interface OverviewPageProps {
  series: MetricPoint[];
  currentPoint: MetricPoint;
  events: PolicyEvent[];
  systemHealth: SystemHealth;
  scenarioId: ScenarioId;
  tick: number;
  isPlaying: boolean;
  speedMultiplier: 1 | 2;
  reducedMotion: boolean;
  onSelectScenario: (id: ScenarioId) => void;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onReset: () => void;
  onChangeSpeed: (speed: 1 | 2) => void;
  onNavigate: (page: PageId) => void;
  onExplainTerm?: (termText: string) => void;
}

const CLASS_SHAPES: Record<TrafficClass, string> = {
  'Video Calls': '■',
  Gaming: '▲',
  'Interactive Browsing': '●',
  Streaming: '◆',
  'Bulk Downloads': '▼',
  'Background Sync': '▣',
  Unknown: '○',
};

export const OverviewPage: React.FC<OverviewPageProps> = ({
  series,
  currentPoint,
  events,
  systemHealth,
  scenarioId,
  tick,
  isPlaying,
  speedMultiplier,
  reducedMotion,
  onSelectScenario,
  onTogglePlay,
  onStepForward,
  onReset,
  onChangeSpeed,
  onNavigate,
  onExplainTerm,
}) => {
  const { tokens } = useTheme();
  const [timeRange, setTimeRange] = useState<'1m' | '5m' | '15m' | '1h'>('5m');

  const classColors: Record<TrafficClass, string> = {
    'Video Calls': tokens.chart1,
    Gaming: tokens.chart3,
    'Interactive Browsing': tokens.chart2,
    Streaming: tokens.chart4,
    'Bulk Downloads': tokens.chart5,
    'Background Sync': tokens.chart6,
    Unknown: tokens.chart7,
  };

  const rangeCountMap: Record<'1m' | '5m' | '15m' | '1h', number> = {
    '1m': 12,
    '5m': 24,
    '15m': 36,
    '1h': 48,
  };

  const displayedSeries = series.slice(-rangeCountMap[timeRange]);
  const sparkSlice = series.slice(-10);

  const kpiCards = [
    {
      id: 'wan-capacity',
      label: 'Est. WAN Capacity',
      glossaryTerm: 'Estimated WAN Capacity',
      value: `${currentPoint.estimatedCapacityMbps}`,
      unit: 'Mbps',
      sub: `Shaper ceiling ${currentPoint.configuredShapingMbps} Mbps`,
      provenance: 'SIMULATED · DEMO',
      sparkValues: sparkSlice.map((p) => p.estimatedCapacityMbps),
      color: tokens.chart1,
    },
    {
      id: 'throughput',
      label: 'Current Throughput',
      glossaryTerm: 'Observed Throughput',
      value: `${currentPoint.throughputMbps}`,
      unit: 'Mbps',
      sub: `${currentPoint.utilizationPct}% link utilization`,
      provenance: 'SIMULATED · DEMO',
      sparkValues: sparkSlice.map((p) => p.throughputMbps),
      color: tokens.chart2,
    },
    {
      id: 'median-latency',
      label: 'Median RTT Latency',
      glossaryTerm: 'Median RTT Latency',
      value: `${currentPoint.medianLatencyMs}`,
      unit: 'ms',
      sub: `Queue delay ${currentPoint.queueDelayMs} ms`,
      provenance: 'SIMULATED · DEMO',
      sparkValues: sparkSlice.map((p) => p.medianLatencyMs),
      color: tokens.chart3,
    },
    {
      id: 'p95-latency',
      label: 'p95 Tail Latency',
      glossaryTerm: 'p95 and p99 Tail Latency',
      value: `${currentPoint.p95LatencyMs}`,
      unit: 'ms',
      sub: `p99 ${currentPoint.p99LatencyMs} ms · Jitter ${currentPoint.jitterMs} ms`,
      provenance: 'SIMULATED · DEMO',
      sparkValues: sparkSlice.map((p) => p.p95LatencyMs),
      color: currentPoint.p95LatencyMs > 40 ? tokens.warning : tokens.chart4,
    },
    {
      id: 'packet-loss',
      label: 'Packet Loss Rate',
      glossaryTerm: 'Packet Loss Rate',
      value: `${currentPoint.packetLossPct}`,
      unit: '%',
      sub: currentPoint.packetLossPct > 0.5 ? 'Congestion drops active' : 'Nominal SLA (<0.2%)',
      provenance: 'SIMULATED · DEMO',
      sparkValues: sparkSlice.map((p) => p.packetLossPct),
      color: currentPoint.packetLossPct > 0.5 ? tokens.danger : tokens.success,
    },
    {
      id: 'active-flows',
      label: 'Classified Flows',
      glossaryTerm: 'Active Flow',
      value: `${currentPoint.activeFlows}`,
      unit: 'flows',
      sub: '7 classes · 1 Unknown gate',
      provenance: 'SIMULATED · DEMO',
      sparkValues: sparkSlice.map((p) => p.activeFlows),
      color: tokens.chart1,
    },
  ];

  const totalClassMbps =
    Object.values(currentPoint.classThroughputMbps).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-5" data-testid="overview-page">
      {/* 1. Compact Scenario Playback & Narrative Control */}
      <ScenarioControlBar
        scenarioId={scenarioId}
        tick={tick}
        isPlaying={isPlaying}
        speedMultiplier={speedMultiplier}
        onSelectScenario={onSelectScenario}
        onTogglePlay={onTogglePlay}
        onStepForward={onStepForward}
        onReset={onReset}
        onChangeSpeed={onChangeSpeed}
      />

      {/* 2. Primary Graph-First Row: Dominant Real-Time Trajectory (8 cols) + Compact 6-Tile Telemetry Readout Grid (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Dominant Time-Series Graph */}
        <SpotlightCard
          reducedMotion={reducedMotion}
          className="xl:col-span-8 p-5 flex flex-col justify-between"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <span>WAN Capacity, Throughput & Tail Latency Trajectory</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-[var(--color-accent)]">
                  SIMULATED · DEMO
                </span>
              </div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
                Real-Time Bottleneck Tracking & Latency Response
              </h2>
            </div>

            {/* Functional Time Range Selector */}
            <div
              role="group"
              aria-label="Chart time range"
              data-no-explain="true"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] self-start"
            >
              {(['1m', '5m', '15m', '1h'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    timeRange === range
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[320px] w-full" data-testid="overview-timeseries-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayedSeries} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradThroughput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={tokens.chart1} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={tokens.chart1} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradP95" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={tokens.chart4} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={tokens.chart4} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={tokens.gridStroke} strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  stroke={tokens.axisStroke}
                  tick={{ fill: tokens.textSecondary, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis
                  yAxisId="left"
                  stroke={tokens.axisStroke}
                  tick={{ fill: tokens.textSecondary, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  label={{
                    value: 'Mbps',
                    angle: -90,
                    position: 'insideLeft',
                    fill: tokens.textMuted,
                    fontSize: 11,
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke={tokens.axisStroke}
                  tick={{ fill: tokens.chart4, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  label={{
                    value: 'Latency (ms)',
                    angle: 90,
                    position: 'insideRight',
                    fill: tokens.chart4,
                    fontSize: 11,
                  }}
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
                <ReferenceLine
                  yAxisId="right"
                  y={25}
                  stroke={tokens.chart3}
                  strokeDasharray="4 4"
                  label={{
                    value: 'Interactive Target (25ms)',
                    fill: tokens.chart3,
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="estimatedCapacityMbps"
                  name="Est. WAN Capacity (Mbps)"
                  stroke={tokens.chart2}
                  strokeWidth={1.8}
                  strokeDasharray="5 3"
                  fill="none"
                  isAnimationActive={false}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="throughputMbps"
                  name="Observed Throughput (Mbps)"
                  stroke={tokens.chart1}
                  strokeWidth={2}
                  fill="url(#gradThroughput)"
                  isAnimationActive={false}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="p95LatencyMs"
                  name="p95 Tail Latency (ms)"
                  stroke={tokens.chart4}
                  strokeWidth={2}
                  fill="url(#gradP95)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--color-text-secondary)]">
            <div className="flex flex-wrap items-center gap-4 font-mono">
              <span>
                <strong style={{ color: tokens.chart2 }}>■</strong> Est. WAN Capacity (Mbps)
              </span>
              <span>
                <strong style={{ color: tokens.chart1 }}>●</strong> Observed Throughput (Mbps)
              </span>
              <span>
                <strong style={{ color: tokens.chart4 }}>▲</strong> p95 Tail Latency (ms)
              </span>
            </div>
            <span className="font-mono text-[var(--color-text-muted)]">
              Window: {timeRange} ({displayedSeries.length} samples)
            </span>
          </div>
        </SpotlightCard>

        {/* Task-Manager-Inspired Compact 2×3 KPI Telemetry Readout Strip */}
        <section
          aria-label="Key Performance Indicators"
          data-testid="overview-kpi-grid"
          className="xl:col-span-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-3 content-stretch"
        >
          {kpiCards.map((kpi) => {
            const min = Math.min(...kpi.sparkValues);
            const max = Math.max(...kpi.sparkValues);
            const span = max - min || 1;
            const pts = kpi.sparkValues
              .map((v, idx) => {
                const x = (idx / Math.max(1, kpi.sparkValues.length - 1)) * 100;
                const y = 24 - ((v - min) / span) * 20;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(' ');

            return (
              <SpotlightCard
                key={kpi.id}
                reducedMotion={reducedMotion}
                data-testid={`kpi-${kpi.id}`}
                className="p-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-medium text-[var(--color-text-secondary)] truncate">
                      {kpi.label}
                    </span>
                    {onExplainTerm && (
                      <button
                        type="button"
                        data-no-explain="true"
                        onClick={() => onExplainTerm(kpi.glossaryTerm)}
                        aria-label={`Explain ${kpi.label}`}
                        title={`Explain ${kpi.label}`}
                        className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer shrink-0"
                      >
                        <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[var(--color-text-primary)]">
                      {kpi.value}
                    </span>
                    <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                      {kpi.unit}
                    </span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                  <svg
                    viewBox="0 0 100 26"
                    className="w-full h-5 overflow-visible"
                    aria-hidden="true"
                  >
                    <polyline
                      fill="none"
                      stroke={kpi.color}
                      strokeWidth="1.8"
                      points={pts}
                    />
                  </svg>
                  <div
                    className="text-[10px] font-mono text-[var(--color-text-muted)] truncate mt-1"
                    title={`${kpi.sub} (${kpi.provenance})`}
                  >
                    {kpi.sub}
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </section>
      </div>

      {/* 3. Secondary Row: Traffic Class Distribution (5 cols) + Interactive 2D Network Topology (7 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Traffic Distribution by Class */}
        <SpotlightCard
          reducedMotion={reducedMotion}
          className="xl:col-span-5 p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
              <span>Traffic Class Distribution (First 32 Packets)</span>
              <span className="font-mono font-semibold text-[var(--color-accent)]">
                SIMULATED · DEMO
              </span>
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
              Per-Class Bandwidth Share
            </h2>

            {/* Stacked Horizontal Summary Bar */}
            <div
              className="mt-3.5 h-3.5 w-full rounded-md bg-[var(--color-bg-subtle)] overflow-hidden flex border border-[var(--color-border)]"
              role="img"
              aria-label="Stacked traffic distribution bar across 7 classes"
            >
              {TRAFFIC_CLASSES.map((cls) => {
                const val = currentPoint.classThroughputMbps[cls];
                const pct = (val / totalClassMbps) * 100;
                return (
                  <div
                    key={cls}
                    style={{ width: `${pct}%`, backgroundColor: classColors[cls] }}
                    title={`${cls}: ${val} Mbps (${pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>

            {/* Detailed Class Rows with Shape + Text + Tabular Numerals */}
            <div className="mt-3.5 space-y-2">
              {TRAFFIC_CLASSES.map((cls) => {
                const val = currentPoint.classThroughputMbps[cls];
                const pct = ((val / totalClassMbps) * 100).toFixed(1);
                return (
                  <div key={cls} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-[var(--color-text-primary)] font-medium">
                        <span
                          className="font-mono text-xs"
                          style={{ color: classColors[cls] }}
                          aria-hidden="true"
                        >
                          {CLASS_SHAPES[cls]}
                        </span>
                        <span>{cls}</span>
                      </div>
                      <div className="font-mono tabular-nums text-[var(--color-text-secondary)]">
                        <span className="text-[var(--color-text-primary)] font-semibold">
                          {val.toFixed(1)}
                        </span>{' '}
                        Mbps
                        <span className="text-[var(--color-text-muted)] ml-1.5">({pct}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--color-bg-subtle)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Number(pct))}%`,
                          backgroundColor: classColors[cls],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
            <span className="text-xs font-mono text-[var(--color-text-muted)]">
              Total: {currentPoint.throughputMbps} Mbps · 7 Classes
            </span>
            <button
              type="button"
              onClick={() => onNavigate('traffic')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline cursor-pointer"
            >
              <span>Inspect Flow Table</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </SpotlightCard>

        {/* Interactive 2D Network Topology */}
        <SpotlightCard reducedMotion={reducedMotion} className="xl:col-span-7 p-5">
          <NetworkTopology2D
            currentPoint={currentPoint}
            scenarioId={scenarioId}
            isPlaying={isPlaying}
            reducedMotion={reducedMotion}
            onTogglePlay={onTogglePlay}
          />
        </SpotlightCard>
      </div>

      {/* 4. Supporting Row: Recent Policy Decisions Feed (7 cols) + System Health Status Panel (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <SpotlightCard
          reducedMotion={reducedMotion}
          className="xl:col-span-7 p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span>Recent Adaptive Policy Decisions</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-[var(--color-accent)]">
                    SIMULATED · DEMO
                  </span>
                </div>
                <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
                  Controller & Shaper Decision Audit Log
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('policy')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Sliders className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden="true" />
                <span>Configure Intents</span>
              </button>
            </div>

            <div
              className="mt-4 divide-y divide-[var(--color-border)]"
              data-testid="recent-decisions-feed"
            >
              {events.map((evt) => (
                <div key={evt.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {evt.decision}
                    </span>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
                      <span>{evt.timestamp}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          evt.severity === 'CONGESTION'
                            ? 'font-semibold text-[var(--color-warning)]'
                            : evt.severity === 'RECOVERY'
                              ? 'font-semibold text-[var(--color-success)]'
                              : 'font-semibold text-[var(--color-accent)]'
                        }
                      >
                        {evt.severity}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>SIMULATED</span>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)]">{evt.reason}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[var(--color-text-muted)]">
                    <span>Effect: {evt.policyEffect}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-[var(--color-success)]">{evt.outcome}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SpotlightCard>

        {/* System Status & Honesty Boundaries Panel */}
        <SpotlightCard
          reducedMotion={reducedMotion}
          className="xl:col-span-5 p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span>Subsystem Provenance & Readiness</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-[var(--color-accent)]">
                    {systemHealth.mode} MODE
                  </span>
                </div>
                <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
                  Pipeline Component Status
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('diagnostics')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline cursor-pointer"
              >
                <span>Diagnostics</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {systemHealth.components.map((comp) => (
                <div
                  key={comp.id}
                  className="p-3 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                        {comp.name}
                      </span>
                      <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                        ({comp.version})
                      </span>
                    </div>
                    <p
                      className="text-xs text-[var(--color-text-secondary)] truncate"
                      title={comp.detail}
                    >
                      {comp.detail}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                    {comp.state === 'DEMO_SIMULATION' ? (
                      <>
                        <Layers
                          className="w-3.5 h-3.5 text-[var(--color-accent)]"
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-[var(--color-accent)]">
                          Demo simulation
                        </span>
                      </>
                    ) : comp.state === 'OPERATIONAL' ? (
                      <>
                        <CheckCircle2
                          className="w-3.5 h-3.5 text-[var(--color-success)]"
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-[var(--color-success)]">
                          Operational
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle
                          className="w-3.5 h-3.5 text-[var(--color-warning)]"
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-[var(--color-warning)]">
                          Not connected
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-start gap-2.5 text-xs text-[var(--color-text-secondary)]">
            <ShieldAlert
              className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span>
              Provenance guarantee: All values in Demo / Replay mode are generated by a deterministic seeded state machine (
              <code className="font-mono text-[var(--color-text-primary)]">seed=42026</code>) and never labeled as live measurements.
            </span>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
};
