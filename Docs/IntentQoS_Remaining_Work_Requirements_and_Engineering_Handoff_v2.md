# IntentQoS — Remaining Work Requirements & Engineering Handoff (v2)

**Purpose:** This document is the authoritative remaining-work specification for bringing the current IntentQoS implementation to a technically credible, reproducible, hackathon-ready demonstration.

**Prepared from:** the previous engineering handoff, the older-source findings recorded in the project review, and the audit of the updated archive `Updated Traffic Classification.zip`.

**Important audit boundary:** The updated archive was inspected and its Python tests and bytecode compilation were run. The Python suite reported 27 passing tests. A complete frontend install/build did not complete in the available environment. No real packet-capture deployment, live Linux `tc` enforcement, Mininet/OVS end-to-end experiment, or physical home-router deployment was verified. Therefore, this document separates confirmed implementation from unverified or missing integration. The latest working tree must be rechecked before modifying files.

---

## 1. Executive summary

The updated repository is a substantial improvement over the previous version. It introduces a more modular backend with flow extraction, a residential traffic taxonomy, model loading, capacity estimation, policy and intent management, a Linux traffic-control adapter, FastAPI endpoints, frontend API services, documentation, and tests.

However, **the main hackathon requirement is not merely to have these modules present**. The system must demonstrate a closed loop:

> Observe real network traffic → derive flow metadata → classify residential traffic → estimate available capacity and congestion → combine classification with temporary user intent and fairness constraints → compute a QoS policy → apply it to the network → verify the applied configuration and measured outcome → safely recover if anything fails.

The current archive does not yet prove this complete loop. Several components operate on synthetic/demo data, the traffic-control adapter is initialised in dry-run mode, the Ryu controller retains legacy random-input/IDS behaviour, and the API-to-frontend LIVE path can fall back to generated demo data when live collections are empty.

**The next work should focus on correctness and integration, not additional visual features.** Preserve the accepted frontend design and the modular structure. Avoid a rewrite unless the current code audit demonstrates that a component is fundamentally unsuitable.

### Readiness statement

Current state: **backend prototype with substantial implemented components; live end-to-end adaptive QoS remains unverified/incomplete.**

Do not claim that live adaptive QoS is complete until the acceptance criteria in Sections 7–12 have been demonstrated with real measurements and reproducible evidence.

---

## 2. Hackathon problem and required outcome

The selected TELIPORT Season 4 problem is Case Study 3: **Adaptive QoS Engine for Mixed Home Broadband Traffic**.

The project must address a residential broadband environment in which several traffic types compete for limited or changing WAN capacity. Examples include:

- Interactive video calls.
- Online gaming.
- Video/audio streaming.
- Web browsing and ordinary interactive traffic.
- Large downloads and file transfers.
- Software updates, cloud synchronisation and backups.

The system should not blindly assign permanent priority based only on a traffic label. It should account for current network conditions, user intent, fairness, and the need to avoid starving background traffic.

### Required system behaviours

1. **Privacy-conscious classification:** Prefer flow metadata and avoid payload inspection unless a justified, explicit experiment requires otherwise.
2. **Adaptive capacity awareness:** Distinguish configured WAN capacity, estimated available capacity, shaped capacity and observed throughput.
3. **Intent-aware control:** Allow temporary user intent such as “prioritise my video call for 30 minutes”, with expiry and conflict handling.
4. **Fairness:** Protect interactive traffic without indefinitely starving bulk traffic or one household device.
5. **Safe enforcement:** Apply only validated policies, verify the actual kernel/network state and roll back safely on failure.
6. **Measurable benefit:** Demonstrate improvements in latency, jitter, loss and fairness under controlled contention, compared with meaningful baselines.
7. **Reproducibility:** Record datasets, configurations, model versions, testbed settings and raw results.

---

## 3. Current implementation audit — what exists versus what is not yet proven

The following status reflects the uploaded archive audit, not an assumption about any later edits.

| Area | Current finding | Status | What remains |
|---|---|---|---|
| Residential taxonomy | New seven-class home-traffic taxonomy is present | Implemented | Validate class definitions and dataset mapping |
| Flow extraction | `telemetry/flow_extractor.py` has stateful bidirectional flow aggregation and bounded windows | Implemented as a component | Connect a real packet/flow ingestion source |
| Model loading | `models/model_loader.py` loads residential model artifacts and provides inference handling | Implemented as a component | Verify model/schema/version compatibility and held-out performance |
| Ryu controller | `ryu_app/nano_guard.py` still contains random tensors and old IDS labels | Legacy/inconsistent | Integrate properly or retire from active architecture |
| Capacity sampler | `telemetry/capacity_sampler.py` has smoothing, hysteresis and congestion-state logic | Implemented as a component | Feed real measurements and calibrate confidence |
| Policy engine | `policy/engine.py` computes policy proposals and manages policy state | Implemented as a component | Ensure every committed policy is actually enforced and verified |
| Intent store | `policy/intent_store.py` supports intent lifecycle/expiry concepts | Implemented as a component | Verify expiry triggers re-planning, enforcement and audit logging |
| Linux TC adapter | `enforcement/tc_adapter.py` supports HTB/FQ-CoDel command construction and dry-run/read-back abstractions | Implemented, dry-run | Validate actual Linux application and kernel read-back |
| FastAPI | `api/server.py` exposes API routes and SSE endpoint | Implemented | Remove synthetic data from LIVE mode; report truthful health/provenance |
| Frontend API boundary | `src/services/apiClient.ts` and data-provider layer exist | Implemented | Verify API contracts and all page data paths |
| Frontend LIVE handling | `src/App.tsx` has fallback-to-demo patterns when LIVE collections are empty | Incorrect behaviour | LIVE must never silently display demo data |
| SSE | Backend stream endpoint exists | Backend only | Either document polling as current client strategy or deliberately integrate SSE |
| Tests | 27 Python tests passed | Partial verification | Add real integration, frontend, network and failure tests |
| Documentation | Architecture, runbook, schema and security docs exist | Needs reconciliation | Align claims with actual active code paths |
| Benchmarks | Multiple model and latency result artifacts exist | Needs audit | Tie every number to model, dataset, hardware and method |

### Audit caveats

- A passing unit test does not establish real packet capture.
- A dry-run enforcement response does not establish that Linux changed its queue hierarchy.
- An API returning a connected status does not prove that telemetry is real.
- A frontend displaying data in LIVE mode does not prove that data came from a live source.
- A benchmark JSON file is not sufficient evidence without its methodology and provenance.

---

## 4. Target architecture and authoritative data flow

The implementation should converge on one clearly documented architecture. Choose one active network-control path and remove ambiguity between Ryu, FastAPI, and any future collector.

### Recommended logical architecture

```text
Network interface / OpenFlow switch / packet metadata source
                         |
                         v
             Real Telemetry Ingestion
                         |
                         v
               Flow Feature Extractor
                         |
                         v
              Residential Traffic Model
                         |
             +-----------+-----------+
             |                       |
             v                       v
       Flow classification      Capacity/queue telemetry
             |                       |
             +-----------+-----------+
                         |
                         v
              Intent + Policy Engine
           (fairness, limits, priorities,
             expiry, conflict resolution)
                         |
                         v
                Policy Validation
                         |
                         v
              Linux TC / OVS Enforcement
                         |
                         v
             Kernel/network read-back
                         |
                         v
            Outcome metrics and audit log
                         |
              +----------+----------+
              |                     |
              v                     v
         FastAPI API          Experiment recorder
              |
              v
        Existing React UI
```

### Non-negotiable data-flow rules

- Each telemetry record must identify its source and whether it is measured, derived, replayed or simulated.
- The model must receive features generated by the same documented feature schema used during training.
- The policy engine must consume current classification, capacity and intent state; it must not invent missing measurements.
- A proposed policy is not an applied policy.
- An applied policy is not a verified policy.
- The policy engine must only mark a policy committed after successful enforcement and verification.
- The frontend must show the distinction between proposed, applied, verified, failed and dry-run states.
- Demo data must never appear in LIVE mode, including when the live API returns empty arrays.

### Architectural decision required: Ryu versus separate collector

The old Ryu controller currently contains legacy logic and is not connected to the new residential flow extractor. Before changing it, make and document one explicit decision:

**Option A — Ryu/OpenFlow is the active telemetry/control plane.**
- Integrate real packet/flow observations with the residential extractor.
- Use the new residential model and label mapping.
- Ensure Ryu does not generate random inference features.
- Connect its policy output to the same validated enforcement path.
- Add controller health and switch-connection checks.

**Option B — FastAPI + dedicated Linux telemetry collector is the active architecture.**
- Implement a dedicated collector using an appropriate packet metadata/counter source.
- Make the collector feed the extractor and capacity sampler.
- Keep Ryu only as a clearly marked legacy experiment or remove it from the active runtime.
- Update README, runbook, architecture diagrams and deployment instructions.

**Recommendation:** Select one active architecture based on the actual testbed and team capability. Do not maintain two half-integrated control paths. For a controlled hackathon prototype, a dedicated Linux telemetry collector with `tc` enforcement may be simpler to validate; use Ryu/OVS only if the chosen testbed requires it.

---

## 5. Detailed remaining requirements

Each requirement includes the objective, why it matters, implementation expectations and acceptance criteria. IDs are also used in the CSV tracker.

# Phase 0 — Baseline, repository integrity and architecture decision

### ARCH-001 — Re-audit the current working tree before edits
**Priority:** P0

**Objective:** Confirm the current branch and source state, since the archive reviewed may not include the latest edits.

**Why:** Prevent duplicate work, accidental deletion of valid changes, or fixing a bug that has already been resolved.

**Work:**
- Record commit hash/branch or archive checksum.
- Generate a complete file inventory.
- Identify entry points, package manifests, environment files, tests, docs, model artifacts and generated outputs.
- Run the existing Python tests and frontend checks.
- Compare the working tree with this handoff.
- Mark each requirement as already satisfied, partial, missing or not applicable.

**Acceptance criteria:**
- A dated baseline report exists.
- No source changes are made before the baseline is recorded.
- Every requirement has a current status and evidence location.

### ARCH-002 — Choose and document one active controller/telemetry architecture
**Priority:** P0

**Objective:** Resolve ambiguity between legacy Ryu and the newer API/collector architecture.

**Why:** The current Ryu file still uses random input tensors and IDS labels. Two disconnected implementations create misleading health and deployment claims.

**Work:**
- Choose Ryu/OpenFlow or a dedicated Linux telemetry collector as the active path.
- If Ryu is retained, connect real flow observations to the residential extractor/model and remove random input generation.
- If Ryu is retired, move it to a clearly named legacy/experimental area or remove it if no longer needed; update all imports, scripts and docs.
- Update the architecture decision record and runbook.

**Acceptance criteria:**
- There is exactly one documented active ingestion/control path.
- No active code path uses `torch.randn` as a substitute for real traffic features.
- No active residential classification path uses the old IDS labels.
- Startup health reports the actual selected architecture.

### ARCH-003 — Separate active, legacy, experimental and generated artifacts
**Priority:** P1

**Objective:** Make the repository understandable and reproducible without deleting useful research history.

**Why:** Old checkpoints and generated AI Studio assets can confuse deployment and maintenance, but some are valid baseline artifacts.

**Work:**
- Classify each checkpoint as production candidate, baseline, legacy, smoke-test or unused.
- Keep reproducibility artifacts under a clearly labelled experiment/archive directory.
- Remove genuinely unused generated files only after reference search.
- Keep one authoritative package manager/lockfile for the frontend.
- Ensure `.env`, secrets, local caches and temporary outputs are excluded from version control.
- Do not delete original Nano-Stream artifacts needed to reproduce the paper.

**Acceptance criteria:**
- An artifact inventory documents purpose, owner, source and whether it is loaded at runtime.
- No active imports or scripts reference deleted files.
- A clean clone can install dependencies using the documented package manager.

# Phase 1 — Real telemetry and flow extraction

### TEL-001 — Implement a real telemetry ingestion source
**Priority:** P0

**Objective:** Feed actual network observations into `FlowExtractor`.

**Why:** The current API seeds synthetic flows; the extractor is not yet connected to real packet/flow input. Without real observations, classification and QoS decisions are only a simulation.

**Work:**
- Implement the chosen ingestion source: OpenFlow/Ryu events, packet metadata capture, or suitable Linux telemetry.
- Capture only the metadata required for classification and measurement.
- Record timestamp, source/destination addresses, protocol, ports, packet length and available transport metadata.
- Handle IPv4/IPv6 and TCP/UDP; document unsupported protocols.
- Avoid payload capture by default.
- Add bounded queues, backpressure and graceful shutdown.
- Record source provenance and collector health.

**Inputs:** Packet/flow metadata from a real interface or switch.

**Outputs:** Validated observations passed to `FlowExtractor`.

**Constraints:** No unbounded packet buffering; no silent payload retention; no fake values in LIVE mode.

**Acceptance criteria:**
- Generate real traffic in a controlled testbed and observe corresponding flow records.
- Flow counters and timestamps change in response to actual traffic.
- Collector failure is visible in health status.
- No synthetic observations are inserted into the live extractor.

### TEL-002 — Connect and validate FlowExtractor
**Priority:** P0

**Objective:** Ensure the stateful extractor receives real observations and produces stable feature records.

**Why:** A well-written extractor is not useful unless connected to an input source and its feature semantics match training.

**Work:**
- Connect ingestion to `telemetry/flow_extractor.py`.
- Review bidirectional flow keys and direction semantics.
- Validate packet/byte counters, inter-arrival time, packet-size statistics and flow duration.
- Verify flow timeout and maximum-state limits under load.
- Add concurrency protection if multiple threads/process callbacks mutate shared state; otherwise correct any thread-safe docstring claims.
- Handle malformed packets, missing fields and out-of-order timestamps.
- Version the feature schema.

**Acceptance criteria:**
- Known synthetic test traffic and actual testbed traffic produce expected counters.
- Forward and reverse directions are handled consistently.
- State remains bounded under sustained traffic.
- Feature output matches the model's required schema and ordering exactly.

### TEL-003 — Add telemetry provenance and quality flags
**Priority:** P0

**Objective:** Make every record auditable as measured, replayed, derived or simulated.

**Why:** The current API can report LIVE while returning seeded data. Provenance is necessary to prevent demo measurements from being presented as real results.

**Work:**
- Add fields such as `source`, `mode`, `measured_at`, `interface`, `is_simulated` and `quality_status` where appropriate.
- Distinguish unavailable measurements from zero measurements.
- Mark stale telemetry and collector gaps.
- Propagate provenance through API responses and frontend types.

**Acceptance criteria:**
- Every live flow/metric has a verifiable source and timestamp.
- Demo data is explicitly marked simulated.
- Missing telemetry is represented as unavailable, not fabricated.

# Phase 2 — Model and residential classification

### ML-001 — Validate the residential taxonomy and label mapping
**Priority:** P0

**Objective:** Ensure the model's seven output classes map consistently to the intended home broadband traffic classes.

**Why:** The older Nano-Stream model used IDS/security labels. The new residential taxonomy is a different classification task and must not inherit old label meanings.

**Work:**
- Define each class, examples, ambiguous cases and unsupported cases.
- Create one canonical label manifest.
- Validate class-to-index mapping across training, inference, API and frontend.
- Add an explicit `unknown`/low-confidence handling policy where appropriate; do not force every flow into a confident class.
- Document limitations for encrypted traffic, QUIC, VPNs, shared CDNs and port-based ambiguity.

**Acceptance criteria:**
- Training and runtime mappings are identical and versioned.
- Tests detect reordered or missing labels.
- Unknown/low-confidence flows are handled safely.

### ML-002 — Verify training/inference feature parity
**Priority:** P0

**Objective:** Ensure the runtime feature extractor produces exactly the representation expected by the deployed model.

**Why:** A model can load and return seven scores while still receiving semantically incorrect or differently scaled features.

**Work:**
- Compare feature names, order, units, scaling, clipping, missing-value handling and tensor shape.
- Store feature schema version and preprocessing metadata with the checkpoint.
- Reject incompatible checkpoints rather than silently guessing.
- Add golden-vector tests: known input record → expected preprocessed tensor.
- Validate quantized and FP32 variants.

**Acceptance criteria:**
- A golden test confirms exact preprocessing parity.
- Model loading fails clearly for incompatible schema/version.
- Model metadata identifies architecture, class mapping and training artifact.

### ML-003 — Evaluate the model on relevant residential traffic
**Priority:** P0

**Objective:** Demonstrate that the classifier works on the target traffic classes, not only on legacy IDS datasets or generated examples.

**Why:** The competition task is mixed home broadband traffic. Legacy CIC-IDS results do not establish residential application classification performance.

**Work:**
- Identify a suitable lawful dataset or collect a consented controlled dataset.
- Define train/validation/test splits that avoid leakage across flows, sessions, devices or capture periods.
- Include realistic congestion and changing network conditions.
- Evaluate per-class precision, recall, F1, macro-F1, confusion matrix and calibration.
- Include unknown/ambiguous traffic.
- Report dataset limitations and representativeness.

**Acceptance criteria:**
- Evaluation uses a held-out test set.
- Per-class metrics and confusion matrix are saved.
- The report distinguishes public dataset results from locally collected testbed results.
- No unsupported accuracy claim is made.

### ML-004 — Audit model fallback and inference error behaviour
**Priority:** P1

**Objective:** Ensure fallback behaviour cannot silently mask model failure.

**Why:** A fallback model may keep the API running but can hide a broken or incompatible deployment model.

**Work:**
- Make fallback activation explicit in health status and logs.
- Expose active model name/version and inference state.
- Define safe handling for model load failure, timeout, malformed input and low confidence.
- Avoid assigning a high-priority class when classification is uncertain.
- Test model reload and failure recovery.

**Acceptance criteria:**
- Model failure is visible to API and frontend.
- Fallback mode is labelled and auditable.
- Uncertain flows receive a safe default policy.

# Phase 3 — Capacity and congestion measurement

### CAP-001 — Replace synthetic capacity samples with real measurements
**Priority:** P0

**Objective:** Feed actual interface/network measurements into `CapacitySampler`.

**Why:** The current sampler's logic is not evidence of adaptive capacity estimation if its inputs are fixed or generated.

**Work:**
- Collect interface byte counters and derive throughput over known intervals.
- Collect RTT/latency measurements to a documented endpoint or testbed peer.
- Read queue backlog, drops and class statistics where available.
- Distinguish WAN capacity estimate, configured shaping ceiling and observed throughput.
- Handle counter resets, interface changes and missing samples.
- Record sampling interval and measurement uncertainty.

**Acceptance criteria:**
- Throughput changes when actual traffic load changes.
- Measurements can be traced to interface counters or documented probes.
- No fixed confidence value is presented as measured confidence.

### CAP-002 — Validate capacity estimator behaviour
**Priority:** P1

**Objective:** Test smoothing, hysteresis, cooldown and congestion state transitions against known network conditions.

**Why:** These mechanisms can prevent oscillation but can also delay response or misclassify congestion if not calibrated.

**Work:**
- Create controlled bandwidth profiles and step changes.
- Test sudden capacity reduction and recovery.
- Test noise, missing samples and counter resets.
- Measure estimation error, convergence time, overshoot and oscillation.
- Derive confidence only from a defined method; otherwise expose confidence as unavailable.

**Acceptance criteria:**
- Estimator response is documented for each test profile.
- Error and recovery metrics are exported.
- Parameters are configurable and justified by experiments.

### CAP-003 — Add stale-data and sensor-failure handling
**Priority:** P1

**Objective:** Prevent stale or missing capacity data from causing aggressive policy changes.

**Why:** Adaptive control must fail safely when measurements are unreliable.

**Work:**
- Define freshness thresholds.
- Freeze or revert to a conservative baseline when measurements become stale.
- Expose sensor health and data age.
- Log state transitions and reasons.

**Acceptance criteria:**
- Sensor outage does not trigger arbitrary capacity changes.
- Frontend shows stale/unavailable state.
- Recovery is tested.

# Phase 4 — Policy, intent, fairness and safety

### POL-001 — Establish a single policy lifecycle
**Priority:** P0

**Objective:** Make policy proposal, validation, enforcement, verification and commit one atomic logical workflow.

**Why:** The current intent API can update policy-engine state without applying the resulting policy through the TC adapter. This can make internal state disagree with the real network.

**Required sequence:**
1. Receive classification/capacity/intent update.
2. Compute proposed policy.
3. Validate bandwidth totals, minimum/maximum constraints and interface capacity.
4. Validate fairness and starvation constraints.
5. Apply policy through enforcement adapter.
6. Read back actual kernel/network configuration.
7. Verify applied values within tolerances.
8. Commit policy state and audit event only after verification.
9. On failure, restore last known-good policy and verify rollback.

**Acceptance criteria:**
- No policy is labelled applied/verified before read-back.
- Failed enforcement does not commit the new policy.
- Rollback restores the last known-good configuration.
- Each transition has a timestamp, policy ID and reason.

### POL-002 — Connect intent creation, expiry and cancellation to enforcement
**Priority:** P0

**Objective:** Ensure user intents cause real, temporary policy changes and reliably revert when they expire or are cancelled.

**Why:** An intent store alone is not intent-aware QoS. Expiration must trigger recomputation and enforcement, not just remove an in-memory record.

**Work:**
- Validate intent class/device/flow scope, priority, duration and requested bandwidth.
- Enforce maximum duration and bounds.
- Resolve conflicting intents deterministically.
- On creation, recompute and apply policy.
- On expiry/cancellation, recompute and apply the restored policy.
- Persist or safely reconstruct active intents as appropriate.
- Record audit history.

**Acceptance criteria:**
- A test intent changes verified network configuration.
- Expiry automatically restores the expected policy.
- Cancellation behaves identically to early expiry.
- Conflicting intents produce documented deterministic results.

### POL-003 — Implement and test fairness constraints
**Priority:** P0

**Objective:** Prevent one class/device/intent from monopolising bandwidth.

**Why:** A QoS system that protects video calls by starving all downloads is not a fair residential solution.

**Work:**
- Define fairness scope: per class, per device, or both.
- Define minimum service guarantees and maximum shares.
- Choose and justify a fairness metric (e.g., Jain's fairness index where applicable).
- Include starvation duration and minimum-throughput checks.
- Evaluate under multiple competing devices and traffic mixes.
- Ensure policy remains feasible when requested minima exceed capacity.

**Acceptance criteria:**
- Fairness constraints are checked before enforcement.
- Overcommitted requests are rejected or proportionally adjusted with an explanation.
- Fairness metrics are recorded in experiments.

### POL-004 — Add safe defaults and policy validation
**Priority:** P1

**Objective:** Make the policy engine robust to invalid, incomplete or contradictory inputs.

**Work:**
- Validate rate units and conversion.
- Prevent total guaranteed rates exceeding available capacity.
- Define default class for unknown traffic.
- Protect management/control traffic.
- Add bounds on intent priorities and shaping rates.
- Ensure policy changes are rate-limited to prevent oscillation.
- Record why each policy decision was made.

**Acceptance criteria:**
- Invalid proposals are rejected before enforcement.
- Safe baseline is retained during model/sensor failure.
- Every policy can be explained from its inputs and constraints.

# Phase 5 — Linux enforcement and network integration

### ENF-001 — Implement controlled live Linux TC mode
**Priority:** P0

**Objective:** Provide a real enforcement path while retaining dry-run as the safe default.

**Why:** The current adapter is initialised with `dry_run=True`; dry-run command generation is not live QoS enforcement.

**Work:**
- Keep dry-run enabled by default.
- Require explicit configuration to enable live enforcement.
- Validate Linux platform, interface existence, permissions and supported `tc` features.
- Use safe command construction without shell injection.
- Create/replace HTB hierarchy and FQ-CoDel qdiscs in a deterministic way.
- Define ownership of qdisc hierarchy to avoid overwriting unrelated user configuration.
- Capture command output and errors.
- Add timeout and rollback.
- Never silently switch from live mode to dry-run.

**Acceptance criteria:**
- In an isolated Linux testbed, actual `tc` commands execute.
- `tc qdisc show`, `tc class show` and statistics confirm the intended hierarchy.
- Failure leaves a verified safe configuration.
- API status accurately distinguishes dry-run from live enforcement.

### ENF-002 — Verify read-back against requested policy
**Priority:** P0

**Objective:** Ensure actual kernel state matches the policy proposal.

**Why:** Synthetic read-back values in dry-run mode cannot establish enforcement success.

**Work:**
- Parse actual qdisc/class state.
- Compare configured rates, ceilings, priorities and qdisc parameters with expected values.
- Define tolerances and unsupported-state handling.
- Store verification result and raw read-back evidence.

**Acceptance criteria:**
- A deliberately mismatched configuration fails verification.
- Dry-run output is clearly labelled simulated.
- Live verification uses actual kernel output.

### ENF-003 — Implement rollback and recovery tests
**Priority:** P0

**Objective:** Guarantee recovery from partial command failure, process restart and invalid policy.

**Why:** A QoS controller must not leave the home network in a broken state.

**Work:**
- Save last known-good configuration.
- Apply changes transactionally where possible.
- On partial failure, restore baseline and verify.
- Test adapter restart and missing interface.
- Provide manual safe-reset command and documented recovery instructions.

**Acceptance criteria:**
- Fault injection demonstrates rollback.
- Failure is visible in API and audit log.
- No false success is returned.

### ENF-004 — Define deployment/testbed topology
**Priority:** P1

**Objective:** Document the actual environment in which the system is validated.

**Why:** `tc` on a physical WAN interface, OVS/Mininet and Ryu are not interchangeable deployment claims.

**Work:**
- Define topology, interfaces, link rates, switch/controller roles and traffic endpoints.
- Document whether shaping occurs on WAN egress, LAN egress or a virtual bottleneck.
- Explain limitations of the testbed relative to a consumer router.
- Provide repeatable setup and teardown scripts.

**Acceptance criteria:**
- Another team member can reproduce the topology from a clean Linux environment.
- All interface names and rate assumptions are configurable.
- Cleanup restores network state.

# Phase 6 — API correctness and frontend integration

### API-001 — Make backend health truthful and component-specific
**Priority:** P0

**Objective:** Remove hardcoded claims that the system is connected or operational.

**Why:** The current health response can claim LIVE/Ryu connected despite synthetic telemetry and no verified controller path.

**Work:**
- Report API process, telemetry collector, model loader, capacity sampler, policy engine, enforcement adapter and controller separately.
- Use statuses such as `CONNECTED`, `DISCONNECTED`, `DEGRADED`, `DRY_RUN`, `LIVE_UNVERIFIED`, `LIVE_VERIFIED`, `FAILED`.
- Include last successful measurement and data age.
- Do not infer telemetry health from API process health.

**Acceptance criteria:**
- Health endpoint reflects induced component failures.
- A dry-run adapter cannot be reported as live verified.
- No controller is reported connected without an actual connection check.

### API-002 — Remove synthetic telemetry from LIVE startup and routes
**Priority:** P0

**Objective:** Ensure LIVE mode contains only real data.

**Why:** `api/server.py` seeds initial flows and generates capacity/metrics values. This is acceptable in demo mode but misleading in LIVE mode.

**Work:**
- Move synthetic seeding behind explicit demo configuration.
- Make production/live startup empty until a real collector supplies data.
- Remove time-based synthetic metric generation from LIVE SSE.
- Return empty collections or explicit no-data status when no measurements exist.
- Mark all demo payloads as simulated.

**Acceptance criteria:**
- LIVE startup produces no fabricated flows or capacity samples.
- Empty live telemetry remains empty.
- Demo mode remains usable and clearly labelled.

### API-003 — Standardise API schemas and error handling
**Priority:** P1

**Objective:** Make API responses stable and typed for the frontend.

**Work:**
- Validate response models for flows, capacity, policies, intents, events, metrics and health.
- Use consistent timestamps (UTC ISO 8601).
- Define pagination/retention limits for event and metric history.
- Return meaningful HTTP status codes and structured errors.
- Version breaking schema changes.
- Generate OpenAPI from the actual FastAPI application and compare it with `docs/api/openapi.yaml`.

**Acceptance criteria:**
- Contract tests cover success, empty, invalid and failure responses.
- OpenAPI documentation matches runtime.
- No endpoint returns a different shape depending on demo/live mode without a documented discriminator.

### API-004 — Decide and document polling versus SSE
**Priority:** P2

**Objective:** Align frontend streaming claims with actual implementation.

**Why:** The backend exposes SSE, while the frontend API client currently polls.

**Work:**
- Keep polling initially if it is reliable and sufficient.
- If SSE is selected, implement reconnect, heartbeat, event IDs, backoff and cleanup.
- Avoid implementing both paths without a clear purpose.
- Update architecture and runbook.

**Acceptance criteria:**
- Documentation accurately states the active transport.
- No duplicate polling and SSE streams create unnecessary load.
- Reconnect and disconnect states are tested if SSE is used.

### FE-001 — Preserve the accepted visual design and component structure
**Priority:** P1

**Objective:** Finish the system without unnecessary frontend redesign.

**Why:** The user has approved the current visual direction. The remaining task is reliable data integration and truthful UI state, not visual reinvention.

**Work:**
- Preserve current approved palette, typography, navigation, sidebar and chart-first dashboard layout.
- Avoid replacing existing components unless required for correctness.
- Keep responsive behaviour and accessibility.
- Review changes against the accepted Task Manager-inspired compact dashboard reference, without copying proprietary UI assets.

**Acceptance criteria:**
- No unnecessary visual redesign.
- Existing pages and navigation remain functional.
- Frontend build and type checks pass.

### FE-002 — Eliminate LIVE-to-DEMO fallback
**Priority:** P0

**Objective:** Prevent generated data from appearing in LIVE mode.

**Why:** `src/App.tsx` currently falls back to generated demo flows/metrics/policies/intents when live collections are empty.

**Work:**
- Use separate data selectors for DEMO and LIVE.
- LIVE + empty response must render an empty/no-data state.
- LIVE + disconnected API must render a connection error.
- LIVE + stale telemetry must render a stale-data warning.
- Do not call demo generators in any LIVE branch.
- Add tests for each state.

**Acceptance criteria:**
- Empty LIVE API response renders no generated data.
- Network disconnect renders an explicit error.
- DEMO remains deterministic and isolated.
- Automated tests prove no demo generator is called in LIVE mode.

### FE-003 — Display provenance and enforcement state in the UI
**Priority:** P1

**Objective:** Make it clear whether the dashboard is showing simulated, measured, dry-run or verified live information.

**Work:**
- Add visible mode/provenance indicators.
- Show last measurement time and stale state.
- Distinguish proposed, applied, verified, dry-run and failed policy status.
- Display model fallback/unknown classification status.
- Avoid implying that a policy is active merely because it appears in a table.

**Acceptance criteria:**
- A user can tell whether the data is simulated or measured.
- A user can distinguish proposed from verified enforcement.
- Failure/degraded states are visible and understandable.

### FE-004 — Verify frontend API contracts and production build
**Priority:** P0

**Objective:** Confirm the React application compiles and consumes the real backend contract.

**Work:**
- Install using the selected lockfile/package manager.
- Run TypeScript checks and production build.
- Fix missing imports, type mismatches and stale API assumptions.
- Test all dashboard pages with populated, empty, stale and failed API responses.
- Check browser console and network requests.
- Confirm no secrets are bundled into frontend assets.

**Acceptance criteria:**
- Clean dependency install succeeds.
- Type check and production build succeed.
- No uncaught runtime errors in core workflows.
- Frontend can run against backend with empty and populated datasets.

# Phase 7 — Security, privacy and operational robustness

### SEC-001 — Restrict CORS and protect configuration
**Priority:** P1

**Objective:** Remove permissive development defaults from production configuration.

**Why:** The current API configuration allows all origins with credentials, which is inappropriate for deployment.

**Work:**
- Restrict allowed origins to configured frontend origins.
- Do not enable credentialed wildcard CORS.
- Keep secrets out of source control and frontend bundles.
- Validate environment variables at startup.
- Provide `.env.example` with placeholders only.

**Acceptance criteria:**
- Unapproved origins are rejected.
- No actual secrets exist in repository history or tracked files.
- Startup fails clearly for invalid required configuration.

### SEC-002 — Validate traffic-control command safety
**Priority:** P1

**Objective:** Prevent unsafe command execution or accidental changes to unrelated interfaces.

**Work:**
- Validate interface names against actual interfaces and safe character constraints.
- Avoid shell string interpolation; pass argument arrays to subprocess.
- Restrict command timeout and privileges.
- Require explicit interface allow-list for live mode.
- Log every command and result without leaking secrets.

**Acceptance criteria:**
- Malicious/invalid interface values are rejected.
- Commands cannot target arbitrary interfaces without configuration.
- Privilege and failure behaviour are documented.

### SEC-003 — Privacy-conscious metadata handling
**Priority:** P1

**Objective:** Minimise collection and retention of household traffic metadata.

**Work:**
- Document which fields are collected and why.
- Avoid payload capture.
- Hash/pseudonymise device identifiers where possible.
- Define retention and deletion policy for flow records.
- Restrict access to device/IP-level information.
- Document dataset consent and licence.

**Acceptance criteria:**
- Privacy documentation matches actual collection.
- Payload is not stored by default.
- Retention is bounded and configurable.

### SEC-004 — Help chatbot safety and key handling
**Priority:** P2

**Objective:** Keep the in-app Gemini/help assistant explanatory and secure.

**Work:**
- Ensure Gemini API key remains server-side.
- Explain project-specific terms and dashboard metrics.
- Treat user-highlighted text as untrusted input.
- Do not allow the chatbot to execute policy or network-control actions.
- Provide graceful handling for missing key, rate limits and provider outage.
- Clearly distinguish generated explanation from authoritative system state.

**Acceptance criteria:**
- No API key appears in built frontend assets.
- Chatbot cannot directly change QoS policies.
- Help content can explain the residential taxonomy, capacity, fairness, intents and enforcement states.

# Phase 8 — Experimental validation and hackathon evidence

### EXP-001 — Establish reproducible testbed and traffic profiles
**Priority:** P0

**Objective:** Create a controlled environment with repeatable mixed traffic and a known bottleneck.

**Why:** The hackathon requires evidence that adaptation improves service under contention, not just screenshots or a model accuracy score.

**Work:**
- Define testbed topology (Mininet/OVS or Linux network namespaces/veth pairs).
- Configure known bottleneck bandwidth and latency.
- Generate reproducible traffic: video-call-like UDP, gaming-like low-rate UDP, streaming-like sustained flows, browsing-like bursts, bulk TCP and background updates.
- Record random seeds and traffic-generator versions.
- Include capacity step-down and step-up scenarios.
- Ensure traffic labels are known for evaluation.

**Acceptance criteria:**
- One-command or documented repeatable experiment setup.
- Traffic profiles and topology are versioned.
- Baseline link capacity and induced conditions are recorded.

### EXP-002 — Compare against meaningful baselines
**Priority:** P0

**Objective:** Prove the value of adaptive, intent-aware control.

**Required baselines:**
1. No QoS / best effort.
2. Static QoS with fixed class priorities.
3. Deterministic adaptive QoS without ML (if feasible).
4. Proposed IntentQoS with classification, capacity awareness and intent.

**Why:** Without baselines, a lower latency number cannot be attributed to the proposed system.

**Acceptance criteria:**
- All methods use the same traffic mix, bottleneck and duration.
- Multiple repeated runs are performed.
- Results include variability, not only a best run.
- Baseline configuration is archived.

### EXP-003 — Measure user-visible QoS outcomes
**Priority:** P0

**Required metrics:**
- Median, p95 and p99 RTT/latency for interactive traffic.
- Jitter.
- Packet loss.
- Throughput by traffic class/device.
- Queue backlog and drops.
- Flow completion time for bulk transfers.
- Jain's fairness index or justified alternative.
- Capacity-estimation error and convergence time.
- Policy adaptation/recovery time.
- CPU, memory and inference latency.

**Acceptance criteria:**
- Raw measurements and summary tables are exported.
- Metrics are computed from actual testbed observations.
- Improvement claims include baseline, workload and confidence/variability information.
- No synthetic metric is described as a measured network outcome.

### EXP-004 — Ablation and stress experiments
**Priority:** P1

**Objective:** Establish which parts of the design actually contribute.

**Work:**
- Disable ML while retaining adaptive policy.
- Disable intent while retaining classification/capacity awareness.
- Disable capacity adaptation while retaining fixed QoS.
- Test high flow counts and rapid flow churn.
- Test sensor outage, classifier failure and enforcement failure.
- Test multiple devices and conflicting intents.

**Acceptance criteria:**
- Ablation results show contribution and trade-offs.
- Stress/fault outcomes are recorded.
- Known failure modes are documented.

### EXP-005 — Reconcile benchmark numbers and research claims
**Priority:** P0

**Objective:** Ensure README, paper and dashboard do not combine incomparable latency/accuracy figures.

**Why:** The repository contains multiple benchmark artifacts and the README highlights 0.018 ms while historical Nano-Stream material reports 1.17 ms. These may be different experiments; they must not be compared without context.

**Work:**
- For every result, record model/checkpoint, dataset, split, input shape, hardware, OS, framework, precision, batch size, warm-up, sample count and timing method.
- Report mean, median, p95 and p99 for latency.
- State whether latency is per sample, per batch, model-only or end-to-end.
- Separate historical Nano-Stream results from new IntentQoS residential results.
- Verify accuracy on the relevant held-out residential test set.
- Correct README and slides accordingly.

**Acceptance criteria:**
- Every headline number links to a reproducible result file and method.
- Incomparable results are clearly separated.
- No unsupported or ambiguous performance claim remains.

### EXP-006 — Produce a complete demo script and evidence package
**Priority:** P1

**Objective:** Make the hackathon demonstration understandable, repeatable and honest.

**Work:**
- Prepare a scenario: mixed traffic begins; WAN capacity falls; user starts a temporary video-call intent; system recomputes policy; enforcement is verified; latency/jitter/fairness outcomes are compared.
- Include a second scenario for intent expiry and recovery.
- Show DEMO mode separately from LIVE testbed mode.
- Capture terminal logs, dashboard screenshots, policy events, `tc` read-back and experiment results.
- Prepare fallback recording if testbed hardware fails.

**Acceptance criteria:**
- Demo can be run by another team member from the runbook.
- Every screen shown as LIVE is backed by real testbed data.
- Results and limitations are available to judges.

# Phase 9 — Documentation and repository consistency

### DOC-001 — Rewrite README around the actual implementation
**Priority:** P1

**Objective:** Separate original Nano-Stream research from the new IntentQoS system and avoid contradictory claims.

**Why:** The current README mixes the historical IDS/security research, new residential taxonomy, current prototype and intended deployment architecture.

**Required structure:**
1. Project overview and hackathon problem.
2. What Nano-Stream contributed.
3. What IntentQoS adds.
4. Current implemented architecture.
5. Active telemetry/control path.
6. Residential taxonomy and model.
7. Demo versus live operation.
8. API/frontend setup.
9. QoS enforcement and safety.
10. Experiments and benchmarks.
11. Reproduction steps.
12. Known limitations and roadmap.
13. Research paper citation.

**Acceptance criteria:**
- No legacy IDS taxonomy is presented as the current residential taxonomy.
- No Ryu integration is claimed unless active and tested.
- No live enforcement is claimed while dry-run is used.
- Duplicate headings and broken documentation links are fixed.

### DOC-002 — Update architecture, runbook, OpenAPI and security docs
**Priority:** P1

**Work:**
- Update architecture diagram to match actual active data flow.
- Update ADR with Ryu-versus-collector decision.
- Update runbook with demo/live prerequisites and recovery.
- Ensure OpenAPI matches runtime FastAPI schemas.
- Update security review with actual controls and known gaps.
- Document interface ownership and rollback.

**Acceptance criteria:**
- Every documented component exists or is clearly marked planned/legacy.
- A clean setup follows the runbook successfully.
- Documentation does not claim tests that have not been run.

### DOC-003 — Standardise code comments, headers and naming
**Priority:** P2

**Objective:** Preserve the existing modular coding style while removing misleading legacy comments.

**Work:**
- Keep the existing PURPOSE/ROLE/INVARIANTS header style for substantial modules.
- Update comments that refer to old IDS labels, random features or obsolete controller behaviour.
- Ensure comments describe current code, not planned behaviour.
- Use consistent names for traffic classes, capacity fields and policy states.
- Remove duplicated README sections and stale references.
- Do not add large explanatory comments that merely restate obvious code.

**Acceptance criteria:**
- No misleading comments remain in active code.
- Public functions have useful docstrings and type hints.
- Naming is consistent across model, API, frontend and docs.

### DOC-004 — Check unused files and dependencies before removal
**Priority:** P2

**Objective:** Reduce clutter without destroying research reproducibility.

**Work:**
- Search references before deleting any file.
- Identify unused imports, scripts, dependencies and assets.
- Classify model checkpoints and result files.
- Remove only files proven obsolete.
- Keep baseline checkpoints and result artifacts required for reproduction.
- Retain one chosen frontend lockfile/package manager.

**Acceptance criteria:**
- Cleanup report lists removed/moved files and rationale.
- No broken imports, scripts, links or tests.
- Clean install/build/test passes after cleanup.

---

## 6. Frontend page-by-page expectations

The visual design has been approved. Do not restart the design process. The objective is to make each existing page truthful, responsive and connected to real backend state.

| Page/area | Required live behaviour |
|---|---|
| Overview/dashboard | Show current telemetry provenance, link/capacity state, class distribution, latency/jitter, policy status and system health. Empty or stale data must be explicit. |
| Live traffic monitor | Show actual observed flows, class confidence/unknown state, device/flow metadata and timestamps. Do not invent flows. |
| Network/capacity | Distinguish configured WAN capacity, estimated capacity, shaped rate and observed throughput. Show stale sensor state. |
| QoS policy manager | Show proposed vs applied vs verified policy. Display rate constraints, class priority and enforcement failure. |
| User intent | Create, inspect, expire and cancel temporary intents. Show remaining duration and policy effect. |
| Experiments/benchmarks | Display reproducible run metadata and measured results, not fabricated live values. |
| Model/AI insights | Show active model/version, schema version, inference status, confidence and fallback state. |
| Help/search/chatbot | Explain domain-specific terms. Keep assistant read-only and keep API keys server-side. |
| Settings | Expose safe configuration; live enforcement must require explicit confirmation and privilege checks. |

---

## 7. API and state contract expectations

The frontend and backend must agree on a consistent state model.

### Required global modes

- `DEMO`: deterministic synthetic data; visibly labelled as simulated.
- `LIVE`: only real data from connected telemetry sources.
- `LIVE_NO_DATA`: source connected but no observations yet.
- `LIVE_STALE`: last observation exceeds freshness threshold.
- `LIVE_DISCONNECTED`: telemetry source unavailable.

### Required policy lifecycle

- `PROPOSED`
- `VALIDATING`
- `APPLYING`
- `APPLIED_UNVERIFIED`
- `VERIFIED`
- `FAILED`
- `ROLLING_BACK`
- `ROLLED_BACK`
- `DRY_RUN`

Do not collapse these into a single boolean `active`.

### Required component health

At minimum:
- API service.
- Telemetry collector/controller.
- Flow extractor.
- Model loader/inference.
- Capacity sampler.
- Policy engine.
- Enforcement adapter.
- Network interface/switch connection.

Health must be based on actual checks and last successful activity.

---

## 8. Test strategy and definition of done

### Unit tests

- Flow-key direction and aggregation.
- Feature schema ordering and preprocessing.
- Taxonomy mapping.
- Model confidence/unknown handling.
- Capacity smoothing and state transitions.
- Policy feasibility and fairness constraints.
- Intent creation, conflict, expiry and cancellation.
- TC command validation and parsing.
- API response schemas.
- Frontend LIVE/DEMO selectors.

### Integration tests

- Real telemetry source → extractor.
- Extractor → model inference.
- Capacity measurement → capacity sampler.
- Model + capacity + intent → policy proposal.
- Policy proposal → TC adapter.
- TC adapter → kernel read-back.
- Enforcement failure → rollback.
- API → frontend with populated, empty, stale and disconnected data.

### End-to-end acceptance scenario

A minimum credible demonstration must execute this sequence in a controlled testbed:

1. Start a known bottleneck link with documented capacity.
2. Generate at least three competing traffic types (interactive, streaming and bulk).
3. Observe actual packets/flow metadata.
4. Classify flows using the residential model, with unknown handling.
5. Measure actual throughput, RTT and queue state.
6. Reduce bottleneck capacity during the run.
7. Show capacity/congestion state transition.
8. Create a temporary user intent for an interactive flow/class.
9. Compute and validate a fair policy.
10. Apply the policy using live Linux TC/OVS enforcement.
11. Read back the actual applied configuration.
12. Measure latency, jitter, loss, throughput and fairness.
13. Expire/cancel the intent and verify policy restoration.
14. Inject an enforcement failure and verify rollback.
15. Confirm the dashboard displays the same backend state and does not substitute demo data.

### Definition of done

The project is ready to be represented as a functioning adaptive QoS solution only when:

- Real telemetry enters the system.
- Runtime model inputs match the documented training schema.
- Capacity measurements are real and traceable.
- User intents trigger policy recomputation.
- Fairness and capacity constraints are validated.
- Linux/network enforcement is actually applied.
- Kernel/network read-back verifies the result.
- Failure and rollback work.
- LIVE frontend displays only real telemetry.
- The end-to-end scenario is repeatable.
- Benchmark claims are traceable and comparable.
- README, architecture, runbook and security docs match the implementation.

---

## 9. Prioritised execution sequence

### Milestone A — Make LIVE truthful
1. Re-audit latest source.
2. Choose active Ryu or dedicated collector architecture.
3. Remove random-input legacy path from active operation.
4. Disable synthetic seeding in LIVE mode.
5. Make health status truthful.
6. Eliminate frontend LIVE-to-DEMO fallback.

**Exit condition:** The system cannot misrepresent demo data as live.

### Milestone B — Real telemetry and model path
1. Implement real packet/flow ingestion.
2. Connect it to FlowExtractor.
3. Validate feature schema parity.
4. Connect residential model inference.
5. Evaluate on held-out residential traffic.

**Exit condition:** Real testbed traffic produces traceable residential classification results.

### Milestone C — Real adaptive control
1. Connect real capacity and queue measurements.
2. Validate capacity estimator.
3. Make policy lifecycle transactional.
4. Connect intent create/expiry/cancel to enforcement.
5. Add fairness and safe fallback.
6. Enable controlled Linux TC mode.
7. Verify read-back and rollback.

**Exit condition:** Intent/capacity changes alter actual network configuration safely.

### Milestone D — Full integration and experiment
1. Complete API schemas and health.
2. Connect all frontend pages.
3. Run full end-to-end scenario.
4. Compare against no-QoS/static/adaptive baselines.
5. Export raw results and metrics.

**Exit condition:** Reproducible evidence demonstrates measurable benefit.

### Milestone E — Submission readiness
1. Reconcile README and documentation.
2. Clean stale files and dependencies.
3. Run clean install, frontend build, backend tests and integration tests.
4. Prepare demo script, screenshots, logs and limitations.
5. Review every claim against evidence.

**Exit condition:** Another team member can reproduce the demo from a clean setup and explain the architecture and results.

---

## 10. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Legacy Ryu path remains active | Wrong model inputs and misleading controller status | Choose one architecture and remove ambiguity |
| Synthetic data presented as live | Invalid demonstration and loss of credibility | Provenance fields and strict mode separation |
| Dry-run mistaken for enforcement | Core requirement not demonstrated | Live testbed and kernel read-back |
| Feature schema mismatch | Incorrect classifications despite successful inference | Versioned schema and golden-vector tests |
| Encrypted/QUIC traffic ambiguity | Classification errors | Confidence/unknown handling and honest limitations |
| Capacity estimate is noisy | Policy oscillation or slow adaptation | Hysteresis, calibration and controlled tests |
| Intent expires without enforcement update | Stale elevated priority | Expiry event triggers full policy lifecycle |
| Fairness not measured | Background starvation | Jain's index/throughput guarantees and multi-device tests |
| TC changes disrupt host networking | Loss of connectivity | Isolated testbed, allow-listed interface and rollback |
| Frontend displays demo data in LIVE | Misleading judges/operators | Separate selectors and automated tests |
| Benchmark values are incomparable | Unsupported performance claims | Complete metadata and reproducible scripts |
| Security defaults remain permissive | Unintended access/control | Restrict CORS, privileges and command execution |

---

## 11. Research and contribution framing

The project should not claim novelty merely because it combines a CNN, capacity estimation and traffic shaping. The contribution must be stated in terms of a demonstrable mechanism and evaluation.

### Defensible contribution candidates

1. A resource-efficient metadata-based classifier adapted to mixed residential traffic.
2. A capacity-aware policy engine that combines traffic class, temporary user intent and fairness constraints.
3. A verified closed-loop enforcement mechanism with safe rollback.
4. A reproducible evaluation under changing bottleneck capacity and competing traffic.

### What must be demonstrated

- Does the classifier add value over rules or port/metadata baselines?
- Does capacity awareness outperform fixed-rate static QoS?
- Does temporary intent improve the intended interactive flow without unacceptable starvation?
- Does fairness remain acceptable under multiple devices and conflicting demands?
- Does verification/rollback prevent unsafe or inconsistent policy states?
- What are CPU, memory and inference overheads?

### Honest limitations to document

- Encrypted traffic limits application identification.
- QUIC and shared CDN traffic can make class inference ambiguous.
- Dataset representativeness may limit generalisation.
- Home router hardware and driver support vary.
- WAN capacity is not always directly observable from a client-side interface.
- A Mininet/Linux testbed is not equivalent to deployment on every consumer router.
- Classification confidence is not the same as calibrated probability unless calibration is evaluated.

---

## 12. Handoff instructions for the implementing teammate

1. Read this document before changing code.
2. Re-audit the latest working tree; the archive reviewed may be older than the current branch.
3. Use the CSV tracker to assign and update tasks.
4. Do not redesign the approved frontend.
5. Do not rewrite working modules just to change style.
6. Fix correctness and integration before adding features.
7. Do not remove checkpoints or experiment outputs until their purpose and references are checked.
8. Keep dry-run as the default; test live enforcement in an isolated environment.
9. Never represent synthetic telemetry as live.
10. Attach evidence to each completed P0 requirement: test output, logs, kernel read-back, screenshots or experiment result.
11. Update documentation in the same change as code.
12. At the end of each milestone, provide a short report: files changed, behaviour added, tests run, evidence, known limitations and remaining blockers.

**Final instruction:** The project should be judged by the complete verified network-control loop, not by the number of modules, endpoints, charts or model files present.
