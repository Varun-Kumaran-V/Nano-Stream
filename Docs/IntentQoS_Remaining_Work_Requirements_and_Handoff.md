# IntentQoS — Remaining Work Requirements & Engineering Handoff

**Document version:** 1.0  
**Prepared:** 30 October 2026  
**Purpose:** Implementation handoff for the teammate completing backend work, model/runtime integration, API contracts, frontend-backend connection, validation, and final TELIPORT evidence.  
**Project:** Tata Elxsi TELIPORT Season 4 — Case Study 3, *Adaptive QoS Engine for Mixed Home Broadband Traffic*  
**Research foundation:** Nano-Stream, *“Nano-Stream: Quantized Online 1D-CNN for Adaptive Traffic Classification and Dynamic QoS in SDN”*, IEEE Xplore document 11504604.  
**Primary source archives reviewed:** `Traffic CLassification.zip`, `intentqos-—-adaptive-network-qos-console.zip`, and the older frontend archive `intentqos-—-adaptive-network-qos-console (1).zip`, plus the existing repository audit, backlog, frontend audit, README and supplied Case Study 3 PDF.

> **Handoff rule:** The user says the current frontend visuals are finished and satisfactory. Treat the visual redesign as accepted. Do not redesign, replace, or simplify the UI as part of backend work. The newest frontend archive was not supplied for this handoff, so verify the current working tree before changing interfaces. This document describes the older source archives and their evidence, not an assertion that the newest local frontend is identical.

---

## 0. How to use this document

This is the working source of truth for remaining engineering work. The companion CSV `IntentQoS_Remaining_Work_Tracker.csv` is the task tracker.

For each requirement:
1. Read the existing implementation before coding.
2. Mark it **Done / Partial / Blocked / Not started / Not applicable** only with evidence.
3. Record the changed files, test command, actual result and any known limitation.
4. Do not mark a feature done because its UI exists or a simulated value appears.
5. Keep research simulation, lab measurement and real connected-network operation explicitly distinct.
6. Do not overwrite the original Nano-Stream artifacts. Work in a branch and preserve the old model/checkpoints as historical baselines.

### Status vocabulary

- **Present in old source:** directly observed in an archive.
- **Partial/prototype:** some relevant code exists, but it does not meet the complete requirement.
- **Missing in audited source:** not found in the supplied archive; re-check the current branch before implementation.
- **User-confirmed complete:** the user says the latest frontend visuals are satisfactory; this is not independent source verification.
- **Unverified:** cannot be established from the older archive or without running the system.

### Priority vocabulary

- **P0 — core demonstrator:** required for an honest, repeatable end-to-end Case Study 3 prototype.
- **P1 — research credibility and robustness:** needed to support meaningful comparisons, security, reproducibility and a defensible technical report.
- **P2 — extension:** useful only after the P0 path is stable; not a reason to delay the core deliverable.

---

# 1. Project objective and boundaries

## 1.1 Required outcome

Build an independently testable, resource-conscious, privacy-preserving adaptive QoS reference prototype for mixed home broadband traffic. It should:

1. Observe flow metadata without decrypting application traffic or inspecting private payloads.
2. Classify broad traffic categories relevant to household QoS, including an explicit unknown/low-confidence path.
3. Estimate or measure the current usable bottleneck capacity in the declared test environment.
4. accept temporary, explicit user intent (for example, prioritize a work call for 30 minutes) with expiry and resource bounds.
5. Select a queueing/shaping policy using explainable rules, capacity, congestion, confidence, intent and fairness constraints.
6. Apply that policy through an inspectable mechanism such as Linux `tc` (and use Ryu/OpenFlow only where justified).
7. Observe the result, verify that the intended policy was applied, and roll back safely if it fails or harms service.
8. Show truthful measurements in the existing frontend.
9. Compare the proposed system against strong non-ML and queue-management baselines using identical scenarios.
10. Reproduce a selected demo and export configuration, raw measurements and a result report.

**The core claim is not “AI improves QoS.”** The hypothesis to test is whether metadata classification plus temporary intent and bounded adaptation improves selected user-experience metrics over strong deterministic/static baselines without unacceptable fairness, starvation, stability or overhead costs.

## 1.2 Case Study 3 constraints that are mandatory

The supplied brief requires:
- Broad traffic classification without decrypting private payloads.
- Link-capacity estimation.
- Queueing and shaping policy application.
- Verification that a policy improved user experience.
- Temporary user intent.
- IPv4 and IPv6 support where available.
- Policy rollback and prevention of starvation.
- Classifier confidence and a correction path for misclassification.
- Reproducible generated traffic and network impairment settings.
- Documentation of licenses, prototype/production boundary, hardware/security/performance limitations.
- A scripted or automated demonstration that resets the environment, introduces a condition, collects evidence and generates a result report.
- An architecture diagram, setup guide, and known-limitations section.

## 1.3 Explicit non-goals for the first working version

Do not make these prerequisites for a credible P0:
- Production home-router deployment or commercial product certification.
- Cloud-scale multi-tenant orchestration.
- Decryption, DPI of private payloads, TLS interception or collection of user content.
- Unsupervised self-modification of model weights in a live network.
- A large learned reinforcement-learning controller.
- 3D visuals in the operator dashboard (the current frontend is already accepted; keep its design).
- A promise that every real application can be identified perfectly from encrypted metadata.
- A claim that the existing CIC-IDS model already classifies video calls, games, streaming or background backups.

---

# 2. What the audited source actually contains

## 2.1 Research repository: `Traffic CLassification.zip`

The archive contained 73 ZIP entries, including model/checkpoint artifacts, source, scripts, metadata, results and docs. The raw CIC datasets were not included.

### Present or reusable
- `models/tiny_1d_cnn.py`: small 1D-CNN candidate.
- `models/bilstm_baseline.py`: BiLSTM baseline.
- `models/transformer_baseline.py`: Transformer baseline, but with a correctness bug noted below.
- `features.json`: ordered 14-feature schema.
- `train.py`: training path.
- `scripts/create_slice.py`: CIC-IDS2017 slice preparation.
- `scripts/run_boruta.py` and `metrics/boruta_ranking.csv`: feature-ranking artifacts.
- `scripts/quantize_run.py`, `scripts/create_float_script.py`: quantization/TorchScript paths.
- `scripts/measure_latency.py`: latency benchmark, with an input-shape bug.
- `scripts/test_cross_dataset.py`: cross-dataset evaluation attempt, with methodology problems.
- `ryu_app/nano_guard.py`: Ryu/OpenFlow proof-of-concept controller.
- Checkpoints and `results/experiment_log.csv`.
- README, requirements and design notes.

### Confirmed problems from the audit
1. The current seven-label mapping is IDS/security oriented (`BENIGN`, `Bot`, `DDoS`, `DoS`, `FTP`, `PortScan`, `BruteForce` in the controller mapping), not home-application QoS oriented.
2. The Ryu packet-in handler feeds random features to the classifier; predictions therefore do not describe observed traffic.
3. No stateful flow-feature extractor was found in the controller: no proper packet/byte counters, flow duration, inter-arrival measurements, active-flow expiry or complete bidirectional aggregation.
4. The Ryu app loads `checkpoints/quantized.pt`, while the archive contains `checkpoints/cnn_quantized.pt`; reconcile the artifact path and manifest.
5. Only DDoS has an explicit drop action; other predictions are flooded. There is no complete policy-to-queue/shaping loop.
6. The flow match uses only IPv4 source/destination addresses and can overmatch transport flows; IPv6 is ignored.
7. Training has no independent held-out test set, no saved label map, no persisted preprocessing/schema manifest, and the “best validation checkpoint” may be overwritten by the final epoch.
8. `--label` is accepted but the main path uses the literal `label` column, making the option ineffective.
9. The Boruta feature path does not correctly filter `Support=True`; current flow can select all 14 rows.
10. The quantization script dynamically quantizes Linear layers; it does not prove Conv1D operations are INT8.
11. The latency script selects input shape based on a filename substring; the float scripted model is given a 2D input incorrectly. It also lacks a complete hardware/configuration manifest and raw sample export.
12. The cross-dataset script hardcodes a single file, changes feature order, and independently encodes labels; its output is not a reliable general cross-dataset score.
13. The Transformer positional encoding uses the wrong dimension for `batch_first=True`; do not compare its current metrics until fixed and rerun.
14. The old repository did not include the frontend app, a complete management API, a clean end-to-end benchmark harness, raw datasets, a lockfile or a reproducible container definition.

### Consequence

Nano-Stream is a useful research foundation and model candidate. It is **not** evidence that the home-traffic QoS task has already been solved. Keep the old IDS task and artifacts separately labelled; build a new home-traffic dataset, class map and runtime pipeline.

## 2.2 Older frontend archive

The older React frontend source has:
- React 19 + TypeScript + Vite, Tailwind CSS v4.
- `motion`, `recharts`, and `lucide-react`.
- `src/App.tsx`: app shell, page navigation, scenario/demo playback, DEMO/LIVE selector, policy/intent state and page composition.
- `src/services/demoEngine.ts`: deterministic seeded simulation, scenarios, metric series, flow/event generation, initial policy/intent state, model/benchmark display data and export helpers.
- `src/services/dataProvider.ts`: demo health and a real `/health` probe. It rejects non-JSON/non-healthy responses and withholds synthetic data in disconnected LIVE mode.
- `src/types/qos.ts`: frontend domain types for health, metrics, flows, capacity, policies, intents, events, experiments, model evaluation and diagnostics.
- `src/components/NetworkTopology2D.tsx`: interactive 2D SVG topology.
- `src/components/ScenarioControlBar.tsx`, `LiveDisconnectedPanel.tsx`, `SpotlightCard.tsx`.
- Seven pages: Overview, Live Traffic, Capacity & Congestion, Intents & Policy, Experiments & Benchmarks, Model Insights, Settings & Diagnostics.
- A frontend test for `demoEngine.ts`.
- In the later supplied frontend archive: `LandingPage.tsx`, `NetworkHeroScene.tsx`, `ThemeContext.tsx`, `ThemeToggle.tsx`, and `src/config/projectLinks.ts` were also present, including the chosen L5 Light / D1 Dark themes.

### User-confirmed current state
The user states that the frontend is now visually complete and satisfactory. Continue to use the latest frontend code in the teammate's working branch, even though that latest archive was not provided for this handoff.

### Important integration warning
The older frontend's data types and demo state are a **contract proposal**, not a verified backend contract. `dataProvider.ts` only proves the `/health` probe exists on the frontend. The management API endpoints and actual live data provider must be implemented and documented. The UI's simulated `ExperimentRun`, `ModelEvaluation`, `QoSPolicy`, `UserIntent` and `FlowRecord` values must not be returned as live facts unless they are measured or loaded from a verified backend.

---

# 3. Target architecture and process boundaries

## 3.1 Recommended minimum architecture

```text
Traffic generators / Mininet hosts
          |
          v
Linux bridge / OVS / bottleneck link
          |
          +---- flow observations and interface/qdisc counters
          |                 |
          v                 v
Flow feature extractor   Capacity & QoS telemetry sampler
          |                 |
          v                 v
Classifier adapter <--- schema/model manifest
          |                 |
          +--------+--------+
                   v
           Intent store + policy engine
                   |
            policy preview/validation
                   |
                   v
        Enforcement adapter (Linux tc first)
                   |
            apply + read-back verification
                   |
                   v
          QoS feedback / rollback guard
                   |
                   v
        Management API (separate process)
                   |
       REST commands/history + SSE telemetry
                   |
                   v
       Existing IntentQoS React frontend
```

The management API must not run in the Ryu packet-event hot path. Long-running experiments must run in a worker/job process, not block the HTTP event loop or OpenFlow packet processing.

## 3.2 Suggested process split

- **Experiment/testbed process:** creates/resets Mininet topology, traffic generators and link impairment; runs baseline/policy schedules and gathers measurements.
- **Flow telemetry/classifier service:** maintains bounded flow windows and invokes the classifier adapter.
- **Policy engine:** deterministic, pure or near-pure module that returns a proposed policy from a state snapshot.
- **Enforcement adapter:** narrowly scoped privileged code for `tc`/OVS operations. No arbitrary shell command strings from UI/API input.
- **Capacity/QoS sampler:** gathers configured rate and measured throughput, RTT, jitter, loss, queue/backlog and qdisc state.
- **Management API:** recommended Python FastAPI process; REST for queries/mutations, SSE for one-way live telemetry where useful.
- **Ryu:** retain only if OpenFlow is needed for the chosen testbed. Do not force all shaping into Ryu; Linux `tc` is the first recommended enforcement path.
- **Persistence:** SQLite is sufficient for local run/configuration/event history at prototype scale; retain raw run artifacts as files with manifests.
- **Frontend:** existing React SPA. Integrate via typed API client and explicit provider state; don't rebuild its visual layout.
- **Optional Gemini help:** if the latest UI has the Help/Gemini feature, connect it through a secure server-side endpoint. This is separate from the QoS control plane and must never be able to execute network commands.

## 3.3 Architecture decisions to record before implementation

Create `docs/architecture/decisions.md` or ADRs and record:
1. Linux `tc` qdisc hierarchy and interface direction.
2. Whether Ryu is retained, and precisely what it owns.
3. Flow key (IP version, src/dst, protocol, ports, direction, interface/VLAN if relevant).
4. Feature-window length, update interval, flow expiry and memory cap.
5. Model artifact format/runtime (PyTorch, TorchScript or other), Python version and CPU requirements.
6. Capacity estimator inputs and ground truth in Mininet.
7. Policy precedence and conflict resolution.
8. Persistence and retention.
9. REST/SSE API versions and stale-data rules.
10. Safe fallback profile and rollback trigger.
11. IPv6 scope and unsupported protocol behaviour.
12. Experiment baselines and metrics.

Do not add a new framework just because it is familiar; pick the smallest dependable stack that can be reproduced.

---

# 4. Canonical domain contract

Before the API is wired to the frontend, establish one canonical source for each domain object. Avoid independently re-defining labels or units in Python and TypeScript.

## 4.1 Canonical traffic taxonomy

The new task needs a home-broadband taxonomy. Proposed starting taxonomy:
- `VIDEO_CALL`
- `GAMING`
- `VIDEO_STREAMING`
- `BULK_TRANSFER`
- `BACKGROUND_UPDATE_BACKUP`
- `INTERACTIVE_WEB_OTHER`
- `UNKNOWN`

This is a proposed taxonomy, not a claim that the model already recognizes these classes. Finalize class definitions and annotation rules before collecting data. If voice is tested separately, add `VOICE` explicitly rather than silently folding it into another class.

Every class needs:
- Stable machine ID and human-readable label.
- Annotation/traffic-generation rule.
- Expected QoS sensitivity and why.
- Training/evaluation support count.
- Confidence/unknown policy.
- Versioned mapping ID.

## 4.2 Feature schema and units

- Keep feature names, order, type, units, aggregation window, missing-value handling and preprocessing version in a single versioned manifest.
- The model loader must validate the exact schema and class-map version.
- Do not assume the old 14 CIC features are suitable for the home-traffic task. Audit which are computable from real flow telemetry and define a new feature schema as required.
- Do not infer a feature from data the runtime cannot actually observe.
- If a feature cannot be computed reliably, remove it or explicitly mark it unavailable; do not silently substitute random or zero values.
- Add a test that permuting the feature order or changing schema version causes a clear load/prediction error rather than a plausible wrong prediction.

## 4.3 Required object shapes (adapt field names only through a documented versioned contract)

These shapes align with the older UI's `src/types/qos.ts`; they are not yet an implemented OpenAPI contract.

**Health**
```json
{
  "status": "ok",
  "apiVersion": "v1",
  "timestamp": "2026-10-30T00:00:00Z",
  "components": [
    {
      "id": "api",
      "name": "IntentQoS API",
      "state": "OPERATIONAL",
      "version": "0.1.0",
      "lastChecked": "2026-10-30T00:00:00Z",
      "detail": "Management API ready"
    }
  ]
}
```
Only report `OPERATIONAL` for a component after a real check. If the classifier, controller or shaper has not been verified, report `UNKNOWN`, `NOT_CONNECTED` or a similarly explicit state.

**Metric point**
```json
{
  "timestamp": "2026-10-30T00:00:00Z",
  "elapsedSec": 12,
  "estimatedCapacityMbps": 20.0,
  "configuredShapingMbps": 19.0,
  "throughputMbps": 17.2,
  "medianLatencyMs": 22.1,
  "p95LatencyMs": 41.7,
  "p99LatencyMs": 53.2,
  "jitterMs": 3.2,
  "queueDelayMs": 8.4,
  "queueDepthPct": 18.0,
  "packetLossPct": 0.1,
  "utilizationPct": 86.0,
  "activeFlows": 12,
  "classThroughputMbps": {
    "VIDEO_CALL": 1.4,
    "GAMING": 0.4,
    "VIDEO_STREAMING": 8.0,
    "BULK_TRANSFER": 5.0,
    "BACKGROUND_UPDATE_BACKUP": 1.5,
    "INTERACTIVE_WEB_OTHER": 0.9,
    "UNKNOWN": 0.0
  },
  "provenance": "MEASURED_LIVE"
}
```
This is a contract example only, not actual project data. Use valid class IDs and nullable fields if a metric is unavailable. Do not emit fabricated `0` when the value is unknown.

**Flow**
```json
{
  "id": "flow-identifier",
  "protocol": "UDP",
  "sourceEndpoint": "10.0.0.2:50000",
  "destinationEndpoint": "10.0.0.3:443",
  "currentRateMbps": 1.2,
  "bytesTransferred": 100000,
  "packetsTransferred": 220,
  "predictedClass": "VIDEO_CALL",
  "confidence": 0.82,
  "isLowConfidence": false,
  "policyClass": "latency-sensitive",
  "dscpMark": null,
  "lastSeen": "2026-10-30T00:00:00Z",
  "modelVersion": "home-traffic-model-version",
  "provenance": "MEASURED_LIVE"
}
```
Do not return sensitive payload content. Hostnames are optional and should not be fabricated. Mask or pseudonymize endpoint data in screenshots/exports when needed.

**Capacity estimate**
```json
{
  "timestamp": "2026-10-30T00:00:00Z",
  "estimatedWanMbps": 20.0,
  "configuredShapingMbps": 19.0,
  "observedThroughputMbps": 17.2,
  "headroomReservePct": 5.0,
  "confidencePct": null,
  "errorBoundMbps": null,
  "congestionState": "ELEVATED_QUEUE",
  "lastAdaptationReason": "Queue delay rose while link utilization remained high",
  "provenance": "MEASURED_LIVE"
}
```
Do not conflate estimated usable WAN capacity, configured shaper ceiling and observed throughput. They are distinct quantities.

**Intent**
```json
{
  "id": "intent-id",
  "name": "Prioritize work call",
  "trafficClass": "VIDEO_CALL",
  "priorityTier": 1,
  "minFloorMbps": 1.0,
  "maxCeilingMbps": 5.0,
  "targetLatencyMs": 50,
  "createdAt": "2026-10-30T00:00:00Z",
  "expiresAt": "2026-10-30T00:30:00Z",
  "status": "ACTIVE",
  "rationale": "Explicit temporary user request",
  "provenance": "MEASURED_LIVE"
}
```
Use absolute server timestamps for expiry. UI countdowns are display-only; the server owns expiry.

**Policy preview**
```json
{
  "previewId": "preview-id",
  "createdAt": "2026-10-30T00:00:00Z",
  "stateVersion": "state-version",
  "proposedChanges": [],
  "constraintsChecked": {
    "minimumService": true,
    "maximumRate": true,
    "fairnessGuard": true,
    "intentNotExpired": true
  },
  "warnings": [],
  "requiresConfirmation": true
}
```
The API must explain the intended changes and warnings before a mutation is applied.

## 4.4 Provenance contract

At minimum distinguish:
- `SIMULATED_DEMO`: generated by the deterministic frontend/demo engine.
- `MEASURED_LIVE`: collected from a verified running backend/testbed.
- `OFFLINE_EVALUATION`: computed from a saved, identified offline evaluation.
- `REFERENCE_REPORTED`: reported by an existing paper or archived report and not freshly reproduced.

Do not use a single ambiguous `LIVE` label for all sources. Include timestamps, source/component, model/policy version and stale status wherever relevant.

---

# 5. Backend requirements — P0

## BE-001 — Canonical schema, labels and artifact manifest

**Objective:** Make training and runtime inference agree exactly.

Implement:
- A versioned manifest containing feature names/order, units, window definitions, preprocessing parameters, class IDs/names, threshold settings, model architecture, model artifact checksum, training/evaluation dataset version and code/version identifiers.
- One canonical class map shared by training, inference, API and frontend contract.
- A model loader that checks manifest/model compatibility and fails closed.
- Reproducible preprocessing used identically in train, validation, test and runtime.
- Explicit mapping for unknown/low-confidence output.

Acceptance:
- Train and runtime use the exact same schema and label map.
- A deliberately reordered feature vector or incompatible manifest fails with a clear error.
- A missing/corrupt checkpoint disables ML predictions but leaves deterministic safe policy available.
- No hard-coded controller labels that can drift from the saved model.

## BE-002 — Real, bounded flow telemetry and feature extraction

**Objective:** Replace random model inputs with features derived from actual observed flows.

Implement:
- Transport-aware flow key: IP version, protocol, source/destination addresses and ports, direction and interface; include VLAN/tunnel identifiers if required by testbed.
- IPv4 support and IPv6 where available; clearly documented fallback for unsupported protocols.
- Per-flow packet/byte counts, duration, packet-size summary, inter-arrival statistics and directionality from available headers/counters.
- Explicit aggregation windows and update cadence.
- Idle-flow expiry, maximum active-flow cap, memory cap, bounded queues and controller backpressure.
- Correct handling of short/malformed packets, fragments, UDP/TCP, QUIC where observable, retransmissions where measurable, and bidirectional association rules.
- Privacy-by-default: metadata only, no payload persistence.
- Unit conversion and feature metadata (source, unit, time window).
- A stable unknown path until sufficient observations exist.

Acceptance:
- Crafted packet/counter tests produce expected features and units.
- No random tensor is passed to the classifier in any live path.
- Idle flows expire; high-churn traffic cannot grow memory without bound.
- Malformed packets do not crash the controller.
- IPv6 behaviour is tested or explicitly marked unsupported in the selected environment.
- No payload is logged or persisted.

## BE-003 — Home-broadband traffic corpus and reproducible traffic generators

**Objective:** Train and evaluate the correct task, not reuse IDS labels as application labels.

Implement:
- A declared taxonomy: video call, gaming, video streaming, bulk transfer, background update/backup, interactive web/other, unknown; add voice only if it is separately generated/labelled.
- Controlled traffic generators and documented scenario scripts.
- Labels derived from known generator/process/flow ground truth, not guessed from the classifier itself.
- Capture metadata, generation parameters, random seeds, topology, link capacity, impairment schedule, capture duration, host count and software versions.
- Multiple runs/session IDs and split by capture/session/time to prevent leakage.
- Data license/source and ethical/privacy statement.
- Class balance reporting; do not silently over-sample or discard classes.
- A limitations statement that lab traffic is a proxy for real household encrypted applications.

Acceptance:
- A clean command generates or retrieves the declared corpus and produces a manifest.
- Train/validation/test contain no shared session/flow leakage.
- Every included class has a documented labeling rule and support count.
- A reviewer can reproduce one scenario and understand how ground truth was assigned.
- No raw private user traffic is required for the core demo.

## BE-004 — Confidence-aware classifier adapter

**Objective:** Expose a robust, replaceable classifier interface independent of the policy engine.

Implement:
- Stable input/output interface: features + schema ID → class scores/probabilities, predicted class, confidence, model version, inference duration and timestamp.
- Explicit unknown/low-confidence gate with threshold selected using validation data.
- Deterministic rules/DSCP baseline as a safe fallback.
- Graceful handling for missing model, invalid features, inference exception and stale prediction.
- Model warm-up and bounded inference workload.
- Classifier corrections/override feedback can be logged, but no online model update is deployed automatically.
- Keep model inference separate from policy mutation.

Acceptance:
- Confidence threshold is justified from validation/precision-risk trade-offs, not chosen only for a visually pleasing demo.
- Low-confidence samples are visibly `UNKNOWN` and receive a safe policy.
- Missing model does not break traffic forwarding or API health.
- Inference P50/P95/P99 and resource usage are measured on the target environment.
- API reports model version and evaluation provenance.

## BE-005 — Capacity, congestion and QoS measurement

**Objective:** Distinguish configured capacity from usable capacity and current throughput.

Implement:
- Configured/emulated bottleneck rate as ground truth in Mininet.
- Measured throughput/egress rate.
- RTT/latency samples, jitter, packet loss, queue backlog/queue depth and qdisc/interface statistics where available.
- A capacity estimator that uses more than one instantaneous throughput sample; document whether it is a configured-rate proxy, active estimate or learned estimate.
- Sampling interval, smoothing, confidence/error bounds where defensible, stale-data timeout and sensor health.
- Explicit separation of `estimated WAN capacity`, `configured shaping ceiling` and `observed throughput`.
- Capacity-step test, e.g. 100 Mbps → 20 Mbps, as specified by the case brief.

Acceptance:
- Each measurement has unit, timestamp, source and provenance.
- Missing metrics are represented as unknown/null rather than fabricated zeros.
- Capacity change is detected within a measured time; report error and recovery time.
- No policy oscillation from ordinary measurement noise beyond a predeclared bound.
- Estimation accuracy is reported against configured Mininet rate and any clearly defined ground truth.

## BE-006 — Deterministic policy engine and temporary intent store

**Objective:** Make policy decisions explainable, bounded and independently testable.

Implement policy inputs:
- Current class + confidence/unknown state.
- Current capacity estimate and congestion state.
- Existing queue/policy configuration and observed QoS.
- Active user intents and expiry.
- Minimum service floors, maximum rates, fairness/safety constraints.
- Controller health and last known safe policy.

Implement:
- Pure/deterministic policy decision function where practical.
- Intent create/read/update/delete with server-owned expiry.
- Priority, traffic scope, minimum floor, maximum ceiling, target latency and TTL.
- Validation of impossible or conflicting intents.
- Preview-before-apply and explicit confirmation for high-impact changes.
- Precedence rules: safety and minimum service constraints cannot be overridden by an intent; expired intents are ignored; unknown/low-confidence flows use safe defaults.
- Audit event for decision, inputs/version, reason, changes and outcome.
- Idempotent policy operations.

Acceptance:
- Tests cover no congestion, congestion, capacity drop, unknown class, low confidence, missing model, expired intent, conflicting intents, minimum-service conflict and API restart.
- Every decision returns a reason and a versioned policy proposal.
- Expired intents stop affecting policy without relying on the browser countdown.
- User intent never creates unbounded priority or allows one flow to starve all others.

## BE-007 — Enforcement adapter (Linux `tc` first) and policy read-back

**Objective:** Apply actual, inspectable shaping/scheduling in the declared lab environment.

Implement:
- A documented interface and qdisc/class/filter configuration.
- Select and document an initial HTB + FQ-CoDel or another defensible hierarchy; do not assume one queue discipline fits every class.
- Interface/direction selection; egress vs ingress limitations must be documented.
- Safe, allowlisted command arguments; no user-supplied shell strings.
- Dry-run/policy preview.
- Idempotent apply and state read-back from `tc`/netlink or a reliable command parser.
- Check that intended rates/classes exist after apply.
- Explicit failure result if the system lacks permissions, interface or qdisc support.
- Last-known-safe baseline and restoration command.
- Ryu/OpenFlow only for the functionality it actually owns; avoid duplicate or conflicting enforcement in Ryu and `tc`.

Acceptance:
- A test applies policy to a disposable Mininet/Linux interface and verifies actual qdisc/class state.
- Repeated apply produces no duplicated/unbounded rules.
- Invalid input cannot execute arbitrary commands.
- Unsupported qdisc or failed apply triggers rollback and an auditable error.
- Setup guide states required privileges and environment; no production router is implied.

## BE-008 — Closed-loop verification, safety guard and rollback

**Objective:** Confirm that actions worked and user experience did not degrade beyond the declared guardrails.

Implement:
- Before/after measurement window and policy version.
- Verify enforcement state after every change.
- Observe latency, jitter, loss, throughput, queue delay, fairness and minimum service after a settling interval.
- Rollback on command failure, missing read-back, controller loss, stale telemetry or a predeclared QoS guard violation.
- Rate-limit actions; include hysteresis, cooldown, maximum step size and bounded retries.
- Ensure rollback itself is observable and idempotent.
- Safe baseline if all control/model services fail.
- Do not make model retraining/online learning part of the safety-critical loop.

Acceptance:
- Fault injection covers failed command, lost controller/API, malformed measurement, stale metrics and failed rollback.
- System returns to a known safe profile or reports an explicit critical failure if restoration cannot be confirmed.
- Every action has request ID, reason, prior state, intended state, verified state and final outcome.
- No unbounded retry or rapid oscillation loop.

## BE-009 — Management API and frontend integration contract

**Objective:** Connect the finished frontend to a typed, versioned, truthful backend.

Implement:
- OpenAPI document, API versioning, typed request/response schemas and a shared contract source where practical.
- REST for health, current status, metric history, flows, capacity, intents, policies, previews, policy mutations, experiments, model info and diagnostics.
- SSE for one-way live telemetry only if needed; use WebSocket only if a demonstrated bidirectional requirement justifies the added complexity.
- Pagination/filtering for flow/event history; bounded response size.
- Request IDs, validation, timeouts, clear errors and cancellation where relevant.
- Read endpoints can run without privileged enforcement; mutation endpoints must be protected.
- API must not block the Ryu event loop or experiment runner.
- Correct CORS/dev proxy configuration; use environment configuration for API base URL.
- API returns `null`/unknown for unavailable metrics, timestamps and provenance; never borrow demo values to fill live gaps.
- Keep `/health` compatible with the current frontend's health probe or update the frontend contract and tests in one coordinated change.
- Frontend should distinguish connecting, connected, disconnected, stale, partial, loading, empty and error states.
- Preserve the current design and page layouts; do not add another frontend or rebuild the UI.

Acceptance:
- OpenAPI contract validates and examples are checked against actual responses.
- All pages' live data fields map to backend fields with explicit units.
- A missing endpoint or malformed JSON shows a useful disconnected/error state.
- A failed live health probe never displays simulated metrics as measured live.
- Mutation errors are surfaced with request ID and safe explanation.
- API responses are tested against TypeScript schemas or shared contract fixtures.

## BE-010 — Experiment runner and artifact export

**Objective:** Produce reproducible evidence, not just a live-looking dashboard.

Implement:
- Resettable topology and deterministic scenario configuration.
- Identical offered traffic, capacity schedule, seed, duration and measurement windows across policy profiles.
- Baseline and proposed-policy run orchestration.
- Per-run metadata: timestamp, git commit, OS/kernel, Python/dependency versions, topology, traffic generator versions, seed, capacity/impairment schedule, model/checkpoint hash, schema/class-map versions, policy configuration and queue discipline.
- Raw time-series metrics and per-flow/per-host results where practical.
- Summary report with metric definitions, units, sample counts, confidence intervals or variability across repetitions where feasible.
- CSV/JSON raw export and a readable Markdown/HTML report.
- A failed/incomplete run status distinct from a valid completed run.

Acceptance:
- A single documented command resets, runs, measures and exports one scenario.
- A run can be repeated from its manifest.
- Results never mix different policy configurations without explicitly identifying them.
- Exports contain raw measurements and enough metadata to audit claims.

## BE-011 — Health, logs, diagnostics and lifecycle

**Objective:** Make failures diagnosable and resource use bounded.

Implement:
- Component health for API, telemetry, classifier/model, policy engine, enforcement, Ryu if used, experiment runner and persistence.
- Structured logs with timestamp, severity, component, correlation/request ID and outcome.
- Do not log payloads, API keys, or unnecessarily raw endpoints/prompts.
- Bounded in-memory flow/event history and bounded disk retention.
- Graceful startup/shutdown and model loading failures.
- Diagnostics export with versions/config but no secrets.
- Stale-data thresholds and clear last-updated timestamps.

Acceptance:
- Simulate each component failing; health status reflects the correct component state.
- Logs can trace a policy request through preview, apply, read-back and rollback.
- Repeated runs do not grow memory/disk indefinitely.
- Diagnostics contain no secret values.

---

# 6. Model and research pipeline — P0/P1

## ML-001 — Correct the current training/evaluation pipeline (P0)

- Create train/validation/test splits grouped by capture/session/time; prevent windows or flows from the same capture leaking across splits.
- Persist label encoder/class mapping and exact feature schema.
- Fix `--label` so it is honored.
- Fix checkpoint selection so the best validation model is saved and not overwritten by the final epoch.
- Use the same preprocessing in every phase.
- Make seeds and data manifests explicit.
- Record macro-F1, per-class precision/recall/F1, confusion matrix, class support, calibration and unknown/rejection performance; do not report accuracy alone.
- Preserve raw metric outputs and model artifact hashes.
- Separate model-selection validation data from final held-out test data.

Acceptance: clean training and evaluation commands reproduce the reported metrics from a saved manifest; class-map and preprocessing metadata are stored with the model.

## ML-002 — Make model comparisons fair (P1)

Compare, where appropriate:
1. Deterministic rules/DSCP baseline.
2. Tiny1DCNN on the new home-traffic features.
3. A simple alternative such as a calibrated tree/linear model or streaming baseline if justified.
4. BiLSTM only if it represents a meaningful temporal sequence and adds measured value.
5. Transformer only after fixing its positional-encoding dimension and rerunning it.
6. FP32 vs the actual quantized runtime artifact.

All candidates must use identical dataset splits, feature schema, labels and evaluation metrics. Report model size, CPU/RAM, inference P50/P95/P99, macro-F1, per-class failure patterns, confidence calibration and unknown rate. Choose the simplest model that meets the requirements.

## ML-003 — Quantization and deployment artifact correctness (P0/P1)

- Verify which operations are quantized by the selected runtime; do not label the whole network INT8 without evidence.
- Correct `measure_latency.py` input-shape logic; never infer tensor shape from filename substrings.
- Warm up model and report raw latency samples, P50/P95/P99, thread count, CPU/model environment and batch size.
- Compare FP32 and deployed artifact on the same held-out examples.
- Save a manifest and checksum with each artifact.
- Test loading the exact artifact path configured by the service.
- Preserve the old checkpoint; do not silently overwrite the only research artifact.

Acceptance: the exact runtime artifact is loaded and shape/schema checks pass; accuracy/latency claims refer to the artifact actually deployed.

## ML-004 — Confidence calibration, unknown and correction path (P1)

- Select low-confidence threshold from held-out validation data using per-class risk/coverage trade-offs.
- Define how unknown predictions affect the policy.
- Provide a safe fallback and a manual/intent correction mechanism.
- Log corrections as labelled feedback only when the user/test harness has reliable ground truth.
- No automatic online weight update or unvalidated model deployment.
- If adaptation is researched later, require shadow evaluation, validation, versioning, rollback and explicit opt-in.

Acceptance: threshold results and coverage are reported; low-confidence handling is tested and cannot trigger aggressive priority/drop actions.

## ML-005 — Cross-dataset evaluation correctness (P1)

- Do not use the existing cross-dataset score as a valid generalization claim until fixed.
- Use a compatible label taxonomy; map labels explicitly rather than independently encoding them.
- Preserve training feature order and preprocessing.
- Document class mismatch, absent labels and distribution shift.
- For residential task, evaluate a held-out capture/session and ideally a second generator/device profile; state that this is lab generalization, not universal app identification.

---

# 7. Policy, capacity, fairness and safety requirements

## POL-001 — Define precedence and constraints before tuning

Recommended policy order:
1. **Safety constraints:** no invalid command, no unsafe policy if telemetry/controller is unavailable.
2. **Minimum service/fairness constraints:** prevent starvation; preserve declared minimum service floors.
3. **Valid active user intent:** respect explicit scope and TTL only within safety/fairness bounds.
4. **Congestion and capacity state:** shape to estimated/configured bottleneck with a documented headroom rule.
5. **Traffic class and confidence:** apply class-aware treatment only when confidence is adequate; unknown goes to safe default.
6. **Fallback:** last-known-safe or static baseline.

The precise numeric policy is a research decision. Do not hardcode unexplained priorities and claim they are optimal.

## CAP-001 — Capacity estimator

- Ground truth in Mininet is the configured bottleneck rate and its scheduled changes.
- In a real WAN, observed throughput is not identical to available capacity; document that distinction.
- Use smoothing/hysteresis/cooldown, bound rate changes, and track estimator error.
- Test abrupt capacity reduction, recovery, noisy signals and measurement outage.
- Record adaptation time, overshoot/undershoot, number of policy changes and oscillation count.

## FAIR-001 — Fairness and starvation protection

- Measure Jain's fairness index at flow level and host level, with the population and time window explicitly defined.
- Report per-class and per-host throughput alongside the aggregate index.
- Define minimum service for bulk/background traffic.
- Test the three-TV-streams plus gaming case, as well as video call plus ISO download.
- Do not maximize fairness at the cost of all latency-sensitive QoS; report the trade-off.

## SEC-001 — Safe network mutation

- UI/API input must become validated typed policy fields, not shell fragments.
- Use allowlisted qdisc/class/filter arguments.
- Run privileged enforcement through a narrow helper with least privilege where feasible.
- Require confirmation for impactful policy changes.
- Add idempotency/request IDs to avoid duplicate mutation on retries.
- Record who/what requested the change (local prototype actor is sufficient) and its result.
- Protect mutation endpoints from unauthenticated remote access; bind to localhost by default unless a deliberate deployment configuration is documented.
- Never commit keys/tokens or real `.env` values.
- If the testbed cannot restore its baseline, stop adaptation and report a critical error rather than continuing blindly.

---

# 8. API contract checklist

This is the minimum API surface to implement or map to an equivalent versioned contract. Exact paths may be changed if the OpenAPI file and frontend client are updated together.

| Method | Suggested endpoint | Purpose | Mutates state? |
|---|---|---|---|
| GET | `/api/v1/health` (or compatible `/api/health`) | API/component health | No |
| GET | `/api/v1/status` | Current mode, scenario, data provenance, policy version | No |
| GET | `/api/v1/metrics/current` | Latest metric snapshot | No |
| GET | `/api/v1/metrics/history?since=&limit=` | Time-series history | No |
| GET | `/api/v1/flows?class=&confidence=&limit=&cursor=` | Flow table/search/filter | No |
| GET | `/api/v1/capacity` | Capacity estimate and congestion state | No |
| GET | `/api/v1/policies` | Active policies and verified applied state | No |
| POST | `/api/v1/policies/preview` | Validate proposed policy and return impact/warnings | No (preview only) |
| POST | `/api/v1/policies/apply` | Apply a previewed/confirmed policy | Yes |
| POST | `/api/v1/policies/rollback` | Restore a known-safe or prior policy | Yes |
| GET | `/api/v1/intents` | Current and recent intents | No |
| POST | `/api/v1/intents` | Create a bounded temporary intent | Yes |
| PATCH | `/api/v1/intents/{id}` | Update intent if supported | Yes |
| DELETE | `/api/v1/intents/{id}` | Cancel intent | Yes |
| GET | `/api/v1/events?since=&limit=` | Policy/diagnostic event history | No |
| GET | `/api/v1/model` | Loaded model, schema/class map, status, evaluation provenance | No |
| GET | `/api/v1/experiments` | List runs and run status | No |
| POST | `/api/v1/experiments` | Start a validated experiment job | Yes |
| GET | `/api/v1/experiments/{id}` | Run status and summary | No |
| GET | `/api/v1/experiments/{id}/artifacts` | Download report/raw results | No |
| GET | `/api/v1/stream` (SSE, optional) | Live metric/event updates | No |
| POST | `/api/v1/system/reset` (lab-only) | Reset testbed to safe baseline | Yes; restrict strongly |

Requirements:
- Version the contract (`/api/v1` or equivalent).
- Use JSON content types and explicit schemas.
- Return UTC ISO-8601 timestamps.
- Include units in field documentation, not only labels.
- Use HTTP status codes consistently and an error object with `code`, `message`, `requestId`, `timestamp`, `retryable`.
- Validate body sizes, IDs, ranges, enum values and expiry.
- Keep mutation APIs disabled or localhost-only in the default demo configuration.
- Use job IDs for experiments; do not keep HTTP requests open for a long-running benchmark.
- SSE messages should include sequence/time/version and reconnect semantics; UI must show stale/disconnected status.
- Do not expose stack traces, shell command output with secrets, or environment variables.

---

# 9. Frontend-backend integration requirements (visual redesign is out of scope)

## INT-001 — Preserve the accepted frontend

- Start from the latest frontend branch, not by copying the old archive over it.
- Do not alter the chosen L5 Light / D1 Dark visual identity, landing-page visuals, graph-first dashboard, sidebar or help interactions unless an integration defect requires a minimal fix.
- Do not remove any existing page, chart, table, export, scenario, theme, reduced-motion, selection-help or chatbot feature that exists in the latest version.
- First create a map from each UI component to its required data fields and API endpoint.
- Identify all current hardcoded/demo-only values and mark each as: keep demo-only, replace with live API, or display as offline reference.
- Keep the deterministic demo mode available even when the backend is offline.

## INT-002 — Implement one typed API client

- Centralize base URL, request IDs, timeout, JSON validation, error mapping and cancellation.
- Do not scatter raw `fetch()` calls through page components.
- Align TypeScript types with OpenAPI schemas.
- Treat unknown/null/stale values explicitly.
- Preserve current `/health` semantics or migrate frontend and backend together.
- Add contract fixtures/tests so the frontend cannot silently expect a field the API does not provide.

## INT-003 — Provider and provenance rules

- DEMO / REPLAY remains deterministic and clearly labelled.
- LIVE means data came from the verified backend/testbed, not just that the user selected the LIVE toggle.
- If API health is false, malformed, stale or partial, show disconnected/partial state and withhold synthetic demo telemetry from LIVE charts and tables.
- If a particular metric is unavailable, show `—`, “Unavailable” or an equivalent state, not `0`.
- Offline model evaluation results must be labelled as offline results, with dataset/model/date.
- If a backend component is unverified, the diagnostics page must say so.
- A live response must not include frontend demo engine records unless they are explicitly marked simulated and separated.

## INT-004 — Page-to-contract mapping

Map all pages to the data they need:
- **Overview:** current capacity/congestion, current metrics, class throughput, flow counts, recent events, component health.
- **Live Traffic:** paginated flows, class/confidence/unknown state, rates and available per-flow measurements.
- **Capacity & Congestion:** capacity estimator, configured shaping ceiling, observed egress, queue delay, RTT/jitter/loss and capacity-change history.
- **Intents & Policy:** current policies, intent CRUD/expiry, policy preview/apply/rollback, enforcement read-back and event history.
- **Experiments & Benchmarks:** experiment creation/status/results, baseline definitions, raw data and exports.
- **Model Insights:** loaded model metadata and real offline evaluation artifacts; never make the live controller claim it is being re-evaluated unless it is.
- **Settings & Diagnostics:** health, versions, config without secrets, telemetry freshness, errors and diagnostics export.
- **Help/Glossary/Gemini (if present in latest UI):** local glossary works without backend; Gemini requests use a separate secure endpoint, not the QoS control API. Never allow the chatbot to apply policy or run shell commands.

## INT-005 — Loading, error, stale and partial states

Every API-driven page must handle:
- Initial loading.
- No data yet.
- Healthy and fresh data.
- Stale data with last-updated time.
- Partial component outage.
- Backend disconnected.
- Request timeout.
- Invalid response/schema.
- Mutation rejected by validation.
- Mutation failed or rolled back.
- Experiment queued/running/completed/failed/cancelled.

A stale graph may retain last known data only if it is visibly marked stale and timestamped. Do not animate stale data as if it were live.

## INT-006 — Mutation UX and consistency

- Intent/policy actions must be previewed and validated server-side.
- Show the server response as the source of truth after a mutation; do not optimistically mark a policy applied before read-back verification.
- Disable duplicate submissions while a request is in progress; use idempotency/request IDs where appropriate.
- Display errors and rollback outcome.
- If a request times out after the backend may have applied it, query state by request ID before retrying to avoid duplicate changes.
- Keep the demo mode's existing local controls working.

---

# 10. Experiment and validation plan

## 10.1 Required comparison profiles

At minimum, use identical topology, traffic schedule, seeds where supported, capacity schedule and measurement windows for:
1. No shaping / best-effort baseline.
2. Static QoS baseline.
3. FQ-CoDel or another documented queue-management baseline.
4. Deterministic adaptive policy without ML.
5. Proposed intent-aware system.
6. CAKE/SQM where technically feasible in the environment.

If a baseline cannot be run, explain why and do not present a simulated stand-in as an executed experiment.

## 10.2 Required scenario matrix

**S1 — Work/video call + large ISO download**
- Start bulk transfer, then start interactive call-like traffic.
- Compare interactive p95/p99 latency, jitter, loss and call throughput.
- Verify bulk transfer continues to make progress.

**S2 — Abrupt WAN capacity drop**
- Start at 100 Mbps, reduce to 20 Mbps as in the brief, and later restore.
- Record detection time, estimator error, shaping convergence, queue delay, throughput and policy changes/oscillations.
- Ground truth is the configured testbed rate; do not call it a real ISP estimate.

**S3 — Multiple streams + gaming**
- Three streaming sources compete with gaming-like traffic.
- Measure gaming latency/jitter/loss and per-host/per-flow throughput/fairness.
- Verify streaming hosts do not get starved.

**S4 — Temporary user intent**
- Apply “prioritize work call” with explicit TTL and bounds.
- Verify preview, apply, observed result, automatic expiry and return to baseline.
- Verify expired intent cannot remain active after browser close/restart.

**S5 — Unknown/low-confidence traffic**
- Introduce traffic outside the training support or insufficient early packets.
- Verify unknown state, safe default and no aggressive policy.
- Measure unknown rate and downstream QoS.

**S6 — Failure/fault injection**
- Remove model, kill API, interrupt telemetry, fail `tc` apply, create invalid intent, and simulate rollback failure.
- Verify bounded behavior, visible error and safe baseline restoration.

**S7 — Address/protocol coverage**
- Test IPv4 and IPv6 where available; TCP, UDP and observable QUIC flows.
- Document any unsupported protocols/fragments/tunnels.

## 10.3 Required metrics and definitions

- **Classification:** macro-F1, per-class precision/recall/F1, confusion matrix, class support, unknown/rejection rate, calibration where evaluated.
- **Inference:** P50/P95/P99 latency, model size, CPU and memory, batch/window definition, runtime/hardware.
- **QoS:** median/p95/p99 RTT or latency, jitter definition, packet loss, throughput by class/flow/host, queue delay/depth and utilization.
- **Fairness:** Jain's fairness index with the population and time window specified; minimum service and starvation events.
- **Capacity:** estimate vs configured ground truth, absolute/relative error, time to detect and settle after step changes.
- **Stability:** number of policy changes, oscillations, overshoot, cooldown-triggered changes and recovery time.
- **System:** CPU/RAM, API latency, sampling rate, flow-table size, dropped events, memory bound and enforcement operation latency.
- **Reproducibility:** repeat count, run-to-run variability, seeds and exact config.
- **Safety:** failed apply count, rollback success/failure, time to safe state and unbounded retry count (must be zero).

Define metrics before running the final benchmark. Do not cherry-pick one favorable run.

## 10.4 Numerical thresholds

Do not invent final numerical pass thresholds before the baseline is measured. Use this process:
1. Run the test harness against no shaping/static QoS/FQ-CoDel first.
2. Inspect baseline variance and determine the practical target.
3. Pre-register thresholds for p95 latency, fairness/minimum service, adaptation time, policy oscillations, classifier macro-F1/unknown rate and CPU overhead.
4. Freeze the thresholds before evaluating the proposed system.
5. Report every scenario and every failed/negative result.

A valid result may be that the ML system does not beat deterministic adaptation. If so, report it honestly and justify whether the added model complexity is worth retaining.

---

# 11. Known risks and mitigations

| Risk | Severity | Required mitigation |
|---|---|---|
| Old IDS labels used as residential app labels | Critical | New taxonomy and labelled corpus; keep IDS results separate |
| Random features at runtime | Critical | Real feature extraction, tests and no random inference path |
| Schema/class-map mismatch | Critical | Manifest, hashes and fail-closed validation |
| No real enforcement path | Critical | `tc` adapter, read-back and rollback |
| UI simulation mistaken for live data | Critical | Provenance, health gating, null/stale states and integration tests |
| Intent can starve other traffic | High | Bounds, minimum service, conflict handling and fairness metrics |
| Capacity estimate oscillates | High | Smoothing, hysteresis, cooldown, rate limits and test matrix |
| Policy command injection | Critical | Typed allowlists, narrow privileged helper and security tests |
| Model metrics not reproducible | High | Correct split, best checkpoint, manifest and fixed benchmark script |
| Transformer score invalid | High | Fix and rerun before using as a comparison |
| Overstated INT8 claim | High | Inspect actual quantized ops/runtime and compare deployed artifact |
| Weak baselines | High | Include FQ-CoDel/CAKE where feasible and deterministic adaptive policy |
| Dataset not representative | High | Label as controlled lab traffic; test multiple sessions/generators where feasible |
| Unbounded flow state/logs | High | Expiry, caps, bounded retention and load tests |
| Gemini key leaked/client-controlled actions | High | Separate server endpoint, no key in frontend, no control-plane authority |
| Visual work regresses during integration | Medium | Freeze design scope; review screenshots and frontend diff; no redesign |

---

# 12. Ordered execution plan

## Phase 0 — Establish the real current state (first task)
1. Get the newest frontend source from the user and put it in a branch.
2. Preserve the current UI and make a clean baseline commit.
3. Inspect current source for all latest features (theme, landing, icon rail, help/glossary, text selection, Gemini, exports, scenario controls).
4. Reconcile the old archives and this document with the current working tree.
5. Inventory environment, OS, Python, Node, Mininet, Ryu, OVS and `tc` availability.
6. Produce a current implementation matrix: present/partial/missing, with file path and test evidence.
7. Record decisions in ADRs before changing the architecture.

**Exit gate:** no implementation starts on an assumption that the newest frontend matches the old archive.

## Phase 1 — Repair reproducibility and model metadata
1. Fix training split, label option, best-checkpoint saving, feature order, preprocessing and class-map persistence.
2. Fix latency benchmark input-shape selection and output manifest.
3. Fix/disable the Transformer baseline until corrected.
4. Add schema/model load validation and a deterministic rules fallback.
5. Preserve existing checkpoint artifacts and old IDS results.

**Exit gate:** model can be loaded by an explicit manifest; schema mismatch fails safely; offline evaluation is reproducible.

## Phase 2 — Build the minimum real network path
1. Choose the Mininet topology and Linux interface/qdisc arrangement.
2. Implement real bounded flow telemetry and feature extraction.
3. Generate/label home-traffic scenarios and create session-level dataset splits.
4. Implement capacity/QoS telemetry and known ground truth.
5. Implement deterministic policy engine and temporary intent expiry.
6. Implement `tc` enforcement and read-back.
7. Add rollback and fault injection.

**Exit gate:** a non-ML deterministic policy changes actual testbed behavior and can recover safely.

## Phase 3 — Add the API and integrate the accepted frontend
1. Freeze OpenAPI schema and TypeScript mapping.
2. Implement health/status/metrics/flows/capacity/policies/intents/events/model/experiments endpoints.
3. Add API client/provider with timeout, schema validation, stale-state handling and request IDs.
4. Map each existing page to real API data.
5. Preserve DEMO/REPLAY and strict LIVE provenance.
6. Test every mutation with preview/apply/read-back/rollback.
7. Connect Help/Gemini only if the current UI includes it; keep it separate from QoS mutation endpoints.

**Exit gate:** UI reports the backend's real state, and a failed/unavailable backend never appears healthy or produces fake live telemetry.

## Phase 4 — Reproducible benchmark and evidence
1. Implement scenario reset/run/export.
2. Execute baseline profiles under identical conditions.
3. Repeat runs and collect raw time series.
4. Calculate QoS/fairness/capacity/classifier/resource metrics.
5. Freeze and run predeclared pass criteria.
6. Produce tables, plots, config manifests and report.

**Exit gate:** another person can rerun a declared scenario and obtain a result bundle.

## Phase 5 — Final hardening and handoff
1. Security review of privileged operations, API mutations, environment secrets and logs.
2. IPv4/IPv6 and protocol support audit.
3. Load/failure tests and memory bounds.
4. Clean-install setup validation.
5. Documentation, architecture diagram, license attribution and known limitations.
6. Final review against the Case Study 3 acceptance evidence.
7. Produce a short demo script and backup recorded run only as backup, clearly labelled.

**Exit gate:** a fresh environment can reproduce the selected demo; the final presentation uses measured or clearly labelled simulated values.

---

# 13. Definition of done

The project is not done when the frontend looks connected. It is done when all P0 gates below pass:

- [ ] Current frontend source has been reconciled with the old archive; accepted visuals are preserved.
- [ ] API health reports real component states and versions.
- [ ] Live flow features come from actual observed flow metadata, not random values.
- [ ] Home-traffic classes and label rules are documented and supported by a labelled dataset.
- [ ] Model manifest contains exact schema, preprocessing, class map and artifact hash.
- [ ] Unknown/low-confidence traffic has a tested safe policy.
- [ ] Capacity and QoS metrics have units, timestamps, provenance and testbed ground truth.
- [ ] Temporary intent has server-enforced expiry, bounds, preview and audit trail.
- [ ] Actual shaping/scheduling is applied and verified on the declared testbed.
- [ ] Policy rollback and safe fallback pass fault-injection tests.
- [ ] UI is connected to typed endpoints; loading/stale/error/partial states work.
- [ ] DEMO values never masquerade as measured LIVE values.
- [ ] Repeatable experiment runner compares at least the required core baselines.
- [ ] Raw measurements and run manifests can be exported.
- [ ] Build, lint, unit tests and integration tests are run; real outputs are recorded.
- [ ] Setup guide, architecture diagram, licenses, threat/safety notes and limitations are complete.
- [ ] Case Study 3 scenarios have evidence for latency, jitter, loss, throughput, fairness, adaptation speed, CPU overhead and reproducibility.
- [ ] Any result that does not improve over a baseline is reported honestly.

P1 research-quality tasks should be completed before making strong claims about generalization, online adaptation or superiority over established SQM. P2 work must not delay the core working prototype.

---

# 14. Required final handoff package

The teammate should deliver:
1. Source repository/branch with a clean commit history.
2. `README.md` with exact environment versions, setup, commands, verification and troubleshooting.
3. `docs/architecture/architecture.md` plus a readable architecture diagram.
4. `docs/api/openapi.yaml` or equivalent versioned API contract.
5. `docs/data/` with traffic taxonomy, feature schema, dataset manifest and split rules.
6. Model artifact + checksum + manifest; no untracked or undocumented checkpoint.
7. Scenario definitions and reproducible traffic-generator scripts.
8. Policy/enforcement implementation and rollback evidence.
9. Automated unit/integration/fault tests.
10. Experiment manifests, raw CSV/JSON results and summary reports.
11. Benchmark tables and plots with units and source/provenance.
12. License and attribution inventory.
13. Threat/safety notes, known limitations and unsupported configurations.
14. A short demo runbook with expected output and recovery/reset steps.
15. Updated CSV tracker with status, evidence path, test command, owner and blockers.

## Source boundaries and evidence

This handoff is based on the supplied Case Study 3 PDF, the old research archive, the older frontend archives, and the project audit/backlog generated from those sources. The latest frontend archive and a complete running deployment were not supplied. Therefore, all “current source” observations above refer to the archived versions; current implementation status must be re-verified before marking tasks complete.

The research gap/novelty statement remains a hypothesis until a focused literature review and experiments support it. Do not claim that the integration of classifier, intent and QoS is novel merely because the prototype combines them.
