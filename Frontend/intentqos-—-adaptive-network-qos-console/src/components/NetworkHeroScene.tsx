import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Sliders, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface NetworkHeroSceneProps {
  reducedMotion: boolean;
}

type SceneMode = 'ADAPTIVE_LANES' | 'UNSHAPED_BOTTLENECK';

interface DeviceNodeSpec {
  id: string;
  label: string;
  sublabel: string;
  laneTier: string;
  x: number;
  y: number;
  colorKey: 'chart1' | 'chart3' | 'chart2' | 'chart4' | 'chart5';
  pathToCore: string;
  adaptiveRate: string;
  unshapedRate: string;
  adaptiveDur: string;
  unshapedDur: string;
}

const DEVICE_NODES: DeviceNodeSpec[] = [
  {
    id: 'node-video',
    label: 'Work Laptop',
    sublabel: 'WebRTC Video Call (EF)',
    laneTier: 'Tier 1 · Real-Time',
    x: 92,
    y: 72,
    colorKey: 'chart1',
    pathToCore: 'M 204 74 C 248 74, 265 170, 304 186',
    adaptiveRate: '14.8 Mbps · 13ms RTT',
    unshapedRate: '6.8 Mbps · 94ms Jitter',
    adaptiveDur: '1.5s',
    unshapedDur: '3.2s',
  },
  {
    id: 'node-gaming',
    label: 'Gaming PC',
    sublabel: 'UDP 128Hz Tickrate (CS4)',
    laneTier: 'Tier 1 · Low Jitter',
    x: 74,
    y: 158,
    colorKey: 'chart3',
    pathToCore: 'M 186 160 C 235 160, 262 184, 304 192',
    adaptiveRate: '6.4 Mbps · 1.9ms Jitter',
    unshapedRate: '2.9 Mbps · Packet Drops',
    adaptiveDur: '1.3s',
    unshapedDur: '3.5s',
  },
  {
    id: 'node-browsing',
    label: 'Study Tablet',
    sublabel: 'Interactive QUIC Web',
    laneTier: 'Tier 2 · Interactive',
    x: 82,
    y: 244,
    colorKey: 'chart2',
    pathToCore: 'M 194 246 C 238 246, 264 208, 304 198',
    adaptiveRate: '7.8 Mbps · 16ms RTT',
    unshapedRate: '4.1 Mbps · Stalled TLS',
    adaptiveDur: '1.8s',
    unshapedDur: '3.0s',
  },
  {
    id: 'node-streaming',
    label: 'Living Room TV',
    sublabel: '4K Media Stream (AF31)',
    laneTier: 'Tier 3 · Assured',
    x: 102,
    y: 330,
    colorKey: 'chart4',
    pathToCore: 'M 214 332 C 255 332, 272 228, 304 206',
    adaptiveRate: '13.2 Mbps · Buffered',
    unshapedRate: '9.4 Mbps · Rebuffering',
    adaptiveDur: '2.1s',
    unshapedDur: '2.6s',
  },
  {
    id: 'node-bulk',
    label: 'NAS & OS Sync',
    sublabel: 'Competing Bulk TCP',
    laneTier: 'Tier 4/5 · Scavenger',
    x: 124,
    y: 410,
    colorKey: 'chart5',
    pathToCore: 'M 236 412 C 274 412, 286 246, 304 214',
    adaptiveRate: '6.0 Mbps · Capped',
    unshapedRate: '28.0 Mbps · Flood',
    adaptiveDur: '3.4s',
    unshapedDur: '0.95s',
  },
];

export const NetworkHeroScene: React.FC<NetworkHeroSceneProps> = ({ reducedMotion }) => {
  const { theme, tokens } = useTheme();
  const [sceneMode, setSceneMode] = useState<SceneMode>('ADAPTIVE_LANES');
  const [scenePaused, setScenePaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleVisibility = () => {
      setTabHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const isAnimating = !reducedMotion && !scenePaused && !tabHidden;
  const isAdaptive = sceneMode === 'ADAPTIVE_LANES';

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Number((-ny * 4).toFixed(2)),
      ry: Number((nx * 5).toFixed(2)),
    });
  };

  const handlePointerLeave = () => {
    setTilt({ rx: 0, ry: 0 });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      data-testid="network-hero-scene"
      style={{ boxShadow: 'var(--shadow-card)' }}
      className="relative rounded-2xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] p-4 sm:p-5 flex flex-col justify-between min-h-[460px] select-none overflow-hidden transition-colors duration-150"
    >
      {/* Top Scene Bar: Concept Provenance & Interactive Mode Switcher */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-secondary)]">
          <span className="font-semibold text-[var(--color-accent)]">2.5D FLOW SCULPTURE</span>
          <span aria-hidden="true">·</span>
          <span>ILLUSTRATIVE CONCEPT (SIMULATED)</span>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Hero scene coordination mode"
            className="inline-flex items-center p-0.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]"
          >
            <button
              type="button"
              onClick={() => setSceneMode('ADAPTIVE_LANES')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isAdaptive
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Adaptive Lanes
            </button>
            <button
              type="button"
              onClick={() => setSceneMode('UNSHAPED_BOTTLENECK')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                !isAdaptive
                  ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] font-semibold border border-[var(--color-warning)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Unshaped Bottleneck
            </button>
          </div>

          <button
            type="button"
            onClick={() => setScenePaused(!scenePaused)}
            aria-label={isAnimating ? 'Pause hero scene motion' : 'Resume hero scene motion'}
            className="p-1.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
            title={isAnimating ? 'Pause decorative motion' : 'Resume decorative motion'}
          >
            {isAnimating ? (
              <Pause className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* 2.5D Isometric Network Sculpture Viewport */}
      <div
        className="relative my-2 flex-1 flex items-center justify-center"
        style={{
          transform: reducedMotion
            ? 'none'
            : `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <svg
          viewBox="0 0 640 465"
          className="w-full h-auto max-h-[380px]"
          role="img"
          aria-label="2.5D network sculpture showing five household traffic classes converging into an adaptive QoS gateway node and exiting through a constrained WAN uplink"
        >
          <defs>
            <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor={isAdaptive ? tokens.accent : tokens.danger}
                stopOpacity={theme === 'light' ? '0.12' : '0.16'}
              />
              <stop offset="100%" stopColor={tokens.bgSubtle} stopOpacity="0" />
            </radialGradient>
            <linearGradient id="planeGrid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop
                offset="0%"
                stopColor={tokens.accent}
                stopOpacity={theme === 'light' ? '0.06' : '0.07'}
              />
              <stop offset="100%" stopColor={tokens.chart2} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Isometric Depth Planes in Background */}
          <polygon
            points="320,34 610,165 340,445 45,305"
            fill="url(#planeGrid)"
            stroke={tokens.border}
            strokeWidth="1"
          />
          <polygon
            points="325,75 565,185 345,405 95,285"
            fill="none"
            stroke={tokens.borderStrong}
            strokeOpacity="0.65"
            strokeWidth="1"
            strokeDasharray="4 6"
          />

          {/* Soft Core Radial Illumination */}
          <circle cx="352" cy="198" r="115" fill="url(#coreGlow)" />

          {/* Curved Paths from 5 Device Nodes to Central Gateway */}
          {DEVICE_NODES.map((node) => {
            const dur = isAdaptive ? node.adaptiveDur : node.unshapedDur;
            const nodeColor = tokens[node.colorKey];
            const strokeW =
              !isAdaptive && node.id === 'node-bulk'
                ? 4.2
                : isAdaptive && (node.id === 'node-video' || node.id === 'node-gaming')
                  ? 3.2
                  : 2.2;
            return (
              <g key={node.id}>
                <path
                  d={node.pathToCore}
                  fill="none"
                  stroke={tokens.borderStrong}
                  strokeOpacity="0.55"
                  strokeWidth={strokeW}
                />
                <path
                  d={node.pathToCore}
                  fill="none"
                  stroke={nodeColor}
                  strokeOpacity={isAdaptive ? 0.85 : node.id === 'node-bulk' ? 0.95 : 0.45}
                  strokeWidth={strokeW}
                  strokeDasharray="5 9"
                >
                  {isAnimating && (
                    <animate
                      attributeName="stroke-dashoffset"
                      from="28"
                      to="0"
                      dur={dur}
                      repeatCount="indefinite"
                    />
                  )}
                </path>
              </g>
            );
          })}

          {/* Outbound Coordinated Lanes: Central Gateway -> WAN Uplink Node */}
          {[
            {
              lane: 'Priority EF/CS4 Lane',
              d: 'M 394 182 C 445 162, 485 162, 532 178',
              color: tokens.chart1,
              dur: isAdaptive ? '1.1s' : '2.8s',
            },
            {
              lane: 'Assured Interactive/Media Lane',
              d: 'M 394 198 C 445 198, 485 198, 532 198',
              color: tokens.chart3,
              dur: isAdaptive ? '1.5s' : '2.6s',
            },
            {
              lane: 'Shaped Scavenger Bulk Lane',
              d: 'M 394 214 C 445 234, 485 234, 532 218',
              color: isAdaptive ? tokens.chart2 : tokens.danger,
              dur: isAdaptive ? '2.8s' : '0.85s',
            },
          ].map((out, i) => (
            <g key={out.lane}>
              <path
                d={out.d}
                fill="none"
                stroke={tokens.borderStrong}
                strokeOpacity="0.55"
                strokeWidth={i === 2 && !isAdaptive ? 4.5 : 2.8}
              />
              <path
                d={out.d}
                fill="none"
                stroke={out.color}
                strokeWidth={i === 2 && !isAdaptive ? 3.8 : 2.4}
                strokeDasharray="6 8"
              >
                {isAnimating && (
                  <animate
                    attributeName="stroke-dashoffset"
                    from="28"
                    to="0"
                    dur={out.dur}
                    repeatCount="indefinite"
                  />
                )}
              </path>
            </g>
          ))}

          {/* Central 2.5D Layered Gateway / Switch Node */}
          <g>
            {/* Shadow base */}
            <rect
              x="306"
              y="154"
              width="92"
              height="96"
              rx="14"
              fill={tokens.bg}
              stroke={tokens.border}
              strokeWidth="1"
            />
            {/* Elevated core module */}
            <rect
              x="302"
              y="148"
              width="92"
              height="96"
              rx="14"
              fill={tokens.surface}
              stroke={isAdaptive ? tokens.accent : tokens.warning}
              strokeWidth="1.8"
            />
            <text
              x="348"
              y="174"
              textAnchor="middle"
              fill={tokens.textPrimary}
              fontSize="11.5"
              fontWeight="700"
            >
              IntentQoS Core
            </text>
            <text
              x="348"
              y="191"
              textAnchor="middle"
              fill={tokens.accent}
              fontSize="9.5"
              fontFamily="JetBrains Mono"
              fontWeight="600"
            >
              {isAdaptive ? 'HTB + FQ-CoDel' : 'Unshaped FIFO'}
            </text>
            <text
              x="348"
              y="208"
              textAnchor="middle"
              fill={isAdaptive ? tokens.success : tokens.danger}
              fontSize="9.5"
              fontFamily="JetBrains Mono"
              fontWeight="600"
            >
              {isAdaptive ? 'Q-Delay: 5.8ms' : 'Q-Delay: 64.0ms'}
            </text>
            <text
              x="348"
              y="226"
              textAnchor="middle"
              fill={tokens.textSecondary}
              fontSize="9"
              fontFamily="JetBrains Mono"
            >
              {isAdaptive ? '32-pkt INT8 Gate' : 'Tail-Drop Active'}
            </text>
          </g>

          {/* Right Side: WAN Bottleneck Pipe Node */}
          <g>
            <rect
              x="528"
              y="156"
              width="98"
              height="84"
              rx="12"
              fill={tokens.surface}
              stroke={isAdaptive ? tokens.borderStrong : tokens.danger}
              strokeWidth="1.5"
            />
            <text
              x="577"
              y="182"
              textAnchor="middle"
              fill={tokens.textPrimary}
              fontSize="11"
              fontWeight="600"
            >
              WAN Uplink
            </text>
            <text
              x="577"
              y="199"
              textAnchor="middle"
              fill={tokens.accent}
              fontSize="10"
              fontFamily="JetBrains Mono"
              fontWeight="600"
            >
              52 Mbps Pipe
            </text>
            <text
              x="577"
              y="217"
              textAnchor="middle"
              fill={isAdaptive ? tokens.success : tokens.warning}
              fontSize="9.5"
              fontFamily="JetBrains Mono"
              fontWeight="600"
            >
              {isAdaptive ? 'Shaped 49.0M' : 'Congested 100%'}
            </text>
          </g>

          {/* Left Side: 5 Household Device Nodes */}
          {DEVICE_NODES.map((node) => {
            const nodeColor = tokens[node.colorKey];
            return (
              <g key={node.id}>
                <rect
                  x={node.x - 62}
                  y={node.y - 26}
                  width="174"
                  height="52"
                  rx="10"
                  fill={tokens.surface}
                  stroke={tokens.borderStrong}
                  strokeWidth="1.2"
                />
                <circle cx={node.x - 46} cy={node.y - 6} r="4" fill={nodeColor} />
                <text
                  x={node.x - 36}
                  y={node.y - 2}
                  fill={tokens.textPrimary}
                  fontSize="10.5"
                  fontWeight="600"
                >
                  {node.label}
                </text>
                <text x={node.x - 46} y={node.y + 13} fill={tokens.textSecondary} fontSize="9.5">
                  {node.sublabel}
                </text>
                <text
                  x={node.x + 102}
                  y={node.y - 3}
                  textAnchor="end"
                  fill={
                    isAdaptive
                      ? tokens.success
                      : node.id === 'node-bulk'
                        ? tokens.warning
                        : tokens.danger
                  }
                  fontSize="9"
                  fontFamily="JetBrains Mono"
                  fontWeight="600"
                >
                  {isAdaptive
                    ? node.adaptiveRate.split('·')[0].trim()
                    : node.unshapedRate.split('·')[0].trim()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom Accessible Caption & State Summary */}
      <div className="relative z-10 pt-3 border-t border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
          {isAdaptive ? (
            <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] shrink-0" aria-hidden="true" />
          )}
          <span>
            {isAdaptive
              ? 'Coordinated mode: Bulk TCP is capped so Video Calls & Gaming keep sub-20ms simulated queue delay.'
              : 'Unshaped contention: Bulk TCP saturates the 52 Mbps bottleneck, delaying interactive UDP packets.'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-text-muted)] shrink-0">
          <Sliders className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden="true" />
          <span>{isAnimating ? 'Motion active' : 'Static view'}</span>
        </div>
      </div>
    </div>
  );
};
