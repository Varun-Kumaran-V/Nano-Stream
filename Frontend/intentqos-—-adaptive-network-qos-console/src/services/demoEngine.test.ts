import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeJainsFairnessIndex,
  generateMetricPoint,
  generateFlowsForPoint,
  validateIntentInput,
  formatExperimentsCsv,
  INITIAL_POLICIES,
  INITIAL_INTENTS,
  DEMO_EXPERIMENT_RUNS,
} from './demoEngine';
import { getDemoSystemHealth, getDisconnectedLiveHealth } from './dataProvider';
import { PROJECT_LINKS, CAPABILITY_PILLARS } from '../config/projectLinks';
import {
  resolveInitialTheme,
  getThemePalette,
  LIGHT_L5_PALETTE,
  DARK_D1_PALETTE,
  THEME_STORAGE_KEY,
} from '../context/ThemeContext';
import {
  GLOSSARY_ENTRIES,
  PAGE_EXPLANATIONS,
  searchGlossary,
  findBestGlossaryMatch,
  validateSelectionText,
  shouldIgnoreKeyboardShortcut,
  resolveInitialSidebarCollapsed,
  validateHelpChatRequest,
} from '../help/glossary';

test('computeJainsFairnessIndex returns 1.0 for equal allocations and lower for skewed allocations', () => {
  assert.equal(computeJainsFairnessIndex([20, 20, 20, 20]), 1);
  const skewed = computeJainsFairnessIndex([100, 1, 1, 1]);
  assert.ok(skewed < 0.35 && skewed >= 0.25, `Expected skewed fairness around 0.26, got ${skewed}`);
});

test('generateMetricPoint is deterministic for identical seed, scenario, and tick', () => {
  const p1 = generateMetricPoint('STORY_8STEP', 4, INITIAL_POLICIES, INITIAL_INTENTS, 42026);
  const p2 = generateMetricPoint('STORY_8STEP', 4, INITIAL_POLICIES, INITIAL_INTENTS, 42026);
  assert.deepEqual(p1, p2);
  assert.equal(p1.provenance, 'SIMULATED_DEMO');
});

test('STORY_8STEP models capacity drop at step 3 (tick 18) and recovery at step 7 (tick 42)', () => {
  const nominal = generateMetricPoint('STORY_8STEP', 2, INITIAL_POLICIES, INITIAL_INTENTS, 42026);
  const dropped = generateMetricPoint('STORY_8STEP', 19, INITIAL_POLICIES, INITIAL_INTENTS, 42026);
  const adapted = generateMetricPoint('STORY_8STEP', 32, INITIAL_POLICIES, INITIAL_INTENTS, 42026);
  const recovered = generateMetricPoint('STORY_8STEP', 43, INITIAL_POLICIES, INITIAL_INTENTS, 42026);

  assert.equal(nominal.estimatedCapacityMbps, 120);
  assert.equal(dropped.estimatedCapacityMbps, 52);
  assert.ok(dropped.p95LatencyMs > nominal.p95LatencyMs, 'Dropped capacity should raise p95 latency initially');
  assert.ok(adapted.p95LatencyMs < dropped.p95LatencyMs, 'Policy adaptation should reduce p95 latency');
  assert.equal(recovered.estimatedCapacityMbps, 120);
});

test('generateFlowsForPoint includes explicit Unknown and low-confidence flows', () => {
  const point = generateMetricPoint('STORY_8STEP', 10, INITIAL_POLICIES, INITIAL_INTENTS, 42026);
  const flows = generateFlowsForPoint(point);
  const unknownFlow = flows.find((f) => f.predictedClass === 'Unknown');
  const lowConfFlows = flows.filter((f) => f.isLowConfidence);

  assert.ok(unknownFlow, 'Must include an explicit Unknown flow');
  assert.ok(lowConfFlows.length >= 2, 'Must include low-confidence flows');
});

test('validateIntentInput rejects invalid inputs and accepts valid intent parameters', () => {
  const badName = validateIntentInput({
    name: 'ab',
    trafficClass: 'Video Calls',
    priorityTier: 1,
    minFloorMbps: 10,
    maxCeilingMbps: 30,
    targetLatencyMs: 20,
    durationMinutes: 30,
    rationale: 'Valid rationale text',
  });
  assert.ok(badName !== null);

  const badCeiling = validateIntentInput({
    name: 'Valid Name',
    trafficClass: 'Video Calls',
    priorityTier: 1,
    minFloorMbps: 40,
    maxCeilingMbps: 20,
    targetLatencyMs: 20,
    durationMinutes: 30,
    rationale: 'Valid rationale text',
  });
  assert.ok(badCeiling !== null);

  const valid = validateIntentInput({
    name: 'Prioritize Telehealth Stream',
    trafficClass: 'Video Calls',
    priorityTier: 1,
    minFloorMbps: 12,
    maxCeilingMbps: 35,
    targetLatencyMs: 18,
    durationMinutes: 45,
    rationale: 'Ensure telehealth UDP stream has guaranteed headroom',
  });
  assert.equal(valid, null);
});

test('Live vs Demo health states never fabricate green operational status when disconnected', () => {
  const demoHealth = getDemoSystemHealth('14:20:00 UTC');
  assert.equal(demoHealth.mode, 'DEMO');
  assert.ok(demoHealth.components.every((c) => c.state === 'DEMO_SIMULATION'));

  const liveHealth = getDisconnectedLiveHealth('http://localhost:8080/api', '14:20:00 UTC');
  assert.equal(liveHealth.mode, 'LIVE');
  assert.equal(liveHealth.connected, false);
  const backendComps = liveHealth.components.filter((c) => c.id !== 'frontend');
  assert.ok(
    backendComps.every((c) => c.state === 'NOT_CONNECTED' || c.state === 'UNKNOWN'),
    'Unconnected live components must be NOT_CONNECTED or UNKNOWN'
  );
});

test('formatExperimentsCsv includes metadata and provenance notes', () => {
  const csv = formatExperimentsCsv([
    DEMO_EXPERIMENT_RUNS.NO_SHAPING,
    DEMO_EXPERIMENT_RUNS.INTENT_QOS_PROPOSED,
  ]);
  assert.ok(csv.includes('run-sim-fifo-01'));
  assert.ok(csv.includes('run-sim-intentqos-05'));
  assert.ok(csv.includes('jains_fairness_index'));
});

test('PROJECT_LINKS points to exact IEEE Xplore record and does not fabricate a GitHub URL', () => {
  assert.equal(PROJECT_LINKS.ieeePaperUrl, 'https://ieeexplore.ieee.org/abstract/document/11504604/');
  assert.equal(PROJECT_LINKS.sourceRepoUrl, null);
  assert.equal(CAPABILITY_PILLARS.length, 4);
});

test('L5 Light and D1 Dark theme resolution and token palettes match specification', () => {
  assert.equal(THEME_STORAGE_KEY, 'intentqos-theme');
  assert.equal(resolveInitialTheme('dark', false), 'dark');
  assert.equal(resolveInitialTheme('light', true), 'light');
  assert.equal(resolveInitialTheme(null, false), 'light');
  assert.equal(resolveInitialTheme(null, true), 'dark');

  const l5 = getThemePalette('light');
  assert.equal(l5.bg, '#FFFFFF');
  assert.equal(l5.textPrimary, '#171717');
  assert.equal(l5.accent, '#F26A21');
  assert.deepEqual(l5, LIGHT_L5_PALETTE);

  const d1 = getThemePalette('dark');
  assert.equal(d1.bg, '#0B0B0D');
  assert.equal(d1.surface, '#17171B');
  assert.equal(d1.accent, '#D4D4D8');
  assert.deepEqual(d1, DARK_D1_PALETTE);
});

test('Glossary search and alias matching resolve p99, tail latency, Jain fairness, and first 32 packets', () => {
  assert.ok(GLOSSARY_ENTRIES.length >= 26, 'Should include at least 26 curated glossary entries');
  assert.equal(Object.keys(PAGE_EXPLANATIONS).length, 7, 'Should include explanations for all 7 pages');

  const p99Results = searchGlossary('p99');
  assert.ok(p99Results.length > 0);
  assert.equal(p99Results[0].id, 'p95-p99-latency');

  const tailMatch = findBestGlossaryMatch('p95 / p99 Tail Latency');
  assert.ok(tailMatch);
  assert.equal(tailMatch.id, 'p95-p99-latency');

  const jainMatch = findBestGlossaryMatch("Jain's Fairness Index");
  assert.ok(jainMatch);
  assert.equal(jainMatch.id, 'jains-fairness-index');

  const packetMatch = findBestGlossaryMatch('first 32 packets');
  assert.ok(packetMatch);
  assert.equal(packetMatch.id, 'first-32-packets');
});

test('validateSelectionText rejects empty, single-char, and >500-char selections', () => {
  assert.equal(validateSelectionText('   ').eligible, false);
  assert.equal(validateSelectionText('   ').reason, 'empty');
  assert.equal(validateSelectionText('a').eligible, false);
  assert.equal(validateSelectionText('a').reason, 'too_short');

  const valid = validateSelectionText('  p95 Tail Latency (ms)  ');
  assert.equal(valid.eligible, true);
  assert.equal(valid.cleaned, 'p95 Tail Latency (ms)');

  const oversized = validateSelectionText('x'.repeat(505));
  assert.equal(oversized.eligible, false);
  assert.equal(oversized.reason, 'too_long');
  assert.equal(oversized.cleaned.length, 500);
});

test('shouldIgnoreKeyboardShortcut guards inputs, textareas, selects, contenteditable, and modals', () => {
  assert.equal(shouldIgnoreKeyboardShortcut({ tagName: 'INPUT' }, false), true);
  assert.equal(shouldIgnoreKeyboardShortcut({ tagName: 'textarea' }, false), true);
  assert.equal(shouldIgnoreKeyboardShortcut({ tagName: 'SELECT' }, false), true);
  assert.equal(shouldIgnoreKeyboardShortcut({ tagName: 'DIV', isContentEditable: true }, false), true);
  assert.equal(shouldIgnoreKeyboardShortcut({ tagName: 'DIV' }, true), true);
  assert.equal(shouldIgnoreKeyboardShortcut({ tagName: 'DIV' }, false), false);
  assert.equal(shouldIgnoreKeyboardShortcut(null, false), false);
});

test('resolveInitialSidebarCollapsed defaults to collapsed (true) on desktop and respects stored preference', () => {
  assert.equal(resolveInitialSidebarCollapsed(null), true);
  assert.equal(resolveInitialSidebarCollapsed('true'), true);
  assert.equal(resolveInitialSidebarCollapsed('false'), false);
});

test('validateHelpChatRequest validates, truncates, and sanitizes /api/help/chat payloads', () => {
  assert.equal(validateHelpChatRequest(null).valid, false);
  assert.equal(validateHelpChatRequest({ message: '   ' }).valid, false);
  assert.equal(validateHelpChatRequest({ message: 'a'.repeat(805) }).valid, false);

  const validReq = validateHelpChatRequest({
    message: 'Explain why shaping ceiling is 95% of WAN capacity',
    selectedText: '  Shaping Ceiling (95%) ',
    activePage: 'capacity',
    history: [
      { role: 'user', content: 'What is WAN capacity?' },
      { role: 'assistant', content: 'Estimated bottleneck bandwidth.' },
    ],
  });

  assert.equal(validReq.valid, true);
  assert.equal(validReq.sanitized?.selectedText, 'Shaping Ceiling (95%)');
  assert.equal(validReq.sanitized?.activePage, 'capacity');
  assert.equal(validReq.sanitized?.history?.length, 2);
});

