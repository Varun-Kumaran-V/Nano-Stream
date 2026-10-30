import React, { Suspense, useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import {
  ArrowRight,
  ExternalLink,
  ArrowDown,
  ShieldCheck,
  Gauge,
  Activity,
  Sliders,
  FlaskConical,
  BookOpen,
  Code2,
  Menu,
  X,
  ArrowUp,
} from 'lucide-react';
import { PageId } from '../types/qos';
import { CAPABILITY_PILLARS, PROJECT_LINKS } from '../config/projectLinks';
import { SpotlightCard } from '../components/SpotlightCard';
import { ThemeToggle } from '../components/ThemeToggle';

const LazyNetworkHeroScene = React.lazy(() =>
  import('../components/NetworkHeroScene').then((m) => ({ default: m.NetworkHeroScene }))
);

interface LandingPageProps {
  reducedMotion: boolean;
  onOpenConsole: (initialPage?: PageId) => void;
}

type PreviewTabId = 'overview' | 'traffic' | 'capacity' | 'experiments';

export const LandingPage: React.FC<LandingPageProps> = ({ reducedMotion, onOpenConsole }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<PreviewTabId>('overview');

  const pipelineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: pipelineRef,
    offset: ['start 85%', 'end 35%'],
  });
  const packetProgress = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  const sectionMotionProps = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.15 },
        transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
      };

  const pipelineSteps = [
    {
      step: '01. Observe metadata',
      status: 'Privacy-preserving',
      title: 'Capture early packet header timings',
      description:
        'Observes packet lengths, inter-arrival timing, and directionality over the first 32 packets. Packet payloads and personal browsing URLs are never inspected.',
    },
    {
      step: '02. Classify flows',
      status: 'Research foundation',
      title: 'Nano-Stream early-flow inference',
      description:
        'Maps flows into seven household traffic classes with an explicit <0.65 confidence safety gate that routes unfamiliar encrypted flows to a safe best-effort queue.',
    },
    {
      step: '03. Estimate capacity',
      status: 'Prototype concept',
      title: 'Track available WAN bottleneck',
      description:
        'Models last-mile broadband capacity contractions so the router shaping ceiling can step down before ISP modem queues overflow.',
    },
    {
      step: '04. Enforce intent policy',
      status: 'Simulated in demo',
      title: 'Coordinate per-class bandwidth lanes',
      description:
        'Applies hierarchical token-bucket (HTB) ceilings and temporary human-intent overrides while preserving minimum floors so bulk transfers never starve.',
    },
    {
      step: '05. Benchmark & verify',
      status: 'Available in demo',
      title: 'Compare against reference baselines',
      description:
        'Evaluates tail latency (p95/p99), jitter, recovery time, and Jain’s fairness index against unshaped FIFO and static QoS baselines.',
    },
  ];

  return (
    <div
      id="top"
      className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] transition-colors duration-150"
      data-testid="landing-page"
    >
      {/* Top Bar following strict 3-Zone Contract */}
      <header
        className={`sticky top-0 z-40 transition-colors duration-150 ${
          scrolled
            ? 'bg-[var(--color-bg)]/95 backdrop-blur-md border-b border-[var(--color-border)]'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-[var(--color-text-primary)] whitespace-nowrap shrink-0"
          >
            IntentQoS
          </a>

          {/* Zone 2: 4 concise single-line navigation links */}
          <nav
            aria-label="Project sections"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[var(--color-text-secondary)]"
          >
            <a
              href="#how-it-works"
              className="hover:text-[var(--color-text-primary)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              How it works
            </a>
            <a
              href="#capabilities"
              className="hover:text-[var(--color-text-primary)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#demo"
              className="hover:text-[var(--color-text-primary)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Demo
            </a>
            <a
              href="#research"
              className="hover:text-[var(--color-text-primary)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Research
            </a>
          </nav>

          {/* Zone 3: Theme Toggle + Primary Action (+ mobile menu trigger on small screens) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggle />

            <button
              type="button"
              onClick={() => onOpenConsole('overview')}
              className="px-4 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-pressed)] text-xs font-semibold text-[var(--color-on-accent)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Open console
            </button>

            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavOpen}
              className="md:hidden p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] cursor-pointer"
            >
              {mobileNavOpen ? (
                <X className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Menu className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Compact Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div
            role="dialog"
            aria-label="Mobile section navigation"
            className="md:hidden bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-4 space-y-2"
          >
            {[
              { href: '#how-it-works', label: 'How it works' },
              { href: '#capabilities', label: 'Capabilities' },
              { href: '#demo', label: 'Demo' },
              { href: '#research', label: 'Research' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className="block py-2 px-3 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* HERO SECTION */}
        <section
          aria-labelledby="hero-heading"
          className="py-10 sm:py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch"
        >
          {/* Left Column: Narrative & CTAs */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-semibold text-[var(--color-accent)]">
                <span>ADAPTIVE QOS FOR MIXED HOME BROADBAND</span>
                <span aria-hidden="true">·</span>
                <span className="font-normal text-[var(--color-text-secondary)]">
                  Built on Nano-Stream research
                </span>
              </div>

              <h1
                id="hero-heading"
                className="font-display font-bold tracking-tight text-[var(--color-text-primary)] text-4xl sm:text-5xl lg:text-[52px] leading-[1.08]"
              >
                Keep every connection in its lane.
              </h1>

              <p className="text-base sm:text-lg text-[var(--color-text-secondary)] leading-relaxed max-w-xl">
                Explore a research prototype for classifying competing home-network traffic and investigating intent-aware quality-of-service policies as available bandwidth changes.
              </p>

              {/* Primary & Secondary CTAs */}
              <div className="pt-2 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  data-testid="hero-explore-console-btn"
                  onClick={() => onOpenConsole('overview')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-pressed)] text-sm font-semibold text-[var(--color-on-accent)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Explore the console</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>

                <a
                  href={PROJECT_LINKS.ieeePaperUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="hero-read-research-link"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-sm font-medium text-[var(--color-text-primary)] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Read the research</span>
                  <ExternalLink
                    className="w-4 h-4 text-[var(--color-accent)]"
                    aria-hidden="true"
                  />
                </a>
              </div>
            </div>

            {/* Truthful Prototype Provenance Disclosure + Scroll Cue */}
            <div className="pt-6 border-t border-[var(--color-border)] space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <ShieldCheck
                  className="w-4 h-4 text-[var(--color-success)] shrink-0"
                  aria-hidden="true"
                />
                <span>Research prototype</span>
                <span aria-hidden="true">·</span>
                <span>Deterministic demo available</span>
                <span aria-hidden="true">·</span>
                <span>Live backend integration is separate</span>
              </div>

              <div>
                <a
                  href="#problem"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                >
                  <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Scroll to explore the architecture</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Lazy-Loaded 2.5D Network Sculpture with Static Fallback */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <Suspense
              fallback={
                <div className="rounded-2xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] p-6 min-h-[460px] flex flex-col justify-between">
                  <div className="text-xs font-mono text-[var(--color-accent)]">
                    2.5D FLOW SCULPTURE · ILLUSTRATIVE CONCEPT
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    Initializing household traffic lane visualization...
                  </div>
                  <div className="text-xs font-mono text-[var(--color-text-muted)]">
                    Simulated data provenance
                  </div>
                </div>
              }
            >
              <LazyNetworkHeroScene reducedMotion={reducedMotion} />
            </Suspense>
          </div>
        </section>

        {/* SECTION 1: THE PROBLEM */}
        <motion.section
          id="problem"
          aria-labelledby="problem-heading"
          className="py-14 sm:py-16 border-t border-[var(--color-border)]"
          {...sectionMotionProps}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              <div className="text-xs font-mono font-semibold text-[var(--color-warning)]">
                01 · THE HOUSEHOLD BOTTLENECK PROBLEM
              </div>
              <h2
                id="problem-heading"
                className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] tracking-tight"
              >
                One home connection. Too many competing demands.
              </h2>
              <p className="text-sm sm:text-base text-[var(--color-text-secondary)] leading-relaxed">
                When a multi-gigabyte game update or cloud backup saturates a residential broadband link, aggressive TCP streams fill the gateway buffer. Interactive UDP video calls and online games get trapped behind deep queues—causing latency spikes and jitter even on high-speed plans.
              </p>
              <div className="pt-1 space-y-2 text-xs text-[var(--color-text-secondary)]">
                <div>
                  <strong className="text-[var(--color-text-primary)]">
                    Why port rules fall short:
                  </strong>{' '}
                  Modern applications multiplex traffic over encrypted QUIC and HTTPS on port 443.
                </div>
                <div>
                  <strong className="text-[var(--color-text-primary)]">
                    Why static ceilings fail:
                  </strong>{' '}
                  Fixed QoS shapers break when ISP last-mile capacity drops during peak evening contention.
                </div>
              </div>
            </div>

            {/* Explanatory Converging Bottleneck Diagram */}
            <div className="lg:col-span-7">
              <SpotlightCard reducedMotion={reducedMotion} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-[var(--color-border)] text-xs">
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    Explanatory Queue Contention Diagram
                  </span>
                  <span className="font-mono text-[var(--color-text-muted)]">
                    CONCEPTUAL ILLUSTRATION · NOT LIVE TELEMETRY
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/40 space-y-2.5">
                    <div className="text-xs font-mono font-semibold text-[var(--color-danger)]">
                      UNSHAPED SINGLE FIFO QUEUE
                    </div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Bulk TCP floods shared buffer
                    </div>
                    <div className="space-y-1.5 pt-1 text-xs font-mono">
                      <div className="flex justify-between text-[var(--color-text-secondary)]">
                        <span>Bulk OS Download</span>
                        <span className="font-semibold text-[var(--color-warning)]">
                          38.0 Mbps (Uncapped)
                        </span>
                      </div>
                      <div className="flex justify-between text-[var(--color-text-secondary)]">
                        <span>Video Call & Gaming</span>
                        <span className="font-semibold text-[var(--color-danger)]">
                          p95 RTT: 184 ms
                        </span>
                      </div>
                      <div className="flex justify-between text-[var(--color-text-secondary)]">
                        <span>Jain’s Fairness</span>
                        <span className="font-semibold text-[var(--color-danger)]">
                          0.46 (Skewed)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[var(--color-success-soft)] border border-[var(--color-success)]/40 space-y-2.5">
                    <div className="text-xs font-mono font-semibold text-[var(--color-success)]">
                      INTENTQOS COORDINATED LANES
                    </div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Early-flow classification + adaptive ceiling
                    </div>
                    <div className="space-y-1.5 pt-1 text-xs font-mono">
                      <div className="flex justify-between text-[var(--color-text-secondary)]">
                        <span>Bulk OS Download</span>
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          Capped at 6.0 Mbps
                        </span>
                      </div>
                      <div className="flex justify-between text-[var(--color-text-secondary)]">
                        <span>Video Call & Gaming</span>
                        <span className="font-semibold text-[var(--color-success)]">
                          p95 RTT: 20.8 ms
                        </span>
                      </div>
                      <div className="flex justify-between text-[var(--color-text-secondary)]">
                        <span>Jain’s Fairness</span>
                        <span className="font-semibold text-[var(--color-success)]">
                          0.92 (Balanced)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            </div>
          </div>
        </motion.section>

        {/* SECTION 2: HOW IT WORKS (5-STEP PIPELINE) */}
        <motion.section
          id="how-it-works"
          ref={pipelineRef}
          aria-labelledby="how-heading"
          className="py-14 sm:py-16 border-t border-[var(--color-border)] space-y-8"
          {...sectionMotionProps}
        >
          <div className="max-w-2xl space-y-2">
            <div className="text-xs font-mono font-semibold text-[var(--color-accent)]">
              02 · CLOSED-LOOP ARCHITECTURE
            </div>
            <h2
              id="how-heading"
              className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] tracking-tight"
            >
              How the five-stage control loop works
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)]">
              Each stage separates what is established in the Nano-Stream research foundation from what is simulated in the interactive console or proposed for live SDN deployment.
            </p>
          </div>

          {/* Scroll-Linked Progress Track on Desktop */}
          <div className="hidden lg:block relative h-1.5 w-full rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border)] overflow-hidden">
            {reducedMotion ? (
              <div className="h-full w-full bg-[var(--color-accent)]" />
            ) : (
              <motion.div
                style={{ width: packetProgress }}
                className="h-full bg-[var(--color-accent)]"
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {pipelineSteps.map((item) => (
              <div
                key={item.step}
                style={{ boxShadow: 'var(--shadow-card)' }}
                className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-[var(--color-accent)] font-semibold">{item.step}</span>
                  </div>
                  <div className="text-[11px] font-mono font-semibold text-[var(--color-success)]">
                    {item.status}
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* SECTION 3: WHAT MAKES THE PROJECT INTERESTING (ASYMMETRIC BENTO GRID) */}
        <motion.section
          id="capabilities"
          aria-labelledby="capabilities-heading"
          className="py-14 sm:py-16 border-t border-[var(--color-border)] space-y-8"
          {...sectionMotionProps}
        >
          <div className="max-w-2xl space-y-2">
            <div className="text-xs font-mono font-semibold text-[var(--color-accent)]">
              03 · KEY TECHNICAL CAPABILITIES & HONEST BOUNDARIES
            </div>
            <h2
              id="capabilities-heading"
              className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] tracking-tight"
            >
              Designed for transparency, fairness, and edge constraints
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)]">
              Rather than claiming an opaque black-box controller, IntentQoS surfaces classifier confidence, capacity assumptions, and safety bounds at every step.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {CAPABILITY_PILLARS.map((pillar) => (
              <SpotlightCard
                key={pillar.index}
                reducedMotion={reducedMotion}
                className={`${
                  pillar.colSpan === 'wide' ? 'lg:col-span-7' : 'lg:col-span-5'
                } p-6 flex flex-col justify-between space-y-4`}
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <span className="font-semibold text-[var(--color-accent)]">
                      PILLAR {pillar.index}
                    </span>
                    <span
                      className={
                        pillar.status === 'Research foundation'
                          ? 'text-[var(--color-success)] font-semibold'
                          : pillar.status === 'Available in demo'
                            ? 'text-[var(--color-info)] font-semibold'
                            : 'text-[var(--color-warning)] font-semibold'
                      }
                    >
                      {pillar.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {pillar.summary}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {pillar.technicalDetail}
                </div>
              </SpotlightCard>
            ))}
          </div>
        </motion.section>

        {/* SECTION 4: EXPLORE THE CONSOLE (INTERACTIVE SIMULATED PREVIEW) */}
        <motion.section
          id="demo"
          aria-labelledby="demo-preview-heading"
          className="py-14 sm:py-16 border-t border-[var(--color-border)] space-y-6"
          {...sectionMotionProps}
        >
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--color-accent)]">
                <span>04 · INTERACTIVE OPERATOR CONSOLE PREVIEW</span>
                <span aria-hidden="true">·</span>
                <span className="text-[var(--color-warning)]">
                  Illustrative preview — simulated data
                </span>
              </div>
              <h2
                id="demo-preview-heading"
                className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] tracking-tight"
              >
                Inspect the seven-page operator console
              </h2>
              <p className="text-sm sm:text-base text-[var(--color-text-secondary)]">
                Preview the key operational views below or open the full interactive console to step through the 8-stage bandwidth contention story.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenConsole(previewTab)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-pressed)] text-xs font-semibold text-[var(--color-on-accent)] transition-colors cursor-pointer self-start lg:self-auto whitespace-nowrap shrink-0"
            >
              <span>Open {previewTab} in console</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <SpotlightCard reducedMotion={reducedMotion} className="p-5 sm:p-6 space-y-5">
            {/* Preview Tab Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--color-border)]">
              <div
                role="tablist"
                aria-label="Console preview tabs"
                className="flex flex-wrap items-center gap-1.5"
              >
                {[
                  { id: 'overview' as const, label: 'Overview', icon: Gauge },
                  { id: 'traffic' as const, label: 'Live Traffic', icon: Activity },
                  { id: 'capacity' as const, label: 'Capacity & Congestion', icon: Sliders },
                  { id: 'experiments' as const, label: 'Experiments & Benchmarks', icon: FlaskConical },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = previewTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setPreviewTab(tab.id)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]'
                          : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <span className="text-xs font-mono font-semibold text-[var(--color-accent)]">
                ILLUSTRATIVE PREVIEW — SIMULATED DATA (SEED 42026)
              </span>
            </div>

            {/* Representative Preview Content */}
            {previewTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
                  <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                    SIMULATED · DEMO
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                    Est. WAN Capacity
                  </div>
                  <div className="text-2xl font-bold font-mono text-[var(--color-text-primary)] mt-1">
                    52.0 Mbps
                  </div>
                  <div className="text-xs font-medium text-[var(--color-accent)] mt-2">
                    Shaper ceiling 49.0 Mbps
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
                  <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                    SIMULATED · DEMO
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                    p95 Tail Latency
                  </div>
                  <div className="text-2xl font-bold font-mono text-[var(--color-success)] mt-1">
                    20.8 ms
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-2">
                    Recovered from 78.0 ms spike
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
                  <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                    SIMULATED · DEMO
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                    Interactive Protection
                  </div>
                  <div className="text-2xl font-bold font-mono text-[var(--color-text-primary)] mt-1">
                    21.5 Mbps
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-2">
                    Video Calls + Gaming UDP
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
                  <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                    SIMULATED · DEMO
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                    2D Topology & Audit Feed
                  </div>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-1.5">
                    7 selectable network nodes
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-2">
                    Click any host or switch to inspect queue delay
                  </div>
                </div>
              </div>
            )}

            {previewTab === 'traffic' && (
              <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    Early-Flow Classification Table & Inspector Drawer (Simulated)
                  </span>
                  <span className="font-mono font-semibold text-[var(--color-success)]">
                    Includes explicit Unknown / &lt;0.65 confidence fallback
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <div className="font-semibold text-[var(--color-accent)]">
                      flw-901a-webrtc (UDP)
                    </div>
                    <div className="text-[var(--color-text-primary)] mt-1">
                      Video Calls · 96% Conf · EF (46)
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <div className="font-semibold text-[var(--color-success)]">
                      flw-902b-game (UDP)
                    </div>
                    <div className="text-[var(--color-text-primary)] mt-1">
                      Gaming · 98% Conf · CS4 (32)
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <div className="font-semibold text-[var(--color-warning)]">
                      flw-907g-unknown (UDP)
                    </div>
                    <div className="text-[var(--color-text-primary)] mt-1">
                      Unknown · 44% Conf · Best-Effort
                    </div>
                  </div>
                </div>
              </div>
            )}

            {previewTab === 'capacity' && (
              <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="font-mono font-semibold text-[var(--color-accent)]">
                    ESTIMATED WAN CAPACITY
                  </div>
                  <div className="text-lg font-bold font-mono text-[var(--color-text-primary)] mt-1">
                    120 → 52 → 120 Mbps
                  </div>
                  <p className="text-[var(--color-text-secondary)] mt-1">
                    Models sudden last-mile drops and step-up recovery probes.
                  </p>
                </div>
                <div>
                  <div className="font-mono font-semibold text-[var(--color-info)]">
                    CONFIGURED SHAPING RATE
                  </div>
                  <div className="text-lg font-bold font-mono text-[var(--color-text-primary)] mt-1">
                    95% Headroom Ceiling
                  </div>
                  <p className="text-[var(--color-text-secondary)] mt-1">
                    Maintains a 5% anti-bufferbloat reserve below estimated WAN capacity.
                  </p>
                </div>
                <div>
                  <div className="font-mono font-semibold text-[var(--color-success)]">
                    OBSERVED THROUGHPUT
                  </div>
                  <div className="text-lg font-bold font-mono text-[var(--color-text-primary)] mt-1">
                    Per-Class Egress Tracking
                  </div>
                  <p className="text-[var(--color-text-secondary)] mt-1">
                    Displayed distinctly from capacity estimates and shaper ceilings.
                  </p>
                </div>
              </div>
            )}

            {previewTab === 'experiments' && (
              <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="font-mono font-semibold text-[var(--color-accent)]">
                    5 SIMULATED REFERENCE BASELINES · CSV & JSON EXPORT
                  </div>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Compare Unshaped FIFO, Static QoS, FQ-CoDel Reference, Deterministic Adaptive, and Proposed IntentQoS
                  </div>
                  <p className="text-[var(--color-text-secondary)]">
                    Includes median/p95/p99 latency, Jain’s fairness index, recovery time, and explicit simulation disclaimers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenConsole('experiments')}
                  className="px-3.5 py-2 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] font-mono shrink-0 cursor-pointer"
                >
                  Compare Baselines →
                </button>
              </div>
            )}
          </SpotlightCard>
        </motion.section>

        {/* SECTION 5: RESEARCH & RESOURCES */}
        <motion.section
          id="research"
          aria-labelledby="research-heading"
          className="py-14 sm:py-16 border-t border-[var(--color-border)] space-y-8"
          {...sectionMotionProps}
        >
          <div className="max-w-2xl space-y-2">
            <div className="text-xs font-mono font-semibold text-[var(--color-accent)]">
              05 · RESEARCH FOUNDATION & PROJECT SCOPE
            </div>
            <h2
              id="research-heading"
              className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] tracking-tight"
            >
              Nano-Stream publication & IntentQoS prototype scope
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)]">
              IntentQoS builds upon the published Nano-Stream traffic classification research and extends it with an interactive adaptive policy, capacity-tracking, and fairness-evaluation console.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* IEEE Paper Card */}
            <SpotlightCard
              reducedMotion={reducedMotion}
              className="p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--color-success)]">
                  <BookOpen className="w-4 h-4" aria-hidden="true" />
                  <span>PUBLISHED RESEARCH FOUNDATION</span>
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {PROJECT_LINKS.ieeePaperTitle}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  Read the peer-reviewed IEEE publication detailing the resource-efficient early-flow classification methodology that underpins IntentQoS.
                </p>
              </div>

              <div>
                <a
                  href={PROJECT_LINKS.ieeePaperUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="research-section-ieee-link"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-xs font-semibold text-[var(--color-on-accent)] transition-colors"
                >
                  <span>View paper on IEEE Xplore</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </SpotlightCard>

            {/* Source Repository & Extension Scope Card */}
            <SpotlightCard
              reducedMotion={reducedMotion}
              className="p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--color-info)]">
                  <Code2 className="w-4 h-4" aria-hidden="true" />
                  <span>PROTOTYPE REPOSITORY & API ADAPTER</span>
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Frontend Console & Python/Ryu Backend Bridge
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  The React console includes a typed{' '}
                  <code className="font-mono text-[var(--color-text-primary)]">DataProvider</code>{' '}
                  adapter that separates deterministic Demo / Replay mode from Live REST telemetry (
                  <code className="font-mono text-[var(--color-text-primary)]">/api/health</code>).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {PROJECT_LINKS.sourceRepoUrl ? (
                  <a
                    href={PROJECT_LINKS.sourceRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] text-xs font-semibold text-[var(--color-text-primary)]"
                  >
                    <span>View Source Repository</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  <span
                    data-testid="source-repo-coming-soon"
                    aria-disabled="true"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] cursor-not-allowed"
                  >
                    {PROJECT_LINKS.sourceRepoFallbackLabel}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onOpenConsole('diagnostics')}
                  className="px-4 py-2.5 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] cursor-pointer"
                >
                  Inspect Live / Demo Adapter
                </button>
              </div>
            </SpotlightCard>
          </div>
        </motion.section>
      </main>

      {/* QUIET FOOTER */}
      <footer className="mt-12 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[var(--color-text-secondary)]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display font-bold text-[var(--color-text-primary)]">
                IntentQoS
              </span>
              <span aria-hidden="true">·</span>
              <span>Adaptive QoS for mixed home broadband traffic</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-[var(--color-accent)]">
                Demo data is simulated
              </span>
            </div>
            <p className="text-[var(--color-text-muted)]">
              Built on Nano-Stream research. All metrics in Demo / Replay mode are deterministic simulations (seed=42026).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 shrink-0">
            <a
              href={PROJECT_LINKS.ieeePaperUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
            >
              <span>IEEE Paper</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>

            <button
              type="button"
              onClick={() => onOpenConsole('overview')}
              className="hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
            >
              Open Console
            </button>

            <a
              href="#top"
              className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
            >
              <span>Return to top</span>
              <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
