# Architectural Decision Records (ADRs) — IntentQoS

**Project:** IntentQoS — Adaptive QoS Engine for Mixed Home Broadband Traffic  
**Research Foundation:** Nano-Stream (IEEE 11504604)  
**Date:** 30 October 2026  
**Document Status:** Accepted  

---

## ADR-001: Separation of Control Plane, Enforcement Engine, and Management API

### Context
In the original Nano-Stream prototype (`ryu_app/nano_guard.py`), OpenFlow packet-in events were directly coupled to model inference using simulated/random tensors. Packet classification, drop decisions, and flow-mod installations were attempted inside the Ryu event loop. Furthermore, shaping via OpenFlow meters has severe hardware and kernel limitations on typical home-gateway and software-switch deployments.

### Decision
1. **Enforcement Ownership:** Linux Traffic Control (`tc`) with Hierarchical Token Bucket (HTB) and Fair Queueing Controlled Delay (FQ-CoDel) is designated as the primary shaper and queue-discipline engine on the bottleneck interface.
2. **SDN Controller Ownership:** Ryu/OpenFlow is retained solely for L2/L3 topology forwarding and flow-level statistics collection. It does not perform inline per-packet classification or burst-rate shaping.
3. **Decoupled Management API:** A dedicated FastAPI process handles REST queries, policy previews/mutations, experiment orchestration, and SSE live streams. The API never runs inside the Ryu event loop or blocks packet processing.

### Consequences
- High-rate packet forwarding runs at wire speed in the kernel data plane.
- Control plane and API crashes cannot break network forwarding.
- Clear separation of concerns enables independent testing and verification of policy algorithms without requiring a live Mininet switch.

---

## ADR-002: Transport-Aware Flow Key and Bounded Early-Flow Telemetry

### Context
The original implementation matched flows solely on IPv4 source and destination addresses (`ipv4_src`, `ipv4_dst`), leading to flow collisions across different applications on the same host (e.g., a background backup and a video call running simultaneously on `10.0.0.2`). It also lacked transport port awareness and IPv6 support.

### Decision
1. **Flow Key Definition:**
   A 6-tuple uniquely identifies a flow:
   - `ip_version`: `IPv4` or `IPv6`
   - `protocol`: `TCP`, `UDP`, or `QUIC` (UDP/443 or UDP/80)
   - `src_ip`: String IPv4/IPv6 address
   - `dst_ip`: String IPv4/IPv6 address
   - `src_port`: Integer source port (0 for raw IP)
   - `dst_port`: Integer destination port (0 for raw IP)
2. **Early-Flow Window:**
   Telemetry extracts flow statistics from the first 32 packets of each flow (inter-arrival time statistics, packet size distribution, byte/packet volume, and bidirectional directionality).
3. **Bounded Memory & Privacy:**
   - Active flows are capped at 10,000 concurrent entries.
   - Idle flow timeout is 30 seconds.
   - Payload inspection is prohibited by design: only packet lengths, arrival timestamps, and header flags are observed. No application payloads or user content are ever stored or inspected.

### Consequences
- Simultaneous concurrent traffic streams from one household device are correctly isolated into distinct QoS classes.
- Zero risk of private user payload leakage.
- Strict $O(1)$ lookup and memory-bounded state prevent memory exhaustion under high flow churn.

---

## ADR-003: Home Broadband Traffic Taxonomy and Safe Fallback Policy

### Context
The original Nano-Stream model trained on CIC-IDS2017 security labels (`BENIGN`, `Bot`, `DDoS`, `DoS`, `FTP`, `PortScan`, `BruteForce`). These security labels are inapplicable to residential mixed-traffic quality of service.

### Decision
1. **Residential Taxonomy:**
   We establish 7 canonical traffic classes:
   - `VIDEO_CALL` (Zoom, Teams, Meet, WebRTC) — ultra-low latency, strict jitter bound.
   - `GAMING` (Multiplayer UDP/TCP game state) — low latency, small bursts.
   - `VIDEO_STREAMING` (YouTube, Netflix, DASH/HLS) — high throughput, bufferable.
   - `BULK_TRANSFER` (Large downloads, ISOs, Steam game installs) — elastic, scavenger.
   - `BACKGROUND_UPDATE_BACKUP` (Cloud backups, OS updates) — strictly deferrable.
   - `INTERACTIVE_WEB_OTHER` (HTTPS browsing, DNS, transactional APIs) — responsive best-effort.
   - `UNKNOWN` (Unrecognized or low-confidence traffic) — safe baseline default.
2. **Confidence Threshold & Unknown Gate:**
   - The classifier adapter enforces a strict confidence threshold ($\tau = 0.65$).
   - Any prediction with confidence $< 0.65$ or with insufficient packets ($< 10$ packets) is classified as `UNKNOWN`.
   - `UNKNOWN` flows are assigned to the interactive best-effort class with FQ-CoDel isolation to prevent degradation while preventing starvation.

### Consequences
- Traffic is prioritized according to genuine latency and jitter sensitivities.
- Misclassification risk is bounded: low-confidence predictions cannot starve legitimate traffic or grant undeserved priority.

---

## ADR-004: Linux `tc` Hierarchical Token Bucket (HTB) Architecture

### Context
Residential broadband routers experience bufferbloat when unshaped traffic overwhelms the upstream/downstream bottleneck buffer. A robust qdisc structure must enforce rate ceilings while maintaining sub-millisecond queuing latency for interactive traffic.

### Decision
A hierarchical token bucket (HTB) qdisc is established on the gateway WAN egress interface:
```text
                    qdisc htb 1:0 (default 1:40)
                                 |
                          class htb 1:1
                     rate $WAN_RATE ceil $WAN_RATE
                                 |
      +------------+-------------+-------------+------------+
      |            |             |             |            |
  class 1:10   class 1:20    class 1:30    class 1:40   class 1:50
  VIDEO_CALL     GAMING       STREAMING     WEB / UNK      BULK
  prio 1        prio 2        prio 3        prio 4       prio 5
  ceil 100%     ceil 100%     ceil 90%      ceil 90%     ceil 60%
      |            |             |             |            |
   fq_codel     fq_codel      fq_codel      fq_codel     fq_codel
```
1. Root qdisc `htb 1:0` shapes to the current estimated WAN capacity ($C_{\text{wan}}$).
2. Five distinct leaf classes provide strict priority bands:
   - `1:10` (Priority 1): Video Calls (rate floor 15%, ceil 100%, quantum 1500)
   - `1:20` (Priority 2): Gaming (rate floor 10%, ceil 100%, quantum 1500)
   - `1:30` (Priority 3): Video Streaming (rate floor 30%, ceil 90%, quantum 3000)
   - `1:40` (Priority 4): Interactive Web / Unknown Default (rate floor 25%, ceil 90%, quantum 3000)
   - `1:50` (Priority 5): Bulk Downloads & Background Backup (rate floor 10%, ceil 60%, quantum 6000)
3. Every leaf class attaches an inner `fq_codel` leaf qdisc to eliminate bufferbloat and ensure flow-level fairness within classes.
4. Read-back verification parses `tc -s qdisc show dev <iface>` and `tc -s class show dev <iface>` after every mutation.

### Consequences
- Latency-sensitive voice/video/gaming traffic bypasses bulk queues and experiences zero queuing delay.
- Bulk traffic cannot starve other classes because its rate is capped and lower-priority.
- FQ-CoDel prevents internal head-of-line blocking among multiple concurrent connections within any class.

---

## ADR-005: Policy Precedence, Intent Expiry, and Rollback Guard

### Context
User intents (e.g. "prioritize my work call for 30 minutes") must not cause network collapse, starve other household members, or persist indefinitely after a browser tab is closed.

### Decision
1. **Precedence Hierarchy:**
   1. Safety & Minimum Service Guarantees (No class may have floor $< 5\%$; total floors $\le 95\%$).
   2. Active Temporary User Intent (bounded by TTL and bandwidth ceiling).
   3. Congestion & Capacity Feedback (rate adaptation to avoid bottleneck buffer buildup).
   4. Early-Flow ML Classification ($\tau \ge 0.65$).
   5. Safe Fallback Default (FQ-CoDel best-effort).
2. **Server-Owned Expiry:**
   - Intent records store an absolute UTC timestamp `expires_at`.
   - The policy engine checks `expires_at <= now()` on every policy evaluation tick and automatically transitions expired intents to `EXPIRED`.
3. **Rollback Guard:**
   - If an enforcement command fails or if post-application latency exceeds safety thresholds ($p95 > 150\,\text{ms}$ sustained for $> 3$ sampling ticks), the adapter immediately rolls back to the known-safe baseline configuration.
   - All mutations require explicit preview, state versioning, and structured audit logs.

### Consequences
- Safe-by-default behavior across server restarts and client disconnects.
- Guaranteed protection against starvation.
- Auditable trail of all configuration mutations and automated rollbacks.
