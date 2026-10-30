# Home Broadband Traffic Taxonomy Specification

**Document Version:** 1.0.0  
**Mapping ID:** `intentqos-taxonomy-v1`  
**Date:** 30 October 2026  
**Status:** Approved for Training, Inference, Telemetry, and API  

---

## 1. Executive Summary

This taxonomy defines the canonical application traffic categories for the **IntentQoS** mixed home broadband quality-of-service engine. It replaces historical intrusion-detection labels (from CIC-IDS2017) with categories that directly determine queueing disciplines, rate ceilings, priority bands, and bufferbloat mitigation policies on residential broadband bottlenecks.

---

## 2. Canonical Classes

| Class ID | Display Name | Priority Tier | Sensitivity Type | Target Latency | Min Floor | Max Ceil |
|---|---|---|---|---|---|---|
| `VIDEO_CALL` | Video Calls | Tier 1 (Highest) | Ultra-low latency, strict jitter | $\le 50\,\text{ms}$ | 15% | 100% |
| `GAMING` | Gaming | Tier 2 | Low latency, small packet bursts | $\le 30\,\text{ms}$ | 10% | 100% |
| `VIDEO_STREAMING` | Streaming | Tier 3 | High throughput, bufferable | $\le 150\,\text{ms}$ | 30% | 90% |
| `BULK_TRANSFER` | Bulk Downloads | Tier 5 (Lowest) | Elastic scavenger, throughput-bound | $\le 300\,\text{ms}$ | 10% | 60% |
| `BACKGROUND_UPDATE_BACKUP` | Background Sync | Tier 5 (Scavenger) | Deferrable background work | $\le 500\,\text{ms}$ | 5% | 40% |
| `INTERACTIVE_WEB_OTHER` | Interactive Browsing | Tier 4 | Responsive transactional request-reply | $\le 80\,\text{ms}$ | 20% | 90% |
| `UNKNOWN` | Unknown | Tier 4 (Safe Default)| Unclassified or low confidence | $\le 100\,\text{ms}$ | 10% | 80% |

---

## 3. Class Definitions and Annotation Rules

### 3.1 `VIDEO_CALL` (Machine ID: `0`)
- **Human Label:** Video Calls
- **Description:** Real-time bidirectional interactive audiovisual communication (Zoom, Microsoft Teams, Google Meet, WebRTC, FaceTime, Discord voice/video).
- **Traffic Profile:** Periodic UDP or TCP streams, packet sizes typically 150–1200 bytes, symmetric or near-symmetric bidirectional packet rates (30–60 packets/sec per channel), steady bitrate (500 kbps to 4 Mbps).
- **QoS Justification:** Extremely sensitive to one-way delay ($>100\,\text{ms}$ causes conversational talkover) and jitter ($>20\,\text{ms}$ degrades codec jitter buffers and causes audio robotic glitches or video freezing).
- **Queueing Treatment:** Enqueued into HTB Priority Class `1:10` (highest priority) with an attached `fq_codel` queue.

### 3.2 `GAMING` (Machine ID: `1`)
- **Human Label:** Gaming
- **Description:** Real-time multiplayer game client-server state synchronization (FPS, MOBA, battle royale engines).
- **Traffic Profile:** Highly periodic small UDP datagrams (60–250 bytes), 20–128 packets/sec tick rates, low aggregate bitrate (64 kbps to 300 kbps), minimal backward packet buffering.
- **QoS Justification:** Extreme sensitivity to packet delay and loss; any queuing delay over $40\,\text{ms}$ results in game desync, lag spikes, and dropped player inputs.
- **Queueing Treatment:** Enqueued into HTB Priority Class `1:20` (Priority 2) with `fq_codel` queue.

### 3.3 `VIDEO_STREAMING` (Machine ID: `2`)
- **Human Label:** Streaming
- **Description:** On-demand or live buffered audiovisual streaming (YouTube, Netflix, Disney+, Twitch, Amazon Prime, HLS, DASH).
- **Traffic Profile:** TCP or QUIC bursts over HTTPS; alternating ON periods (bursty high throughput to fill player buffer at 5–25 Mbps) and OFF periods (idle intervals while the media player drains the playback buffer).
- **QoS Justification:** Tolerates multi-second buffering; jitter and millisecond queuing latency have zero impact on user experience due to the multi-second client buffer, but requires adequate sustained bandwidth to avoid mid-stream re-buffering.
- **Queueing Treatment:** Enqueued into HTB Priority Class `1:30` (Priority 3).

### 3.4 `BULK_TRANSFER` (Machine ID: `3`)
- **Human Label:** Bulk Downloads
- **Description:** Large file downloads, OS ISOs, game patches (Steam, Epic Games), large file uploads.
- **Traffic Profile:** High-throughput TCP or QUIC greedy flows, full MTU packets (1420–1500 bytes), fully saturating the downstream bottleneck buffer if unconstrained.
- **QoS Justification:** Scavenger/elastic traffic. If allowed to fill the gateway queue, it triggers bufferbloat and destroys interactive gaming and calling latency. Must be throttled to prevent buffer bloat while still guaranteeing reasonable forward progress.
- **Queueing Treatment:** Enqueued into HTB Priority Class `1:50` (Priority 5, capped at 60% link ceiling during contention).

### 3.5 `BACKGROUND_UPDATE_BACKUP` (Machine ID: `4`)
- **Human Label:** Background Sync
- **Description:** Unattended background synchronization, cloud backups (Google Drive, Dropbox, OneDrive, iCloud, Time Machine), app telemetry, and silent OS updates.
- **Traffic Profile:** Sustained or periodic TCP/HTTPS transfers, elastic flow rates.
- **QoS Justification:** Non-urgent background operations. Can be deferred or delayed during peak household hours without any human user noticing.
- **Queueing Treatment:** Enqueued into HTB Class `1:50` with low quantum and strict ceiling during congestion.

### 3.6 `INTERACTIVE_WEB_OTHER` (Machine ID: `5`)
- **Human Label:** Interactive Browsing
- **Description:** General web navigation, HTTPS REST API queries, DNS lookups, e-commerce, social media feeds.
- **Traffic Profile:** Short-lived TCP/QUIC transactional connections, intermittent bursts of 5–50 packets, request-reply semantics.
- **QoS Justification:** Users expect pages to render within 1–2 seconds; requires brisk queue processing without monopolizing sustained bandwidth.
- **Queueing Treatment:** Enqueued into HTB Priority Class `1:40` (Priority 4).

### 3.7 `UNKNOWN` (Machine ID: `6`)
- **Human Label:** Unknown
- **Description:** Unidentified flows, unencrypted flows with ambiguous header statistics, flows with $< 10$ observed packets, or flows where the classifier confidence is below threshold ($\tau < 0.65$).
- **Traffic Profile:** Any.
- **QoS Justification:** Safe default handling. Must not be penalized or dropped, nor granted undeserved priority over verified interactive traffic.
- **Queueing Treatment:** Enqueued into HTB Class `1:40` (default best-effort) under FQ-CoDel fair queuing.

---

## 4. Confidence Threshold and Rejection Policy

1. **Threshold Specification:**
   $$\tau = 0.65$$
2. **Rejection Rule:**
   $$\hat{y} = \begin{cases} \arg\max_{c} p_c, & \text{if } \max_{c} p_c \ge 0.65 \text{ and } N_{\text{packets}} \ge 10 \\ \text{UNKNOWN}, & \text{otherwise} \end{cases}$$
3. **Safety Invariant:**
   An `UNKNOWN` flow is **never** dropped and **never** granted higher priority than Priority Tier 4.

---

## 5. Canonical Schema Manifest Integration

The machine IDs map to array indexes in the output softmax probability vector:
```json
{
  "mappingVersion": "intentqos-taxonomy-v1",
  "classes": [
    {"id": 0, "machineId": "VIDEO_CALL", "display": "Video Calls"},
    {"id": 1, "machineId": "GAMING", "display": "Gaming"},
    {"id": 2, "machineId": "VIDEO_STREAMING", "display": "Streaming"},
    {"id": 3, "machineId": "BULK_TRANSFER", "display": "Bulk Downloads"},
    {"id": 4, "machineId": "BACKGROUND_UPDATE_BACKUP", "display": "Background Sync"},
    {"id": 5, "machineId": "INTERACTIVE_WEB_OTHER", "display": "Interactive Browsing"},
    {"id": 6, "machineId": "UNKNOWN", "display": "Unknown"}
  ]
}
```
