/**
 * @file src/engine/language/semanticCandidateContract.ts
 * @description Explicit LLM #1 -> SemanticEvent transport contract.
 *
 * RUNTIME BOUNDARY & SEMANTIC PRESERVATION DIRECTIVE
 * --------------------------------------------------
 * LLM #1 is the natural-language semantic frontend. It translates natural language
 * into SemanticEvents without adding, removing, upgrading, or reversing meaning.
 *
 * 1. Event ≠ Intent: An intended, attempted, desired, or planned action is not an accomplished action.
 * 2. Fact ≠ Claim ≠ Hearsay ≠ Inference ≠ Possibility: Never promote one epistemic state into another.
 * 3. Asserted ≠ Verified: Linguistic assertion alone never establishes canonical truth.
 * 4. Asserted ≠ Negated: A negated event must never be emitted as an asserted event.
 * 5. Observation ≠ Inference: Do not convert an inferred cause, motive, identity, or event into an observed fact.
 * 6. Temporal sequence ≠ Causation: Create CAUSE only when causal meaning is explicitly supported by the source text.
 * 7. Attempt ≠ Outcome: Preserve both intention and actual outcome when both are expressed.
 * 8. Compound meaning must remain decomposable: Do not collapse independently meaningful events into one event merely because they occur in the same sentence.
 * 9. Preserve uncertainty: When the source does not establish a fact, use the appropriate epistemic, polarity, modality, and scope state rather than inventing certainty.
 * 10. No semantic invention: Do not invent entities, relationships, causes, provenance, canonical IDs, outcomes, or world facts absent from the source.
 *
 * SemanticEvents describe interpreted meaning only.
 * They do not authorize Canonical State changes.
 *
 * IMPORTANT:
 * - `rawMetadata` remains the exact 9-field external legacy contract.
 * - `semanticEvents` is a separate top-level candidate field.
 * - This module performs structural validation only. Causal/world/identity
 *   judgment remains downstream authority.
 * - The Korean deterministic parser is NOT used here.
 */

import type { CandidatePacket } from '../../types';
import type {
  CanonicalRole,
  EpistemicStatus,
  Modality,
  Polarity,
  Scope,
  SemanticEvent,
  SemanticEventRole,
} from './types';

/** Maximum number of semantic events carried by one candidate. */
export const MAX_SEMANTIC_EVENTS_PER_CANDIDATE = 8;

export interface SemanticCandidateOutput {
  semanticEvents: SemanticEvent[];
}

export type CandidatePacketWithSemanticEvents = CandidatePacket & {
  semanticEvents?: SemanticEvent[];
};

const VALID_SCOPES = new Set<Scope>([
  'CANONICAL',
  'CLAIM',
  'HYPOTHETICAL',
  'PROPOSAL',
  'OFFSCREEN',
  'INTENT',
  'HISTORICAL',
  'OBSERVATION',
  'UNVERIFIED',
]);

const VALID_POLARITIES = new Set<Polarity>(['ASSERTED', 'NEGATED', 'UNKNOWN']);

const VALID_EPISTEMIC_STATUSES = new Set<EpistemicStatus>([
  'OBSERVED',
  'ASSERTED',
  'HEARSAY',
  'INFERRED',
  'UNVERIFIED',
  'UNKNOWN',
  'VERIFIED',
]);

const VALID_MODALITIES = new Set<Modality>([
  'NONE',
  'POSSIBLE',
  'NECESSARY',
  'COUNTERFACTUAL',
  'INTENTIONAL',
  'COMMITMENT',
]);

const VALID_ROLES = new Set<CanonicalRole>([
  'SUBJECT',
  'TARGET',
  'OBJECT',
  'RECIPIENT',
  'SOURCE',
  'COUNTERPARTY',
  'LOCATION',
  'INSTRUMENT',
  'BENEFICIARY',
  'SPEAKER',
  'OBSERVER',
  'HOLDER',
  'OWNER',
  'TIME',
  'CAUSE',
  'VALUE',
  'STATE',
  'CONSTRAINT',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateRole(role: unknown, index: number, errors: string[]): role is SemanticEventRole {
  if (!isRecord(role)) {
    errors.push(`roles[${index}] must be a non-null object`);
    return false;
  }

  if (!VALID_ROLES.has(role.role as CanonicalRole)) {
    errors.push(`roles[${index}].role must be a canonical ROLE`);
  }

  if (role.entityId !== undefined && !isNonEmptyString(role.entityId)) {
    errors.push(`roles[${index}].entityId must be a non-empty string when provided`);
  }

  if (role.entityName !== undefined && !isNonEmptyString(role.entityName)) {
    errors.push(`roles[${index}].entityName must be a non-empty string when provided`);
  }

  if (role.status !== undefined && !['RESOLVED', 'UNRESOLVED', 'AMBIGUOUS'].includes(String(role.status))) {
    errors.push(`roles[${index}].status must be RESOLVED, UNRESOLVED, or AMBIGUOUS when provided`);
  }

  return true;
}

function validateEvent(event: unknown, index: number, errors: string[]): event is SemanticEvent {
  if (!isRecord(event)) {
    errors.push(`semanticEvents[${index}] must be a non-null object`);
    return false;
  }

  if (!isNonEmptyString(event.eventId)) {
    errors.push(`semanticEvents[${index}].eventId must be a non-empty string`);
  }

  if (!isNonEmptyString(event.action)) {
    errors.push(`semanticEvents[${index}].action must be a non-empty string`);
  }

  if (!Array.isArray(event.roles)) {
    errors.push(`semanticEvents[${index}].roles must be an array`);
  } else {
    for (let roleIndex = 0; roleIndex < event.roles.length; roleIndex++) {
      validateRole(event.roles[roleIndex], roleIndex, errors);
    }
  }

  if (!VALID_SCOPES.has(event.scope as Scope)) {
    errors.push(`semanticEvents[${index}].scope must be a valid Scope`);
  }

  if (!VALID_POLARITIES.has(event.polarity as Polarity)) {
    errors.push(`semanticEvents[${index}].polarity must be a valid Polarity`);
  }

  if (!VALID_EPISTEMIC_STATUSES.has(event.epistemicStatus as EpistemicStatus)) {
    errors.push(`semanticEvents[${index}].epistemicStatus must be a valid EpistemicStatus`);
  }

  if (!VALID_MODALITIES.has(event.modality as Modality)) {
    errors.push(`semanticEvents[${index}].modality must be a valid Modality`);
  }

  if (event.provenance !== undefined && !isNonEmptyString(event.provenance)) {
    errors.push(`semanticEvents[${index}].provenance must be a non-empty string when provided`);
  }

  return true;
}

/**
 * Structural-only validation for the LLM #1 semantic payload.
 * It intentionally does not determine whether an event is causally valid.
 */
export function validateSemanticCandidateOutput(value: unknown): {
  valid: boolean;
  semanticEvents: SemanticEvent[];
  errors: string[];
} {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { valid: false, semanticEvents: [], errors: ['semantic candidate output must be a non-null object'] };
  }

  if (!Array.isArray(value.semanticEvents)) {
    return { valid: false, semanticEvents: [], errors: ['semanticEvents must be an array'] };
  }

  if (value.semanticEvents.length > MAX_SEMANTIC_EVENTS_PER_CANDIDATE) {
    errors.push(`semanticEvents exceeds maximum ${MAX_SEMANTIC_EVENTS_PER_CANDIDATE} events per candidate`);
  }

  const eventIds = new Set<string>();
  for (let index = 0; index < value.semanticEvents.length; index++) {
    const event = value.semanticEvents[index];
    validateEvent(event, index, errors);
    if (isRecord(event) && isNonEmptyString(event.eventId)) {
      const eventId = event.eventId.trim();
      if (eventIds.has(eventId)) {
        errors.push(`semanticEvents[${index}].eventId duplicates an earlier eventId`);
      } else {
        eventIds.add(eventId);
      }
    }
  }

  return {
    valid: errors.length === 0,
    semanticEvents: errors.length === 0 ? (value.semanticEvents as SemanticEvent[]) : [],
    errors,
  };
}

/**
 * Extracts the semantic side-channel from an internal candidate packet.
 * No fallback parsing, inference, or Korean pattern matching occurs here.
 */
export function getCandidateSemanticEvents(candidate: unknown): SemanticEvent[] {
  if (!isRecord(candidate) || !Array.isArray(candidate.semanticEvents)) return [];
  const result = validateSemanticCandidateOutput({ semanticEvents: candidate.semanticEvents });
  return result.valid ? result.semanticEvents : [];
}

/**
 * Explicitly documents the intended production frontend boundary.
 * The function is a type-level/runtime marker, not a causal authority gate.
 */
export function markSemanticFrontendOutput(
  candidate: CandidatePacketWithSemanticEvents,
  semanticEvents: SemanticEvent[],
): CandidatePacketWithSemanticEvents {
  const validation = validateSemanticCandidateOutput({ semanticEvents });
  if (!validation.valid) {
    throw new Error(`[SEMANTIC_FRONTEND_INVALID] ${validation.errors.join('; ')}`);
  }

  return {
    ...candidate,
    semanticEvents: validation.semanticEvents,
  };
}
