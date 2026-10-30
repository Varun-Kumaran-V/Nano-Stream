import React from 'react';
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
import { Cpu, FileCode2, Layers, ShieldAlert, Zap } from 'lucide-react';
import { DEMO_MODEL_EVALUATION } from '../services/demoEngine';
import { SpotlightCard } from '../components/SpotlightCard';
import { useTheme } from '../context/ThemeContext';

interface ModelInsightsPageProps {
  reducedMotion: boolean;
}

export const ModelInsightsPage: React.FC<ModelInsightsPageProps> = ({ reducedMotion }) => {
  const { theme, tokens } = useTheme();
  const ev = DEMO_MODEL_EVALUATION;
  const shortLabels = ['Video', 'Gaming', 'Browse', 'Stream', 'Bulk', 'Sync', 'Unk'];

  return (
    <div className="space-y-6" data-testid="model-insights-page">
      {/* Offline Evaluation vs. Live Observation Provenance Banner */}
      <SpotlightCard reducedMotion={reducedMotion} className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Cpu
              className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-semibold text-[var(--color-accent)]">
                <span>OFFLINE HOLDOUT EVALUATION METRICS</span>
                <span aria-hidden="true">·</span>
                <span>{ev.modelVersion}</span>
                <span aria-hidden="true">·</span>
                <span>EXAMPLE REFERENCE DATASET</span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                {ev.provenanceNote}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono shrink-0 bg-[var(--color-bg-subtle)] px-3.5 py-2.5 rounded-lg border border-[var(--color-border)]">
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)]">MACRO F1 (HOLDOUT)</div>
              <div className="text-sm font-bold text-[var(--color-success)] tabular-nums">
                {(ev.macroF1 * 100).toFixed(1)}%
              </div>
            </div>
            <div className="h-6 w-px bg-[var(--color-border)]" />
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)]">INT8 ARTIFACT SIZE</div>
              <div className="text-sm font-bold text-[var(--color-accent)] tabular-nums">
                {ev.modelSizeKb} KB
              </div>
            </div>
            <div className="h-6 w-px bg-[var(--color-border)]" />
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)]">P50 INFERENCE</div>
              <div className="text-sm font-bold text-[var(--color-info)] tabular-nums">
                {ev.inferenceLatencyP50Us} µs
              </div>
            </div>
          </div>
        </div>
      </SpotlightCard>

      {/* Model Metadata & Quantization Comparison Row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <SpotlightCard reducedMotion={reducedMotion} className="xl:col-span-6 p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--color-accent)]">
            <FileCode2 className="w-4 h-4" aria-hidden="true" />
            <span>ARTIFACT & FEATURE SCHEMA METADATA</span>
          </div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {ev.modelName} ({ev.quantizationState})
          </h2>

          <div className="divide-y divide-[var(--color-border)] text-xs pt-1">
            <div className="py-2 flex items-center justify-between gap-2">
              <span className="text-[var(--color-text-secondary)]">Artifact Digest</span>
              <span className="font-mono text-[var(--color-text-primary)]">{ev.artifactId}</span>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <span className="text-[var(--color-text-secondary)]">Feature Schema</span>
              <span className="font-mono font-semibold text-[var(--color-accent)]">
                {ev.featureSchemaVersion}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <span className="text-[var(--color-text-secondary)]">Class Mapping</span>
              <span className="font-mono text-[var(--color-text-primary)]">
                {ev.classMappingVersion}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <span className="text-[var(--color-text-secondary)]">Evaluation Dataset</span>
              <span className="font-mono text-[var(--color-text-secondary)]">{ev.datasetName}</span>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <span className="text-[var(--color-text-secondary)]">Holdout Sample Size</span>
              <span className="font-mono tabular-nums text-[var(--color-text-primary)]">
                {ev.sampleCount.toLocaleString()} flows ({ev.evaluationDate})
              </span>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard reducedMotion={reducedMotion} className="xl:col-span-6 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--color-info)]">
              <Zap className="w-4 h-4" aria-hidden="true" />
              <span>QUANTIZATION & INFERENCE LATENCY PROFILE</span>
            </div>
            <span className="text-xs font-mono font-semibold text-[var(--color-accent)]">
              EXAMPLE BENCHMARK
            </span>
          </div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            INT8 Quantized vs. FP32 Baseline Footprint
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
              <div className="text-[11px] text-[var(--color-text-secondary)]">Checkpoint Size</div>
              <div className="text-lg font-bold font-mono tabular-nums text-[var(--color-success)] mt-0.5">
                {ev.modelSizeKb} KB
              </div>
              <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                vs. {ev.fp32SizeKb} KB FP32 (-73.5%)
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
              <div className="text-[11px] text-[var(--color-text-secondary)]">
                CPU Inference (p50 / p95)
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-[var(--color-accent)] mt-0.5">
                {ev.inferenceLatencyP50Us} / {ev.inferenceLatencyP95Us} µs
              </div>
              <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                p99: {ev.inferenceLatencyP99Us} µs · FP32 p50: {ev.fp32LatencyP50Us} µs
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
              <div className="text-[11px] text-[var(--color-text-secondary)]">
                Accuracy Retention
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-[var(--color-text-primary)] mt-0.5">
                {(ev.overallAccuracy * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                -0.3% macro F1 vs. FP32
              </div>
            </div>
          </div>

          <p className="text-xs text-[var(--color-text-secondary)]">
            Early-flow inference runs once per flow after 32 packets arrive, avoiding per-packet neural network overhead on the data plane.
          </p>
        </SpotlightCard>
      </div>

      {/* Per-Class Precision/Recall/F1 Table + 7x7 Confusion Matrix */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <SpotlightCard reducedMotion={reducedMotion} className="xl:col-span-5 p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span>Per-Class Holdout Evaluation</span>
              <span className="font-mono font-semibold text-[var(--color-accent)]">
                OFFLINE DATASET
              </span>
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
              Precision, Recall & F1 by Traffic Class
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] font-mono text-[11px] text-[var(--color-text-secondary)]">
                  <th className="py-2.5 px-3">Traffic Class</th>
                  <th className="py-2.5 px-2 text-right">Precision</th>
                  <th className="py-2.5 px-2 text-right">Recall</th>
                  <th className="py-2.5 px-2 text-right">F1 Score</th>
                  <th className="py-2.5 px-3 text-right">Support</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {ev.perClassMetrics.map((m) => (
                  <tr key={m.trafficClass} className="hover:bg-[var(--color-surface-hover)]">
                    <td className="py-2.5 px-3 font-medium text-[var(--color-text-primary)]">
                      {m.trafficClass}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[var(--color-text-secondary)]">
                      {(m.precision * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[var(--color-text-secondary)]">
                      {(m.recall * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-[var(--color-success)]">
                      {(m.f1Score * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[var(--color-text-muted)]">
                      {m.supportCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SpotlightCard>

        {/* 7x7 Confusion Matrix */}
        <SpotlightCard reducedMotion={reducedMotion} className="xl:col-span-7 p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span>7×7 Holdout Confusion Matrix (Rows = Actual, Columns = Predicted)</span>
              <span className="font-mono font-semibold text-[var(--color-accent)]">
                N = 14,000 FLOWS
              </span>
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
              Inter-Class Confusion & Unknown Fallback Counts
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs font-mono">
              <thead>
                <tr className="text-[11px] text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                  <th className="py-2 px-2 text-left">Actual \ Pred</th>
                  {shortLabels.map((lbl) => (
                    <th key={lbl} className="py-2 px-2">
                      {lbl}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {ev.confusionMatrix.matrix.map((row, rIdx) => {
                  const rowSum = row.reduce((a, b) => a + b, 0) || 1;
                  return (
                    <tr key={shortLabels[rIdx]}>
                      <td className="py-2 px-2 text-left font-semibold text-[var(--color-text-primary)] bg-[var(--color-bg-subtle)]">
                        {shortLabels[rIdx]}
                      </td>
                      {row.map((cell, cIdx) => {
                        const isDiag = rIdx === cIdx;
                        const ratio = cell / rowSum;
                        const bg = isDiag
                          ? theme === 'light'
                            ? `rgba(242, 106, 33, ${Math.max(0.14, ratio * 0.28).toFixed(2)})`
                            : `rgba(212, 212, 216, ${Math.max(0.14, ratio * 0.3).toFixed(2)})`
                          : cell > 35
                            ? tokens.warningSoft
                            : 'transparent';
                        return (
                          <td
                            key={cIdx}
                            style={{ backgroundColor: bg }}
                            className={`py-2 px-2 tabular-nums ${
                              isDiag
                                ? 'text-[var(--color-text-primary)] font-bold'
                                : cell > 35
                                  ? 'text-[var(--color-warning)] font-semibold'
                                  : 'text-[var(--color-text-muted)]'
                            }`}
                          >
                            {cell}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SpotlightCard>
      </div>

      {/* Confidence Distribution Comparison: Offline Evaluation vs Demo Stream */}
      <SpotlightCard reducedMotion={reducedMotion} className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <Layers className="w-4 h-4 text-[var(--color-accent)]" aria-hidden="true" />
              <span>Offline Holdout Confidence vs. Simulated Traffic Stream</span>
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
              Softmax Confidence Distribution & Safety Fallback Threshold (0.65)
            </h3>
          </div>
          <span className="text-xs font-mono text-[var(--color-text-muted)]">
            Flows below 0.65 confidence map to Default Safe Best-Effort
          </span>
        </div>

        <div className="h-[230px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={ev.confidenceDistribution}
              margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
            >
              <CartesianGrid stroke={tokens.gridStroke} strokeDasharray="3 3" />
              <XAxis
                dataKey="bucket"
                stroke={tokens.axisStroke}
                tick={{ fill: tokens.textSecondary, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              />
              <YAxis
                stroke={tokens.axisStroke}
                tick={{ fill: tokens.textSecondary, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                unit="%"
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
                dataKey="offlineEvalPct"
                name="Offline Holdout Split (%)"
                fill={tokens.chart2}
                isAnimationActive={false}
              />
              <Bar
                dataKey="demoObservedPct"
                name="Simulated Demo Stream (%)"
                fill={tokens.chart1}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="pt-2 flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
          <ShieldAlert
            className="w-4 h-4 text-[var(--color-warning)] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>
            Why separate offline and live/demo distributions? Offline evaluation measures static holdout accuracy, whereas live home traffic contains unseen applications and encrypted tunnels that must be caught by the{' '}
            <code className="font-mono text-[var(--color-text-primary)]">&lt;0.65</code> Unknown confidence gate rather than misclassified into high-priority queues.
          </span>
        </div>
      </SpotlightCard>
    </div>
  );
};
