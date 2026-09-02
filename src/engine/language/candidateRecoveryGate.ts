/**
 * @file src/engine/language/candidateRecoveryGate.ts
 * @description VEIL Candidate Recovery Gate (Deterministic Validation & Quarantine Layer)
 * 
 * Pipeline Placement:
 * LLM #1 -> parseCandidatesBlock() -> recoverSyntaxAndParseJson() -> Candidate[] -> [CANDIDATE RECOVERY GATE] -> extractCandidatesFromMetadata() -> Translation -> Diversity -> PreAuth -> LLM #2 -> Engine
 * 
 * Core Invariants:
 * 1. Valid Candidate Zero-Mutation: Normal candidates pass through completely unmodified. No normalization, rewriting, or correction of fields.
 * 2. Independent Evaluation: Corruption in candidate N never cascades to or invalidates candidate M.
 * 3. Strict Fail-Closed Isolation: Corrupted candidates are quarantined with clear diagnostic reasons; never guessed or reconstructed.
 * 4. Deterministic Type & Boundary Verification:
 *    - candidateId: integer, in valid range [1, 5]
 *    - label: string (non-empty)
 *    - narrativeSummary: string
 *    - rawMetadata: non-null, non-array object
 */

import { recoverSyntaxAndParseJson } from './recovery.ts';

export interface VeilCandidate {
  candidateId: number;
  label: string;
  narrativeSummary: string;
  rawMetadata: any;
  preAuthStatus?: 'ALLOW' | 'REJECT';
  preAuthReasons?: string[];
}

export function parseCandidatesBlock(text: string): VeilCandidate[] | null {
  const blockMatch = text.match(/\[CANDIDATES_BLOCK\]([\s\S]*?)\[CANDIDATES_END\]/i);
  if (!blockMatch) return null;
  const jsonStr = blockMatch[1].trim();
  const recovered = recoverSyntaxAndParseJson<any>(jsonStr);
  if (!recovered.success || !recovered.data) return null;
  const parsed = recovered.data;
  let rawList: any[] | null = null;
  if (Array.isArray(parsed)) rawList = parsed;
  else if (parsed && Array.isArray(parsed.candidates)) rawList = parsed.candidates;
  if (!rawList) return null;

  // Parser Authority (B-Design): Assign canonical sequential candidateId (1..N, max 5) based on array order.
  // LLM output candidateId is untrusted and ignored. Candidate payloads (label, narrativeSummary, rawMetadata) are preserved.
  const candidateSlice = rawList.slice(0, 5);
  return candidateSlice.map((item, idx) => {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      return {
        ...item,
        candidateId: idx + 1
      };
    }
    return item;
  });
}

export interface CandidateValidationResult {
  valid: boolean;
  reasons: string[];
}

export interface QuarantinedCandidateEntry {
  index: number;
  candidate: any;
  reasons: string[];
}

export interface CandidateRecoveryGateResult<T = any> {
  passedCandidates: T[];
  quarantinedCandidates: QuarantinedCandidateEntry[];
  totalInputCount: number;
  passedCount: number;
  quarantinedCount: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates the deterministic structural integrity of a single Candidate.
 */
export function validateCandidateStructure(candidate: any): CandidateValidationResult {
  const reasons: string[] = [];

  // 1. Candidate must be a non-null, non-array object
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return {
      valid: false,
      reasons: [`Candidate item must be a non-null, non-array object (got ${Array.isArray(candidate) ? 'array' : typeof candidate})`]
    };
  }

  // 2. candidateId must be an integer within valid range [1, 5]
  if (typeof candidate.candidateId !== 'number' || !Number.isInteger(candidate.candidateId)) {
    reasons.push(`candidateId must be an integer (got ${typeof candidate.candidateId === 'number' ? 'float ' + candidate.candidateId : typeof candidate.candidateId})`);
  } else if (candidate.candidateId < 1 || candidate.candidateId > 5) {
    reasons.push(`candidateId out of bounds [1, 5] (got ${candidate.candidateId})`);
  }

  // 3. label must be a string
  if (typeof candidate.label !== 'string') {
    reasons.push(`label must be a string (got ${typeof candidate.label})`);
  } else if (candidate.label.trim().length === 0) {
    reasons.push('label must not be an empty string');
  }

  // 4. narrativeSummary must be a string
  if (typeof candidate.narrativeSummary !== 'string') {
    reasons.push(`narrativeSummary must be a string (got ${typeof candidate.narrativeSummary})`);
  }

  // 5. rawMetadata must be a non-null, non-array object
  if (typeof candidate.rawMetadata !== 'object' || candidate.rawMetadata === null || Array.isArray(candidate.rawMetadata)) {
    reasons.push(`rawMetadata must be a non-null, non-array object (got ${candidate.rawMetadata === null ? 'null' : Array.isArray(candidate.rawMetadata) ? 'array' : typeof candidate.rawMetadata})`);
  } else if (Array.isArray(candidate.rawMetadata.inventoryChanges)) {
    // Canonical inventory mutation/reference is an identity-sensitive operation.
    // Every entry must carry a complete reference bundle before it can leave this gate.
    for (let i = 0; i < candidate.rawMetadata.inventoryChanges.length; i++) {
      const inv = candidate.rawMetadata.inventoryChanges[i];
      if (typeof inv !== 'object' || inv === null || Array.isArray(inv)) {
        reasons.push(`inventoryChanges[${i}] must be a non-null object carrying entityReference`);
        continue;
      }
      if (!isNonEmptyString(inv.name)) {
        reasons.push(`inventoryChanges[${i}].name must be a non-empty string`);
      }
      const ref = inv.entityReference;
      if (typeof ref !== 'object' || ref === null || Array.isArray(ref)) {
        reasons.push(`inventoryChanges[${i}] missing required entityReference bundle`);
        continue;
      }
      if (ref.entityType !== 'ITEM') {
        reasons.push(`inventoryChanges[${i}].entityReference.entityType must be ITEM`);
      }
      if (ref.claimedEntityId !== undefined && !isNonEmptyString(ref.claimedEntityId)) {
        reasons.push(`inventoryChanges[${i}].entityReference.claimedEntityId must be a non-empty string when provided`);
      }
      const evidence = ref.evidence;
      if (typeof evidence !== 'object' || evidence === null || Array.isArray(evidence)) {
        reasons.push(`inventoryChanges[${i}].entityReference.evidence must be a non-null object`);
      } else {
        const hasEvidence = [evidence.sourceNpcId, evidence.context, evidence.verifiedEventId, evidence.cause]
          .some(isNonEmptyString) || (evidence.cost && typeof evidence.cost === 'object');
        if (!hasEvidence) {
          reasons.push(`inventoryChanges[${i}].entityReference.evidence must contain at least one identity/acquisition evidence field`);
        }
      }
      // LLM is never allowed to pre-populate an engine resolution.
      if (ref.resolvedEntityId !== undefined) {
        reasons.push(`inventoryChanges[${i}].entityReference.resolvedEntityId is engine-owned and must not be supplied by LLM`);
      }
    }
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}

/**
 * Candidate Recovery Gate
 * Filters an array of raw candidate objects, quarantining corrupted items while preserving valid ones with Zero-Mutation.
 */
export function runCandidateRecoveryGate<T = any>(rawCandidates: any): CandidateRecoveryGateResult<T> {
  // If the rawCandidates is not an array, fail-closed
  if (!Array.isArray(rawCandidates)) {
    return {
      passedCandidates: [],
      quarantinedCandidates: [
        {
          index: 0,
          candidate: rawCandidates,
          reasons: [`Expected candidate list array, received ${rawCandidates === null ? 'null' : typeof rawCandidates}`]
        }
      ],
      totalInputCount: 0,
      passedCount: 0,
      quarantinedCount: 1
    };
  }

  const structurallyValidCandidates: { index: number; candidate: T; candidateId: number }[] = [];
  const quarantinedCandidates: QuarantinedCandidateEntry[] = [];

  // Pass 1: Structural Integrity Validation
  for (let i = 0; i < rawCandidates.length; i++) {
    const item = rawCandidates[i];
    const validation = validateCandidateStructure(item);

    if (validation.valid) {
      structurallyValidCandidates.push({
        index: i,
        candidate: item as T,
        candidateId: item.candidateId
      });
    } else {
      // Strict Quarantine: Record structural failure reasons
      quarantinedCandidates.push({
        index: i,
        candidate: item,
        reasons: validation.reasons
      });
    }
  }

  // Pass 2: candidateId Uniqueness Validation
  // Count frequencies of each candidateId among structurally valid candidates
  const idCounts = new Map<number, number>();
  for (const entry of structurallyValidCandidates) {
    idCounts.set(entry.candidateId, (idCounts.get(entry.candidateId) || 0) + 1);
  }

  const passedCandidates: T[] = [];
  for (const entry of structurallyValidCandidates) {
    const count = idCounts.get(entry.candidateId) || 0;
    if (count > 1) {
      // Duplicate candidateId detected -> Quarantine all candidates sharing this duplicate ID
      quarantinedCandidates.push({
        index: entry.index,
        candidate: entry.candidate,
        reasons: [`Duplicate candidateId detected (${entry.candidateId} appears ${count} times). All instances quarantined.`]
      });
    } else {
      // Zero-Mutation: Pass unique valid candidate reference verbatim
      passedCandidates.push(entry.candidate);
    }
  }

  // Sort quarantinedCandidates by original index for deterministic provenance
  quarantinedCandidates.sort((a, b) => a.index - b.index);

  return {
    passedCandidates,
    quarantinedCandidates,
    totalInputCount: rawCandidates.length,
    passedCount: passedCandidates.length,
    quarantinedCount: quarantinedCandidates.length
  };
}
