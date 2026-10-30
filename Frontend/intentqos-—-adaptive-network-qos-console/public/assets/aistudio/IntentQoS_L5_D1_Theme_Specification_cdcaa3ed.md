# IntentQoS Theme Specification — L5 Light + D1 Dark
**Decision:** Provide both Light and Dark themes with a visible theme toggle.  
**Light theme:** L5 — White, Black & Signal Orange.  
**Dark theme:** D1 — Obsidian & Platinum.  
**Scope:** Apply consistently to the new landing page and the existing seven-page dashboard without breaking current behavior.

## 1. Design intent

### Light theme: L5 — White, Black & Signal Orange
Use white, concrete-grey and black as the structural palette. Signal orange is the signature accent for primary actions, selected states and a small number of important visual highlights. The theme should feel precise, confident and engineering-oriented—not playful, warning-heavy or like a generic orange template.

### Dark theme: D1 — Obsidian & Platinum
Use near-black, graphite and charcoal surfaces with soft-white text and platinum/silver accents. It should feel restrained, expensive and legible. Do not replace the platinum accent with neon cyan or add purple/blue glows.

### Shared rules
- Keep the same layout, content hierarchy, spacing, typography, charts and interactions between themes.
- Only theme tokens and theme-sensitive visual treatments should change. Avoid two separately maintained component designs.
- Use semantic status colours consistently across both themes. Orange is the Light theme's brand accent, not the only warning/error indicator.
- Maintain adequate contrast for text, icons, borders, focus rings, charts and disabled states.
- Avoid excessive gradients, glow, blur and shadows. Use contrast, spacing and typography to make the UI feel premium.
- Keep motion restrained and honor reduced-motion preferences.

## 2. Color tokens

All colors should be defined centrally as CSS custom properties. Names are semantic and should be used by components instead of scattered hard-coded hex values.

### Light theme — L5
| Token | Hex / value | Intended use |
|---|---|---|
| `--color-bg` | `#FFFFFF` | Main page background |
| `--color-bg-subtle` | `#F2F3F4` | Alternate sections, app chrome |
| `--color-surface` | `#FFFFFF` | Cards, menus, dialogs |
| `--color-surface-raised` | `#FFFFFF` | Popovers and elevated surfaces; distinguish with border/shadow |
| `--color-surface-hover` | `#F7F7F8` | Hover state |
| `--color-text-primary` | `#171717` | Main text and headings |
| `--color-text-secondary` | `#62676D` | Descriptions and supporting text |
| `--color-text-muted` | `#747980` | Low-priority labels; not tiny critical copy |
| `--color-border` | `#DCDDDF` | Default borders and separators |
| `--color-border-strong` | `#B8BCC1` | Stronger dividers, input borders |
| `--color-accent` | `#F26A21` | Primary brand accent |
| `--color-accent-hover` | `#D95712` | Hover on orange actions |
| `--color-accent-pressed` | `#B9470C` | Pressed state |
| `--color-accent-soft` | `#FFF0E7` | Selected/soft orange backgrounds |
| `--color-on-accent` | `#171717` | Text/icons on orange; validate contrast, use dark text |
| `--color-focus` | `#B9470C` | Visible keyboard focus ring |
| `--color-success` | `#18794E` | Success status |
| `--color-success-soft` | `#E8F5EE` | Success background |
| `--color-warning` | `#8A4B08` | Warning text/icon |
| `--color-warning-soft` | `#FFF4D6` | Warning background |
| `--color-danger` | `#B42332` | Error/danger text/icon |
| `--color-danger-soft` | `#FDEBED` | Error background |
| `--color-info` | `#315C91` | Informational status |
| `--color-info-soft` | `#EAF2FB` | Information background |
| `--color-chart-1` | `#F26A21` | Brand/primary series |
| `--color-chart-2` | `#3F566B` | Secondary series |
| `--color-chart-3` | `#198754` | Third series |
| `--color-chart-4` | `#7558A6` | Fourth series |
| `--color-chart-5` | `#B98721` | Fifth series |
| `--color-overlay` | `rgba(16, 18, 20, 0.48)` | Modal/backdrop overlay |
| `--shadow-card` | `0 1px 2px rgba(17, 24, 39, 0.05), 0 8px 24px rgba(17, 24, 39, 0.04)` | Light card elevation |

### Dark theme — D1
| Token | Hex / value | Intended use |
|---|---|---|
| `--color-bg` | `#0B0B0D` | Main page background |
| `--color-bg-subtle` | `#111114` | Alternate sections, app chrome |
| `--color-surface` | `#17171B` | Cards and menus |
| `--color-surface-raised` | `#202025` | Popovers, dialogs, raised panels |
| `--color-surface-hover` | `#27272D` | Hover state |
| `--color-text-primary` | `#F5F5F7` | Main text and headings |
| `--color-text-secondary` | `#B0B0B8` | Descriptions and supporting text |
| `--color-text-muted` | `#92929C` | Low-priority labels; not tiny critical copy |
| `--color-border` | `#303036` | Default borders and separators |
| `--color-border-strong` | `#484850` | Stronger dividers and input borders |
| `--color-accent` | `#D4D4D8` | Platinum accent |
| `--color-accent-hover` | `#E4E4E7` | Hover on platinum actions |
| `--color-accent-pressed` | `#C4C4CC` | Pressed state |
| `--color-accent-soft` | `#29292F` | Selected/soft platinum background |
| `--color-on-accent` | `#17171B` | Text/icons on platinum buttons |
| `--color-focus` | `#E4E4E7` | Visible keyboard focus ring |
| `--color-success` | `#66D6A0` | Success status |
| `--color-success-soft` | `#14271E` | Success background |
| `--color-warning` | `#F0C36A` | Warning status |
| `--color-warning-soft` | `#302616` | Warning background |
| `--color-danger` | `#FF858D` | Error/danger status |
| `--color-danger-soft` | `#321A20` | Error background |
| `--color-info` | `#A9C6EE` | Informational status |
| `--color-info-soft` | `#182538` | Information background |
| `--color-chart-1` | `#E4E4E7` | Primary series |
| `--color-chart-2` | `#A1A1AA` | Secondary series |
| `--color-chart-3` | `#7BCFA4` | Third series |
| `--color-chart-4` | `#B6A2E6` | Fourth series |
| `--color-chart-5` | `#E3BE76` | Fifth series |
| `--color-overlay` | `rgba(0, 0, 0, 0.68)` | Modal/backdrop overlay |
| `--shadow-card` | `0 1px 2px rgba(0, 0, 0, 0.25), 0 12px 32px rgba(0, 0, 0, 0.18)` | Dark card elevation |

**Important:** The token values are starting design values, not proof of WCAG compliance. Check actual foreground/background combinations in the rendered UI and adjust where needed. Never use accent color as the sole indicator of a status.

## 3. Theme switching behavior

### Control
- Provide a visible, accessible theme toggle in the landing-page header and the dashboard top bar.
- Use a Sun icon for Light, Moon icon for Dark, or a compact two-option segmented control if it is clearer.
- Include a tooltip or accessible label such as “Switch to dark theme” / “Switch to light theme”.
- Use a real `<button>` with keyboard support and a visible focus indicator.
- Avoid a switch that resembles the DEMO/LIVE control; theme and connection mode must be visually distinct.

### State and persistence
- Use one shared theme state for the entire app, including landing page and dashboard.
- Persist explicit user choice in `localStorage` (for example, `intentqos-theme` with `light` or `dark`).
- On first visit, use `prefers-color-scheme` as the initial theme if there is no saved preference. If product implementation decides to force a default, document the choice; recommended default is Light because L5 is the selected light brand and the landing page should be immediately legible.
- Restore the user's saved choice on reload.
- Avoid a visible flash of the wrong theme on startup where practical; use a small pre-hydration theme script only if compatible with the existing app and safe in the environment.
- Theme selection must not reset current page, selected scenario, demo playback, filters, or form state.
- Do not store any sensitive information.

### Motion
- Theme transition can be a short 150–220 ms change in background, text, border and surface colors.
- Avoid animating every descendant individually if it creates flicker or expensive repaints.
- Respect reduced-motion preferences; use immediate changes or minimal transition if reduced motion is enabled.

## 4. Typography specification

Prefer a restrained, consistent role system. Avoid changing fonts solely to make the palette feel different.

Recommended:
- Display/headings: **Plus Jakarta Sans** (already available) or Sora if it can be loaded efficiently and consistently.
- Body/UI: **DM Sans** (already available) or Inter.
- Technical data: **JetBrains Mono**, only for IDs, timestamps, code, logs and selected numerical readouts.

Suggested scale:
- Hero headline: clamp around 2.8rem–5.5rem on desktop; responsive down to 2.2rem–3rem on mobile.
- Page title: 1.75–2.25rem.
- Section heading: 1.25–1.6rem.
- Card title: 1rem–1.125rem.
- Body: 0.9375–1rem.
- Supporting labels: 0.8125–0.875rem.
- Technical metadata: 0.75–0.8125rem only when non-critical.

Use clear line height, avoid long paragraphs across the full desktop width, and reserve uppercase text for short technical labels.

## 5. Component styling rules

### Landing page
- Light L5: clean white sections, occasional concrete-grey sections, black typography and signal-orange primary CTA. Use orange sparingly for paths/markers in the network hero. Do not make every section orange.
- Dark D1: obsidian/graphite sections, platinum CTA and typography, silver/grey network paths and restrained highlights. Avoid cyan/purple glow.
- Keep the same content structure and animation choreography across themes.
- 3D/2.5D network scene must work in both themes. Adjust materials/lighting for contrast; do not leave dark-mode dark geometry invisible in Light mode or white geometry invisible in Dark mode.
- Research link must target the real IEEE record. Do not invent a source repository URL.
- Clearly label illustrative/demo preview data as simulated.

### Dashboard
- Keep all seven existing pages and their interactions.
- Preserve the 2D SVG network topology in the dashboard.
- Preserve demo/live provenance and the disconnected-live behavior.
- Charts must use theme-aware text, gridlines, tooltips, axes, legends and series colours.
- Tables, dialogs, filters, menus, badges and inputs must use semantic tokens.
- Status colors remain semantically meaningful in both themes.
- Don't make static cards look clickable. Interactive elements should have a subtle hover state.

### Interaction states
Every interactive element should have a deliberate:
- default
- hover
- keyboard focus
- pressed
- selected/active
- disabled
- error/success state where applicable

Use subtle transitions, generally 120–220 ms. Maintain clear keyboard focus. Do not use color alone to show selected/error/success states.

## 6. Implementation requirements

1. Inspect existing files before editing, especially `src/App.tsx`, `src/index.css`, `index.html`, `src/types/qos.ts`, shared components and every page.
2. Preserve the current React + TypeScript + Vite architecture and existing dependencies where possible.
3. Use CSS variables and one root theme attribute, such as `data-theme="light"` / `data-theme="dark"` on `<html>` or the app root.
4. Refactor repeated hard-coded colours into semantic tokens incrementally. Do not do a destructive global replacement that breaks status colors, charts or component-specific states.
5. Make theme state global and shared; avoid separate independent theme states in landing and dashboard.
6. Use a clear theme provider/hook only if it improves the existing structure; do not add a state-management library for this small feature.
7. Make sure Tailwind classes or inline styles do not override semantic theme variables unexpectedly.
8. Ensure Recharts components update axis, grid, tooltip, legend and cursor colours when the theme changes.
9. Ensure SVG topology, status chips, charts, modal overlays, tooltips and all page-level backgrounds adapt correctly.
10. Test the entire app in both themes. Do not claim theme support based only on the landing page or top bar.

## 7. Acceptance criteria

- Both L5 Light and D1 Dark themes are complete and coherent.
- A visible theme toggle exists on the landing page and inside the dashboard.
- Switching themes updates every page, chart, dialog, tooltip, menu, form and topology.
- Theme choice persists after reload.
- Initial theme behavior is predictable and documented.
- Switching theme does not reset application state or alter demo/live mode.
- All seven dashboard pages remain functional.
- No existing data-flow, export, scenario, intent or diagnostics behavior is removed.
- Demo data remains labelled as simulated and LIVE mode continues to withhold synthetic telemetry if the backend is unverified.
- The landing-page 3D/2.5D visual is legible in both themes and has a reduced-motion/WebGL fallback.
- Contrast, keyboard navigation and visible focus are checked in both themes.
- No fabricated source-code URL or live metrics.
- Run build, lint and the existing test suite where available; report actual results and unresolved issues.

## 8. Final visual judgment

L5 should feel like a precise engineering tool: white space, black text, orange used as a decisive accent. D1 should feel like a restrained premium control room: obsidian surfaces, platinum details, no neon overload.

The switch should feel native to the product and work everywhere. The two themes should be recognizably the same application—not two separate designs.
