# IntentQoS / Nano-Stream — Frontend Design Specification and Build Requirements

**Version:** 1.0  
**Purpose:** Build a polished, judge-friendly, technically credible frontend for the TELIPORT Season 4 adaptive home-broadband QoS prototype.  
**Status:** Proposed specification; must be reconciled with backend API capabilities as they are implemented.  
**Product naming recommendation:** **IntentQoS**, with a small subtitle “Built on Nano-Stream research”. Do not imply the research paper already implements every proposed feature.

---

## 1. Product goal

Create a desktop-first web dashboard that helps a judge, researcher, or network operator understand how mixed home-broadband traffic is observed, classified, prioritized, shaped, and evaluated as WAN conditions change. The UI should feel like a premium network-operations product, not a generic admin template or a marketing landing page.

The frontend must communicate two things simultaneously:
1. **Operational credibility:** meaningful measurements, explicit system state, honest provenance, readable data, useful controls, errors and safety behavior.
2. **Demonstration quality:** strong visual hierarchy, a distinctive visual identity, well-designed charts, subtle purposeful animation, a clear story, and polished transitions.

A visually impressive interface must never imply that simulated data is live or that unimplemented backend capabilities are operational.

## 2. Current repository facts and boundaries

The supplied `Traffic Classification.zip` repository contains a Python ML pipeline, model implementations/checkpoints, experiment scripts, and a Ryu SDN prototype. It does not contain a React or other frontend application. The current Ryu app uses random input features rather than a complete live-flow feature-extraction pipeline, so the frontend must not present those predictions as valid live classification. The current repository also does not establish a complete WAN-capacity estimator, user-intent system, fairness-constrained policy engine, or complete end-to-end experiment harness.

Therefore:
- Build the frontend as a separate React application.
- Keep API integration behind a typed service/data-adapter layer.
- Implement an explicit **Demo / Replay mode** with synthetic scenario data, visually labelled on every page.
- Implement a **Live mode** only when a backend health check and supported API endpoints confirm that real data is available.
- Never silently fall back from Live to Demo data. If Live mode fails, show a visible connection state and allow the user to switch modes deliberately.
- Do not build fake “AI” functionality that claims to train, learn, or enforce network rules when it only changes UI state.

## 3. Recommended visual direction

### Design concept: “Calm, cinematic network intelligence”

Use a deep navy/charcoal operations-console foundation with cyan and restrained violet accents. The interface should be elegant, precise, high-contrast, and legible. Use glow only to encode focus, active data paths, or status—not as a universal card effect.

Suggested starting tokens (adjust after preview if contrast or readability suffers):
- App background: `#080D18`
- Sidebar / elevated shell: `#0D1423`
- Primary card: `#111B2D`
- Elevated card: `#162238`
- Main text: `#F3F7FF`
- Secondary text: `#9AAAC2`
- Muted text: `#6F809A`
- Border: `rgba(154,170,194,0.16)`
- Primary cyan: `#55D6FF`
- Secondary blue: `#648BFF`
- Accent violet: `#A78BFA`
- Success: `#4ADEA3`
- Warning: `#F5C66A`
- Error: `#FF6B7A`

Use a modern, highly readable sans-serif such as Inter or Geist, with tabular numerals for measurements. Use consistent 4/8 px spacing increments, modest corner radii (10–16 px), crisp borders, layered surfaces, and restrained shadows. Avoid excessive glassmorphism, huge rounded pills, overused gradients, tiny grey text, and neon everywhere.

### Visual hierarchy
- Persistent left sidebar with product identity, navigation and environment status.
- Top header with page title/breadcrumb, Demo/Live selector, connection status, time range and user/system menu as appropriate.
- Main content uses a responsive 12-column grid on desktop.
- Primary metrics are prominent but not oversized; each metric has units, time context and provenance.
- Charts must have axes, units, tooltips, legends, sensible empty states and consistent colors.
- Use color plus text/icon/shape to convey status; never rely on color alone.

## 4. Frontend technology recommendation

Use the simplest stack that AI Studio can build and maintain reliably:
- React + TypeScript.
- Vite if AI Studio's current generated project supports it cleanly; otherwise retain the supported React setup AI Studio creates.
- Tailwind CSS for consistent tokens and responsive layouts, or CSS modules/plain CSS if the generated project is not configured for Tailwind. Do not introduce two competing styling systems.
- `motion` (`motion/react`) for purposeful transitions, layout changes, menu/dialog animation, and small state changes.
- React Bits free components selectively for one or two distinctive effects, such as a subtle background texture or a carefully contained highlight effect. Prefer copying/adapting source over adding many effects.
- Recharts for standard operational charts unless a more suitable charting dependency is already present. Keep chart semantics accessible and labels readable.
- Lucide React or the icon set already installed by the scaffold; use one icon family consistently.
- A typed API client and mock-data adapter, so the UI is not tightly coupled to endpoint details.
- React Router if routing is not already provided; otherwise use the existing router.

Do not add Three.js / React Three Fiber by default. A 2D topology view is likely clearer, faster, more accessible, and easier to validate. Consider 3D only if a concrete demo need justifies its performance and implementation cost.

Avoid unnecessary component-library stacking. If shadcn/ui is already installed or AI Studio creates it naturally, use it for accessible primitives (dialogs, dropdowns, tabs, tooltips, forms) and customize its theme. Do not mix multiple component libraries without a specific reason.

## 5. Navigation and page inventory

### 5.1 Overview — required, highest priority
Purpose: give judges an immediate understanding of current system health and the value being demonstrated.

Elements:
- Header: “IntentQoS”, subtitle “Adaptive QoS for mixed home broadband traffic”, mode badge (`DEMO / REPLAY` or `LIVE`), backend connection status, last-updated time.
- KPI cards: estimated WAN capacity (only if available), current throughput, median latency, p95 latency, packet loss, active flows. Each card includes units and a compact time-series sparkline where appropriate.
- Traffic mix panel: video call, gaming, interactive browsing, streaming, bulk downloads, background sync/updates, unknown/unclassified. Clearly label whether class values are measured, inferred, or simulated.
- Latency / throughput timeline with selectable time ranges.
- Network topology panel: Internet/WAN → router or gateway → switch/queue → client hosts. Use 2D SVG/canvas or normal React/SVG. Animated flow paths must reflect current demo/live state and pause under reduced-motion settings.
- “Recent decisions” feed: timestamp, event, reason, policy effect, source (live/demo), outcome. Do not fabricate decisions in Live mode.
- Scenario controls in Demo mode: stable link, bandwidth drop, competing download, video call starts, gaming session, background backup, bursty congestion. Provide Start, Pause, Reset, and scenario duration controls.
- System health panel: frontend, API, classifier, controller, enforcement state. Use `Unknown / Not connected` when no verified health endpoint exists; never show green just because the frontend loaded.

### 5.2 Live Traffic
Purpose: inspect flow records and classification evidence.

Elements:
- Search and filters by traffic class, source/destination label, protocol, confidence range, time window and status, only where data exists.
- Table columns: flow identifier, source/destination labels, protocol, rate, packet/byte counters, predicted class, confidence, policy class, last seen, provenance. Do not expose payload or personal browsing content.
- Sortable columns, pagination or virtualized rows if needed, responsive horizontal overflow, row details drawer.
- Detail drawer: flow metadata, time-series if available, classifier version, confidence, features used (metadata only), applied policy, and classification status.
- Explicit unknown/low-confidence state; do not force every flow into a known class.
- Empty, loading, disconnected and error states.

### 5.3 Capacity & Congestion
Purpose: explain what changes when WAN conditions change.

Elements:
- Capacity history and current estimate, including estimation timestamp and confidence/error range if the backend provides it.
- Configured shaping rate versus estimated available capacity, displayed distinctly.
- Queue delay, queue depth, drops/loss, utilization and link state if available.
- Mark known configured values separately from measured estimates.
- Demo scenarios for WAN capacity step-down/step-up and congestion.
- Annotation markers for capacity changes and policy adaptations.
- Do not invent an estimator confidence interval or claim a capacity estimator exists until backend support is implemented.

### 5.4 Intents & Policy
Purpose: show the human intent and safety constraints behind scheduling decisions.

Elements:
- Policy table with class, priority, minimum/maximum rate or share, latency target, burst/weight settings where supported, enabled status, and last changed.
- Create/edit intent form: intent name, traffic class or user/device scope (only if supported), priority, optional rate ceiling/floor, expiration time, and rationale.
- Temporary intents must display expiry countdown and automatically become inactive only when the backend confirms the expiry behavior. Demo mode may simulate expiry but must be labelled.
- Policy preview / impact summary before apply.
- Confirmation dialog for impactful changes; explicit cancel path.
- Apply, revert and reset-to-baseline actions must call real API endpoints in Live mode. If endpoints do not exist, disable the action and explain why; in Demo mode, simulate the action and label it.
- Fairness view: per-class/per-host allocation and Jain’s fairness index only when calculated from actual experiment data. Explain the population and time window used.
- Show safety bounds and policy validation errors.

### 5.5 Experiments & Benchmarks
Purpose: prove claims with reproducible comparisons.

Elements:
- Scenario selector and configuration summary: topology, WAN capacity, traffic mix, duration, seed, queue discipline, classifier/model version, policy profile.
- Baseline choices: no shaping / static QoS, FQ-CoDel or CAKE/SQM where the test environment supports it, deterministic adaptive policy, proposed IntentQoS policy.
- Run, stop, clone configuration, compare runs, export CSV/JSON, and view reproducibility metadata. Disable unavailable operations.
- Metrics: median and p95/p99 latency, jitter, packet loss, throughput per class, queue delay, fairness, recovery time after capacity change, classification precision/recall/F1/confusion matrix, CPU/memory, inference latency, policy overhead. Display only metrics that are actually recorded.
- Comparison charts with units, sample size, run duration, error bars/confidence intervals where statistically justified, and a clear baseline label.
- Every run should show status, start/end time, config hash or equivalent, software/model version, seed, and artifacts available.
- Exportable experiment summary suitable for a technical report.

### 5.6 Model Insights
Purpose: explain classifier behavior without overselling it.

Elements:
- Model name/version, feature schema/version, class mapping version, quantization state and artifact identifier.
- Accuracy, precision, recall, F1, per-class metrics and confusion matrix only from a named evaluation dataset/run.
- Confidence distribution and unknown/low-confidence count when available.
- Inference latency distribution (not just a single best number) and device/environment details.
- Quantized versus floating-point comparison only when measured under the same documented conditions.
- Clearly separate offline evaluation metrics from live traffic statistics.
- Explain data source and limitations; never expose training data records or payloads.

### 5.7 Settings & Diagnostics
Purpose: allow a demonstrator or operator to inspect system state safely.

Elements:
- API/controller reachability and version information.
- Active data mode and update interval.
- Feature schema and model artifact configuration, read-only initially.
- Experiment output location/export options if supported.
- Structured logs with severity, timestamp, component, event and correlation/run ID; redact secrets and sensitive flow details.
- Health-check results, dependency versions, recent errors and diagnostics export.
- Destructive or network-affecting controls require confirmation and clear warnings.

## 6. Global interaction requirements

- All navigation items work; no dead links or placeholder buttons.
- Every button has a defined behavior. If a backend feature is unavailable, show a disabled state with a short reason or a clear “Not available in this build” notice.
- Add keyboard focus styles, keyboard-operable menus/dialogs, accessible labels, semantic headings, and appropriate contrast.
- Respect `prefers-reduced-motion` and provide a UI-level animation toggle.
- Use skeletons only for loading; use purposeful empty states when no data exists; show errors with retry and context.
- Use toasts for action results but do not make a toast the only record of a critical change.
- Confirm risky policy changes. Do not show successful enforcement until the backend confirms success.
- Use consistent units (Mbps/Gbps, ms, %, packets/s, bytes) and state the time range.
- Use timestamps consistently and show the timezone when relevant.
- Provide a persistent Demo/Live indicator in the app shell and a visible label on charts/cards that display simulated data.
- Responsive targets: 1440×900 desktop first; support 1280×720; usable tablet layout; basic mobile monitoring layout without forcing a dense table into tiny columns.

## 7. Data architecture and API integration

Implement a typed `DataProvider` or equivalent abstraction with two implementations:
1. `DemoDataProvider`: deterministic seeded scenarios, controlled time progression, repeatable metrics, simulated event feed, reset/pause/play. The UI must visibly identify these data as simulated.
2. `LiveDataProvider`: typed HTTP calls and optionally SSE/WebSocket for live updates only if the backend supports them. If not, use polling with a configurable interval and cleanup. Do not assume WebSocket support.

Suggested frontend types (adjust to backend contract):
- `SystemHealth`
- `MetricPoint`
- `FlowRecord`
- `TrafficClass`
- `CapacityEstimate`
- `QoSPolicy`
- `UserIntent`
- `PolicyEvent`
- `ExperimentConfig`
- `ExperimentRun`
- `ModelEvaluation`
- `ApiError`

Create an API contract document before wiring Live mode. Expected endpoint ideas—not assumed existing endpoints—could include:
- `GET /api/health`
- `GET /api/overview`
- `GET /api/flows`
- `GET /api/metrics/timeseries`
- `GET /api/capacity`
- `GET /api/policies`
- `POST /api/intents`
- `PATCH /api/intents/{id}`
- `DELETE /api/intents/{id}`
- `POST /api/policies/preview`
- `POST /api/policies/apply`
- `POST /api/experiments`
- `GET /api/experiments/{id}`
- `GET /api/models/evaluations`

The backend team must decide and document actual routes, schemas, errors, authorization and semantics. The frontend must not invent route behavior and silently treat it as implemented.

## 8. Motion and React Bits strategy

Use motion to clarify state transitions:
- 160–240 ms for small hover/focus/menu transitions.
- 220–360 ms for page or panel transitions, only where it improves orientation.
- Smooth count changes only when values update; do not animate every number constantly.
- Animate a topology path only when it represents traffic movement; throttle updates.
- Use layout animations for drawers, tabs and reordering only where useful.
- Avoid continuous animated backgrounds behind charts, tables or long reading areas.
- Do not use cursor-following effects that interfere with selecting text or interacting with charts.
- Use React Bits for one carefully selected, low-cost signature element at most in the first version; inspect component dependencies, accessibility, licensing and reduced-motion behavior before integrating.
- No 3D by default. If considered, provide a fallback 2D view and test GPU/CPU use, reduced motion and mobile behavior.

## 9. Accessibility, privacy and security

- Target WCAG 2.2 AA principles for contrast, keyboard navigation, focus visibility, labels, and status messaging.
- Do not collect or display packet payloads, browsing history or personal content. Use flow metadata and aggregate metrics.
- No secrets, API keys or controller credentials in frontend source, local storage, URL parameters or logs.
- Do not allow arbitrary user-entered shell commands or direct command execution from the browser.
- Treat network-affecting operations as privileged backend actions with validation and authorization.
- Sanitize/escape server-provided text in logs and labels; do not render arbitrary HTML from API responses.
- Do not use color alone to indicate traffic class or state; pair color with text/icon/shape.
- Respect reduced motion and allow pausing any continuously moving visualization.

## 10. Functional acceptance criteria

### FE-001 App shell and navigation — P0
- Sidebar/top bar are consistent across all routes.
- All seven pages load directly and through navigation.
- Active route is obvious and keyboard navigation works.
- Responsive layout works at 1440×900 and 1280×720 without major overflow.

### FE-002 Mode provenance — P0
- Demo mode always displays a persistent Demo/Replay badge and marks synthetic charts/metrics.
- Live mode never uses demo data as an invisible fallback.
- API disconnection is visible and provides retry/mode-switch controls.

### FE-003 Overview — P0
- KPI cards display value, unit, time context and source state.
- Charts have labels, legends, tooltips, time range controls and empty/error states.
- Topology responds to demo scenario state and pauses when requested.
- Recent event feed clearly differentiates simulated and confirmed events.

### FE-004 Traffic table — P1
- Search, sorting, filtering and row detail work for available fields.
- Unknown/low-confidence classification is represented explicitly.
- Empty, loading, error and disconnected states are covered.

### FE-005 Policy/intents UI — P1
- Forms validate inputs and show policy preview.
- In Live mode, controls are disabled unless supported endpoints are confirmed.
- No UI reports policy application success before backend confirmation.
- Expiring intents show their expiry and lifecycle state.

### FE-006 Experiment comparison — P1
- User can select a demo scenario, run/replay it, pause/reset and compare baseline profiles.
- Export is functional and contains run metadata and displayed metrics.
- UI labels synthetic demo results and avoids statistical claims unsupported by sample size.

### FE-007 Model insights — P1
- Evaluation metrics are tied to dataset/run/model version.
- Offline metrics are not presented as live accuracy.
- Confusion matrix and per-class metrics are usable and labelled.

### FE-008 Motion and accessibility — P1
- Reduced-motion preference disables or simplifies nonessential animation.
- Keyboard focus, labels, dialog behavior and chart descriptions are implemented.
- No essential information is communicated only through animation or color.

### FE-009 Diagnostics — P2
- Health, error logs and dependency status show verified values or explicit unknown states.
- Diagnostic export works where supported.

### FE-010 Build quality — P0
- TypeScript has no avoidable `any` leakage in core data types.
- No console errors on normal navigation.
- No dead controls or placeholder routes.
- Production build succeeds; lint/type checks pass if configured.
- Core interactions have tests; layout is manually checked at target viewport sizes.

## 11. Proposed implementation phases

### Phase A — scaffold and design system
1. Inspect AI Studio's generated project and preserve its supported setup.
2. Define tokens, typography, app shell, route structure and reusable primitives.
3. Implement mode banner, status chips, buttons, cards, dialogs, table, chart containers, skeletons and empty/error states.
4. Add responsive and reduced-motion behavior.

### Phase B — demo-first complete experience
1. Build deterministic `DemoDataProvider` and scenario controller.
2. Implement Overview and topology first.
3. Implement Traffic, Capacity, Intents/Policy, Experiments, Model Insights and Diagnostics.
4. Ensure every interaction has visible feedback and the demo tells a coherent, repeatable story.

### Phase C — backend integration
1. Agree the API schema with backend implementation.
2. Add typed API client and health checks.
3. Implement Live mode only for endpoints that exist and are tested.
4. Add reconnect/backoff, cancellation, stale-data indicators and clear failures.
5. Verify that no simulated values leak into Live mode.

### Phase D — polish and validation
1. Test all pages, breakpoints, keyboard paths and reduced-motion mode.
2. Audit performance and chart update frequency.
3. Check the demo story: capacity drop → latency/congestion response → policy decision → measured outcome.
4. Export a screenshot set and a short demo walkthrough.

## 12. Demo scenario script

A repeatable judge-facing scenario should tell a causal story without fabricating live measurements:
1. Start with stable WAN capacity and a mixed traffic population.
2. Start a latency-sensitive video-call or gaming flow.
3. Introduce a large background download.
4. Reduce available WAN capacity.
5. Show queue delay/latency rising in the baseline scenario.
6. Apply or replay the adaptive policy decision.
7. Show how per-class throughput, latency, loss and fairness change.
8. Compare the same seeded scenario against static QoS and a standard queue-management baseline.
9. Display exact run configuration and metrics, and make clear whether the values are simulated or measured in Mininet/testbed experiments.

A demo animation alone is not evidence of performance. Results must ultimately come from a reproducible experiment pipeline.

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| AI Studio builds a visually attractive but nonfunctional mockup | Require every control to work, include test checklist, and prohibit dead buttons |
| Fake metrics are mistaken for real measurements | Persistent mode label, per-chart provenance, explicit Live failure states |
| Too much animation harms clarity/performance | Restrained Motion, reduced-motion support, pause controls, no 3D by default |
| Frontend assumes APIs that backend lacks | Typed adapter, explicit API contract, disabled controls until confirmed |
| UI overstates model capabilities | Distinguish offline evaluation, simulated scenarios and actual live telemetry |
| Dependency sprawl | One charting library, one motion library, one icon set, no redundant component systems |
| Network controls are unsafe | Backend authorization, validation, confirmation, audit events and rollback |

## 14. Definition of done

The frontend is not done when the first screen looks attractive. It is done when:
- all required pages are implemented and navigable;
- Demo mode is deterministic, coherent and clearly labelled;
- Live mode reflects only confirmed backend data;
- no control lies about performing an operation;
- loading, empty, disconnected, invalid and error states are designed;
- core actions are tested;
- accessibility and reduced-motion behaviors work;
- the app builds cleanly and can be exported from AI Studio;
- a judge can understand the system and its limitations in a short guided demo.

## 15. Research and implementation references

The following are tool documentation, not evidence that the project already uses these tools. Verify compatibility and current installation instructions before adding dependencies.

- Google AI Studio Build mode: https://ai.google.dev/gemini-api/docs/aistudio-build-mode — supports building React-based web apps, npm packages, code inspection and export; prompt in stages and inspect the generated code.
- Gemini prompting strategies: https://ai.google.dev/gemini-api/docs/prompting-strategies — recommends precise instructions, consistent structure, explicit parameters and examples.
- React Bits: https://reactbits.dev/ and https://github.com/DavidHDev/react-bits — customizable animated React components; choose selectively and review dependency/accessibility implications.
- Motion for React: https://motion.dev/docs/react — declarative state, gesture and layout animations; use for purposeful transitions.
- v0 prompting guide: https://v0.app/docs/text-prompting — recommends specificity, breaking complex builds into increments, technical details, UI/UX preferences and error handling.
- Recharts: https://recharts.org/ — candidate for standard React charts; compare with the package already scaffolded before adding it.
- Lucide: https://lucide.dev/ — candidate consistent icon set.
- WCAG 2.2: https://www.w3.org/TR/WCAG22/ — accessibility reference.

## 16. Open questions to settle with the backend

- What exact API routes and schemas exist or will be implemented?
- Which metrics are truly collected, at what sampling interval and with what units?
- What does a flow record expose without sensitive payload data?
- Which traffic classes and label mappings are authoritative?
- How will capacity be estimated, and how will uncertainty be represented?
- Which queue disciplines and enforcement operations are supported in the test environment?
- Can the backend create, preview, apply and revert policy changes safely?
- Which experiment artifacts are exportable and how are seeds/configuration versions recorded?
- What is the authentication/authorization model for any live network controls?

Until these are answered, the frontend should remain useful in clearly labelled Demo mode and avoid presenting speculative functionality as complete.
