import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Sparkles, Copy, Check, AlertCircle, X } from 'lucide-react';
import {
  validateSelectionText,
  shouldIgnoreKeyboardShortcut,
  MAX_SELECTION_CHARS,
} from '../help/glossary';

interface SelectionExplainToolbarProps {
  contentRootRef: React.RefObject<HTMLElement | null>;
  isBlockingModalOpen: boolean;
  onExplainSelection: (selectedText: string) => void;
  onAskAiSelection: (selectedText: string) => void;
}

interface ToolbarPosition {
  top: number;
  left: number;
  placement: 'above' | 'below';
  text: string;
  tooLong: boolean;
  viaContextMenu?: boolean;
}

const IGNORED_ANCESTOR_SELECTOR =
  'input, textarea, select, button, a, nav, [contenteditable="true"], [contenteditable=""], [data-no-explain="true"]';

export const SelectionExplainToolbar: React.FC<SelectionExplainToolbarProps> = ({
  contentRootRef,
  isBlockingModalOpen,
  onExplainSelection,
  onAskAiSelection,
}) => {
  const [toolbar, setToolbar] = useState<ToolbarPosition | null>(null);
  const [copied, setCopied] = useState(false);

  const clearToolbar = useCallback(() => {
    setToolbar(null);
    setCopied(false);
  }, []);

  const evaluateSelection = useCallback(
    (viaContextMenu = false, clientX?: number, clientY?: number): boolean => {
      if (typeof window === 'undefined') return false;
      const rootEl =
        contentRootRef.current || document.querySelector<HTMLElement>('[data-selection-root="true"]');
      if (!rootEl) return false;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setToolbar(null);
        return false;
      }

      const rawText = sel.toString();
      const validation = validateSelectionText(rawText);
      if (!validation.eligible && validation.reason !== 'too_long') {
        setToolbar(null);
        return false;
      }

      const range = sel.getRangeAt(0);
      const commonAncestor = range.commonAncestorContainer;
      const ancestorEl =
        commonAncestor.nodeType === Node.ELEMENT_NODE
          ? (commonAncestor as HTMLElement)
          : commonAncestor.parentElement;

      if (!ancestorEl || !rootEl.contains(ancestorEl)) {
        setToolbar(null);
        return false;
      }

      // Ignore selections inside inputs, buttons, nav, or form controls
      if (ancestorEl.closest(IGNORED_ANCESTOR_SELECTOR)) {
        setToolbar(null);
        return false;
      }

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0 && clientX === undefined) {
        setToolbar(null);
        return false;
      }

      const toolbarWidth = 280;
      const toolbarHeight = 44;
      const anchorX = clientX ?? rect.left + rect.width / 2;
      const anchorTop = clientY ?? rect.top;
      const anchorBottom = clientY ?? rect.bottom;

      const left = Math.max(
        12,
        Math.min(window.innerWidth - toolbarWidth - 12, anchorX - toolbarWidth / 2)
      );

      const preferAbove = anchorTop > toolbarHeight + 20;
      const top = preferAbove
        ? Math.max(12, anchorTop - toolbarHeight - 10)
        : Math.min(window.innerHeight - toolbarHeight - 12, anchorBottom + 10);

      setToolbar({
        top,
        left,
        placement: preferAbove ? 'above' : 'below',
        text: validation.cleaned,
        tooLong: validation.reason === 'too_long',
        viaContextMenu,
      });
      setCopied(false);
      return true;
    },
    [contentRootRef]
  );

  useEffect(() => {
    const getEventTargetElement = (target: EventTarget | null): HTMLElement | null => {
      if (!target) return null;
      if (target instanceof HTMLElement) return target;
      if (target instanceof Node) return target.parentElement;
      return null;
    };

    const handlePointerUp = (e: Event) => {
      // Ignore clicks inside the floating toolbar itself
      const targetEl = getEventTargetElement(e.target);
      if (targetEl?.closest('[data-selection-toolbar="true"]')) return;
      // Wait one frame for browser selection state to settle
      requestAnimationFrame(() => {
        evaluateSelection(false);
      });
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const targetEl = getEventTargetElement(e.target);
      if (targetEl?.closest('[data-selection-toolbar="true"]')) return;
      setTimeout(() => {
        evaluateSelection(false);
      }, 60);
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Only intercept right-click when the user has already highlighted eligible text inside the content root
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        return; // Allow normal browser context menu
      }
      const didOpen = evaluateSelection(true, e.clientX, e.clientY);
      if (didOpen) {
        e.preventDefault();
      }
    };

    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('mouseup', handlePointerUp);
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('mouseup', handlePointerUp);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [evaluateSelection]);

  // Dismiss on scroll, resize, Escape, or outside mousedown; handle Ctrl/Cmd+Shift+E shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toolbar) {
        clearToolbar();
        return;
      }

      // Keyboard shortcut: Ctrl/Cmd + Shift + E to explain currently selected text
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        const target = e.target instanceof HTMLElement ? e.target : null;
        if (shouldIgnoreKeyboardShortcut(target, isBlockingModalOpen)) return;
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
          const v = validateSelectionText(sel.toString());
          if (v.eligible) {
            e.preventDefault();
            onExplainSelection(v.cleaned);
            clearToolbar();
          }
        }
      }
    };

    const handlePointerDownOutside = (e: PointerEvent) => {
      if (!toolbar) return;
      const targetEl =
        e.target instanceof HTMLElement
          ? e.target
          : e.target instanceof Node
          ? e.target.parentElement
          : null;
      if (targetEl?.closest('[data-selection-toolbar="true"]')) return;
      clearToolbar();
    };

    const handleScrollOrResize = () => {
      if (toolbar) clearToolbar();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDownOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDownOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [toolbar, isBlockingModalOpen, clearToolbar, onExplainSelection]);

  if (!toolbar || typeof document === 'undefined') return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(toolbar.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback copy ignored
    }
  };

  return createPortal(
    <div
      role="toolbar"
      aria-label="Selected text actions"
      data-selection-toolbar="true"
      data-testid="selection-explain-toolbar"
      style={{
        position: 'fixed',
        top: `${toolbar.top}px`,
        left: `${toolbar.left}px`,
        zIndex: 60,
        boxShadow: 'var(--shadow-card)',
      }}
      className="rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] p-1.5 flex items-center gap-1 text-xs text-[var(--color-text-primary)]"
    >
      {toolbar.tooLong ? (
        <div className="flex items-center gap-2 px-2.5 py-1 text-[11px] text-[var(--color-warning)]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Selection exceeds {MAX_SELECTION_CHARS} chars — select a shorter term</span>
          <button
            type="button"
            onClick={clearToolbar}
            aria-label="Close selection toolbar"
            className="p-0.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            data-testid="selection-explain-btn"
            onClick={() => {
              const snippet = toolbar.text;
              clearToolbar();
              onExplainSelection(snippet);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-on-accent)] font-semibold transition-colors cursor-pointer whitespace-nowrap"
            title="Look up term in curated IntentQoS glossary (Ctrl/Cmd+Shift+E)"
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{toolbar.viaContextMenu ? 'Explain selected text' : 'Explain'}</span>
          </button>

          <button
            type="button"
            data-testid="selection-ask-ai-btn"
            onClick={() => {
              const snippet = toolbar.text;
              clearToolbar();
              onAskAiSelection(snippet);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-medium transition-colors cursor-pointer whitespace-nowrap"
            title="Open Gemini Assistant with selected text prefilled"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden="true" />
            <span>Ask AI</span>
          </button>

          <button
            type="button"
            data-testid="selection-copy-btn"
            onClick={handleCopy}
            aria-label="Copy selected text"
            title="Copy selected text"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[var(--color-success)]" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </>
      )}
    </div>,
    document.body
  );
};
