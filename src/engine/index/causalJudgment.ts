/**
 * @file src/engine/index/causalJudgment.ts
 * @description Minimal, non-destructive foundation for VEIL causal judgment.
 *
 * This layer does NOT replace authoritative-event provenance checks and does
 * NOT mutate canonical state. It only classifies an already-decomposed
 * semantic unit from explicit judgment signals.
 *
 * Authority distinction:
 * - EXISTING_EVENT: existing-event provenance remains the responsibility of
 *   resolveCurrentCausalAuthority().
 * - NOVEL_EVENT: may be judged without a prior event id; canonicalization still
 *   requires the existing validation/commit boundary.
 *
 * UNKNOWN is intentionally distinct from INVALID. Missing information must not
 * be converted into impossibility.
 */

export type CausalSourceKind = 'EXISTING_EVENT' | 'NOVEL_EVENT';

export type CausalJudgmentStatus = 'VALID' | 'UNKNOWN' | 'INVALID';

export interface CausalSource {
  kind: CausalSourceKind;
  eventId?: string;
}

/**
 * Explicitly classifies an acquisition's causal source.
 *
 * This is deliberately structural: presence of an existing event id means
 * EXISTING_EVENT; absence means NOVEL_EVENT. It does NOT assert that either
 * source is causally valid. That decision belongs to causal judgment and the
 * Sovereign Validator.
 */
export function classifyAcquisitionSource(eventId?: string): CausalSource {
  const normalized = typeof eventId === 'string' ? eventId.trim() : '';
  return normalized
    ? { kind: 'EXISTING_EVENT', eventId: normalized }
    : { kind: 'NOVEL_EVENT' };
}

/**
 * Explicit signals supplied by a future semantic/candidate judge.
 *
 * No signal is inferred from stereotypes, item names, locations, or player
 * desire here. The function below is deliberately deterministic and
 * conservative: it combines supplied judgments rather than inventing them.
 */
export interface CausalJudgmentSignals {
  humanNaturalness: 'VALID' | 'UNKNOWN' | 'INVALID';
  worldCompatibility: 'VALID' | 'UNKNOWN' | 'INVALID';
  causalPlausibility: 'VALID' | 'UNKNOWN' | 'INVALID';
  specificityGrounding: 'VALID' | 'UNKNOWN' | 'INVALID';
  provenance?: 'VALID' | 'UNKNOWN' | 'INVALID';
}

export interface CausalJudgment {
  status: CausalJudgmentStatus;
  source: CausalSource;
  reasons: string[];
}

/**
 * Deterministically combines explicit causal signals.
 *
 * Ordering follows VEIL's causal philosophy:
 * HUMAN NATURALNESS → WORLD COMPATIBILITY → CAUSAL PLAUSIBILITY →
 * SPECIFICITY/GROUNDING → PROVENANCE.
 *
 * Any explicit INVALID is terminal. Otherwise, any UNKNOWN produces UNKNOWN.
 * Only an all-VALID signal set produces VALID.
 */
export function resolveCausalJudgment(
  source: CausalSource,
  signals: CausalJudgmentSignals,
): CausalJudgment {
  const ordered: Array<[keyof CausalJudgmentSignals, CausalJudgmentSignals[keyof CausalJudgmentSignals]]> = [
    ['humanNaturalness', signals.humanNaturalness],
    ['worldCompatibility', signals.worldCompatibility],
    ['causalPlausibility', signals.causalPlausibility],
    ['specificityGrounding', signals.specificityGrounding],
  ];

  if (signals.provenance !== undefined) {
    ordered.push(['provenance', signals.provenance]);
  }

  const invalid = ordered.filter(([, value]) => value === 'INVALID').map(([key]) => key);
  if (invalid.length > 0) {
    return {
      status: 'INVALID',
      source,
      reasons: invalid.map((key) => `${String(key)}=INVALID`),
    };
  }

  const unknown = ordered.filter(([, value]) => value === 'UNKNOWN').map(([key]) => key);
  if (unknown.length > 0) {
    return {
      status: 'UNKNOWN',
      source,
      reasons: unknown.map((key) => `${String(key)}=UNKNOWN`),
    };
  }

  return {
    status: 'VALID',
    source,
    reasons: ['all causal judgment signals are VALID'],
  };
}