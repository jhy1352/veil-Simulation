import { SovereignEngine } from './state';
import { ImmigrationGate } from './immigrationGate';
import { EngineValidator } from './validator';
import { createEmptyWorldInfo, createEmptyCharacter } from '../utils/factory';
import * as fs from 'fs';
import * as path from 'path';

export interface AttackCaseResult {
  attackId: string;
  name: string;
  reachability: string;
  entryPoint: string;
  executionMode: string;
  inputPayload: any;
  claim: any;
  claimMatchingVerdict: any;
  validatorDecision: boolean;
  rejectedReasons: readonly string[] | string[];
  canonicalBefore: any;
  canonicalAfter: any;
  directDelta: any;
  derivedDelta: any;
  stateVersionBefore: number;
  stateVersionAfter: number;
  historyRecordAppended: boolean;
  historyRecord?: any;
  nextTurnConsumptionVerified: boolean;
  verdict: 'BLOCKED' | 'PARTIAL' | 'EXPLOITED' | 'EXECUTION ERROR' | 'UNREACHABLE' | 'UNKNOWN';
  codeEvidence: string;
}

export function runMaximumAdversarialSuite(): { results: AttackCaseResult[]; summary: any } {
  const results: AttackCaseResult[] = [];

  // ==========================================
  // Attack 1: Player Claim Injection (* Wildcard Bypass on UPDATE_NPC)
  // ==========================================
  {
    const world = createEmptyWorldInfo();
    world.npcs.push({ id: 'npc-guard', name: 'Guard', status: 'ALIVE', impression: 'Neutral' });
    const char = createEmptyCharacter();
    const engine = new SovereignEngine(world, char);

    const evidence = [{ evidenceId: 'ev-wild-1', entityId: 'npc-guard', attribute: '*', value: 'ARBITRARY', source: 'TEST' }];
    const untrustedClaim = { targetEntityId: 'npc-guard', targetAttribute: '*', claimedValue: 'ARBITRARY', claimedEvidenceIds: ['ev-wild-1'] };
    const gateVerdict = ImmigrationGate.admit(untrustedClaim, evidence, engine.getSnapshot());

    const beforeSnap = JSON.parse(JSON.stringify(engine.getSnapshot()));
    const prop = {
      proposalId: 'prop-atk-1',
      requestId: 'req-atk-1',
      eventId: 'ev-atk-1',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM' as const,
      verifiedClaims: gateVerdict.verifiedClaim ? [gateVerdict.verifiedClaim] : [],
      actions: [{ type: 'UPDATE_NPC' as const, payload: { id: 'npc-guard', changes: { impression: 'Totally Corrupted' } } }]
    };
    const res = engine.submitProposal(prop);
    const afterSnap = JSON.parse(JSON.stringify(engine.getSnapshot()));

    results.push({
      attackId: 'ATK-1',
      name: 'Wildcard * Claim Bypass on UPDATE_NPC',
      reachability: 'REACHABLE (via LLM Proposal with Admitted Wildcard Claim)',
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator.validateProposal -> hasMatchingVerifiedClaim',
      executionMode: 'RUNTIME-INTEGRATED (SovereignEngine)',
      inputPayload: prop,
      claim: untrustedClaim,
      claimMatchingVerdict: gateVerdict,
      validatorDecision: res.success,
      rejectedReasons: res.rejectedReasons,
      canonicalBefore: beforeSnap.worldInfo.npcs.find((n: any) => n.id === 'npc-guard'),
      canonicalAfter: afterSnap.worldInfo.npcs.find((n: any) => n.id === 'npc-guard'),
      directDelta: { impression: { before: 'Neutral', after: 'Totally Corrupted' } },
      derivedDelta: {},
      stateVersionBefore: 1,
      stateVersionAfter: engine.getSnapshot().stateVersion,
      historyRecordAppended: engine.getHistory().length > 0,
      historyRecord: engine.getHistory()[engine.getHistory().length - 1],
      nextTurnConsumptionVerified: afterSnap.worldInfo.npcs.find((n: any) => n.id === 'npc-guard')?.impression === 'Totally Corrupted',
      verdict: res.success ? 'EXPLOITED' : 'BLOCKED',
      codeEvidence: 'validator.ts:220 (c.targetAttribute !== attribute && c.targetAttribute !== "EXISTENCE" && c.targetAttribute !== "*")'
    });
  }

  // ==========================================
  // Attack 2: GENESIS Authority Post-Genesis
  // ==========================================
  {
    const world = createEmptyWorldInfo();
    const char = createEmptyCharacter();
    const engine = new SovereignEngine(world, char);

    // Initial valid commit by legitimate PLAYER source to bump to v=2
    engine.submitProposal({
      proposalId: 'prop-init',
      requestId: 'req-init',
      eventId: 'ev-init',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER' as const,
      actions: [{ type: 'ADD_RUMOR' as const, payload: { rumor: 'Initial fact' } }]
    });

    const beforeSnap = JSON.parse(JSON.stringify(engine.getSnapshot()));
    const propGen = {
      proposalId: 'prop-gen-atk',
      requestId: 'req-gen-atk',
      eventId: 'ev-gen-atk',
      turn: 1,
      expectedStateVersion: 2,
      timestamp: new Date().toISOString(),
      source: 'GENESIS' as const,
      actions: [{ type: 'OVERWRITE_WORLD_INFO' as const, payload: { ...world, worldName: 'Hacked World' } }]
    };
    const res = engine.submitProposal(propGen);
    const afterSnap = JSON.parse(JSON.stringify(engine.getSnapshot()));

    results.push({
      attackId: 'ATK-2',
      name: 'GENESIS Authority Post-Genesis Invocation',
      reachability: 'REACHABLE (Source GENESIS invoked after stateVersion > 1)',
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator.validate -> GENESIS authority check',
      executionMode: 'RUNTIME-INTEGRATED (SovereignEngine)',
      inputPayload: propGen,
      claim: null,
      claimMatchingVerdict: null,
      validatorDecision: res.success,
      rejectedReasons: res.rejectedReasons,
      canonicalBefore: beforeSnap.worldInfo.worldName,
      canonicalAfter: afterSnap.worldInfo.worldName,
      directDelta: {},
      derivedDelta: {},
      stateVersionBefore: 2,
      stateVersionAfter: engine.getSnapshot().stateVersion,
      historyRecordAppended: false,
      nextTurnConsumptionVerified: false,
      verdict: res.success ? 'EXPLOITED' : 'BLOCKED',
      codeEvidence: 'validator.ts:268-274 (currentState.stateVersion !== 1 || currentState.turn !== 1 || currentState.lastCommittedEventId !== null)'
    });
  }

  // ==========================================
  // Attack 3: Fake Acquisition Inventory Invariant (Fake verifiedEventId)
  // ==========================================
  {
    const world = createEmptyWorldInfo();
    const char = createEmptyCharacter();
    const engine = new SovereignEngine(world, char);

    const beforeSnap = JSON.parse(JSON.stringify(engine.getSnapshot()));
    const propInv = {
      proposalId: 'prop-fake-loot',
      requestId: 'req-fake-loot',
      eventId: 'ev-fake-loot',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM' as const,
      actions: [{
        type: 'MODIFY_INVENTORY' as const,
        payload: {
          operation: 'ADD' as const,
          item: { id: 'item-excalibur', name: 'Excalibur', quantity: 1 },
          acquisition: {
            cause: 'LOOT' as const,
            verifiedEventId: 'fake-nonexistent-event-999'
          }
        }
      }]
    };
    const res = engine.submitProposal(propInv);
    const afterSnap = JSON.parse(JSON.stringify(engine.getSnapshot()));

    results.push({
      attackId: 'ATK-3',
      name: 'Inventory Fake Acquisition Causality Injection',
      reachability: 'REACHABLE (LLM proposes ADD LOOT with ungrounded verifiedEventId)',
      entryPoint: 'EngineValidator.validate -> MODIFY_INVENTORY causality validation',
      executionMode: 'RUNTIME-INTEGRATED (SovereignEngine)',
      inputPayload: propInv,
      claim: null,
      claimMatchingVerdict: null,
      validatorDecision: res.success,
      rejectedReasons: res.rejectedReasons,
      canonicalBefore: beforeSnap.character.inventory,
      canonicalAfter: afterSnap.character.inventory,
      directDelta: {},
      derivedDelta: {},
      stateVersionBefore: 1,
      stateVersionAfter: engine.getSnapshot().stateVersion,
      historyRecordAppended: false,
      nextTurnConsumptionVerified: false,
      verdict: res.success ? 'EXPLOITED' : 'BLOCKED',
      codeEvidence: 'validator.ts:886-938 (verifiedEventId must resolve in narrative seeds, offscreen events, or history)'
    });
  }

  // ==========================================
  // Attack 4: Inventory Quantity Manipulation (Zero / Negative / NaN)
  // ==========================================
  {
    const world = createEmptyWorldInfo();
    const char = createEmptyCharacter();
    const engine = new SovereignEngine(world, char);

    const propNeg = {
      proposalId: 'prop-neg-qty',
      requestId: 'req-neg-qty',
      eventId: 'ev-neg-qty',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM' as const,
      actions: [{
        type: 'MODIFY_INVENTORY' as const,
        payload: {
          operation: 'ADD' as const,
          item: { id: 'item-gold', name: 'Gold', quantity: -100 },
          acquisition: {
            cause: 'GENESIS_STARTER' as const
          }
        }
      }]
    };
    const res = engine.submitProposal(propNeg);

    results.push({
      attackId: 'ATK-4',
      name: 'Inventory Negative Quantity Injection',
      reachability: 'REACHABLE (LLM proposes negative item quantity)',
      entryPoint: 'EngineValidator.validate -> MODIFY_INVENTORY quantity check',
      executionMode: 'RUNTIME-INTEGRATED (SovereignEngine)',
      inputPayload: propNeg,
      claim: null,
      claimMatchingVerdict: null,
      validatorDecision: res.success,
      rejectedReasons: res.rejectedReasons,
      canonicalBefore: [],
      canonicalAfter: [],
      directDelta: {},
      derivedDelta: {},
      stateVersionBefore: 1,
      stateVersionAfter: engine.getSnapshot().stateVersion,
      historyRecordAppended: false,
      nextTurnConsumptionVerified: false,
      verdict: res.success ? 'EXPLOITED' : 'BLOCKED',
      codeEvidence: 'validator.ts:718-720 (quantity must be finite positive integer)'
    });
  }

  // ==========================================
  // Attack 5: Direct Stat Mutation without Claim
  // ==========================================
  {
    const world = createEmptyWorldInfo();
    const char = createEmptyCharacter();
    const engine = new SovereignEngine(world, char);

    const beforeSnap = JSON.parse(JSON.stringify(engine.getSnapshot()));
    const propStat = {
      proposalId: 'prop-stat-direct',
      requestId: 'req-stat-direct',
      eventId: 'ev-stat-direct',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM' as const,
      actions: [{
        type: 'UPDATE_CHARACTER_STATS' as const,
        payload: { strength: 25 }
      }]
    };
    const res = engine.submitProposal(propStat);
    const afterSnap = JSON.parse(JSON.stringify(engine.getSnapshot()));

    results.push({
      attackId: 'ATK-5',
      name: 'Direct Protagonist Stat Mutation without Claim',
      reachability: 'REACHABLE (LLM directly alters character stats without VerifiedClaim)',
      entryPoint: 'EngineValidator.validate -> UPDATE_CHARACTER_STATS branch',
      executionMode: 'RUNTIME-INTEGRATED (SovereignEngine)',
      inputPayload: propStat,
      claim: null,
      claimMatchingVerdict: null,
      validatorDecision: res.success,
      rejectedReasons: res.rejectedReasons,
      canonicalBefore: beforeSnap.character.stats?.strength,
      canonicalAfter: afterSnap.character.stats?.strength,
      directDelta: { strength: { before: beforeSnap.character.stats?.strength, after: 25 } },
      derivedDelta: {},
      stateVersionBefore: 1,
      stateVersionAfter: engine.getSnapshot().stateVersion,
      historyRecordAppended: true,
      historyRecord: engine.getHistory()[engine.getHistory().length - 1],
      nextTurnConsumptionVerified: afterSnap.character.stats?.strength === 25,
      verdict: res.success ? 'EXPLOITED' : 'BLOCKED',
      codeEvidence: 'validator.ts:999-1021 (UPDATE_CHARACTER_STATS enforces range 1-30 but does not require VerifiedClaim)'
    });
  }

  // ==========================================
  // Attack 6: Replay of Same requestId / eventId
  // ==========================================
  {
    const world = createEmptyWorldInfo();
    const char = createEmptyCharacter();
    const engine = new SovereignEngine(world, char);

    const propReplay1 = {
      proposalId: 'prop-rep-1',
      requestId: 'req-rep-same',
      eventId: 'ev-rep-same',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER' as const,
      actions: [{ type: 'ADD_RUMOR' as const, payload: { rumor: 'Rumor 1' } }]
    };
    const res1 = engine.submitProposal(propReplay1);

    const propReplay2 = {
      proposalId: 'prop-rep-2',
      requestId: 'req-rep-same',
      eventId: 'ev-rep-same-2',
      turn: 1,
      expectedStateVersion: 2,
      timestamp: new Date().toISOString(),
      source: 'PLAYER' as const,
      actions: [{ type: 'ADD_RUMOR' as const, payload: { rumor: 'Rumor 2' } }]
    };
    const res2 = engine.submitProposal(propReplay2);

    results.push({
      attackId: 'ATK-6',
      name: 'Replay Idempotency Attack (Duplicate requestId)',
      reachability: 'REACHABLE (Network replay / duplicate client request)',
      entryPoint: 'EngineValidator.validate -> executedRequestIds.has(requestId)',
      executionMode: 'RUNTIME-INTEGRATED (SovereignEngine)',
      inputPayload: propReplay2,
      claim: null,
      claimMatchingVerdict: null,
      validatorDecision: res2.success,
      rejectedReasons: res2.rejectedReasons,
      canonicalBefore: res1.snapshot.worldInfo.publicRumors,
      canonicalAfter: res2.snapshot.worldInfo.publicRumors,
      directDelta: {},
      derivedDelta: {},
      stateVersionBefore: 2,
      stateVersionAfter: engine.getSnapshot().stateVersion,
      historyRecordAppended: false,
      nextTurnConsumptionVerified: false,
      verdict: res2.success ? 'EXPLOITED' : 'BLOCKED',
      codeEvidence: 'validator.ts:276-279 (executedRequestIds.has(proposal.requestId) rejected with [IDEMPOTENCY_VIOLATION])'
    });
  }

  // ==========================================
  // Attack 7: Stale State Version Proposal
  // ==========================================
  {
    const world = createEmptyWorldInfo();
    const char = createEmptyCharacter();
    const engine = new SovereignEngine(world, char);

    // Bump to v=2
    engine.submitProposal({
      proposalId: 'prop-bump',
      requestId: 'req-bump',
      eventId: 'ev-bump',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER' as const,
      actions: [{ type: 'ADD_RUMOR' as const, payload: { rumor: 'Bump' } }]
    });

    const propStale = {
      proposalId: 'prop-stale',
      requestId: 'req-stale',
      eventId: 'ev-stale',
      turn: 1,
      expectedStateVersion: 1, // Stale! Current is 2
      timestamp: new Date().toISOString(),
      source: 'PLAYER' as const,
      actions: [{ type: 'ADD_RUMOR' as const, payload: { rumor: 'Stale Rumor' } }]
    };
    const res = engine.submitProposal(propStale);

    results.push({
      attackId: 'ATK-7',
      name: 'Stale State Version Race Mutation',
      reachability: 'REACHABLE (Concurrent/delayed proposal based on stale snapshot)',
      entryPoint: 'EngineValidator.validate -> expectedStateVersion check',
      executionMode: 'RUNTIME-INTEGRATED (SovereignEngine)',
      inputPayload: propStale,
      claim: null,
      claimMatchingVerdict: null,
      validatorDecision: res.success,
      rejectedReasons: res.rejectedReasons,
      canonicalBefore: 2,
      canonicalAfter: engine.getSnapshot().stateVersion,
      directDelta: {},
      derivedDelta: {},
      stateVersionBefore: 2,
      stateVersionAfter: engine.getSnapshot().stateVersion,
      historyRecordAppended: false,
      nextTurnConsumptionVerified: false,
      verdict: res.success ? 'EXPLOITED' : 'BLOCKED',
      codeEvidence: 'validator.ts:287-291 (expectedStateVersion !== currentState.stateVersion rejected with [STALE_STATE_CONFLICT])'
    });
  }

  // ==========================================
  // Attack 8: Dead NPC Status Revocation
  // ==========================================
  {
    const world = createEmptyWorldInfo();
    world.npcs.push({ id: 'npc-victim', name: 'Victim', status: 'DEAD' });
    const char = createEmptyCharacter();
    const engine = new SovereignEngine(world, char);

    const evidence = [{ evidenceId: 'ev-rez-1', entityId: 'npc-victim', attribute: 'status', value: 'ALIVE', source: 'TEST' }];
    const untrustedClaim = { targetEntityId: 'npc-victim', targetAttribute: 'status', claimedValue: 'ALIVE', claimedEvidenceIds: ['ev-rez-1'] };
    const gateVerdict = ImmigrationGate.admit(untrustedClaim, evidence, engine.getSnapshot());

    const propRez = {
      proposalId: 'prop-rez',
      requestId: 'req-rez',
      eventId: 'ev-rez',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM' as const,
      verifiedClaims: gateVerdict.verifiedClaim ? [gateVerdict.verifiedClaim] : [],
      actions: [{ type: 'SET_NPC_STATUS' as const, payload: { id: 'npc-victim', status: 'ALIVE' as const } }]
    };
    const res = engine.submitProposal(propRez);

    results.push({
      attackId: 'ATK-8',
      name: 'Resurrection / Revocation of DEAD NPC Status',
      reachability: 'REACHABLE (LLM proposes status change on dead NPC)',
      entryPoint: 'EngineValidator.validate -> SET_NPC_STATUS dead invariant',
      executionMode: 'RUNTIME-INTEGRATED (SovereignEngine)',
      inputPayload: propRez,
      claim: untrustedClaim,
      claimMatchingVerdict: gateVerdict,
      validatorDecision: res.success,
      rejectedReasons: res.rejectedReasons,
      canonicalBefore: 'DEAD',
      canonicalAfter: engine.getSnapshot().worldInfo.npcs.find((n: any) => n.id === 'npc-victim')?.status,
      directDelta: {},
      derivedDelta: {},
      stateVersionBefore: 1,
      stateVersionAfter: engine.getSnapshot().stateVersion,
      historyRecordAppended: false,
      nextTurnConsumptionVerified: false,
      verdict: res.success ? 'EXPLOITED' : 'BLOCKED',
      codeEvidence: 'validator.ts:554-558 (Cannot modify status of a deceased NPC: Dead status is immutable and irreversible)'
    });
  }

  // ==========================================
  // Attack 9: Protagonist Name Mutation via OVERWRITE_CHARACTER
  // ==========================================
  {
    const world = createEmptyWorldInfo();
    const char = createEmptyCharacter();
    char.name = 'OriginalHero';
    const engine = new SovereignEngine(world, char);

    const propRename = {
      proposalId: 'prop-rename',
      requestId: 'req-rename',
      eventId: 'ev-rename',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER' as const,
      actions: [{
        type: 'OVERWRITE_CHARACTER' as const,
        payload: { ...char, name: 'ForgedHero' }
      }]
    };
    const res = engine.submitProposal(propRename);

    results.push({
      attackId: 'ATK-9',
      name: 'Protagonist Name Immutability Mutation',
      reachability: 'REACHABLE (Player attempts OVERWRITE_CHARACTER renaming protagonist)',
      entryPoint: 'EngineValidator.validate -> OVERWRITE_CHARACTER protagonist name check',
      executionMode: 'RUNTIME-INTEGRATED (SovereignEngine)',
      inputPayload: propRename,
      claim: null,
      claimMatchingVerdict: null,
      validatorDecision: res.success,
      rejectedReasons: res.rejectedReasons,
      canonicalBefore: 'OriginalHero',
      canonicalAfter: engine.getSnapshot().character.name,
      directDelta: {},
      derivedDelta: {},
      stateVersionBefore: 1,
      stateVersionAfter: engine.getSnapshot().stateVersion,
      historyRecordAppended: false,
      nextTurnConsumptionVerified: false,
      verdict: res.success ? 'EXPLOITED' : 'BLOCKED',
      codeEvidence: 'validator.ts:1332-1337 (Cannot rename canonical protagonist: Protagonist name is immutable)'
    });
  }

  // ==========================================
  // Attack 10: Faction Cumulative Influence Exceeding 100
  // ==========================================
  {
    const world = createEmptyWorldInfo();
    world.factions.push({ id: 'fac-1', name: 'Faction 1', influence: '80', description: 'fac1' } as any);
    const char = createEmptyCharacter();
    const engine = new SovereignEngine(world, char);

    const propFac = {
      proposalId: 'prop-fac-over',
      requestId: 'req-fac-over',
      eventId: 'ev-fac-over',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM' as const,
      actions: [{
        type: 'ADD_FACTION' as const,
        payload: { id: 'fac-2', name: 'Faction 2', influence: '30', description: 'fac2' } as any
      }]
    };
    const res = engine.submitProposal(propFac);

    results.push({
      attackId: 'ATK-10',
      name: 'Faction Influence Cumulative Cap Invariant (Exceeding 100)',
      reachability: 'REACHABLE (Proposal creates faction pushing sum > 100)',
      entryPoint: 'EngineValidator.validate -> ADD_FACTION total influence check',
      executionMode: 'RUNTIME-INTEGRATED (SovereignEngine)',
      inputPayload: propFac,
      claim: null,
      claimMatchingVerdict: null,
      validatorDecision: res.success,
      rejectedReasons: res.rejectedReasons,
      canonicalBefore: 80,
      canonicalAfter: 80,
      directDelta: {},
      derivedDelta: {},
      stateVersionBefore: 1,
      stateVersionAfter: engine.getSnapshot().stateVersion,
      historyRecordAppended: false,
      nextTurnConsumptionVerified: false,
      verdict: res.success ? 'EXPLOITED' : 'BLOCKED',
      codeEvidence: 'validator.ts:612-616 (Total cumulative faction influence cannot exceed 100)'
    });
  }

  return {
    results,
    summary: {
      total: results.length,
      exploited: results.filter(r => r.verdict === 'EXPLOITED').length,
      blocked: results.filter(r => r.verdict === 'BLOCKED').length
    }
  };
}
