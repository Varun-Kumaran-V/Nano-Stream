import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Search,
  BookOpen,
  Sparkles,
  Keyboard,
  Compass,
  Send,
  Square,
  Trash2,
  Copy,
  Check,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { PageId } from '../types/qos';
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_ENTRIES,
  PAGE_EXPLANATIONS,
  GlossaryCategory,
  GlossaryEntry,
  HelpChatMessage,
  HelpChatResponsePayload,
  findBestGlossaryMatch,
  searchGlossary,
} from '../help/glossary';

export type HelpTabId = 'glossary' | 'explain' | 'assistant' | 'shortcuts';

interface HelpCenterDrawerProps {
  isOpen: boolean;
  initialTab: HelpTabId;
  activePage: PageId;
  selectedSnippet: string | null;
  onClose: () => void;
  onClearSnippet: () => void;
  onNavigatePage: (page: PageId) => void;
}

const SUGGESTED_PROMPTS = [
  'What does p99 latency mean?',
  'Why does IntentQoS use an Unknown class?',
  'What is the difference between estimated WAN capacity and shaping ceiling?',
  'Which values on this page are simulated?',
  'Explain Jain’s fairness index in this project.',
];

const STATUS_LABELS: Record<GlossaryEntry['status'], { label: string; colorVar: string }> = {
  implemented: { label: 'Implemented in UI', colorVar: 'var(--color-success)' },
  'demo-only': { label: 'Simulated in Demo', colorVar: 'var(--color-accent)' },
  'research-foundation': { label: 'Research Foundation', colorVar: 'var(--color-info)' },
  planned: { label: 'Planned · Backend Required', colorVar: 'var(--color-warning)' },
};

const SOURCE_LABELS: Record<string, string> = {
  'curated-glossary': 'Curated Glossary',
  'project-code-docs': 'Project Code & Docs',
  'ieee-nano-stream': 'IEEE Nano-Stream Paper',
  'gemini-generated': 'Gemini AI (Non-Authoritative)',
  'local-fallback': 'Curated Glossary Fallback',
};

export const HelpCenterDrawer: React.FC<HelpCenterDrawerProps> = ({
  isOpen,
  initialTab,
  activePage,
  selectedSnippet,
  onClose,
  onClearSnippet,
  onNavigatePage,
}) => {
  const [activeTab, setActiveTab] = useState<HelpTabId>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<GlossaryCategory | 'ALL'>('ALL');
  const [focusedEntryId, setFocusedEntryId] = useState<string>(GLOSSARY_ENTRIES[0].id);
  const [highlightedIdx, setHighlightedIdx] = useState<number>(0);

  // Assistant state
  const [messages, setMessages] = useState<HelpChatMessage[]>([]);
  const [inputDraft, setInputDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [geminiStatus, setGeminiStatus] = useState<{
    geminiConfigured: boolean;
    model: string;
    checked: boolean;
  }>({
    geminiConfigured: false,
    model: 'gemini-3.8-flash',
    checked: false,
  });

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Sync tab when parent opens drawer with a specific tab or snippet
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    if (initialTab === 'glossary') {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    } else if (initialTab === 'assistant') {
      if (selectedSnippet) {
        setInputDraft(`Explain "${selectedSnippet}" and how it works on the ${activePage} page.`);
      }
      setTimeout(() => chatInputRef.current?.focus(), 40);
    }
  }, [isOpen, initialTab, selectedSnippet, activePage]);

  // Probe server-side /api/help/status once when opened
  useEffect(() => {
    if (!isOpen || geminiStatus.checked) return;
    let cancelled = false;
    fetch('/api/help/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setGeminiStatus({
            geminiConfigured: Boolean(data.geminiConfigured),
            model: data.model || 'gemini-3.8-flash',
            checked: true,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGeminiStatus((prev) => ({ ...prev, checked: true }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, geminiStatus.checked]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const filteredEntries = useMemo(
    () => searchGlossary(searchQuery, selectedCategory),
    [searchQuery, selectedCategory]
  );

  useEffect(() => {
    setHighlightedIdx(0);
    if (filteredEntries.length > 0 && !filteredEntries.some((e) => e.id === focusedEntryId)) {
      setFocusedEntryId(filteredEntries[0].id);
    }
  }, [filteredEntries, focusedEntryId]);

  const activeGlossaryEntry = useMemo(
    () =>
      GLOSSARY_ENTRIES.find((e) => e.id === focusedEntryId) ||
      filteredEntries[0] ||
      GLOSSARY_ENTRIES[0],
    [focusedEntryId, filteredEntries]
  );

  const matchedSelectionEntry = useMemo(
    () => (selectedSnippet ? findBestGlossaryMatch(selectedSnippet) : null),
    [selectedSnippet]
  );

  const pageGuide = PAGE_EXPLANATIONS[activePage] || PAGE_EXPLANATIONS.overview;

  const handleSendMessage = async (promptOverride?: string) => {
    const textToSend = (promptOverride ?? inputDraft).trim();
    if (!textToSend || isSending) return;

    const userMsg: HelpChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString().slice(11, 19) + ' UTC',
    };

    const priorHistory = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    if (!promptOverride) {
      setInputDraft('');
    }
    setIsSending(true);
    setLastFailedPrompt(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          selectedText: selectedSnippet || undefined,
          activePage,
          history: priorHistory,
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Request failed with HTTP ${res.status}`);
      }

      const payload = data as HelpChatResponsePayload;
      const assistantMsg: HelpChatMessage = {
        id: payload.requestId || `ast-${Date.now()}`,
        role: 'assistant',
        content: payload.answer,
        timestamp: new Date().toISOString().slice(11, 19) + ' UTC',
        sourceType: payload.sourceType,
        relatedTerms: payload.relatedTerms,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            id: `abt-${Date.now()}`,
            role: 'assistant',
            content: 'Request cancelled by user.',
            timestamp: new Date().toISOString().slice(11, 19) + ' UTC',
            isError: true,
          },
        ]);
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to reach /api/help/chat. Use the Glossary tab for offline definitions.';
        setLastFailedPrompt(textToSend);
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: msg,
            timestamp: new Date().toISOString().slice(11, 19) + ' UTC',
            isError: true,
          },
        ]);
      }
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const handleStopSending = () => {
    abortControllerRef.current?.abort();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredEntries.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(filteredEntries.length - 1, highlightedIdx + 1);
      setHighlightedIdx(next);
      setFocusedEntryId(filteredEntries[next].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(0, highlightedIdx - 1);
      setHighlightedIdx(prev);
      setFocusedEntryId(filteredEntries[prev].id);
    } else if (e.key === 'Enter' && filteredEntries[highlightedIdx]) {
      e.preventDefault();
      setFocusedEntryId(filteredEntries[highlightedIdx].id);
    }
  };

  const handleOpenGlossaryTerm = (termId: string) => {
    const found = GLOSSARY_ENTRIES.find((e) => e.id === termId);
    if (found) {
      setSelectedCategory('ALL');
      setSearchQuery('');
      setFocusedEntryId(found.id);
      setActiveTab('glossary');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Help Center, Glossary & Gemini Assistant"
      data-testid="help-center-drawer"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 transition-opacity"
        style={{ backgroundColor: 'var(--color-overlay)' }}
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div className="relative z-10 w-full max-w-2xl bg-[var(--color-surface)] border-l border-[var(--color-border-strong)] h-full flex flex-col justify-between overflow-hidden">
        {/* Drawer Header */}
        <div className="px-5 py-4 bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--color-accent)] font-semibold">
              <span>INTENTQOS KNOWLEDGE & CONTEXTUAL HELP</span>
              <span aria-hidden="true">·</span>
              <span>SHORTCUT: / OR CTRL+K</span>
            </div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)] truncate">
              Glossary, Page Guide & Gemini Assistant
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Help Center"
            data-testid="close-help-drawer-btn"
            className="p-2 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Help Center sections"
          className="px-5 pt-2.5 pb-2 bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)] flex items-center gap-1.5 overflow-x-auto shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'glossary'}
            data-testid="help-tab-glossary"
            onClick={() => setActiveTab('glossary')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'glossary'
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] border border-transparent'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden="true" />
            <span>Glossary ({GLOSSARY_ENTRIES.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'explain'}
            data-testid="help-tab-explain"
            onClick={() => setActiveTab('explain')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'explain'
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] border border-transparent'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden="true" />
            <span>Explain Page & Selection</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'assistant'}
            data-testid="help-tab-assistant"
            onClick={() => setActiveTab('assistant')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'assistant'
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] border border-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden="true" />
            <span>Gemini Assistant</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'shortcuts'}
            data-testid="help-tab-shortcuts"
            onClick={() => setActiveTab('shortcuts')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'shortcuts'
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] border border-transparent'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden="true" />
            <span>Shortcuts</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: GLOSSARY & SEARCH */}
          {activeTab === 'glossary' && (
            <div className="space-y-4">
              {/* Search Box */}
              <div className="relative">
                <Search
                  className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  data-testid="help-glossary-search-input"
                  aria-label="Search glossary terms, aliases, categories, and definitions"
                  placeholder="Search terms (e.g. p99, tail latency, Jain, first 32 packets, HTB)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-10 pr-16 py-2.5 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-focus)]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search query"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Filter Bar */}
              <div
                role="group"
                aria-label="Filter glossary by category"
                className="flex flex-wrap items-center gap-1.5"
              >
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    selectedCategory === 'ALL'
                      ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] font-semibold'
                      : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)]'
                  }`}
                >
                  All ({GLOSSARY_ENTRIES.length})
                </button>
                {GLOSSARY_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] font-semibold'
                        : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {filteredEntries.length === 0 ? (
                <div
                  data-testid="glossary-empty-state"
                  className="p-6 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-center space-y-3"
                >
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                    No curated glossary term matched “{searchQuery}”
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    You can clear the filter or ask the Gemini Assistant to explain this term in the context of IntentQoS.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('ALL');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] cursor-pointer"
                    >
                      Reset Search
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const q = searchQuery;
                        setActiveTab('assistant');
                        handleSendMessage(`What does "${q}" mean in IntentQoS?`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-on-accent)] text-xs font-semibold cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Ask Gemini Assistant</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  {/* Left List of Matching Terms (5 cols) */}
                  <div
                    role="listbox"
                    aria-label="Matching glossary terms"
                    className="md:col-span-5 max-h-[440px] overflow-y-auto divide-y divide-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)]"
                  >
                    {filteredEntries.map((entry, idx) => {
                      const isSelected = entry.id === activeGlossaryEntry.id;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          data-testid={`glossary-item-${entry.id}`}
                          onClick={() => {
                            setFocusedEntryId(entry.id);
                            setHighlightedIdx(idx);
                          }}
                          className={`w-full text-left p-3 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--color-accent-soft)]'
                              : 'hover:bg-[var(--color-surface-hover)]'
                          }`}
                        >
                          <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                            {entry.term}
                          </div>
                          <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
                            {entry.category}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Full Term Explanation (7 cols) */}
                  <div
                    data-testid="glossary-detail-card"
                    className="md:col-span-7 p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="text-[var(--color-text-secondary)]">
                        {activeGlossaryEntry.category}
                      </span>
                      <span
                        style={{ color: STATUS_LABELS[activeGlossaryEntry.status].colorVar }}
                        className="font-semibold"
                      >
                        {STATUS_LABELS[activeGlossaryEntry.status].label}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                      {activeGlossaryEntry.term}
                    </h3>

                    <p className="text-xs text-[var(--color-text-primary)] leading-relaxed">
                      {activeGlossaryEntry.shortDefinition}
                    </p>

                    <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-2 text-xs">
                      <div>
                        <span className="font-semibold text-[var(--color-accent)]">
                          In IntentQoS:{' '}
                        </span>
                        <span className="text-[var(--color-text-secondary)]">
                          {activeGlossaryEntry.projectMeaning}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          Why it matters:{' '}
                        </span>
                        <span className="text-[var(--color-text-secondary)]">
                          {activeGlossaryEntry.whyItMatters}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          Concrete example:{' '}
                        </span>
                        <span className="text-[var(--color-text-secondary)]">
                          {activeGlossaryEntry.example}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[var(--color-text-muted)]">
                        <span>Where you see it: {activeGlossaryEntry.whereYouSeeIt}</span>
                        <span>Source: {SOURCE_LABELS[activeGlossaryEntry.sourceType]}</span>
                      </div>
                    </div>

                    {activeGlossaryEntry.relatedTerms.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                          RELATED CONCEPTS:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {activeGlossaryEntry.relatedTerms.map((relId) => {
                            const rel = GLOSSARY_ENTRIES.find((e) => e.id === relId);
                            if (!rel) return null;
                            return (
                              <button
                                key={rel.id}
                                type="button"
                                onClick={() => handleOpenGlossaryTerm(rel.id)}
                                className="px-2 py-1 rounded bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[11px] font-medium text-[var(--color-text-primary)] cursor-pointer"
                              >
                                {rel.term}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
                      {activeGlossaryEntry.relatedPage && (
                        <button
                          type="button"
                          onClick={() => {
                            if (activeGlossaryEntry.relatedPage) {
                              onNavigatePage(activeGlossaryEntry.relatedPage);
                              onClose();
                            }
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline cursor-pointer"
                        >
                          <span>Go to relevant page</span>
                          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}

                      {activeGlossaryEntry.sourceUrl && (
                        <a
                          href={activeGlossaryEntry.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        >
                          <span>IEEE Paper</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('assistant');
                          handleSendMessage(
                            `Explain "${activeGlossaryEntry.term}" and how it affects traffic on the ${activePage} page.`
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-on-accent)] text-xs font-semibold cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Ask Gemini Follow-Up</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXPLAIN SELECTION & CURRENT PAGE */}
          {activeTab === 'explain' && (
            <div className="space-y-5">
              {/* Highlighted Text Explanation Card (if user highlighted text) */}
              {selectedSnippet && (
                <div
                  data-testid="selected-text-explanation-card"
                  className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-accent)] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-mono font-semibold text-[var(--color-accent)]">
                        SELECTED TEXT EXPLANATION
                      </div>
                      <div className="text-sm font-bold font-mono text-[var(--color-text-primary)] mt-0.5">
                        “{selectedSnippet}”
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onClearSnippet}
                      className="text-xs font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
                    >
                      Clear selection
                    </button>
                  </div>

                  {matchedSelectionEntry ? (
                    <div className="p-3.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                        <span className="font-semibold text-[var(--color-success)]">
                          MATCHED CURATED GLOSSARY: {matchedSelectionEntry.term}
                        </span>
                        <span className="text-[var(--color-text-muted)]">
                          {STATUS_LABELS[matchedSelectionEntry.status].label}
                        </span>
                      </div>
                      <p className="text-[var(--color-text-primary)] leading-relaxed">
                        {matchedSelectionEntry.shortDefinition}
                      </p>
                      <div>
                        <strong className="text-[var(--color-accent)]">In IntentQoS: </strong>
                        <span className="text-[var(--color-text-secondary)]">
                          {matchedSelectionEntry.projectMeaning}
                        </span>
                      </div>
                      <div>
                        <strong className="text-[var(--color-text-primary)]">Why it matters: </strong>
                        <span className="text-[var(--color-text-secondary)]">
                          {matchedSelectionEntry.whyItMatters}
                        </span>
                      </div>
                      <div>
                        <strong className="text-[var(--color-text-primary)]">Example: </strong>
                        <span className="text-[var(--color-text-secondary)]">
                          {matchedSelectionEntry.example}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
                      No exact local glossary entry matched this phrase. Click{' '}
                      <strong className="text-[var(--color-text-primary)]">
                        Ask Gemini about this selection
                      </strong>{' '}
                      below for a contextual explanation.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                      Selected text is only sent to Gemini if you click the button →
                    </span>
                    <button
                      type="button"
                      data-testid="explain-ask-gemini-btn"
                      onClick={() => {
                        setActiveTab('assistant');
                        handleSendMessage(
                          `Explain the highlighted phrase "${selectedSnippet}" from the ${activePage} page in plain English and how it applies in IntentQoS.`
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-on-accent)] text-xs font-semibold cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Ask Gemini about this selection</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Active Page Explanation Card */}
              <div
                data-testid="page-explanation-card"
                className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] space-y-4"
              >
                <div>
                  <div className="text-[11px] font-mono font-semibold text-[var(--color-accent)]">
                    EXPLAIN THIS PAGE · ACTIVE VIEW: {activePage.toUpperCase()}
                  </div>
                  <h3 className="text-base font-bold text-[var(--color-text-primary)] mt-0.5">
                    {pageGuide.title}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                    {pageGuide.summary}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                    Key Metrics & Visuals on This Page
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {pageGuide.keyMetrics.map((m) => (
                      <div
                        key={m.name}
                        className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs"
                      >
                        <div className="font-semibold text-[var(--color-text-primary)]">
                          {m.name}
                        </div>
                        <div className="text-[var(--color-text-secondary)] mt-0.5">
                          {m.meaning}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-1 text-xs">
                  <div className="font-mono text-[11px] font-semibold text-[var(--color-accent)]">
                    DATA PROVENANCE & HONESTY BOUNDARY
                  </div>
                  <p className="text-[var(--color-text-secondary)]">{pageGuide.provenanceNote}</p>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                    Safe Actions You Can Try Right Now
                  </div>
                  <ul className="space-y-1 text-xs text-[var(--color-text-secondary)] list-disc list-inside">
                    {pageGuide.safeActions.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GEMINI HELP ASSISTANT */}
          {activeTab === 'assistant' && (
            <div className="flex flex-col h-[520px] rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] overflow-hidden">
              {/* Assistant Status & Privacy Banner */}
              <div className="p-3 bg-[var(--color-surface)] border-b border-[var(--color-border)] space-y-1.5 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {geminiStatus.geminiConfigured ? (
                      <CheckCircle2
                        className="w-4 h-4 text-[var(--color-success)] shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertTriangle
                        className="w-4 h-4 text-[var(--color-warning)] shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {geminiStatus.geminiConfigured
                        ? `Server-Side Gemini Assistant (${geminiStatus.model})`
                        : 'Local Glossary Fallback Active (Server GEMINI_API_KEY not set)'}
                    </span>
                  </div>
                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMessages([])}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                      <span>Clear chat</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] leading-snug">
                  AI explanations are generated via <code className="font-mono">/api/help/chat</code>{' '}
                  only when you submit a question and may contain mistakes. Under Google Gemini API free-tier terms, prompts may be used by Google; do not send personal or sensitive data.
                </p>
                {selectedSnippet && (
                  <div className="pt-1 flex items-center justify-between gap-2 text-[11px] font-mono text-[var(--color-accent)]">
                    <span className="truncate">
                      Context snippet attached: “{selectedSnippet}” (Page: {activePage})
                    </span>
                    <button
                      type="button"
                      onClick={onClearSnippet}
                      className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] shrink-0 cursor-pointer"
                    >
                      Detach
                    </button>
                  </div>
                )}
              </div>

              {/* Messages Scroll Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs space-y-1.5">
                      <div className="font-semibold text-[var(--color-text-primary)]">
                        Ask anything about IntentQoS, network metrics, or Nano-Stream ML
                      </div>
                      <p className="text-[var(--color-text-secondary)]">
                        Select a suggested question below or highlight any term in the console and click{' '}
                        <strong className="text-[var(--color-text-primary)]">Ask AI</strong>.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                        SUGGESTED PROMPTS:
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {SUGGESTED_PROMPTS.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => handleSendMessage(prompt)}
                            className="text-left px-3 py-2 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)] transition-colors cursor-pointer"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        msg.role === 'user'
                          ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)] ml-6'
                          : msg.isError
                            ? 'bg-[var(--color-danger-soft)] border-[var(--color-danger)]/40 mr-4'
                            : 'bg-[var(--color-surface)] border-[var(--color-border)] mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[var(--color-text-muted)]">
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {msg.role === 'user' ? 'You' : 'IntentQoS Assistant'}
                        </span>
                        <div className="flex items-center gap-2">
                          {msg.sourceType && (
                            <span className="text-[var(--color-accent)]">
                              {SOURCE_LABELS[msg.sourceType] || msg.sourceType}
                            </span>
                          )}
                          <span>{msg.timestamp}</span>
                        </div>
                      </div>

                      <div className=" whitespace-pre-wrap leading-relaxed text-[var(--color-text-primary)]">
                        {msg.content}
                      </div>

                      {msg.role === 'assistant' && (
                        <div className="pt-2 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {msg.relatedTerms?.map((termId) => {
                              const entry = GLOSSARY_ENTRIES.find((e) => e.id === termId);
                              if (!entry) return null;
                              return (
                                <button
                                  key={termId}
                                  type="button"
                                  onClick={() => handleOpenGlossaryTerm(termId)}
                                  className="px-2 py-0.5 rounded bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[10px] font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
                                >
                                  Glossary: {entry.term}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-2">
                            {msg.isError && lastFailedPrompt && (
                              <button
                                type="button"
                                onClick={() => handleSendMessage(lastFailedPrompt)}
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-accent)] hover:underline cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                                <span>Retry</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(msg.content);
                                  setCopiedMsgId(msg.id);
                                  setTimeout(() => setCopiedMsgId(null), 1500);
                                } catch {
                                  // ignore
                                }
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
                            >
                              {copiedMsgId === msg.id ? (
                                <>
                                  <Check
                                    className="w-3 h-3 text-[var(--color-success)]"
                                    aria-hidden="true"
                                  />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" aria-hidden="true" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {isSending && (
                  <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                    <span className="font-mono">Generating grounded explanation...</span>
                    <button
                      type="button"
                      onClick={handleStopSending}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--color-danger-soft)] text-[var(--color-danger)] font-mono text-[11px] font-semibold cursor-pointer"
                    >
                      <Square className="w-3 h-3" aria-hidden="true" />
                      <span>Stop</span>
                    </button>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-3 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex items-end gap-2 shrink-0"
              >
                <textarea
                  ref={chatInputRef}
                  rows={2}
                  maxLength={800}
                  data-testid="help-chat-input"
                  aria-label="Ask a question about IntentQoS or network metrics"
                  placeholder="Ask a question about IntentQoS metrics, policies, or terms..."
                  value={inputDraft}
                  onChange={(e) => setInputDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border-strong)] px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-focus)] resize-none"
                />
                <button
                  type="submit"
                  disabled={isSending || !inputDraft.trim()}
                  data-testid="help-chat-send-btn"
                  aria-label="Send question to Help Assistant"
                  className="px-3.5 py-2.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-on-accent)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: SHORTCUTS & INTERACTION GUIDE */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] space-y-3">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Keyboard Shortcuts & Contextual Selection Guide
                </h3>
                <div className="divide-y divide-[var(--color-border)] text-xs">
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <span className="text-[var(--color-text-secondary)]">
                      Open Help Center & Glossary Search
                    </span>
                    <kbd className="px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border-strong)] font-mono text-[11px] text-[var(--color-text-primary)]">
                      / or Ctrl/Cmd + K
                    </kbd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <span className="text-[var(--color-text-secondary)]">
                      Explain currently highlighted text in the console
                    </span>
                    <kbd className="px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border-strong)] font-mono text-[11px] text-[var(--color-text-primary)]">
                      Ctrl/Cmd + Shift + E
                    </kbd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <span className="text-[var(--color-text-secondary)]">
                      Navigate Glossary search results
                    </span>
                    <kbd className="px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border-strong)] font-mono text-[11px] text-[var(--color-text-primary)]">
                      ↑ / ↓ / Enter
                    </kbd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <span className="text-[var(--color-text-secondary)]">
                      Dismiss floating selection toolbar or Help Drawer
                    </span>
                    <kbd className="px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border-strong)] font-mono text-[11px] text-[var(--color-text-primary)]">
                      Escape
                    </kbd>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] space-y-2 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                <div className="font-semibold text-[var(--color-text-primary)]">
                  How Highlight-to-Explain & Right-Click Work
                </div>
                <p>
                  1. Highlight any metric label, table header, or technical term inside the main operational console. Once you release the mouse button (or touch), a compact floating toolbar appears with{' '}
                  <strong className="text-[var(--color-text-primary)]">Explain</strong>,{' '}
                  <strong className="text-[var(--color-text-primary)]">Ask AI</strong>, and{' '}
                  <strong className="text-[var(--color-text-primary)]">Copy</strong>.
                </p>
                <p>
                  2. Right-clicking on already-selected text inside the console also opens the contextual{' '}
                  <strong className="text-[var(--color-text-primary)]">Explain selected text</strong>{' '}
                  toolbar. Right-clicking anywhere else preserves your browser’s native context menu.
                </p>
                <p>
                  3. Highlighted text is never transmitted to Gemini automatically—it is only sent if you explicitly click{' '}
                  <strong className="text-[var(--color-text-primary)]">Ask AI</strong> and submit a prompt.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
