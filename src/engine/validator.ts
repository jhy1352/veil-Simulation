import { StateTransitionProposal, ValidationVerdict, CanonicalState, TransitionAction, ProposalSource, ActionType, ImmutableHistoricalRecord, VerifiedClaim } from './types';
import { isEngineAuthorized } from './internalCapability';
import { WorldInfo, Character, NarrativeTime } from '../types';
import { deepClone, applyActionToDraftState } from './actionApplier';
import { ImmigrationGate } from './immigrationGate';
import { checkMeaningTreeProjectionConsistency } from './language/runtimeProjection';

const ALLOWED_STAT_KEYS = new Set(['strength', 'agility', 'constitution', 'intelligence', 'wisdom', 'charisma']);
const ALLOWED_VISIBILITY = new Set(['PUBLIC', 'FACTION_ONLY', 'PRIVATE', 'HIDDEN', 'RUMOR']);

/**
 * Checks if a valid VerifiedClaim exists in the proposal matching targetEntityId, targetAttribute, and optional expectedValue.
 * Strict Invariants:
 * - Wildcard ('*') or generic existence ('EXISTENCE') claims NEVER bind to specific attribute mutations.
 * - Exact targetEntityId match (case-insensitive normalized).
 * - Exact targetAttribute match (case-insensitive normalized).
 * - Exact value match (if expectedValue is provided).
 */
export function hasMatchingVerifiedClaim(
  verifiedClaims: readonly VerifiedClaim[] | undefined,
  targetEntityId: string,
  targetAttribute: string,
  expectedValue?: any,
  alternativeEntityId?: string
): boolean {
  if (!verifiedClaims || !Array.isArray(verifiedClaims) || verifiedClaims.length === 0) {
    return false;
  }

  const cleanEntityId = targetEntityId.trim().toLowerCase();
  const cleanAltEntityId = alternativeEntityId ? alternativeEntityId.trim().toLowerCase() : undefined;
  const cleanAttr = targetAttribute.trim().toLowerCase();

  // Wildcard and generic existence attributes cannot bind to specific attribute mutations
  if (cleanAttr === '*' || cleanAttr === 'existence') {
    return false;
  }

  for (const claim of verifiedClaims) {
    if (!ImmigrationGate.isValidVerifiedClaim(claim)) {
      continue;
    }

    const claimEntity = claim.targetEntityId.trim().toLowerCase();
    const claimAttr = claim.targetAttribute.trim().toLowerCase();

    // Wildcard '*' or 'EXISTENCE' in claim NEVER binds to specific attribute mutations
    if (claimAttr === '*' || claimAttr === 'existence') {
      continue;
    }

    // Exact entity match
    const entityMatches = claimEntity === cleanEntityId || (cleanAltEntityId !== undefined && claimEntity === cleanAltEntityId);
    if (!entityMatches) {
      continue;
    }

    // Exact attribute match
    if (claimAttr !== cleanAttr) {
      continue;
    }

    // Exact value match (if expectedValue specified)
    if (expectedValue !== undefined) {
      if (claim.verifiedValue === undefined) {
        continue;
      }
      if (typeof expectedValue === 'object' && expectedValue !== null) {
        if (JSON.stringify(claim.verifiedValue) !== JSON.stringify(expectedValue)) {
          continue;
        }
      } else {
        if (claim.verifiedValue !== expectedValue) {
          continue;
        }
      }
    }

    return true;
  }

  return false;
}

const SOURCE_ACTION_ACL: Record<ProposalSource, ReadonlySet<ActionType>> = {
  LLM: new Set<ActionType>([
    'SET_WORLD_METADATA',
    'ADVANCE_TIME',
    'ADD_RUMOR',
    'ADD_NPC',
    'UPDATE_NPC',
    'SET_NPC_STATUS',
    'ADD_FACTION',
    'UPDATE_FACTION',
    'ADD_NARRATIVE_SEED',
    'RESOLVE_NARRATIVE_SEED',
    'ADVANCE_CHAPTER',
    'RECORD_OFFSCREEN_EVENT',
    'UPDATE_CHARACTER_STATS',
    'MODIFY_INVENTORY',
    'SET_CHARACTER_SECRET'
  ]),
  PLAYER: new Set<ActionType>([
    'RECORD_DICE_RESULT',
    'OVERWRITE_CHARACTER',
    'MODIFY_INVENTORY',
    'UPDATE_CHARACTER_STATS',
    'SET_NPC_STATUS',
    'UPDATE_NPC',
    'RECORD_PHYSICAL_DEFECT',
    'SET_CHARACTER_SECRET',
    'ADD_RUMOR',
    'SET_WORLD_METADATA'
  ]),
  GENESIS: new Set<ActionType>([
    'OVERWRITE_WORLD_INFO',
    'OVERWRITE_CHARACTER',
    'SET_WORLD_METADATA',
    'ADD_NPC',
    'ADD_FACTION',
    'ADD_NARRATIVE_SEED',
    'ADVANCE_CHAPTER',
    'ADVANCE_TIME',
    'UPDATE_CHARACTER_STATS',
    'MODIFY_INVENTORY',
    'SET_CHARACTER_SECRET',
    'RECORD_PHYSICAL_DEFECT',
    'RECORD_DICE_RESULT'
  ]),
  SYSTEM: new Set<ActionType>([
    'SET_WORLD_METADATA',
    'ADVANCE_TIME',
    'ADD_RUMOR',
    'ADD_NPC',
    'UPDATE_NPC',
    'SET_NPC_STATUS',
    'ADD_FACTION',
    'UPDATE_FACTION',
    'ADD_NARRATIVE_SEED',
    'RESOLVE_NARRATIVE_SEED',
    'ADVANCE_CHAPTER',
    'RECORD_OFFSCREEN_EVENT',
    'UPDATE_CHARACTER_STATS',
    'MODIFY_INVENTORY',
    'SET_CHARACTER_SECRET',
    'RECORD_PHYSICAL_DEFECT',
    'RECORD_DICE_RESULT',
    'OVERWRITE_WORLD_INFO',
    'OVERWRITE_CHARACTER'
  ]),
  ENGINE_INTERNAL: new Set<ActionType>([
    'SET_WORLD_METADATA',
    'ADVANCE_TIME',
    'ADD_RUMOR',
    'ADD_NPC',
    'UPDATE_NPC',
    'SET_NPC_STATUS',
    'ADD_FACTION',
    'UPDATE_FACTION',
    'ADD_NARRATIVE_SEED',
    'RESOLVE_NARRATIVE_SEED',
    'ADVANCE_CHAPTER',
    'RECORD_OFFSCREEN_EVENT',
    'UPDATE_CHARACTER_STATS',
    'MODIFY_INVENTORY',
    'SET_CHARACTER_SECRET',
    'RECORD_PHYSICAL_DEFECT',
    'RECORD_DICE_RESULT',
    'OVERWRITE_WORLD_INFO',
    'OVERWRITE_CHARACTER'
  ]),
  SAVE_HYDRATION: new Set<ActionType>([
    'OVERWRITE_WORLD_INFO',
    'OVERWRITE_CHARACTER',
    'SET_WORLD_METADATA',
    'ADVANCE_TIME',
    'ADD_NPC',
    'ADD_FACTION',
    'ADD_NARRATIVE_SEED',
    'ADVANCE_CHAPTER'
  ]),
  CLOUD_RESTORE: new Set<ActionType>([
    'OVERWRITE_WORLD_INFO',
    'OVERWRITE_CHARACTER',
    'SET_WORLD_METADATA',
    'ADVANCE_TIME',
    'ADD_NPC',
    'ADD_FACTION',
    'ADD_NARRATIVE_SEED',
    'ADVANCE_CHAPTER'
  ])
};

const SEASON_ORDER: Record<string, number> = {
  SPRING: 1,
  SUMMER: 2,
  AUTUMN: 3,
  WINTER: 4
};

const TIME_OF_DAY_ORDER: Record<string, number> = {
  DAWN: 1,
  MORNING: 2,
  NOON: 3,
  AFTERNOON: 4,
  DUSK: 5,
  NIGHT: 6,
  MIDNIGHT: 7
};

/**
 * Checks if targetTime is chronologically earlier than currentTime.
 */
function isTemporalRegression(target: NarrativeTime, current: NarrativeTime): boolean {
  if (typeof target.year !== 'number' || !Number.isFinite(target.year) || target.year < 0) return true;
  if (target.year < current.year) return true;
  if (target.year > current.year) return false;

  // Year is identical
  // 1. Season comparison
  if (target.season !== undefined && current.season !== undefined) {
    const targetSeason = SEASON_ORDER[target.season] || 0;
    const currentSeason = SEASON_ORDER[current.season] || 0;
    if (targetSeason < currentSeason) return true;
    if (targetSeason > currentSeason) return false;
  }

  // 2. Month comparison
  if (target.month !== undefined && current.month !== undefined) {
    if (target.month < current.month) return true;
    if (target.month > current.month) return false;
  }

  // 3. Day comparison
  if (target.day !== undefined && current.day !== undefined) {
    if (target.day < current.day) return true;
    if (target.day > current.day) return false;
  }

  // 4. TimeOfDay comparison
  if (target.timeOfDay !== undefined && current.timeOfDay !== undefined) {
    const targetTod = TIME_OF_DAY_ORDER[target.timeOfDay] || 0;
    const currentTod = TIME_OF_DAY_ORDER[current.timeOfDay] || 0;
    if (targetTod < currentTod) return true;
    if (targetTod > currentTod) return false;
  }

  return false;
}

/**
 * Deterministic value equality helper without JSON serialization nondeterminism.
 */
function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!isDeepEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * TRPG 3.1 Deterministic Engine Validator
 * Validates transition proposals against World Laws, Idempotency, and Draft State Transitions.
 * Enforces Intra-Proposal Action Validation via sequential virtual draft mutation.
 */
export class EngineValidator {
  public static hasMatchingVerifiedClaim = hasMatchingVerifiedClaim;

  /**
   * Validates a state transition proposal against the current Canonical State.
   * Runs sequential virtual validation: Canonical State -> isolated Draft -> Action 1 -> Action 2...
   */
  public static validate(
    proposal: StateTransitionProposal,
    currentState: CanonicalState,
    executedRequestIds: ReadonlySet<string>,
    recordedEventIds: ReadonlySet<string>,
    historyRecords?: readonly ImmutableHistoricalRecord[]
  ): ValidationVerdict {
    const rejectedReasons: string[] = [];
    const conflictDetails: string[] = [];
    const sanitizedActions: TransitionAction[] = [];

    // 0. Privileged / Unknown Source Check
    const VALID_SOURCES = new Set(['LLM', 'PLAYER', 'GENESIS', 'SYSTEM', 'ENGINE_INTERNAL', 'SAVE_HYDRATION', 'CLOUD_RESTORE']);
    if (!VALID_SOURCES.has(proposal.source)) {
      rejectedReasons.push(
        `[SECURITY_FORGERY] Unknown or unauthorized proposal source '${proposal.source}'.`
      );
    } else if (
      (proposal.source === 'SYSTEM' ||
        proposal.source === 'ENGINE_INTERNAL' ||
        proposal.source === 'SAVE_HYDRATION' ||
        proposal.source === 'CLOUD_RESTORE') &&
      !isEngineAuthorized(proposal)
    ) {
      rejectedReasons.push(
        `[SECURITY_FORGERY] Direct submission of privileged source '${proposal.source}' without Engine-owned capability token is strictly rejected.`
      );
    }

    // 0.1 Genesis Authority Check: GENESIS source is strictly restricted to initial uncommitted genesis state
    if (proposal.source === 'GENESIS') {
      if (currentState.stateVersion !== 1 || currentState.turn !== 1 || currentState.lastCommittedEventId !== null) {
        rejectedReasons.push(
          `[GENESIS_AUTHORITY_VIOLATION] Source 'GENESIS' is strictly restricted to initial uncommitted genesis state (v=1, turn=1, no prior commits).`
        );
      }
    }

    // 1. Idempotency Check: Duplicate Request ID
    if (executedRequestIds.has(proposal.requestId)) {
      rejectedReasons.push(`[IDEMPOTENCY_VIOLATION] Request ID '${proposal.requestId}' has already been processed.`);
    }

    // 2. Event Uniqueness Check: Duplicate Event ID
    if (recordedEventIds.has(proposal.eventId)) {
      rejectedReasons.push(`[EVENT_CONFLICT] Event ID '${proposal.eventId}' already exists in historical event registry.`);
    }

    // 3. State Version Consistency Check (Stale State Prevention)
    if (proposal.expectedStateVersion !== currentState.stateVersion) {
      rejectedReasons.push(
        `[STALE_STATE_CONFLICT] Proposal expected state version ${proposal.expectedStateVersion}, but current sovereign state is at version ${currentState.stateVersion}.`
      );
    }

    // 4. Turn Regression Check: Proposal turn cannot regress before current canonical turn
    if (typeof proposal.turn === 'number' && Number.isInteger(proposal.turn)) {
      if (proposal.turn < currentState.turn) {
        rejectedReasons.push(
          `[TURN_REGRESSION_CONFLICT] Proposal turn ${proposal.turn} cannot regress behind current sovereign turn ${currentState.turn}.`
        );
      }
    }

    // 5. Timestamp Regression Check: Proposal timestamp cannot regress before last committed timestamp
    if (proposal.timestamp && currentState.lastCommittedAt) {
      const propTime = new Date(proposal.timestamp).getTime();
      const lastCommittedTime = new Date(currentState.lastCommittedAt).getTime();
      if (!isNaN(propTime) && !isNaN(lastCommittedTime) && propTime < lastCommittedTime) {
        rejectedReasons.push(
          `[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '${proposal.timestamp}' (${propTime}) cannot be earlier than last committed timestamp '${currentState.lastCommittedAt}' (${lastCommittedTime}).`
        );
      }
    }

    // 6. Empty Proposal Check: actions: [] must be explicitly rejected
    if (!proposal.actions || proposal.actions.length === 0) {
      rejectedReasons.push(`[EMPTY_PROPOSAL_REJECTED] State transition proposal contains no actions.`);
    }

    // 6.5 MeaningTree Runtime Projection Consistency Check (Fail-Closed)
    if (!proposal.meaningTree) {
      rejectedReasons.push(`[COMPOSITION_PROJECTION_MISSING] Proposal has actions but no MeaningTree authority.`);
    } else {
      const consistency = checkMeaningTreeProjectionConsistency(proposal.meaningTree, proposal.actions);
      if (!consistency.isConsistent) {
        rejectedReasons.push(`[PROJECTION_INCONSISTENCY] ${consistency.reason}`);
      }
    }

    // 7. Attached Verified Claims Validation (VEIL Immigration Gate)
    if (proposal.verifiedClaims && proposal.verifiedClaims.length > 0) {
      for (let vcIdx = 0; vcIdx < proposal.verifiedClaims.length; vcIdx++) {
        const vc = proposal.verifiedClaims[vcIdx];
        if (!ImmigrationGate.isValidVerifiedClaim(vc)) {
          rejectedReasons.push(
            `[FORGED_CLAIM_REJECTED] Attached claim #${vcIdx + 1} fails Immigration Gate signature or structure verification.`
          );
        } else if (vc.verifiedAtStateVersion !== currentState.stateVersion) {
          rejectedReasons.push(
            `[STALE_CLAIM_REJECTED] Attached claim #${vcIdx + 1} was verified at stateVersion ${vc.verifiedAtStateVersion}, but current stateVersion is ${currentState.stateVersion}.`
          );
        }
      }
    }

    // If foundational checks fail, reject immediately
    if (rejectedReasons.length > 0) {
      return Object.freeze({
        isValid: false,
        rejectedReasons: Object.freeze(rejectedReasons),
        conflictDetails: Object.freeze(conflictDetails),
        sanitizedActions: Object.freeze([])
      });
    }

    // 5. Sequential Virtual Draft State Validation
    // Initialize virtual draft from current canonical state to reflect intermediate effects of preceding actions
    const draftWorld: WorldInfo = deepClone(currentState.worldInfo);
    const draftCharacter: Character = deepClone(currentState.character);

    // Pre-calculate proposal-wide REMOVE quantities per resource for atomic causality matching
    const proposalRemovedResources: Record<string, number> = {};
    for (const act of proposal.actions) {
      if (act.type === 'MODIFY_INVENTORY' && act.payload?.operation === 'REMOVE' && act.payload.item) {
        const rItem = act.payload.item;
        const matchingOwned = currentState.character.inventory.find(
          inv => (rItem.id && inv.id === rItem.id) || (rItem.name && inv.name === rItem.name)
        );
        const rKey = matchingOwned ? (matchingOwned.id || matchingOwned.name) : (rItem.id || rItem.name);
        if (rKey && typeof rItem.quantity === 'number' && Number.isFinite(rItem.quantity) && rItem.quantity > 0) {
          proposalRemovedResources[rKey] = (proposalRemovedResources[rKey] || 0) + rItem.quantity;
        }
      }
    }
    const consumedCostPool: Record<string, number> = {};
    const consumedEventIds = new Set<string>();

    for (let i = 0; i < proposal.actions.length; i++) {
      const action = proposal.actions[i];
      let actionValid = true;

      // Source -> Action ACL Check
      const allowedActions = SOURCE_ACTION_ACL[proposal.source];
      if (allowedActions && !allowedActions.has(action.type)) {
        conflictDetails.push(`[ACL_VIOLATION] Proposal source '${proposal.source}' is not authorized to execute action '${action.type}'.`);
        rejectedReasons.push(`[UNAUTHORIZED_ACTION_FOR_SOURCE] Action #${i + 1} (${action.type}) is unauthorized for source '${proposal.source}'.`);
        actionValid = false;
      }

      switch (action.type) {
        case 'SET_WORLD_METADATA': {
          const payload = action.payload;
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (SET_WORLD_METADATA) requires a valid payload object.`);
            actionValid = false;
          } else {
            if (payload.worldName !== undefined && (typeof payload.worldName !== 'string' || payload.worldName.trim().length === 0)) {
              rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: 'worldName' must be a non-empty string.`);
              actionValid = false;
            }
            if (payload.settingDescription !== undefined && typeof payload.settingDescription !== 'string') {
              rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: 'settingDescription' must be a string.`);
              actionValid = false;
            }
            if (payload.toneStyle !== undefined && typeof payload.toneStyle !== 'string') {
              rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: 'toneStyle' must be a string.`);
              actionValid = false;
            }

            // Article 1, 2, 7 & Provenance Boundary: Untrusted sources (LLM, PLAYER) cannot alter established canonical world metadata
            const isSystemSource = proposal.source === 'GENESIS' ||
                                   proposal.source === 'SYSTEM' ||
                                   proposal.source === 'SAVE_HYDRATION' ||
                                   proposal.source === 'CLOUD_RESTORE' ||
                                   proposal.source === 'ENGINE_INTERNAL';
            if (!isSystemSource) {
              conflictDetails.push(`[PROVENANCE_VIOLATION] Action #${i + 1}: Modifying canonical world metadata via untrusted source '${proposal.source}' is prohibited without independent canonical evidence.`);
              rejectedReasons.push(`[PROVENANCE_VIOLATION] Canonical world metadata cannot be altered by source '${proposal.source}' without independent canonical evidence.`);
              actionValid = false;
            }
          }
          break;
        }

        case 'ADVANCE_TIME': {
          const { targetTime } = action.payload || {};
          if (!targetTime || typeof targetTime !== 'object' || Array.isArray(targetTime) || typeof targetTime.year !== 'number' || isNaN(targetTime.year) || !Number.isFinite(targetTime.year) || targetTime.year < 0) {
            rejectedReasons.push(`[INVALID_TIME_VALUE] Action #${i + 1} (ADVANCE_TIME) requires a valid 'targetTime' with non-negative finite numeric 'year'.`);
            actionValid = false;
          } else {
            if (targetTime.month !== undefined && (typeof targetTime.month !== 'number' || !Number.isFinite(targetTime.month) || targetTime.month < 1 || targetTime.month > 12)) {
              rejectedReasons.push(`[INVALID_TIME_VALUE] Action #${i + 1} (ADVANCE_TIME) 'month' must be a number between 1 and 12.`);
              actionValid = false;
            }
            if (targetTime.day !== undefined && (typeof targetTime.day !== 'number' || !Number.isFinite(targetTime.day) || targetTime.day < 1 || targetTime.day > 31)) {
              rejectedReasons.push(`[INVALID_TIME_VALUE] Action #${i + 1} (ADVANCE_TIME) 'day' must be a number between 1 and 31.`);
              actionValid = false;
            }
            if (targetTime.season !== undefined && !['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'].includes(targetTime.season)) {
              rejectedReasons.push(`[INVALID_TIME_VALUE] Action #${i + 1} (ADVANCE_TIME) 'season' must be SPRING, SUMMER, AUTUMN, or WINTER.`);
              actionValid = false;
            }
            if (targetTime.timeOfDay !== undefined && !['DAWN', 'MORNING', 'NOON', 'AFTERNOON', 'DUSK', 'NIGHT', 'MIDNIGHT'].includes(targetTime.timeOfDay)) {
              rejectedReasons.push(`[INVALID_TIME_VALUE] Action #${i + 1} (ADVANCE_TIME) 'timeOfDay' must be a valid time of day.`);
              actionValid = false;
            }

            if (actionValid && draftWorld.currentTime) {
              if (isTemporalRegression(targetTime, draftWorld.currentTime)) {
                conflictDetails.push(
                  `[TEMPORAL_REGRESSION_CONFLICT] Action #${i + 1}: Proposed targetTime is earlier than current canonical time.`
                );
                rejectedReasons.push(`[TEMPORAL_REGRESSION_REJECTED] Cannot advance time backwards in history.`);
                actionValid = false;
              }
            }
          }
          break;
        }

        case 'ADD_RUMOR': {
          const { rumor } = action.payload;
          if (!rumor || typeof rumor !== 'string' || rumor.trim().length === 0) {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (ADD_RUMOR) requires non-empty 'rumor' text.`);
            actionValid = false;
          }
          break;
        }

        case 'ADD_NPC': {
          const npc = action.payload;
          if (!npc || typeof npc !== 'object' || !npc.id || typeof npc.id !== 'string' || !npc.id.trim() || !npc.name || typeof npc.name !== 'string' || !npc.name.trim()) {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (ADD_NPC) requires a valid string 'id' and 'name'.`);
            actionValid = false;
          } else if (draftWorld.npcs.some(existing => existing.id === npc.id)) {
            conflictDetails.push(`[NPC_CONFLICT] Action #${i + 1}: NPC with ID '${npc.id}' already exists in state.`);
            rejectedReasons.push(`[NPC_CONFLICT] Cannot add existing NPC ID '${npc.id}'.`);
            actionValid = false;
          } else if (draftWorld.npcs.some(existing => existing.name.trim().toLowerCase() === npc.name.trim().toLowerCase())) {
            conflictDetails.push(`[NPC_CONFLICT] Action #${i + 1}: NPC with name '${npc.name}' already exists in state.`);
            rejectedReasons.push(`[NPC_CONFLICT] Cannot add duplicate NPC name '${npc.name}'.`);
            actionValid = false;
          } else if ((npc as any).trust !== undefined && (typeof (npc as any).trust !== 'number' || isNaN((npc as any).trust) || !Number.isFinite((npc as any).trust) || (npc as any).trust < 0 || (npc as any).trust > 100 || !Number.isInteger((npc as any).trust))) {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (ADD_NPC) trust must be a finite integer between 0 and 100.`);
            actionValid = false;
          } else if ((npc as any).affinity !== undefined && (typeof (npc as any).affinity !== 'number' || isNaN((npc as any).affinity) || !Number.isFinite((npc as any).affinity) || (npc as any).affinity < 0 || (npc as any).affinity > 100 || !Number.isInteger((npc as any).affinity))) {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (ADD_NPC) affinity must be a finite integer between 0 and 100.`);
            actionValid = false;
          }
          break;
        }

        case 'UPDATE_NPC': {
          const { id, changes } = action.payload;
          if (!id || typeof id !== 'string' || !changes || typeof changes !== 'object' || Array.isArray(changes)) {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (UPDATE_NPC) requires string 'id' and object 'changes'.`);
            actionValid = false;
            break;
          }
          const targetNpc = draftWorld.npcs.find(n => n.id === id);
          if (!targetNpc) {
            rejectedReasons.push(`[NON_EXISTENT_ENTITY] Action #${i + 1}: Cannot update non-existent NPC ID '${id}'.`);
            actionValid = false;
          } else {
            // Provenance Boundary: UPDATE_NPC is EVIDENCE_REQUIRED.
            // Newly created draft entities in the same proposal cannot serve as pre-existing canonical evidence.
            const canonicalNpc = currentState.worldInfo.npcs.find(n => n.id === id);
            if (!canonicalNpc) {
              conflictDetails.push(`[PROVENANCE_VIOLATION] Action #${i + 1}: Cannot execute UPDATE_NPC on entity '${id}' without pre-existing canonical evidence in currentState. Draft entities created in the same proposal cannot be confirmed or modified via UPDATE_NPC without prior canonical commit.`);
              rejectedReasons.push(`[PROVENANCE_VIOLATION] Entity '${id}' has no pre-existing canonical evidence in currentState.`);
              actionValid = false;
            } else if (targetNpc.status === 'DEAD') {
              // BUG-01 & Article 16 Defense: DEAD NPCs cannot have their state modified or status changed
              conflictDetails.push(`[DEAD_NPC_STATUS_PROTECTION] Action #${i + 1}: NPC '${targetNpc.name}' (${id}) is DEAD and cannot be modified or revived.`);
              rejectedReasons.push(`[DEAD_NPC_STATUS_PROTECTION] Dead NPC cannot be modified or transition away from DEAD status.`);
              actionValid = false;
            } else if (changes.id !== undefined && changes.id !== id) {
              // BUG-03 Defense: Entity ID is immutable
              conflictDetails.push(`[IMMUTABLE_FIELD_PROTECTION] Action #${i + 1}: Cannot mutate NPC immutable identifier 'id' from '${id}' to '${changes.id}'.`);
              rejectedReasons.push(`[IMMUTABLE_FIELD_PROTECTION] Entity ID is immutable and cannot be updated.`);
              actionValid = false;
            } else if (changes.name !== undefined && (typeof changes.name !== 'string' || !changes.name.trim())) {
              rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (UPDATE_NPC) name must be a non-empty string.`);
              actionValid = false;
            } else if (changes.name !== undefined && draftWorld.npcs.some(n => n.id !== id && n.name.trim().toLowerCase() === changes.name.trim().toLowerCase())) {
              conflictDetails.push(`[NPC_CONFLICT] Action #${i + 1}: NPC name '${changes.name}' collides with existing NPC.`);
              rejectedReasons.push(`[NPC_CONFLICT] Cannot update NPC to conflicting name '${changes.name}'.`);
              actionValid = false;
            } else if ((changes as any).trust !== undefined && (typeof (changes as any).trust !== 'number' || isNaN((changes as any).trust) || !Number.isFinite((changes as any).trust) || (changes as any).trust < 0 || (changes as any).trust > 100 || !Number.isInteger((changes as any).trust))) {
              rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (UPDATE_NPC) trust must be a finite integer between 0 and 100.`);
              actionValid = false;
            } else if ((changes as any).affinity !== undefined && (typeof (changes as any).affinity !== 'number' || isNaN((changes as any).affinity) || !Number.isFinite((changes as any).affinity) || (changes as any).affinity < 0 || (changes as any).affinity > 100 || !Number.isInteger((changes as any).affinity))) {
              rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (UPDATE_NPC) affinity must be a finite integer between 0 and 100.`);
              actionValid = false;
            } else if (proposal.source === 'LLM') {
              // Multi-field check: EVERY changed attribute in changes must have a corresponding VerifiedClaim.
              // No partial pass (some() is strictly forbidden).
              const changeEntries = Object.entries(changes);
              if (changeEntries.length === 0) {
                rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (UPDATE_NPC) changes object is empty.`);
                actionValid = false;
              } else {
                for (const [attrKey, attrVal] of changeEntries) {
                  if (attrKey === 'id') continue;
                  const hasClaim = hasMatchingVerifiedClaim(proposal.verifiedClaims, id, attrKey, attrVal, targetNpc.name);
                  if (!hasClaim) {
                    conflictDetails.push(`[CLAIM_AUTHORITY_VIOLATION] Action #${i + 1}: LLM UPDATE_NPC field '${attrKey}' for '${id}' lacks a matching Gate-issued VerifiedClaim (Entity='${id}', Attribute='${attrKey}').`);
                    rejectedReasons.push(`[CLAIM_AUTHORITY_VIOLATION] Unverified mutation on NPC '${id}' field '${attrKey}'.`);
                    actionValid = false;
                    break;
                  }
                }
              }
            }
          }
          break;
        }

        case 'SET_NPC_STATUS': {
          const { id, status } = action.payload;
          if (!id || typeof id !== 'string' || !status || typeof status !== 'string') {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (SET_NPC_STATUS) requires string 'id' and 'status'.`);
            actionValid = false;
            break;
          }
          const targetNpc = draftWorld.npcs.find(n => n.id === id);
          if (!targetNpc) {
            rejectedReasons.push(`[NON_EXISTENT_ENTITY] Action #${i + 1}: Cannot set status on non-existent NPC ID '${id}'.`);
            actionValid = false;
          } else if (targetNpc.status === 'DEAD') {
            // RED-03 Defense: DEAD NPC status and properties are permanently immutable
            conflictDetails.push(`[DEAD_NPC_STATUS_PROTECTION] Action #${i + 1}: NPC '${targetNpc.name}' (${id}) is DEAD. Cannot modify status of a deceased NPC.`);
            rejectedReasons.push(`[DEAD_NPC_STATUS_PROTECTION] Cannot modify status of a deceased NPC.`);
            actionValid = false;
          } else if (proposal.source === 'LLM') {
            const hasClaim = hasMatchingVerifiedClaim(proposal.verifiedClaims, id, 'status', status, targetNpc.name);
            if (!hasClaim) {
              conflictDetails.push(`[CLAIM_AUTHORITY_VIOLATION] Action #${i + 1}: LLM SET_NPC_STATUS for '${id}' (status='${status}') lacks a matching Gate-issued VerifiedClaim (Entity='${id}', Attribute='status', Value='${status}').`);
              rejectedReasons.push(`[CLAIM_AUTHORITY_VIOLATION] Unverified status mutation on NPC '${id}'.`);
              actionValid = false;
            }
          }
          break;
        }

        case 'ADD_FACTION': {
          const faction = action.payload;
          if (!faction || typeof faction !== 'object' || !faction.id || typeof faction.id !== 'string' || !faction.id.trim() || !faction.name || typeof faction.name !== 'string' || !faction.name.trim()) {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (ADD_FACTION) requires a valid string 'id' and 'name'.`);
            actionValid = false;
          } else if (draftWorld.factions.some(existing => existing.id === faction.id)) {
            conflictDetails.push(`[FACTION_CONFLICT] Action #${i + 1}: Faction with ID '${faction.id}' already exists in state.`);
            rejectedReasons.push(`[FACTION_CONFLICT] Cannot add existing Faction ID '${faction.id}'.`);
            actionValid = false;
          } else if (draftWorld.factions.some(existing => existing.name.trim().toLowerCase() === faction.name.trim().toLowerCase())) {
            conflictDetails.push(`[FACTION_CONFLICT] Action #${i + 1}: Faction with name '${faction.name}' already exists in state.`);
            rejectedReasons.push(`[FACTION_CONFLICT] Cannot add duplicate Faction name '${faction.name}'.`);
            actionValid = false;
          } else if (faction.influence !== undefined) {
            let incomingNum: number | null = null;
            if (typeof faction.influence === 'number') {
              if (isNaN(faction.influence) || !Number.isFinite(faction.influence) || faction.influence < 0 || faction.influence > 100 || !Number.isInteger(faction.influence)) {
                rejectedReasons.push(`[INVALID_FACTION_INFLUENCE] Action #${i + 1} (ADD_FACTION) influence must be a finite integer between 0 and 100.`);
                actionValid = false;
              } else {
                incomingNum = faction.influence;
              }
            } else if (typeof faction.influence === 'string') {
              if (/^-?\d+$/.test(faction.influence.trim())) {
                const num = Number(faction.influence);
                if (num < 0 || num > 100) {
                  rejectedReasons.push(`[INVALID_FACTION_INFLUENCE] Action #${i + 1} (ADD_FACTION) influence must be a finite integer between 0 and 100.`);
                  actionValid = false;
                } else {
                  incomingNum = num;
                }
              }
            }
            if (incomingNum !== null && actionValid) {
              let currentTotal = 0;
              for (const f of draftWorld.factions) {
                if (typeof f.influence === 'number' && Number.isFinite(f.influence)) {
                  currentTotal += f.influence;
                } else if (typeof f.influence === 'string' && /^-?\d+$/.test(f.influence.trim())) {
                  currentTotal += Number(f.influence);
                }
              }
              if (currentTotal + incomingNum > 100) {
                conflictDetails.push(`[FACTION_INFLUENCE_EXCEEDED] Action #${i + 1}: Adding faction '${faction.name}' (${incomingNum}) causes cumulative influence (${currentTotal + incomingNum}) to exceed 100.`);
                rejectedReasons.push(`[FACTION_INFLUENCE_EXCEEDED] Total cumulative faction influence cannot exceed 100.`);
                actionValid = false;
              }
            }
          }
          break;
        }

        case 'UPDATE_FACTION': {
          const { id, changes } = action.payload;
          if (!id || typeof id !== 'string' || !changes || typeof changes !== 'object' || Array.isArray(changes)) {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (UPDATE_FACTION) requires string 'id' and object 'changes'.`);
            actionValid = false;
            break;
          }
          const targetFaction = draftWorld.factions.find(f => f.id === id);
          if (!targetFaction) {
            rejectedReasons.push(`[NON_EXISTENT_ENTITY] Action #${i + 1}: Cannot update non-existent Faction ID '${id}'.`);
            actionValid = false;
          } else {
            // Provenance Boundary: UPDATE_FACTION is EVIDENCE_REQUIRED.
            // Newly created draft factions in the same proposal cannot serve as pre-existing canonical evidence.
            const canonicalFaction = currentState.worldInfo.factions.find(f => f.id === id);
            if (!canonicalFaction) {
              conflictDetails.push(`[PROVENANCE_VIOLATION] Action #${i + 1}: Cannot execute UPDATE_FACTION on faction '${id}' without pre-existing canonical evidence in currentState. Draft factions created in the same proposal cannot be confirmed or modified via UPDATE_FACTION without prior canonical commit.`);
              rejectedReasons.push(`[PROVENANCE_VIOLATION] Faction '${id}' has no pre-existing canonical evidence in currentState.`);
              actionValid = false;
            } else if (changes.id !== undefined && changes.id !== id) {
              // BUG-03 Defense: Faction ID is immutable
              conflictDetails.push(`[IMMUTABLE_FIELD_PROTECTION] Action #${i + 1}: Cannot mutate Faction immutable identifier 'id' from '${id}' to '${changes.id}'.`);
              rejectedReasons.push(`[IMMUTABLE_FIELD_PROTECTION] Entity ID is immutable and cannot be updated.`);
              actionValid = false;
            } else if (changes.name !== undefined && (typeof changes.name !== 'string' || !changes.name.trim())) {
              rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (UPDATE_FACTION) name must be a non-empty string.`);
              actionValid = false;
            } else if (changes.name !== undefined && draftWorld.factions.some(f => f.id !== id && f.name.trim().toLowerCase() === changes.name.trim().toLowerCase())) {
              conflictDetails.push(`[FACTION_CONFLICT] Action #${i + 1}: Faction name '${changes.name}' collides with existing faction.`);
              rejectedReasons.push(`[FACTION_CONFLICT] Cannot update Faction to conflicting name '${changes.name}'.`);
              actionValid = false;
            } else if (changes.influence !== undefined) {
              let incomingNum: number | null = null;
              if (typeof changes.influence === 'number') {
                if (isNaN(changes.influence) || !Number.isFinite(changes.influence) || changes.influence < 0 || changes.influence > 100 || !Number.isInteger(changes.influence)) {
                  rejectedReasons.push(`[INVALID_FACTION_INFLUENCE] Action #${i + 1} (UPDATE_FACTION) influence must be a finite integer between 0 and 100.`);
                  actionValid = false;
                } else {
                  incomingNum = changes.influence;
                }
              } else if (typeof changes.influence === 'string') {
                if (/^-?\d+$/.test(changes.influence.trim())) {
                  const num = Number(changes.influence);
                  if (num < 0 || num > 100) {
                    rejectedReasons.push(`[INVALID_FACTION_INFLUENCE] Action #${i + 1} (UPDATE_FACTION) influence must be a finite integer between 0 and 100.`);
                    actionValid = false;
                  } else {
                    incomingNum = num;
                  }
                }
              }
              if (incomingNum !== null && actionValid) {
                let otherTotal = 0;
                for (const f of draftWorld.factions) {
                  if (f.id === id) continue;
                  if (typeof f.influence === 'number' && Number.isFinite(f.influence)) {
                    otherTotal += f.influence;
                  } else if (typeof f.influence === 'string' && /^-?\d+$/.test(f.influence.trim())) {
                    otherTotal += Number(f.influence);
                  }
                }
                if (otherTotal + incomingNum > 100) {
                  conflictDetails.push(`[FACTION_INFLUENCE_EXCEEDED] Action #${i + 1}: Updating faction '${id}' influence to ${incomingNum} causes total cumulative influence (${otherTotal + incomingNum}) to exceed 100.`);
                  rejectedReasons.push(`[FACTION_INFLUENCE_EXCEEDED] Total cumulative faction influence cannot exceed 100.`);
                  actionValid = false;
                }
              }
            }

            if (actionValid && proposal.source === 'LLM') {
              const changeEntries = Object.entries(changes);
              if (changeEntries.length === 0) {
                rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (UPDATE_FACTION) changes object is empty.`);
                actionValid = false;
              } else {
                for (const [attrKey, attrVal] of changeEntries) {
                  if (attrKey === 'id') continue;
                  const hasClaim = hasMatchingVerifiedClaim(proposal.verifiedClaims, id, attrKey, attrVal, targetFaction.name);
                  if (!hasClaim) {
                    conflictDetails.push(`[CLAIM_AUTHORITY_VIOLATION] Action #${i + 1}: LLM UPDATE_FACTION field '${attrKey}' for '${id}' lacks a matching Gate-issued VerifiedClaim (Entity='${id}', Attribute='${attrKey}').`);
                    rejectedReasons.push(`[CLAIM_AUTHORITY_VIOLATION] Unverified mutation on Faction '${id}' field '${attrKey}'.`);
                    actionValid = false;
                    break;
                  }
                }
              }
            }
          }
          break;
        }

        case 'MODIFY_INVENTORY': {
          const { item, operation, acquisition } = action.payload || {};
          if (!item || typeof item !== 'object' || !item.id || typeof item.id !== 'string' || !item.name || typeof item.name !== 'string') {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (MODIFY_INVENTORY) requires valid item string 'id' and 'name'.`);
            actionValid = false;
          } else if (typeof item.quantity !== 'number' || isNaN(item.quantity) || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (MODIFY_INVENTORY) item 'quantity' must be a finite positive integer.`);
            actionValid = false;
          } else if (operation === 'REMOVE') {
            const existingItem = draftCharacter.inventory.find(inv => {
              if (item.id && inv.id) {
                return inv.id === item.id;
              }
              return inv.name === item.name;
            });
            if (!existingItem) {
              conflictDetails.push(`[INVENTORY_CONFLICT] Action #${i + 1}: Cannot remove non-existent item '${item.name}' (${item.id}) from inventory.`);
              rejectedReasons.push(`[INVENTORY_VIOLATION] Item '${item.name}' does not exist in character inventory.`);
              actionValid = false;
            } else if (existingItem.quantity < item.quantity) {
              conflictDetails.push(`[INVENTORY_CONFLICT] Action #${i + 1}: Cannot remove ${item.quantity} of '${item.name}', only ${existingItem.quantity} available.`);
              rejectedReasons.push(`[INVENTORY_VIOLATION] Insufficient item quantity for '${item.name}'.`);
              actionValid = false;
            }
          } else if (operation === 'SET_QUANTITY') {
            // SET_QUANTITY can only be executed by trusted system sources or verified causality
            const isSystemSource = proposal.source === 'GENESIS' ||
                                   proposal.source === 'SYSTEM' ||
                                   proposal.source === 'SAVE_HYDRATION' ||
                                   proposal.source === 'CLOUD_RESTORE' ||
                                   proposal.source === 'ENGINE_INTERNAL';
            if (!isSystemSource) {
              conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: MODIFY_INVENTORY with operation 'SET_QUANTITY' is prohibited for untrusted source '${proposal.source}'.`);
              rejectedReasons.push(`[CAUSALITY_VIOLATION] SET_QUANTITY operation is not permitted for runtime source '${proposal.source}'.`);
              actionValid = false;
            } else {
              // Article 9 & 16: SET_QUANTITY cannot target or invent non-existent entities
              const existingItem = draftCharacter.inventory.find(inv => {
                if (item.id && inv.id) {
                  return inv.id === item.id;
                }
                return inv.name === item.name;
              });
              if (!existingItem) {
                conflictDetails.push(`[NON_EXISTENT_ENTITY] Action #${i + 1}: Cannot SET_QUANTITY on non-existent item '${item.name}' (${item.id}). Items must be created via ADD.`);
                rejectedReasons.push(`[NON_EXISTENT_ENTITY] Item '${item.name}' does not exist in character inventory.`);
                actionValid = false;
              }
            }
          } else if (operation === 'ADD') {
            // Causality Gate for ADD operations
            // Trusted system sources bypass runtime causality check
            const isSystemSource = proposal.source === 'GENESIS' ||
                                   proposal.source === 'SYSTEM' ||
                                   proposal.source === 'SAVE_HYDRATION' ||
                                   proposal.source === 'CLOUD_RESTORE' ||
                                   proposal.source === 'ENGINE_INTERNAL';
            if (!isSystemSource) {
              // Untrusted runtime sources (LLM, PLAYER) MUST satisfy deterministic causality!
              if (!acquisition || !acquisition.cause) {
                conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: Acquisition of '${item.name}' has no verified causality or acquisition event.`);
                rejectedReasons.push(`[CAUSALITY_VIOLATION] Unbacked inventory ADD of '${item.name}' is rejected.`);
                actionValid = false;
              } else if (acquisition.cause === 'RESOURCE_EXCHANGE') {
                const cost = acquisition.cost;
                if (!cost || typeof cost !== 'object' || typeof cost.quantity !== 'number' || !Number.isFinite(cost.quantity) || cost.quantity <= 0) {
                  conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: RESOURCE_EXCHANGE for '${item.name}' missing valid positive cost quantity.`);
                  rejectedReasons.push(`[CAUSALITY_VIOLATION] Invalid cost specification for exchange of '${item.name}'.`);
                  actionValid = false;
                } else {
                  const costItemName = cost.name?.trim();
                  const costItemId = cost.id?.trim();
                  // Condition 1 & 2: Cost item exists in canonical character inventory with sufficient quantity
                  const ownedCostItem = currentState.character.inventory.find(
                    inv => (costItemId && inv.id === costItemId) || (costItemName && inv.name === costItemName)
                  );
                  if (!ownedCostItem) {
                    conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: Character does not own cost item '${costItemName || costItemId}' required for exchange.`);
                    rejectedReasons.push(`[CAUSALITY_VIOLATION] Cost resource '${costItemName || costItemId}' not found in character inventory.`);
                    actionValid = false;
                  } else if (ownedCostItem.quantity < cost.quantity) {
                    conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: Insufficient cost resource '${ownedCostItem.name}'. Required: ${cost.quantity}, Owned: ${ownedCostItem.quantity}.`);
                    rejectedReasons.push(`[CAUSALITY_VIOLATION] Insufficient cost resource '${ownedCostItem.name}'.`);
                    actionValid = false;
                  } else {
                    const resourceKey = ownedCostItem.id || ownedCostItem.name;
                    const availableTotalRemove = proposalRemovedResources[resourceKey] || 0;
                    const previouslyConsumed = consumedCostPool[resourceKey] || 0;
                    const totalNeeded = previouslyConsumed + cost.quantity;

                    if (totalNeeded > ownedCostItem.quantity) {
                      conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: RESOURCE_EXCHANGE cumulative cost for '${ownedCostItem.name}' (${totalNeeded}) exceeds character initial inventory (${ownedCostItem.quantity}).`);
                      rejectedReasons.push(`[CAUSALITY_VIOLATION] Insufficient cumulative cost resource '${ownedCostItem.name}' in character inventory.`);
                      actionValid = false;
                    } else if (availableTotalRemove === 0) {
                      conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: RESOURCE_EXCHANGE for '${item.name}' lacks atomic REMOVE action of ${cost.quantity} '${ownedCostItem.name}' in same proposal.`);
                      rejectedReasons.push(`[CAUSALITY_VIOLATION] Atomic resource deduction action missing in proposal for exchange.`);
                      actionValid = false;
                    } else if (totalNeeded > availableTotalRemove) {
                      conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: RESOURCE_EXCHANGE double-spending detected for '${ownedCostItem.name}'. Cumulative cost (${totalNeeded}) exceeds total REMOVE actions in proposal (${availableTotalRemove}).`);
                      rejectedReasons.push(`[CAUSALITY_VIOLATION] Double spending of cost resource '${ownedCostItem.name}' detected.`);
                      actionValid = false;
                    } else {
                      consumedCostPool[resourceKey] = totalNeeded;
                    }
                  }
                }
              } else if (acquisition.cause === 'GENESIS_STARTER' || acquisition.cause === 'SYSTEM_INITIALIZATION') {
                // GENESIS_STARTER is only permitted during genesis / initial turn (turn 1, stateVersion 1)
                if (currentState.turn > 1 || currentState.stateVersion > 1) {
                  conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: Retrospective GENESIS_STARTER at turn ${currentState.turn} (version ${currentState.stateVersion}) is prohibited for runtime source '${proposal.source}'.`);
                  rejectedReasons.push(`[CAUSALITY_VIOLATION] Retrospective GENESIS_STARTER is not permitted at turn ${currentState.turn}.`);
                  actionValid = false;
                } else if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
                  conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: GENESIS_STARTER has invalid or empty item name.`);
                  rejectedReasons.push(`[CAUSALITY_VIOLATION] Invalid item name for GENESIS_STARTER.`);
                  actionValid = false;
                }
              } else if (
                acquisition.cause === 'DISCOVERY_PICKUP' ||
                acquisition.cause === 'GIFT_REWARD' ||
                acquisition.cause === 'GIFT' ||
                acquisition.cause === 'REWARD' ||
                acquisition.cause === 'LOOT'
              ) {
                // Trusted Event Causality Gate for Narrative Acquisitions
                if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
                  conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: Acquisition cause '${acquisition.cause}' has invalid or empty item name.`);
                  rejectedReasons.push(`[CAUSALITY_VIOLATION] Invalid item name for ${acquisition.cause}.`);
                  actionValid = false;
                } else {
                  const verifiedEventId = acquisition.verifiedEventId?.trim();
                  if (!verifiedEventId) {
                    conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: Acquisition '${acquisition.cause}' of '${item.name}' lacks verifiedEventId grounding.`);
                    rejectedReasons.push(`[CAUSALITY_VIOLATION] Unbacked ${acquisition.cause} of '${item.name}' lacks verifiedEventId grounding.`);
                    actionValid = false;
                  } else {
                    // Check if already consumed in history
                    let isAlreadyConsumed = false;
                    if (historyRecords && historyRecords.length > 0) {
                      for (const rec of historyRecords) {
                        if (rec.details && rec.actionType === 'MODIFY_INVENTORY') {
                          if (rec.details.includes(verifiedEventId)) {
                            try {
                              const match = rec.details.match(/\{[\s\S]*\}/);
                              if (match) {
                                const parsed = JSON.parse(match[0]);
                                if (parsed.acquisition?.verifiedEventId === verifiedEventId) {
                                  isAlreadyConsumed = true;
                                  break;
                                }
                              }
                            } catch (_) {
                              if (rec.details.includes(`"verifiedEventId":"${verifiedEventId}"`)) {
                                isAlreadyConsumed = true;
                                break;
                              }
                            }
                          }
                        }
                      }
                    }

                    // Check if already consumed in earlier action of same proposal
                    if (consumedEventIds.has(verifiedEventId)) {
                      isAlreadyConsumed = true;
                    }

                    if (isAlreadyConsumed) {
                      conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: Event '${verifiedEventId}' has already been consumed for item acquisition.`);
                      rejectedReasons.push(`[CAUSALITY_VIOLATION] Duplicate consumption of event '${verifiedEventId}'.`);
                      actionValid = false;
                    } else {
                      // Locate Trusted Event in World Seeds, Offscreen Records, Camera Events, or History (strictly pre-existing prior to proposal)
                      let foundEventText: string | null = null;
                      let eventIsActive = false;

                      // A. Narrative Seeds in Current State (pre-existing prior to proposal)
                      const matchingSeed = currentState.worldInfo.seeds.find(s => s.id === verifiedEventId);
                      if (matchingSeed) {
                        foundEventText = matchingSeed.content;
                        eventIsActive = matchingSeed.status === 'active' || matchingSeed.status === 'dormant';
                      }

                      // B. Offscreen Records in Current State (pre-existing prior to proposal)
                      if (!foundEventText && currentState.worldInfo.offscreenRecords) {
                        const matchingOff = currentState.worldInfo.offscreenRecords.find(o => o.id === verifiedEventId);
                        if (matchingOff) {
                          foundEventText = matchingOff.eventDescription;
                          eventIsActive = true;
                        }
                      }

                      // C. Camera Offscreen Events in Current State (pre-existing prior to proposal)
                      if (!foundEventText && currentState.worldInfo.cameraOffscreenEvents) {
                        const matchingCam = currentState.worldInfo.cameraOffscreenEvents.find(
                          e => e === verifiedEventId
                        );
                        if (matchingCam) {
                          foundEventText = matchingCam;
                          eventIsActive = true;
                        }
                      }

                      // D. Historical Records (pre-existing prior to proposal)
                      if (!foundEventText && historyRecords && historyRecords.length > 0) {
                        const matchingHist = historyRecords.find(
                          r => r.eventId === verifiedEventId || r.recordId === verifiedEventId
                        );
                        if (matchingHist) {
                          foundEventText = matchingHist.details || (matchingHist as any).summary || null;
                          eventIsActive = (matchingHist as any).informationStatus === 'CANONICAL' || (matchingHist as any).status === 'CANONICAL' || !(matchingHist as any).status;
                        }
                      }

                      // Note: Section 5.7 & Provenance Boundary: Intra-proposal actions and draft data CANNOT serve as canonical evidence.

                      if (!foundEventText) {
                        conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: verifiedEventId '${verifiedEventId}' does not exist in canonical world state, history, or active context.`);
                        rejectedReasons.push(`[CAUSALITY_VIOLATION] Event '${verifiedEventId}' not found in canonical records.`);
                        actionValid = false;
                      } else if (!eventIsActive) {
                        conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: Event '${verifiedEventId}' is resolved, superseded, or no longer an active obtainable context.`);
                        rejectedReasons.push(`[CAUSALITY_VIOLATION] Event '${verifiedEventId}' is not an active obtainable context.`);
                        actionValid = false;
                      } else {
                        // Causal Item Relevance Check
                        const itemNameClean = item.name.trim().toLowerCase();
                        const eventTextClean = foundEventText.toLowerCase();

                        // Parse event into distinct word tokens and sanitize punctuation
                        const eventWords = eventTextClean.split(/[\s,.\-?!;:()\[\]{}"'`~]+/).filter(Boolean);
                        const KOREAN_PARTICLES = ['', '을', '를', '이', '가', '의', '과', '와', '으로', '로', '도', '에서', '에게', '이다', '입니다', '뿐', '만'];

                        let matchesItem = false;
                        if (itemNameClean.length === 1) {
                          // Single-character item name must match an exact token or token with direct object/topic particle
                          matchesItem = eventWords.some(w => w === itemNameClean || w === itemNameClean + '을' || w === itemNameClean + '를');
                        } else {
                          // Multi-character item name: check word root match with valid particle suffixes or multi-word phrase boundary
                          const tokenMatch = eventWords.some(w => {
                            if (w === itemNameClean) return true;
                            if (w.startsWith(itemNameClean)) {
                              const suffix = w.slice(itemNameClean.length);
                              return KOREAN_PARTICLES.includes(suffix);
                            }
                            return false;
                          });

                          if (tokenMatch) {
                            matchesItem = true;
                          } else if (itemNameClean.includes(' ')) {
                            // Multi-word phrase: must be bounded by word boundaries or non-alphanumeric chars in eventText
                            const escapedItem = itemNameClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const phraseRegex = new RegExp(`(^|[\\s,.\-?!;:()\[\\]{}"'\`~])${escapedItem}([\\s,.\-?!;:()\[\\]{}"'\`~]|을|를|이|가|의|과|와|으로|로|도|에서|에게|$)`, 'i');
                            matchesItem = phraseRegex.test(eventTextClean);
                          }
                        }

                        if (!matchesItem) {
                          conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: Event '${verifiedEventId}' (${foundEventText.slice(0, 50)}...) has no causal connection to item '${item.name}'.`);
                          rejectedReasons.push(`[CAUSALITY_VIOLATION] Event '${verifiedEventId}' has no causal connection to item '${item.name}'.`);
                          actionValid = false;
                        } else {
                          consumedEventIds.add(verifiedEventId);
                        }
                      }
                    }
                  }
                }
              } else {
                // Unsupported or unverified cause
                conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: Acquisition cause '${acquisition.cause}' is not active or verified in this version.`);
                rejectedReasons.push(`[CAUSALITY_VIOLATION] Unsupported or unverified acquisition cause '${acquisition.cause}'.`);
                actionValid = false;
              }
            }
          } else {
            // YELLOW-01 Defense: Unsupported inventory operation
            conflictDetails.push(`[INVALID_ACTION] Action #${i + 1}: Unsupported inventory operation '${operation}'. Allowed operations: ADD, REMOVE, SET_QUANTITY.`);
            rejectedReasons.push(`[INVALID_ACTION] Unsupported inventory operation '${operation}'.`);
            actionValid = false;
          }
          break;
        }

        case 'UPDATE_CHARACTER_STATS': {
          const stats = action.payload;
          if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (UPDATE_CHARACTER_STATS) requires a valid stats object.`);
            actionValid = false;
            break;
          }

          const isSystemSource = proposal.source === 'GENESIS' ||
                                 proposal.source === 'SYSTEM' ||
                                 proposal.source === 'SAVE_HYDRATION' ||
                                 proposal.source === 'CLOUD_RESTORE' ||
                                 proposal.source === 'ENGINE_INTERNAL' ||
                                 isEngineAuthorized(proposal);

          for (const [statKey, value] of Object.entries(stats)) {
            // Metadata keys for grounding bypass stat checks
            if (statKey === 'cause' || statKey === 'verifiedEventId' || statKey === 'grounding' || statKey === 'reason') {
              continue;
            }

            // BUG-06 Defense: Reject unknown/unauthorized stat keys
            if (!ALLOWED_STAT_KEYS.has(statKey)) {
              rejectedReasons.push(`[INVALID_STAT_KEY] Action #${i + 1}: Unknown or unauthorized stat key '${statKey}'. Allowed keys: ${Array.from(ALLOWED_STAT_KEYS).join(', ')}`);
              actionValid = false;
              continue;
            }
            // YELLOW-02 Defense: Enforce exact constitution bounds (integer 1-30)
            if (typeof value !== 'number' || isNaN(value) || !Number.isFinite(value) || !Number.isInteger(value) || value < 1 || value > 30) {
              rejectedReasons.push(`[INVALID_STAT_VALUE] Action #${i + 1}: Stat '${statKey}' must be a finite integer between 1 and 30. Received: ${value}`);
              actionValid = false;
              continue;
            }

            // ROOT 2 Defense: For untrusted runtime sources (LLM, PLAYER), enforce VerifiedClaim or narrative grounding
            if (!isSystemSource) {
              const currentStatValue = (draftCharacter.stats as any)?.[statKey];
              // If no mutation is happening (same value), allow no-op
              if (currentStatValue === value) {
                continue;
              }

              // 1. Check matching VerifiedClaim
              const hasClaim = hasMatchingVerifiedClaim(proposal.verifiedClaims, draftCharacter.name, statKey, value) ||
                               hasMatchingVerifiedClaim(proposal.verifiedClaims, 'protagonist', statKey, value) ||
                               hasMatchingVerifiedClaim(proposal.verifiedClaims, 'character', statKey, value) ||
                               hasMatchingVerifiedClaim(proposal.verifiedClaims, draftCharacter.name, `stats.${statKey}`, value) ||
                               hasMatchingVerifiedClaim(proposal.verifiedClaims, 'protagonist', `stats.${statKey}`, value) ||
                               hasMatchingVerifiedClaim(proposal.verifiedClaims, 'character', `stats.${statKey}`, value);

              if (!hasClaim) {
                conflictDetails.push(
                  `[PROVENANCE_VIOLATION] Action #${i + 1}: UPDATE_CHARACTER_STATS for stat '${statKey}' (${currentStatValue ?? 10} -> ${value}) lacks verified claim for runtime source '${proposal.source}'.`
                );
                rejectedReasons.push(
                  `[PROVENANCE_VIOLATION] Unbacked stat mutation for '${statKey}' is rejected without VerifiedClaim.`
                );
                actionValid = false;
              }
            }
          }
          break;
        }

        case 'ADD_NARRATIVE_SEED': {
          const seed = action.payload;
          if (!seed || typeof seed !== 'object' || !seed.id || typeof seed.id !== 'string' || !seed.content || typeof seed.content !== 'string') {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (ADD_NARRATIVE_SEED) requires valid seed string 'id' and 'content'.`);
            actionValid = false;
          } else if (draftWorld.seeds.some(s => s.id === seed.id)) {
            conflictDetails.push(`[SEED_CONFLICT] Action #${i + 1}: Narrative seed with ID '${seed.id}' already exists.`);
            rejectedReasons.push(`[SEED_CONFLICT] Duplicate narrative seed ID '${seed.id}'.`);
            actionValid = false;
          } else {
            // Article 47 Defense: Active narrative seed count limit (max 3 active seeds)
            const activeSeedCount = draftWorld.seeds.filter(s => s.status === 'active' || s.status === undefined).length;
            if (activeSeedCount >= 3 && seed.status !== 'resolved') {
              conflictDetails.push(`[SEED_LIMIT_EXCEEDED] Action #${i + 1}: Maximum active narrative seeds (3) reached. Current active seeds: ${activeSeedCount}.`);
              rejectedReasons.push(`[SEED_LIMIT_EXCEEDED] Cannot add more than 3 active narrative seeds concurrently.`);
              actionValid = false;
            }
          }
          break;
        }

        case 'RESOLVE_NARRATIVE_SEED': {
          const { id } = action.payload;
          if (!id || typeof id !== 'string') {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (RESOLVE_NARRATIVE_SEED) requires string 'id'.`);
            actionValid = false;
            break;
          }
          const existingSeed = draftWorld.seeds.find(s => s.id === id);
          if (!existingSeed) {
            rejectedReasons.push(`[NON_EXISTENT_SEED] Action #${i + 1}: Cannot resolve non-existent seed ID '${id}'.`);
            actionValid = false;
          } else if (existingSeed.status !== 'active') {
            conflictDetails.push(`[SEED_ALREADY_RESOLVED] Action #${i + 1}: Cannot resolve seed ID '${id}' because its status is '${existingSeed.status}' (expected 'active').`);
            rejectedReasons.push(`[SEED_ALREADY_RESOLVED] Seed '${id}' is already resolved or inactive.`);
            actionValid = false;
          }
          break;
        }

        case 'ADVANCE_CHAPTER': {
          const payload = action.payload;
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (ADVANCE_CHAPTER) requires a valid payload object.`);
            actionValid = false;
          } else {
            if (typeof payload.currentChapter !== 'string' || payload.currentChapter.trim().length === 0) {
              rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (ADVANCE_CHAPTER) requires a non-empty string 'currentChapter'.`);
              actionValid = false;
            }

            if (payload.upcomingChapters !== undefined) {
              if (!Array.isArray(payload.upcomingChapters) || !payload.upcomingChapters.every((c: any) => typeof c === 'string' && c.trim().length > 0)) {
                rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (ADVANCE_CHAPTER) 'upcomingChapters' must be an array of non-empty strings.`);
                actionValid = false;
              } else if (payload.upcomingChapters.length > 3) {
                conflictDetails.push(`[CHAPTER_OVERFLOW] Action #${i + 1}: 'upcomingChapters' array length (${payload.upcomingChapters.length}) exceeds maximum limit of 3 chapters.`);
                rejectedReasons.push(`[CHAPTER_OVERFLOW] 'upcomingChapters' cannot contain more than 3 chapters.`);
                actionValid = false;
              }
            }
          }
          break;
        }

        case 'RECORD_OFFSCREEN_EVENT': {
          const payload = action.payload;
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (RECORD_OFFSCREEN_EVENT) requires a valid payload object.`);
            actionValid = false;
          } else {
            if (typeof payload.eventDescription !== 'string' || payload.eventDescription.trim().length === 0) {
              rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (RECORD_OFFSCREEN_EVENT) requires non-empty string 'eventDescription'.`);
              actionValid = false;
            }
            if (payload.visibility !== undefined && !ALLOWED_VISIBILITY.has(payload.visibility)) {
              rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (RECORD_OFFSCREEN_EVENT) invalid visibility '${payload.visibility}'.`);
              actionValid = false;
            }
          }
          break;
        }

        case 'SET_CHARACTER_SECRET': {
          const payload = action.payload;
          if (!payload || typeof payload !== 'object' || typeof payload.secret !== 'string') {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (SET_CHARACTER_SECRET) requires a string 'secret'.`);
            actionValid = false;
          } else {
            // Provenance Boundary & Article 3, 4, 16 Defense: Character secret is EVIDENCE_REQUIRED.
            // Untrusted runtime sources (LLM, PLAYER, unauthenticated external calls) cannot invent or mutate character secrets without pre-existing canonical evidence.
            if (!isEngineAuthorized(proposal)) {
              conflictDetails.push(`[PROVENANCE_VIOLATION] Action #${i + 1}: Setting or mutating character secret via untrusted source '${proposal.source}' is prohibited without independent canonical evidence.`);
              rejectedReasons.push(`[PROVENANCE_VIOLATION] Character secret cannot be modified or established by source '${proposal.source}' without independent canonical evidence.`);
              actionValid = false;
            }
          }
          break;
        }

        case 'RECORD_PHYSICAL_DEFECT': {
          const payload = action.payload;
          if (!payload || typeof payload !== 'object' || typeof payload.defect !== 'string' || payload.defect.trim().length === 0) {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (RECORD_PHYSICAL_DEFECT) requires a non-empty string 'defect'.`);
            actionValid = false;
          } else if (draftCharacter.physicalDefect && draftCharacter.physicalDefect.trim().length > 0) {
            // Article 41 Defense: Permanent physical defect immutability
            // Once recorded, a defect cannot be overwritten or altered via RECORD_PHYSICAL_DEFECT
            conflictDetails.push(`[PHYSICAL_DEFECT_IMMUTABILITY] Action #${i + 1}: Character already has permanent physicalDefect '${draftCharacter.physicalDefect}'. Cannot overwrite.`);
            rejectedReasons.push(`[PHYSICAL_DEFECT_IMMUTABILITY] Permanent physical defect is already established and cannot be overwritten.`);
            actionValid = false;
          }
          break;
        }

        case 'RECORD_DICE_RESULT': {
          const { targetDC, rollValue } = action.payload || {};
          if (typeof targetDC !== 'number' || isNaN(targetDC) || !Number.isFinite(targetDC) || targetDC < 1 || targetDC > 20 || !Number.isInteger(targetDC)) {
            rejectedReasons.push(`[INVALID_DC] Action #${i + 1}: Target DC must be an integer between 1 and 20. Received: ${targetDC}`);
            actionValid = false;
          }
          // Article 16 & Article 40 Defense: LLM cannot inject or force rollValue
          if (proposal.source === 'LLM' && rollValue !== undefined) {
            conflictDetails.push(`[DICE_AUTHORITY_VIOLATION] Action #${i + 1}: LLM cannot provide rollValue in RECORD_DICE_RESULT. Dice roll is player/engine sovereign.`);
            rejectedReasons.push(`[DICE_AUTHORITY_VIOLATION] LLM is not authorized to determine or record rollValue.`);
            actionValid = false;
          } else if (rollValue !== undefined && (typeof rollValue !== 'number' || isNaN(rollValue) || !Number.isFinite(rollValue) || rollValue < 1 || rollValue > 20 || !Number.isInteger(rollValue))) {
            rejectedReasons.push(`[INVALID_ROLL] Action #${i + 1}: Raw d20 roll must be an integer between 1 and 20. Received: ${rollValue}`);
            actionValid = false;
          }
          break;
        }

        case 'OVERWRITE_WORLD_INFO': {
          const incoming = action.payload;
          if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming) || typeof incoming.worldName !== 'string') {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (OVERWRITE_WORLD_INFO) requires a valid WorldInfo object with string 'worldName'.`);
            actionValid = false;
          } else {
            // World Name Immutability Check
            if (draftWorld.worldName && draftWorld.worldName.trim().length > 0 && incoming.worldName !== draftWorld.worldName && !isEngineAuthorized(proposal)) {
              conflictDetails.push(`[IMMUTABLE_FIELD_PROTECTION] Action #${i + 1}: Cannot alter canonical worldName from '${draftWorld.worldName}' to '${incoming.worldName}'.`);
              rejectedReasons.push(`[IMMUTABLE_FIELD_PROTECTION] World name is immutable.`);
              actionValid = false;
            }

            // Collect all historically dead NPC IDs from draft and history
            const deadNpcIds = new Set<string>();
            for (const npc of draftWorld.npcs) {
              if (npc.status === 'DEAD') {
                deadNpcIds.add(npc.id);
              }
            }
            if (historyRecords) {
              for (const rec of historyRecords) {
                if (rec.actionType === 'SET_NPC_STATUS' && rec.details && rec.details.includes('DEAD')) {
                  const match = rec.details.match(/"id"\s*:\s*"([^"]+)"/) || rec.details.match(/"npcId"\s*:\s*"([^"]+)"/);
                  if (match && match[1]) {
                    deadNpcIds.add(match[1]);
                  }
                }
              }
            }

            // BUG-02 Defense: if arrays are supplied, they must be valid arrays
            if (incoming.npcs !== undefined) {
              if (!Array.isArray(incoming.npcs)) {
                rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: OVERWRITE_WORLD_INFO 'npcs' must be an array.`);
                actionValid = false;
              } else {
                const seenNpcIds = new Set<string>();
                const seenNpcNames = new Set<string>();
                for (const incNpc of incoming.npcs) {
                  if (!incNpc || typeof incNpc !== 'object' || typeof incNpc.id !== 'string' || !incNpc.id.trim() || typeof incNpc.name !== 'string' || !incNpc.name.trim()) {
                    rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: OVERWRITE_WORLD_INFO 'npcs' must contain valid NPC objects with string 'id' and 'name'.`);
                    actionValid = false;
                    continue;
                  }
                  if (seenNpcIds.has(incNpc.id)) {
                    rejectedReasons.push(`[NPC_CONFLICT] Action #${i + 1}: OVERWRITE_WORLD_INFO contains duplicate NPC ID '${incNpc.id}'.`);
                    actionValid = false;
                  }
                  seenNpcIds.add(incNpc.id);

                  const cleanName = incNpc.name.trim().toLowerCase();
                  if (seenNpcNames.has(cleanName)) {
                    rejectedReasons.push(`[NPC_CONFLICT] Action #${i + 1}: OVERWRITE_WORLD_INFO contains duplicate NPC name '${incNpc.name}'.`);
                    actionValid = false;
                  }
                  seenNpcNames.add(cleanName);

                  if ((incNpc as any).trust !== undefined && (typeof (incNpc as any).trust !== 'number' || isNaN((incNpc as any).trust) || !Number.isFinite((incNpc as any).trust) || (incNpc as any).trust < 0 || (incNpc as any).trust > 100 || !Number.isInteger((incNpc as any).trust))) {
                    rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: OVERWRITE_WORLD_INFO NPC '${incNpc.name}' trust must be a finite integer between 0 and 100.`);
                    actionValid = false;
                  }

                  const isHistoricallyDead = deadNpcIds.has(incNpc.id);
                  if (isHistoricallyDead && incNpc.status !== 'DEAD') {
                    conflictDetails.push(`[DEAD_NPC_STATUS_PROTECTION] Action #${i + 1}: Cannot alter status of historically DEAD NPC '${incNpc.name || incNpc.id}' (${incNpc.id}) to '${incNpc.status}' via OVERWRITE_WORLD_INFO.`);
                    rejectedReasons.push(`[DEAD_NPC_STATUS_PROTECTION] Cannot revive dead NPC via standard status update or world overwrite.`);
                    actionValid = false;
                  }
                }
              }
            }
            if (incoming.factions !== undefined) {
              if (!Array.isArray(incoming.factions)) {
                rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: OVERWRITE_WORLD_INFO 'factions' must be an array.`);
                actionValid = false;
              } else {
                const seenFacIds = new Set<string>();
                const seenFacNames = new Set<string>();
                for (const fac of incoming.factions) {
                  if (!fac || typeof fac !== 'object' || typeof fac.id !== 'string' || !fac.id.trim() || typeof fac.name !== 'string' || !fac.name.trim()) {
                    rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: OVERWRITE_WORLD_INFO factions must be valid objects with string 'id' and 'name'.`);
                    actionValid = false;
                    break;
                  }
                  if (seenFacIds.has(fac.id)) {
                    rejectedReasons.push(`[FACTION_CONFLICT] Action #${i + 1}: OVERWRITE_WORLD_INFO contains duplicate Faction ID '${fac.id}'.`);
                    actionValid = false;
                  }
                  seenFacIds.add(fac.id);

                  const cleanName = fac.name.trim().toLowerCase();
                  if (seenFacNames.has(cleanName)) {
                    rejectedReasons.push(`[FACTION_CONFLICT] Action #${i + 1}: OVERWRITE_WORLD_INFO contains duplicate Faction name '${fac.name}'.`);
                    actionValid = false;
                  }
                  seenFacNames.add(cleanName);

                  if (fac.influence !== undefined) {
                    let facInfNum: number | null = null;
                    if (typeof fac.influence === 'number') {
                      if (isNaN(fac.influence) || !Number.isFinite(fac.influence) || fac.influence < 0 || fac.influence > 100 || !Number.isInteger(fac.influence)) {
                        rejectedReasons.push(`[INVALID_FACTION_INFLUENCE] Action #${i + 1}: OVERWRITE_WORLD_INFO faction '${fac.name}' influence must be a finite integer between 0 and 100.`);
                        actionValid = false;
                      } else {
                        facInfNum = fac.influence;
                      }
                    } else if (typeof fac.influence === 'string') {
                      if (/^-?\d+$/.test(fac.influence.trim())) {
                        const num = Number(fac.influence);
                        if (num < 0 || num > 100) {
                          rejectedReasons.push(`[INVALID_FACTION_INFLUENCE] Action #${i + 1}: OVERWRITE_WORLD_INFO faction '${fac.name}' influence must be a finite integer between 0 and 100.`);
                          actionValid = false;
                        } else {
                          facInfNum = num;
                        }
                      }
                    }
                  }
                }
                if (actionValid) {
                  let totalOverwriteInf = 0;
                  for (const fac of incoming.factions) {
                    if (typeof fac.influence === 'number' && Number.isFinite(fac.influence)) {
                      totalOverwriteInf += fac.influence;
                    } else if (typeof fac.influence === 'string' && /^-?\d+$/.test(fac.influence.trim())) {
                      totalOverwriteInf += Number(fac.influence);
                    }
                  }
                  if (totalOverwriteInf > 100) {
                    conflictDetails.push(`[FACTION_INFLUENCE_EXCEEDED] Action #${i + 1}: OVERWRITE_WORLD_INFO total cumulative faction influence (${totalOverwriteInf}) exceeds 100.`);
                    rejectedReasons.push(`[FACTION_INFLUENCE_EXCEEDED] Total cumulative faction influence cannot exceed 100.`);
                    actionValid = false;
                  }
                }
              }
            }
            if (incoming.seeds !== undefined) {
              if (!Array.isArray(incoming.seeds)) {
                rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: OVERWRITE_WORLD_INFO 'seeds' must be an array.`);
                actionValid = false;
              } else {
                const activeSeeds = incoming.seeds.filter((s: any) => s && s.status === 'active');
                if (activeSeeds.length > 3) {
                  conflictDetails.push(`[SEED_LIMIT_EXCEEDED] Action #${i + 1}: OVERWRITE_WORLD_INFO active seeds count (${activeSeeds.length}) exceeds maximum limit of 3.`);
                  rejectedReasons.push(`[SEED_LIMIT_EXCEEDED] Maximum active narrative seeds limit (3) exceeded.`);
                  actionValid = false;
                }

                for (const seed of incoming.seeds) {
                  if (!seed || typeof seed !== 'object' || typeof seed.id !== 'string' || typeof seed.content !== 'string') {
                    rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: OVERWRITE_WORLD_INFO seeds must be valid objects with string 'id' and 'content'.`);
                    actionValid = false;
                    break;
                  }
                  const draftSeed = draftWorld.seeds.find(s => s.id === seed.id);
                  if (draftSeed && draftSeed.status === 'resolved' && seed.status !== 'resolved') {
                    conflictDetails.push(`[RESOLVED_SEED_IMMUTABILITY] Action #${i + 1}: Resolved narrative seed '${draftSeed.id}' cannot be reopened via OVERWRITE_WORLD_INFO.`);
                    rejectedReasons.push(`[RESOLVED_SEED_IMMUTABILITY] Resolved narrative seed is permanent.`);
                    actionValid = false;
                  }
                }
              }
            }
          }
          break;
        }

        case 'OVERWRITE_CHARACTER': {
          const incoming = action.payload;
          if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming) || typeof incoming.name !== 'string') {
            rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1} (OVERWRITE_CHARACTER) requires a valid Character object with string 'name'.`);
            actionValid = false;
          } else {
            const isGenesisInitial = proposal.source === 'GENESIS' && currentState.stateVersion === 1 && currentState.turn === 1 && currentState.lastCommittedEventId === null;

            // Character Name Immutability Check
            if (draftCharacter.name && draftCharacter.name.trim().length > 0 && incoming.name !== draftCharacter.name && !isEngineAuthorized(proposal) && !isGenesisInitial) {
              conflictDetails.push(`[IMMUTABLE_FIELD_PROTECTION] Action #${i + 1}: Cannot rename canonical protagonist from '${draftCharacter.name}' to '${incoming.name}'.`);
              rejectedReasons.push(`[IMMUTABLE_FIELD_PROTECTION] Protagonist name is immutable.`);
              actionValid = false;
            }

            // Secret Provenance Check
            if (incoming.secret !== undefined && incoming.secret !== draftCharacter.secret && !isEngineAuthorized(proposal)) {
              conflictDetails.push(`[PROVENANCE_VIOLATION] Action #${i + 1}: Protagonist secret cannot be modified via OVERWRITE_CHARACTER without engine authorization.`);
              rejectedReasons.push(`[PROVENANCE_VIOLATION] Secret modification via OVERWRITE_CHARACTER is unauthorized.`);
              actionValid = false;
            }

            // Physical Defect Immutability Check: existing defect must never be erased or negated
            if (draftCharacter.physicalDefect && draftCharacter.physicalDefect.trim().length > 0) {
              if (incoming.physicalDefect !== undefined) {
                const incomingStr = String(incoming.physicalDefect || '').trim();
                const NEGATION_PATTERNS = [
                  /치료/i, /회복/i, /치유/i, /완치/i, /복원/i, /복구/i, /정상/i, /해결/i, /제거/i, /없음/i, /사라짐/i,
                  /heal/i, /cure/i, /recover/i, /restore/i, /fix/i, /remove/i, /none/i, /negat/i, /clear/i, /not\s+/i
                ];
                if (incomingStr.length === 0) {
                  conflictDetails.push(`[PHYSICAL_DEFECT_IMMUTABILITY] Action #${i + 1}: Cannot erase existing canonical physicalDefect '${draftCharacter.physicalDefect}' via OVERWRITE_CHARACTER.`);
                  rejectedReasons.push(`[PHYSICAL_DEFECT_IMMUTABILITY] Established physical defect is permanent and cannot be removed.`);
                  actionValid = false;
                } else if (NEGATION_PATTERNS.some(p => p.test(incomingStr))) {
                  conflictDetails.push(`[PHYSICAL_DEFECT_IMMUTABILITY] Action #${i + 1}: Cannot negate or cure existing canonical physicalDefect '${draftCharacter.physicalDefect}' with '${incomingStr}'.`);
                  rejectedReasons.push(`[PHYSICAL_DEFECT_IMMUTABILITY] Physical defect cannot be negated or cured.`);
                  actionValid = false;
                } else {
                  const existingParts = draftCharacter.physicalDefect.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
                  const incomingParts = incomingStr.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
                  const hasAllExisting = existingParts.every(ex => incomingParts.some(inc => inc === ex));
                  if (!hasAllExisting) {
                    conflictDetails.push(`[PHYSICAL_DEFECT_IMMUTABILITY] Action #${i + 1}: Cannot replace or modify existing physicalDefect '${draftCharacter.physicalDefect}' with '${incomingStr}'.`);
                    rejectedReasons.push(`[PHYSICAL_DEFECT_IMMUTABILITY] Existing physical defect must be preserved.`);
                    actionValid = false;
                  }
                }
              }
            }

            // Timeline Provenance Protection: Non-authoritative runtime sources cannot inject, mutate, or forge timeline via OVERWRITE_CHARACTER
            if (incoming.timeline !== undefined && !isEngineAuthorized(proposal) && !isGenesisInitial) {
              const canonicalTimeline = draftCharacter.timeline || [];
              const isTimelineIdentical =
                Array.isArray(incoming.timeline) &&
                incoming.timeline.length === canonicalTimeline.length &&
                incoming.timeline.every((tItem: unknown, idx: number) => {
                  const cItem = canonicalTimeline[idx] as unknown;
                  if (typeof tItem === 'string' && typeof cItem === 'string') {
                    return tItem === cItem;
                  }
                  if (tItem && typeof tItem === 'object' && cItem && typeof cItem === 'object') {
                    return JSON.stringify(tItem) === JSON.stringify(cItem);
                  }
                  return tItem === cItem;
                });

              if (!isTimelineIdentical) {
                conflictDetails.push(`[PROVENANCE_VIOLATION] Action #${i + 1}: Protagonist timeline cannot be modified via OVERWRITE_CHARACTER without engine authorization.`);
                rejectedReasons.push(`[PROVENANCE_VIOLATION] Timeline modification via OVERWRITE_CHARACTER is unauthorized for source '${proposal.source}'.`);
                actionValid = false;
              }
            }

            // BUG-07 Defense: validate nested structures if supplied
            if (incoming.inventory !== undefined) {
              if (!Array.isArray(incoming.inventory)) {
                rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: OVERWRITE_CHARACTER 'inventory' must be an array.`);
                actionValid = false;
              } else {
                for (const item of incoming.inventory) {
                  if (!item || typeof item !== 'object' || typeof item.id !== 'string' || typeof item.name !== 'string') {
                    rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: OVERWRITE_CHARACTER inventory items must be valid objects with string 'id' and 'name'.`);
                    actionValid = false;
                    break;
                  }
                  if (item.quantity !== undefined && (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity < 0 || !Number.isInteger(item.quantity))) {
                    rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: OVERWRITE_CHARACTER inventory item '${item.name}' quantity must be a finite non-negative integer.`);
                    actionValid = false;
                    break;
                  }
                }

                // Article 9 & 16 Causality Protection: Runtime Inventory Overwrite Immunity
                // Non-genesis/non-hydration sources cannot forge, mutate, or wipe items via OVERWRITE_CHARACTER
                if (actionValid && !isEngineAuthorized(proposal) && !isGenesisInitial) {
                  const canonicalInv = draftCharacter.inventory || [];
                  const isInvIdentical =
                    canonicalInv.length === incoming.inventory.length &&
                    canonicalInv.every((cItem, idx) => {
                      const inc = incoming.inventory[idx];
                      if (!inc || typeof inc !== 'object') return false;
                      // Strict Identity: Exact matching on ID, Name, and Quantity
                      const sameId = typeof inc.id === 'string' && inc.id === cItem.id;
                      const sameName = typeof inc.name === 'string' && inc.name === cItem.name;
                      const cQty = typeof cItem.quantity === 'number' ? cItem.quantity : 1;
                      const sameQty = typeof inc.quantity === 'number' && inc.quantity === cQty;
                      return sameId && sameName && sameQty;
                    });

                  if (!isInvIdentical) {
                    conflictDetails.push(
                      `[INVENTORY_OVERWRITE_PROHIBITED] Action #${i + 1}: Direct inventory mutation via OVERWRITE_CHARACTER is unauthorized for source '${proposal.source}'. All runtime inventory changes must use MODIFY_INVENTORY.`
                    );
                    rejectedReasons.push(
                      `[INVENTORY_OVERWRITE_PROHIBITED] Runtime inventory mutation via OVERWRITE_CHARACTER is prohibited.`
                    );
                    actionValid = false;
                  }
                }
              }
            }
            if (incoming.stats !== undefined) {
              if (typeof incoming.stats !== 'object' || incoming.stats === null || Array.isArray(incoming.stats)) {
                rejectedReasons.push(`[INVALID_ACTION] Action #${i + 1}: OVERWRITE_CHARACTER 'stats' must be an object.`);
                actionValid = false;
              } else {
                // PATCH-A Defense: Validate every stat key against ALLOWED_STAT_KEYS and ensure valid finite integers between 1 and 30
                for (const [statKey, value] of Object.entries(incoming.stats)) {
                  if (!ALLOWED_STAT_KEYS.has(statKey)) {
                    rejectedReasons.push(`[INVALID_STAT_KEY] Action #${i + 1}: OVERWRITE_CHARACTER contains unknown or unauthorized stat key '${statKey}'. Allowed keys: ${Array.from(ALLOWED_STAT_KEYS).join(', ')}`);
                    actionValid = false;
                  } else if (typeof value !== 'number' || isNaN(value) || !Number.isFinite(value) || value < 1 || !Number.isInteger(value) || value > 30) {
                    rejectedReasons.push(`[INVALID_STAT_VALUE] Action #${i + 1}: OVERWRITE_CHARACTER stat '${statKey}' must be a finite integer between 1 and 30. Received: ${value}`);
                    actionValid = false;
                  }
                }

                // C1 Defense: Non-authoritative runtime sources (PLAYER, LLM) cannot mutate established canonical character stats via OVERWRITE_CHARACTER
                if (actionValid && !isEngineAuthorized(proposal) && !isGenesisInitial) {
                  const canonicalStats = draftCharacter.stats || {
                    strength: 10,
                    agility: 10,
                    constitution: 10,
                    intelligence: 10,
                    wisdom: 10,
                    charisma: 10
                  };
                  for (const [statKey, value] of Object.entries(incoming.stats)) {
                    const currentVal = (canonicalStats as any)[statKey];
                    if (currentVal !== undefined && currentVal !== value) {
                      conflictDetails.push(
                        `[PROVENANCE_VIOLATION] Action #${i + 1}: Direct character stat mutation for '${statKey}' (${currentVal} -> ${value}) via OVERWRITE_CHARACTER is unauthorized for source '${proposal.source}'.`
                      );
                      rejectedReasons.push(
                        `[PROVENANCE_VIOLATION] Stat mutation via OVERWRITE_CHARACTER is unauthorized for source '${proposal.source}'.`
                      );
                      actionValid = false;
                      break;
                    }
                  }
                }
              }
            }
          }
          break;
        }

        default:
          rejectedReasons.push(`[UNRECOGNIZED_ACTION] Action #${i + 1} has unrecognized type '${(action as any).type}'.`);
          actionValid = false;
          break;
      }

      if (actionValid) {
        sanitizedActions.push(action);
        // Progressively apply valid action to virtual draft to feed subsequent action validations
        applyActionToDraftState(action, draftWorld, draftCharacter);
      }
    }

    const isValid = rejectedReasons.length === 0 && conflictDetails.length === 0;

    return Object.freeze({
      isValid,
      rejectedReasons: Object.freeze(rejectedReasons),
      conflictDetails: Object.freeze(conflictDetails),
      sanitizedActions: Object.freeze(isValid ? sanitizedActions : [])
    });
  }

  /**
   * Validates snapshot schema before hydration into Canonical State.
   * Ensures structural and safety invariants without modifying or guessing repair values.
   */
  public static validateSnapshotSchema(snapshot: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      errors.push('[SCHEMA_VIOLATION] Snapshot must be a non-null object.');
      return { isValid: false, errors };
    }

    // 1. stateVersion check
    if (typeof snapshot.stateVersion !== 'number' || !Number.isInteger(snapshot.stateVersion) || snapshot.stateVersion < 1) {
      errors.push(`[SCHEMA_VIOLATION] stateVersion must be a positive integer >= 1. Received: ${snapshot.stateVersion}`);
    }

    // 2. turn check
    if (typeof snapshot.turn !== 'number' || !Number.isInteger(snapshot.turn) || snapshot.turn < 0) {
      errors.push(`[SCHEMA_VIOLATION] turn must be a non-negative integer >= 0. Received: ${snapshot.turn}`);
    }

    // 3. worldInfo structure check
    if (!snapshot.worldInfo || typeof snapshot.worldInfo !== 'object' || Array.isArray(snapshot.worldInfo)) {
      errors.push('[SCHEMA_VIOLATION] snapshot.worldInfo must be a non-null object.');
    } else {
      if (typeof snapshot.worldInfo.worldName !== 'string') {
        errors.push('[SCHEMA_VIOLATION] snapshot.worldInfo.worldName must be a string.');
      }
      if (!Array.isArray(snapshot.worldInfo.npcs)) {
        errors.push('[SCHEMA_VIOLATION] snapshot.worldInfo.npcs must be an array.');
      }
      if (!Array.isArray(snapshot.worldInfo.factions)) {
        errors.push('[SCHEMA_VIOLATION] snapshot.worldInfo.factions must be an array.');
      }
      if (!Array.isArray(snapshot.worldInfo.seeds)) {
        errors.push('[SCHEMA_VIOLATION] snapshot.worldInfo.seeds must be an array.');
      }
      if (
        !snapshot.worldInfo.chapters ||
        typeof snapshot.worldInfo.chapters !== 'object' ||
        Array.isArray(snapshot.worldInfo.chapters) ||
        typeof snapshot.worldInfo.chapters.currentChapter !== 'string' ||
        !Array.isArray(snapshot.worldInfo.chapters.upcomingChapters)
      ) {
        errors.push('[SCHEMA_VIOLATION] snapshot.worldInfo.chapters must contain currentChapter string and upcomingChapters array.');
      }
    }

    // 4. character structure check
    if (!snapshot.character || typeof snapshot.character !== 'object' || Array.isArray(snapshot.character)) {
      errors.push('[SCHEMA_VIOLATION] snapshot.character must be a non-null object.');
    } else {
      if (typeof snapshot.character.name !== 'string') {
        errors.push('[SCHEMA_VIOLATION] snapshot.character.name must be a string.');
      }
      if (!Array.isArray(snapshot.character.inventory)) {
        errors.push('[SCHEMA_VIOLATION] snapshot.character.inventory must be an array.');
      }
      if (
        !snapshot.character.stats ||
        typeof snapshot.character.stats !== 'object' ||
        Array.isArray(snapshot.character.stats)
      ) {
        errors.push('[SCHEMA_VIOLATION] snapshot.character.stats must be an object.');
      } else {
        for (const [statKey, val] of Object.entries(snapshot.character.stats)) {
          if (!ALLOWED_STAT_KEYS.has(statKey)) {
            errors.push(`[SCHEMA_VIOLATION] Unknown stat key '${statKey}' in snapshot.character.stats.`);
          } else if (typeof val !== 'number' || isNaN(val) || !Number.isFinite(val) || val < 0) {
            errors.push(`[SCHEMA_VIOLATION] Stat '${statKey}' must be a finite non-negative number. Received: ${val}`);
          }
        }
      }
      if (snapshot.character.physicalDefect !== undefined && typeof snapshot.character.physicalDefect !== 'string') {
        errors.push('[SCHEMA_VIOLATION] snapshot.character.physicalDefect must be a string if defined.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
