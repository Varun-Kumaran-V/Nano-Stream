import { PageId } from '../types/qos';
import { PROJECT_LINKS } from '../config/projectLinks';

export type GlossaryCategory =
  | 'Networking & QoS'
  | 'Traffic Classification'
  | 'Capacity & Congestion'
  | 'User Intents & Policy'
  | 'Fairness & Scheduling'
  | 'Model & Evaluation'
  | 'Provenance & Modes';

export type GlossaryStatus =
  | 'implemented'
  | 'demo-only'
  | 'planned'
  | 'research-foundation';

export type GlossarySourceType =
  | 'curated-glossary'
  | 'project-code-docs'
  | 'ieee-nano-stream'
  | 'gemini-generated';

export interface GlossaryEntry {
  id: string;
  term: string;
  aliases: string[];
  category: GlossaryCategory;
  shortDefinition: string;
  projectMeaning: string;
  whyItMatters: string;
  whereYouSeeIt: string;
  example: string;
  relatedTerms: string[];
  sourceType: GlossarySourceType;
  sourceUrl?: string;
  status: GlossaryStatus;
  relatedPage?: PageId;
}

export interface PageExplanation {
  pageId: PageId;
  title: string;
  summary: string;
  keyMetrics: { name: string; meaning: string }[];
  provenanceNote: string;
  safeActions: string[];
}

export interface HelpChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sourceType?: GlossarySourceType | 'local-fallback';
  relatedTerms?: string[];
  isError?: boolean;
}

export interface HelpChatRequestPayload {
  message: string;
  selectedText?: string;
  activePage?: PageId;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

export interface HelpChatResponsePayload {
  answer: string;
  sourceType: GlossarySourceType | 'local-fallback';
  relatedTerms: string[];
  requestId: string;
  modelUsed: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
}

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  'Networking & QoS',
  'Traffic Classification',
  'Capacity & Congestion',
  'User Intents & Policy',
  'Fairness & Scheduling',
  'Model & Evaluation',
  'Provenance & Modes',
];

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'intentqos-sidebar-collapsed';

export const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  {
    id: 'qos',
    term: 'Quality of Service (QoS)',
    aliases: ['qos', 'quality of service', 'adaptive qos', 'traffic shaping'],
    category: 'Networking & QoS',
    shortDefinition:
      'Mechanisms that prioritize, pace, and schedule network packets so latency-sensitive traffic stays responsive when bandwidth is scarce.',
    projectMeaning:
      'IntentQoS models an adaptive QoS pipeline that combines early-flow traffic classification, WAN bottleneck tracking, and human-intent policies.',
    whyItMatters:
      'Without QoS, a single multi-gigabyte file download or cloud backup can fill the home gateway queue and cause video calls or games to stutter.',
    whereYouSeeIt: 'Overview, Intents & Policy, Experiments & Benchmarks',
    example:
      'During Step 6 of the 8-Step Guided Story, Adaptive QoS caps Bulk Downloads at 5.2 Mbps so Video Calls and Gaming hold p95 latency under 21 ms.',
    relatedTerms: ['bufferbloat', 'htb', 'fq-codel', 'shaping-ceiling'],
    sourceType: 'project-code-docs',
    status: 'demo-only',
    relatedPage: 'overview',
  },
  {
    id: 'wan-capacity',
    term: 'Estimated WAN Capacity',
    aliases: [
      'est. wan capacity',
      'wan capacity',
      'estimated wan',
      'bottleneck capacity',
      'wan link capacity',
      'estimatedcapacitymbps',
    ],
    category: 'Capacity & Congestion',
    shortDefinition:
      'The current usable throughput ceiling of the household internet connection (Wide Area Network link) in megabits per second (Mbps).',
    projectMeaning:
      'In Demo / Replay mode, Estimated WAN Capacity is a deterministic time series (e.g., dropping from 120 Mbps to 52 Mbps) that drives the simulated shaper ceiling. A live passive RTT-gradient estimator requires the Python/SDN backend.',
    whyItMatters:
      'Home broadband speeds fluctuate due to ISP last-mile contention, Wi-Fi/cellular backhaul, or modem sync changes. Static QoS rules fail when actual capacity drops below the configured limit.',
    whereYouSeeIt: 'Overview (KPI tile & main chart), Capacity & Congestion',
    example:
      'In Scenario E (WAN Capacity Drop), estimated WAN capacity contracts from 120 Mbps to 48 Mbps, prompting the shaper ceiling to step down to 45.5 Mbps.',
    relatedTerms: ['shaping-ceiling', 'capacity-vs-shaping', 'bufferbloat'],
    sourceType: 'project-code-docs',
    status: 'demo-only',
    relatedPage: 'capacity',
  },
  {
    id: 'shaping-ceiling',
    term: 'Shaping Ceiling (Configured Shaper Rate)',
    aliases: [
      'shaper ceiling',
      'configured shaping ceiling',
      'shaping rate',
      'htb ceiling',
      'configuredshapingmbps',
    ],
    category: 'Capacity & Congestion',
    shortDefinition:
      'The maximum aggregate egress rate allowed by the router’s token-bucket traffic shaper, intentionally set slightly below the true WAN bottleneck.',
    projectMeaning:
      'IntentQoS sets the simulated HTB shaping ceiling at 95% of Estimated WAN Capacity (a 5% anti-bufferbloat headroom reserve) so queue formation happens inside the smart gateway rather than in an unmanageable ISP modem FIFO buffer.',
    whyItMatters:
      'You can only prioritize packets if you control the bottleneck queue. Setting the ceiling 5% below WAN capacity transfers queue control back to the gateway.',
    whereYouSeeIt: 'Overview KPI sub-label, Capacity & Congestion 4-card strip & chart',
    example:
      'When Estimated WAN Capacity is 120 Mbps, the Shaping Ceiling is 114 Mbps. When WAN drops to 52 Mbps, the ceiling adapts to 49 Mbps.',
    relatedTerms: ['wan-capacity', 'capacity-vs-shaping', 'htb', 'bufferbloat'],
    sourceType: 'project-code-docs',
    status: 'demo-only',
    relatedPage: 'capacity',
  },
  {
    id: 'capacity-vs-shaping',
    term: 'Capacity Estimate vs. Configured Shaping Ceiling',
    aliases: [
      'capacity estimate vs configured shaping ceiling',
      'headroom reserve',
      'anti-bufferbloat headroom',
      '5% headroom',
    ],
    category: 'Capacity & Congestion',
    shortDefinition:
      'The deliberate gap (typically 5%) between what the ISP link can carry (Capacity Estimate) and what the router permits to leave (Shaping Ceiling).',
    projectMeaning:
      'Tracked explicitly on the Capacity & Congestion page with three distinct lines: Estimated WAN Capacity, Configured Shaper Rate (95%), and Observed Throughput.',
    whyItMatters:
      'If the shaper ceiling is higher than actual WAN capacity, packets pile up in the upstream modem buffer and priority rules stop working.',
    whereYouSeeIt: 'Capacity & Congestion (Bandwidth Headroom & Shaper Tracking chart)',
    example:
      'At 52 Mbps estimated capacity, a 5% reserve places the shaper ceiling at 49.0 Mbps, leaving 3.0 Mbps of safety margin to drain standing queues.',
    relatedTerms: ['wan-capacity', 'shaping-ceiling', 'bufferbloat', 'static-qos'],
    sourceType: 'project-code-docs',
    status: 'demo-only',
    relatedPage: 'capacity',
  },
  {
    id: 'bufferbloat',
    term: 'Bufferbloat',
    aliases: ['queue delay', 'queueing delay', 'standing queue', 'queuedelayms', 'queue depth'],
    category: 'Capacity & Congestion',
    shortDefinition:
      'Excessive packet latency and jitter caused by oversized, unmanaged packet buffers in routers and modems filling up during heavy transfers.',
    projectMeaning:
      'Measured via Queue Delay (ms) and Queue Occupancy (%) in the simulation engine. IntentQoS mitigates bufferbloat by combining capacity-aware shaping with per-class fair queueing.',
    whyItMatters:
      'Bufferbloat is the primary reason a fast internet connection feels slow or laggy when someone starts a large upload or download.',
    whereYouSeeIt: 'Overview (Median RTT sub-label), Capacity & Congestion (Bufferbloat chart)',
    example:
      'In the No Shaping (FIFO) benchmark baseline, bufferbloat drives p95 latency to 184.2 ms, compared to 20.8 ms under the simulated IntentQoS profile.',
    relatedTerms: ['fq-codel', 'aqm', 'p95-p99-latency', 'shaping-ceiling'],
    sourceType: 'curated-glossary',
    status: 'demo-only',
    relatedPage: 'capacity',
  },
  {
    id: 'rtt-latency',
    term: 'Round-Trip Time (Median RTT Latency)',
    aliases: ['rtt', 'median rtt', 'median rtt latency', 'medianlatencyms', 'ping', 'latency'],
    category: 'Networking & QoS',
    shortDefinition:
      'The time in milliseconds (ms) it takes for a network packet to travel from the client to a destination endpoint and back. The median (p50) represents typical non-spike delay.',
    projectMeaning:
      'Displayed on Overview, Live Traffic, and Experiments to show baseline responsiveness across the 7 traffic classes.',
    whyItMatters:
      'Low median RTT (<20 ms) keeps interactive web browsing, voice chat, and multiplayer gaming feeling immediate.',
    whereYouSeeIt: 'Overview KPI strip, Live Traffic flow table, Experiments comparison chart',
    example:
      'In nominal steady state (Step 1), Median RTT is 10.8 ms with a queue delay of ~3.1 ms.',
    relatedTerms: ['p95-p99-latency', 'jitter', 'bufferbloat'],
    sourceType: 'curated-glossary',
    status: 'implemented',
    relatedPage: 'overview',
  },
  {
    id: 'p95-p99-latency',
    term: 'p95 and p99 Tail Latency',
    aliases: [
      'tail latency',
      'p95',
      'p99',
      'p95 tail latency',
      'p99 latency',
      '95th percentile',
      '99th percentile',
      'p95latencyms',
      'p99latencyms',
    ],
    category: 'Networking & QoS',
    shortDefinition:
      'The 95th and 99th percentile round-trip latency values—meaning 95% (or 99%) of packets arrive faster than this threshold, while the worst 5% (or 1%) experience at least this much delay.',
    projectMeaning:
      'Primary congestion indicator in IntentQoS. Plotted on the right Y-axis of the Overview chart against a 25 ms Interactive Target reference line.',
    whyItMatters:
      'Users do not notice average latency during a video call or game; they notice the worst 1%–5% latency spikes (freeze frames, audio roboticizing, rubber-banding).',
    whereYouSeeIt: 'Overview primary chart & KPI tile, Capacity & Congestion, Experiments & Benchmarks',
    example:
      'When WAN capacity drops in Step 4, simulated p95 tail latency spikes to 78.0 ms (p99: 96.0 ms) before policy clamping restores p95 to 20.8 ms.',
    relatedTerms: ['rtt-latency', 'jitter', 'bufferbloat'],
    sourceType: 'curated-glossary',
    status: 'implemented',
    relatedPage: 'overview',
  },
  {
    id: 'jitter',
    term: 'Packet Jitter',
    aliases: ['jitter', 'jitterms', 'delay variation', 'iat variance'],
    category: 'Networking & QoS',
    shortDefinition:
      'The variation in packet arrival delay over time, measured in milliseconds (ms).',
    projectMeaning:
      'Tracked globally on Overview/Experiments and per-flow in Live Traffic. Real-time UDP flows (Gaming, Video Calls) require low jitter (<5 ms).',
    whyItMatters:
      'High jitter forces WebRTC voice/video receivers to expand their playout buffers (adding lag) and causes erratic movement in online games.',
    whereYouSeeIt: 'Overview p95 KPI sub-label, Live Traffic flow inspector, Experiments table',
    example:
      'Flow flw-902b-game (128Hz UDP gaming stream) maintains ~1.4 ms jitter when isolated in Tier-1 Real-Time CS4.',
    relatedTerms: ['rtt-latency', 'p95-p99-latency', 'packet-loss'],
    sourceType: 'curated-glossary',
    status: 'implemented',
    relatedPage: 'traffic',
  },
  {
    id: 'packet-loss',
    term: 'Packet Loss Rate',
    aliases: ['packet loss', 'loss', 'packetlosspct', 'congestion drops'],
    category: 'Networking & QoS',
    shortDefinition:
      'The percentage of transmitted packets that fail to reach their destination or are dropped by a full router queue.',
    projectMeaning:
      'Displayed as a percentage (%) on Overview, Capacity & Congestion, and Experiments. Values above 0.5% trigger a congestion drop warning in the UI.',
    whyItMatters:
      'Even 1%–2% packet loss can severely degrade real-time UDP audio/video and trigger aggressive TCP throughput backoff.',
    whereYouSeeIt: 'Overview KPI tile, Capacity & Congestion right chart, Experiments table',
    example:
      'In nominal operation, simulated packet loss stays below 0.08% (<0.2% SLA target).',
    relatedTerms: ['bufferbloat', 'fq-codel', 'p95-p99-latency'],
    sourceType: 'curated-glossary',
    status: 'implemented',
    relatedPage: 'overview',
  },
  {
    id: 'throughput',
    term: 'Observed Throughput',
    aliases: [
      'throughput',
      'current throughput',
      'observed load',
      'egress rate',
      'throughputmbps',
      'link utilization',
    ],
    category: 'Networking & QoS',
    shortDefinition:
      'The actual volume of data currently traversing the network link per second, measured in Mbps.',
    projectMeaning:
      'Aggregated across all 7 traffic classes (`classThroughputMbps`) and compared against Estimated WAN Capacity to compute link utilization (%).',
    whyItMatters:
      'Comparing observed throughput against the shaping ceiling shows whether the link is idle, well-utilized, or saturated at the bottleneck.',
    whereYouSeeIt: 'Overview KPI & primary chart, Capacity & Congestion, Live Traffic',
    example:
      'At 46.8 Mbps observed throughput over a 52 Mbps WAN estimate, link utilization is 90%.',
    relatedTerms: ['wan-capacity', 'shaping-ceiling', 'traffic-class'],
    sourceType: 'curated-glossary',
    status: 'implemented',
    relatedPage: 'overview',
  },
  {
    id: 'active-flow',
    term: 'Active Flow',
    aliases: ['active flows', 'flow', 'flow record', 'classified flows', '5-tuple'],
    category: 'Traffic Classification',
    shortDefinition:
      'A unidirectional or bidirectional sequence of packets sharing the same source/destination IP, ports, and transport protocol (TCP, UDP, or QUIC).',
    projectMeaning:
      'In Live Traffic, each FlowRecord includes endpoints, client hostname, protocol, current rate, early-flow header features, predicted class, confidence score, and DSCP mark.',
    whyItMatters:
      'QoS classification and queueing act on individual flows so an interactive flow on a laptop can be prioritized even while the same laptop runs a background download.',
    whereYouSeeIt: 'Live Traffic table & Flow Inspector drawer, Overview KPI strip',
    example:
      'Work-Laptop-Pro simultaneously runs flw-901a-webrtc (UDP Video Call, Prioritized EF) and flw-905e-web (QUIC Interactive Browsing, AF21).',
    relatedTerms: ['first-32-packets', 'traffic-class', 'confidence-score'],
    sourceType: 'project-code-docs',
    status: 'demo-only',
    relatedPage: 'traffic',
  },
  {
    id: 'traffic-class',
    term: 'Traffic Class (7-Class Taxonomy)',
    aliases: [
      'traffic classes',
      'predicted class',
      'class mapping',
      'video calls',
      'gaming',
      'interactive browsing',
      'streaming',
      'bulk downloads',
      'background sync',
    ],
    category: 'Traffic Classification',
    shortDefinition:
      'A behavioral category of network traffic with distinct latency, jitter, and bandwidth requirements.',
    projectMeaning:
      'IntentQoS classifies home broadband traffic into 7 classes: Video Calls, Gaming, Interactive Browsing, Streaming, Bulk Downloads, Background Sync, and an explicit Unknown fallback class.',
    whyItMatters:
      'Grouping flows into behavioral classes lets the policy engine assign appropriate HTB priority tiers, minimum bandwidth shares, and latency targets.',
    whereYouSeeIt: 'Overview Per-Class Bandwidth Share, Live Traffic filter, Intents & Policy table',
    example:
      'Video Calls and Gaming map to Priority Tier 1, whereas Bulk Downloads (Tier 4) and Background Sync (Tier 5) yield bandwidth during congestion.',
    relatedTerms: ['unknown-gate', 'confidence-score', 'first-32-packets', 'htb'],
    sourceType: 'project-code-docs',
    status: 'implemented',
    relatedPage: 'traffic',
  },
  {
    id: 'confidence-score',
    term: 'Classifier Confidence Score & Threshold (0.65)',
    aliases: [
      'confidence',
      'confidence score',
      'confidence threshold',
      'softmax confidence',
      '0.65 gate',
      'below 65% gate',
    ],
    category: 'Traffic Classification',
    shortDefinition:
      'The calibrated probability (0.00 to 1.00) output by the classifier for its top predicted traffic class.',
    projectMeaning:
      'IntentQoS enforces a 0.65 (65%) safety threshold. Flows scoring ≥0.80 are marked High Confidence; flows scoring <0.65 are flagged as low-confidence and routed to a safe default queue.',
    whyItMatters:
      'Blindly trusting a neural network on unfamiliar traffic can cause a bulk download to be misclassified as a high-priority video call, starving real interactive flows.',
    whereYouSeeIt: 'Live Traffic table & confidence filter, Model Insights confidence distribution chart',
    example:
      'Flow flw-907g-unknown scores 44% (0.44 < 0.65) and is routed to Default Safe Best-Effort (DF 0).',
    relatedTerms: ['unknown-gate', 'first-32-packets', 'model-holdout'],
    sourceType: 'project-code-docs',
    status: 'demo-only',
    relatedPage: 'traffic',
  },
  {
    id: 'unknown-gate',
    term: 'Unknown / Low-Confidence Safety Gate',
    aliases: [
      'unknown',
      'unknown class',
      'low-confidence gate',
      'unknown gate',
      'low-conf fallback',
      'safety gate',
    ],
    category: 'Traffic Classification',
    shortDefinition:
      'A protective fallback category for encrypted, unfamiliar, or ambiguous flows whose classifier confidence falls below the 0.65 threshold.',
    projectMeaning:
      'Represented as the 7th traffic class ("Unknown") with a dedicated 5% minimum share and 20 Mbps ceiling under FQ-CoDel best-effort scheduling.',
    whyItMatters:
      'Real home networks encounter new games, VPNs, and IoT protocols not seen during training. The Unknown gate prevents misclassification from breaking high-priority queues.',
    whereYouSeeIt: 'Live Traffic (flw-907g-unknown), Overview class distribution, Model Insights',
    example:
      'An unfamiliar UDP IoT bridge stream on port 8843 with 0.44 confidence is safely contained in the Unknown class rather than promoted to Tier-1.',
    relatedTerms: ['confidence-score', 'traffic-class', 'first-32-packets'],
    sourceType: 'project-code-docs',
    status: 'demo-only',
    relatedPage: 'models',
  },
  {
    id: 'first-32-packets',
    term: 'First 32 Packets (Early-Flow Header Metadata)',
    aliases: [
      'first 32 packets',
      'first-32-pkts',
      'early-flow',
      'early-flow classification',
      'header metadata',
      'nano-stream',
    ],
    category: 'Traffic Classification',
    shortDefinition:
      'Extracting lightweight statistical features (packet lengths, inter-arrival times, direction ratios) from only the first 32 packets of a flow rather than inspecting packet payloads.',
    projectMeaning:
      'Core research concept from the IEEE Nano-Stream foundation. In the console, each flow in Live Traffic displays its simulated early-flow feature vector (`mean_pkt_len`, `iat_std_dev`, etc.). Note: the current Python Ryu prototype still feeds synthetic features and requires live feature-extractor wiring.',
    whyItMatters:
      'Classifying once after 32 packets preserves user privacy (no Deep Packet Inspection of encrypted payloads) and avoids running neural inference on every single packet.',
    whereYouSeeIt: 'Live Traffic Flow Inspector drawer, Model Insights schema metadata, Landing Page',
    example:
      'A 128Hz gaming flow exhibits a small mean packet length (168 bytes) and tight inter-arrival mean (7.8 ms) within its first 32 packets.',
    relatedTerms: ['int8-quantization', 'inference-latency', 'active-flow'],
    sourceType: 'ieee-nano-stream',
    sourceUrl: PROJECT_LINKS.ieeePaperUrl,
    status: 'research-foundation',
    relatedPage: 'models',
  },
  {
    id: 'int8-quantization',
    term: 'INT8 Post-Training Quantization',
    aliases: ['int8', 'int8 quantization', 'quantization', 'fp32 baseline', '312 kb'],
    category: 'Model & Evaluation',
    shortDefinition:
      'Converting 32-bit floating-point (FP32) neural network weights and activations into compact 8-bit integers (INT8) to shrink memory footprint and accelerate CPU inference.',
    projectMeaning:
      'Shown in Model Insights (`nano-stream-int8-v1.4.2`): reduces checkpoint size from 1,180 KB (FP32) to 312 KB (-73.5%) and median inference latency from 410 µs to 142 µs with minimal macro-F1 loss.',
    whyItMatters:
      'Home routers and embedded gateways have limited RAM and no discrete GPU, making INT8 quantization essential for practical deployment.',
    whereYouSeeIt: 'Model Insights (Quantization & Inference Latency Profile)',
    example:
      'The 312 KB INT8 ONNX checkpoint fits inside L2/L3 CPU cache on commodity gateway processors.',
    relatedTerms: ['inference-latency', 'first-32-packets', 'model-holdout'],
    sourceType: 'ieee-nano-stream',
    sourceUrl: PROJECT_LINKS.ieeePaperUrl,
    status: 'research-foundation',
    relatedPage: 'models',
  },
  {
    id: 'inference-latency',
    term: 'Inference Latency (µs)',
    aliases: ['inference latency', 'p50 inference', 'cpu inference', '142 µs', 'microseconds'],
    category: 'Model & Evaluation',
    shortDefinition:
      'The CPU wall-clock time required to evaluate the classifier model on a single flow’s feature vector, measured in microseconds (µs).',
    projectMeaning:
      'Reported as offline benchmark reference metrics in Model Insights (p50: 142 µs, p95: 218 µs, p99: 295 µs). These are reference holdout figures, not live browser measurements.',
    whyItMatters:
      'Sub-millisecond per-flow inference ensures the control plane can classify hundreds of new flows per second without delaying packet forwarding.',
    whereYouSeeIt: 'Model Insights, Experiments & Benchmarks table',
    example:
      'At 142 µs (0.142 ms) per flow, classifying a new WebRTC stream adds negligible setup overhead.',
    relatedTerms: ['int8-quantization', 'first-32-packets', 'model-holdout'],
    sourceType: 'ieee-nano-stream',
    sourceUrl: PROJECT_LINKS.ieeePaperUrl,
    status: 'research-foundation',
    relatedPage: 'models',
  },
  {
    id: 'jains-fairness-index',
    term: 'Jain’s Fairness Index',
    aliases: [
      'jains fairness index',
      "jain's fairness index",
      'jains index',
      'fairness index',
      'fairness',
    ],
    category: 'Fairness & Scheduling',
    shortDefinition:
      'A quantitative metric bounded between 1/n and 1.0 that measures how fairly bandwidth is shared across n competing traffic classes or flows: (Σxᵢ)² / (n · Σxᵢ²).',
    projectMeaning:
      'Computed deterministically via `computeJainsFairnessIndex()` in `src/services/demoEngine.ts` across the 7 traffic classes. Displayed on Intents & Policy and Experiments & Benchmarks.',
    whyItMatters:
      'Strict priority queueing can completely starve lower-priority classes. Monitoring Jain’s index alongside minimum bandwidth floors ensures bulk and sync traffic still make progress.',
    whereYouSeeIt: 'Intents & Policy (Jain’s Fairness Index panel), Experiments & Benchmarks',
    example:
      'Equal allocations `[20, 20, 20, 20]` yield 1.00; highly skewed allocations `[100, 1, 1, 1]` drop to ~0.26.',
    relatedTerms: ['minimum-bandwidth-floor', 'htb', 'user-intent'],
    sourceType: 'project-code-docs',
    status: 'implemented',
    relatedPage: 'policy',
  },
  {
    id: 'minimum-bandwidth-floor',
    term: 'Minimum Bandwidth Floor & Starvation Check',
    aliases: [
      'minimum bandwidth floor',
      'min floor',
      'min share',
      'floor',
      'starvation check',
      'minfloor',
    ],
    category: 'Fairness & Scheduling',
    shortDefinition:
      'A guaranteed minimum bandwidth reservation (in Mbps or %) for a traffic class during link contention, paired with a pre-apply check that ensures other classes are not starved.',
    projectMeaning:
      'On Intents & Policy, every traffic class has a `minSharePct` and temporary intents validate that `minFloorMbps < configuredShapingMbps` before application.',
    whyItMatters:
      'Prevents an operator or automated policy from reserving 100% of link capacity for one class and breaking basic DNS, web browsing, or background keep-alives.',
    whereYouSeeIt: 'Intents & Policy (Create Intent form & Policy Preview safety check)',
    example:
      'Reserving an 18 Mbps floor for Video Calls under a 49 Mbps shaper ceiling leaves ≥31.0 Mbps for the remaining 6 classes.',
    relatedTerms: ['jains-fairness-index', 'user-intent', 'htb'],
    sourceType: 'project-code-docs',
    status: 'implemented',
    relatedPage: 'policy',
  },
  {
    id: 'user-intent',
    term: 'Temporary User Intent & TTL (Time-To-Live)',
    aliases: [
      'temporary user intent',
      'user intent',
      'intent',
      'ttl',
      'session intent',
      'simulate expiry',
    ],
    category: 'User Intents & Policy',
    shortDefinition:
      'A human-readable, time-bounded QoS override (e.g., "Prioritize Telehealth Consultation for 30 minutes") that automatically expires when its countdown (TTL) reaches zero.',
    projectMeaning:
      'Managed on the Intents & Policy page. Operators can create new intents with validation, preview impact, simulate immediate TTL expiration, or remove intents in Demo mode.',
    whyItMatters:
      'Static router priority rules are often forgotten after a call ends, permanently throttling other household devices. Time-bounded intents clean up automatically.',
    whereYouSeeIt: 'Intents & Policy (Active Human-Intent Overrides & Create Intent form)',
    example:
      'An active "Protect Work Laptop Video Call SLA" intent reserves a 15 Mbps floor and ≤18 ms target latency with a live countdown timer.',
    relatedTerms: ['minimum-bandwidth-floor', 'jains-fairness-index', 'policy-event'],
    sourceType: 'project-code-docs',
    status: 'demo-only',
    relatedPage: 'policy',
  },
  {
    id: 'htb',
    term: 'Hierarchical Token Bucket (HTB)',
    aliases: ['htb', 'hierarchical token bucket', 'htb-priority', 'token bucket'],
    category: 'Fairness & Scheduling',
    shortDefinition:
      'A Linux kernel traffic-control (`tc`) queueing discipline that enforces a global link shaping ceiling while dividing bandwidth hierarchically among child classes with guaranteed floors (`rate`) and burst ceilings (`ceil`).',
    projectMeaning:
      'Simulated in the 7-Class HTB Policy Table on Intents & Policy and in the 2D Gateway Core node (`HTB + FQ-CoDel`). Real Linux `tc` enforcement requires the backend bridge.',
    whyItMatters:
      'HTB allows unused bandwidth from idle high-priority classes to be borrowed by lower-priority downloads, then reclaimed immediately when interactive traffic appears.',
    whereYouSeeIt: 'Intents & Policy table, Overview 2D Topology, Capacity & Congestion',
    example:
      'Bulk Downloads can borrow up to 42 Mbps when the 120 Mbps link is quiet, but is clamped down when WAN capacity drops and Tier-1 classes need headroom.',
    relatedTerms: ['fq-codel', 'shaping-ceiling', 'minimum-bandwidth-floor'],
    sourceType: 'curated-glossary',
    status: 'demo-only',
    relatedPage: 'policy',
  },
  {
    id: 'fq-codel',
    term: 'FQ-CoDel (Flow Queue Controlled Delay)',
    aliases: ['fq-codel', 'fq_codel', 'cake', 'fq-codel-simulated', 'fair queueing'],
    category: 'Fairness & Scheduling',
    shortDefinition:
      'An Active Queue Management (AQM) and fair-queueing algorithm that hashes flows into separate sub-queues and uses packet sojourn time (delay) to signal congestion early.',
    projectMeaning:
      'Modeled as both a sub-queue discipline within IntentQoS classes and as a standalone reference baseline (`FQ_CODEL_SIM`) on the Experiments & Benchmarks page.',
    whyItMatters:
      'FQ-CoDel prevents a single heavy TCP flow from monopolizing a queue and keeps queueing delay low without complex manual tuning when link capacity is known.',
    whereYouSeeIt: 'Experiments & Benchmarks, Intents & Policy table, Overview topology',
    example:
      'On Experiments & Benchmarks, the simulated FQ-CoDel reference baseline achieves 46.5 ms p95 latency under a capacity drop, which IntentQoS improves to 20.8 ms by adapting the shaper ceiling.',
    relatedTerms: ['aqm', 'bufferbloat', 'htb', 'static-qos'],
    sourceType: 'curated-glossary',
    status: 'demo-only',
    relatedPage: 'experiments',
  },
  {
    id: 'aqm',
    term: 'Active Queue Management (AQM)',
    aliases: ['aqm', 'active queue management', 'drop-tail', 'fifo'],
    category: 'Fairness & Scheduling',
    shortDefinition:
      'Router queue policies that proactively mark (ECN) or drop packets before a queue becomes completely full, signaling TCP senders to pace their transmission rate.',
    projectMeaning:
      'Contrasted against the unshaped `NO_SHAPING` (Default FIFO Drop-Tail) baseline in Experiments & Benchmarks.',
    whyItMatters:
      'Traditional drop-tail FIFO queues wait until the buffer is 100% full before dropping packets, guaranteeing maximum bufferbloat.',
    whereYouSeeIt: 'Experiments & Benchmarks',
    example:
      'Replacing FIFO drop-tail with AQM + adaptive shaping cuts simulated p99 latency from 242.0 ms to 26.1 ms.',
    relatedTerms: ['fq-codel', 'bufferbloat', 'htb'],
    sourceType: 'curated-glossary',
    status: 'demo-only',
    relatedPage: 'experiments',
  },
  {
    id: 'static-qos',
    term: 'Static QoS Baseline',
    aliases: ['static qos', 'static_qos', 'fixed ceiling', 'port heuristic'],
    category: 'Fairness & Scheduling',
    shortDefinition:
      'Traditional router QoS rules that use fixed port numbers/DSCP marks and a hardcoded bandwidth ceiling (e.g., 120 Mbps) that never adapts to WAN fluctuations.',
    projectMeaning:
      'Included as the `STATIC_QOS` benchmark profile in Experiments & Benchmarks to show why fixed-ceiling rules fail when ISP capacity drops.',
    whyItMatters:
      'When a 120 Mbps link drops to 52 Mbps, a static 120 Mbps shaper never engages because traffic never reaches 120 Mbps—so the upstream modem buffer still overflows.',
    whereYouSeeIt: 'Experiments & Benchmarks',
    example:
      'Under the 52 Mbps bottleneck scenario, Static QoS suffers 112.6 ms p95 latency because its 120 Mbps ceiling is blind to the capacity drop.',
    relatedTerms: ['wan-capacity', 'shaping-ceiling', 'fq-codel'],
    sourceType: 'project-code-docs',
    status: 'demo-only',
    relatedPage: 'experiments',
  },
  {
    id: 'deterministic-demo-replay',
    term: 'Deterministic Demo / Replay Mode (seed=42026)',
    aliases: [
      'demo / replay',
      'demo mode',
      'simulated',
      'simulated_demo',
      'seed 42026',
      'seed=42026',
      'deterministic demo',
    ],
    category: 'Provenance & Modes',
    shortDefinition:
      'A repeatable simulation mode powered by a seeded pseudo-random number generator (`Mulberry32`, `seed=42026`) so every scenario, chart, and flow table is 100% reproducible.',
    projectMeaning:
      'Default operating mode of the IntentQoS frontend. Every card and chart in this mode displays a `SIMULATED · DEMO` provenance badge so synthetic data is never mistaken for live hardware telemetry.',
    whyItMatters:
      'Allows competition judges and engineers to step through congestion, capacity drops, and policy adaptations deterministically without needing physical routers attached.',
    whereYouSeeIt: 'Top header mode switcher, Scenario Control Bar, all dashboard cards',
    example:
      'Selecting "8-Step Guided Story" at tick 19 always produces an Estimated WAN Capacity of 52 Mbps.',
    relatedTerms: ['live-mode-telemetry', 'policy-event'],
    sourceType: 'project-code-docs',
    status: 'implemented',
    relatedPage: 'overview',
  },
  {
    id: 'live-mode-telemetry',
    term: 'LIVE Mode & Verified Telemetry',
    aliases: [
      'live mode',
      'live',
      'measured_live',
      'verified telemetry',
      'backend not connected',
      'live telemetry withheld',
    ],
    category: 'Provenance & Modes',
    shortDefinition:
      'Operational mode that probes a real backend REST endpoint (`/api/health`) and displays metrics only when a verified SDN/router telemetry bridge is connected.',
    projectMeaning:
      'Implemented in `src/services/dataProvider.ts`. If `/api/health` is unreachable or unverified, the UI explicitly withholds synthetic charts and displays the Disconnected Live panel.',
    whyItMatters:
      'Enforces strict engineering honesty: the dashboard never silently falls back to fake green checkmarks or synthetic demo numbers while claiming to be LIVE.',
    whereYouSeeIt: 'Top header LIVE toggle, Settings & Diagnostics, Live Disconnected Panel',
    example:
      'Switching to LIVE without a running Python/Ryu REST bridge at `http://localhost:8080/api/health` shows `ERR_BACKEND_UNREACHABLE` and withholds synthetic flow tables.',
    relatedTerms: ['deterministic-demo-replay'],
    sourceType: 'project-code-docs',
    status: 'implemented',
    relatedPage: 'diagnostics',
  },
  {
    id: 'policy-event',
    term: 'Policy Event (Controller & Shaper Audit Log)',
    aliases: ['policy event', 'decision audit log', 'adaptive policy decisions', 'audit log'],
    category: 'User Intents & Policy',
    shortDefinition:
      'A timestamped record explaining why the QoS controller changed queue priorities or shaper ceilings, what rule was applied, and the resulting latency outcome.',
    projectMeaning:
      'Displayed in the "Controller & Shaper Decision Audit Log" on the Overview page (`generatePolicyEvents()`).',
    whyItMatters:
      'Makes automated QoS decisions transparent and auditable for human operators rather than acting as an opaque black box.',
    whereYouSeeIt: 'Overview (Recent Adaptive Policy Decisions feed)',
    example:
      'At Step 6 (14:22:15 UTC), the controller logs clamping Bulk Downloads to 5.2 Mbps and notes p95 latency recovery from 78.0 ms to 20.8 ms.',
    relatedTerms: ['user-intent', 'shaping-ceiling', 'qos'],
    sourceType: 'project-code-docs',
    status: 'demo-only',
    relatedPage: 'overview',
  },
  {
    id: 'model-holdout',
    term: 'Model Holdout Evaluation & Confusion Matrix',
    aliases: [
      'model holdout',
      'confusion matrix',
      'macro f1',
      'precision',
      'recall',
      'holdout evaluation',
      'offline holdout',
    ],
    category: 'Model & Evaluation',
    shortDefinition:
      'Evaluating a trained machine-learning model on an offline test dataset (holdout split) that was never seen during training, summarized via Precision, Recall, F1, and a 7×7 Confusion Matrix.',
    projectMeaning:
      'Displayed on the Model Insights page (`N = 14,000` flows). Explicitly labeled as an offline reference dataset summary so users know it is not a live in-browser training run.',
    whyItMatters:
      'The 7×7 confusion matrix reveals which classes are occasionally confused (e.g., Interactive Browsing vs. Streaming) and how often ambiguous flows fall into Unknown.',
    whereYouSeeIt: 'Model Insights (Precision/Recall/F1 table & 7×7 Confusion Matrix)',
    example:
      'In the reference matrix, Gaming achieves 97.0% precision and 96.0% recall across 2,100 holdout flows.',
    relatedTerms: ['int8-quantization', 'inference-latency', 'confidence-score'],
    sourceType: 'project-code-docs',
    status: 'demo-only',
    relatedPage: 'models',
  },
  {
    id: 'dscp-marking',
    term: 'DSCP Marking (Differentiated Services Code Point)',
    aliases: ['dscp', 'ef (46)', 'cs4 (32)', 'af31', 'af21', 'cs1', 'le (1)', 'df (0)'],
    category: 'Networking & QoS',
    shortDefinition:
      'A 6-bit field in the IP packet header used to classify and mark packets for specific per-hop forwarding behaviors (such as Expedited Forwarding `EF` for voice/video or Scavenger `LE` for backups).',
    projectMeaning:
      'Shown in Live Traffic (`dscpMark`) and the 2D Topology inspector to indicate how classified flows are tagged for downstream HTB queues.',
    whyItMatters:
      'Standardized DSCP marks allow OpenFlow switches and Linux `tc` filters to route packets into the right hardware or software queue without re-inspecting headers.',
    whereYouSeeIt: 'Live Traffic table & Flow Inspector drawer',
    example:
      'WebRTC Video Calls receive `EF (46)`, Gaming receives `CS4 (32)`, and Background Sync receives `LE (1)`.',
    relatedTerms: ['traffic-class', 'htb', 'active-flow'],
    sourceType: 'curated-glossary',
    status: 'demo-only',
    relatedPage: 'traffic',
  },
];

export const PAGE_EXPLANATIONS: Record<PageId, PageExplanation> = {
  overview: {
    pageId: 'overview',
    title: 'Network Overview — High-Density Operational Telemetry',
    summary:
      'Provides a single-screen command view of WAN bottleneck capacity, observed throughput, p95 tail latency, per-class bandwidth share, 2D household topology, and recent policy adaptations.',
    keyMetrics: [
      {
        name: 'Real-Time Bottleneck & Latency Graph',
        meaning:
          'Plots Estimated WAN Capacity (dashed), Observed Throughput (solid area), and p95 Tail Latency (right axis) against a 25 ms interactive SLA target.',
      },
      {
        name: 'Compact 6-KPI Telemetry Strip',
        meaning:
          'Shows current values and 10-step trends for Est. WAN Capacity, Throughput, Median RTT, p95 Tail Latency, Packet Loss, and Classified Flows.',
      },
      {
        name: 'Per-Class Bandwidth Share & 2D Topology',
        meaning:
          'Breaks down bandwidth across the 7 traffic classes (including Unknown) and lets you click any device, gateway, or WAN node to inspect live queue state.',
      },
    ],
    provenanceNote:
      'In DEMO / REPLAY mode, all series and events are generated deterministically from seed=42026. Switching to LIVE mode withholds synthetic charts unless /api/health is verified.',
    safeActions: [
      'Switch between the 8 deterministic scenarios or step forward (+5s) to inspect congestion and recovery.',
      'Change chart time windows (1m, 5m, 15m, 1h) or click any node in the 2D topology.',
      'Highlight any metric name on the page and click "Explain" for instant definitions.',
    ],
  },
  traffic: {
    pageId: 'traffic',
    title: 'Live Traffic — Early-Flow Classification & Safety Gating',
    summary:
      'Displays active network flows classified using privacy-preserving statistical features from the first 32 packets, with explicit Unknown fallback gating for flows scoring below 0.65 confidence.',
    keyMetrics: [
      {
        name: 'Classifier Confidence (%)',
        meaning:
          'Probability assigned to the predicted class. Flows below 65% (<0.65) trigger a Low-Confidence fallback to prevent misclassifying bulk traffic as high priority.',
      },
      {
        name: 'Policy Queue & DSCP Mark',
        meaning:
          'Shows the assigned HTB priority tier and IP DSCP code point (e.g., EF 46 for Video Calls, CS1 8 for Bulk Downloads).',
      },
      {
        name: 'Extracted Early-Flow Header Features',
        meaning:
          'Click any row to inspect packet-length and inter-arrival time (IAT) statistics in the right-hand Flow Inspector drawer.',
      },
    ],
    provenanceNote:
      'Flow records in DEMO mode are deterministic simulated streams. Packet payloads and personal URLs are never captured or displayed.',
    safeActions: [
      'Filter flows by Traffic Class, Confidence Level (≥0.80 vs. <0.65), or Enforcement State.',
      'Sort by Rate (Mbps), Bytes/Packets, or Confidence, and click any row to open the Flow Inspector.',
    ],
  },
  capacity: {
    pageId: 'capacity',
    title: 'Capacity & Congestion — Anti-Bufferbloat Headroom Tracking',
    summary:
      'Separates Estimated WAN Bottleneck Capacity from the Configured HTB Shaping Ceiling (95%) and Observed Load, illustrating how dynamic ceiling adaptation prevents bufferbloat when ISP speeds drop.',
    keyMetrics: [
      {
        name: 'Estimated WAN vs. Shaping Rate',
        meaning:
          'The shaper ceiling tracks 95% of estimated WAN capacity (5% reserve) so queues form in the smart gateway rather than in an unmanaged upstream modem buffer.',
      },
      {
        name: 'Queue Delay (ms) & Occupancy (%)',
        meaning:
          'Measures standing queue delay and packet loss during sudden capacity contractions (e.g., 120 → 48 Mbps) and step-up recoveries.',
      },
    ],
    provenanceNote:
      'The Python repository does not yet include a live WAN capacity estimator daemon; these curves represent deterministic simulated trajectories.',
    safeActions: [
      'Click the quick-switch scenario buttons (WAN Capacity Drop, Capacity Recovery, Competing Bulk Transfer) to compare queue delay responses.',
    ],
  },
  policy: {
    pageId: 'policy',
    title: 'Intents & Policy — Human-Intent Overrides & Jain’s Fairness',
    summary:
      'Allows operators to declare time-bounded session intents (with TTL countdowns and starvation checks) and configure the 7-class Hierarchical Token Bucket (HTB) schedule.',
    keyMetrics: [
      {
        name: 'Temporary Session Intents (TTL)',
        meaning:
          'Time-bounded overrides that reserve a minimum bandwidth floor and target latency for a specific class, expiring automatically when the timer reaches 00:00.',
      },
      {
        name: 'Jain’s Fairness Index',
        meaning:
          'Measures allocation fairness across all 7 classes ((Σxᵢ)² / (n·Σxᵢ²)) so lower-priority classes yield during congestion without being completely starved.',
      },
    ],
    provenanceNote:
      'In DEMO mode, policy toggles, ceiling edits, and new intents immediately update the deterministic simulation state machine. In unverified LIVE mode, write actions are disabled.',
    safeActions: [
      'Create a new temporary intent and inspect the pre-apply starvation check.',
      'Click "Simulate Expiry" on an active intent, adjust class Max Ceiling (Mbps), or click "Reset to Baseline".',
    ],
  },
  experiments: {
    pageId: 'experiments',
    title: 'Experiments & Benchmarks — Side-by-Side Baseline Comparison',
    summary:
      'Compares the proposed IntentQoS policy against four reference baselines (No Shaping FIFO, Static Port QoS, Simulated FQ-CoDel, and Deterministic Adaptive without ML) under a 52 Mbps bottleneck.',
    keyMetrics: [
      {
        name: 'Median, p95 & p99 RTT Latency by Profile',
        meaning:
          'Shows how static shaping fails when WAN capacity drops below its fixed ceiling, and how combining capacity tracking with early-flow classification minimizes tail latency.',
      },
      {
        name: 'Per-Class Egress Allocation & Jain’s Index',
        meaning:
          'Demonstrates interactive flow protection alongside bulk download containment.',
      },
    ],
    provenanceNote:
      'Linux kernel CAKE/FQ-CoDel and OpenFlow shapers do not execute inside the browser. All benchmark rows are illustrative reference simulations tagged with `isSimulatedBaseline: true`.',
    safeActions: [
      'Toggle any combination of ≥2 benchmark profiles to compare charts and table rows side by side.',
      'Export the comparison table with full provenance metadata to CSV or JSON.',
    ],
  },
  models: {
    pageId: 'models',
    title: 'Model Insights — Nano-Stream INT8 Holdout Evaluation',
    summary:
      'Presents offline holdout evaluation metrics for the Nano-Stream early-flow classifier, comparing the 312 KB INT8 quantized checkpoint against the FP32 baseline.',
    keyMetrics: [
      {
        name: 'INT8 vs. FP32 Footprint & Latency',
        meaning:
          'INT8 quantization reduces model size by 73.5% (312 KB vs. 1,180 KB) and median CPU inference latency from 410 µs to 142 µs.',
      },
      {
        name: '7×7 Confusion Matrix & Confidence Distribution',
        meaning:
          'Shows per-class precision/recall across N = 14,000 holdout flows and illustrates how the <0.65 confidence gate catches ambiguous flows.',
      },
    ],
    provenanceNote:
      'Displays offline reference evaluation metrics. The current Python Ryu prototype feeds synthetic features rather than live packet captures.',
    safeActions: [
      'Inspect per-class precision, recall, F1, and off-diagonal confusion counts.',
      'Compare offline holdout confidence buckets against the simulated demo stream.',
    ],
  },
  diagnostics: {
    pageId: 'diagnostics',
    title: 'Settings & Diagnostics — Connectivity, Theme & Structured Logs',
    summary:
      'Controls telemetry mode (DEMO / REPLAY vs. LIVE), L5 Light / D1 Dark theme, reduced motion accessibility, polling cadence, and sanitized diagnostic bundle exports.',
    keyMetrics: [
      {
        name: 'Live Endpoint Reachability (/api/health)',
        meaning:
          'Tests real HTTP connectivity to the configured REST bridge and reports honest component states without fabricating green status indicators.',
      },
      {
        name: 'Structured System & Adapter Logs',
        meaning:
          'Filterable event log with correlation IDs across FRONTEND, DEMO_ENGINE, API_CLIENT, and POLICY_SIM components.',
      },
    ],
    provenanceNote:
      'All diagnostic exports omit API keys, credentials, and packet payloads by design.',
    safeActions: [
      'Test `/api/health` connectivity, switch between L5 Light and D1 Dark themes, toggle Reduced Motion, or export the JSON diagnostics bundle.',
    ],
  },
};

/**
 * Normalizes a search string for case-insensitive, punctuation-tolerant matching.
 */
export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’`"_/\\()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Searches the local glossary by term, alias, category, definition, and page name.
 * Ranks exact term/alias matches first, followed by prefix/substring matches, then body matches.
 */
export function searchGlossary(
  query: string,
  category: GlossaryCategory | 'ALL' = 'ALL'
): GlossaryEntry[] {
  const pool =
    category === 'ALL'
      ? GLOSSARY_ENTRIES
      : GLOSSARY_ENTRIES.filter((entry) => entry.category === category);

  const normQuery = normalizeSearchText(query);
  if (!normQuery) {
    return pool;
  }

  const scored: { entry: GlossaryEntry; score: number }[] = [];

  for (const entry of pool) {
    const normTerm = normalizeSearchText(entry.term);
    const normAliases = entry.aliases.map(normalizeSearchText);
    const normCategory = normalizeSearchText(entry.category);
    const normShort = normalizeSearchText(entry.shortDefinition);
    const normProject = normalizeSearchText(entry.projectMeaning);
    const normWhere = normalizeSearchText(entry.whereYouSeeIt);

    let score = 0;

    if (normTerm === normQuery || normAliases.includes(normQuery)) {
      score = 100;
    } else if (
      normTerm.startsWith(normQuery) ||
      normAliases.some((a) => a.startsWith(normQuery))
    ) {
      score = 85;
    } else if (
      normTerm.includes(normQuery) ||
      normAliases.some((a) => a.includes(normQuery)) ||
      normAliases.some((a) => normQuery.includes(a) && a.length >= 3)
    ) {
      score = 70;
    } else if (normCategory.includes(normQuery) || normWhere.includes(normQuery)) {
      score = 50;
    } else if (normShort.includes(normQuery) || normProject.includes(normQuery)) {
      score = 35;
    } else {
      // Multi-word token match fallback
      const tokens = normQuery.split(' ').filter((t) => t.length >= 2);
      if (tokens.length > 1) {
        const combined = `${normTerm} ${normAliases.join(' ')} ${normShort} ${normProject}`;
        const matchedCount = tokens.filter((t) => combined.includes(t)).length;
        if (matchedCount === tokens.length) {
          score = 45;
        } else if (matchedCount >= Math.ceil(tokens.length * 0.6)) {
          score = 25;
        }
      }
    }

    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).map((item) => item.entry);
}

/**
 * Finds the single best curated glossary match for a user-highlighted text selection.
 * Returns null if no strong or reasonable match is found so the UI can offer Gemini.
 */
export function findBestGlossaryMatch(selectedText: string): GlossaryEntry | null {
  const norm = normalizeSearchText(selectedText);
  if (!norm || norm.length < 2) return null;

  // 1. Exact term or alias match
  for (const entry of GLOSSARY_ENTRIES) {
    if (
      normalizeSearchText(entry.term) === norm ||
      entry.aliases.some((a) => normalizeSearchText(a) === norm)
    ) {
      return entry;
    }
  }

  // 2. Selected text contains a known alias (or alias contains selected text)
  let bestEntry: GlossaryEntry | null = null;
  let bestScore = 0;

  for (const entry of GLOSSARY_ENTRIES) {
    const normTerm = normalizeSearchText(entry.term);
    if (norm.includes(normTerm) || (normTerm.includes(norm) && norm.length >= 3)) {
      const s = 80;
      if (s > bestScore) {
        bestScore = s;
        bestEntry = entry;
      }
    }
    for (const alias of entry.aliases) {
      const normAlias = normalizeSearchText(alias);
      if (normAlias.length < 3) continue;
      if (norm.includes(normAlias) || (normAlias.includes(norm) && norm.length >= 3)) {
        const s = Math.min(78, 50 + normAlias.length);
        if (s > bestScore) {
          bestScore = s;
          bestEntry = entry;
        }
      }
    }
  }

  if (bestEntry) return bestEntry;

  // 3. Fallback to top search result if query is concise (<= 5 words)
  const wordCount = norm.split(' ').length;
  if (wordCount <= 5) {
    const results = searchGlossary(norm);
    if (results.length > 0) {
      return results[0];
    }
  }

  return null;
}

export const MAX_SELECTION_CHARS = 500;

/**
 * Validates whether a highlighted text snippet is eligible for the selection toolbar.
 */
export function validateSelectionText(rawText: string): {
  eligible: boolean;
  cleaned: string;
  reason?: 'empty' | 'too_short' | 'too_long';
} {
  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return { eligible: false, cleaned: '', reason: 'empty' };
  }
  if (cleaned.length < 2) {
    return { eligible: false, cleaned, reason: 'too_short' };
  }
  if (cleaned.length > MAX_SELECTION_CHARS) {
    return { eligible: false, cleaned: cleaned.slice(0, MAX_SELECTION_CHARS), reason: 'too_long' };
  }
  return { eligible: true, cleaned };
}

/**
 * Guards keyboard shortcuts (`/` or `Ctrl/Cmd+K` or `Ctrl/Cmd+Shift+E`) so they never trigger
 * while the user is typing in an input, textarea, select, contenteditable element, or when a modal blocks them.
 */
export function shouldIgnoreKeyboardShortcut(
  target: { tagName?: string; isContentEditable?: boolean } | null,
  isBlockingModalOpen = false
): boolean {
  if (isBlockingModalOpen) return true;
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Resolves initial desktop sidebar collapsed state.
 * Defaults to `true` (narrow icon-first rail, Task-Manager style) on desktop when no preference is stored.
 */
export function resolveInitialSidebarCollapsed(storedValue: string | null): boolean {
  if (storedValue === 'false') return false;
  if (storedValue === 'true') return true;
  return true;
}

/**
 * Validates and sanitizes incoming `/api/help/chat` requests.
 */
export function validateHelpChatRequest(body: unknown): {
  valid: boolean;
  error?: string;
  sanitized?: HelpChatRequestPayload;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }

  const raw = body as Record<string, unknown>;
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';
  if (!message) {
    return { valid: false, error: 'Question message cannot be empty.' };
  }
  if (message.length > 800) {
    return { valid: false, error: 'Question message exceeds maximum length of 800 characters.' };
  }

  let selectedText: string | undefined;
  if (typeof raw.selectedText === 'string' && raw.selectedText.trim()) {
    selectedText = raw.selectedText.trim().slice(0, MAX_SELECTION_CHARS);
  }

  const validPages: PageId[] = [
    'overview',
    'traffic',
    'capacity',
    'policy',
    'experiments',
    'models',
    'diagnostics',
  ];
  const activePage =
    typeof raw.activePage === 'string' && validPages.includes(raw.activePage as PageId)
      ? (raw.activePage as PageId)
      : undefined;

  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  if (Array.isArray(raw.history)) {
    for (const item of raw.history.slice(-6)) {
      if (
        item &&
        typeof item === 'object' &&
        ((item as Record<string, unknown>).role === 'user' ||
          (item as Record<string, unknown>).role === 'assistant') &&
        typeof (item as Record<string, unknown>).content === 'string'
      ) {
        const content = ((item as Record<string, unknown>).content as string).trim().slice(0, 600);
        if (content) {
          history.push({
            role: (item as Record<string, unknown>).role as 'user' | 'assistant',
            content,
          });
        }
      }
    }
  }

  return {
    valid: true,
    sanitized: {
      message,
      selectedText,
      activePage,
      history,
    },
  };
}
