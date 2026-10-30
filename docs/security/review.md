# Security & Safety Audit Review — IntentQoS

**Project:** IntentQoS — Adaptive QoS Engine for Mixed Home Broadband Traffic  
**Date:** 30 October 2026  
**Auditor:** Senior Network & AI Architect  
**Review Status:** Passed with Documented Guardrails  

---

## 1. Scope of Audit

This security review audits the operational boundary between untrusted user input (from the React frontend and management REST API) and privileged network operations (Linux `tc` shaping, queue discipline configuration, and flow extraction).

---

## 2. Threat Vector Analysis & Implemented Mitigations

### 2.1 Threat: Shell Command Injection via Policy Parameters
- **Risk:** High. An attacker or malicious client could pass shell metacharacters (e.g. `; rm -rf /` or `| nc`) inside interface names, class identifiers, or shaping rate parameters.
- **Mitigation Implemented:**
  1. `enforcement/tc_adapter.py` never uses `shell=True`. All commands are executed as explicit tokenized lists via `subprocess.run(cmd_args, shell=False)`.
  2. The network interface name is validated against a strict regex whitelist: `^[a-zA-Z0-9_\-\.]{2,16}$`.
  3. All numerical rate and bandwidth parameters are parsed and cast to bounded floating-point values ($1.0 \le \text{rate} \le 10000.0\,\text{Mbps}$) before string interpolation.
  4. Class IDs are strictly mapped to an internal static enumeration (`1:10`, `1:20`, `1:30`, `1:40`, `1:50`).

### 2.2 Threat: Network Starvation via Excessive Intent Reservation
- **Risk:** High. A user or rogue application could request 100% bandwidth reservation with top priority, completely starving background and best-effort traffic.
- **Mitigation Implemented:**
  1. `policy/intent_store.py` bounds maximum intent ceiling to 80% of link capacity.
  2. `policy/engine.py` enforces a non-negotiable minimum floor ($\ge 5\%$) for every traffic category, guaranteeing forward progress for bulk and background traffic.
  3. Total bandwidth allocated to active intent floors is capped at 85% of usable WAN bandwidth.
  4. Maximum concurrent active intents are capped at 5 per gateway.

### 2.3 Threat: Indefinite Resource Lockup via Forgotten Intents
- **Risk:** Medium. A client could set high-priority intent and close the browser, leaving the shaper in a permanently skewed state.
- **Mitigation Implemented:**
  1. Expiration is server-owned: each intent record contains an absolute UTC ISO-8601 timestamp (`expires_at`).
  2. The server sweeps expired intents automatically on every evaluation tick. Expiration occurs regardless of client connection state.
  3. Maximum intent TTL is clamped between 1 and 480 minutes.

### 2.4 Threat: Privacy Violation & Private Payload Exposure
- **Risk:** Critical. Capturing private user traffic on home routers could leak sensitive credentials, personal messages, or browsed URLs.
- **Mitigation Implemented:**
  1. Privacy-by-default architecture: `telemetry/flow_extractor.py` only observes Layer 3/4 header metadata (IP addresses, transport ports, packet lengths, arrival timestamps, and TCP flags).
  2. Application payloads are never read, buffered, or written to disk.
  3. Flow tables store aggregate summaries; individual packet traces are discarded after early-flow feature extraction.

### 2.5 Threat: Model Poisoning or Unchecked Retraining in Production
- **Risk:** High. Automated online learning could be manipulated by adversarial traffic patterns to degrade QoS for specific applications.
- **Mitigation Implemented:**
  1. Model retraining is strictly offline. No unsupervised online weight updates occur in the live data plane.
  2. `models/model_loader.py` cryptographically verifies model artifact SHA-256 checksums against `docs/artifacts_manifest.json` before instantiating weights.
  3. If a model artifact is corrupt or missing, the system gracefully falls back to deterministic port heuristics and safe FQ-CoDel queueing.

### 2.6 Threat: Memory Exhaustion via Flow Table Flooding
- **Risk:** High. High-frequency SYN scans or spoofed UDP bursts could generate millions of unique flow keys, exhausting gateway RAM.
- **Mitigation Implemented:**
  1. Active flows are capped at a maximum of 10,000 entries.
  2. Idle flows expire after 30 seconds of inactivity.
  3. Under memory pressure, oldest inactive flows are purged automatically.

### 2.7 Threat: API Key and Secret Leakage
- **Risk:** High. Hardcoding Gemini API keys in client JavaScript or committed repositories.
- **Mitigation Implemented:**
  1. No API keys are embedded in frontend client code.
  2. The server-side proxy in `server.ts` uses environment variables (`process.env.GEMINI_API_KEY`) and never reflects keys in API responses or diagnostic exports.
  3. When the key is unconfigured, the system automatically falls back to the curated local glossary without errors.

---

## 3. Security Verification Checklist

- [x] Command injection impossible: no `shell=True` and all arguments allowlisted.
- [x] Strict privilege separation: unprivileged management API runs independently from network shaper.
- [x] No plaintext user payloads collected or stored.
- [x] Server-enforced intent expiry independent of browser state.
- [x] Guaranteed anti-starvation minimum service floors.
- [x] Cryptographic artifact verification on model load.
- [x] Bounded in-memory flow state with automated idle pruning.
- [x] Zero hardcoded credentials or API keys.
