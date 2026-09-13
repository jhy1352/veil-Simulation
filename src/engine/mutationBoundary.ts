import { StateTransitionProposal, TransitionAction } from './types';

export interface MutationBoundaryCheckResult {
  isValid: boolean;
  violationReasons: string[];
}

/**
 * Deep compares two values for structural and semantic equivalence within the boundary.
 */
function isSemanticSubsetEqual(candidateVal: any, finalVal: any): boolean {
  if (candidateVal === finalVal) return true;
  if (candidateVal == null && finalVal == null) return true;
  if (candidateVal == null || finalVal == null) return false;

  if (typeof candidateVal !== typeof finalVal) return false;

  if (Array.isArray(candidateVal)) {
    if (!Array.isArray(finalVal)) return false;
    if (candidateVal.length !== finalVal.length) return false;
    return candidateVal.every((item, idx) => isSemanticSubsetEqual(item, finalVal[idx]));
  }

  if (typeof candidateVal === 'object') {
    if (typeof finalVal !== 'object') return false;
    const finalKeys = Object.keys(finalVal);
    // Final object cannot contain arbitrary extra keys not in candidate
    for (const k of finalKeys) {
      if (!(k in candidateVal)) return false;
      if (!isSemanticSubsetEqual(candidateVal[k], finalVal[k])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Validates that a specific Final Action is a strict semantic subset of an Approved Candidate Action.
 */
function isActionSemanticSubset(candAction: TransitionAction, finalAction: TransitionAction, violationReasons: string[]): boolean {
  if (candAction.type !== finalAction.type) return false;

  const cPayload = (candAction.payload as any) || {};
  const fPayload = (finalAction.payload as any) || {};

  switch (finalAction.type) {
    case 'MODIFY_INVENTORY': {
      if (cPayload.operation !== fPayload.operation) {
        violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Inventory operation mismatch: candidate '${cPayload.operation}' vs final '${fPayload.operation}'.`);
        return false;
      }

      const cItem = cPayload.item || {};
      const fItem = fPayload.item || {};

      // ID check: if candidate specified an ID, final must match it exactly
      if (cItem.id && fItem.id && cItem.id !== fItem.id) {
        violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Item ID mismatch: candidate '${cItem.id}' vs final '${fItem.id}'.`);
        return false;
      }

      // Name check
      const cName = (cItem.name || '').trim().toLowerCase();
      const fName = (fItem.name || '').trim().toLowerCase();
      if (cName !== fName) {
        violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Item name mismatch: candidate '${cItem.name}' vs final '${fItem.name}'.`);
        return false;
      }

      // Quantity check: final quantity cannot exceed candidate quantity
      const cQty = cItem.quantity || 1;
      const fQty = fItem.quantity || 1;
      if (fQty > cQty) {
        violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Item quantity inflated: approved ${cQty}, requested ${fQty}.`);
        return false;
      }

      // Acquisition check for ADD operations
      if (fPayload.operation === 'ADD') {
        const cAcq = cPayload.acquisition || {};
        const fAcq = fPayload.acquisition || {};

        if (fAcq.cause && fAcq.cause !== cAcq.cause) {
          violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Acquisition cause mismatch: candidate '${cAcq.cause}' vs final '${fAcq.cause}'.`);
          return false;
        }

        if (fAcq.verifiedEventId && fAcq.verifiedEventId !== cAcq.verifiedEventId) {
          violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Acquisition verifiedEventId mismatch: candidate '${cAcq.verifiedEventId}' vs final '${fAcq.verifiedEventId}'.`);
          return false;
        }

        // Cost check (resource exchange)
        if (cAcq.cost || fAcq.cost) {
          if (!isSemanticSubsetEqual(cAcq.cost, fAcq.cost)) {
            violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Acquisition cost modified or omitted from approved candidate.`);
            return false;
          }
        }
      }

      // Check for arbitrary injected fields in inventory payload
      const knownInvKeys = new Set(['operation', 'item', 'acquisition', 'targetSlot', 'sourceInventoryId']);
      for (const k of Object.keys(fPayload)) {
        if (!knownInvKeys.has(k) && !(k in cPayload)) {
          violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Unauthorized property '${k}' injected into inventory payload.`);
          return false;
        }
      }
      return true;
    }

    case 'UPDATE_CHARACTER_STATS': {
      for (const [statKey, fVal] of Object.entries(fPayload)) {
        if (!(statKey in cPayload)) {
          violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Stat '${statKey}' was not present in candidate stat updates.`);
          return false;
        }
        if (fVal !== cPayload[statKey]) {
          violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Stat '${statKey}' value (${fVal}) differs from candidate value (${cPayload[statKey]}).`);
          return false;
        }
      }
      return true;
    }

    case 'SET_NPC_STATUS':
    case 'UPDATE_NPC':
    case 'ADD_NPC': {
      // Both ID and Name must be consistent if present
      if (cPayload.id && fPayload.id && cPayload.id !== fPayload.id) {
        violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] NPC ID mismatch: candidate '${cPayload.id}' vs final '${fPayload.id}'.`);
        return false;
      }
      if (cPayload.name && fPayload.name && (cPayload.name || '').trim().toLowerCase() !== (fPayload.name || '').trim().toLowerCase()) {
        violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] NPC name mismatch: candidate '${cPayload.name}' vs final '${fPayload.name}'.`);
        return false;
      }

      // Check all mutated fields (status, affinity, details, etc.)
      for (const [k, fVal] of Object.entries(fPayload)) {
        if (!(k in cPayload)) {
          violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] NPC property '${k}' was not authorized in candidate.`);
          return false;
        }
        if (!isSemanticSubsetEqual(cPayload[k], fVal)) {
          violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] NPC property '${k}' value was modified from candidate.`);
          return false;
        }
      }
      return true;
    }

    case 'ADD_NARRATIVE_SEED':
    case 'RESOLVE_NARRATIVE_SEED': {
      if (cPayload.id && fPayload.id && cPayload.id !== fPayload.id) {
        violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Narrative seed ID mismatch: candidate '${cPayload.id}' vs final '${fPayload.id}'.`);
        return false;
      }
      for (const [k, fVal] of Object.entries(fPayload)) {
        if (!(k in cPayload)) {
          violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Narrative seed property '${k}' was not in candidate.`);
          return false;
        }
        if (!isSemanticSubsetEqual(cPayload[k], fVal)) {
          violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Narrative seed property '${k}' differs from candidate.`);
          return false;
        }
      }
      return true;
    }

    case 'RECORD_OFFSCREEN_EVENT': {
      if ((cPayload.eventDescription || '').trim() !== (fPayload.eventDescription || '').trim()) {
        violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Offscreen event description mismatch.`);
        return false;
      }
      for (const [k, fVal] of Object.entries(fPayload)) {
        if (!(k in cPayload) || !isSemanticSubsetEqual(cPayload[k], fVal)) {
          violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Offscreen event property '${k}' mismatch.`);
          return false;
        }
      }
      return true;
    }

    case 'ADVANCE_CHAPTER': {
      if (cPayload.currentChapter !== fPayload.currentChapter) {
        violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Chapter advancement '${fPayload.currentChapter}' does not match candidate '${cPayload.currentChapter}'.`);
        return false;
      }
      return true;
    }

    case 'ADD_RUMOR': {
      if ((cPayload.rumor || cPayload.content || '').trim() !== (fPayload.rumor || fPayload.content || '').trim()) {
        violationReasons.push(`[MUTATION_BOUNDARY_VIOLATION] Rumor content mismatch.`);
        return false;
      }
      return true;
    }

    default: {
      // Default: Strict semantic equality for all other action types
      return isSemanticSubsetEqual(cPayload, fPayload);
    }
  }
}

/**
 * Validates that LLM #2's final StateTransitionProposal strictly adheres to the scope
 * of the selected Pre-Auth ALLOW Candidate Proposal.
 *
 * Enforces the VEIL Mathematical Contract:
 * FinalProposal.Mutations ⊆ ApprovedCandidate.Mutations
 *
 * 1. Final proposal action count must be <= approved candidate action count (Cardinality).
 * 2. Each final action must match a distinct, unused approved candidate action (1-to-1 matching).
 * 3. Deep structural and semantic subset validation prevents any unapproved property injection,
 *    quantity inflation, ID tampering, or state mutation sneaking.
 */
export function validateLLM2MutationBoundary(
  approvedCandidateProposal: StateTransitionProposal,
  finalProposal: StateTransitionProposal
): MutationBoundaryCheckResult {
  const violationReasons: string[] = [];

  const candidateActions = approvedCandidateProposal.actions || [];
  const finalActions = finalProposal.actions || [];

  // Cardinality check: Final actions cannot exceed candidate actions
  if (finalActions.length > candidateActions.length) {
    violationReasons.push(
      `[MUTATION_BOUNDARY_VIOLATION] Final proposal contains ${finalActions.length} actions, exceeding approved candidate action count (${candidateActions.length}).`
    );
    return {
      isValid: false,
      violationReasons
    };
  }

  // 1-to-1 matching with unused candidate action tracking
  const usedCandidateIndices = new Set<number>();

  for (let fIdx = 0; fIdx < finalActions.length; fIdx++) {
    const fAction = finalActions[fIdx];
    let matchedIndex = -1;
    let localViolations: string[] = [];

    for (let cIdx = 0; cIdx < candidateActions.length; cIdx++) {
      if (usedCandidateIndices.has(cIdx)) continue;
      const cAction = candidateActions[cIdx];
      const attemptViolations: string[] = [];

      if (isActionSemanticSubset(cAction, fAction, attemptViolations)) {
        matchedIndex = cIdx;
        break;
      } else {
        localViolations = attemptViolations;
      }
    }

    if (matchedIndex !== -1) {
      usedCandidateIndices.add(matchedIndex);
    } else {
      violationReasons.push(
        `[MUTATION_BOUNDARY_VIOLATION] Action #${fIdx + 1} (${fAction.type}) is not authorized in approved candidate. Details: ${localViolations.join('; ') || 'No matching unused candidate action found.'}`
      );
    }
  }

  return {
    isValid: violationReasons.length === 0,
    violationReasons
  };
}
