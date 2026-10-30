# IntentQoS Frontend Audit & Visual Redesign Plan
**Based on:** `intentqos-—-adaptive-network-qos-console.zip`  
**Date:** 30 October 2026  
**Purpose:** Specify a high-quality landing-page addition and a thoughtful visual polish pass without damaging the existing dashboard or misrepresenting simulated functionality.

---

## 1. Executive recommendation

Keep the existing seven-page QoS console and add a separate, scroll-driven public landing page before it. Use the landing page to tell the project story; keep the dashboard focused on monitoring, experiments and operator workflows.

Recommended direction:
- **Visual identity:** “precision engineering with a little cinematic depth” rather than a generic neon cyberpunk template.
- **Palette:** near-black ink, deep blue/graphite surfaces, cool off-white text, electric cyan/blue as primary accents, mint for verified healthy states, amber for caution, and red/coral for errors. Use violet only as a secondary accent.
- **Typography:** use one expressive but highly legible display family (e.g. Sora or Plus Jakarta Sans), a neutral UI family (e.g. Inter or DM Sans), and JetBrains Mono only for technical values, IDs, timestamps and logs. Avoid using monospace for ordinary paragraph text.
- **Motion:** one distinctive 3D hero visual, restrained scroll-linked storytelling, quick interaction feedback and carefully tuned page transitions. Do not animate every card or delay reading.
- **Architecture:** keep React + TypeScript + Vite, Tailwind CSS v4, Recharts, Lucide and the existing `motion/react` dependency. Lazy-load the 3D scene and provide a non-WebGL fallback.
- **Truthfulness:** label demo data clearly; never present simulated metrics, classifier performance or policy effects as live measurements.

The goal is not maximum animation. It is an immediately understandable story, a memorable hero, excellent typography and responsive interactions that remain fast.

## 2. What I inspected in the ZIP

The archive contains 51 entries and approximately 6,682 lines across its TypeScript/TSX, CSS, HTML and JSON source/configuration files. The core source includes:
- `src/App.tsx`
- `src/index.css`, `index.html`, `src/main.tsx`, `vite.config.ts`
- `src/types/qos.ts`
- `src/services/demoEngine.ts`, `src/services/dataProvider.ts`, `src/services/demoEngine.test.ts`
- `src/components/SpotlightCard.tsx`, `LiveDisconnectedPanel.tsx`, `NetworkTopology2D.tsx`, `ScenarioControlBar.tsx`
- seven page components under `src/pages/`
- `package.json`, `tsconfig.json`, README and the bundled design specification.

This is a source review and design audit, not a claim that a fresh production build or browser-based visual regression suite has passed in this environment.

### Existing architecture and behavior

- React 19 + TypeScript + Vite; Tailwind CSS v4 plugin.
- Existing dependencies include `motion`, `recharts`, `lucide-react`, and React.
- `App.tsx` is a single-shell SPA with page state, a persistent sidebar, top bar, demo/live selector, mobile navigation drawer and seven page IDs.
- Pages: Overview, Live Traffic, Capacity & Congestion, Intents & Policy, Experiments & Benchmarks, Model Insights, Settings & Diagnostics.
- `demoEngine.ts` is the deterministic demo/simulation source. It contains scenario definitions, generated metric series, generated flows/events, initial policies/intents, demo model evaluation data, reference experiment runs and export helpers.
- `dataProvider.ts` contains demo health states and a live `/health` probe. The UI deliberately withholds live telemetry if a verified backend is not connected.
- `qos.ts` defines typed data models and provenance values such as `SIMULATED_DEMO` and `MEASURED_LIVE`.
- `NetworkTopology2D.tsx` is already an interactive SVG network topology. It should remain the truthful, fast 2D topology inside the operator dashboard even if the landing page gets a separate 3D hero.
- `SpotlightCard.tsx` provides a React Bits-inspired cursor-following cyan radial highlight.
- `ScenarioControlBar.tsx` has deterministic scenario selection, playback, step-forward, reset, speed controls and a guided story progress bar.
- The README documents npm scripts for dev, build and a deterministic test suite.

### Current visual system

`src/index.css` already defines a dark palette:
- app background `#080D18`
- shell `#0D1423`
- card `#111B2D`
- elevated surface `#162238`
- primary text `#F3F7FF`
- secondary text `#9AAAC2`
- muted text `#6F809A`
- cyan `#55D6FF`
- blue `#648BFF`
- violet `#A78BFA`
- success `#4ADEA3`
- warning `#F5C66A`
- error `#FF6B7A`

`index.html` currently loads DM Sans, Plus Jakarta Sans and JetBrains Mono from Google Fonts. Therefore, the website does **not** need a random complete rebrand just because the user wants new colors and fonts. The better move is to refine the existing identity, improve hierarchy and typography roles, and apply a consistent token system across hard-coded colors.

### What is already good and should be preserved

1. The strict separation between demo/replay and live mode.
2. The visible simulation provenance labels.
3. The honest disconnected-live state and refusal to silently substitute demo data in live mode.
4. Typed QoS domain models and the existing `dataProvider` boundary.
5. Deterministic scenario controls and test coverage for important demo-engine behaviors.
6. Existing useful dashboard features: search/filter/sort in traffic; flow detail drawer; capacity scenarios; intent validation and confirmation; benchmark export; model metrics/confusion matrix; diagnostics logs/export; reduced-motion setting; interactive SVG topology.
7. The current `SpotlightCard` as a reusable visual affordance, but only where the highlight is subtle and does not reduce text contrast.

Do not rewrite these features simply to achieve visual change.

## 3. Findings from source review that affect the redesign

### 3.1 No public landing page exists in the application structure

`PageId` in `src/types/qos.ts` contains only the seven console pages. `App.tsx` starts at `overview` and renders the dashboard shell immediately. There is no separate public project narrative, hero, source/research section or landing-to-console transition.

**Change:** introduce a landing-page state/route separate from the operator shell. The landing page must not look like an eighth operator page inside the sidebar.

### 3.2 The app already uses Motion, but animation is not a unified design system

`App.tsx` imports `AnimatePresence` and `motion` from `motion/react`. The app also has a reduced-motion state in `App.tsx` and a toggle in Settings & Diagnostics. Individual pages receive `reducedMotion`, and the topology uses it to disable flow motion. However, the visual system is primarily built from many literal Tailwind color classes and component-specific transitions.

**Change:** create shared design tokens and a small motion system (durations, easing, distance, stagger rules, reduced-motion behavior). Keep motion consistent and purposeful. Do not add another animation library without a demonstrated need.

### 3.3 The current fonts are functional but can have clearer roles

The existing DM Sans + Plus Jakarta Sans + JetBrains Mono setup is reasonable. The issue is consistency and scale rather than a fundamental failure of the font choices.

**Change:** choose either:
- Option A (lowest risk): keep DM Sans for body/UI, Plus Jakarta Sans for headings, JetBrains Mono for technical data; improve weights, sizes, line lengths and spacing.
- Option B (fresh identity): use Sora for display/headings, Inter for UI/body, JetBrains Mono for technical data, but ensure fonts load efficiently and provide system fallbacks.

Do not load multiple overlapping font families and many unused weights. If external font loading is slow or blocked, the page must still look good with fallbacks.

### 3.4 Hard-coded colors are widespread

The root CSS variables are a useful start, but most TSX pages use literal utility colors (e.g. `bg-[#111B2D]`, `text-[#55D6FF]`). This makes a consistent rebrand expensive and increases the chance of inconsistent shades.

**Change:** migrate the recurring palette to semantic tokens/utilities where practical: `background`, `surface`, `surface-elevated`, `text-primary`, `text-secondary`, `border-subtle`, `accent`, `success`, `warning`, `danger`, and their hover/focus variants. Avoid a risky giant rewrite; migrate shared primitives and visible high-value sections first.

### 3.5 The 2D topology already exists and should not be replaced by 3D

`NetworkTopology2D.tsx` is a substantial SVG component with selectable WAN, gateway, switch and host nodes, metrics, node details and simulated traffic-flow animation.

**Change:** use a separate 3D-inspired network sculpture/flow field only in the landing hero. Keep the dashboard topology as the simpler 2D operator visualization; this keeps it legible, selectable, easier to inspect and cheaper to render.

### 3.6 Live/demo distinction is a defining product feature

`dataProvider.ts` performs a health check and creates explicit disconnected states. `App.tsx` withholds telemetry in LIVE mode when the backend is unverified. The types encode provenance for metrics, flows, capacity, policies, intents and events.

**Change:** repeat provenance in the landing-page demo preview and any animated mock dashboard. Never use an attractive landing-page animation to imply live packets, live model predictions or real enforcement. If the preview is illustrative, label it “Illustrative demo preview — simulated data”.

### 3.7 Demo mode auto-advances

`App.tsx` starts in DEMO mode with `isPlaying=true` and advances the deterministic simulation using an interval. This is useful for a presentation but can make the dashboard feel busy to someone trying to read it.

**Change:** do not break the existing scenario engine. Consider starting the demo paused or offering a clear pause control, and make sure the new landing-page animation does not auto-scroll or hijack the user’s scroll.

### 3.8 Accessibility is partly present; ensure the redesign extends it

The app has some semantic labels, accessible button names, a reduced-motion toggle and system reduced-motion detection. The new landing page needs the same care. Dialog focus management and keyboard behavior should be tested rather than assumed.

**Change:** respect `prefers-reduced-motion`, provide an in-app motion control, keep focus indicators visible, support keyboard navigation, avoid color-only status communication, maintain text contrast, use real buttons/links, and provide accessible labels for canvas/3D content.

### 3.9 Source/research links need to be real and configurable

The existing archive does not establish a public source-code repository URL. The paper can be linked to the known IEEE Xplore record: `https://ieeexplore.ieee.org/abstract/document/11504604/`.

**Change:** put outbound links in a central config. Use the IEEE Xplore link for the paper. For source code, use the real public repository URL only when the owner provides it. If unavailable, show a disabled “Source code link coming soon” or omit the link; never invent a GitHub URL.

### 3.10 The frontend is a dashboard, not a complete live network controller

The README and `dataProvider.ts` explicitly describe some features as demo-implemented and require backend endpoints for live operation. The landing page must describe the current project accurately and not imply that the new landing animation represents production networking behavior.

## 4. Proposed landing page experience

### Navigation
- Top-left IntentQoS wordmark plus small “Built on Nano-Stream research” label.
- Navigation anchors: How it works, Capabilities, Research, Demo.
- Right-side CTA: “Open console”.
- Header starts transparent over the hero, then becomes a compact translucent/solid header after scrolling. Keep contrast readable over all content.

### Hero
- Left column: eyebrow “ADAPTIVE QOS FOR MIXED HOME BROADBAND”, large headline such as **“Keep every connection in its lane.”**, concise supporting copy explaining that IntentQoS explores adaptive traffic classification and intent-aware QoS for competing home-network traffic.
- Primary CTA: “Explore the console” (opens the existing Overview/dashboard).
- Secondary CTA: “Read the research” (opens IEEE Xplore in a new tab with safe link attributes).
- Small trust line: “Research prototype · Deterministic demo available · Live backend integration is separate”.
- Right side: a restrained 3D network sculpture: a central gateway/switch node, several home-device nodes, curved connection paths and moving packets that represent competing traffic classes. It should suggest congestion and coordinated flow without presenting actual telemetry.
- Use soft lighting, depth, wireframe/grid detail, a few packet particles, slow rotation or pointer parallax. Avoid excessive neon, giant bloom, spinning text or distracting mouse trails.
- Add an obvious “Scroll to explore” cue and a thin page-progress indicator if useful.
- Do not block the hero waiting for WebGL. Text and CTA must appear immediately.

### Scroll narrative
Build a short, curated story—not an endless marketing page.

1. **The problem:** video calls, games, streaming and downloads compete for a limited WAN link. Use a tasteful visual showing the competing flows converging at a bottleneck.
2. **The system loop:** show a clear four/five-step animated diagram:
   - Observe flow metadata (no payload inspection claims)
   - Classify early flow traffic (research foundation; describe as a prototype)
   - Estimate available capacity (proposed/under-development unless verified)
   - Apply bounded intent-aware policy (proposed/under-development unless verified)
   - Measure outcomes and compare baselines
   Use “current demo”, “research foundation”, and “planned/under development” labels honestly.
3. **Why it is different:** highlight the project’s design goals: resource-efficient classification, explicit unknown/low-confidence handling, capacity-aware adaptation, temporary user intent, fairness and reproducible evaluation. Do not claim every item is fully implemented in live networking.
4. **Explore the console:** an attractive but clearly labelled simulated preview of Overview, Traffic, Capacity and Experiments. CTA opens the real console.
5. **Research and resources:** link the IEEE paper; source repository only if a real URL is supplied; optionally link to a technical architecture section or README if the application can host it.
6. **Footer:** concise project identity, research link, source-code link if available, “Demo data is simulated” note, and “Return to top”.

### Landing-page motion choreography
- Hero: one elegant 3D scene with a slow continuous idle motion; pause/stop motion on reduced-motion setting or if the page is hidden.
- Scroll-linked motion: use `useScroll`/`useTransform` from `motion/react` only for one or two meaningful moments (e.g. network paths connect as the system loop enters view). Keep scroll movement subtle and reversible.
- Section reveal: opacity + small vertical translation, once per section. Content must never disappear again when the user scrolls back up.
- Use sticky storytelling only if it remains easy to scroll and does not trap wheel/touch input.
- Avoid scroll-jacking, forced horizontal scroll, cursor hijacking, scroll-locked pages, auto-playing full-screen video and long intro/loading screens.
- Use CSS `transform` and `opacity` for most movement; avoid animating layout-heavy properties on every frame.

## 5. Proposed design tokens

Use this as a starting point; validate contrast and make adjustments after rendering.

### Color
- `--bg-app`: `#070B12` (near-black ink)
- `--bg-shell`: `#0B1220` (deep navy)
- `--bg-card`: `#101A2B` (raised surface)
- `--bg-elevated`: `#16243A`
- `--text-primary`: `#F4F7FB`
- `--text-secondary`: `#A7B4C8`
- `--text-muted`: `#77869D` (do not use for small low-contrast text)
- `--border-subtle`: `rgba(173, 191, 216, 0.15)`
- `--accent-primary`: `#63D9FF`
- `--accent-secondary`: `#7896FF`
- `--accent-mint`: `#66E3B4`
- `--accent-violet`: `#B49AFF` (sparingly)
- `--status-success`: `#66E3B4`
- `--status-warning`: `#FFD27A`
- `--status-danger`: `#FF7D8A`

Do not change only CSS variables while leaving hundreds of hard-coded colors untouched. Convert reusable primitives and shared page elements to semantic tokens in a controlled pass. Statuses must also include text/icons, not color alone.

### Typography
- Display: Sora or existing Plus Jakarta Sans.
- Body/UI: Inter or existing DM Sans.
- Technical: JetBrains Mono, used sparingly for numbers/IDs/diagnostics.
- Use a defined scale (e.g. 12/14/16/18/24/32/48/64 px, adjusted responsively), consistent line heights, and short line lengths for prose.
- Avoid all-caps for long sentences. Reserve it for tiny labels/badges.
- Prefer sentence case for primary UI controls and descriptive headings.

### Surfaces and details
- Use 1px subtle borders, modest corner radii (8–16px), layered surfaces and controlled shadows.
- Use glass/blur only in the landing header or a few overlay elements; avoid making every dashboard card translucent.
- Add a consistent hover/focus/pressed/disabled state to buttons, links, tabs, table rows, nav items and cards.
- Use small icon motion only when it communicates action; no emoji as interface icons.
- Prefer a consistent spacing scale and align cards to a clear grid.
- Keep technical data compact but readable; avoid 10–11px body text for important values.

## 6. “Human” UI polish checklist

These are practical, testable improvements—not a claim that one particular style is objectively more human.

### Feedback and interaction
- Button hover: slight color/contrast lift; no large scaling.
- Button press: subtle 0.98-scale/translate feedback where appropriate; never delay action completion.
- Links: clear hover and keyboard focus styles; external links show a small external-link icon.
- Cards: subtle border/accent change on hover only when interactive; static cards should not pretend to be clickable.
- Inputs: visible focus ring, clear labels, helper text, validation message and disabled state.
- Dialogs: sensible entry/exit transition, escape-to-close when safe, focus management, clear cancel/confirm actions.
- Toasts/status: concise feedback after actions such as exporting CSV, applying a demo intent, switching modes or copying a value. Use `aria-live` for relevant non-blocking status updates.
- Tables: row hover, keyboard-accessible sort headers, obvious selected row, helpful empty state, reset-filters action.
- Loading: skeletons only for actual loading; do not add fake loaders to a fast local demo.
- Errors: explain what happened and what to do next; preserve the user’s form/input when possible.
- Motion: interactions should feel responsive, generally around 120–240 ms for micro-interactions, with longer durations reserved for the hero/story scene.
- Do not add sounds, forced cursor effects, fake notifications, fake uptime, fake live badges or fabricated “AI is thinking” indicators.

### Content and visual hierarchy
- Use clear page titles and short one-sentence descriptions.
- Give each page one primary task/visual anchor.
- Reduce dense repeated labels where a chart/table can explain the same thing.
- Use progressive disclosure for secondary technical details.
- Add tooltips for specialized terms (p95, Jain’s fairness index, confidence gating, capacity estimate), but make essential meanings visible without hover.
- Keep chart axes, units, legends and provenance clear.
- Use consistent empty/error states and not a different style on every page.
- Add tiny “What am I looking at?” explanations to complex benchmark/model charts.
- Use precise, human copy. Avoid generic marketing claims like “revolutionary AI” or “world-class intelligence.”

### Accessibility and performance
- Honor system and in-app reduced-motion preferences.
- Provide a static SVG/HTML fallback for 3D, including on mobile and WebGL failure.
- Lazy-load the 3D scene after first paint; use dynamic import; avoid a heavy full-screen canvas on lower-end devices.
- Pause decorative animation when the tab is hidden.
- Use `prefers-reduced-motion`; do not force smooth-scroll behavior or hijack native scroll.
- Maintain strong text contrast and visible keyboard focus.
- Ensure all functionality works by keyboard, including the landing nav and console CTA.
- Use semantic headings/landmarks, meaningful link text and appropriate `aria-label`s.
- Respect touch targets (aim for 44×44 CSS px on important controls).
- Test narrow widths (320–375px), tablet and desktop.
- Reserve dimensions for the hero scene so it does not cause layout shift.
- Avoid animating `width`, `height`, `top`, `left`, margins or large shadows continuously. Prefer transform/opacity where appropriate.
- Keep chart and dashboard transitions restrained; dashboard readability outranks motion spectacle.

## 7. Technical implementation guidance

### Preserve current stack
- React + TypeScript + Vite.
- Tailwind CSS v4.
- `motion/react` (already installed).
- Recharts (already installed).
- Lucide icons (already installed).

### 3D implementation options
Preferred order:
1. If a reliable, lightweight 3D implementation can be achieved with existing dependencies, use it.
2. Otherwise, add `three` + `@react-three/fiber` + `@react-three/drei` only if the environment supports installing them and the added bundle cost is justified.
3. Always lazy-load the scene and implement a static SVG/CSS fallback.
4. Do not use a large externally hosted 3D asset or require API keys.
5. Do not make the hero depend on WebGL to reveal the heading or CTA.

The 3D scene should be a purpose-built network metaphor, not a random rotating sphere. Use simple geometry: a central gateway/switch, device nodes, curved paths, sparse moving packets, subtle depth and lighting. If performance or AI Studio constraints make 3D fragile, a 2.5D SVG/CSS composition is preferable to a broken canvas.

### App structure
- Keep the existing dashboard pages and existing app state flow intact.
- Introduce a separate `LandingPage` component and a clear entry/return path.
- Prefer a minimal routing approach consistent with the current app. If using URL routing, support direct refresh/deep links and browser back/forward. If keeping state-based navigation, add an explicit route/state for landing and ensure the console CTA reliably opens Overview.
- Avoid a complete rewrite of `App.tsx`.
- Put external URLs in one configuration object.
- Use a single shared design token system and reusable primitives.
- Keep 3D scene code separate from dashboard components.
- Reuse the existing `NetworkTopology2D` in the dashboard.
- Do not introduce backend/API changes for a frontend-only task.

### Research/source links
- Paper: `https://ieeexplore.ieee.org/abstract/document/11504604/`
- Source repository: unknown from this archive. Ask for the real URL or leave it clearly unavailable; never fabricate it.

## 8. Implementation order

### Phase 0 — Safety and baseline
1. Inspect the existing project structure and read the relevant files before edits.
2. Identify how `App.tsx` selects pages and preserves demo/live provenance.
3. Preserve current seven pages, demo engine, tests and API behavior.
4. Record current build/test status before making changes.

### Phase 1 — Shared visual system
1. Define semantic color and typography tokens.
2. Create/reuse button, link, badge, section-heading and card styles.
3. Standardize hover, focus, pressed, disabled, selected, success, warning and error states.
4. Keep changes incremental and verify no contrast regressions.

### Phase 2 — Landing page
1. Add `LandingPage.tsx` and a separate hero scene component.
2. Build responsive header, hero copy and CTA.
3. Add lazy-loaded 3D/2.5D network scene with fallback.
4. Add problem, system-loop, differentiation, demo-preview, research/resources and footer sections.
5. Add restrained scroll storytelling.
6. Make “Explore the console” open the existing Overview page.
7. Use the correct IEEE paper link; no invented source URL.

### Phase 3 — Dashboard polish
1. Apply semantic tokens to the sidebar/header and shared cards.
2. Improve typography scale and line lengths.
3. Standardize interactive states and focus rings.
4. Add helpful tooltips/short explanations for specialized metrics.
5. Improve status/toast feedback only where actual actions exist.
6. Check responsive behavior of the topology, tables, dialogs and charts.
7. Preserve simulation provenance and strict LIVE behavior.

### Phase 4 — QA
- `npm run build`
- `npm run lint`
- `npx --yes tsx --test src/services/demoEngine.test.ts`
- Inspect every page in the browser.
- Test landing-to-console and console-to-landing navigation.
- Test source/research links.
- Test mobile and desktop breakpoints.
- Test keyboard-only navigation and visible focus.
- Test OS reduced motion and the in-app toggle.
- Test WebGL unavailable/failure fallback.
- Confirm there is no forced scrolling, scroll trap or content that appears and disappears before it can be read.
- Confirm all demo metrics remain labelled as simulated.
- Report which checks actually ran and any unresolved issues.

## 9. Acceptance criteria

The change is complete only if:
1. A real landing page appears before the console, with a working “Explore the console” CTA.
2. The landing page contains a distinctive but restrained 3D/2.5D network visual and still works without WebGL.
3. Scrolling tells the project story in clear sections and never hijacks native scroll.
4. Research link opens the correct IEEE Xplore record.
5. Source-code link is only active when the real URL is known.
6. The seven existing dashboard pages still work.
7. Existing deterministic demo controls, export features, policy/intents interactions, topology and diagnostics remain functional.
8. LIVE mode still withholds synthetic telemetry when backend verification fails.
9. All visible interactive elements have clear hover, focus, pressed, disabled and selected states where relevant.
10. Reduced-motion preferences are respected.
11. No significant new layout shift, console errors, TypeScript errors or build errors are introduced.
12. The app is tested at mobile, tablet and desktop widths.
13. No fabricated claims, fake live telemetry, fake model results or unverified research claims appear in the landing page.

## 10. Research notes and design rationale

### Official documentation
- React Bits offers customizable animated React components/backgrounds; select individual components rather than importing effects indiscriminately: https://reactbits.dev/ and https://github.com/DavidHDev/react-bits
- Motion for React supports scroll-triggered and scroll-linked animations through `whileInView`, `useScroll` and `useTransform`: https://motion.dev/docs/react-scroll-animations
- Motion recommends honoring reduced-motion preferences; its `useReducedMotion` hook and `MotionConfig` can adapt or disable transform-heavy effects: https://motion.dev/docs/react-accessibility
- MDN explains that unnecessary animation can degrade performance and recommends reducing animation, respecting `prefers-reduced-motion`, and choosing efficient animated properties: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS
- Web.dev explains why `transform` and `opacity` are generally safer animation choices for smooth performance: https://web.dev/articles/animations-overview
- W3C's guidance explains why non-essential interaction-triggered animation should be disableable: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions

### Community feedback reviewed
A current Reddit discussion on excessive scroll animations reports that sections appearing late, scroll-linked motion and animation-heavy pages can make a site feel slower and make content harder to read: https://www.reddit.com/r/webdesign/comments/1xf3rlf/scroll_animations_on_most_sites_make_them_feel/

A Reddit portfolio review highlights the same trade-off: impressive visual effects can be undermined by delayed text, excessive motion, slow loading, mobile jank, poor contrast and inaccessible navigation: https://www.reddit.com/r/webdev/comments/1f1ltsx

These are qualitative user opinions, not controlled usability studies. The implementation should use them as cautionary signals, not universal rules.

### Quora limitation
Quora search results could not be reliably retrieved during this research pass. No design recommendation in this document is attributed to Quora. The advice is instead grounded in the source code, official animation/accessibility documentation, performance guidance and accessible community feedback.

## 11. Final judgment

The highest-value improvement is **not** to turn every existing dashboard card into a glowing animated object. It is to add a strong project landing experience, refine the visual system, make interaction feedback consistent, and preserve the dashboard’s credibility.

The landing page should make the project memorable. The dashboard should make the project understandable. The evidence and experiments—not animation—must make the project credible.
