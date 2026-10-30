import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Activity,
  Gauge,
  Sliders,
  FlaskConical,
  Cpu,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Play,
  Pause,
  AlertTriangle,
  Layers,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  BookOpen,
  Sparkles,
  Compass,
} from 'lucide-react';
import {
  CapacityEstimate,
  DataMode,
  DiagnosticLog,
  FlowRecord,
  MetricPoint,
  PageId,
  PolicyEvent,
  QoSPolicy,
  ScenarioId,
  SystemHealth,
  UserIntent,
} from './types/qos';
import {
  generateFlowsForPoint,
  generatePolicyEvents,
  generateTimeSeries,
  deriveCapacityEstimate,
  INITIAL_DIAGNOSTIC_LOGS,
  INITIAL_INTENTS,
  INITIAL_POLICIES,
  SCENARIO_DEFINITIONS,
} from './services/demoEngine';
import { getDemoSystemHealth, probeLiveBackendHealth } from './services/dataProvider';
import { ApiClient } from './services/apiClient';
import { PROJECT_LINKS } from './config/projectLinks';
import { LandingPage } from './pages/LandingPage';
import { OverviewPage } from './pages/OverviewPage';
import { LiveTrafficPage } from './pages/LiveTrafficPage';
import { CapacityCongestionPage } from './pages/CapacityCongestionPage';
import { IntentsPolicyPage } from './pages/IntentsPolicyPage';
import { ExperimentsBenchmarksPage } from './pages/ExperimentsBenchmarksPage';
import { ModelInsightsPage } from './pages/ModelInsightsPage';
import { SettingsDiagnosticsPage } from './pages/SettingsDiagnosticsPage';
import { LiveDisconnectedPanel } from './components/LiveDisconnectedPanel';
import { ThemeToggle } from './components/ThemeToggle';
import { HelpCenterDrawer, HelpTabId } from './components/HelpCenterDrawer';
import { SelectionExplainToolbar } from './components/SelectionExplainToolbar';
import {
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  resolveInitialSidebarCollapsed,
  shouldIgnoreKeyboardShortcut,
} from './help/glossary';

interface NavItem {
  id: PageId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    subtitle: 'Adaptive QoS for mixed home broadband traffic',
    icon: LayoutDashboard,
  },
  {
    id: 'traffic',
    label: 'Live Traffic',
    subtitle: 'Active flow classification, confidence gating & header metadata',
    icon: Activity,
  },
  {
    id: 'capacity',
    label: 'Capacity & Congestion',
    subtitle: 'Estimated WAN bottleneck vs. configured HTB shaping ceiling',
    icon: Gauge,
  },
  {
    id: 'policy',
    label: 'Intents & Policy',
    subtitle: 'Human-intent session overrides, HTB schedule & Jain’s fairness',
    icon: Sliders,
  },
  {
    id: 'experiments',
    label: 'Experiments & Benchmarks',
    subtitle: 'Reproducible comparison against static & AQM reference baselines',
    icon: FlaskConical,
  },
  {
    id: 'models',
    label: 'Model Insights',
    subtitle: 'Nano-Stream INT8 holdout evaluation, confusion matrix & latency',
    icon: Cpu,
  },
  {
    id: 'diagnostics',
    label: 'Settings & Diagnostics',
    subtitle: 'Backend connectivity, provenance mode, motion & structured logs',
    icon: Settings,
  },
];

export default function App() {
  // Determine initial view from query string (?view=console or ?autostart=1 opens console directly; default is landing page)
  const [appView, setAppView] = useState<'landing' | 'console'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'console' || params.get('autostart') === '1') {
        return 'console';
      }
    }
    return 'landing';
  });

  const [activePage, setActivePage] = useState<PageId>('overview');

  // Desktop sidebar defaults to collapsed icon-first rail (Task-Manager style) and persists in localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      return resolveInitialSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY));
    } catch {
      return true;
    }
  });

  const [hoveredNavId, setHoveredNavId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Help Center, Glossary & Contextual Selection State
  const [helpDrawerOpen, setHelpDrawerOpen] = useState(false);
  const [helpInitialTab, setHelpInitialTab] = useState<HelpTabId>('glossary');
  const [selectedSnippet, setSelectedSnippet] = useState<string | null>(null);
  const contentRootRef = useRef<HTMLElement | null>(null);

  // Mode & Provenance State
  const [mode, setMode] = useState<DataMode>('DEMO');
  const [isProbingLive, setIsProbingLive] = useState(false);
  const [liveHealth, setLiveHealth] = useState<SystemHealth | null>(null);

  // Simulation & Scenario State
  const [scenarioId, setScenarioId] = useState<ScenarioId>('STORY_8STEP');
  const [tick, setTick] = useState<number>(34);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 2>(1);
  const [pollingIntervalMs, setPollingIntervalMs] = useState<number>(2500);

  // Accessibility: check system prefers-reduced-motion
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  // Policies, Intents & Logs
  const [policies, setPolicies] = useState<QoSPolicy[]>(INITIAL_POLICIES);
  const [intents, setIntents] = useState<UserIntent[]>(INITIAL_INTENTS);
  const [logs, setLogs] = useState<DiagnosticLog[]>(INITIAL_DIAGNOSTIC_LOGS);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // Sync browser back/forward button with landing vs console view
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'console' || params.get('autostart') === '1') {
        setAppView('console');
      } else {
        setAppView('landing');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Lock body scroll when mobile drawer or help drawer is open; close mobile menu on Escape
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (mobileMenuOpen || helpDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen, helpDrawerOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  // Global keyboard shortcut `/` or `Ctrl/Cmd+K` to open Help & Glossary search
  useEffect(() => {
    if (appView !== 'console') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (shouldIgnoreKeyboardShortcut(target, mobileMenuOpen || helpDrawerOpen)) return;

      const isSlash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey;
      const isCmdK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
      if (isSlash || isCmdK) {
        e.preventDefault();
        setHelpInitialTab('glossary');
        setHelpDrawerOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appView, mobileMenuOpen, helpDrawerOpen]);

  // Auto-clear transient toast after 4 seconds
  useEffect(() => {
    if (!actionToast) return;
    const id = setTimeout(() => setActionToast(null), 4000);
    return () => clearTimeout(id);
  }, [actionToast]);

  const handleOpenConsole = (initialPage: PageId = 'overview') => {
    setActivePage(initialPage);
    setAppView('console');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'console');
      window.history.pushState({ view: 'console', page: initialPage }, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  };

  const handleReturnToLanding = () => {
    setAppView('landing');
    setMobileMenuOpen(false);
    setHelpDrawerOpen(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('view');
      window.history.pushState({ view: 'landing' }, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  };

  const handleExplainText = (snippet: string) => {
    setSelectedSnippet(snippet);
    setHelpInitialTab('explain');
    setHelpDrawerOpen(true);
  };

  const handleAskAiText = (snippet?: string) => {
    if (snippet) {
      setSelectedSnippet(snippet);
    }
    setHelpInitialTab('assistant');
    setHelpDrawerOpen(true);
  };

  const appendLog = (
    severity: 'INFO' | 'WARN' | 'ERROR',
    component: DiagnosticLog['component'],
    event: string,
    activeMode: DataMode = mode
  ) => {
    const now = new Date().toISOString().slice(11, 23) + ' UTC';
    setLogs((prev) => [
      {
        id: `log-${Date.now()}-${Math.floor(Math.random() * 999)}`,
        timestamp: now,
        severity,
        component,
        event,
        correlationId: `corr-${Date.now().toString().slice(-5)}`,
        mode: activeMode,
      },
      ...prev.slice(0, 49),
    ]);
  };

  // Deterministic Demo Simulation Loop (runs only when console is open and in DEMO mode)
  useEffect(() => {
    if (appView !== 'console' || mode !== 'DEMO' || !isPlaying) return;
    const effectiveInterval = Math.max(600, Math.round(pollingIntervalMs / speedMultiplier));
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
      setIntents((prev) =>
        prev.map((intent) => {
          if (intent.status !== 'ACTIVE') return intent;
          const nextRem = Math.max(0, intent.remainingSeconds - 5);
          return {
            ...intent,
            remainingSeconds: nextRem,
            status: nextRem === 0 ? 'EXPIRED' : 'ACTIVE',
          };
        })
      );
    }, effectiveInterval);
    return () => clearInterval(timer);
  }, [appView, mode, isPlaying, pollingIntervalMs, speedMultiplier]);

  // Live Backend Health Probe when switched to LIVE mode
  const triggerLiveProbe = async () => {
    setIsProbingLive(true);
    const result = await probeLiveBackendHealth();
    setLiveHealth(result);
    setIsProbingLive(false);
    appendLog(
      result.connected ? 'INFO' : 'WARN',
      'API_CLIENT',
      result.connected
        ? `Connected to live backend at ${result.apiBaseUrl}`
        : `Live backend probe failed: ${result.error?.message || 'Unreachable'}`,
      'LIVE'
    );
  };

  const handleModeChange = (nextMode: DataMode) => {
    setMode(nextMode);
    if (nextMode === 'LIVE') {
      setActionToast('Switched to LIVE mode — probing /api/health endpoint...');
      triggerLiveProbe();
    } else {
      setActionToast('Switched to DEMO / REPLAY mode (deterministic seed=42026).');
      appendLog(
        'INFO',
        'DEMO_ENGINE',
        'Switched active telemetry provider to DEMO / REPLAY.',
        'DEMO'
      );
    }
  };

  // Live Telemetry & Model State
  const [liveSeries, setLiveSeries] = useState<MetricPoint[]>([]);
  const [liveFlows, setLiveFlows] = useState<FlowRecord[]>([]);
  const [liveCapacity, setLiveCapacity] = useState<CapacityEstimate | null>(null);
  const [livePolicies, setLivePolicies] = useState<QoSPolicy[]>([]);
  const [liveIntents, setLiveIntents] = useState<UserIntent[]>([]);
  const [liveEvents, setLiveEvents] = useState<PolicyEvent[]>([]);

  // Polling loop for verified live backend in LIVE mode
  useEffect(() => {
    if (appView !== 'console' || mode !== 'LIVE' || !liveHealth?.connected) return;
    let active = true;

    const fetchLiveData = async () => {
      try {
        const [hist, fl, cap, pols, ints, evts] = await Promise.all([
          ApiClient.getMetricsHistory(),
          ApiClient.getFlows(),
          ApiClient.getCapacity(),
          ApiClient.getPolicies(),
          ApiClient.getIntents(),
          ApiClient.getEvents(),
        ]);
        if (!active) return;
        if (hist && hist.length > 0) setLiveSeries(hist);
        if (fl && fl.length > 0) setLiveFlows(fl);
        if (cap) setLiveCapacity(cap);
        if (pols && pols.length > 0) setLivePolicies(pols);
        if (ints) setLiveIntents(ints);
        if (evts && evts.length > 0) setLiveEvents(evts);
      } catch (err) {
        // Silently handled to avoid UI jitter
      }
    };

    fetchLiveData();
    const interval = setInterval(fetchLiveData, Math.max(1200, pollingIntervalMs));
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [appView, mode, liveHealth?.connected, pollingIntervalMs]);

  // Compute time-series and current state (live or demo)
  const series = useMemo(
    () => (mode === 'LIVE' && liveSeries.length > 0 ? liveSeries : generateTimeSeries(scenarioId, tick, 48, policies, intents)),
    [mode, liveSeries, scenarioId, tick, policies, intents]
  );

  const currentPoint = series[series.length - 1];
  const flows = useMemo(() => (mode === 'LIVE' && liveFlows.length > 0 ? liveFlows : generateFlowsForPoint(currentPoint)), [mode, liveFlows, currentPoint]);
  const events = useMemo(() => (mode === 'LIVE' && liveEvents.length > 0 ? liveEvents : generatePolicyEvents(scenarioId, tick)), [mode, liveEvents, scenarioId, tick]);
  const capacityEstimate = useMemo(
    () => (mode === 'LIVE' && liveCapacity ? liveCapacity : deriveCapacityEstimate(currentPoint, scenarioId)),
    [mode, liveCapacity, currentPoint, scenarioId]
  );

  const activePolicies = useMemo(
    () => (mode === 'LIVE' && livePolicies.length > 0 ? livePolicies : policies),
    [mode, livePolicies, policies]
  );

  const activeIntents = useMemo(
    () => (mode === 'LIVE' && liveIntents.length > 0 ? liveIntents : intents),
    [mode, liveIntents, intents]
  );

  const systemHealth: SystemHealth = useMemo(() => {
    if (mode === 'LIVE') {
      return liveHealth || getDemoSystemHealth(`${currentPoint.timestamp} UTC`);
    }
    return getDemoSystemHealth(`${currentPoint.timestamp} UTC`);
  }, [mode, liveHealth, currentPoint.timestamp]);

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activePage) || NAV_ITEMS[0];

  const handleSelectScenario = (id: ScenarioId) => {
    setScenarioId(id);
    setTick(id === 'STORY_8STEP' ? 18 : 12);
    const scenLabel = SCENARIO_DEFINITIONS.find((s) => s.id === id)?.shortLabel || id;
    setActionToast(`Loaded scenario: ${scenLabel} (simulated seed=42026)`);
    appendLog('INFO', 'DEMO_ENGINE', `Selected scenario ${id} (seed=42026).`);
  };

  const handleResetAllDemo = () => {
    setScenarioId('STORY_8STEP');
    setTick(12);
    setPolicies(INITIAL_POLICIES);
    setIntents(INITIAL_INTENTS);
    setLogs(INITIAL_DIAGNOSTIC_LOGS);
    setActionToast('Simulation state and policies reset to baseline.');
  };

  // Render Public Landing Page when appView === 'landing'
  if (appView === 'landing') {
    return (
      <LandingPage
        reducedMotion={reducedMotion}
        onOpenConsole={handleOpenConsole}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] flex flex-col lg:flex-row transition-colors duration-150">
      {/* Persistent Desktop Left Navigation Rail (Task-Manager-Inspired Icon-First Default) */}
      <aside
        aria-label="Primary Sidebar Navigation"
        data-testid="desktop-sidebar"
        data-collapsed={sidebarCollapsed ? 'true' : 'false'}
        className={`hidden lg:flex flex-col justify-between bg-[var(--color-bg-subtle)] border-r border-[var(--color-border)] shrink-0 transition-[width] duration-150 select-none ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div>
          {/* Brand Header + Collapse/Expand Toggle */}
          <div
            className={`h-14 flex items-center border-b border-[var(--color-border)] ${
              sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-3.5'
            }`}
          >
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-strong)] flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 text-[var(--color-accent)]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 12h4l3-7 4 14 3-7h4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm tracking-tight text-[var(--color-text-primary)] truncate">
                    IntentQoS
                  </div>
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">
                    Nano-Stream QoS
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              data-testid="sidebar-collapse-toggle"
              onClick={handleToggleSidebar}
              aria-label={
                sidebarCollapsed ? 'Expand navigation rail labels' : 'Collapse navigation rail to icons'
              }
              title={
                sidebarCollapsed ? 'Expand navigation rail labels' : 'Collapse navigation rail to icons'
              }
              className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Back to Project Site Link */}
          <div className="px-2 pt-2">
            <div className="relative">
              <button
                type="button"
                onClick={handleReturnToLanding}
                onMouseEnter={() => setHoveredNavId('back-site')}
                onMouseLeave={() => setHoveredNavId(null)}
                onFocus={() => setHoveredNavId('back-site')}
                onBlur={() => setHoveredNavId(null)}
                aria-label="Back to project site"
                title="Back to project site"
                className={`w-full flex items-center ${
                  sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'
                } rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer whitespace-nowrap`}
              >
                <ArrowLeft
                  className="w-4 h-4 text-[var(--color-accent)] shrink-0"
                  aria-hidden="true"
                />
                {!sidebarCollapsed && <span>Back to project site</span>}
              </button>
              {sidebarCollapsed && hoveredNavId === 'back-site' && (
                <div
                  role="tooltip"
                  className="fixed left-[68px] z-50 px-2.5 py-1 rounded-md bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] whitespace-nowrap pointer-events-none"
                  style={{ boxShadow: 'var(--shadow-card)', transform: 'translateY(-32px)' }}
                >
                  Back to project site
                </div>
              )}
            </div>
          </div>

          {/* 7 Operational Navigation Destinations */}
          <nav aria-label="Main sections" className="p-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <div key={item.id} className="relative">
                  <button
                    type="button"
                    data-testid={`nav-${item.id}`}
                    onClick={() => setActivePage(item.id)}
                    onMouseEnter={() => setHoveredNavId(item.id)}
                    onMouseLeave={() => setHoveredNavId(null)}
                    onFocus={() => setHoveredNavId(item.id)}
                    onBlur={() => setHoveredNavId(null)}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    title={item.label}
                    className={`relative w-full flex items-center ${
                      sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'
                    } rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] border border-transparent'
                    }`}
                  >
                    {/* Task-Manager-Style Active Bar Indicator (distinguishable without color alone) */}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-[var(--color-accent)]"
                      />
                    )}
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? 'text-[var(--color-accent)]'
                          : 'text-[var(--color-text-secondary)]'
                      }`}
                      aria-hidden="true"
                    />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </button>

                  {/* Accessible Hover & Keyboard Focus Tooltip in Icon Rail Mode */}
                  {sidebarCollapsed && hoveredNavId === item.id && (
                    <div
                      role="tooltip"
                      className="fixed left-[68px] z-50 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] text-xs text-[var(--color-text-primary)] whitespace-nowrap pointer-events-none"
                      style={{ boxShadow: 'var(--shadow-card)', transform: 'translateY(-36px)' }}
                    >
                      <div className="font-semibold">{item.label}</div>
                      <div className="text-[10px] text-[var(--color-text-secondary)]">
                        {item.subtitle}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Area: Help & Glossary Trigger + Mode/Provenance Status */}
        <div className="p-2 border-t border-[var(--color-border)] space-y-2">
          {/* Help & Glossary Rail Button */}
          <div className="relative">
            <button
              type="button"
              data-testid="sidebar-help-btn"
              onClick={() => {
                setHelpInitialTab('glossary');
                setHelpDrawerOpen(true);
              }}
              onMouseEnter={() => setHoveredNavId('help-center')}
              onMouseLeave={() => setHoveredNavId(null)}
              onFocus={() => setHoveredNavId('help-center')}
              onBlur={() => setHoveredNavId(null)}
              aria-label="Help Center, Glossary & Gemini Assistant"
              title="Help Center, Glossary & Gemini Assistant (/ or Ctrl+K)"
              className={`w-full flex items-center ${
                sidebarCollapsed ? 'justify-center px-2 py-2' : ' justify-between px-3 py-2'
              } rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-primary)] transition-colors cursor-pointer whitespace-nowrap`}
            >
              <span className="flex items-center gap-2.5">
                <BookOpen
                  className="w-4 h-4 text-[var(--color-accent)] shrink-0"
                  aria-hidden="true"
                />
                {!sidebarCollapsed && <span>Help & Glossary</span>}
              </span>
              {!sidebarCollapsed && (
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-subtle)] border border-[var(--color-border)] font-mono text-[10px] text-[var(--color-text-muted)]">
                  /
                </kbd>
              )}
            </button>
            {sidebarCollapsed && hoveredNavId === 'help-center' && (
              <div
                role="tooltip"
                className="fixed left-[68px] z-50 px-2.5 py-1 rounded-md bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] whitespace-nowrap pointer-events-none"
                style={{ boxShadow: 'var(--shadow-card)', transform: 'translateY(-34px)' }}
              >
                Help & Glossary (/ or Ctrl+K)
              </div>
            )}
          </div>

          {!sidebarCollapsed ? (
            <>
              <div className="p-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[var(--color-text-secondary)]">MODE</span>
                  <span
                    className={
                      mode === 'DEMO'
                        ? 'font-semibold text-[var(--color-accent)]'
                        : 'font-semibold text-[var(--color-warning)]'
                    }
                  >
                    {mode === 'DEMO' ? 'DEMO / REPLAY' : 'LIVE API'}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)] leading-snug">
                  {mode === 'DEMO'
                    ? 'Seed=42026 · Simulated'
                    : systemHealth.connected
                      ? 'Connected to live bridge'
                      : 'Backend not connected'}
                </div>
              </div>

              <a
                href={PROJECT_LINKS.ieeePaperUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <span>IEEE Nano-Stream paper</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </a>
            </>
          ) : (
            <div
              className="flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[9px] font-mono"
              title={
                mode === 'DEMO'
                  ? 'DEMO / REPLAY Mode (Seed 42026 — Simulated Telemetry)'
                  : systemHealth.connected
                    ? 'LIVE Mode — Connected'
                    : 'LIVE Mode — Backend Not Connected'
              }
            >
              <Layers
                className={`w-3.5 h-3.5 ${
                  mode === 'DEMO' ? 'text-[var(--color-accent)]' : 'text-[var(--color-warning)]'
                }`}
                aria-hidden="true"
              />
              <span
                className={`font-semibold ${
                  mode === 'DEMO' ? 'text-[var(--color-accent)]' : 'text-[var(--color-warning)]'
                }`}
              >
                {mode === 'DEMO' ? 'DEMO' : systemHealth.connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 px-4 lg:px-6 bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)] flex items-center justify-between gap-3 sticky top-0 z-30">
          {/* Left Zone: Mobile Menu Trigger + Current Page Title & Explain Page Action */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] cursor-pointer"
            >
              <Menu className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-[var(--color-text-primary)] truncate sm:whitespace-nowrap sm:shrink-0">
                {activeNavMeta.id === 'overview' ? 'Network Overview' : activeNavMeta.label}
              </h1>
              <span
                className="hidden 2xl:inline text-xs text-[var(--color-text-muted)] shrink-0"
                aria-hidden="true"
              >
                —
              </span>
              <p className="hidden 2xl:inline text-xs text-[var(--color-text-secondary)] truncate">
                {activeNavMeta.subtitle}
              </p>
              <button
                type="button"
                data-testid="header-explain-page-btn"
                onClick={() => {
                  setHelpInitialTab('explain');
                  setHelpDrawerOpen(true);
                }}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Explain what this page shows, what is simulated, and what actions are safe"
              >
                <Compass className="w-3 h-3 text-[var(--color-accent)]" aria-hidden="true" />
                <span>Explain page</span>
              </button>
            </div>
          </div>

          {/* Right Zone: Help/Glossary, Ask AI, Mode Selector, Playback & Theme Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-text-secondary)]">
              <span
                data-testid="shell-mode-indicator"
                className={
                  mode === 'DEMO'
                    ? 'font-semibold text-[var(--color-accent)]'
                    : 'font-semibold text-[var(--color-warning)]'
                }
              >
                {mode === 'DEMO'
                  ? 'DEMO / REPLAY — simulated scenario'
                  : 'LIVE MODE — backend unverified'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[var(--color-text-muted)]">{currentPoint.timestamp} UTC</span>
            </div>

            {/* Glossary & Search Button */}
            <button
              type="button"
              data-testid="header-help-btn"
              onClick={() => {
                setHelpInitialTab('glossary');
                setHelpDrawerOpen(true);
              }}
              aria-label="Open Glossary and Help Search"
              title="Open Glossary & Help Search (Shortcut: / or Ctrl+K)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden="true" />
              <span className="hidden md:inline">Glossary</span>
              <kbd className="hidden md:inline px-1 py-0.2 rounded bg-[var(--color-bg-subtle)] border border-[var(--color-border)] font-mono text-[10px] text-[var(--color-text-muted)]">
                /
              </kbd>
            </button>

            {/* Ask AI Assistant Button */}
            <button
              type="button"
              data-testid="header-ask-ai-btn"
              onClick={() => handleAskAiText()}
              aria-label="Open Gemini Help Assistant"
              title="Open Gemini Help Assistant"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden="true" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>

            {/* Mode Switcher Segmented Control */}
            <div
              role="group"
              aria-label="Telemetry data mode"
              className="inline-flex items-center p-0.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-strong)]"
            >
              <button
                type="button"
                onClick={() => handleModeChange('DEMO')}
                className={`px-2 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  mode === 'DEMO'
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                DEMO / REPLAY
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('LIVE')}
                className={`px-2 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  mode === 'LIVE'
                    ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] font-semibold border border-[var(--color-warning)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                LIVE
              </button>
            </div>

            {mode === 'DEMO' && (
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? 'Pause simulation' : 'Resume simulation'}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] cursor-pointer whitespace-nowrap shrink-0"
              >
                {isPlaying ? (
                  <>
                    <Pause
                      className="w-3.5 h-3.5 text-[var(--color-warning)]"
                      aria-hidden="true"
                    />
                    <span className="hidden sm:inline">Pause</span>
                  </>
                ) : (
                  <>
                    <Play
                      className="w-3.5 h-3.5 text-[var(--color-success)]"
                      aria-hidden="true"
                    />
                    <span className="hidden sm:inline">Resume</span>
                  </>
                )}
              </button>
            )}

            {/* Theme Toggle (visually distinct from DEMO/LIVE selector) */}
            <ThemeToggle />
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation drawer"
            className="fixed inset-0 z-50 lg:hidden flex"
          >
            <div
              className="fixed inset-0"
              style={{ backgroundColor: 'var(--color-overlay)' }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-10 w-72 max-w-[85vw] bg-[var(--color-surface)] border-r border-[var(--color-border-strong)] p-4 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
                  <div>
                    <div className="font-display font-bold text-base text-[var(--color-text-primary)]">
                      IntentQoS
                    </div>
                    <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                      Built on Nano-Stream research
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close navigation menu"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={handleReturnToLanding}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-primary)]"
                  >
                    <ArrowLeft
                      className="w-3.5 h-3.5 text-[var(--color-accent)]"
                      aria-hidden="true"
                    />
                    <span>Back to project site</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setHelpInitialTab('glossary');
                      setHelpDrawerOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-primary)]"
                  >
                    <BookOpen
                      className="w-3.5 h-3.5 text-[var(--color-accent)]"
                      aria-hidden="true"
                    />
                    <span>Help, Glossary & AI Assistant</span>
                  </button>
                </div>

                <nav aria-label="Mobile sections" className="mt-3 space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActivePage(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium ${
                          isActive
                            ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                        }`}
                      >
                        <Icon className="w-4 h-4" aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-[var(--color-border)] text-xs font-mono text-[var(--color-text-secondary)]">
                Mode: {mode === 'DEMO' ? 'DEMO / REPLAY (Simulated)' : 'LIVE'}
              </div>
            </div>
          </div>
        )}

        {/* Main Viewport Content (Scoped Root for Highlight-to-Explain Selection) */}
        <main
          ref={contentRootRef}
          data-selection-root="true"
          className="flex-1 p-4 sm:p-5 lg:p-6 max-w-[1680px] w-full mx-auto space-y-5"
        >
          {/* Accessible Human Feedback Toast / Inline Status */}
          {actionToast && (
            <div
              role="status"
              aria-live="polite"
              style={{ boxShadow: 'var(--shadow-card)' }}
              className="rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-accent)] px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-[var(--color-text-primary)]"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className="w-4 h-4 text-[var(--color-success)] shrink-0"
                  aria-hidden="true"
                />
                <span>{actionToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionToast(null)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-mono cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* When in LIVE Mode and Disconnected, Display Honest Disconnection Panel */}
          {mode === 'LIVE' && !systemHealth.connected && (
            <LiveDisconnectedPanel
              health={systemHealth}
              isProbing={isProbingLive}
              onRetry={triggerLiveProbe}
              onSwitchToDemo={() => handleModeChange('DEMO')}
            />
          )}

          <div key={`${activePage}-${mode}`}>
            {mode === 'LIVE' &&
            !systemHealth.connected &&
            activePage !== 'diagnostics' &&
            activePage !== 'policy' ? (
              <div
                data-testid="live-telemetry-withheld-state"
                style={{ boxShadow: 'var(--shadow-card)' }}
                className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center space-y-3"
              >
                <AlertTriangle
                  className="w-8 h-8 text-[var(--color-warning)] mx-auto"
                  aria-hidden="true"
                />
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Live Telemetry Withheld — No Verified Backend Connected
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] max-w-xl mx-auto leading-relaxed">
                  To prevent synthetic demonstration data from being mistaken for live network measurements, charts and flow tables are withheld while in LIVE mode until{' '}
                  <code className="font-mono text-[var(--color-text-primary)]">
                    {systemHealth.apiBaseUrl}/health
                  </code>{' '}
                  responds with verified telemetry.
                </p>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleModeChange('DEMO')}
                    className="px-4 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-on-accent)] text-xs font-semibold cursor-pointer"
                  >
                    Return to Demo / Replay Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePage('diagnostics')}
                    className="px-4 py-2 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] text-xs font-medium cursor-pointer"
                  >
                    Inspect Settings & Diagnostics
                  </button>
                </div>
              </div>
            ) : (
              <>
                {activePage === 'overview' && (
                  <OverviewPage
                    series={series}
                    currentPoint={currentPoint}
                    events={events}
                    systemHealth={systemHealth}
                    scenarioId={scenarioId}
                    tick={tick}
                    isPlaying={isPlaying}
                    speedMultiplier={speedMultiplier}
                    reducedMotion={reducedMotion}
                    onSelectScenario={handleSelectScenario}
                    onTogglePlay={() => setIsPlaying(!isPlaying)}
                    onStepForward={() => setTick((t) => t + 1)}
                    onReset={handleResetAllDemo}
                    onChangeSpeed={setSpeedMultiplier}
                    onNavigate={setActivePage}
                    onExplainTerm={handleExplainText}
                  />
                )}

                {activePage === 'traffic' && (
                  <LiveTrafficPage flows={flows} reducedMotion={reducedMotion} />
                )}

                {activePage === 'capacity' && (
                  <CapacityCongestionPage
                    series={series}
                    currentPoint={currentPoint}
                    capacityEstimate={capacityEstimate}
                    scenarioId={scenarioId}
                    reducedMotion={reducedMotion}
                    onSelectScenario={handleSelectScenario}
                  />
                )}

                {activePage === 'policy' && (
                  <IntentsPolicyPage
                    mode={mode}
                    policies={activePolicies}
                    intents={activeIntents}
                    currentPoint={currentPoint}
                    reducedMotion={reducedMotion}
                    onTogglePolicyEnabled={async (policyId) => {
                      if (mode === 'LIVE' && liveHealth?.connected) {
                        try {
                          const target = activePolicies.find((p) => p.id === policyId);
                          if (target) {
                            await ApiClient.applyPolicy({ [policyId]: { ...target, enabled: !target.enabled } });
                            setLivePolicies((prev) =>
                              prev.map((p) => (p.id === policyId ? { ...p, enabled: !p.enabled } : p))
                            );
                            setActionToast(`Updated policy ${policyId} on Linux tc shaper.`);
                            appendLog('INFO', 'API_CLIENT', `Applied live policy mutation for ${policyId}.`);
                            return;
                          }
                        } catch (err) {
                          setActionToast(`Policy mutation failed: ${err instanceof Error ? err.message : String(err)}`);
                        }
                      }
                      setPolicies((prev) =>
                        prev.map((p) =>
                          p.id === policyId
                            ? {
                                ...p,
                                enabled: !p.enabled,
                                lastChanged: `${currentPoint.timestamp} UTC`,
                              }
                            : p
                        )
                      );
                      setActionToast(`Updated policy state for ${policyId} (simulated).`);
                      appendLog('INFO', 'POLICY_SIM', `Toggled policy state for ${policyId}.`);
                    }}
                    onUpdatePolicyMaxRate={async (policyId, maxRateMbps) => {
                      if (mode === 'LIVE' && liveHealth?.connected) {
                        try {
                          const target = activePolicies.find((p) => p.id === policyId);
                          if (target) {
                            await ApiClient.applyPolicy({ [policyId]: { ...target, maxRateMbps } });
                            setLivePolicies((prev) =>
                              prev.map((p) => (p.id === policyId ? { ...p, maxRateMbps } : p))
                            );
                            setActionToast(`Updated policy ${policyId} max rate on shaper.`);
                            return;
                          }
                        } catch (err) {
                          setActionToast(`Policy mutation failed: ${err instanceof Error ? err.message : String(err)}`);
                        }
                      }
                      setPolicies((prev) =>
                        prev.map((p) =>
                          p.id === policyId
                            ? {
                                ...p,
                                maxRateMbps,
                                lastChanged: `${currentPoint.timestamp} UTC`,
                              }
                            : p
                        )
                      );
                    }}
                    onAddIntent={async (newIntent) => {
                      if (mode === 'LIVE' && liveHealth?.connected) {
                        try {
                          const created = await ApiClient.createIntent({
                            name: newIntent.name,
                            trafficClass: newIntent.trafficClass,
                            durationMinutes: newIntent.durationMinutes,
                            priorityTier: newIntent.priorityTier,
                            minFloorMbps: newIntent.minFloorMbps,
                            maxCeilingMbps: newIntent.maxCeilingMbps,
                            targetLatencyMs: newIntent.targetLatencyMs,
                            rationale: newIntent.rationale,
                          });
                          setLiveIntents((prev) => [created, ...prev]);
                          setActionToast(`Created live intent "${created.name}" on shaper.`);
                          appendLog('INFO', 'API_CLIENT', `Created live intent "${created.name}" via API.`);
                          return;
                        } catch (err) {
                          setActionToast(`Failed to create live intent: ${err instanceof Error ? err.message : String(err)}`);
                        }
                      }
                      setIntents((prev) => [newIntent, ...prev]);
                      appendLog(
                        'INFO',
                        'POLICY_SIM',
                        `Created temporary intent "${newIntent.name}" (${newIntent.trafficClass}).`
                      );
                    }}
                    onRemoveIntent={async (intentId) => {
                      if (mode === 'LIVE' && liveHealth?.connected) {
                        try {
                          await ApiClient.cancelIntent(intentId);
                          setLiveIntents((prev) => prev.filter((i) => i.id !== intentId));
                          setActionToast(`Cancelled live intent ${intentId} on shaper.`);
                          appendLog('INFO', 'API_CLIENT', `Cancelled live intent ${intentId} via API.`);
                          return;
                        } catch (err) {
                          setActionToast(`Failed to cancel live intent: ${err instanceof Error ? err.message : String(err)}`);
                        }
                      }
                      setIntents((prev) => prev.filter((i) => i.id !== intentId));
                      setActionToast(`Removed temporary intent ${intentId}.`);
                      appendLog('INFO', 'POLICY_SIM', `Removed intent ${intentId}.`);
                    }}
                    onExpireIntentNow={async (intentId) => {
                      if (mode === 'LIVE' && liveHealth?.connected) {
                        try {
                          await ApiClient.cancelIntent(intentId);
                          setLiveIntents((prev) =>
                            prev.map((i) => (i.id === intentId ? { ...i, remainingSeconds: 0, status: 'EXPIRED' } : i))
                          );
                          setActionToast(`Expired live intent ${intentId} on shaper.`);
                          return;
                        } catch (err) {
                          // Fallback to local state
                        }
                      }
                      setIntents((prev) =>
                        prev.map((i) =>
                          i.id === intentId
                            ? { ...i, remainingSeconds: 0, status: 'EXPIRED' }
                            : i
                        )
                      );
                      setActionToast(`Simulated TTL expiration for ${intentId}.`);
                      appendLog(
                        'WARN',
                        'POLICY_SIM',
                        `Simulated TTL expiry for intent ${intentId}.`
                      );
                    }}
                    onResetPolicies={handleResetAllDemo}
                  />
                )}

                {activePage === 'experiments' && (
                  <ExperimentsBenchmarksPage reducedMotion={reducedMotion} />
                )}

                {activePage === 'models' && <ModelInsightsPage reducedMotion={reducedMotion} />}

                {activePage === 'diagnostics' && (
                  <SettingsDiagnosticsPage
                    mode={mode}
                    systemHealth={systemHealth}
                    logs={logs}
                    pollingIntervalMs={pollingIntervalMs}
                    reducedMotion={reducedMotion}
                    isProbingLive={isProbingLive}
                    onChangeMode={handleModeChange}
                    onChangePollingInterval={setPollingIntervalMs}
                    onToggleReducedMotion={() => {
                      setReducedMotion(!reducedMotion);
                      setActionToast(
                        !reducedMotion
                          ? 'Reduced motion enabled — decorative animations paused.'
                          : 'Standard motion restored.'
                      );
                    }}
                    onProbeLiveHealth={triggerLiveProbe}
                    onResetAllDemoState={handleResetAllDemo}
                  />
                )}
              </>
            )}
          </div>
        </main>

        {/* Contextual Floating Selection Toolbar (Explain / Ask AI / Copy) */}
        <SelectionExplainToolbar
          contentRootRef={contentRootRef}
          isBlockingModalOpen={helpDrawerOpen || mobileMenuOpen}
          onExplainSelection={handleExplainText}
          onAskAiSelection={handleAskAiText}
        />

        {/* Slide-Over Help Center, Glossary & Gemini Assistant Drawer */}
        <HelpCenterDrawer
          isOpen={helpDrawerOpen}
          initialTab={helpInitialTab}
          activePage={activePage}
          selectedSnippet={selectedSnippet}
          onClose={() => setHelpDrawerOpen(false)}
          onClearSnippet={() => setSelectedSnippet(null)}
          onNavigatePage={(page) => setActivePage(page)}
        />
      </div>
    </div>
  );
}
