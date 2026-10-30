export type DataMode = 'DEMO' | 'LIVE';

export type PageId =
  | 'overview'
  | 'traffic'
  | 'capacity'
  | 'policy'
  | 'experiments'
  | 'models'
  | 'diagnostics';

export type TrafficClass =
  | 'Video Calls'
  | 'Gaming'
  | 'Interactive Browsing'
  | 'Streaming'
  | 'Bulk Downloads'
  | 'Background Sync'
  | 'Unknown';

export type ScenarioId =
  | 'STORY_8STEP'
  | 'SCENARIO_A_STABLE'
  | 'SCENARIO_B_VIDEO_CALL'
  | 'SCENARIO_C_GAMING'
  | 'SCENARIO_D_BULK_DOWNLOAD'
  | 'SCENARIO_E_CAPACITY_DROP'
  | 'SCENARIO_F_BACKUP_CONGESTION'
  | 'SCENARIO_G_CAPACITY_RECOVERY';

export type ComponentHealthState =
  | 'DEMO_SIMULATION'
  | 'OPERATIONAL'
  | 'DEGRADED'
  | 'NOT_CONNECTED'
  | 'UNKNOWN';

export interface ComponentStatus {
  id: 'frontend' | 'api' | 'classifier' | 'sdn_controller' | 'enforcement';
  name: string;
  state: ComponentHealthState;
  detail: string;
  version: string;
  lastChecked: string;
}

export interface SystemHealth {
  mode: DataMode;
  connected: boolean;
  lastUpdated: string;
  apiBaseUrl: string;
  latencyMs: number | null;
  components: ComponentStatus[];
  error?: ApiError;
}

export interface MetricPoint {
  timestamp: string;
  elapsedSec: number;
  estimatedCapacityMbps: number;
  configuredShapingMbps: number;
  throughputMbps: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  jitterMs: number;
  queueDelayMs: number;
  queueDepthPct: number;
  packetLossPct: number;
  utilizationPct: number;
  activeFlows: number;
  classThroughputMbps: Record<TrafficClass, number>;
  annotation?: string;
  provenance: 'SIMULATED_DEMO' | 'MEASURED_LIVE';
}

export interface FlowFeatureMetadata {
  name: string;
  value: string;
  unit: string;
  source: string;
}

export interface FlowRecord {
  id: string;
  sourceEndpoint: string;
  destinationEndpoint: string;
  clientHostname: string;
  protocol: 'UDP' | 'TCP' | 'QUIC';
  currentRateMbps: number;
  bytesTransferred: number;
  packetsTransferred: number;
  predictedClass: TrafficClass;
  confidence: number;
  isLowConfidence: boolean;
  policyClass: string;
  dscpMark: string;
  rttMs: number;
  jitterMs: number;
  status: 'ACTIVE' | 'SHAPED' | 'PRIORITIZED' | 'OBSERVED';
  lastSeen: string;
  modelVersion: string;
  provenance: 'SIMULATED_DEMO' | 'MEASURED_LIVE';
  rateHistoryMbps: number[];
  features: FlowFeatureMetadata[];
}

export interface CapacityEstimate {
  timestamp: string;
  estimatedWanMbps: number;
  configuredShapingMbps: number;
  observedThroughputMbps: number;
  headroomReservePct: number;
  confidencePct: number | null;
  errorBoundMbps: number | null;
  congestionState: 'NOMINAL' | 'ELEVATED_QUEUE' | 'CAPACITY_DROP' | 'RECOVERING';
  lastAdaptationReason: string;
  provenance: 'SIMULATED_DEMO' | 'MEASURED_LIVE';
}

export interface QoSPolicy {
  id: string;
  trafficClass: TrafficClass;
  priorityTier: 1 | 2 | 3 | 4 | 5;
  minSharePct: number;
  maxRateMbps: number;
  targetLatencyMs: number;
  queueDiscipline: 'FQ-CoDel-Simulated' | 'HTB-Priority' | 'DRR-Fair';
  enabled: boolean;
  lastChanged: string;
  provenance: 'SIMULATED_DEMO' | 'MEASURED_LIVE';
}

export interface UserIntent {
  id: string;
  name: string;
  trafficClass: TrafficClass;
  priorityTier: 1 | 2 | 3;
  minFloorMbps?: number;
  maxCeilingMbps?: number;
  targetLatencyMs: number;
  durationMinutes: number;
  remainingSeconds: number;
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING_CONFIRMATION';
  rationale: string;
  createdAt: string;
  provenance: 'SIMULATED_DEMO' | 'MEASURED_LIVE';
}

export interface PolicyEvent {
  id: string;
  timestamp: string;
  stepIndex: number;
  decision: string;
  reason: string;
  policyEffect: string;
  outcome: string;
  severity: 'INFO' | 'ADAPTATION' | 'CONGESTION' | 'RECOVERY';
  provenance: 'SIMULATED_DEMO' | 'MEASURED_LIVE';
}

export type BaselineProfileId =
  | 'NO_SHAPING'
  | 'STATIC_QOS'
  | 'FQ_CODEL_SIM'
  | 'DETERMINISTIC_ADAPTIVE'
  | 'INTENT_QOS_PROPOSED';

export interface ExperimentConfig {
  scenarioId: ScenarioId;
  seed: number;
  durationSec: number;
  wanCapacityMbps: number;
  modelVersion: string;
  queueDiscipline: string;
}

export interface ExperimentRun {
  id: string;
  profileId: BaselineProfileId;
  profileName: string;
  description: string;
  isSimulatedBaseline: boolean;
  status: 'COMPLETED_SIMULATION' | 'RUNNING' | 'NOT_EXECUTED';
  startTime: string;
  endTime: string;
  config: ExperimentConfig;
  metrics: {
    medianLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    jitterMs: number;
    packetLossPct: number;
    jainsFairnessIndex: number;
    recoveryTimeSec: number;
    classifierMacroF1: number;
    cpuOverheadPct: number;
    memoryMb: number;
    inferenceLatencyUs: number;
    classThroughputMbps: Record<TrafficClass, number>;
  };
  provenanceNote: string;
}

export interface ClassEvaluationMetric {
  trafficClass: TrafficClass;
  precision: number;
  recall: number;
  f1Score: number;
  supportCount: number;
}

export interface ModelEvaluation {
  modelName: string;
  modelVersion: string;
  artifactId: string;
  featureSchemaVersion: string;
  classMappingVersion: string;
  quantizationState: 'INT8 Post-Training Quantized' | 'FP32 Baseline';
  datasetName: string;
  evaluationDate: string;
  sampleCount: number;
  overallAccuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  modelSizeKb: number;
  fp32SizeKb: number;
  inferenceLatencyP50Us: number;
  inferenceLatencyP95Us: number;
  inferenceLatencyP99Us: number;
  fp32LatencyP50Us: number;
  perClassMetrics: ClassEvaluationMetric[];
  confusionMatrix: {
    labels: TrafficClass[];
    matrix: number[][];
  };
  confidenceDistribution: {
    bucket: string;
    offlineEvalPct: number;
    demoObservedPct: number;
  }[];
  provenanceNote: string;
}

export interface ApiError {
  code: string;
  message: string;
  endpoint: string;
  timestamp: string;
  retryable: boolean;
}

export interface DiagnosticLog {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  component: 'FRONTEND' | 'DEMO_ENGINE' | 'API_CLIENT' | 'POLICY_SIM' | 'SDN_ADAPTER';
  event: string;
  correlationId: string;
  mode: DataMode;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  code: string;
  name: string;
  shortLabel: string;
  description: string;
  nominalWanMbps: number;
  storySteps?: string[];
}
