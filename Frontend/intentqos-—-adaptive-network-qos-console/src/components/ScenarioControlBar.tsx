import React from 'react';
import { Play, Pause, RotateCcw, SkipForward, Gauge } from 'lucide-react';
import { ScenarioId } from '../types/qos';
import { SCENARIO_DEFINITIONS, getStoryStepIndex } from '../services/demoEngine';

interface ScenarioControlBarProps {
  scenarioId: ScenarioId;
  tick: number;
  isPlaying: boolean;
  speedMultiplier: 1 | 2;
  onSelectScenario: (id: ScenarioId) => void;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onReset: () => void;
  onChangeSpeed: (speed: 1 | 2) => void;
}

export const ScenarioControlBar: React.FC<ScenarioControlBarProps> = ({
  scenarioId,
  tick,
  isPlaying,
  speedMultiplier,
  onSelectScenario,
  onTogglePlay,
  onStepForward,
  onReset,
  onChangeSpeed,
}) => {
  const currentScenario =
    SCENARIO_DEFINITIONS.find((s) => s.id === scenarioId) || SCENARIO_DEFINITIONS[0];
  const storyStepIdx = getStoryStepIndex(tick);

  return (
    <section
      aria-label="Demo Scenario Controls"
      data-testid="scenario-control-bar"
      style={{ boxShadow: 'var(--shadow-card)' }}
      className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3 transition-colors duration-150"
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
          <div className="shrink-0 flex items-center gap-2.5">
            <label
              htmlFor="scenario-select"
              className="text-[11px] font-mono font-semibold text-[var(--color-accent)] whitespace-nowrap"
            >
              SCENARIO (SEED 42026):
            </label>
            <select
              id="scenario-select"
              value={scenarioId}
              onChange={(e) => onSelectScenario(e.target.value as ScenarioId)}
              className="bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] text-xs font-medium rounded-lg px-2.5 py-1.5 border border-[var(--color-border-strong)] focus:outline-none focus:border-[var(--color-focus)]"
            >
              {SCENARIO_DEFINITIONS.map((scen) => (
                <option key={scen.id} value={scen.id}>
                  {scen.shortLabel}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <span className="font-semibold text-[var(--color-text-primary)] truncate">
                {currentScenario.name}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-[var(--color-accent)]">
                t = +{tick * 5}s
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                SIMULATED · DEMO
              </span>
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0" data-no-explain="true">
          <button
            type="button"
            data-testid="toggle-play-btn"
            onClick={onTogglePlay}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-pressed)] text-xs font-semibold text-[var(--color-on-accent)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Pause Scenario</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{tick > 12 ? 'Resume Scenario' : 'Start Scenario'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onStepForward}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Advance deterministic simulation by 1 step (+5s)"
          >
            <SkipForward className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden="true" />
            <span>Step +5s</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" aria-hidden="true" />
            <span>Reset</span>
          </button>

          <div
            role="group"
            aria-label="Simulation speed"
            className="inline-flex items-center rounded-lg bg-[var(--color-bg-subtle)] p-0.5 border border-[var(--color-border)]"
          >
            <Gauge className="w-3.5 h-3.5 text-[var(--color-text-muted)] ml-2 mr-1" aria-hidden="true" />
            {([1, 2] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onChangeSpeed(spd)}
                className={`px-2 py-0.5 rounded-md text-xs font-mono transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  speedMultiplier === spd
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-border-strong)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 8-Step Guided Story Progress Bar when STORY_8STEP is active */}
      {scenarioId === 'STORY_8STEP' && currentScenario.storySteps && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--color-border)]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 text-xs">
            <span className="font-mono text-[11px] font-semibold text-[var(--color-accent)]">
              ACTIVE NARRATIVE STAGE ({storyStepIdx + 1}/8):
            </span>
            <span className="text-[var(--color-text-primary)] font-medium">
              {currentScenario.storySteps[storyStepIdx]}
            </span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
            {currentScenario.storySteps.map((stepText, idx) => {
              const isCurrent = idx === storyStepIdx;
              const isPast = idx < storyStepIdx;
              return (
                <div
                  key={idx}
                  title={stepText}
                  className={`h-1.5 rounded-full transition-colors ${
                    isCurrent
                      ? 'bg-[var(--color-accent)]'
                      : isPast
                        ? 'bg-[var(--color-text-secondary)]'
                        : 'bg-[var(--color-border)]'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
