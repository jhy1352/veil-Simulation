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
 * 2. Structural Integrity & Default Normalization:
 *    - Default modality="NONE" for semantic events / candidate actions if omitted.
 *    - Normalizes LLM claiming "CANONICAL" to "CLAIM" for downstream Sovereign Engine evaluation.
 *    - Ensures structural non-null rawMetadata and valid candidateId (1..5).
 * 3. Non-Canonical Authority:
 *    - Never invents new facts, entities, causes, consequences, or relationships.
 *    - Never mutates Canonical State directly.
 * 4. Dual Channel Support:
 *    - Normalizes both Candidate list and Zero-Mutation Narrative through Triage.
 */

import { parseCandidatesBlock, VeilCandidate } from './candidateRecoveryGate.ts';

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
  zeroMutationNarrative: string;
  rawCandidates: VeilCandidate[] | null;
}

const DETERMINISTIC_NON_MUTATION_FALLBACK =
  '선언한 행동을 시도하였으나, 즉각적인 세계 상태의 변화는 발생하지 않았다. 침묵과 정적 속에서 주변 상황을 다시 관찰할 수 있다.';

/**
 * Executes the Triage Gate pipeline on LLM #1 output.
 * Guarantees 1-shot execution via TRIAGE_STAMP check.
 * Delegates candidate parsing & candidateId assignment to candidateRecoveryGate's single parser authority.
 */
export function runTriagePipeline(input: string | TriageInput): TriageOutput {
  const rawText = typeof input === 'string' ? input : input.rawResponseText;
  const existingStamp = typeof input === 'object' ? input.triageStamp : undefined;

  // 1-Shot Guard: If TRIAGE_STAMP is already present, bypass re-triage normalization
  if (existingStamp || rawText.includes(`/* ${TRIAGE_STAMP_HEADER}:`) || rawText.includes(`${TRIAGE_STAMP_HEADER}_`)) {
    const extractedStamp = existingStamp || extractStampFromText(rawText) || `${TRIAGE_STAMP_HEADER}_EXISTING`;
    const zeroMutationNarrative = extractZeroMutationNarrative(rawText);
    const rawCandidates = parseCandidatesBlock(rawText);

    return {
      triageStamp: extractedStamp,
      triageApplied: false,
      triageNotes: ['Triage bypassed: TRIAGE_STAMP already present.'],
      rawResponseText: rawText,
      zeroMutationNarrative,
      rawCandidates
    };
  }

  // Generate 1-shot TRIAGE_STAMP
  const stampId = `${TRIAGE_STAMP_HEADER}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const notes: string[] = [`TRIAGE_STAMP generated: ${stampId}`];

  // 1. Triage Zero-Mutation Narrative
  const zeroMutationNarrative = extractZeroMutationNarrative(rawText);

  // 2. Parse candidates using candidateRecoveryGate's single authoritative parser (supports recoverSyntaxAndParseJson)
  const parsedCandidates = parseCandidatesBlock(rawText);

  // 3. Perform Triage Semantic Normalization (modality=NONE, scope CANONICAL->CLAIM)
  // Preserves candidateId assigned by parseCandidatesBlock without overriding.
  const rawCandidates = parsedCandidates ? normalizeCandidateSemantics(parsedCandidates, notes) : null;

  // Re-attach TRIAGE_STAMP marker to raw response text for diagnostic traceability
  const triagedRawText = `/* ${stampId} */\n${rawText}`;

  return {
    triageStamp: stampId,
    triageApplied: true,
    triageNotes: notes,
    rawResponseText: triagedRawText,
    zeroMutationNarrative,
    rawCandidates
  };
}

function extractStampFromText(text: string): string | null {
  const match = text.match(/TRIAGE_STAMP_V1_[A-Za-z0-9_]+/);
  return match ? match[0] : null;
}

function extractZeroMutationNarrative(text: string): string {
  const zeroMatch = text.match(/\[ZERO_MUTATION_NARRATIVE\]([\s\S]*?)\[ZERO_MUTATION_END\]/i);
  if (zeroMatch && zeroMatch[1].trim()) {
    return zeroMatch[1].trim();
  }
  return DETERMINISTIC_NON_MUTATION_FALLBACK;
}

/**
 * Applies semantic normalization to candidates parsed by parseCandidatesBlock:
 * - Preserves existing candidateId assigned by parseCandidatesBlock authority
 * - Defaults missing modality to "NONE"
 * - Normalizes scope="CANONICAL" to "CLAIM" for downstream Engine evaluation
 * - Does not invent new entities, facts, or candidate IDs
 */
function normalizeCandidateSemantics(candidates: VeilCandidate[], notes: string[]): VeilCandidate[] {
  return candidates.map((candidate) => {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      return candidate;
    }

    let semanticEvents = candidate.semanticEvents;
    if (Array.isArray(semanticEvents)) {
      semanticEvents = semanticEvents.map((ev: any) => {
        if (typeof ev === 'object' && ev !== null) {
          const modality = ev.modality ? String(ev.modality).toUpperCase() : 'NONE';
          const scope = ev.scope === 'CANONICAL' ? 'CLAIM' : ev.scope;
          return {
            ...ev,
            modality,
            scope: scope || ev.scope
          };
        }
        return ev;
      });
      notes.push(`Candidate ${candidate.candidateId}: normalized ${semanticEvents.length} semanticEvents (modality=NONE, scope=CLAIM)`);
    }

    let rawMetadata = candidate.rawMetadata;
    if (typeof rawMetadata === 'object' && rawMetadata !== null && !Array.isArray(rawMetadata)) {
      if (Array.isArray(rawMetadata.semanticEvents)) {
        rawMetadata = {
          ...rawMetadata,
          semanticEvents: rawMetadata.semanticEvents.map((ev: any) => {
            if (typeof ev === 'object' && ev !== null) {
              const modality = ev.modality ? String(ev.modality).toUpperCase() : 'NONE';
              const scope = ev.scope === 'CANONICAL' ? 'CLAIM' : ev.scope;
              return {
                ...ev,
                modality,
                scope: scope || ev.scope
              };
            }
            return ev;
          })
        };
      }
    } else if (rawMetadata === undefined) {
      rawMetadata = {};
    }

    return {
      ...candidate,
      semanticEvents,
      rawMetadata
    };
  });
}
