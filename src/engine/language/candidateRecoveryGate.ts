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
  semanticEvents?: any[];
  rawMetadata: any;
  preAuthStatus?: 'ALLOW' | 'REJECT';
  preAuthReasons?: string[];
}

let recoveryCallCount = 0;

export function getRecoveryCallCount(): number {
  return recoveryCallCount;
}

export function resetRecoveryCallCount(): void {
  recoveryCallCount = 0;
}

export function parseCandidatesBlock(text: string): VeilCandidate[] | null {
  const blockMatch = text.match(/\[CANDIDATES_BLOCK\]([\s\S]*?)\[CANDIDATES_END\]/i);
  const jsonStr = blockMatch ? blockMatch[1].trim() : text.trim();

  const recovered = recoverSyntaxAndParseJson<any>(jsonStr);
  if (!recovered.success || !recovered.data) return null;

  const parsed = recovered.data;
  let rawList: any[] | null = null;
  if (Array.isArray(parsed)) rawList = parsed;
  else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.candidates)) {
    rawList = parsed.candidates;
  }
  if (!rawList) return null;

  // Parser Authority (B-Design): Assign canonical sequential candidateId (1..N) based on array order.
  // LLM output candidateId is untrusted and ignored. Candidate payloads (label, narrativeSummary, rawMetadata) are preserved.
  return rawList.map((item, idx) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return item;
    }

    const candidateId = idx + 1;

    return {
      ...item,
      candidateId
    };
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

/**
 * Official Allow-list of External Candidate rawMetadata Keys.
 * Exactly these 9 fields are permitted in external candidate generation.
 * Any other field is an UNKNOWN_FIELD violation.
 */
export const ALLOWED_EXTERNAL_RAW_METADATA_KEYS: ReadonlySet<string> = new Set([
  'foreshadowSeeds',
  'resolvedSeeds',
  'cameraOffscreenEvents',
  'newNpcs',
  'newFactions',
  'inventoryChanges',
  'statDeltas',
  'characterChanges',
  'chapterChanges'
]);

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

  // Prohibit top-level engine-owned fields from LLM
  if ((candidate as any).resolvedEntityId !== undefined) {
    reasons.push('candidate.resolvedEntityId is engine-owned and strictly prohibited in LLM candidate output');
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

  // 4.5 semanticEvents must be an array when provided
  if (candidate.semanticEvents !== undefined && !Array.isArray(candidate.semanticEvents)) {
    reasons.push(`semanticEvents must be an array when provided (got ${typeof candidate.semanticEvents})`);
  }

  // 5. rawMetadata must be a non-null, non-array object
  if (typeof candidate.rawMetadata !== 'object' || candidate.rawMetadata === null || Array.isArray(candidate.rawMetadata)) {
    reasons.push(`rawMetadata must be a non-null, non-array object (got ${candidate.rawMetadata === null ? 'null' : Array.isArray(candidate.rawMetadata) ? 'array' : typeof candidate.rawMetadata})`);
  } else {
    // 5-0. External Allow-list Firewall (Article 2 / Rule 1-2):
    // Strictly reject any key not in the official 9 external fields
    const rawKeys = Object.keys(candidate.rawMetadata);
    for (const key of rawKeys) {
      if (!ALLOWED_EXTERNAL_RAW_METADATA_KEYS.has(key)) {
        reasons.push(`rawMetadata contains unauthorized external field '${key}' (UNKNOWN_FIELD violation)`);
      }
    }

    // 5-1. foreshadowSeeds
    if (candidate.rawMetadata.foreshadowSeeds !== undefined) {
      if (!Array.isArray(candidate.rawMetadata.foreshadowSeeds)) {
        reasons.push('rawMetadata.foreshadowSeeds must be an array');
      } else {
        for (let i = 0; i < candidate.rawMetadata.foreshadowSeeds.length; i++) {
          const seed = candidate.rawMetadata.foreshadowSeeds[i];
          if (typeof seed !== 'string' || seed.trim().length === 0) {
            reasons.push(`foreshadowSeeds[${i}] must be a non-empty string`);
          }
        }
      }
    }

    // 5-2. resolvedSeeds
    if (candidate.rawMetadata.resolvedSeeds !== undefined) {
      if (!Array.isArray(candidate.rawMetadata.resolvedSeeds)) {
        reasons.push('rawMetadata.resolvedSeeds must be an array');
      } else {
        for (let i = 0; i < candidate.rawMetadata.resolvedSeeds.length; i++) {
          const res = candidate.rawMetadata.resolvedSeeds[i];
          if (typeof res !== 'object' || res === null || Array.isArray(res)) {
            reasons.push(`resolvedSeeds[${i}] must be a non-null object`);
            continue;
          }
          if (typeof res.content !== 'string' || res.content.trim().length === 0) {
            reasons.push(`resolvedSeeds[${i}].content must be a non-empty string`);
          }
          if (res.resolutionSummary !== undefined && typeof res.resolutionSummary !== 'string') {
            reasons.push(`resolvedSeeds[${i}].resolutionSummary must be a string when provided`);
          }
          if (res.resolvedEntityId !== undefined) {
            reasons.push(`resolvedSeeds[${i}].resolvedEntityId is engine-owned and must not be supplied by LLM`);
          }
          const ref = res.entityReference;
          if (ref !== undefined) {
            if (typeof ref !== 'object' || ref === null || Array.isArray(ref)) {
              reasons.push(`resolvedSeeds[${i}].entityReference must be a non-null object`);
            } else {
              if (ref.entityType !== undefined && ref.entityType !== 'NARRATIVE_SEED') {
                reasons.push(`resolvedSeeds[${i}].entityReference.entityType must be NARRATIVE_SEED`);
              }
              if (ref.claimedEntityId !== undefined && !isNonEmptyString(ref.claimedEntityId)) {
                reasons.push(`resolvedSeeds[${i}].entityReference.claimedEntityId must be a non-empty string when provided`);
              }
              if (ref.resolvedEntityId !== undefined) {
                reasons.push(`resolvedSeeds[${i}].entityReference.resolvedEntityId is engine-owned and must not be supplied by LLM`);
              }
            }
          }
        }
      }
    }

    // 5-3. cameraOffscreenEvents
    if (candidate.rawMetadata.cameraOffscreenEvents !== undefined) {
      if (!Array.isArray(candidate.rawMetadata.cameraOffscreenEvents)) {
        reasons.push('rawMetadata.cameraOffscreenEvents must be an array');
      } else {
        for (let i = 0; i < candidate.rawMetadata.cameraOffscreenEvents.length; i++) {
          const ev = candidate.rawMetadata.cameraOffscreenEvents[i];
          if (typeof ev !== 'string' || ev.trim().length === 0) {
            reasons.push(`cameraOffscreenEvents[${i}] must be a non-empty string`);
          }
        }
      }
    }

    // 5-4. newNpcs
    if (candidate.rawMetadata.newNpcs !== undefined) {
      if (!Array.isArray(candidate.rawMetadata.newNpcs)) {
        reasons.push('rawMetadata.newNpcs must be an array');
      } else {
        for (let i = 0; i < candidate.rawMetadata.newNpcs.length; i++) {
          const npc = candidate.rawMetadata.newNpcs[i];
          if (typeof npc !== 'object' || npc === null || Array.isArray(npc)) {
            reasons.push(`newNpcs[${i}] must be a non-null object`);
            continue;
          }
          if (typeof npc.name !== 'string' || npc.name.trim().length === 0) {
            reasons.push(`newNpcs[${i}].name must be a non-empty string`);
          }
          if (npc.alias !== undefined && typeof npc.alias !== 'string') {
            reasons.push(`newNpcs[${i}].alias must be a string when provided`);
          }
          if (npc.npcClass !== undefined && typeof npc.npcClass !== 'string') {
            reasons.push(`newNpcs[${i}].npcClass must be a string when provided`);
          }
          if (npc.innerThought !== undefined && typeof npc.innerThought !== 'string') {
            reasons.push(`newNpcs[${i}].innerThought must be a string when provided`);
          }
          if (npc.metInStory !== undefined && typeof npc.metInStory !== 'boolean') {
            reasons.push(`newNpcs[${i}].metInStory must be a boolean when provided`);
          }
          if (npc.isDead !== undefined && typeof npc.isDead !== 'boolean') {
            reasons.push(`newNpcs[${i}].isDead must be a boolean when provided`);
          }
          if (npc.origin !== undefined && typeof npc.origin !== 'string') {
            reasons.push(`newNpcs[${i}].origin must be a string when provided`);
          }
          if (npc.background !== undefined && typeof npc.background !== 'string') {
            reasons.push(`newNpcs[${i}].background must be a string when provided`);
          }
          if (npc.martialArts !== undefined && typeof npc.martialArts !== 'string') {
            reasons.push(`newNpcs[${i}].martialArts must be a string when provided`);
          }
          if (npc.values !== undefined && typeof npc.values !== 'string') {
            reasons.push(`newNpcs[${i}].values must be a string when provided`);
          }
          if (npc.affiliation !== undefined && typeof npc.affiliation !== 'string') {
            reasons.push(`newNpcs[${i}].affiliation must be a string when provided`);
          }
          if (npc.resolvedEntityId !== undefined) {
            reasons.push(`newNpcs[${i}].resolvedEntityId is engine-owned and must not be supplied by LLM`);
          }
          const ref = npc.entityReference;
          if (ref !== undefined) {
            if (typeof ref !== 'object' || ref === null || Array.isArray(ref)) {
              reasons.push(`newNpcs[${i}].entityReference must be a non-null object`);
            } else {
              if (ref.entityType !== undefined && ref.entityType !== 'NPC') {
                reasons.push(`newNpcs[${i}].entityReference.entityType must be NPC`);
              }
              if (ref.claimedEntityId !== undefined && !isNonEmptyString(ref.claimedEntityId)) {
                reasons.push(`newNpcs[${i}].entityReference.claimedEntityId must be a non-empty string when provided`);
              }
              if (ref.resolvedEntityId !== undefined) {
                reasons.push(`newNpcs[${i}].entityReference.resolvedEntityId is engine-owned and must not be supplied by LLM`);
              }
            }
          }
        }
      }
    }

    // 5-5. newFactions
    if (candidate.rawMetadata.newFactions !== undefined) {
      if (!Array.isArray(candidate.rawMetadata.newFactions)) {
        reasons.push('rawMetadata.newFactions must be an array');
      } else {
        for (let i = 0; i < candidate.rawMetadata.newFactions.length; i++) {
          const fac = candidate.rawMetadata.newFactions[i];
          if (typeof fac !== 'object' || fac === null || Array.isArray(fac)) {
            reasons.push(`newFactions[${i}] must be a non-null object`);
            continue;
          }
          if (typeof fac.name !== 'string' || fac.name.trim().length === 0) {
            reasons.push(`newFactions[${i}].name must be a non-empty string`);
          }
          if (fac.description !== undefined && typeof fac.description !== 'string') {
            reasons.push(`newFactions[${i}].description must be a string when provided`);
          }
          if (fac.attitudeTowardsPlayer !== undefined && typeof fac.attitudeTowardsPlayer !== 'string') {
            reasons.push(`newFactions[${i}].attitudeTowardsPlayer must be a string when provided`);
          }
          if (fac.resolvedEntityId !== undefined) {
            reasons.push(`newFactions[${i}].resolvedEntityId is engine-owned and must not be supplied by LLM`);
          }
          const ref = fac.entityReference;
          if (ref !== undefined) {
            if (typeof ref !== 'object' || ref === null || Array.isArray(ref)) {
              reasons.push(`newFactions[${i}].entityReference must be a non-null object`);
            } else {
              if (ref.entityType !== undefined && ref.entityType !== 'FACTION') {
                reasons.push(`newFactions[${i}].entityReference.entityType must be FACTION`);
              }
              if (ref.claimedEntityId !== undefined && !isNonEmptyString(ref.claimedEntityId)) {
                reasons.push(`newFactions[${i}].entityReference.claimedEntityId must be a non-empty string when provided`);
              }
              if (ref.resolvedEntityId !== undefined) {
                reasons.push(`newFactions[${i}].entityReference.resolvedEntityId is engine-owned and must not be supplied by LLM`);
              }
            }
          }
        }
      }
    }

    // 5-6. inventoryChanges
    if (candidate.rawMetadata.inventoryChanges !== undefined) {
      if (!Array.isArray(candidate.rawMetadata.inventoryChanges)) {
        reasons.push('rawMetadata.inventoryChanges must be an array');
      } else {
        for (let i = 0; i < candidate.rawMetadata.inventoryChanges.length; i++) {
          const inv = candidate.rawMetadata.inventoryChanges[i];
          if (typeof inv !== 'object' || inv === null || Array.isArray(inv)) {
            reasons.push(`inventoryChanges[${i}] must be a non-null object`);
            continue;
          }
          if (!isNonEmptyString(inv.name)) {
            reasons.push(`inventoryChanges[${i}].name must be a non-empty string`);
          }
          if (inv.quantity !== undefined) {
            if (typeof inv.quantity !== 'number' || !Number.isFinite(inv.quantity) || inv.quantity <= 0) {
              reasons.push(`inventoryChanges[${i}].quantity must be a positive finite number`);
            }
          }
          if (inv.action !== undefined && inv.action !== 'add' && inv.action !== 'remove') {
            reasons.push(`inventoryChanges[${i}].action must be 'add' or 'remove'`);
          }
          if (inv.resolvedEntityId !== undefined) {
            reasons.push(`inventoryChanges[${i}].resolvedEntityId is engine-owned and must not be supplied by LLM`);
          }
          if (inv.cause !== undefined && typeof inv.cause !== 'string') {
            reasons.push(`inventoryChanges[${i}].cause must be a string when provided`);
          }
          if (inv.verifiedEventId !== undefined && typeof inv.verifiedEventId !== 'string') {
            reasons.push(`inventoryChanges[${i}].verifiedEventId must be a string when provided`);
          }
          if (inv.cost !== undefined) {
            if (typeof inv.cost !== 'object' || inv.cost === null || Array.isArray(inv.cost)) {
              reasons.push(`inventoryChanges[${i}].cost must be an object when provided`);
            }
          }
          const ref = inv.entityReference;
          if (ref !== undefined) {
            if (typeof ref !== 'object' || ref === null || Array.isArray(ref)) {
              reasons.push(`inventoryChanges[${i}].entityReference must be a non-null object`);
            } else {
              if (ref.entityType !== undefined && ref.entityType !== 'ITEM') {
                reasons.push(`inventoryChanges[${i}].entityReference.entityType must be ITEM`);
              }
              if (ref.claimedEntityId !== undefined && !isNonEmptyString(ref.claimedEntityId)) {
                reasons.push(`inventoryChanges[${i}].entityReference.claimedEntityId must be a non-empty string when provided`);
              }
              if (ref.resolvedEntityId !== undefined) {
                reasons.push(`inventoryChanges[${i}].entityReference.resolvedEntityId is engine-owned and must not be supplied by LLM`);
              }
              if (ref.evidence !== undefined) {
                if (typeof ref.evidence !== 'object' || ref.evidence === null || Array.isArray(ref.evidence)) {
                  reasons.push(`inventoryChanges[${i}].entityReference.evidence must be a non-null object`);
                }
              }
            }
          }
        }
      }
    }

    // 5-7. statDeltas
    if (candidate.rawMetadata.statDeltas !== undefined) {
      if (!Array.isArray(candidate.rawMetadata.statDeltas)) {
        reasons.push('rawMetadata.statDeltas must be an array');
      } else {
        for (let i = 0; i < candidate.rawMetadata.statDeltas.length; i++) {
          const sd = candidate.rawMetadata.statDeltas[i];
          if (typeof sd !== 'object' || sd === null || Array.isArray(sd)) {
            reasons.push(`statDeltas[${i}] must be a non-null object`);
            continue;
          }
          if (typeof sd.stat !== 'string' || sd.stat.trim().length === 0) {
            reasons.push(`statDeltas[${i}].stat must be a non-empty string`);
          }
          if (typeof sd.delta !== 'number' || !Number.isFinite(sd.delta)) {
            reasons.push(`statDeltas[${i}].delta must be a finite number`);
          }
        }
      }
    }

    // 5-8. characterChanges
    if (candidate.rawMetadata.characterChanges !== undefined) {
      const char = candidate.rawMetadata.characterChanges;
      if (typeof char !== 'object' || char === null || Array.isArray(char)) {
        reasons.push('rawMetadata.characterChanges must be a non-null object');
      } else {
        if (char.alias !== undefined && typeof char.alias !== 'string') {
          reasons.push('characterChanges.alias must be a string when provided');
        }
        if (char.name !== undefined && typeof char.name !== 'string') {
          reasons.push('characterChanges.name must be a string when provided');
        }
        if (char.background !== undefined && typeof char.background !== 'string') {
          reasons.push('characterChanges.background must be a string when provided');
        }
        if (char.martialArts !== undefined && typeof char.martialArts !== 'string') {
          reasons.push('characterChanges.martialArts must be a string when provided');
        }
        if (char.resolvedEntityId !== undefined) {
          reasons.push('characterChanges.resolvedEntityId is engine-owned and must not be supplied by LLM');
        }
        const ref = char.entityReference;
        if (ref !== undefined) {
          if (typeof ref !== 'object' || ref === null || Array.isArray(ref)) {
            reasons.push('characterChanges.entityReference must be a non-null object when provided');
          } else {
            if (ref.entityType !== undefined && ref.entityType !== 'CHARACTER') {
              reasons.push('characterChanges.entityReference.entityType must be CHARACTER');
            }
            if (ref.claimedEntityId !== undefined && !isNonEmptyString(ref.claimedEntityId)) {
              reasons.push('characterChanges.entityReference.claimedEntityId must be a non-empty string when provided');
            }
            if (ref.resolvedEntityId !== undefined) {
              reasons.push('characterChanges.entityReference.resolvedEntityId is engine-owned and must not be supplied by LLM');
            }
          }
        }
      }
    }

    // 5-9. chapterChanges
    if (candidate.rawMetadata.chapterChanges !== undefined) {
      const chap = candidate.rawMetadata.chapterChanges;
      if (typeof chap !== 'object' || chap === null || Array.isArray(chap)) {
        reasons.push('rawMetadata.chapterChanges must be a non-null object');
      } else {
        if (chap.currentChapter !== undefined && typeof chap.currentChapter !== 'string') {
          reasons.push('chapterChanges.currentChapter must be a string when provided');
        }
        if (chap.upcomingChapters !== undefined) {
          if (!Array.isArray(chap.upcomingChapters)) {
            reasons.push('chapterChanges.upcomingChapters must be an array when provided');
          } else {
            for (let i = 0; i < chap.upcomingChapters.length; i++) {
              const up = chap.upcomingChapters[i];
              if (typeof up !== 'string') {
                reasons.push(`chapterChanges.upcomingChapters[${i}] must be a string`);
              }
            }
          }
        }
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
export function runCandidateRecoveryGate<T = any>(input: any): CandidateRecoveryGateResult<T> {
  recoveryCallCount++;

  let rawCandidates: any[] | null = null;
  if (typeof input === 'string') {
    rawCandidates = parseCandidatesBlock(input);
  } else if (Array.isArray(input)) {
    rawCandidates = input;
  }

  // If rawCandidates is not an array, fail-closed
  if (!Array.isArray(rawCandidates)) {
    return {
      passedCandidates: [],
      quarantinedCandidates: [
        {
          index: 0,
          candidate: input,
          reasons: [`Expected candidate list or parseable candidate block string, received ${input === null ? 'null' : typeof input}`]
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
