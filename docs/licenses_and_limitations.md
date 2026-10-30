# Licenses, Data Attribution & Technical Limitations

**Project:** IntentQoS — Adaptive QoS Engine for Mixed Home Broadband Traffic  
**Date:** 30 October 2026  
**Document Status:** Approved  

---

## 1. Third-Party Licenses & Attributions

| Software Component | License | Purpose / Attribution |
|---|---|---|
| **Nano-Stream Research Foundation** | MIT License / IEEE Publication | Quantized online 1D-CNN architecture (IEEE Xplore doc 11504604). |
| **PyTorch (`torch`)** | BSD-3-Clause | Deep learning inference and quantization runtime. |
| **FastAPI** | MIT License | High-performance asynchronous management API framework. |
| **Uvicorn** | BSD-3-Clause | ASGI server implementation. |
| **React & React DOM** | MIT License | User interface rendering engine. |
| **Vite** | MIT License | Modern web frontend build tool and dev server. |
| **Tailwind CSS** | MIT License | Utility-first CSS styling framework. |
| **Lucide React** | ISC License | System interface iconography. |
| **Recharts** | MIT License | SVG-based data visualization library. |
| **Scikit-learn** | BSD-3-Clause | Preprocessing scalers, metrics, and baseline models. |
| **Pandas & NumPy** | BSD-3-Clause | Tabular data manipulation and numerical tensor operations. |
| **Linux `iproute2` (`tc`)** | GNU General Public License (GPL) v2 | Linux kernel data-plane traffic control and queue scheduling. |

---

## 2. Research Scope & Prototype Boundaries

### 2.1 Research Foundation
IntentQoS builds upon the foundational research of *Nano-Stream: Quantized Online 1D-CNN for Adaptive Traffic Classification and Dynamic QoS in SDN* (IEEE 11504604). While the original Nano-Stream prototype focused on security intrusion detection (CIC-IDS2017), IntentQoS translates the lightweight INT8 1D-CNN architecture into the residential broadband quality-of-service domain.

### 2.2 Prototype vs. Production Boundary
1. **Target Environment:** This implementation is an experimental research demonstrator tested on standard Linux (kernel 6.x) with simulated and emulated network topologies. It is **not** a commercially certified firmware distribution for off-the-shelf residential consumer routers.
2. **Privilege Demarcation:** In actual production deployment, the management API would run as an unprivileged user, communicating with a narrow, isolated system daemon with `CAP_NET_ADMIN` to manage `tc`.

---

## 3. Known Technical Limitations

### 3.1 Encrypted Traffic Ambiguity
- IntentQoS strictly operates on Layer 3/Layer 4 packet header statistics (packet lengths, inter-arrival times, transport ports, and directionality). It deliberately **never** decrypts TLS payloads or inspects application contents.
- Consequently, when applications use identical multiplexed protocols (such as HTTP/3 over QUIC with padding), statistical discrimination between high-bitrate streaming and bulk background downloads requires observing at least 15–20 packets.
- Flows with insufficient observations or low confidence are routed to the `UNKNOWN` safe default queue under FQ-CoDel fair queueing.

### 3.2 Wi-Fi and Cellular Jitter
- The testbed evaluation models bottleneck latency primarily at the wired gateway/WAN boundary. On real consumer Wi-Fi networks (802.11ac/ax), radio contention, beamforming retries, and client distance introduce local wireless jitter that cannot be resolved solely at the router egress shaper.

### 3.3 Dynamic Capacity Tracking
- The capacity estimator uses a combination of configured rates (testbed ground truth) and EWMA-filtered throughput with queue-delay sensing. In real-world DOCSIS cable or 5G fixed wireless links where bandwidth fluctuates rapidly every second, adaptation requires tuning hysteresis and cooldown parameters to prevent rate thrashing.

### 3.4 Online Retraining Non-Goal
- Autonomous online retraining of neural weights in live production networks is explicitly excluded as an unsafe anti-pattern. Model weights are trained offline with session-level cross-validation and cryptographically verified on load.
