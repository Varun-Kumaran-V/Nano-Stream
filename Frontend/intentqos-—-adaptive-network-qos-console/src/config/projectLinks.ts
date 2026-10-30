/**
 * Central configuration for external research references, repository status,
 * and capability readiness disclosures.
 *
 * Truthfulness rule: Never fabricate a GitHub repository URL. Keep SOURCE_REPO_URL
 * null until a verified public repository URL is provided by the project authors.
 */

export const PROJECT_LINKS = {
  ieeePaperUrl: 'https://ieeexplore.ieee.org/abstract/document/11504604/',
  ieeePaperTitle: 'Nano-Stream Research Paper (IEEE Xplore #11504604)',
  sourceRepoUrl: null as string | null,
  sourceRepoFallbackLabel: 'Source code link coming soon',
} as const;

export type ReadinessStatus =
  | 'Research foundation'
  | 'Available in demo'
  | 'Prototype concept · Backend integration required';

export interface CapabilityPillar {
  index: string;
  title: string;
  status: ReadinessStatus;
  summary: string;
  technicalDetail: string;
  colSpan: 'wide' | 'narrow';
}

export const CAPABILITY_PILLARS: CapabilityPillar[] = [
  {
    index: '01',
    title: 'Resource-efficient early-flow classification',
    status: 'Research foundation',
    summary:
      'Builds on the Nano-Stream architecture to classify traffic using compact statistical features from the first 32 packets rather than deep packet payload inspection.',
    technicalDetail:
      'Packet lengths, inter-arrival timing (IAT), and directional ratios are evaluated once per flow. In the interactive console, reference INT8 holdout metrics (312 KB checkpoint, 142 µs median inference) are replayed deterministically.',
    colSpan: 'wide',
  },
  {
    index: '02',
    title: 'Explicit unknown & low-confidence gating',
    status: 'Available in demo',
    summary:
      'Real home networks encounter unfamiliar encrypted tunnels and novel traffic. Flows scoring below the 0.65 confidence threshold are routed to a safe default queue instead of being misclassified.',
    technicalDetail:
      'Prevents an uncertain bulk transfer from masquerading as a high-priority video call or gaming stream.',
    colSpan: 'narrow',
  },
  {
    index: '03',
    title: 'Capacity-aware anti-bufferbloat headroom',
    status: 'Prototype concept · Backend integration required',
    summary:
      'Static QoS rules fail when ISP last-mile capacity drops below the router’s configured ceiling. IntentQoS models a dynamic shaping ceiling set 5% below estimated WAN capacity.',
    technicalDetail:
      'Demonstrated via deterministic step-down (120 → 52 Mbps) and step-up recovery scenarios in the console; live passive RTT-gradient estimation requires the Python/SDN backend bridge.',
    colSpan: 'narrow',
  },
  {
    index: '04',
    title: 'Bounded temporary user intents & Jain’s fairness',
    status: 'Available in demo',
    summary:
      'Operators can declare time-bounded session intents (for example, protecting a telehealth call for 30 minutes) with pre-apply starvation checks and Jain’s fairness monitoring.',
    technicalDetail:
      'Every policy enforces minimum class bandwidth floors so lower-priority downloads and cloud backups yield during congestion without stalling completely.',
    colSpan: 'wide',
  },
];
