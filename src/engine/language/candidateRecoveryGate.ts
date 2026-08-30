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
