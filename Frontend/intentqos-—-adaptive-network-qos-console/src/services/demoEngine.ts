import {
  BaselineProfileId,
  CapacityEstimate,
  DiagnosticLog,
  ExperimentRun,
  FlowRecord,
  MetricPoint,
  ModelEvaluation,
  PolicyEvent,
  QoSPolicy,
  ScenarioDefinition,
  ScenarioId,
  TrafficClass,
  UserIntent,
} from '../types/qos';

export const TRAFFIC_CLASSES: TrafficClass[] = [
  'Video Calls',
  'Gaming',
  'Interactive Browsing',
  'Streaming',
  'Bulk Downloads',
  'Background Sync',
  'Unknown',
];

export const SCENARIO_DEFINITIONS: ScenarioDefinition[] = [
  {
    id: 'STORY_8STEP',
    code: 'GUIDED',
    name: 'Guided 8-Step Competition Walkthrough',
    shortLabel: '8-Step Guided Story',
    description:
      'Repeatable end-to-end narrative: stable link → video & gaming start → bulk download competes → WAN capacity drop → congestion spike → adaptive QoS decision → recovery.',
    nominalWanMbps: 120,
    storySteps: [
      '1. Stable WAN capacity (120 Mbps) with baseline mixed traffic',
      '2. Latency-sensitive Video Call & Gaming session start',
      '3. Large OS image bulk download (78 Mbps demand) begins competing',
      '4. WAN link capacity drops suddenly from 120 Mbps to 52 Mbps',
      '5. Unshaped baseline queue delay & p95 latency rise sharply',
      '6. Adaptive IntentQoS policy throttles Bulk & Sync, protects interactive flows',
      '7. Interactive latency stabilizes (<18 ms) despite constrained WAN',
      '8. WAN capacity recovers to 120 Mbps; shaping ceilings smoothly relax',
    ],
  },
  {
    id: 'SCENARIO_A_STABLE',
    code: 'SCENARIO A',
    name: 'Stable Connection with Mixed Traffic',
    shortLabel: 'A · Stable Mixed Traffic',
    description: 'Nominal 120 Mbps home broadband link with balanced household traffic and low queueing delay.',
    nominalWanMbps: 120,
  },
  {
    id: 'SCENARIO_B_VIDEO_CALL',
    code: 'SCENARIO B',
    name: 'Video Call Session Starts',
    shortLabel: 'B · Video Call Starts',
    description: 'WebRTC 4K conference call starts on Work Laptop; classifier identifies bidirectional UDP RTP stream.',
    nominalWanMbps: 120,
  },
  {
    id: 'SCENARIO_C_GAMING',
    code: 'SCENARIO C',
    name: 'Gaming Session Starts',
    shortLabel: 'C · Gaming Session Starts',
    description: 'High-tickrate UDP game traffic begins on Gaming PC requiring sub-20ms jitter and zero packet loss.',
    nominalWanMbps: 120,
  },
  {
    id: 'SCENARIO_D_BULK_DOWNLOAD',
    code: 'SCENARIO D',
    name: 'Large Background Download Competes',
    shortLabel: 'D · Competing Bulk Download',
    description: 'Multi-connection TCP bulk transfer attempts to saturate the egress queue alongside active interactive flows.',
    nominalWanMbps: 100,
  },
  {
    id: 'SCENARIO_E_CAPACITY_DROP',
    code: 'SCENARIO E',
    name: 'WAN Capacity Drops Suddenly',
    shortLabel: 'E · WAN Capacity Drop',
    description: 'ISP last-mile contention reduces available WAN capacity from 120 Mbps to 48 Mbps within 4 seconds.',
    nominalWanMbps: 48,
  },
  {
    id: 'SCENARIO_F_BACKUP_CONGESTION',
    code: 'SCENARIO F',
    name: 'Background Cloud Backup Creates Congestion',
    shortLabel: 'F · Backup Congestion',
    description: 'NAS cloud snapshot upload and background sync saturate uplink/downlink ACK path, elevating tail latency.',
    nominalWanMbps: 75,
  },
  {
    id: 'SCENARIO_G_CAPACITY_RECOVERY',
    code: 'SCENARIO G',
    name: 'WAN Capacity Recovers',
    shortLabel: 'G · Capacity Recovery',
    description: 'WAN link restores from 48 Mbps to 120 Mbps; adaptive shaper steps up token bucket ceilings without bufferbloat.',
    nominalWanMbps: 120,
  },
];

/**
 * Deterministic pseudo-random generator (Mulberry32) so every scenario and chart is 100% repeatable.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Computes Jain's Fairness Index: (sum(x_i))^2 / (n * sum(x_i^2))
 * Bounded in [1/n, 1.0]. Pure deterministic math.
 */
export function computeJainsFairnessIndex(allocations: number[]): number {
  const valid = allocations.filter((v) => Number.isFinite(v) && v >= 0);
  if (valid.length === 0) return 1;
  const sum = valid.reduce((acc, v) => acc + v, 0);
  if (sum === 0) return 1;
  const sumSq = valid.reduce((acc, v) => acc + v * v, 0);
  const index = (sum * sum) / (valid.length * sumSq);
  return Math.min(1, Math.max(0, Number(index.toFixed(4))));
}

/**
 * Returns the active story step (0..7) for STORY_8STEP based on tick index.
 */
export function getStoryStepIndex(tick: number): number {
  return Math.min(7, Math.floor((tick % 48) / 6));
}

/**
 * Generates a single deterministic MetricPoint for a given scenario, tick index, and active intents/policies.
 */
export function generateMetricPoint(
  scenarioId: ScenarioId,
  tick: number,
  policies: QoSPolicy[],
  intents: UserIntent[],
  seed = 42026
): MetricPoint {
  const rng = seededRandom(seed + tick * 97 + scenarioId.length * 31);
  const noise = (rng() - 0.5) * 2;

  let estCapacity = 120;
  let shapingRate = 114;
  let videoMbps = 6.5;
  let gamingMbps = 3.2;
  let browsingMbps = 8.4;
  let streamingMbps = 22.0;
  let bulkMbps = 14.0;
  let syncMbps = 5.5;
  let unknownMbps = 2.4;
  let medianLat = 11.2;
  let p95Lat = 18.5;
  let p99Lat = 24.0;
  let jitter = 2.1;
  let queueDelay = 3.4;
  let lossPct = 0.02;
  let annotation: string | undefined;

  const hasActivePriorityIntent = intents.some((i) => i.status === 'ACTIVE');
  const bulkPolicy = policies.find((p) => p.trafficClass === 'Bulk Downloads');
  const bulkMaxCap = bulkPolicy && bulkPolicy.enabled ? bulkPolicy.maxRateMbps : 95;

  if (scenarioId === 'STORY_8STEP') {
    const step = getStoryStepIndex(tick);
    switch (step) {
      case 0: // Stable
        estCapacity = 120;
        shapingRate = 114;
        videoMbps = 4.2;
        gamingMbps = 1.8;
        streamingMbps = 18.5;
        bulkMbps = 11.0;
        medianLat = 10.8;
        p95Lat = 16.4;
        annotation = tick % 6 === 0 ? 'Step 1: Nominal WAN (120 Mbps)' : undefined;
        break;
      case 1: // Video + Gaming start
        estCapacity = 120;
        shapingRate = 114;
        videoMbps = 14.8;
        gamingMbps = 6.4;
        streamingMbps = 24.0;
        bulkMbps = 12.0;
        medianLat = 11.9;
        p95Lat = 18.2;
        annotation = tick % 6 === 0 ? 'Step 2: Video Call + Gaming Identified' : undefined;
        break;
      case 2: // Bulk download starts
        estCapacity = 118;
        shapingRate = 112;
        videoMbps = 14.6;
        gamingMbps = 6.2;
        streamingMbps = 24.5;
        bulkMbps = Math.min(54.0, bulkMaxCap);
        syncMbps = 8.2;
        medianLat = 16.4;
        p95Lat = 31.0;
        queueDelay = 11.5;
        annotation = tick % 6 === 0 ? 'Step 3: Competing Bulk Transfer (54 Mbps)' : undefined;
        break;
      case 3: // WAN capacity drops suddenly
        estCapacity = 52;
        shapingRate = 49;
        videoMbps = 13.8;
        gamingMbps = 5.9;
        streamingMbps = 15.0;
        bulkMbps = 14.5;
        syncMbps = 3.5;
        medianLat = 34.5;
        p95Lat = 78.0;
        p99Lat = 96.0;
        jitter = 14.2;
        queueDelay = 48.0;
        lossPct = 1.35;
        annotation = tick % 6 === 0 ? 'Step 4: WAN Drop (120 → 52 Mbps)' : undefined;
        break;
      case 4: // Congestion spike before full clamping
        estCapacity = 50;
        shapingRate = 47.5;
        videoMbps = 14.2;
        gamingMbps = 6.1;
        streamingMbps = 14.0;
        bulkMbps = 11.2;
        syncMbps = 2.8;
        medianLat = 29.0;
        p95Lat = 64.0;
        p99Lat = 82.0;
        jitter = 9.8;
        queueDelay = 36.0;
        lossPct = 0.85;
        annotation = tick % 6 === 0 ? 'Step 5: Queue Delay Alert Triggered' : undefined;
        break;
      case 5: // Policy adaptation clamps bulk & sync
        estCapacity = 52;
        shapingRate = 49.0;
        videoMbps = 14.8;
        gamingMbps = 6.4;
        browsingMbps = 7.2;
        streamingMbps = 12.5;
        bulkMbps = Math.min(5.2, bulkMaxCap);
        syncMbps = 1.4;
        medianLat = 14.6;
        p95Lat = 23.4;
        p99Lat = 29.5;
        jitter = 3.1;
        queueDelay = 6.8;
        lossPct = 0.08;
        annotation = tick % 6 === 0 ? 'Step 6: IntentQoS Policy Enforced' : undefined;
        break;
      case 6: // Protected steady state under constrained WAN
        estCapacity = 54;
        shapingRate = 51.0;
        videoMbps = 15.0;
        gamingMbps = 6.5;
        browsingMbps = 7.8;
        streamingMbps = 13.2;
        bulkMbps = Math.min(6.0, bulkMaxCap);
        syncMbps = 1.5;
        medianLat = 13.2;
        p95Lat = 20.8;
        p99Lat = 26.1;
        jitter = 2.4;
        queueDelay = 5.1;
        lossPct = 0.04;
        annotation = tick % 6 === 0 ? 'Step 7: Interactive SLA Held (<21ms p95)' : undefined;
        break;
      case 7: // WAN Capacity Recovers
      default:
        estCapacity = 120;
        shapingRate = 114.0;
        videoMbps = 15.0;
        gamingMbps = 6.4;
        browsingMbps = 9.5;
        streamingMbps = 25.0;
        bulkMbps = Math.min(38.0, bulkMaxCap);
        syncMbps = 6.8;
        medianLat = 11.4;
        p95Lat = 17.6;
        p99Lat = 22.4;
        jitter = 1.9;
        queueDelay = 3.2;
        lossPct = 0.02;
        annotation = tick % 6 === 0 ? 'Step 8: WAN Capacity Recovered (120 Mbps)' : undefined;
        break;
    }
  } else if (scenarioId === 'SCENARIO_A_STABLE') {
    estCapacity = 120;
    shapingRate = 114;
    videoMbps = 5.5;
    gamingMbps = 2.4;
    browsingMbps = 9.2;
    streamingMbps = 21.0;
    bulkMbps = 12.5;
    syncMbps = 4.2;
    medianLat = 10.5;
    p95Lat = 16.8;
    p99Lat = 21.2;
    jitter = 1.8;
    queueDelay = 2.9;
    lossPct = 0.01;
  } else if (scenarioId === 'SCENARIO_B_VIDEO_CALL') {
    estCapacity = 120;
    shapingRate = 114;
    videoMbps = 18.4;
    gamingMbps = 2.2;
    browsingMbps = 8.8;
    streamingMbps = 19.5;
    bulkMbps = 14.0;
    medianLat = 11.8;
    p95Lat = 17.9;
    p99Lat = 23.0;
    jitter = 2.0;
    queueDelay = 3.6;
    lossPct = 0.02;
    annotation = tick % 10 === 0 ? '4K WebRTC Flow Prioritized (EF)' : undefined;
  } else if (scenarioId === 'SCENARIO_C_GAMING') {
    estCapacity = 120;
    shapingRate = 114;
    videoMbps = 6.2;
    gamingMbps = 9.6;
    browsingMbps = 7.4;
    streamingMbps = 20.2;
    bulkMbps = 11.0;
    medianLat = 9.8;
    p95Lat = 14.9;
    p99Lat = 18.4;
    jitter = 1.2;
    queueDelay = 2.1;
    lossPct = 0.0;
    annotation = tick % 10 === 0 ? 'Low-Jitter Gaming Queue Active' : undefined;
  } else if (scenarioId === 'SCENARIO_D_BULK_DOWNLOAD') {
    estCapacity = 100;
    shapingRate = 95;
    videoMbps = 11.5;
    gamingMbps = 5.4;
    browsingMbps = 7.5;
    streamingMbps = 18.0;
    bulkMbps = Math.min(44.0, bulkMaxCap);
    syncMbps = 6.0;
    medianLat = 15.2;
    p95Lat = 26.4;
    p99Lat = 34.0;
    jitter = 3.4;
    queueDelay = 8.9;
    lossPct = 0.06;
    annotation = tick % 8 === 0 ? 'Bulk TCP Capped at Policy Ceiling' : undefined;
  } else if (scenarioId === 'SCENARIO_E_CAPACITY_DROP') {
    estCapacity = 48;
    shapingRate = 45.5;
    videoMbps = 12.8;
    gamingMbps = 5.8;
    browsingMbps = 5.6;
    streamingMbps = 10.5;
    bulkMbps = Math.min(6.4, bulkMaxCap);
    syncMbps = 1.6;
    unknownMbps = 1.2;
    medianLat = 17.4;
    p95Lat = 29.8;
    p99Lat = 38.5;
    jitter = 3.9;
    queueDelay = 9.4;
    lossPct = 0.14;
    annotation = tick % 8 === 0 ? 'Shaper Adapted to 45.5 Mbps Ceiling' : undefined;
  } else if (scenarioId === 'SCENARIO_F_BACKUP_CONGESTION') {
    estCapacity = 75;
    shapingRate = 71;
    videoMbps = 10.4;
    gamingMbps = 4.8;
    browsingMbps = 6.2;
    streamingMbps = 16.0;
    bulkMbps = 12.0;
    syncMbps = 17.8;
    medianLat = 19.6;
    p95Lat = 35.2;
    p99Lat = 44.1;
    jitter = 4.6;
    queueDelay = 13.8;
    lossPct = 0.19;
    annotation = tick % 8 === 0 ? 'Cloud Backup Throttled to Scavenger Tier' : undefined;
  } else if (scenarioId === 'SCENARIO_G_CAPACITY_RECOVERY') {
    const recoveryProgress = Math.min(1, (tick % 20) / 14);
    estCapacity = Math.round(48 + 72 * recoveryProgress);
    shapingRate = Math.round(estCapacity * 0.95 * 10) / 10;
    videoMbps = 13.5;
    gamingMbps = 5.8;
    browsingMbps = 8.4;
    streamingMbps = 14 + 10 * recoveryProgress;
    bulkMbps = Math.min(8 + 26 * recoveryProgress, bulkMaxCap);
    syncMbps = 2 + 4 * recoveryProgress;
    medianLat = 16.5 - 5.2 * recoveryProgress;
    p95Lat = 28.0 - 10.4 * recoveryProgress;
    p99Lat = 35.0 - 12.0 * recoveryProgress;
    jitter = 3.6 - 1.6 * recoveryProgress;
    queueDelay = 8.2 - 5.0 * recoveryProgress;
    lossPct = Number((0.12 * (1 - recoveryProgress) + 0.01).toFixed(2));
    annotation = tick % 8 === 0 ? 'Capacity Step-Up Probe Confirmed' : undefined;
  }

  if (hasActivePriorityIntent) {
    medianLat = Math.max(8.2, medianLat * 0.86);
    p95Lat = Math.max(12.5, p95Lat * 0.84);
    jitter = Math.max(1.0, jitter * 0.82);
  }

  const classThroughputMbps: Record<TrafficClass, number> = {
    'Video Calls': Math.max(0.5, Number((videoMbps + noise * 0.4).toFixed(1))),
    Gaming: Math.max(0.4, Number((gamingMbps + noise * 0.25).toFixed(1))),
    'Interactive Browsing': Math.max(0.8, Number((browsingMbps + noise * 0.5).toFixed(1))),
    Streaming: Math.max(1.5, Number((streamingMbps + noise * 0.7).toFixed(1))),
    'Bulk Downloads': Math.max(0.5, Number((bulkMbps + noise * 0.9).toFixed(1))),
    'Background Sync': Math.max(0.3, Number((syncMbps + noise * 0.3).toFixed(1))),
    Unknown: Math.max(0.2, Number((unknownMbps + noise * 0.15).toFixed(1))),
  };

  const rawSum = Object.values(classThroughputMbps).reduce((a, b) => a + b, 0);
  const throughputMbps = Number(Math.min(estCapacity * 0.98, rawSum).toFixed(1));
  const utilizationPct = Number(Math.min(99.4, (throughputMbps / estCapacity) * 100).toFixed(1));
  const queueDepthPct = Number(Math.min(96, Math.max(4, queueDelay * 1.6 + noise * 1.2)).toFixed(1));

  // Format deterministic timestamp relative to 14:20:00 UTC
  const baseSeconds = 14 * 3600 + 20 * 60 + tick * 5;
  const hh = String(Math.floor(baseSeconds / 3600) % 24).padStart(2, '0');
  const mm = String(Math.floor((baseSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(baseSeconds % 60).padStart(2, '0');

  return {
    timestamp: `${hh}:${mm}:${ss}`,
    elapsedSec: tick * 5,
    estimatedCapacityMbps: Number(estCapacity.toFixed(1)),
    configuredShapingMbps: Number(shapingRate.toFixed(1)),
    throughputMbps,
    medianLatencyMs: Number(Math.max(6, medianLat + noise * 0.6).toFixed(1)),
    p95LatencyMs: Number(Math.max(11, p95Lat + noise * 1.1).toFixed(1)),
    p99LatencyMs: Number(Math.max(15, p99Lat + noise * 1.4).toFixed(1)),
    jitterMs: Number(Math.max(0.8, jitter + noise * 0.25).toFixed(1)),
    queueDelayMs: Number(Math.max(1.2, queueDelay + noise * 0.5).toFixed(1)),
    queueDepthPct,
    packetLossPct: Number(Math.max(0, lossPct + noise * 0.01).toFixed(2)),
    utilizationPct,
    activeFlows: scenarioId === 'SCENARIO_A_STABLE' ? 14 : 18 + (tick % 4),
    classThroughputMbps,
    annotation,
    provenance: 'SIMULATED_DEMO',
  };
}

export function generateTimeSeries(
  scenarioId: ScenarioId,
  currentTick: number,
  windowPoints: number,
  policies: QoSPolicy[],
  intents: UserIntent[]
): MetricPoint[] {
  const startTick = Math.max(0, currentTick - windowPoints + 1);
  const series: MetricPoint[] = [];
  for (let t = startTick; t <= currentTick; t++) {
    series.push(generateMetricPoint(scenarioId, t, policies, intents));
  }
  return series;
}

export const INITIAL_POLICIES: QoSPolicy[] = [
  {
    id: 'pol-video',
    trafficClass: 'Video Calls',
    priorityTier: 1,
    minSharePct: 25,
    maxRateMbps: 45,
    targetLatencyMs: 20,
    queueDiscipline: 'HTB-Priority',
    enabled: true,
    lastChanged: '14:15:00 UTC',
    provenance: 'SIMULATED_DEMO',
  },
  {
    id: 'pol-gaming',
    trafficClass: 'Gaming',
    priorityTier: 1,
    minSharePct: 15,
    maxRateMbps: 25,
    targetLatencyMs: 15,
    queueDiscipline: 'HTB-Priority',
    enabled: true,
    lastChanged: '14:15:00 UTC',
    provenance: 'SIMULATED_DEMO',
  },
  {
    id: 'pol-browsing',
    trafficClass: 'Interactive Browsing',
    priorityTier: 2,
    minSharePct: 20,
    maxRateMbps: 60,
    targetLatencyMs: 35,
    queueDiscipline: 'FQ-CoDel-Simulated',
    enabled: true,
    lastChanged: '14:15:00 UTC',
    provenance: 'SIMULATED_DEMO',
  },
  {
    id: 'pol-streaming',
    trafficClass: 'Streaming',
    priorityTier: 3,
    minSharePct: 20,
    maxRateMbps: 65,
    targetLatencyMs: 60,
    queueDiscipline: 'FQ-CoDel-Simulated',
    enabled: true,
    lastChanged: '14:15:00 UTC',
    provenance: 'SIMULATED_DEMO',
  },
  {
    id: 'pol-bulk',
    trafficClass: 'Bulk Downloads',
    priorityTier: 4,
    minSharePct: 10,
    maxRateMbps: 42,
    targetLatencyMs: 150,
    queueDiscipline: 'DRR-Fair',
    enabled: true,
    lastChanged: '14:18:10 UTC',
    provenance: 'SIMULATED_DEMO',
  },
  {
    id: 'pol-sync',
    trafficClass: 'Background Sync',
    priorityTier: 5,
    minSharePct: 5,
    maxRateMbps: 18,
    targetLatencyMs: 250,
    queueDiscipline: 'DRR-Fair',
    enabled: true,
    lastChanged: '14:18:10 UTC',
    provenance: 'SIMULATED_DEMO',
  },
  {
    id: 'pol-unknown',
    trafficClass: 'Unknown',
    priorityTier: 4,
    minSharePct: 5,
    maxRateMbps: 20,
    targetLatencyMs: 100,
    queueDiscipline: 'FQ-CoDel-Simulated',
    enabled: true,
    lastChanged: '14:15:00 UTC',
    provenance: 'SIMULATED_DEMO',
  },
];

export const INITIAL_INTENTS: UserIntent[] = [
  {
    id: 'intent-zoom-protect',
    name: 'Protect Work Laptop Video Call SLA',
    trafficClass: 'Video Calls',
    priorityTier: 1,
    minFloorMbps: 15,
    maxCeilingMbps: 40,
    targetLatencyMs: 18,
    durationMinutes: 45,
    remainingSeconds: 2140,
    status: 'ACTIVE',
    rationale: 'Ensure bidirectional RTP audio/video stability during ISP capacity fluctuations.',
    createdAt: '14:12:00 UTC',
    provenance: 'SIMULATED_DEMO',
  },
  {
    id: 'intent-gaming-lowjitter',
    name: 'Low-Jitter Competitive Gaming Session',
    trafficClass: 'Gaming',
    priorityTier: 1,
    minFloorMbps: 8,
    maxCeilingMbps: 20,
    targetLatencyMs: 14,
    durationMinutes: 60,
    remainingSeconds: 3180,
    status: 'ACTIVE',
    rationale: 'Isolate high-tickrate UDP packets from bulk TCP bufferbloat on shared gateway queue.',
    createdAt: '14:16:30 UTC',
    provenance: 'SIMULATED_DEMO',
  },
];

export function generateFlowsForPoint(point: MetricPoint): FlowRecord[] {
  const ct = point.classThroughputMbps;
  const ts = `${point.timestamp} UTC`;

  return [
    {
      id: 'flw-901a-webrtc',
      sourceEndpoint: '192.168.1.14:54302',
      destinationEndpoint: 'media-sjc04.conf-edge.net:3478',
      clientHostname: 'Work-Laptop-Pro',
      protocol: 'UDP',
      currentRateMbps: Number((ct['Video Calls'] * 0.72).toFixed(2)),
      bytesTransferred: 184_520_100 + point.elapsedSec * 920_000,
      packetsTransferred: 198_410 + point.elapsedSec * 980,
      predictedClass: 'Video Calls',
      confidence: 0.96,
      isLowConfidence: false,
      policyClass: 'Tier-1 Interactive EF',
      dscpMark: 'EF (46)',
      rttMs: Number((point.medianLatencyMs * 0.92).toFixed(1)),
      jitterMs: Number((point.jitterMs * 0.78).toFixed(1)),
      status: 'PRIORITIZED',
      lastSeen: ts,
      modelVersion: 'nano-stream-int8-v1.4.2',
      provenance: 'SIMULATED_DEMO',
      rateHistoryMbps: [8.4, 9.2, 10.1, 10.6, 10.4, Number((ct['Video Calls'] * 0.72).toFixed(1))],
      features: [
        { name: 'mean_pkt_len', value: '892', unit: 'bytes', source: 'first-32-pkts' },
        { name: 'iat_std_dev', value: '3.4', unit: 'ms', source: 'first-32-pkts' },
        { name: 'udp_bidirectional_ratio', value: '0.94', unit: 'ratio', source: 'flow-header' },
        { name: 'burst_periodicity', value: '16.6', unit: 'ms (60fps)', source: 'temporal-window' },
      ],
    },
    {
      id: 'flw-902b-game',
      sourceEndpoint: '192.168.1.22:27015',
      destinationEndpoint: 'val-ap-east-1.gamesvr.io:7002',
      clientHostname: 'Gaming-Desktop-Rig',
      protocol: 'UDP',
      currentRateMbps: Number(ct['Gaming'].toFixed(2)),
      bytesTransferred: 64_120_800 + point.elapsedSec * 410_000,
      packetsTransferred: 312_900 + point.elapsedSec * 1540,
      predictedClass: 'Gaming',
      confidence: 0.98,
      isLowConfidence: false,
      policyClass: 'Tier-1 Real-Time CS4',
      dscpMark: 'CS4 (32)',
      rttMs: Number((point.medianLatencyMs * 0.85).toFixed(1)),
      jitterMs: Number((point.jitterMs * 0.65).toFixed(1)),
      status: 'PRIORITIZED',
      lastSeen: ts,
      modelVersion: 'nano-stream-int8-v1.4.2',
      provenance: 'SIMULATED_DEMO',
      rateHistoryMbps: [4.8, 5.2, 5.9, 6.1, 6.0, Number(ct['Gaming'].toFixed(1))],
      features: [
        { name: 'mean_pkt_len', value: '168', unit: 'bytes', source: 'first-32-pkts' },
        { name: 'iat_mean', value: '7.8', unit: 'ms (128Hz)', source: 'first-32-pkts' },
        { name: 'iat_variance', value: '0.42', unit: 'ms²', source: 'first-32-pkts' },
        { name: 'payload_entropy', value: 'not-inspected', unit: 'header-only', source: 'privacy-guard' },
      ],
    },
    {
      id: 'flw-903c-stream',
      sourceEndpoint: '192.168.1.35:49811',
      destinationEndpoint: 'cdn-ash-09.video-edge.net:443',
      clientHostname: 'LivingRoom-AppleTV',
      protocol: 'QUIC',
      currentRateMbps: Number((ct['Streaming'] * 0.78).toFixed(2)),
      bytesTransferred: 1_420_890_000 + point.elapsedSec * 2_100_000,
      packetsTransferred: 1_054_200 + point.elapsedSec * 1600,
      predictedClass: 'Streaming',
      confidence: 0.93,
      isLowConfidence: false,
      policyClass: 'Tier-3 Assured AF31',
      dscpMark: 'AF31 (26)',
      rttMs: Number((point.medianLatencyMs * 1.05).toFixed(1)),
      jitterMs: Number((point.jitterMs * 1.1).toFixed(1)),
      status: 'ACTIVE',
      lastSeen: ts,
      modelVersion: 'nano-stream-int8-v1.4.2',
      provenance: 'SIMULATED_DEMO',
      rateHistoryMbps: [14.2, 16.0, 17.5, 16.8, 15.9, Number((ct['Streaming'] * 0.78).toFixed(1))],
      features: [
        { name: 'mean_pkt_len', value: '1340', unit: 'bytes', source: 'first-32-pkts' },
        { name: 'chunk_on_off_cycle', value: '2.0', unit: 'seconds', source: 'temporal-window' },
        { name: 'downlink_asymmetry', value: '0.97', unit: 'ratio', source: 'flow-header' },
      ],
    },
    {
      id: 'flw-904d-bulk',
      sourceEndpoint: '192.168.1.22:58104',
      destinationEndpoint: 'mirror-sin.ubuntu-archive.org:443',
      clientHostname: 'Gaming-Desktop-Rig',
      protocol: 'TCP',
      currentRateMbps: Number(ct['Bulk Downloads'].toFixed(2)),
      bytesTransferred: 4_890_120_000 + point.elapsedSec * 3_400_000,
      packetsTransferred: 3_340_100 + point.elapsedSec * 2300,
      predictedClass: 'Bulk Downloads',
      confidence: 0.95,
      isLowConfidence: false,
      policyClass: 'Tier-4 Controlled Bulk',
      dscpMark: 'CS1 (8)',
      rttMs: Number((point.medianLatencyMs * 1.45).toFixed(1)),
      jitterMs: Number((point.jitterMs * 1.65).toFixed(1)),
      status: 'SHAPED',
      lastSeen: ts,
      modelVersion: 'nano-stream-int8-v1.4.2',
      provenance: 'SIMULATED_DEMO',
      rateHistoryMbps: [38.0, 42.5, 28.0, 14.2, 8.5, Number(ct['Bulk Downloads'].toFixed(1))],
      features: [
        { name: 'mss_full_frame_ratio', value: '0.99', unit: 'ratio', source: 'first-32-pkts' },
        { name: 'iat_mean', value: '0.28', unit: 'ms', source: 'first-32-pkts' },
        { name: 'tcp_window_scale', value: '8', unit: 'shift', source: 'syn-header' },
      ],
    },
    {
      id: 'flw-905e-web',
      sourceEndpoint: '192.168.1.14:61029',
      destinationEndpoint: 'edge-api.docs-workspace.com:443',
      clientHostname: 'Work-Laptop-Pro',
      protocol: 'QUIC',
      currentRateMbps: Number(ct['Interactive Browsing'].toFixed(2)),
      bytesTransferred: 92_450_000 + point.elapsedSec * 520_000,
      packetsTransferred: 108_300 + point.elapsedSec * 610,
      predictedClass: 'Interactive Browsing',
      confidence: 0.89,
      isLowConfidence: false,
      policyClass: 'Tier-2 Interactive AF21',
      dscpMark: 'AF21 (18)',
      rttMs: Number(point.medianLatencyMs.toFixed(1)),
      jitterMs: Number(point.jitterMs.toFixed(1)),
      status: 'ACTIVE',
      lastSeen: ts,
      modelVersion: 'nano-stream-int8-v1.4.2',
      provenance: 'SIMULATED_DEMO',
      rateHistoryMbps: [6.4, 7.8, 8.2, 7.9, 8.1, Number(ct['Interactive Browsing'].toFixed(1))],
      features: [
        { name: 'mean_pkt_len', value: '612', unit: 'bytes', source: 'first-32-pkts' },
        { name: 'burst_duration', value: '185', unit: 'ms', source: 'temporal-window' },
      ],
    },
    {
      id: 'flw-906f-sync',
      sourceEndpoint: '192.168.1.50:44910',
      destinationEndpoint: 's3-ap-southeast-1.cloud-vault.net:443',
      clientHostname: 'Home-NAS-Vault',
      protocol: 'TCP',
      currentRateMbps: Number(ct['Background Sync'].toFixed(2)),
      bytesTransferred: 940_120_000 + point.elapsedSec * 610_000,
      packetsTransferred: 712_000 + point.elapsedSec * 450,
      predictedClass: 'Background Sync',
      confidence: 0.87,
      isLowConfidence: false,
      policyClass: 'Tier-5 Scavenger LE',
      dscpMark: 'LE (1)',
      rttMs: Number((point.medianLatencyMs * 1.55).toFixed(1)),
      jitterMs: Number((point.jitterMs * 1.7).toFixed(1)),
      status: 'SHAPED',
      lastSeen: ts,
      modelVersion: 'nano-stream-int8-v1.4.2',
      provenance: 'SIMULATED_DEMO',
      rateHistoryMbps: [9.5, 11.2, 6.4, 3.8, 2.4, Number(ct['Background Sync'].toFixed(1))],
      features: [
        { name: 'uplink_downlink_ratio', value: '3.42', unit: 'ratio', source: 'flow-header' },
        { name: 'mean_pkt_len', value: '1290', unit: 'bytes', source: 'first-32-pkts' },
      ],
    },
    {
      id: 'flw-907g-unknown',
      sourceEndpoint: '192.168.1.68:51902',
      destinationEndpoint: '198.51.100.84:8843',
      clientHostname: 'IoT-Bridge-Hub',
      protocol: 'UDP',
      currentRateMbps: Number(ct['Unknown'].toFixed(2)),
      bytesTransferred: 18_420_000 + point.elapsedSec * 140_000,
      packetsTransferred: 41_900 + point.elapsedSec * 310,
      predictedClass: 'Unknown',
      confidence: 0.44,
      isLowConfidence: true,
      policyClass: 'Default Safe Best-Effort',
      dscpMark: 'DF (0)',
      rttMs: Number((point.medianLatencyMs * 1.15).toFixed(1)),
      jitterMs: Number((point.jitterMs * 1.2).toFixed(1)),
      status: 'OBSERVED',
      lastSeen: ts,
      modelVersion: 'nano-stream-int8-v1.4.2',
      provenance: 'SIMULATED_DEMO',
      rateHistoryMbps: [1.8, 2.1, 1.9, 2.3, 2.0, Number(ct['Unknown'].toFixed(1))],
      features: [
        { name: 'confidence_threshold_check', value: '0.44 < 0.65', unit: 'fallback', source: 'safety-gate' },
        { name: 'mean_pkt_len', value: '438', unit: 'bytes', source: 'first-32-pkts' },
        { name: 'iat_std_dev', value: '19.4', unit: 'ms', source: 'first-32-pkts' },
      ],
    },
    {
      id: 'flw-908h-webrtc-audio',
      sourceEndpoint: '192.168.1.14:54303',
      destinationEndpoint: 'media-sjc04.conf-edge.net:3478',
      clientHostname: 'Work-Laptop-Pro',
      protocol: 'UDP',
      currentRateMbps: Number((ct['Video Calls'] * 0.28).toFixed(2)),
      bytesTransferred: 38_100_000 + point.elapsedSec * 210_000,
      packetsTransferred: 142_000 + point.elapsedSec * 790,
      predictedClass: 'Video Calls',
      confidence: 0.61,
      isLowConfidence: true,
      policyClass: 'Tier-1 Interactive EF',
      dscpMark: 'EF (46)',
      rttMs: Number((point.medianLatencyMs * 0.9).toFixed(1)),
      jitterMs: Number((point.jitterMs * 0.72).toFixed(1)),
      status: 'PRIORITIZED',
      lastSeen: ts,
      modelVersion: 'nano-stream-int8-v1.4.2',
      provenance: 'SIMULATED_DEMO',
      rateHistoryMbps: [2.8, 3.1, 3.4, 3.6, 3.5, Number((ct['Video Calls'] * 0.28).toFixed(1))],
      features: [
        { name: 'confidence_note', value: '0.61 (Borderline Opus/UDP)', unit: 'score', source: 'classifier' },
        { name: 'mean_pkt_len', value: '214', unit: 'bytes', source: 'first-32-pkts' },
      ],
    },
  ];
}

export function generatePolicyEvents(scenarioId: ScenarioId, currentTick: number): PolicyEvent[] {
  const baseEvents: PolicyEvent[] = [
    {
      id: 'evt-01',
      timestamp: '14:20:05 UTC',
      stepIndex: 0,
      decision: 'Baseline HTB + FQ-CoDel Hierarchy Initialized',
      reason: 'WAN capacity estimated at 120.0 Mbps with 5% anti-bufferbloat headroom.',
      policyEffect: 'Global egress shaper set to 114.0 Mbps; 7 class queues active.',
      outcome: 'Median RTT 10.8 ms · Queue delay 3.1 ms (Simulated)',
      severity: 'INFO',
      provenance: 'SIMULATED_DEMO',
    },
    {
      id: 'evt-02',
      timestamp: '14:20:30 UTC',
      stepIndex: 1,
      decision: 'Prioritized Bidirectional WebRTC & Gaming UDP Flows',
      reason: 'Classifier identified flw-901a (0.96 conf) & flw-902b (0.98 conf) within first 32 packets.',
      policyEffect: 'Assigned DSCP EF (46) & CS4 (32); guaranteed 40% combined min share.',
      outcome: 'Gaming jitter stabilized at 1.9 ms (Simulated)',
      severity: 'ADAPTATION',
      provenance: 'SIMULATED_DEMO',
    },
    {
      id: 'evt-03',
      timestamp: '14:21:00 UTC',
      stepIndex: 2,
      decision: 'Detected Competing Multi-Stream Bulk TCP Transfer',
      reason: 'Flow flw-904d ramped to 54.0 Mbps; queue occupancy crossed 28% threshold.',
      policyEffect: 'Applied DRR fairness weight to Tier-4 Bulk Downloads; isolated interactive queues.',
      outcome: 'Prevented TCP burst from starving UDP audio/video (Simulated)',
      severity: 'ADAPTATION',
      provenance: 'SIMULATED_DEMO',
    },
    {
      id: 'evt-04',
      timestamp: '14:21:30 UTC',
      stepIndex: 3,
      decision: 'WAN Capacity Drop Detected (120 Mbps → 52 Mbps)',
      reason: 'Passive RTT gradient + packet-pair dispersion indicated last-mile bottleneck contraction.',
      policyEffect: 'Triggered emergency shaper recalibration down to 49.0 Mbps.',
      outcome: 'Transient p95 latency spike to 78.0 ms before queue drain (Simulated)',
      severity: 'CONGESTION',
      provenance: 'SIMULATED_DEMO',
    },
    {
      id: 'evt-05',
      timestamp: '14:22:15 UTC',
      stepIndex: 5,
      decision: 'Enforced Adaptive Intent Ceiling on Bulk & Background Sync',
      reason: 'Active user intents require <20 ms target latency for Video Calls & Gaming under 52 Mbps WAN.',
      policyEffect: 'Clamped Bulk Downloads to 5.2 Mbps & Background Sync to 1.4 Mbps.',
      outcome: 'p95 latency recovered from 78.0 ms → 20.8 ms in 4.2s (Simulated)',
      severity: 'ADAPTATION',
      provenance: 'SIMULATED_DEMO',
    },
    {
      id: 'evt-06',
      timestamp: '14:23:30 UTC',
      stepIndex: 7,
      decision: 'WAN Capacity Recovery Confirmed (52 Mbps → 120 Mbps)',
      reason: 'Queue delay remained <4 ms for 15s; step-up capacity probe validated full 120 Mbps link.',
      policyEffect: 'Relaxed global shaper to 114.0 Mbps and restored Bulk ceiling to 42.0 Mbps.',
      outcome: 'Jain’s fairness index improved to 0.91 across active classes (Simulated)',
      severity: 'RECOVERY',
      provenance: 'SIMULATED_DEMO',
    },
  ];

  if (scenarioId === 'STORY_8STEP') {
    const activeStep = getStoryStepIndex(currentTick);
    return baseEvents.filter((e) => e.stepIndex <= activeStep).reverse();
  }
  return baseEvents.slice().reverse();
}

export function deriveCapacityEstimate(point: MetricPoint, scenarioId: ScenarioId): CapacityEstimate {
  const isDrop = point.estimatedCapacityMbps < 70 || scenarioId === 'SCENARIO_E_CAPACITY_DROP';
  const isRecovering = scenarioId === 'SCENARIO_G_CAPACITY_RECOVERY';
  const isElevated = point.queueDelayMs > 12;

  return {
    timestamp: `${point.timestamp} UTC`,
    estimatedWanMbps: point.estimatedCapacityMbps,
    configuredShapingMbps: point.configuredShapingMbps,
    observedThroughputMbps: point.throughputMbps,
    headroomReservePct: 5.0,
    confidencePct: 91.5,
    errorBoundMbps: 3.2,
    congestionState: isDrop
      ? 'CAPACITY_DROP'
      : isRecovering
        ? 'RECOVERING'
        : isElevated
          ? 'ELEVATED_QUEUE'
          : 'NOMINAL',
    lastAdaptationReason: isDrop
      ? 'Shaper contracted to 95% of estimated 52 Mbps bottleneck to drain gateway queue.'
      : 'Token-bucket shaper tracking 95% of estimated WAN link capacity.',
    provenance: 'SIMULATED_DEMO',
  };
}

export const DEMO_EXPERIMENT_RUNS: Record<BaselineProfileId, ExperimentRun> = {
  NO_SHAPING: {
    id: 'run-sim-fifo-01',
    profileId: 'NO_SHAPING',
    profileName: 'No Shaping (Default FIFO Drop-Tail)',
    description: 'Illustrative simulated baseline representing an unshaped home router single FIFO queue.',
    isSimulatedBaseline: true,
    status: 'COMPLETED_SIMULATION',
    startTime: '2026-10-30 14:00:00 UTC',
    endTime: '2026-10-30 14:04:00 UTC',
    config: {
      scenarioId: 'STORY_8STEP',
      seed: 42026,
      durationSec: 240,
      wanCapacityMbps: 52,
      modelVersion: 'none (unclassified)',
      queueDiscipline: 'pfifo_fast (Simulated)',
    },
    metrics: {
      medianLatencyMs: 68.4,
      p95LatencyMs: 184.2,
      p99LatencyMs: 242.0,
      jitterMs: 28.5,
      packetLossPct: 3.42,
      jainsFairnessIndex: 0.46,
      recoveryTimeSec: 19.5,
      classifierMacroF1: 0,
      cpuOverheadPct: 1.2,
      memoryMb: 18,
      inferenceLatencyUs: 0,
      classThroughputMbps: {
        'Video Calls': 6.8,
        Gaming: 2.9,
        'Interactive Browsing': 4.1,
        Streaming: 9.4,
        'Bulk Downloads': 22.8,
        'Background Sync': 4.2,
        Unknown: 0.9,
      },
    },
    provenanceNote: 'Illustrative simulated baseline — not a live Linux kernel measurement.',
  },
  STATIC_QOS: {
    id: 'run-sim-static-02',
    profileId: 'STATIC_QOS',
    profileName: 'Static Port/DSCP QoS (Fixed 120 Mbps Ceiling)',
    description: 'Illustrative simulated static HTB rules configured for 120 Mbps without WAN capacity tracking.',
    isSimulatedBaseline: true,
    status: 'COMPLETED_SIMULATION',
    startTime: '2026-10-30 14:05:00 UTC',
    endTime: '2026-10-30 14:09:00 UTC',
    config: {
      scenarioId: 'STORY_8STEP',
      seed: 42026,
      durationSec: 240,
      wanCapacityMbps: 52,
      modelVersion: 'port-heuristic-v1',
      queueDiscipline: 'Static HTB (Simulated)',
    },
    metrics: {
      medianLatencyMs: 42.1,
      p95LatencyMs: 112.6,
      p99LatencyMs: 148.0,
      jitterMs: 16.4,
      packetLossPct: 1.85,
      jainsFairnessIndex: 0.61,
      recoveryTimeSec: 14.2,
      classifierMacroF1: 0.64,
      cpuOverheadPct: 2.1,
      memoryMb: 24,
      inferenceLatencyUs: 12,
      classThroughputMbps: {
        'Video Calls': 10.2,
        Gaming: 4.5,
        'Interactive Browsing': 5.4,
        Streaming: 11.2,
        'Bulk Downloads': 15.8,
        'Background Sync': 3.1,
        Unknown: 1.0,
      },
    },
    provenanceNote: 'Illustrative simulated baseline — static shaper fails when WAN drops below 120 Mbps.',
  },
  FQ_CODEL_SIM: {
    id: 'run-sim-fqcodel-03',
    profileId: 'FQ_CODEL_SIM',
    profileName: 'FQ-CoDel / CAKE-Style Baseline (Simulated Reference)',
    description: 'Simulated fair-queueing AQM baseline with fixed bandwidth configuration (did not run Linux CAKE in browser).',
    isSimulatedBaseline: true,
    status: 'COMPLETED_SIMULATION',
    startTime: '2026-10-30 14:10:00 UTC',
    endTime: '2026-10-30 14:14:00 UTC',
    config: {
      scenarioId: 'STORY_8STEP',
      seed: 42026,
      durationSec: 240,
      wanCapacityMbps: 52,
      modelVersion: 'flow-hash-only',
      queueDiscipline: 'FQ-CoDel Reference Model (Simulated)',
    },
    metrics: {
      medianLatencyMs: 21.8,
      p95LatencyMs: 46.5,
      p99LatencyMs: 62.1,
      jitterMs: 6.8,
      packetLossPct: 0.48,
      jainsFairnessIndex: 0.84,
      recoveryTimeSec: 7.8,
      classifierMacroF1: 0,
      cpuOverheadPct: 3.4,
      memoryMb: 32,
      inferenceLatencyUs: 0,
      classThroughputMbps: {
        'Video Calls': 11.8,
        Gaming: 5.4,
        'Interactive Browsing': 7.1,
        Streaming: 12.0,
        'Bulk Downloads': 10.4,
        'Background Sync': 3.2,
        Unknown: 1.2,
      },
    },
    provenanceNote: 'Illustrative simulated comparison — represents analytical FQ-CoDel behavior under capacity mismatch.',
  },
  DETERMINISTIC_ADAPTIVE: {
    id: 'run-sim-det-04',
    profileId: 'DETERMINISTIC_ADAPTIVE',
    profileName: 'Deterministic Capacity-Adaptive Shaper (No ML)',
    description: 'Simulated RTT-gradient capacity tracker with heuristic DSCP/port rules, without Nano-Stream ML classification.',
    isSimulatedBaseline: true,
    status: 'COMPLETED_SIMULATION',
    startTime: '2026-10-30 14:15:00 UTC',
    endTime: '2026-10-30 14:19:00 UTC',
    config: {
      scenarioId: 'STORY_8STEP',
      seed: 42026,
      durationSec: 240,
      wanCapacityMbps: 52,
      modelVersion: 'heuristic-dscp-v1',
      queueDiscipline: 'Adaptive HTB + FQ (Simulated)',
    },
    metrics: {
      medianLatencyMs: 17.2,
      p95LatencyMs: 31.4,
      p99LatencyMs: 41.8,
      jitterMs: 4.5,
      packetLossPct: 0.19,
      jainsFairnessIndex: 0.86,
      recoveryTimeSec: 5.4,
      classifierMacroF1: 0.71,
      cpuOverheadPct: 3.9,
      memoryMb: 38,
      inferenceLatencyUs: 18,
      classThroughputMbps: {
        'Video Calls': 13.1,
        Gaming: 5.9,
        'Interactive Browsing': 7.4,
        Streaming: 12.6,
        'Bulk Downloads': 8.2,
        'Background Sync': 2.5,
        Unknown: 1.4,
      },
    },
    provenanceNote: 'Illustrative simulated baseline — misses encrypted QUIC/UDP flows lacking standard ports.',
  },
  INTENT_QOS_PROPOSED: {
    id: 'run-sim-intentqos-05',
    profileId: 'INTENT_QOS_PROPOSED',
    profileName: 'Proposed IntentQoS Policy (Nano-Stream + Intent Engine)',
    description: 'Simulated full-stack IntentQoS combining early-flow Nano-Stream classification, capacity tracking, and active user intents.',
    isSimulatedBaseline: true,
    status: 'COMPLETED_SIMULATION',
    startTime: '2026-10-30 14:20:00 UTC',
    endTime: '2026-10-30 14:24:00 UTC',
    config: {
      scenarioId: 'STORY_8STEP',
      seed: 42026,
      durationSec: 240,
      wanCapacityMbps: 52,
      modelVersion: 'nano-stream-int8-v1.4.2',
      queueDiscipline: 'IntentQoS Adaptive HTB+FQ (Simulated)',
    },
    metrics: {
      medianLatencyMs: 13.2,
      p95LatencyMs: 20.8,
      p99LatencyMs: 26.1,
      jitterMs: 2.4,
      packetLossPct: 0.04,
      jainsFairnessIndex: 0.92,
      recoveryTimeSec: 3.1,
      classifierMacroF1: 0.934,
      cpuOverheadPct: 4.6,
      memoryMb: 46,
      inferenceLatencyUs: 142,
      classThroughputMbps: {
        'Video Calls': 15.0,
        Gaming: 6.5,
        'Interactive Browsing': 7.8,
        Streaming: 13.2,
        'Bulk Downloads': 6.0,
        'Background Sync': 1.5,
        Unknown: 1.2,
      },
    },
    provenanceNote: 'Simulated target profile for UI demonstration — requires Mininet/Ryu testbed run for empirical validation.',
  },
};

export const DEMO_MODEL_EVALUATION: ModelEvaluation = {
  modelName: 'Nano-Stream Early-Flow Classifier',
  modelVersion: 'nano-stream-int8-v1.4.2',
  artifactId: 'sha256:8f94c2e1b04a7d22e91c (checkpoint-epoch48-int8.onnx)',
  featureSchemaVersion: 'early-flow-32pkt-v2.1 (14 packet-length & IAT statistics)',
  classMappingVersion: 'home-broadband-7class-v1.0',
  quantizationState: 'INT8 Post-Training Quantized',
  datasetName: 'Offline Holdout Split — NanoStream-HomeMix-v2 (Simulated Reference)',
  evaluationDate: '2026-10-24 18:30 UTC',
  sampleCount: 14_000,
  overallAccuracy: 0.938,
  macroPrecision: 0.936,
  macroRecall: 0.932,
  macroF1: 0.934,
  modelSizeKb: 312,
  fp32SizeKb: 1180,
  inferenceLatencyP50Us: 142,
  inferenceLatencyP95Us: 218,
  inferenceLatencyP99Us: 295,
  fp32LatencyP50Us: 410,
  perClassMetrics: [
    { trafficClass: 'Video Calls', precision: 0.96, recall: 0.95, f1Score: 0.955, supportCount: 2200 },
    { trafficClass: 'Gaming', precision: 0.97, recall: 0.96, f1Score: 0.965, supportCount: 2100 },
    { trafficClass: 'Interactive Browsing', precision: 0.91, recall: 0.92, f1Score: 0.915, supportCount: 2400 },
    { trafficClass: 'Streaming', precision: 0.94, recall: 0.95, f1Score: 0.945, supportCount: 2300 },
    { trafficClass: 'Bulk Downloads', precision: 0.96, recall: 0.95, f1Score: 0.955, supportCount: 2000 },
    { trafficClass: 'Background Sync', precision: 0.90, recall: 0.89, f1Score: 0.895, supportCount: 1800 },
    { trafficClass: 'Unknown', precision: 0.91, recall: 0.90, f1Score: 0.905, supportCount: 1200 },
  ],
  confusionMatrix: {
    labels: [
      'Video Calls',
      'Gaming',
      'Interactive Browsing',
      'Streaming',
      'Bulk Downloads',
      'Background Sync',
      'Unknown',
    ],
    matrix: [
      [2090, 28, 34, 18, 4, 8, 18],
      [22, 2016, 26, 8, 2, 6, 20],
      [31, 18, 2208, 62, 18, 32, 31],
      [14, 6, 48, 2185, 24, 12, 11],
      [2, 0, 14, 28, 1900, 46, 10],
      [8, 4, 38, 19, 64, 1602, 65],
      [18, 14, 42, 16, 12, 18, 1080],
    ],
  },
  confidenceDistribution: [
    { bucket: '0.00 – 0.50 (Fallback Unknown)', offlineEvalPct: 4.2, demoObservedPct: 6.5 },
    { bucket: '0.50 – 0.65 (Low Confidence)', offlineEvalPct: 5.8, demoObservedPct: 8.0 },
    { bucket: '0.65 – 0.80 (Moderate)', offlineEvalPct: 14.5, demoObservedPct: 16.5 },
    { bucket: '0.80 – 0.90 (High)', offlineEvalPct: 28.0, demoObservedPct: 27.0 },
    { bucket: '0.90 – 1.00 (Very High)', offlineEvalPct: 47.5, demoObservedPct: 42.0 },
  ],
  provenanceNote:
    'Example offline holdout evaluation summary illustrating the Model Insights view. The current Ryu SDN prototype feeds synthetic features rather than live packet captures; do not cite these numbers as live network validation.',
};

export const INITIAL_DIAGNOSTIC_LOGS: DiagnosticLog[] = [
  {
    id: 'log-101',
    timestamp: '14:20:00.120 UTC',
    severity: 'INFO',
    component: 'DEMO_ENGINE',
    event: 'Initialized deterministic DemoDataProvider with seed=42026 (STORY_8STEP).',
    correlationId: 'sim-run-42026-01',
    mode: 'DEMO',
  },
  {
    id: 'log-102',
    timestamp: '14:20:05.402 UTC',
    severity: 'INFO',
    component: 'POLICY_SIM',
    event: 'Loaded 7 baseline traffic class policies and 2 active user intents.',
    correlationId: 'sim-run-42026-02',
    mode: 'DEMO',
  },
  {
    id: 'log-103',
    timestamp: '14:21:30.008 UTC',
    severity: 'WARN',
    component: 'DEMO_ENGINE',
    event: 'Simulated WAN capacity step-down triggered (120.0 Mbps -> 52.0 Mbps).',
    correlationId: 'sim-run-42026-04',
    mode: 'DEMO',
  },
  {
    id: 'log-104',
    timestamp: '14:22:15.190 UTC',
    severity: 'INFO',
    component: 'SDN_ADAPTER',
    event: 'Simulated OpenFlow meter-band update for Bulk Downloads (maxRate=5.2 Mbps).',
    correlationId: 'sim-run-42026-05',
    mode: 'DEMO',
  },
];

export interface IntentFormInput {
  name: string;
  trafficClass: TrafficClass;
  priorityTier: 1 | 2 | 3;
  minFloorMbps: number;
  maxCeilingMbps: number;
  targetLatencyMs: number;
  durationMinutes: number;
  rationale: string;
}

export function validateIntentInput(input: IntentFormInput): string | null {
  if (!input.name || input.name.trim().length < 4) {
    return 'Intent name must be at least 4 characters.';
  }
  if (input.minFloorMbps < 1 || input.minFloorMbps > 100) {
    return 'Minimum bandwidth floor must be between 1 and 100 Mbps.';
  }
  if (input.maxCeilingMbps < input.minFloorMbps || input.maxCeilingMbps > 120) {
    return 'Maximum rate ceiling must be ≥ minimum floor and ≤ 120 Mbps.';
  }
  if (input.targetLatencyMs < 5 || input.targetLatencyMs > 250) {
    return 'Target latency SLA must be between 5 ms and 250 ms.';
  }
  if (input.durationMinutes < 5 || input.durationMinutes > 240) {
    return 'Expiration window must be between 5 and 240 minutes.';
  }
  if (!input.rationale || input.rationale.trim().length < 8) {
    return 'Please provide a brief operational rationale (at least 8 characters).';
  }
  return null;
}

export function formatExperimentsCsv(runs: ExperimentRun[]): string {
  const headers = [
    'run_id',
    'profile_id',
    'profile_name',
    'is_simulated_baseline',
    'seed',
    'wan_capacity_mbps',
    'median_latency_ms',
    'p95_latency_ms',
    'p99_latency_ms',
    'jitter_ms',
    'packet_loss_pct',
    'jains_fairness_index',
    'recovery_time_sec',
    'provenance_note',
  ];
  const rows = runs.map((r) => [
    r.id,
    r.profileId,
    `"${r.profileName.replace(/"/g, '""')}"`,
    String(r.isSimulatedBaseline),
    String(r.config.seed),
    String(r.config.wanCapacityMbps),
    String(r.metrics.medianLatencyMs),
    String(r.metrics.p95LatencyMs),
    String(r.metrics.p99LatencyMs),
    String(r.metrics.jitterMs),
    String(r.metrics.packetLossPct),
    String(r.metrics.jainsFairnessIndex),
    String(r.metrics.recoveryTimeSec),
    `"${r.provenanceNote.replace(/"/g, '""')}"`,
  ]);
  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}
