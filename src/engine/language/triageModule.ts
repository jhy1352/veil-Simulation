/**
 * @file src/engine/language/triageModule.ts
 * @description VEIL Triage Pipeline (Leading Structural Normalization Gate)
 * 
 * Target Pipeline Sequence:
 * LLM #1 -> Triage (with TRIAGE_STAMP) -> Recovery Gate -> Causal Language -> Diversity -> PreAuth -> Commit / Phase 2
 * 
 * Principles:
 * 1. Single-Execution Guard: Executes ONCE per request. Attaches TRIAGE_STAMP.
 *    If TRIAGE_STAMP is present, bypasses re-execution.
 * 2. Candidate Recovery Delegation:
 *    - Extracts raw candidate block string without running JSON parsing or Recovery.
 *    - All candidate parsing, syntax recovery, candidate ID assignment, and structural validation
 *      are strictly delegated to candidateRecoveryGate.ts.
 * 3. Semantic Preservation:
 *    - Preserves raw input and diagnostics without making canonical state decisions.
 */

export const TRIAGE_STAMP_HEADER = 'TRIAGE_STAMP_V1';

export interface TriageInput {
  rawResponseText: string;
  triageStamp?: string;
}

export interface TriageOutput {
  triageStamp: string;
  triageApplied: boolean;
  triageNotes: string[];
  rawResponseText: string;
  rawCandidatesBlock: string | null;
}

/**
 * Executes the Triage Gate pipeline on LLM #1 output.
 * Guarantees 1-shot execution via TRIAGE_STAMP check.
 * Extracts raw candidates block string without executing Recovery.
 */
export function runTriagePipeline(input: string | TriageInput): TriageOutput {
  const rawText = typeof input === 'string' ? input : input.rawResponseText;
  const existingStamp = typeof input === 'object' ? input.triageStamp : undefined;

  // 1-Shot Guard: If TRIAGE_STAMP is already present, bypass re-triage normalization
  if (existingStamp || rawText.includes(`/* ${TRIAGE_STAMP_HEADER}:`) || rawText.includes(`${TRIAGE_STAMP_HEADER}_`)) {
    const extractedStamp = existingStamp || extractStampFromText(rawText) || `${TRIAGE_STAMP_HEADER}_EXISTING`;
    const rawCandidatesBlock = extractCandidatesBlock(rawText);

    return {
      triageStamp: extractedStamp,
      triageApplied: false,
      triageNotes: ['Triage bypassed: TRIAGE_STAMP already present.'],
      rawResponseText: rawText,
      rawCandidatesBlock
    };
  }

  // Generate 1-shot TRIAGE_STAMP
  const stampId = `${TRIAGE_STAMP_HEADER}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const notes: string[] = [`TRIAGE_STAMP generated: ${stampId}`];

  // Extract Raw Candidates Block String (Recovery delegated entirely to candidateRecoveryGate.ts)
  const rawCandidatesBlock = extractCandidatesBlock(rawText);
  if (rawCandidatesBlock) {
    notes.push('Extracted raw candidates block string for downstream Candidate Recovery Gate.');
  } else {
    notes.push('No [CANDIDATES_BLOCK] tag found in input text.');
  }

  // Re-attach TRIAGE_STAMP marker to raw response text for diagnostic traceability
  const triagedRawText = `/* ${stampId} */\n${rawText}`;

  return {
    triageStamp: stampId,
    triageApplied: true,
    triageNotes: notes,
    rawResponseText: triagedRawText,
    rawCandidatesBlock
  };
}

export function extractStampFromText(text: string): string | null {
  const match = text.match(/TRIAGE_STAMP_V1_[A-Za-z0-9_]+/);
  return match ? match[0] : null;
}

export function extractCandidatesBlock(text: string): string | null {
  const match = text.match(/\[CANDIDATES_BLOCK\]([\s\S]*?)\[CANDIDATES_END\]/i);
  return match ? match[0] : null;
}
