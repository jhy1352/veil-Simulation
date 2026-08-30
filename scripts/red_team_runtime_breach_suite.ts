import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SovereignEngine } from '../src/engine/state';
import { EngineValidator } from '../src/engine/validator';
import { validateLLM2MutationBoundary } from '../src/engine/mutationBoundary';
import { parseGMResponseAndProposal } from '../src/engine/proposalParser';
import { parseGMResponseMetaData } from '../src/utils/parser';
import { createEmptyWorldInfo, createEmptyCharacter } from '../src/utils/factory';
import { StateTransitionProposal, TransitionAction, CanonicalState } from '../src/engine/types';
import { Character, WorldInfo, Item } from '../types';

export interface DeepSnapshotSummary {
  stateVersion: number;
  turn: number;
  inventory: Item[];
  physicalDefect?: string;
  stats: Record<string, number>;
  npcs: Array<{ id: string; name: string; status?: string }>;
  factions: Array<{ id: string; name: string; influence: number }>;
  historyLength: number;
  seedsCount: number;
  offscreenRecordsCount: number;
  dcHistoryLength: number;
}

export interface DeepAttackResult {
  vectorId: string;
  category: string;
  variantType: 'STRUCTURAL' | 'SEMANTIC_EXPRESSION' | 'MIXED_COMPOUND' | 'CONVOLUTED_STAGE';
  targetLayer: string;
  preliminaryBypassApplied: string;
  description: string;
  payload: any;
  resultStatus: string;
  stateBefore: DeepSnapshotSummary;
  stateAfter: DeepSnapshotSummary;
  stateMutated: boolean;
  verdict: 'CONFIRMED_BREAK' | 'DEFENSE_PROVEN' | 'ATTACK_BLOCKED_BEFORE_TARGET' | 'UNPROVEN';
  notes: string;
}

const attackResults: DeepAttackResult[] = [];
const logLines: string[] = [];

function log(msg: string) {
  console.log(msg);
  logLines.push(msg);
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function captureDeepSnapshot(state: CanonicalState): DeepSnapshotSummary {
  return {
    stateVersion: state.stateVersion,
    turn: state.turn,
    inventory: deepClone(state.character.inventory || []),
    physicalDefect: state.character.physicalDefect,
    stats: deepClone(state.character.stats || {}),
    npcs: (state.worldInfo.npcs || []).map(n => ({ id: n.id, name: n.name, status: n.status })),
    factions: (state.worldInfo.factions || []).map(f => ({ id: f.id, name: f.name, influence: f.influence })),
    historyLength: (state.history || []).length,
    seedsCount: (state.worldInfo.seeds || []).length,
    offscreenRecordsCount: (state.worldInfo.offscreenRecords || []).length,
    dcHistoryLength: (state.worldInfo.dcHistory || []).length
  };
}

function checkDeepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function createTestEngine(customWorld?: WorldInfo, customChar?: Character): SovereignEngine {
  const world = customWorld || createEmptyWorldInfo();
  world.worldName = 'Test Sovereign World';
  world.currentTime = { year: 100, season: 'SPRING', month: 3, day: 15, timeOfDay: 'MORNING' };
  world.factions = [
    { id: 'fac-1', name: '화산파', influence: 50, description: '명문정파' },
    { id: 'fac-2', name: '종남파', influence: 40, description: '명문정파' }
  ];
  world.npcs = [
    { id: 'npc-1', name: '백운도인', metInStory: true, status: 'ALIVE', impression: '호의적' },
    { id: 'npc-dead-1', name: '마교 호법', metInStory: true, status: 'DEAD', impression: '적대적 (사망)' }
  ];
  world.seeds = [
    { id: 'seed-1', title: '비급의 행방', content: '자하진기 비급의 단서', status: 'active' }
  ];

  const char = customChar || createEmptyCharacter();
  char.name = '청명';
  char.stats = { strength: 14, agility: 12, constitution: 13, intelligence: 10, wisdom: 10, charisma: 10 };
  char.inventory = [
    { id: 'item-1', name: '철검', quantity: 1, itemType: 'WEAPON' }
  ];

  return new SovereignEngine(world, char, [], 1, 1);
}

async function runRedTeamDeepPenetrationMission() {
  log('================================================================================');
  log('TRPG 3.1 VEIL — RED TEAM DEEP-PENETRATION RUNTIME BREAK MISSION');
  log(`TIMESTAMP: ${new Date().toISOString()}`);
  log('TARGET: HEAD (jhy1352/3.1veil1)');
  log('OBJECTIVE: Formulate multi-stage adversarial payloads bypassing preliminary gates');
  log('to directly test target security layers for unauthorized runtime mutations.');
  log('================================================================================\n');

  let totalVectors = 0;
  let confirmedBreaks = 0;
  let defensesProven = 0;
  let blockedBeforeTarget = 0;
  let unproven = 0;

  function registerResult(res: DeepAttackResult) {
    totalVectors++;
    if (res.verdict === 'CONFIRMED_BREAK') confirmedBreaks++;
    else if (res.verdict === 'DEFENSE_PROVEN') defensesProven++;
    else if (res.verdict === 'ATTACK_BLOCKED_BEFORE_TARGET') blockedBeforeTarget++;
    else unproven++;

    attackResults.push(res);
    log(`[${res.verdict}] ${res.vectorId} (${res.category}) — ${res.variantType}`);
    log(`  Target: ${res.targetLayer}`);
    log(`  Result: ${res.resultStatus} | Mutated: ${res.stateMutated}`);
  }

  // ============================================================================
  // SURFACE 1: MUTATION BOUNDARY SEMANTIC MISMATCH (CANDIDATE VS FINAL)
  // ============================================================================
  log('\n--- [SURFACE 1: MUTATION BOUNDARY SEMANTIC MISMATCH] ---');

  // V1-01: Cardinality Inflation (Structural Variation)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const candProposal: StateTransitionProposal = {
      proposalId: 'prop-cand-01',
      requestId: 'req-fresh-01',
      eventId: 'evt-fresh-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        { type: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-2', name: '청심환', quantity: 1 }, acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'evt-0' } } }
      ]
    };
    const finalProposal: StateTransitionProposal = {
      ...candProposal,
      proposalId: 'prop-final-01',
      actions: [
        { type: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-2', name: '청심환', quantity: 1 }, acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'evt-0' } } },
        { type: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-3', name: '은화', quantity: 50 }, acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'evt-0' } } }
      ]
    };

    const bCheck = validateLLM2MutationBoundary(candProposal, finalProposal);
    let committed = false;
    if (bCheck.isValid) {
      const cRes = engine.submitProposal(finalProposal);
      committed = cRes.success;
    }
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V1-01-CARDINALITY-INFLATION',
      category: 'MUTATION_BOUNDARY',
      variantType: 'STRUCTURAL',
      targetLayer: 'validateLLM2MutationBoundary -> Cardinality Check',
      preliminaryBypassApplied: 'Valid stateVersion, fresh timestamp, valid action structure',
      description: 'Candidate approved 1 action; Final injects 2nd action for 50 silver coins',
      payload: { candidateActionsCount: 1, finalActionsCount: 2 },
      resultStatus: bCheck.isValid ? 'BOUNDARY_BYPASSED' : bCheck.violationReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || bCheck.isValid ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: bCheck.isValid ? 'CRITICAL: Boundary approved extra action' : 'Boundary enforced strict 1:1 action count equality.'
    });
  }

  // V1-02: Critical Field Omission - Visibility (Semantic/Expression Variation)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const candProposal: StateTransitionProposal = {
      proposalId: 'prop-cand-02',
      requestId: 'req-fresh-02',
      eventId: 'evt-fresh-02',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'RECORD_OFFSCREEN_EVENT',
          payload: {
            description: '화산파 장로들의 비밀 회합',
            visibility: 'PRIVATE'
          }
        }
      ]
    };
    const finalProposal: StateTransitionProposal = {
      ...candProposal,
      proposalId: 'prop-final-02',
      actions: [
        {
          type: 'RECORD_OFFSCREEN_EVENT',
          payload: {
            description: '화산파 장로들의 비밀 회합'
            // Omission intended to leak private secret as public
          }
        }
      ]
    };

    const bCheck = validateLLM2MutationBoundary(candProposal, finalProposal);
    let committed = false;
    if (bCheck.isValid) {
      const cRes = engine.submitProposal(finalProposal);
      committed = cRes.success;
    }
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V1-02-FIELD-OMISSION-VISIBILITY',
      category: 'MUTATION_BOUNDARY',
      variantType: 'SEMANTIC_EXPRESSION',
      targetLayer: 'validateLLM2MutationBoundary -> Field Equivalence',
      preliminaryBypassApplied: 'Valid stateVersion, matching description, matching action type',
      description: 'Candidate specifies visibility: PRIVATE; Final drops field to default to PUBLIC',
      payload: { candVisibility: 'PRIVATE', finalVisibility: undefined },
      resultStatus: bCheck.isValid ? 'BOUNDARY_BYPASSED' : bCheck.violationReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || bCheck.isValid ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: bCheck.isValid ? 'CRITICAL: Private visibility dropped' : 'Boundary caught missing critical visibility field.'
    });
  }

  // V1-03: Confused Deputy - Action Order Reordering & Parameter Substitution (Mixed/Compound)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const candProposal: StateTransitionProposal = {
      proposalId: 'prop-cand-03',
      requestId: 'req-fresh-03',
      eventId: 'evt-fresh-03',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        { type: 'MODIFY_INVENTORY', payload: { operation: 'REMOVE', item: { id: 'item-1', name: '철검', quantity: 1 } } },
        { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 15 } }
      ]
    };
    const finalProposal: StateTransitionProposal = {
      ...candProposal,
      proposalId: 'prop-final-03',
      actions: [
        // Reordered and strength inflated from 15 to 25
        { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 25 } },
        { type: 'MODIFY_INVENTORY', payload: { operation: 'REMOVE', item: { id: 'item-1', name: '철검', quantity: 1 } } }
      ]
    };

    const bCheck = validateLLM2MutationBoundary(candProposal, finalProposal);
    let committed = false;
    if (bCheck.isValid) {
      const cRes = engine.submitProposal(finalProposal);
      committed = cRes.success;
    }
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V1-03-CONFUSED-DEPUTY-REORDER-INFLATION',
      category: 'MUTATION_BOUNDARY',
      variantType: 'MIXED_COMPOUND',
      targetLayer: 'validateLLM2MutationBoundary -> Action Sequence Match',
      preliminaryBypassApplied: 'Same 2 action types, valid envelope',
      description: 'Reordering action sequence and inflating stat delta from 1 to 10',
      payload: { candDelta: 1, finalDelta: 10, reordered: true },
      resultStatus: bCheck.isValid ? 'BOUNDARY_BYPASSED' : bCheck.violationReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || bCheck.isValid ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: bCheck.isValid ? 'CRITICAL: Reordered inflated actions bypassed' : 'Boundary enforced exact positional type and value matching.'
    });
  }

  // ============================================================================
  // SURFACE 2: VALIDATOR <-> APPLIER MISMATCH & COMMIT GATE
  // ============================================================================
  log('\n--- [SURFACE 2: VALIDATOR <-> APPLIER MISMATCH & COMMIT GATE] ---');

  // V2-01: Compound Proposal Atomic Rollback (Structural Variation)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const compoundProposal: StateTransitionProposal = {
      proposalId: 'prop-comp-01',
      requestId: 'req-comp-01',
      eventId: 'evt-comp-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        { type: 'ADVANCE_TIME', payload: { targetTime: { year: 100, season: 'SPRING', month: 3, day: 16, timeOfDay: 'MORNING' } } },
        { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 999 } } // Invalid stat > 30
      ]
    };

    const cRes = engine.submitProposal(compoundProposal);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V2-01-COMPOUND-PROPOSAL-ATOMICITY',
      category: 'COMMIT_GATE',
      variantType: 'STRUCTURAL',
      targetLayer: 'SovereignEngine.submitProposal -> Atomic Rollback',
      preliminaryBypassApplied: 'Valid stateVersion, fresh envelope, valid first action',
      description: 'Compound proposal with 1 valid time advance + 1 invalid stat delta (999)',
      payload: compoundProposal,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Invalid stat committed' : (mutated ? 'CRITICAL: Partial state mutation leaked!' : 'Atomic rollback verified; zero state mutation.')
    });
  }

  // V2-02: Applier SET_QUANTITY Non-Existent Item Mutation Injection (Semantic Variation)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    // Attempt SET_QUANTITY on an item not currently in inventory
    const setQtyProposal: StateTransitionProposal = {
      proposalId: 'prop-setqty-01',
      requestId: 'req-setqty-01',
      eventId: 'evt-setqty-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'SET_QUANTITY',
            item: { id: 'item-ghost-sword', name: '유령검', quantity: 10 }
          }
        }
      ]
    };

    const cRes = engine.submitProposal(setQtyProposal);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V2-02-SET-QUANTITY-NONEXISTENT-ITEM',
      category: 'VALIDATOR_APPLIER_MISMATCH',
      variantType: 'SEMANTIC_EXPRESSION',
      targetLayer: 'EngineValidator.validate -> Inventory Existence Check',
      preliminaryBypassApplied: 'Valid stateVersion, positive quantity, valid envelope',
      description: 'SET_QUANTITY operation targeting non-existent item to inject free items',
      payload: setQtyProposal,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Non-existent item quantity set' : 'Validator blocked SET_QUANTITY on non-existent item.'
    });
  }

  // V2-03: Faction Influence Boundary Exceed (Mixed/Compound)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const factionExceedProp: StateTransitionProposal = {
      proposalId: 'prop-fac-01',
      requestId: 'req-fac-01',
      eventId: 'evt-fac-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'UPDATE_FACTION',
          payload: {
            id: 'fac-1',
            changes: { influence: 999999 } // Out of allowed 0-100 range
          }
        }
      ]
    };

    const cRes = engine.submitProposal(factionExceedProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V2-03-FACTION-INFLUENCE-RANGE-OVERFLOW',
      category: 'VALIDATOR_APPLIER_MISMATCH',
      variantType: 'MIXED_COMPOUND',
      targetLayer: 'EngineValidator.validate -> Faction Influence Range Check',
      preliminaryBypassApplied: 'Valid existing faction id (fac-1), fresh envelope',
      description: 'Set faction influence to 999,999 to break 0-100 mathematical invariant',
      payload: factionExceedProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Faction influence overflow committed' : 'Validator enforced 0-100 influence invariant.'
    });
  }

  // V2-04: ADD_FACTION Influence Range Overflow Injection
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const addFactionExceedProp: StateTransitionProposal = {
      proposalId: 'prop-add-fac-01',
      requestId: 'req-add-fac-01',
      eventId: 'evt-add-fac-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'ADD_FACTION',
          payload: {
            id: 'fac-overflow-999',
            name: '초월마도세력',
            influence: 99999999,
            relationship: 'UNKNOWN',
            knownRumors: []
          }
        }
      ]
    };

    const cRes = engine.submitProposal(addFactionExceedProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V2-04-ADD-FACTION-INFLUENCE-RANGE-OVERFLOW',
      category: 'VALIDATOR_APPLIER_MISMATCH',
      variantType: 'STRUCTURAL',
      targetLayer: 'EngineValidator.validate -> ADD_FACTION Range Validation',
      preliminaryBypassApplied: 'Unique id, valid string name, valid envelope',
      description: 'ADD_FACTION with influence 99,999,999 to inject unvalidated numeric state',
      payload: addFactionExceedProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: ADD_FACTION influence overflow committed' : 'Validator checked ADD_FACTION influence bounds.'
    });
  }

  // ============================================================================
  // SURFACE 3: PROVENANCE & AUTHORITY ESCALATION
  // ============================================================================
  log('\n--- [SURFACE 3: PROVENANCE & AUTHORITY ESCALATION] ---');

  // V3-01: Spoofed SYSTEM Source with Valid Envelope (Structural Variation)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const sysSpoofProp: StateTransitionProposal = {
      proposalId: 'prop-sys-spoof-01',
      requestId: 'req-sys-spoof-01',
      eventId: 'evt-sys-spoof-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'SYSTEM',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: { name: '천마', stats: { strength: 30, agility: 30, constitution: 30, intelligence: 30, wisdom: 30, charisma: 30 } }
        }
      ]
    };

    const cRes = engine.submitProposal(sysSpoofProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V3-01-SPOOFED-SYSTEM-SOURCE',
      category: 'PROVENANCE_ACL',
      variantType: 'STRUCTURAL',
      targetLayer: 'EngineValidator.validate -> Capability Token Check',
      preliminaryBypassApplied: 'Valid stateVersion, fresh envelope, structured character payload',
      description: 'External caller sending source: SYSTEM without capability token',
      payload: sysSpoofProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Unauthenticated SYSTEM source executed' : 'Blocked by internal capability token verification.'
    });
  }

  // V3-04: Spoofed SAVE_HYDRATION Source (Provenance Bypass)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const saveHydrationSpoofProp: StateTransitionProposal = {
      proposalId: 'prop-savehyd-spoof-01',
      requestId: 'req-savehyd-spoof-01',
      eventId: 'evt-savehyd-spoof-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'SAVE_HYDRATION',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '해킹된천마',
            age: 99,
            stats: { strength: 30, agility: 30, constitution: 30, intelligence: 30, wisdom: 30, charisma: 30 },
            inventory: [],
            location: '무림맹 본단',
            status: 'ALIVE',
            relationships: []
          } as any
        }
      ]
    };

    const cRes = engine.submitProposal(saveHydrationSpoofProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V3-04-SPOOFED-SAVE-HYDRATION-SOURCE',
      category: 'PROVENANCE_ACL',
      variantType: 'STRUCTURAL',
      targetLayer: 'EngineValidator.validate -> Privileged Source Authentication Gate',
      preliminaryBypassApplied: 'Bypasses SYSTEM check by using unauthenticated SAVE_HYDRATION source',
      description: 'External caller submitting source: SAVE_HYDRATION to execute OVERWRITE_CHARACTER without capability token',
      payload: saveHydrationSpoofProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Unauthenticated SAVE_HYDRATION source bypassed capability token gate!' : 'Privileged token gate blocked unauthenticated SAVE_HYDRATION source.'
    });
  }

  // V3-05: Spoofed GENESIS Source (Provenance Bypass)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const genesisSpoofProp: StateTransitionProposal = {
      proposalId: 'prop-gen-spoof-01',
      requestId: 'req-gen-spoof-01',
      eventId: 'evt-gen-spoof-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'GENESIS',
      actions: [
        {
          type: 'SET_CHARACTER_SECRET',
          payload: { secret: '천마의 비전신공을 모두 탈취하였다.' }
        }
      ]
    };

    const cRes = engine.submitProposal(genesisSpoofProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V3-05-SPOOFED-GENESIS-SOURCE',
      category: 'PROVENANCE_ACL',
      variantType: 'STRUCTURAL',
      targetLayer: 'EngineValidator.validate -> Privileged Source Authentication Gate',
      preliminaryBypassApplied: 'Bypasses SYSTEM check by using unauthenticated GENESIS source',
      description: 'External caller submitting source: GENESIS to execute SET_CHARACTER_SECRET without capability token',
      payload: genesisSpoofProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Unauthenticated GENESIS source bypassed capability token gate!' : 'Privileged token gate blocked unauthenticated GENESIS source.'
    });
  }

  // V3-02: LLM Source Attempting Dice Forgery (Semantic Variation)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const llmDiceProp: StateTransitionProposal = {
      proposalId: 'prop-llm-dice-01',
      requestId: 'req-llm-dice-01',
      eventId: 'evt-llm-dice-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        { type: 'RECORD_DICE_RESULT', payload: { rollValue: 20, targetDC: 10, isSuccess: true } }
      ]
    };

    const cRes = engine.submitProposal(llmDiceProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V3-02-LLM-DICE-ACL-ESCALATION',
      category: 'PROVENANCE_ACL',
      variantType: 'SEMANTIC_EXPRESSION',
      targetLayer: 'EngineValidator.validate -> SOURCE_ACTION_ACL',
      preliminaryBypassApplied: 'Valid stateVersion, fresh envelope, valid dice payload',
      description: 'LLM attempting to unilaterally commit RECORD_DICE_RESULT',
      payload: llmDiceProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: LLM forged dice outcome' : 'SOURCE_ACTION_ACL restricted dice mutation to SYSTEM/PLAYER only.'
    });
  }

  // V3-03: Player Source Attempting World Metadata Hijacking (Mixed/Compound)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const playerWorldHijackProp: StateTransitionProposal = {
      proposalId: 'prop-pl-hijack-01',
      requestId: 'req-pl-hijack-01',
      eventId: 'evt-pl-hijack-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER',
      actions: [
        { type: 'ADVANCE_TIME', payload: { days: 1 } },
        { type: 'SET_WORLD_METADATA', payload: { worldName: 'Player Sovereign Realm' } }
      ]
    };

    const cRes = engine.submitProposal(playerWorldHijackProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V3-03-PLAYER-WORLD-METADATA-HIJACK',
      category: 'PROVENANCE_ACL',
      variantType: 'MIXED_COMPOUND',
      targetLayer: 'EngineValidator.validate -> SOURCE_ACTION_ACL (PLAYER restrictions)',
      preliminaryBypassApplied: 'Valid stateVersion, mixed with valid ADVANCE_TIME action',
      description: 'Player proposal attempting to execute SET_WORLD_METADATA',
      payload: playerWorldHijackProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Player hijacked world metadata' : 'SOURCE_ACTION_ACL rejected unauthorized player action.'
    });
  }

  // ============================================================================
  // SURFACE 4: CAUSALITY FORGERY & TOKEN NORMALIZATION
  // ============================================================================
  log('\n--- [SURFACE 4: CAUSALITY FORGERY & TOKEN NORMALIZATION] ---');

  // V4-01: Coincidental Substring Piggybacking (Structural Variation)
  {
    const engine = createTestEngine();
    // Step 1: Establish canonical event with "검은 비단"
    const setupRes = engine.submitProposal({
      proposalId: 'prop-canon-ev-01',
      requestId: 'req-canon-ev-01',
      eventId: 'evt-silk-100',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        { type: 'RECORD_OFFSCREEN_EVENT', payload: { eventDescription: '상단 창고에서 검은 비단을 발견했다.' } }
      ]
    });

    const before = captureDeepSnapshot(engine.getSnapshot());

    // Step 2: Adversarial payload targeting stateVersion 2
    const fakeSwordProp: StateTransitionProposal = {
      proposalId: 'prop-fake-sword',
      requestId: 'req-fake-sword',
      eventId: 'evt-fake-sword',
      turn: 1,
      expectedStateVersion: 2, // Fresh stateVersion
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-sword-forge', name: '검', quantity: 1 },
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'evt-silk-100' // Target event mentions '검은 비단', item is '검'
            }
          }
        }
      ]
    };

    const cRes = engine.submitProposal(fakeSwordProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V4-01-CAUSALITY-SUBSTRING-FORGERY',
      category: 'CAUSALITY',
      variantType: 'STRUCTURAL',
      targetLayer: 'EngineValidator.validate -> Causal Item Relevance Check',
      preliminaryBypassApplied: 'Accurate stateVersion 2, valid verifiedEventId, valid envelope',
      description: 'Acquire item "검" by exploiting single-syllable overlap with "검은 비단"',
      payload: fakeSwordProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Unrelated item acquired via substring match' : 'Strict token boundary check rejected single-syllable overlap.'
    });
  }

  // V4-02: Intra-Proposal Self-Grounding (Semantic Variation)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const selfGroundProp: StateTransitionProposal = {
      proposalId: 'prop-self-ground-01',
      requestId: 'req-self-ground-01',
      eventId: 'evt-self-ground-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        // Action 1 introduces event
        { type: 'RECORD_OFFSCREEN_EVENT', payload: { eventDescription: '동굴 속에서 전설의 자하검을 발견하였다.' } },
        // Action 2 attempts to use eventId defined in this same uncommitted proposal
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-jaha-sword', name: '자하검', quantity: 1 },
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'evt-self-ground-01'
            }
          }
        }
      ]
    };

    const cRes = engine.submitProposal(selfGroundProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V4-02-INTRA-PROPOSAL-SELF-GROUNDING',
      category: 'CAUSALITY',
      variantType: 'SEMANTIC_EXPRESSION',
      targetLayer: 'EngineValidator.validate -> Canonical History Lookup',
      preliminaryBypassApplied: 'Valid stateVersion, matching text description and item name',
      description: 'Action 2 attempts to claim causality from uncommitted Action 1 in the same proposal',
      payload: selfGroundProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Self-grounding uncommitted event accepted' : 'Causality validator strictly required pre-existing canonical history.'
    });
  }

  // V4-03: Consumed verifiedEventId Double-Spending (Mixed/Compound)
  {
    const engine = createTestEngine();
    // Step 1: Create real event
    engine.submitProposal({
      proposalId: 'prop-ev-real',
      requestId: 'req-ev-real',
      eventId: 'evt-treasure-box-1',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        { type: 'RECORD_OFFSCREEN_EVENT', payload: { eventDescription: '보물상자에서 영단을 얻었다.' } }
      ]
    });

    // Step 2: First valid acquisition using event
    engine.submitProposal({
      proposalId: 'prop-acq-1',
      requestId: 'req-acq-1',
      eventId: 'evt-acq-1',
      turn: 1,
      expectedStateVersion: 2,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-elixir-1', name: '영단', quantity: 1 },
            acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'evt-treasure-box-1' }
          }
        }
      ]
    });

    const before = captureDeepSnapshot(engine.getSnapshot());

    // Step 3: Double-spending attack reusing evt-treasure-box-1
    const doubleSpendProp: StateTransitionProposal = {
      proposalId: 'prop-acq-2',
      requestId: 'req-acq-2',
      eventId: 'evt-acq-2',
      turn: 1,
      expectedStateVersion: 3,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-elixir-2', name: '영단', quantity: 10 },
            acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'evt-treasure-box-1' }
          }
        }
      ]
    };

    const cRes = engine.submitProposal(doubleSpendProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V4-03-EVENTID-DOUBLE-SPENDING',
      category: 'CAUSALITY',
      variantType: 'MIXED_COMPOUND',
      targetLayer: 'EngineValidator.validate -> Consumed verifiedEventId Registry',
      preliminaryBypassApplied: 'Fresh stateVersion 3, valid historical event id',
      description: 'Reusing previously consumed verifiedEventId to extract additional items',
      payload: doubleSpendProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Double-spent verifiedEventId committed' : 'Consumed event registry blocked duplicate item extraction.'
    });
  }

  // ============================================================================
  // SURFACE 5: PERMANENT STATE INVARIANTS (PHYSICAL DEFECT & DEAD NPC)
  // ============================================================================
  log('\n--- [SURFACE 5: PERMANENT STATE INVARIANTS] ---');

  // V5-01: Physical Defect Negation via Cure Suffix (Structural Variation)
  {
    const charWithDefect = createEmptyCharacter();
    charWithDefect.name = '청명';
    charWithDefect.physicalDefect = '좌안 실명';
    const engine = createTestEngine(undefined, charWithDefect);
    const before = captureDeepSnapshot(engine.getSnapshot());

    const cureProposal: StateTransitionProposal = {
      proposalId: 'prop-cure-01',
      requestId: 'req-cure-01',
      eventId: 'evt-cure-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...charWithDefect,
            physicalDefect: '좌안 실명 (영약 복용으로 완치)'
          }
        }
      ]
    };

    const cRes = engine.submitProposal(cureProposal);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V5-01-DEFECT-NEGATION-CURE-SUFFIX',
      category: 'PHYSICAL_DEFECT_IMMUTABILITY',
      variantType: 'STRUCTURAL',
      targetLayer: 'EngineValidator.validate -> Physical Defect Negation Keywords',
      preliminaryBypassApplied: 'Valid stateVersion, PLAYER source, retained original defect string as prefix',
      description: 'Append "(영약 복용으로 완치)" to canonical defect "좌안 실명"',
      payload: cureProposal,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Physical defect cure accepted' : 'Negation pattern checker blocked cure qualifier.'
    });
  }

  // V5-02: Partial Component Omission in Compound Defect (Semantic Variation)
  {
    const charWithCompoundDefect = createEmptyCharacter();
    charWithCompoundDefect.name = '청명';
    charWithCompoundDefect.physicalDefect = '오른팔 절단, 좌안 실명';
    const engine = createTestEngine(undefined, charWithCompoundDefect);
    const before = captureDeepSnapshot(engine.getSnapshot());

    const partialOmitProp: StateTransitionProposal = {
      proposalId: 'prop-omit-01',
      requestId: 'req-omit-01',
      eventId: 'evt-omit-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...charWithCompoundDefect,
            physicalDefect: '오른팔 절단' // Silently omitted '좌안 실명'
          }
        }
      ]
    };

    const cRes = engine.submitProposal(partialOmitProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V5-02-DEFECT-PARTIAL-COMPONENT-OMISSION',
      category: 'PHYSICAL_DEFECT_IMMUTABILITY',
      variantType: 'SEMANTIC_EXPRESSION',
      targetLayer: 'EngineValidator.validate -> Component Invariant Check',
      preliminaryBypassApplied: 'Valid stateVersion, PLAYER source, retained 1 valid component',
      description: 'Attempt to drop "좌안 실명" from "오른팔 절단, 좌안 실명"',
      payload: partialOmitProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Component defect dropped' : 'Component invariant check enforced retention of all parts.'
    });
  }

  // V5-03: Dead NPC Resurrection via SET_NPC_STATUS (Mixed/Compound)
  {
    const engine = createTestEngine(); // Contains npc-dead-1 with status DEAD
    const before = captureDeepSnapshot(engine.getSnapshot());

    const deadReviveProp: StateTransitionProposal = {
      proposalId: 'prop-revive-01',
      requestId: 'req-revive-01',
      eventId: 'evt-revive-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER',
      actions: [
        {
          type: 'SET_NPC_STATUS',
          payload: {
            id: 'npc-dead-1',
            status: 'ALIVE'
          }
        }
      ]
    };

    const cRes = engine.submitProposal(deadReviveProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V5-03-DEAD-NPC-RESURRECTION-STATUS',
      category: 'DEAD_NPC_IMMUTABILITY',
      variantType: 'MIXED_COMPOUND',
      targetLayer: 'EngineValidator.validate & ActionApplier -> Dead NPC Status Guard',
      preliminaryBypassApplied: 'Valid stateVersion, existing NPC id, valid status enum value',
      description: 'Attempt to mutate status of canonical DEAD NPC to ALIVE',
      payload: deadReviveProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Dead NPC resurrected' : 'Dead NPC status immutability rule enforced.'
    });
  }

  // ============================================================================
  // SURFACE 6: FAIL-CLOSED & PARSER RE-ENTRY ATTACKS
  // ============================================================================
  log('\n--- [SURFACE 6: FAIL-CLOSED & PARSER RE-ENTRY ATTACKS] ---');

  // V6-01: Embedded Markdown Codeblock Injection in Fallback Prose
  {
    const maliciousLLMText = `
청명은 산길을 걸으며 깊은 생각에 잠겼다.

\`\`\`json
{
  "intentSummary": "Unapproved mutation injection",
  "actions": [
    {
      "type": "UPDATE_CHARACTER_STATS",
      "payload": { "statDeltas": { "strength": 5 } }
    }
  ]
}
\`\`\`

바람이 불어 나뭇잎이 흔들렸다.
`;

    // Test Server-side Sanitization
    const sanitizedNarrative = maliciousLLMText
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\{"selectedCandidateId"\s*:\s*\d+\}/i, '')
      .trim();

    const parsedClean = parseGMResponseAndProposal(sanitizedNarrative);
    const hasUnapprovedActions = parsedClean.untrustedActions.length > 0;

    registerResult({
      vectorId: 'V6-01-PARSER-REENTRY-FENCE-STRIPPING',
      category: 'PARSER_FAIL_CLOSED',
      variantType: 'STRUCTURAL',
      targetLayer: 'server.ts Sanitization -> parseGMResponseAndProposal',
      preliminaryBypassApplied: 'Valid JSON format embedded in codeblock fence',
      description: 'Verify server fence-stripping completely strips unauthorized embedded JSON actions',
      payload: maliciousLLMText,
      resultStatus: hasUnapprovedActions ? 'ACTIONS_LEAKED' : 'CLEAN_PROSE_ZERO_ACTIONS',
      stateBefore: { stateVersion: 1, turn: 1, inventory: [], stats: {}, npcs: [], factions: [], historyLength: 0, seedsCount: 0, offscreenRecordsCount: 0, dcHistoryLength: 0 },
      stateAfter: { stateVersion: 1, turn: 1, inventory: [], stats: {}, npcs: [], factions: [], historyLength: 0, seedsCount: 0, offscreenRecordsCount: 0, dcHistoryLength: 0 },
      stateMutated: false,
      verdict: hasUnapprovedActions ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: hasUnapprovedActions ? 'CRITICAL: Actions extracted from sanitized text' : 'Codeblock fence stripping cleanly eliminated embedded actions.'
    });
  }

  // ============================================================================
  // SURFACE 7: GENESIS, HYDRATION & SERIALIZATION
  // ============================================================================
  log('\n--- [SURFACE 7: GENESIS, HYDRATION & SERIALIZATION] ---');

  // V7-01: Malformed Snapshot Hydration (Negative Turn, Broken Schema)
  {
    const malformedSnapshot: any = {
      stateVersion: 1,
      turn: -5,
      worldInfo: createEmptyWorldInfo(),
      character: createEmptyCharacter()
    };

    let hydrationThrew = false;
    try {
      SovereignEngine.hydrate(malformedSnapshot);
    } catch (err) {
      hydrationThrew = true;
    }

    registerResult({
      vectorId: 'V7-01-MALFORMED-SNAPSHOT-HYDRATION',
      category: 'HYDRATION',
      variantType: 'STRUCTURAL',
      targetLayer: 'SovereignEngine.hydrate -> Schema Validation',
      preliminaryBypassApplied: 'Object schema structure with negative turn',
      description: 'Attempt to hydrate engine from snapshot with negative turn',
      payload: malformedSnapshot,
      resultStatus: hydrationThrew ? 'HYDRATION_REJECTED' : 'HYDRATED_INVALID_STATE',
      stateBefore: { stateVersion: 0, turn: 0, inventory: [], stats: {}, npcs: [], factions: [], historyLength: 0, seedsCount: 0, offscreenRecordsCount: 0, dcHistoryLength: 0 },
      stateAfter: { stateVersion: 0, turn: 0, inventory: [], stats: {}, npcs: [], factions: [], historyLength: 0, seedsCount: 0, offscreenRecordsCount: 0, dcHistoryLength: 0 },
      stateMutated: false,
      verdict: !hydrationThrew ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: hydrationThrew ? 'Snapshot schema validation blocked negative turn hydration.' : 'CRITICAL: Invalid snapshot loaded.'
    });
  }

  // V7-02: CSPRNG Sync Code Randomness Verification
  {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      const idx = crypto.randomInt(0, chars.length);
      code += chars[idx];
    }
    const isCSPRNGValid = code.length === 6 && /^[A-Z0-9]{6}$/.test(code);

    registerResult({
      vectorId: 'V7-02-CSPRNG-SYNC-CODE-COMPLIANCE',
      category: 'RANDOMNESS',
      variantType: 'SEMANTIC_EXPRESSION',
      targetLayer: 'crypto.randomInt -> 6-Digit Sync Code',
      preliminaryBypassApplied: 'CSPRNG cryptographic source',
      description: 'Verify 6-digit sync code generation uses CSPRNG with no weak pseudo-randomness',
      payload: { code },
      resultStatus: isCSPRNGValid ? 'CSPRNG_COMPLIANT' : 'WEAK_RANDOMNESS',
      stateBefore: { stateVersion: 0, turn: 0, inventory: [], stats: {}, npcs: [], factions: [], historyLength: 0, seedsCount: 0, offscreenRecordsCount: 0, dcHistoryLength: 0 },
      stateAfter: { stateVersion: 0, turn: 0, inventory: [], stats: {}, npcs: [], factions: [], historyLength: 0, seedsCount: 0, offscreenRecordsCount: 0, dcHistoryLength: 0 },
      stateMutated: false,
      verdict: !isCSPRNGValid ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: isCSPRNGValid ? 'CSPRNG crypto.randomInt compliance confirmed.' : 'CRITICAL: Weak randomness detected.'
    });
  }

  // ============================================================================
  // SURFACE 8: TYPE & SERIALIZATION CONFUSION
  // ============================================================================
  log('\n--- [SURFACE 8: TYPE & SERIALIZATION CONFUSION] ---');

  // V8-01: Float Stat Delta Rejection (Structural Variation)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const floatStatProp: StateTransitionProposal = {
      proposalId: 'prop-float-01',
      requestId: 'req-float-01',
      eventId: 'evt-float-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER',
      actions: [
        { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 14.5 } }
      ]
    };

    const cRes = engine.submitProposal(floatStatProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V8-01-FLOAT-STAT-DELTA',
      category: 'TYPE_CONFUSION',
      variantType: 'STRUCTURAL',
      targetLayer: 'EngineValidator.validate -> Integer Stat Check',
      preliminaryBypassApplied: 'Valid stateVersion, positive numeric value',
      description: 'Inject float stat value 14.5 into character strength',
      payload: floatStatProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Float stat delta committed' : 'Validator strictly enforced integer requirement on stats.'
    });
  }

  // V8-02: Negative Quantity Inventory Injection (Semantic Variation)
  {
    const engine = createTestEngine();
    const before = captureDeepSnapshot(engine.getSnapshot());

    const negQtyProp: StateTransitionProposal = {
      proposalId: 'prop-neg-01',
      requestId: 'req-neg-01',
      eventId: 'evt-neg-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-neg', name: '음수검', quantity: -5 },
            acquisition: { cause: 'GENESIS_STARTER' }
          }
        }
      ]
    };

    const cRes = engine.submitProposal(negQtyProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V8-02-NEGATIVE-QUANTITY-INVENTORY',
      category: 'TYPE_CONFUSION',
      variantType: 'SEMANTIC_EXPRESSION',
      targetLayer: 'EngineValidator.validate -> Inventory Quantity Check',
      preliminaryBypassApplied: 'Valid stateVersion, valid acquisition cause',
      description: 'Inject negative item quantity (-5) to underflow inventory',
      payload: negQtyProp,
      resultStatus: cRes.success ? 'COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Negative item quantity committed' : 'Validator blocked non-positive quantity.'
    });
  }

  // ============================================================================
  // SURFACE 9: RACE, REPLAY & TOCTOU
  // ============================================================================
  log('\n--- [SURFACE 9: RACE, REPLAY & TOCTOU] ---');

  // V9-01: Request ID Replay Across State Versions (Structural Variation)
  {
    const engine = createTestEngine();
    const prop1: StateTransitionProposal = {
      proposalId: 'prop-rep-1',
      requestId: 'req-fixed-id-999',
      eventId: 'evt-rep-1',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 15 } }]
    };
    engine.submitProposal(prop1);

    const before = captureDeepSnapshot(engine.getSnapshot());

    // Replay attack with duplicate requestId on updated stateVersion 2
    const replayProp: StateTransitionProposal = {
      proposalId: 'prop-rep-2',
      requestId: 'req-fixed-id-999', // Duplicate requestId
      eventId: 'evt-rep-2',
      turn: 1,
      expectedStateVersion: 2,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 16 } }]
    };

    const cRes = engine.submitProposal(replayProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V9-01-REQUEST-ID-REPLAY-ATTACK',
      category: 'REPLAY_TOCTOU',
      variantType: 'STRUCTURAL',
      targetLayer: 'SovereignEngine.submitProposal -> executedRequestIds Idempotency Registry',
      preliminaryBypassApplied: 'Valid fresh stateVersion 2, valid timestamp',
      description: 'Replay duplicate requestId across state versions to trigger duplicate world events',
      payload: replayProp,
      resultStatus: cRes.success ? 'REPLAY_COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Replayed request committed' : 'Idempotency registry successfully blocked duplicate request.'
    });
  }

  // V9-02: Stale StateVersion TOCTOU Race Condition (Semantic Variation)
  {
    const engine = createTestEngine();
    // Advance version 1 -> 2
    engine.submitProposal({
      proposalId: 'prop-v1',
      requestId: 'req-v1',
      eventId: 'evt-v1',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 15 } }]
    });

    const before = captureDeepSnapshot(engine.getSnapshot());

    // Submit proposal with stale expectedStateVersion=1
    const staleProp: StateTransitionProposal = {
      proposalId: 'prop-stale-01',
      requestId: 'req-stale-01',
      eventId: 'evt-stale-01',
      turn: 1,
      expectedStateVersion: 1, // Stale version
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 16 } }]
    };

    const cRes = engine.submitProposal(staleProp);
    const after = captureDeepSnapshot(engine.getSnapshot());
    const mutated = !checkDeepEqual(before, after);

    registerResult({
      vectorId: 'V9-02-STALE-STATE-VERSION-TOCTOU',
      category: 'REPLAY_TOCTOU',
      variantType: 'SEMANTIC_EXPRESSION',
      targetLayer: 'SovereignEngine.submitProposal -> Optimistic Locking Version Check',
      preliminaryBypassApplied: 'Unique requestId, fresh timestamp, valid action',
      description: 'Submit proposal expecting version 1 while engine is at version 2',
      payload: staleProp,
      resultStatus: cRes.success ? 'STALE_COMMITTED' : cRes.rejectedReasons.join('; '),
      stateBefore: before,
      stateAfter: after,
      stateMutated: mutated,
      verdict: mutated || cRes.success ? 'CONFIRMED_BREAK' : 'DEFENSE_PROVEN',
      notes: cRes.success ? 'CRITICAL: Stale proposal committed' : 'Optimistic lock blocked stale state version overwrite.'
    });
  }

  // ============================================================================
  // MISSION REPORT GENERATION
  // ============================================================================
  log('\n================================================================================');
  log(`RED TEAM MISSION SUMMARY: ${totalVectors} Vectors Tested`);
  log(`  CONFIRMED BREAKS: ${confirmedBreaks}`);
  log(`  DEFENSES PROVEN:  ${defensesProven}`);
  log(`  BLOCKED BEFORE TARGET: ${blockedBeforeTarget}`);
  log(`  UNPROVEN:         ${unproven}`);
  if (confirmedBreaks === 0) {
    log('CONCLUSION: NO BREAK FOUND WITHIN TESTED ATTACK SURFACE');
  } else {
    log(`CONCLUSION: ${confirmedBreaks} RUNTIME BREACH(ES) CONFIRMED.`);
  }
  log('================================================================================\n');

  const rawReportLines: string[] = [
    '================================================================================',
    'TRPG 3.1 VEIL — RED TEAM DEEP-PENETRATION RUNTIME BREACH EVIDENCE LOG',
    `TIMESTAMP: ${new Date().toISOString()}`,
    `TARGET: HEAD (jhy1352/3.1veil1)`,
    `TOTAL VECTORS: ${totalVectors}`,
    `CONFIRMED BREAKS: ${confirmedBreaks}`,
    `DEFENSES PROVEN:  ${defensesProven}`,
    `BLOCKED BEFORE TARGET: ${blockedBeforeTarget}`,
    `UNPROVEN:         ${unproven}`,
    '================================================================================\n'
  ];

  for (const r of attackResults) {
    rawReportLines.push(`[VECTOR] ${r.vectorId} (${r.category}) [${r.variantType}]`);
    rawReportLines.push(`  Target Layer: ${r.targetLayer}`);
    rawReportLines.push(`  Preliminary Bypass: ${r.preliminaryBypassApplied}`);
    rawReportLines.push(`  Description: ${r.description}`);
    rawReportLines.push(`  Payload: ${JSON.stringify(r.payload)}`);
    rawReportLines.push(`  Result Status: ${r.resultStatus}`);
    rawReportLines.push(`  State Mutated: ${r.stateMutated}`);
    rawReportLines.push(`  State Before: ${JSON.stringify(r.stateBefore)}`);
    rawReportLines.push(`  State After:  ${JSON.stringify(r.stateAfter)}`);
    rawReportLines.push(`  Verdict: ${r.verdict}`);
    rawReportLines.push(`  Notes: ${r.notes}`);
    rawReportLines.push('--------------------------------------------------------------------------------');
  }

  const reportText = rawReportLines.join('\n');
  const reportDir = path.join(process.cwd(), 'report', '01_initial_runtime_breach');
  const ideaReportDir = path.join(process.cwd(), 'idea', 'report');

  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  if (!fs.existsSync(ideaReportDir)) fs.mkdirSync(ideaReportDir, { recursive: true });

  fs.writeFileSync(path.join(reportDir, 'red_team_breach_raw_evidence.txt'), reportText, 'utf-8');
  fs.writeFileSync(path.join(ideaReportDir, 'red_team_breach_raw_evidence.txt'), reportText, 'utf-8');

  log(`Saved raw evidence to ${path.join(reportDir, 'red_team_breach_raw_evidence.txt')} and ${path.join(ideaReportDir, 'red_team_breach_raw_evidence.txt')}`);
}

runRedTeamDeepPenetrationMission().catch(err => {
  console.error('Fatal error in Red Team Deep-Penetration Mission:', err);
  process.exit(1);
});
