import React, { useMemo, useState } from 'react';
import {
  Search,
  ArrowUpDown,
  X,
  ShieldCheck,
  AlertCircle,
  SlidersHorizontal,
  Activity,
} from 'lucide-react';
import { FlowRecord, TrafficClass } from '../types/qos';
import { TRAFFIC_CLASSES } from '../services/demoEngine';
import { SpotlightCard } from '../components/SpotlightCard';

interface LiveTrafficPageProps {
  flows: FlowRecord[];
  reducedMotion: boolean;
}

type SortField = 'currentRateMbps' | 'confidence' | 'rttMs' | 'bytesTransferred';

export const LiveTrafficPage: React.FC<LiveTrafficPageProps> = ({ flows, reducedMotion }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<TrafficClass | 'ALL'>('ALL');
  const [confidenceFilter, setConfidenceFilter] = useState<'ALL' | 'HIGH' | 'LOW_UNKNOWN'>('ALL');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'PRIORITIZED' | 'SHAPED' | 'ACTIVE' | 'OBSERVED'
  >('ALL');
  const [sortField, setSortField] = useState<SortField>('currentRateMbps');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(flows[0]?.id || null);

  const filteredFlows = useMemo(() => {
    return flows
      .filter((f) => {
        if (classFilter !== 'ALL' && f.predictedClass !== classFilter) return false;
        if (confidenceFilter === 'HIGH' && (f.confidence < 0.8 || f.predictedClass === 'Unknown')) {
          return false;
        }
        if (
          confidenceFilter === 'LOW_UNKNOWN' &&
          !f.isLowConfidence &&
          f.predictedClass !== 'Unknown'
        ) {
          return false;
        }
        if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            f.id.toLowerCase().includes(q) ||
            f.sourceEndpoint.toLowerCase().includes(q) ||
            f.destinationEndpoint.toLowerCase().includes(q) ||
            f.clientHostname.toLowerCase().includes(q) ||
            f.predictedClass.toLowerCase().includes(q) ||
            f.protocol.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const diff = a[sortField] - b[sortField];
        return sortAsc ? diff : -diff;
      });
  }, [flows, classFilter, confidenceFilter, statusFilter, searchQuery, sortField, sortAsc]);

  const selectedFlow = useMemo(
    () => flows.find((f) => f.id === selectedFlowId) || null,
    [flows, selectedFlowId]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setClassFilter('ALL');
    setConfidenceFilter('ALL');
    setStatusFilter('ALL');
  };

  return (
    <div className="space-y-6" data-testid="live-traffic-page">
      {/* Filter & Search Bar */}
      <SpotlightCard reducedMotion={reducedMotion} className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search flows by ID, endpoint, hostname, or protocol"
              placeholder="Search flow ID, endpoint, host, or protocol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-focus)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label htmlFor="filter-class" className="text-xs text-[var(--color-text-secondary)]">
                Class:
              </label>
              <select
                id="filter-class"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value as TrafficClass | 'ALL')}
                className="bg-[var(--color-bg-subtle)] text-xs text-[var(--color-text-primary)] rounded-lg px-2.5 py-1.5 border border-[var(--color-border-strong)] focus:outline-none focus:border-[var(--color-focus)]"
              >
                <option value="ALL">All Classes (7)</option>
                {TRAFFIC_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label
                htmlFor="filter-confidence"
                className="text-xs text-[var(--color-text-secondary)]"
              >
                Confidence:
              </label>
              <select
                id="filter-confidence"
                value={confidenceFilter}
                onChange={(e) =>
                  setConfidenceFilter(e.target.value as 'ALL' | 'HIGH' | 'LOW_UNKNOWN')
                }
                className="bg-[var(--color-bg-subtle)] text-xs text-[var(--color-text-primary)] rounded-lg px-2.5 py-1.5 border border-[var(--color-border-strong)] focus:outline-none focus:border-[var(--color-focus)]"
              >
                <option value="ALL">All Confidence Levels</option>
                <option value="HIGH">High Confidence (≥ 0.80)</option>
                <option value="LOW_UNKNOWN">Low Confidence / Unknown (&lt; 0.65)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="filter-status" className="text-xs text-[var(--color-text-secondary)]">
                Enforcement:
              </label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as 'ALL' | 'PRIORITIZED' | 'SHAPED' | 'ACTIVE' | 'OBSERVED'
                  )
                }
                className="bg-[var(--color-bg-subtle)] text-xs text-[var(--color-text-primary)] rounded-lg px-2.5 py-1.5 border border-[var(--color-border-strong)] focus:outline-none focus:border-[var(--color-focus)]"
              >
                <option value="ALL">All States</option>
                <option value="PRIORITIZED">Prioritized</option>
                <option value="SHAPED">Shaped / Capped</option>
                <option value="ACTIVE">Active Assured</option>
                <option value="OBSERVED">Observed (Fallback)</option>
              </select>
            </div>

            {(searchQuery ||
              classFilter !== 'ALL' ||
              confidenceFilter !== 'ALL' ||
              statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--color-accent-soft)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-accent)] text-xs text-[var(--color-text-primary)] font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-2">
            <ShieldCheck
              className="w-4 h-4 text-[var(--color-success)] shrink-0"
              aria-hidden="true"
            />
            <span>
              Privacy-preserving metadata only: Packet payloads and personal URLs are never captured or displayed.
            </span>
          </div>
          <span className="font-mono text-[var(--color-text-muted)]">
            Showing {filteredFlows.length} of {flows.length} active flows · {flows.length > 0 && flows[0].provenance === 'MEASURED_LIVE' ? 'MEASURED_LIVE' : 'SIMULATED_DEMO'}
          </span>
        </div>
      </SpotlightCard>

      {/* Main Split: Flow Table + Detail Drawer */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <SpotlightCard
          reducedMotion={reducedMotion}
          className={`${selectedFlow ? 'xl:col-span-8' : 'xl:col-span-12'} overflow-hidden`}
        >
          {filteredFlows.length === 0 ? (
            <div className="p-10 text-center space-y-3" data-testid="flows-empty-state">
              <SlidersHorizontal
                className="w-8 h-8 text-[var(--color-text-muted)] mx-auto"
                aria-hidden="true"
              />
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                No flows match the active filter criteria
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto">
                Adjust or reset the traffic class, confidence threshold, or search query to inspect simulated flows.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-on-accent)] text-xs font-semibold cursor-pointer"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[11px] font-mono text-[var(--color-text-secondary)]">
                    <th className="py-3 px-4">Flow ID / Host</th>
                    <th className="py-3 px-3">Endpoints</th>
                    <th className="py-3 px-3">Proto</th>
                    <th className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('currentRateMbps')}
                        className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)] cursor-pointer"
                      >
                        <span>Rate (Mbps)</span>
                        <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('bytesTransferred')}
                        className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)] cursor-pointer"
                      >
                        <span>Bytes / Pkts</span>
                        <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </th>
                    <th className="py-3 px-3">Predicted Class</th>
                    <th className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('confidence')}
                        className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)] cursor-pointer"
                      >
                        <span>Conf.</span>
                        <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </th>
                    <th className="py-3 px-3">Policy Queue</th>
                    <th className="py-3 px-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {filteredFlows.map((flow) => {
                    const isSelected = flow.id === selectedFlowId;
                    return (
                      <tr
                        key={flow.id}
                        onClick={() => setSelectedFlowId(flow.id)}
                        tabIndex={0}
                        role="button"
                        aria-label={`Inspect flow ${flow.id} (${flow.predictedClass})`}
                        onKeyDown={(e) =>
                          (e.key === 'Enter' || e.key === ' ') && setSelectedFlowId(flow.id)
                        }
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--color-accent-soft)]'
                            : 'hover:bg-[var(--color-surface-hover)]'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono">
                          <div className="font-semibold text-[var(--color-accent)]">{flow.id}</div>
                          <div className="text-[11px] text-[var(--color-text-secondary)]">
                            {flow.clientHostname}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[var(--color-text-secondary)]">
                          <div>{flow.sourceEndpoint}</div>
                          <div className="text-[var(--color-text-muted)]">
                            → {flow.destinationEndpoint}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[var(--color-text-primary)]">
                          {flow.protocol}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-[var(--color-text-primary)]">
                          {flow.currentRateMbps.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-[11px] text-[var(--color-text-secondary)]">
                          <div>{(flow.bytesTransferred / 1_000_000).toFixed(1)} MB</div>
                          <div className="text-[var(--color-text-muted)]">
                            {(flow.packetsTransferred / 1000).toFixed(1)}k pkts
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-[var(--color-text-primary)]">
                            {flow.predictedClass}
                          </div>
                          {flow.isLowConfidence && (
                            <div className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[var(--color-warning)]">
                              <AlertCircle className="w-3 h-3" aria-hidden="true" />
                              <span>Low-conf fallback</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          <span
                            className={
                              flow.isLowConfidence
                                ? 'text-[var(--color-warning)] font-semibold'
                                : 'text-[var(--color-success)] font-semibold'
                            }
                          >
                            {(flow.confidence * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[var(--color-text-secondary)]">
                          <div>{flow.policyClass}</div>
                          <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                            DSCP {flow.dscpMark} · {flow.status}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[var(--color-text-muted)]">
                          <div>SIMULATED</div>
                          <div>{flow.lastSeen}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SpotlightCard>

        {/* Flow Detail Inspector Drawer */}
        {selectedFlow && (
          <SpotlightCard
            reducedMotion={reducedMotion}
            data-testid="flow-detail-drawer"
            className="xl:col-span-4 p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-2 border-b border-[var(--color-border)] pb-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--color-accent)]">
                  <span>FLOW INSPECTOR</span>
                  <span aria-hidden="true">·</span>
                  <span>SIMULATED · DEMO</span>
                </div>
                <h2 className="text-base font-semibold font-mono text-[var(--color-text-primary)] mt-0.5">
                  {selectedFlow.id}
                </h2>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  Host: {selectedFlow.clientHostname} · {selectedFlow.protocol}
                </div>
              </div>
              <button
                type="button"
                aria-label="Close flow detail drawer"
                onClick={() => setSelectedFlowId(null)}
                className="p-1.5 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Classification & Confidence Summary */}
            <div className="p-3.5 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-secondary)]">Predicted Class</span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {selectedFlow.predictedClass}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-secondary)]">Classifier Confidence</span>
                <span
                  className={`font-mono font-semibold ${
                    selectedFlow.isLowConfidence
                      ? 'text-[var(--color-warning)]'
                      : 'text-[var(--color-success)]'
                  }`}
                >
                  {(selectedFlow.confidence * 100).toFixed(1)}%
                  {selectedFlow.isLowConfidence ? ' (Below 65% Gate)' : ' (Verified)'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-secondary)]">Model Checkpoint</span>
                <span className="font-mono font-semibold text-[var(--color-accent)]">
                  {selectedFlow.modelVersion}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-secondary)]">Applied Policy</span>
                <span className="font-mono text-[var(--color-text-primary)]">
                  {selectedFlow.policyClass} ({selectedFlow.dscpMark})
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-secondary)]">RTT / Jitter</span>
                <span className="font-mono tabular-nums text-[var(--color-text-primary)]">
                  {selectedFlow.rttMs} ms / {selectedFlow.jitterMs} ms
                </span>
              </div>
            </div>

            {/* Recent Rate Trajectory Bars */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-medium text-[var(--color-text-secondary)]">
                  Recent Flow Rate History (Mbps)
                </span>
                <span className="font-mono text-[var(--color-text-primary)] font-semibold">
                  {selectedFlow.currentRateMbps} Mbps
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2 items-end h-20 p-3 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
                {selectedFlow.rateHistoryMbps.map((val, idx) => {
                  const maxVal = Math.max(...selectedFlow.rateHistoryMbps, 1);
                  const heightPct = Math.max(12, Math.round((val / maxVal) * 100));
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end">
                      <div
                        className="w-full rounded-t bg-[var(--color-accent)]"
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">
                        {val}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Early-Flow Feature Metadata */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-primary)] mb-2">
                <Activity
                  className="w-3.5 h-3.5 text-[var(--color-accent)]"
                  aria-hidden="true"
                />
                <span>Extracted Early-Flow Header Features (Metadata Only)</span>
              </div>
              <div className="divide-y divide-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] px-3">
                {selectedFlow.features.map((feat) => (
                  <div key={feat.name} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono text-[var(--color-text-primary)]">{feat.name}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        Source: {feat.source}
                      </div>
                    </div>
                    <div className="font-mono tabular-nums text-right">
                      <span className="text-[var(--color-accent)] font-semibold">{feat.value}</span>{' '}
                      <span className="text-[var(--color-text-secondary)]">{feat.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SpotlightCard>
        )}
      </div>
    </div>
  );
};
