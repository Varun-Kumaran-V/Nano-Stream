import React, { useState } from 'react';
import { PauseCircle, PlayCircle } from 'lucide-react';
import { MetricPoint, ScenarioId } from '../types/qos';
import { useTheme } from '../context/ThemeContext';

interface NetworkTopology2DProps {
  currentPoint: MetricPoint;
  scenarioId: ScenarioId;
  isPlaying: boolean;
  reducedMotion: boolean;
  onTogglePlay: () => void;
}

interface SelectedNodeInfo {
  id: string;
  title: string;
  role: string;
  status: string;
  metrics: { label: string; value: string }[];
  notes: string;
}

export const NetworkTopology2D: React.FC<NetworkTopology2DProps> = ({
  currentPoint,
  isPlaying,
  reducedMotion,
  onTogglePlay,
}) => {
  const { tokens } = useTheme();
  const [selectedNodeId, setSelectedNodeId] = useState<string>('sdn-switch');

  const animateFlows = isPlaying && !reducedMotion;
  const isCapacityDrop = currentPoint.estimatedCapacityMbps < 70;
  const ct = currentPoint.classThroughputMbps;

  const workLaptopRate = Number((ct['Video Calls'] + ct['Interactive Browsing']).toFixed(1));
  const gamingRigRate = Number((ct['Gaming'] + ct['Bulk Downloads']).toFixed(1));
  const appleTvRate = Number(ct['Streaming'].toFixed(1));
  const nasVaultRate = Number((ct['Background Sync'] + ct['Unknown']).toFixed(1));

  const nodeDetails: Record<string, SelectedNodeInfo> = {
    'wan-link': {
      id: 'wan-link',
      title: 'ISP Last-Mile WAN Link',
      role: 'DOCSIS / GPON Broadband Uplink',
      status: isCapacityDrop ? 'CAPACITY CONTRACTED' : 'NOMINAL CAPACITY',
      metrics: [
        { label: 'Est. Capacity', value: `${currentPoint.estimatedCapacityMbps} Mbps` },
        { label: 'Observed Load', value: `${currentPoint.throughputMbps} Mbps` },
        { label: 'Packet Loss', value: `${currentPoint.packetLossPct}%` },
      ],
      notes: isCapacityDrop
        ? 'Simulated last-mile contention reduced available capacity; RTT gradient triggered shaper adaptation.'
        : 'Operating at nominal 120 Mbps simulated broadband capacity.',
    },
    'gateway-router': {
      id: 'gateway-router',
      title: 'Home Edge Gateway',
      role: 'Linux HTB Shaper & Passive RTT Prober',
      status: 'SHAPING ACTIVE (SIMULATED)',
      metrics: [
        { label: 'Shaper Ceiling', value: `${currentPoint.configuredShapingMbps} Mbps` },
        { label: 'Headroom Reserve', value: '5.0%' },
        { label: 'Median RTT', value: `${currentPoint.medianLatencyMs} ms` },
      ],
      notes:
        'Maintains 5% bandwidth headroom below estimated WAN capacity to prevent ISP modem bufferbloat.',
    },
    'sdn-switch': {
      id: 'sdn-switch',
      title: 'OpenFlow Switch + IntentQoS Queue',
      role: 'Ryu SDN Flow Classifier & 7-Class Scheduler',
      status: currentPoint.queueDelayMs > 20 ? 'QUEUE ELEVATED' : 'LOW QUEUE DELAY',
      metrics: [
        { label: 'Queue Delay', value: `${currentPoint.queueDelayMs} ms` },
        { label: 'Buffer Occupancy', value: `${currentPoint.queueDepthPct}%` },
        { label: 'Active Flows', value: `${currentPoint.activeFlows}` },
      ],
      notes:
        'Applies Nano-Stream early-flow classification (first 32 packets) and maps DSCP marks to HTB/FQ queues.',
    },
    'host-laptop': {
      id: 'host-laptop',
      title: 'Work-Laptop-Pro (192.168.1.14)',
      role: 'Tier-1 Video Calls (EF) + Browsing (AF21)',
      status: 'SLA PROTECTED',
      metrics: [
        { label: 'Current Rate', value: `${workLaptopRate} Mbps` },
        { label: 'Video Call Share', value: `${ct['Video Calls']} Mbps` },
        { label: 'Priority Tier', value: 'Tier 1 (High)' },
      ],
      notes:
        'WebRTC UDP RTP stream isolated from bulk TCP drops via dedicated high-priority leaf queue.',
    },
    'host-gaming': {
      id: 'host-gaming',
      title: 'Gaming-Desktop-Rig (192.168.1.22)',
      role: 'Tier-1 Gaming (CS4) + Tier-4 Bulk TCP (CS1)',
      status: 'MIXED FLOW ISOLATION',
      metrics: [
        { label: 'Combined Rate', value: `${gamingRigRate} Mbps` },
        { label: 'Gaming UDP', value: `${ct['Gaming']} Mbps` },
        { label: 'Bulk Download', value: `${ct['Bulk Downloads']} Mbps` },
      ],
      notes:
        'Demonstrates per-flow classification on the same host: UDP game packets bypass the throttled TCP bulk download queue.',
    },
    'host-tv': {
      id: 'host-tv',
      title: 'LivingRoom-AppleTV (192.168.1.35)',
      role: 'Tier-3 4K QUIC Streaming (AF31)',
      status: 'ASSURED BITRATE',
      metrics: [
        { label: 'Streaming Rate', value: `${appleTvRate} Mbps` },
        { label: 'Protocol', value: 'QUIC / UDP 443' },
        { label: 'Jitter', value: `${currentPoint.jitterMs} ms` },
      ],
      notes:
        'Receives assured medium priority so playback buffer stays healthy without starving real-time calls.',
    },
    'host-nas': {
      id: 'host-nas',
      title: 'Home-NAS-Vault & IoT (192.168.1.50)',
      role: 'Tier-5 Scavenger Backup (LE) + Unknown',
      status: isCapacityDrop ? 'CLAMPED BY POLICY' : 'SCAVENGER TIER',
      metrics: [
        { label: 'Current Rate', value: `${nasVaultRate} Mbps` },
        { label: 'Cloud Sync', value: `${ct['Background Sync']} Mbps` },
        { label: 'Unknown Flows', value: `${ct['Unknown']} Mbps` },
      ],
      notes:
        'Background cloud snapshots yield bandwidth immediately when WAN capacity contracts or Tier-1 intents activate.',
    },
  };

  const activeNode = nodeDetails[selectedNodeId] || nodeDetails['sdn-switch'];

  return (
    <div className="space-y-4" data-testid="network-topology-2d">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <span>Interactive 2D Topology</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-semibold text-[var(--color-accent)]">
              SIMULATED · DEMO
            </span>
          </div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
            Live Egress Path & Per-Host Queue Allocation
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-muted)]">
            {animateFlows ? 'Flow motion active' : 'Flow motion paused'}
          </span>
          <button
            type="button"
            onClick={onTogglePlay}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isPlaying ? (
              <>
                <PauseCircle className="w-3.5 h-3.5 text-[var(--color-warning)]" aria-hidden="true" />
                <span>Pause Flow</span>
              </>
            ) : (
              <>
                <PlayCircle className="w-3.5 h-3.5 text-[var(--color-success)]" aria-hidden="true" />
                <span>Resume Flow</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2D SVG Topology Canvas */}
      <div className="rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] p-4 overflow-x-auto">
        <svg
          viewBox="0 0 880 310"
          className="w-full min-w-[680px] h-auto select-none"
          role="img"
          aria-label="2D network topology connecting WAN link, Gateway Router, OpenFlow SDN Switch, and four client hosts"
        >
          <defs>
            <linearGradient id="linkPrimary" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={tokens.accent} stopOpacity="0.4" />
              <stop offset="100%" stopColor={tokens.chart2} stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="linkWarn" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={tokens.warning} stopOpacity="0.5" />
              <stop offset="100%" stopColor={tokens.danger} stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Subtle grid lines */}
          <g stroke={tokens.border} strokeWidth="1" strokeOpacity="0.65">
            <line x1="0" y1="60" x2="880" y2="60" />
            <line x1="0" y1="155" x2="880" y2="155" />
            <line x1="0" y1="250" x2="880" y2="250" />
            <line x1="180" y1="0" x2="180" y2="310" />
            <line x1="390" y1="0" x2="390" y2="310" />
            <line x1="610" y1="0" x2="610" y2="310" />
          </g>

          {/* Link 1: WAN -> Gateway */}
          <path
            d="M 145 155 L 265 155"
            stroke={isCapacityDrop ? 'url(#linkWarn)' : 'url(#linkPrimary)'}
            strokeWidth={isCapacityDrop ? 4 : 6}
            fill="none"
          />
          {animateFlows && (
            <path
              d="M 145 155 L 265 155"
              stroke={isCapacityDrop ? tokens.warning : tokens.accent}
              strokeWidth="2.5"
              strokeDasharray="6 10"
              fill="none"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="32"
                to="0"
                dur={isCapacityDrop ? '1.4s' : '0.7s'}
                repeatCount="indefinite"
              />
            </path>
          )}
          <text
            x="205"
            y="138"
            textAnchor="middle"
            fill={tokens.textSecondary}
            fontSize="11"
            fontFamily="JetBrains Mono"
          >
            {currentPoint.estimatedCapacityMbps} Mbps WAN
          </text>

          {/* Link 2: Gateway -> SDN Switch */}
          <path d="M 375 155 L 485 155" stroke="url(#linkPrimary)" strokeWidth="5" fill="none" />
          {animateFlows && (
            <path
              d="M 375 155 L 485 155"
              stroke={tokens.accent}
              strokeWidth="2.5"
              strokeDasharray="6 10"
              fill="none"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="32"
                to="0"
                dur="0.8s"
                repeatCount="indefinite"
              />
            </path>
          )}
          <text
            x="430"
            y="138"
            textAnchor="middle"
            fill={tokens.textSecondary}
            fontSize="11"
            fontFamily="JetBrains Mono"
          >
            Shaped {currentPoint.configuredShapingMbps}M
          </text>

          {/* Fan-out Links: SDN Switch -> 4 Client Hosts */}
          {[
            { y: 46, labelY: 36, color: tokens.chart3, rate: `${workLaptopRate} Mbps`, dur: '0.65s' },
            { y: 118, labelY: 108, color: tokens.chart1, rate: `${gamingRigRate} Mbps`, dur: '0.6s' },
            { y: 192, labelY: 182, color: tokens.chart4, rate: `${appleTvRate} Mbps`, dur: '0.85s' },
            { y: 264, labelY: 254, color: tokens.chart5, rate: `${nasVaultRate} Mbps`, dur: '1.35s' },
          ].map((branch, idx) => (
            <g key={idx}>
              <path
                d={`M 595 155 C 635 155, 645 ${branch.y}, 695 ${branch.y}`}
                stroke={tokens.borderStrong}
                strokeWidth="3"
                fill="none"
              />
              {animateFlows && (
                <path
                  d={`M 595 155 C 635 155, 645 ${branch.y}, 695 ${branch.y}`}
                  stroke={branch.color}
                  strokeWidth="2.2"
                  strokeDasharray="5 9"
                  fill="none"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="28"
                    to="0"
                    dur={branch.dur}
                    repeatCount="indefinite"
                  />
                </path>
              )}
              <rect
                x="628"
                y={branch.labelY - 10}
                width="58"
                height="14"
                rx="3"
                fill={tokens.bgSubtle}
                fillOpacity="0.94"
              />
              <text
                x="657"
                y={branch.labelY}
                textAnchor="middle"
                fill={tokens.textSecondary}
                fontSize="10"
                fontFamily="JetBrains Mono"
              >
                {branch.rate}
              </text>
            </g>
          ))}

          {/* Node 1: WAN */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Inspect ISP Last-Mile WAN Link"
            onClick={() => setSelectedNodeId('wan-link')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedNodeId('wan-link')}
            className="cursor-pointer"
          >
            <rect
              x="25"
              y="115"
              width="120"
              height="80"
              rx="10"
              fill={selectedNodeId === 'wan-link' ? tokens.accentSoft : tokens.surface}
              stroke={
                selectedNodeId === 'wan-link'
                  ? tokens.accent
                  : isCapacityDrop
                    ? tokens.warning
                    : tokens.borderStrong
              }
              strokeWidth={selectedNodeId === 'wan-link' ? '2' : '1.2'}
            />
            <text
              x="85"
              y="145"
              textAnchor="middle"
              fill={tokens.textPrimary}
              fontSize="12"
              fontWeight="600"
            >
              ISP / WAN
            </text>
            <text
              x="85"
              y="164"
              textAnchor="middle"
              fill={tokens.accent}
              fontSize="11"
              fontFamily="JetBrains Mono"
              fontWeight="600"
            >
              {currentPoint.throughputMbps} Mbps
            </text>
            <text x="85" y="181" textAnchor="middle" fill={tokens.textMuted} fontSize="10">
              {isCapacityDrop ? 'Bottleneck' : 'Nominal'}
            </text>
          </g>

          {/* Node 2: Gateway Router */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Inspect Home Edge Gateway"
            onClick={() => setSelectedNodeId('gateway-router')}
            onKeyDown={(e) =>
              (e.key === 'Enter' || e.key === ' ') && setSelectedNodeId('gateway-router')
            }
            className="cursor-pointer"
          >
            <rect
              x="265"
              y="115"
              width="110"
              height="80"
              rx="10"
              fill={selectedNodeId === 'gateway-router' ? tokens.accentSoft : tokens.surface}
              stroke={selectedNodeId === 'gateway-router' ? tokens.accent : tokens.borderStrong}
              strokeWidth={selectedNodeId === 'gateway-router' ? '2' : '1.2'}
            />
            <text
              x="320"
              y="145"
              textAnchor="middle"
              fill={tokens.textPrimary}
              fontSize="12"
              fontWeight="600"
            >
              Edge Gateway
            </text>
            <text
              x="320"
              y="164"
              textAnchor="middle"
              fill={tokens.success}
              fontSize="11"
              fontFamily="JetBrains Mono"
              fontWeight="600"
            >
              RTT {currentPoint.medianLatencyMs}ms
            </text>
            <text x="320" y="181" textAnchor="middle" fill={tokens.textMuted} fontSize="10">
              HTB Shaper
            </text>
          </g>

          {/* Node 3: SDN Switch / Queue */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Inspect OpenFlow Switch and IntentQoS Queue"
            onClick={() => setSelectedNodeId('sdn-switch')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedNodeId('sdn-switch')}
            className="cursor-pointer"
          >
            <rect
              x="485"
              y="115"
              width="110"
              height="80"
              rx="10"
              fill={selectedNodeId === 'sdn-switch' ? tokens.accentSoft : tokens.surface}
              stroke={selectedNodeId === 'sdn-switch' ? tokens.accent : tokens.borderStrong}
              strokeWidth={selectedNodeId === 'sdn-switch' ? '2' : '1.2'}
            />
            <text
              x="540"
              y="145"
              textAnchor="middle"
              fill={tokens.textPrimary}
              fontSize="12"
              fontWeight="600"
            >
              SDN + Queue
            </text>
            <text
              x="540"
              y="164"
              textAnchor="middle"
              fill={tokens.chart4}
              fontSize="11"
              fontFamily="JetBrains Mono"
              fontWeight="600"
            >
              Q-Delay {currentPoint.queueDelayMs}ms
            </text>
            <text x="540" y="181" textAnchor="middle" fill={tokens.textMuted} fontSize="10">
              Nano-Stream INT8
            </text>
          </g>

          {/* 4 Client Host Nodes */}
          {[
            {
              id: 'host-laptop',
              y: 18,
              name: 'Work-Laptop-Pro',
              sub: `Video + Web · ${workLaptopRate}M`,
              accent: tokens.chart3,
            },
            {
              id: 'host-gaming',
              y: 90,
              name: 'Gaming-Desktop-Rig',
              sub: `Game + Bulk · ${gamingRigRate}M`,
              accent: tokens.chart1,
            },
            {
              id: 'host-tv',
              y: 164,
              name: 'LivingRoom-AppleTV',
              sub: `4K Stream · ${appleTvRate}M`,
              accent: tokens.chart4,
            },
            {
              id: 'host-nas',
              y: 236,
              name: 'Home-NAS & IoT',
              sub: `Sync + Unk · ${nasVaultRate}M`,
              accent: tokens.chart5,
            },
          ].map((host) => (
            <g
              key={host.id}
              role="button"
              tabIndex={0}
              aria-label={`Inspect ${host.name}`}
              onClick={() => setSelectedNodeId(host.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedNodeId(host.id)}
              className="cursor-pointer"
            >
              <rect
                x="695"
                y={host.y}
                width="165"
                height="56"
                rx="9"
                fill={selectedNodeId === host.id ? tokens.accentSoft : tokens.surface}
                stroke={selectedNodeId === host.id ? tokens.accent : tokens.borderStrong}
                strokeWidth={selectedNodeId === host.id ? '2' : '1.2'}
              />
              <text
                x="710"
                y={host.y + 24}
                fill={tokens.textPrimary}
                fontSize="11.5"
                fontWeight="600"
              >
                {host.name}
              </text>
              <text
                x="710"
                y={host.y + 42}
                fill={host.accent}
                fontSize="10.5"
                fontFamily="JetBrains Mono"
                fontWeight="600"
              >
                {host.sub}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Interactive Node Inspector Strip */}
      <div className="rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-semibold text-[var(--color-accent)]">
            <span>SELECTED NODE: {activeNode.title}</span>
            <span aria-hidden="true">·</span>
            <span className="font-normal text-[var(--color-text-secondary)]">{activeNode.role}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--color-success)]">{activeNode.status}</span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {activeNode.notes}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-5 shrink-0">
          {activeNode.metrics.map((m) => (
            <div key={m.label} className="text-left lg:text-right">
              <div className="text-[11px] text-[var(--color-text-muted)]">{m.label}</div>
              <div className="text-sm font-mono font-semibold text-[var(--color-text-primary)] tabular-nums">
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick node selector buttons for keyboard & touch convenience */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-[var(--color-text-muted)] mr-1">Inspect node:</span>
        {[
          { id: 'wan-link', label: 'ISP WAN' },
          { id: 'gateway-router', label: 'Edge Gateway' },
          { id: 'sdn-switch', label: 'SDN Queue' },
          { id: 'host-laptop', label: 'Work Laptop' },
          { id: 'host-gaming', label: 'Gaming Rig' },
          { id: 'host-tv', label: 'AppleTV' },
          { id: 'host-nas', label: 'NAS & IoT' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedNodeId(item.id)}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              selectedNodeId === item.id
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] border border-[var(--color-accent)] font-semibold'
                : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};
