# IntentQoS — Adaptive Network QoS Console

**Adaptive QoS for mixed home broadband traffic · Built on Nano-Stream research**

IntentQoS is a research-prototype web application and operator console that demonstrates early-flow traffic classification, WAN bottleneck capacity estimation, intent-aware Hierarchical Token Bucket (HTB) shaping, and fairness-aware evaluation for mixed residential broadband traffic (video calls, gaming, interactive browsing, 4K streaming, bulk downloads, and background cloud backups).

## Theme System (L5 Light + D1 Dark)

IntentQoS implements two complete, centrally tokenized themes defined in `src/index.css` and `src/context/ThemeContext.tsx`:

1. **L5 Light — White, Black & Signal Orange** (`data-theme="light"`):
   - Structural surfaces: `#FFFFFF` main background, `#F2F3F4` secondary background, `#171717` primary text, `#DCDDDF` / `#B8BCC1` borders.
   - Brand accent: `#F26A21` signal orange with `#171717` high-contrast text on accent.
   - Chart series: `#F26A21`, `#3F566B`, `#198754`, `#7558A6`, `#B98721`.

2. **D1 Dark — Obsidian & Platinum** (`data-theme="dark"`):
   - Structural surfaces: `#0B0B0D` main background, `#111114` secondary background, `#17171B` card surface, `#202025` raised surface, `#F5F5F7` primary text, `#303036` / `#484850` borders.
   - Brand accent: `#D4D4D8` platinum with `#17171B` text on accent.
   - Chart series: `#E4E4E7`, `#A1A1AA`, `#7BCFA4`, `#B6A2E6`, `#E3BE76`.

### Theme Persistence & Initial Theme Resolution
- A visible, keyboard-accessible theme toggle (`src/components/ThemeToggle.tsx`) is available in both the Landing Page header and the Operator Console top bar (as well as in **Settings & Diagnostics**).
- User selection is persisted in `localStorage` under `intentqos-theme` (`light` or `dark`).
- On first visit (when no `intentqos-theme` key is stored), `index.html` and `ThemeProvider` check `prefers-color-scheme: dark` and default to **L5 Light** (`light`) when no dark preference is set.
- Switching themes updates all pages, Recharts visualizations, 2D SVG topology, 2.5D hero sculpture, tables, forms, and modals immediately without resetting scenario playback, filters, or DEMO/LIVE mode.

## Public Landing Page & Seven-Page Operator Console

1. **Public Landing Page (`src/pages/LandingPage.tsx`)**:
   - Introduces the household bottleneck problem, 5-stage architecture, 4 capability pillars, interactive simulated console preview, and direct link to the published IEEE Nano-Stream paper (`https://ieeexplore.ieee.org/abstract/document/11504604/`).
   - Includes a lazy-loaded 2.5D network sculpture (`src/components/NetworkHeroScene.tsx`) with an **Adaptive Lanes** vs. **Unshaped Bottleneck** mode switcher, `prefers-reduced-motion` compliance, and tab-visibility pause safeguards.
   - Centralizes repository and publication links in `src/config/projectLinks.ts` (`sourceRepoUrl: null` renders an explicit disabled `"Source code link coming soon"` badge until a real repository URL is supplied).

2. **Operator Console (`src/App.tsx` + `src/pages/*`)**:
   - **Task-Manager-Inspired Navigation Rail**: Desktop navigation starts as a narrow `64px` (`w-16`) icon-first rail persisted in `localStorage` under `intentqos-sidebar-collapsed`, featuring accessible hover and keyboard-focus tooltips, an active accent bar, and an expand/collapse button (`240px` expanded). On mobile viewports, navigation opens in an accessible slide-over drawer.
   - **Overview**: Compact 8-step guided scenario bar, primary real-time bottleneck & latency area chart paired with a compact 2×3 Task-Manager-style KPI readout strip (with `?` explain buttons), 7-class bandwidth share breakdown, interactive 2D SVG network topology (`src/components/NetworkTopology2D.tsx`), and controller audit feed.
   - **Live Traffic**: Searchable, multi-filterable early-flow table with explicit `Unknown` / `<0.65` confidence fallback rows and an interactive flow inspector drawer.
   - **Capacity & Congestion**: Distinct cards and charts separating Estimated WAN Capacity, Configured Shaping Ceiling (95% headroom), Observed Egress Load, and Queue Delay.
   - **Intents & Policy**: Temporary session intent creator with validation, before-apply policy preview, confirmation modals, 7-class HTB policy table, and Jain’s Fairness Index (`(Σxᵢ)² / (n·Σxᵢ²)`).
   - **Experiments & Benchmarks**: Side-by-side comparison across 5 simulated baselines (`NO_SHAPING`, `STATIC_QOS`, `FQ_CODEL_SIM`, `DETERMINISTIC_ADAPTIVE`, `INTENT_QOS_PROPOSED`) with CSV and JSON export.
   - **Model Insights**: Offline holdout evaluation metrics, INT8 vs. FP32 quantization footprint, per-class Precision/Recall/F1 table, and 7×7 confusion matrix.
   - **Settings & Diagnostics**: Telemetry mode switcher (`DEMO / REPLAY` vs. `LIVE`), `/api/health` endpoint probe, L5/D1 theme selector, reduced-motion toggle, and sanitized JSON diagnostics export.

## Help Center, Glossary, Highlight-to-Explain & Server-Side Gemini Assistant

1. **Curated Local Glossary & Page Guides (`src/help/glossary.ts` & `src/components/HelpCenterDrawer.tsx`)**:
   - Contains 26+ project-grounded glossary entries across 7 categories with alias search (e.g., `"p99"`, `"tail latency"`, `"Jain's fairness"`, `"first 32 packets"`, `"Unknown"`, `"HTB"`), provenance badges (`curated-glossary` vs. `project-code-docs`), and implementation status tags (`implemented`, `demo-only`, `planned`).
   - Includes structured **Explain this page** guides for all 7 operational pages.
   - Open anytime via the top header buttons (`Explain page`, `Glossary`, `Ask AI`) or keyboard shortcuts `/` and `Ctrl/Cmd+K` (guarded against firing inside inputs, textareas, selects, or open modals).

2. **Highlight-to-Explain Contextual Selection Toolbar (`src/components/SelectionExplainToolbar.tsx`)**:
   - Selecting any text (2–500 characters) inside `<main data-selection-root="true">` displays a compact floating toolbar with **Explain**, **Ask AI**, and **Copy** actions (also accessible via keyboard shortcut `Ctrl/Cmd+Shift+E` or right-clicking already-selected text).
   - **Explain** checks the curated local glossary first for an instant definition, with a 1-click option to ask Gemini for deeper context.
   - Highlighted text is **never** sent to Gemini automatically; it is only sent when the user explicitly clicks **Ask AI** or submits a question in the Gemini Assistant tab.

3. **Server-Side Gemini Proxy (`server.ts`)**:
   - Runs Express + Vite on port 3000 (`npm run dev` / `npm start`) and exposes `GET /api/help/status` and `POST /api/help/chat`.
   - Uses the official `@google/genai` SDK (`GoogleGenAI`) on the server, reading `process.env.GEMINI_API_KEY` and `process.env.GEMINI_MODEL` (defaults to `gemini-3.8-flash`). The API key is never exposed to client-side code or `VITE_*` variables.
   - Enforces payload validation (800-char question cap, 500-char selection cap, 16 KB body limit) and per-IP rate limiting (20 requests per 5 minutes).
   - If `GEMINI_API_KEY` is not configured, `/api/help/chat` transparently returns a curated local glossary fallback (`fallbackUsed: true`) with setup instructions.
   - **Privacy Note**: Free-tier Gemini API usage may be logged/reviewed by Google in accordance with Google AI Studio terms; do not paste secrets or personal data into assistant queries.

## Verification Commands

```bash
npx --yes tsx --test src/services/demoEngine.test.ts
npm run lint
npm run build
```

