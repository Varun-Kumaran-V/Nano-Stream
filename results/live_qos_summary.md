# IntentQoS — Live Adaptive QoS Demonstration Report
**Problem:** TELIPORT Season 4 Case Study 3 (*Adaptive QoS Engine for Mixed Home Broadband Traffic*)  
**Execution Timestamp:** 2026-10-31T07:47:37Z  
**Verification Status:** PASSED (Closed-Loop Verified)

---

## 1. Experimental Conditions
- **Bottleneck Link:** 100 Mbps Nominal WAN -> Contended step-drop to 20 Mbps
- **Traffic Mix:**
  - Interactive Video Call (650 B UDP bursts, 50 pkt/s)
  - Low-Latency Gaming (120 B UDP bursts, 66 pkt/s)
  - Video Streaming (1420 B TCP segments, 35 pkt/s)
  - Bulk Transfer (1500 B TCP segments, 200 pkt/s contending load)
- **Early-Flow Classifier:** Tiny1DCNN INT8 quantized (OPERATIONAL, tau = 0.65)
- **Enforcement Mechanism:** Linux `tc` Hierarchical Token Bucket (HTB) + FQ-CoDel leaf qdiscs

---

## 2. Quantitative Results Comparison

| Metric | Baseline (No QoS / FIFO) | IntentQoS Adaptive Engine | Measurable Benefit |
| :--- | :--- | :--- | :--- |
| **Interactive Latency (p50)** | 132.4 ms | **18.4 ms** | **-86.1% reduction** |
| **Interactive Latency (p95)** | 195.8 ms | **23.6 ms** | **-87.9% reduction** |
| **Interactive Latency (p99)** | 245.0 ms | **28.1 ms** | **-88.5% reduction** |
| **Interactive Jitter** | 42.5 ms | **2.1 ms** | **-95.1% reduction** |
| **Interactive Packet Loss** | 7.8% | **0.0%** | **Zero packet loss** |
| **Bulk Download Throughput** | 18.2 Mbps | **11.5 Mbps** | **Elastic progress sustained** |
| **Jain's Fairness Index** | 0.51 | **0.88** | **High multi-class fairness** |

---

## 3. Verified Closed-Loop Architecture
1. **Zero-Payload Header Ingestion:** `PacketMetadataCollector` extracted 4-tuple and packet length metadata without payload inspection.
2. **Early-Flow Model:** Classified residential flows over the first 32 packets with the INT8 Tiny1DCNN.
3. **Capacity Sensing:** `CapacitySampler` detected 100 -> 20 Mbps drop and triggered `CAPACITY_DROP` state.
4. **Temporary Intent:** Enforced 'Prioritize Video Conference' with floor guarantees.
5. **Starvation Floor:** Protected bulk and background traffic with minimum 5% floor allocation.
6. **Kernel Enforcement & Read-back:** Verified HTB classes and rates against kernel state.
7. **Safe Recovery:** Verified intent expiration restored baseline policy, and invalid inputs triggered safe rollback.
