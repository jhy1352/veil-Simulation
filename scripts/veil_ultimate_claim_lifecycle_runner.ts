import { SovereignEngine } from '../src/engine/state';
import { ImmigrationGate } from '../src/engine/immigrationGate';
import { EngineValidator } from '../src/engine/validator';
import { validateLLM2MutationBoundary } from '../src/engine/mutationBoundary';
import {
  StateTransitionProposal,
  TransitionAction,
  ExternalEvidence,
  UntrustedClaim,
  VerifiedClaim,
  CanonicalState,
  ImmutableHistoricalRecord
} from '../src/engine/types';
import { createEmptyWorldInfo, createEmptyCharacter } from '../src/utils/factory';
import { NpcRecord, FactionRecord, Character, WorldInfo } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

export interface UltimateRedTeamResult {
  scenarioNumber: number;
  testId: string;
  name: string;
  category: string;
  description: string;
  attackVector: string;
  claimLifecycleStage: string;
  inputPayload: any;
  gateVerdict: any;
  validatorVerdict: {
    isValid: boolean;
    rejectedReasons: readonly string[];
    conflictDetails: readonly string[];
  };
  commitResult: {
    success: boolean;
    stateVersion: number;
    rejectedReasons: readonly string[];
  };
  stateDiff: {
    stateVersionBefore: number;
    stateVersionAfter: number;
    stateVersionDelta: number;
    turnBefore: number;
    turnAfter: number;
    mutatedFields: string[];
    isCanonicalStateMutated: boolean;
  };
  historyDiff: {
    historyCountBefore: number;
    historyCountAfter: number;
    historyCountDelta: number;
    isHistoryPolluted: boolean;
  };
  verdict: 'CONFIRMED_BREAK' | 'DEFENDED' | 'EXPECTED_BEHAVIOR';
  callGraphAudit: string;
  forensicNotes: string;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

function findMutatedFields(before: any, after: any, prefix = ''): string[] {
  const diffs: string[] = [];
  if (deepEqual(before, after)) return diffs;

  if (before == null || after == null || typeof before !== 'object' || typeof after !== 'object') {
    diffs.push(`${prefix}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    return diffs;
  }

  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  for (const key of allKeys) {
    const valB = before[key];
    const valA = after[key];
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (!deepEqual(valB, valA)) {
      if (typeof valB === 'object' && typeof valA === 'object' && valB !== null && valA !== null && !Array.isArray(valB) && !Array.isArray(valA)) {
        diffs.push(...findMutatedFields(valB, valA, currentPath));
      } else {
        diffs.push(`${currentPath}: ${JSON.stringify(valB)} -> ${JSON.stringify(valA)}`);
      }
    }
  }
  return diffs;
}

function createStandardWorld(): WorldInfo {
  const world = createEmptyWorldInfo();
  world.worldName = '강호풍운록';
  world.factions = [
    { id: 'faction-shaolin', name: '소림사', influence: 30, description: '정파의 태두', hostility: 0 },
    { id: 'faction-wudang', name: '무당파', influence: 25, description: '도교 문파', hostility: 0 },
    { id: 'faction-mount-hua', name: '화산파', influence: 20, description: '매화검법의 본산', hostility: 0 }
  ];
  world.npcs = [
    {
      id: 'npc-hyeon-gong',
      name: '현공 방장',
      status: 'ALIVE',
      impression: 'Neutral',
      role: 'Abbot',
      affiliation: '소림사',
      personality: 'Calm',
      trust: 50,
      affinity: 50
    },
    {
      id: 'npc-cheong-heo',
      name: '청허 도장',
      status: 'ALIVE',
      impression: 'Friendly',
      role: 'Elder',
      affiliation: '무당파',
      personality: 'Honorable',
      trust: 60,
      affinity: 60
    },
    {
      id: 'npc-dead-elder',
      name: '망자 장로',
      status: 'DEAD',
      impression: 'Deceased',
      role: 'Former Elder',
      affiliation: '소림사',
      personality: 'Unknown',
      trust: 0,
      affinity: 0
    }
  ];
  return world;
}

function createStandardCharacter(): Character {
  const character = createEmptyCharacter();
  character.name = '청운';
  character.stats = { strength: 12, agility: 14, constitution: 13, intelligence: 15, wisdom: 11, charisma: 10 };
  character.inventory = [
    { id: 'item-herb', name: '상처약', quantity: 3, description: '회복용 약초' },
    { id: 'item-iron-sword', name: '철검', quantity: 1, description: '일반 철검' }
  ];
  return character;
}

export function runUltimateClaimLifecycleRedTeam(): {
  summary: {
    totalScenarios: number;
    confirmedBreaks: number;
    defended: number;
    expectedBehaviors: number;
  };
  results: UltimateRedTeamResult[];
} {
  const results: UltimateRedTeamResult[] = [];

  function recordScenario(
    scenarioNumber: number,
    testId: string,
    name: string,
    category: string,
    description: string,
    attackVector: string,
    claimLifecycleStage: string,
    execFn: () => {
      inputPayload: any;
      gateVerdict: any;
      validatorVerdict: any;
      commitResult: any;
      snapBefore: CanonicalState;
      snapAfter: CanonicalState;
      histBefore: readonly ImmutableHistoricalRecord[];
      histAfter: readonly ImmutableHistoricalRecord[];
      isAdversarialAttack: boolean;
      forensicNotes: string;
    }
  ) {
    const {
      inputPayload,
      gateVerdict,
      validatorVerdict,
      commitResult,
      snapBefore,
      snapAfter,
      histBefore,
      histAfter,
      isAdversarialAttack,
      forensicNotes
    } = execFn();

    const isMutated = !deepEqual(snapBefore, snapAfter);
    const isHistoryPolluted = histAfter.length !== histBefore.length;
    const stateVersionDelta = snapAfter.stateVersion - snapBefore.stateVersion;
    const historyCountDelta = histAfter.length - histBefore.length;
    const mutatedFields = findMutatedFields(snapBefore, snapAfter);

    let verdict: 'CONFIRMED_BREAK' | 'DEFENDED' | 'EXPECTED_BEHAVIOR';
    if (!isAdversarialAttack) {
      verdict = commitResult.success ? 'EXPECTED_BEHAVIOR' : 'CONFIRMED_BREAK';
    } else {
      if (commitResult.success || isMutated || isHistoryPolluted) {
        verdict = 'CONFIRMED_BREAK';
      } else {
        verdict = 'DEFENDED';
      }
    }

    results.push({
      scenarioNumber,
      testId,
      name,
      category,
      description,
      attackVector,
      claimLifecycleStage,
      inputPayload,
      gateVerdict,
      validatorVerdict: {
        isValid: validatorVerdict.isValid,
        rejectedReasons: validatorVerdict.rejectedReasons || [],
        conflictDetails: validatorVerdict.conflictDetails || []
      },
      commitResult: {
        success: commitResult.success,
        stateVersion: commitResult.stateVersion,
        rejectedReasons: commitResult.rejectedReasons || []
      },
      stateDiff: {
        stateVersionBefore: snapBefore.stateVersion,
        stateVersionAfter: snapAfter.stateVersion,
        stateVersionDelta,
        turnBefore: snapBefore.turn,
        turnAfter: snapAfter.turn,
        mutatedFields,
        isCanonicalStateMutated: isMutated
      },
      historyDiff: {
        historyCountBefore: histBefore.length,
        historyCountAfter: histAfter.length,
        historyCountDelta,
        isHistoryPolluted
      },
      verdict,
      callGraphAudit: 'ImmigrationGate -> MutationBoundary -> Validator -> Draft -> Sovereign Commit',
      forensicNotes
    });
  }

  // =========================================================================
  // SCENARIO 01: Genuine Claim 발급 -> 정상 Commit -> 동일 Claim 즉시 재사용 (Replay)
  // =========================================================================
  recordScenario(
    1,
    'SCENARIO-01-SAME-TURN-REPLAY',
    'Genuine Claim Immediate Replay (Re-use committed claim in new proposal)',
    'Lifecycle / Single-Use Consumption',
    'Genuine Claim is admitted and committed in Turn 1. The exact same Claim object is immediately re-submitted in a second proposal on Turn 1 with fresh requestId/eventId.',
    'Submitting the same VerifiedClaim instance across multiple sequential proposals to double-mutate state without re-admission.',
    'Post-Commit / Replay',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-01',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '무당파의 세력이 30으로 성장하였다.',
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 30
      };
      const admission = ImmigrationGate.admit(
        {
          targetEntityId: 'faction-wudang',
          targetAttribute: 'influence',
          claimedValue: 30,
          claimedEvidenceIds: ['ev-01'],
          rawText: '무당파 세력 30'
        },
        [evidence],
        engine.getSnapshot()
      );
      const claim = admission.verifiedClaim!;

      // 1st Proposal (Legitimate Commit)
      const prop1: StateTransitionProposal = {
        proposalId: 'prop-scen-01-a',
        requestId: 'req-scen-01-a',
        eventId: 'evt-scen-01-a',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Initial valid faction update',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 30 } } }]
      };
      engine.submitProposal(prop1);

      // 2nd Proposal (Attacker reuses the already committed claim in a fresh proposal)
      const snapBefore = engine.getSnapshot();
      const histBefore = engine.getHistory();
      const prop2: StateTransitionProposal = {
        proposalId: 'prop-scen-01-b',
        requestId: 'req-scen-01-b',
        eventId: 'evt-scen-01-b',
        expectedStateVersion: snapBefore.stateVersion,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Replay already-committed claim to re-assert influence 30',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 30 } } }]
      };

      const valVerdict = EngineValidator.validate(prop2, snapBefore, new Set(['req-scen-01-a']), new Set(['evt-scen-01-a']));
      const commitRes = engine.submitProposal(prop2);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: prop2,
        gateVerdict: admission,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'Claim was not marked consumed upon 1st commit; re-submission succeeded and incremented StateVersion to 3.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 02: Claim A 발급 -> Proposal 생성 -> Claim B 발급 -> A Commit
  // =========================================================================
  recordScenario(
    2,
    'SCENARIO-02-INTERLEAVED-ADMISSION',
    'Interleaved Admission Pipeline (Claim A -> Claim B -> Proposal A commit)',
    'Lifecycle / Concurrency & Interleaving',
    'Admit Claim A, then admit Claim B for a different entity. Verify if Claim A can still commit cleanly without being corrupted or superseded by Claim B.',
    'Testing if module-level WeakSet or gate state suffers from single-slot clobbering when multiple claims are admitted in parallel.',
    'Active Interleaving',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const evA: ExternalEvidence = {
        evidenceId: 'ev-02-a',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 28
      };
      const evB: ExternalEvidence = {
        evidenceId: 'ev-02-b',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-shaolin',
        attribute: 'influence',
        value: 32
      };

      const admA = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 28, claimedEvidenceIds: ['ev-02-a'], rawText: '무당 28' },
        [evA],
        engine.getSnapshot()
      );
      const admB = ImmigrationGate.admit(
        { targetEntityId: 'faction-shaolin', targetAttribute: 'influence', claimedValue: 32, claimedEvidenceIds: ['ev-02-b'], rawText: '소림 32' },
        [evB],
        engine.getSnapshot()
      );

      const snapBefore = engine.getSnapshot();
      const histBefore = engine.getHistory();

      const propA: StateTransitionProposal = {
        proposalId: 'prop-02-a',
        requestId: 'req-02-a',
        eventId: 'evt-02-a',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Commit Claim A after Claim B was admitted',
        verifiedClaims: [admA.verifiedClaim!],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 28 } } }]
      };

      const valVerdict = EngineValidator.validate(propA, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(propA);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: propA,
        gateVerdict: { admA, admB },
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: false,
        forensicNotes: 'WeakSet supports multiple concurrent objects; Claim A commits cleanly.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 03: Claim A stale + 최신 expectedStateVersion
  // =========================================================================
  recordScenario(
    3,
    'SCENARIO-03-STALE-CLAIM-LATEST-STATEVERSION',
    'Stale Claim paired with Updated expectedStateVersion',
    'Temporal Replay / StateVersion Decoupling',
    'Claim A was admitted at Turn 1 (v=1). Sovereign state advances 4 versions (v=5). Attacker creates Turn 5 proposal with expectedStateVersion=5 but attaches Turn 1 Claim A.',
    'Bypassing stateVersion checks by updating proposal metadata while reusing an obsolete historical claim.',
    'Stale Replay',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-03',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 35
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-03'], rawText: '무당 35' },
        [ev],
        engine.getSnapshot()
      );
      const staleClaim = adm.verifiedClaim!;

      // Advance engine state 4 times
      for (let i = 1; i <= 4; i++) {
        engine.submitProposal({
          proposalId: `prop-advance-${i}`,
          requestId: `req-adv-${i}`,
          eventId: `evt-adv-${i}`,
          expectedStateVersion: i,
          source: 'SYSTEM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: `Advancing state ${i}`,
          actions: [{ type: 'ADD_RUMOR', payload: { rumor: `소문 ${i}` } }]
        });
      }

      const snapBefore = engine.getSnapshot(); // stateVersion = 5
      const histBefore = engine.getHistory();

      const hostileProp: StateTransitionProposal = {
        proposalId: 'prop-03-hostile',
        requestId: 'req-03-hostile',
        eventId: 'evt-03-hostile',
        expectedStateVersion: 5,
        source: 'LLM',
        turn: 5,
        timestamp: new Date().toISOString(),
        intentSummary: 'Replay Turn 1 claim at Turn 5 with expectedStateVersion 5',
        verifiedClaims: [staleClaim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 35 } } }]
      };

      const valVerdict = EngineValidator.validate(hostileProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(hostileProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: hostileProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'CONFIRMED BREAK: EngineValidator only checks expectedStateVersion === currentState.stateVersion (5 === 5) and does not verify claim freshness vs stateVersion.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 04: Claim A stale + 새 requestId
  // =========================================================================
  recordScenario(
    4,
    'SCENARIO-04-STALE-CLAIM-NEW-REQUESTID',
    'Stale Claim paired with Fresh requestId',
    'Idempotency Bypass / Replay',
    'Claim A was committed in Turn 1 under req-01. Attacker generates a cryptographically fresh requestId req-new-9999 and re-submits Claim A.',
    'Bypassing Idempotency registry by generating fresh requestIds while recycling the authority payload.',
    'Stale Replay',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-04',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'npc-hyeon-gong',
        attribute: 'trust',
        value: 75
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'npc-hyeon-gong', targetAttribute: 'trust', claimedValue: 75, claimedEvidenceIds: ['ev-04'], rawText: '현공 신뢰 75' },
        [ev],
        engine.getSnapshot()
      );
      const claim = adm.verifiedClaim!;

      // 1st Commit
      engine.submitProposal({
        proposalId: 'prop-04-orig',
        requestId: 'req-04-orig',
        eventId: 'evt-04-orig',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Legitimate trust update',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { trust: 75 } } }]
      });

      const snapBefore = engine.getSnapshot();
      const histBefore = engine.getHistory();

      // Fresh Request ID replay
      const hostileProp: StateTransitionProposal = {
        proposalId: 'prop-04-fresh',
        requestId: 'req-fresh-uuid-9999',
        eventId: 'evt-fresh-uuid-9999',
        expectedStateVersion: 2,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Replay trust claim with fresh requestId',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { trust: 75 } } }]
      };

      const valVerdict = EngineValidator.validate(hostileProp, snapBefore, new Set(['req-04-orig']), new Set(['evt-04-orig']));
      const commitRes = engine.submitProposal(hostileProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: hostileProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'CONFIRMED BREAK: RequestId freshness check passes because requestId is new; claim is accepted because it exists in WeakSet.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 05: Claim A stale + 새 eventId
  // =========================================================================
  recordScenario(
    5,
    'SCENARIO-05-STALE-CLAIM-NEW-EVENTID',
    'Stale Claim paired with Fresh eventId',
    'Event Registry Bypass / Replay',
    'Claim A is submitted under a brand new eventId evt-future-9999 to simulate a new historical occurrence.',
    'Bypassing Historical Event deduplication while reusing old authority.',
    'Stale Replay',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-05',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-shaolin',
        attribute: 'influence',
        value: 35
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-shaolin', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-05'], rawText: '소림 35' },
        [ev],
        engine.getSnapshot()
      );
      const claim = adm.verifiedClaim!;

      engine.submitProposal({
        proposalId: 'prop-05-orig',
        requestId: 'req-05-orig',
        eventId: 'evt-05-orig',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Commit Shaolin 35',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 35 } } }]
      });

      const snapBefore = engine.getSnapshot();
      const histBefore = engine.getHistory();

      const hostileProp: StateTransitionProposal = {
        proposalId: 'prop-05-new-event',
        requestId: 'req-05-new-req',
        eventId: 'evt-shaolin-revival-new-event-999',
        expectedStateVersion: 2,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Replay with brand new eventId',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 35 } } }]
      };

      const valVerdict = EngineValidator.validate(hostileProp, snapBefore, new Set(['req-05-orig']), new Set(['evt-05-orig']));
      const commitRes = engine.submitProposal(hostileProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: hostileProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'CONFIRMED BREAK: Event uniqueness check passes because eventId is novel; claim accepted without verification of temporal relevance.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 06: Claim A stale + 새 turn
  // =========================================================================
  recordScenario(
    6,
    'SCENARIO-06-STALE-CLAIM-FUTURE-TURN',
    'Stale Claim injected at Future Turn (Turn 1 Claim at Turn 4)',
    'Temporal Turn Boundary / Lifetime',
    'Claim A was admitted at Turn 1 (verifiedAtTurn: 1). Proposal is submitted at Turn 4 (turn: 4). Attacker asserts Turn 1 claim in Turn 4 context.',
    'Temporal authority leakage across turns.',
    'Stale Replay',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-06',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 40
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 40, claimedEvidenceIds: ['ev-06'], rawText: '무당 40' },
        [ev],
        engine.getSnapshot()
      );
      const claim = adm.verifiedClaim!; // verifiedAtTurn: 1

      // Advance engine to Turn 4
      engine.submitProposal({
        proposalId: 'prop-adv-time',
        requestId: 'req-adv-time',
        eventId: 'evt-adv-time',
        expectedStateVersion: 1,
        source: 'SYSTEM',
        turn: 4,
        timestamp: new Date().toISOString(),
        intentSummary: 'Advance turn',
        actions: [{ type: 'ADVANCE_TIME', payload: { targetTime: { year: 101, season: 'SUMMER', month: 6, day: 1, timeOfDay: 'NOON' } } }]
      });

      const snapBefore = engine.getSnapshot(); // turn = 4, stateVersion = 2
      const histBefore = engine.getHistory();

      const hostileProp: StateTransitionProposal = {
        proposalId: 'prop-06-turn4',
        requestId: 'req-06-turn4',
        eventId: 'evt-06-turn4',
        expectedStateVersion: snapBefore.stateVersion,
        source: 'LLM',
        turn: 4,
        timestamp: new Date().toISOString(),
        intentSummary: 'Replay Turn 1 claim in Turn 4',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 40 } } }]
      };

      const valVerdict = EngineValidator.validate(hostileProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(hostileProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: hostileProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'CONFIRMED BREAK: hasMatchingVerifiedClaim does NOT check claim.verifiedAtTurn === proposal.turn. Old claim commits in future turn.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 07: Stale Claim + Multi-Mutation 묶음 (일부 Genuine, 일부 Stale)
  // =========================================================================
  recordScenario(
    7,
    'SCENARIO-07-HYBRID-GENUINE-AND-STALE-BUNDLE',
    'Multi-Action Proposal with Mixed Genuine & Stale Claims',
    'Piggybacking / Hybrid Replay',
    'Proposal contains Action 1 (Genuine Claim B for Shaolin) and Action 2 (Stale Claim A from Turn 1 for Wudang).',
    'Smuggling stale mutations inside a proposal anchored by a fresh valid claim.',
    'Hybrid Replay',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      // Stale claim from Turn 1
      const evA: ExternalEvidence = {
        evidenceId: 'ev-07-a',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 33
      };
      const admA = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 33, claimedEvidenceIds: ['ev-07-a'], rawText: '무당 33' },
        [evA],
        engine.getSnapshot()
      );
      const staleClaimA = admA.verifiedClaim!;

      // Advance turn to 2
      engine.submitProposal({
        proposalId: 'prop-adv-2',
        requestId: 'req-adv-2',
        eventId: 'evt-adv-2',
        expectedStateVersion: 1,
        source: 'SYSTEM',
        turn: 2,
        timestamp: new Date().toISOString(),
        intentSummary: 'Advance',
        actions: [{ type: 'ADD_RUMOR', payload: { rumor: '새 소문' } }]
      });

      // Fresh claim at Turn 2
      const evB: ExternalEvidence = {
        evidenceId: 'ev-07-b',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 2,
        entityId: 'faction-shaolin',
        attribute: 'influence',
        value: 35
      };
      const admB = ImmigrationGate.admit(
        { targetEntityId: 'faction-shaolin', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-07-b'], rawText: '소림 35' },
        [evB],
        engine.getSnapshot()
      );
      const freshClaimB = admB.verifiedClaim!;

      const snapBefore = engine.getSnapshot();
      const histBefore = engine.getHistory();

      const hybridProp: StateTransitionProposal = {
        proposalId: 'prop-07-hybrid',
        requestId: 'req-07-hybrid',
        eventId: 'evt-07-hybrid',
        expectedStateVersion: 2,
        source: 'LLM',
        turn: 2,
        timestamp: new Date().toISOString(),
        intentSummary: 'Hybrid proposal with 1 fresh claim + 1 stale claim',
        verifiedClaims: [freshClaimB, staleClaimA],
        actions: [
          { type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 35 } } },
          { type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 33 } } }
        ]
      };

      const valVerdict = EngineValidator.validate(hybridProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(hybridProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: hybridProp,
        gateVerdict: { admA, admB },
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'CONFIRMED BREAK: Both actions committed because validator treated stale claim as equally valid capability.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 08: Stale Claim + Cross-Entity 재사용
  // =========================================================================
  recordScenario(
    8,
    'SCENARIO-08-STALE-CLAIM-CROSS-ENTITY',
    'Cross-Entity Claim Hijacking (Wudang claim applied to Shaolin)',
    'Entity Transference / Authority Boundary',
    'Attacker acquires a genuine VerifiedClaim for faction-wudang and attempts to apply it to an UPDATE_FACTION on faction-shaolin.',
    'Cross-entity authority expansion.',
    'Entity Boundary',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-08',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 35
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-08'], rawText: '무당 35' },
        [ev],
        engine.getSnapshot()
      );
      const claim = adm.verifiedClaim!;

      const snapBefore = engine.getSnapshot();
      const histBefore = engine.getHistory();

      const hostileProp: StateTransitionProposal = {
        proposalId: 'prop-08-cross-entity',
        requestId: 'req-08-cross-entity',
        eventId: 'evt-08-cross-entity',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Apply Wudang claim to Shaolin update',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 35 } } }]
      };

      const valVerdict = EngineValidator.validate(hostileProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(hostileProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: hostileProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'DEFENDED: hasMatchingVerifiedClaim strictly enforces targetEntityId match (faction-wudang !== faction-shaolin).'
      };
    }
  );

  // =========================================================================
  // SCENARIO 09: Stale Claim + Cross-Attribute 재사용
  // =========================================================================
  recordScenario(
    9,
    'SCENARIO-09-STALE-CLAIM-CROSS-ATTRIBUTE',
    'Cross-Attribute Claim Hijacking (influence claim applied to name/description)',
    'Attribute Transference / Authority Boundary',
    'Attacker acquires a genuine VerifiedClaim for faction-wudang (attribute: influence) and attempts to use it to modify description.',
    'Cross-attribute authority expansion.',
    'Attribute Boundary',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-09',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 35
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-09'], rawText: '무당 35' },
        [ev],
        engine.getSnapshot()
      );
      const claim = adm.verifiedClaim!;

      const snapBefore = engine.getSnapshot();
      const histBefore = engine.getHistory();

      const hostileProp: StateTransitionProposal = {
        proposalId: 'prop-09-cross-attr',
        requestId: 'req-09-cross-attr',
        eventId: 'evt-09-cross-attr',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Use influence claim to mutate description',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { description: '탈취된 설명' } } }]
      };

      const valVerdict = EngineValidator.validate(hostileProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(hostileProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: hostileProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'DEFENDED: hasMatchingVerifiedClaim strictly verifies targetAttribute match (influence !== description).'
      };
    }
  );

  // =========================================================================
  // SCENARIO 10: Stale Claim + Cross-Value 변조
  // =========================================================================
  recordScenario(
    10,
    'SCENARIO-10-STALE-CLAIM-CROSS-VALUE',
    'Value Inflation / Value Tampering (Claim says 35, Action mutates to 60)',
    'Value Matching / Grounding Boundary',
    'Attacker attaches a genuine VerifiedClaim for influence=35, but specifies influence=60 in the UPDATE_FACTION payload.',
    'Inflating or altering verified value inside proposal payload.',
    'Value Grounding',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-10',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 35
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-10'], rawText: '무당 35' },
        [ev],
        engine.getSnapshot()
      );
      const claim = adm.verifiedClaim!;

      const snapBefore = engine.getSnapshot();
      const histBefore = engine.getHistory();

      const hostileProp: StateTransitionProposal = {
        proposalId: 'prop-10-inflated',
        requestId: 'req-10-inflated',
        eventId: 'evt-10-inflated',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Inflate influence from verified 35 to 60',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 60 } } }]
      };

      const valVerdict = EngineValidator.validate(hostileProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(hostileProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: hostileProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'DEFENDED: hasMatchingVerifiedClaim enforces exact value equality via isDeepEqual(c.verifiedValue, expectedValue).'
      };
    }
  );

  // =========================================================================
  // SCENARIO 11: Stale Claim + State 이미 다른 값으로 변경된 뒤 Replay (World Reversal)
  // =========================================================================
  recordScenario(
    11,
    'SCENARIO-11-HISTORICAL-STATE-REVERSAL',
    'Historical World State Reversal via Stale Claim Replay',
    'Temporal Invariant / State Integrity',
    'Turn 1: Wudang influence increases to 35 (Claim 1 committed). Turn 2: Wudang suffers defeat and drops to 10 (Claim 2 committed). Turn 3: Attacker replays Claim 1 to silently revert Wudang back to 35 without new evidence.',
    'Reverting legitimate canonical state evolution by replaying old claims.',
    'Temporal Replay',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      // Turn 1 Claim
      const ev1: ExternalEvidence = {
        evidenceId: 'ev-11-t1',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 35
      };
      const adm1 = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-11-t1'], rawText: '무당 35' },
        [ev1],
        engine.getSnapshot()
      );
      const claimT1 = adm1.verifiedClaim!;

      // Commit Turn 1 (Wudang = 35, stateVersion = 2)
      engine.submitProposal({
        proposalId: 'prop-11-t1',
        requestId: 'req-11-t1',
        eventId: 'evt-11-t1',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Turn 1 Wudang rises to 35',
        verifiedClaims: [claimT1],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 35 } } }]
      });

      // Turn 2: Wudang drops to 10 (Claim 2 committed, stateVersion = 3)
      const ev2: ExternalEvidence = {
        evidenceId: 'ev-11-t2',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 2,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 10
      };
      const adm2 = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 10, claimedEvidenceIds: ['ev-11-t2'], rawText: '무당 10' },
        [ev2],
        engine.getSnapshot()
      );
      const claimT2 = adm2.verifiedClaim!;

      engine.submitProposal({
        proposalId: 'prop-11-t2',
        requestId: 'req-11-t2',
        eventId: 'evt-11-t2',
        expectedStateVersion: 2,
        source: 'LLM',
        turn: 2,
        timestamp: new Date().toISOString(),
        intentSummary: 'Turn 2 Wudang collapses to 10',
        verifiedClaims: [claimT2],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 10 } } }]
      });

      const snapBefore = engine.getSnapshot(); // Wudang influence = 10, stateVersion = 3
      const histBefore = engine.getHistory();

      // Turn 3: Attacker replays Claim 1 to revert Wudang back to 35!
      const hostileProp: StateTransitionProposal = {
        proposalId: 'prop-11-reversal',
        requestId: 'req-11-reversal',
        eventId: 'evt-11-reversal',
        expectedStateVersion: 3,
        source: 'LLM',
        turn: 3,
        timestamp: new Date().toISOString(),
        intentSummary: 'Hostile replay of Turn 1 claim to overwrite Turn 2 disaster',
        verifiedClaims: [claimT1],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 35 } } }]
      };

      const valVerdict = EngineValidator.validate(hostileProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(hostileProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: hostileProp,
        gateVerdict: { adm1, adm2 },
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'CONFIRMED BREAK: Canonical reality was rewritten from 10 -> 35 using an unrevoked historical claim.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 12: Stale Claim + 중간에 Rejection 발생 후 재사용
  // =========================================================================
  recordScenario(
    12,
    'SCENARIO-12-CLAIM-LIFECYCLE-POST-REJECTION',
    'Claim Reusability after Rejection of Containing Proposal',
    'Lifecycle / Rejection Resilience',
    'Claim A is attached to a proposal that gets rejected due to an illegal secondary action (e.g. invalid stat). Attacker extracts Claim A and submits it in a corrected proposal.',
    'Investigating if rejection destroys or preserves claim authority.',
    'Post-Rejection Replay',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-12',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 35
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-12'], rawText: '무당 35' },
        [ev],
        engine.getSnapshot()
      );
      const claim = adm.verifiedClaim!;

      // 1. Rejected proposal containing Claim A
      engine.submitProposal({
        proposalId: 'prop-12-failed',
        requestId: 'req-12-failed',
        eventId: 'evt-12-failed',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Bad proposal with illegal stat',
        verifiedClaims: [claim],
        actions: [
          { type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 35 } } },
          { type: 'UPDATE_CHARACTER_STATS', payload: { strength: -99 } } // Triggers rejection
        ]
      });

      const snapBefore = engine.getSnapshot(); // Still stateVersion = 1
      const histBefore = engine.getHistory();

      // 2. Fixed proposal resubmitting Claim A
      const fixedProp: StateTransitionProposal = {
        proposalId: 'prop-12-fixed',
        requestId: 'req-12-fixed',
        eventId: 'evt-12-fixed',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Clean proposal resubmitting Claim A',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 35 } } }]
      };

      const valVerdict = EngineValidator.validate(fixedProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(fixedProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: fixedProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: false, // Legitimate retry on same turn
        forensicNotes: 'Claim authority survives rejection because WeakSet membership is uncoupled from proposal outcome.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 13: Stale Claim + 중간에 Conflict 발생 후 재사용
  // =========================================================================
  recordScenario(
    13,
    'SCENARIO-13-CLAIM-LIFECYCLE-POST-CONFLICT',
    'Claim Reusability after State Conflict',
    'Lifecycle / Conflict Resilience',
    'Claim A encounters a STALE_STATE_CONFLICT because expectedStateVersion was wrong. Attacker updates expectedStateVersion and retries with the same Claim A.',
    'Investigating if conflict resolution allows re-submission.',
    'Post-Conflict Retry',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-13',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 30
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 30, claimedEvidenceIds: ['ev-13'], rawText: '무당 30' },
        [ev],
        engine.getSnapshot()
      );
      const claim = adm.verifiedClaim!;

      // Trigger stateVersion conflict
      engine.submitProposal({
        proposalId: 'prop-13-conflict',
        requestId: 'req-13-conflict',
        eventId: 'evt-13-conflict',
        expectedStateVersion: 999, // Stale state version conflict
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Stale version',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 30 } } }]
      });

      const snapBefore = engine.getSnapshot();
      const histBefore = engine.getHistory();

      // Retry with correct version
      const retryProp: StateTransitionProposal = {
        proposalId: 'prop-13-retry',
        requestId: 'req-13-retry',
        eventId: 'evt-13-retry',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Corrected version retry',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 30 } } }]
      };

      const valVerdict = EngineValidator.validate(retryProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(retryProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: retryProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: false,
        forensicNotes: 'Retry commits successfully once conflict is resolved.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 14: Stale Claim + 중간에 Rollback/Fail-closed 발생 후 재사용
  // =========================================================================
  recordScenario(
    14,
    'SCENARIO-14-CLAIM-LIFECYCLE-POST-FAIL-CLOSED',
    'Claim Reusability after Fail-Closed Mid-Execution Rollback',
    'Lifecycle / Rollback Resilience',
    'Proposal with Claim A fails during sequential virtual draft evaluation (action 3 fails). Check if Claim A remains valid for subsequent proposals.',
    'Verifying that draft rollbacks leave the WeakSet claim authority intact.',
    'Rollback Resilience',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-14',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 30
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 30, claimedEvidenceIds: ['ev-14'], rawText: '무당 30' },
        [ev],
        engine.getSnapshot()
      );
      const claim = adm.verifiedClaim!;

      // Fail-closed proposal
      engine.submitProposal({
        proposalId: 'prop-14-fail',
        requestId: 'req-14-fail',
        eventId: 'evt-14-fail',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Action 1 has claim, Action 2 attempts illegal dead NPC revival',
        verifiedClaims: [claim],
        actions: [
          { type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 30 } } },
          { type: 'SET_NPC_STATUS', payload: { id: 'npc-dead-elder', status: 'ALIVE' } }
        ]
      });

      const snapBefore = engine.getSnapshot();
      const histBefore = engine.getHistory();

      // Clean retry
      const cleanProp: StateTransitionProposal = {
        proposalId: 'prop-14-clean',
        requestId: 'req-14-clean',
        eventId: 'evt-14-clean',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Clean proposal with only Claim A',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 30 } } }]
      };

      const valVerdict = EngineValidator.validate(cleanProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(cleanProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: cleanProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: false,
        forensicNotes: 'Fail-closed behavior cleanly leaves engine state and claim intact for legitimate retry.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 15: Save/Load 직전 Genuine Claim 발급 -> Save -> Load -> JSON Deserialized Claim 주입
  // =========================================================================
  recordScenario(
    15,
    'SCENARIO-15-SAVE-LOAD-DESERIALIZED-CLAIM',
    'Save/Load Boundary: JSON-Deserialized Claim Replay',
    'Persistence Boundary / Memory Identity',
    'Genuine Claim is issued. Session is saved to JSON. Claim is deserialized via JSON.parse. Attacker attempts to use deserialized claim on hydrated engine.',
    'Testing if JSON deserialization strips WeakSet authority registration.',
    'Save/Load Serialization',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-15',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 35
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-15'], rawText: '무당 35' },
        [ev],
        engine.getSnapshot()
      );
      const claim = adm.verifiedClaim!;

      // Save & Hydrate
      const serializedClaim = JSON.parse(JSON.stringify(claim)); // Exact clone without WeakSet identity
      const hydratedEngine = SovereignEngine.hydrate(engine.getSnapshot(), engine.getHistory());

      const snapBefore = hydratedEngine.getSnapshot();
      const histBefore = hydratedEngine.getHistory();

      const propWithDeserializedClaim: StateTransitionProposal = {
        proposalId: 'prop-15-deserialized',
        requestId: 'req-15-deserialized',
        eventId: 'evt-15-deserialized',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Submit JSON-deserialized claim',
        verifiedClaims: [serializedClaim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 35 } } }]
      };

      const valVerdict = EngineValidator.validate(propWithDeserializedClaim, snapBefore, new Set(), new Set());
      const commitRes = hydratedEngine.submitProposal(propWithDeserializedClaim);
      const snapAfter = hydratedEngine.getSnapshot();
      const histAfter = hydratedEngine.getHistory();

      return {
        inputPayload: propWithDeserializedClaim,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'DEFENDED: JSON deserialization creates a new object reference which is NOT present in ISSUED_VERIFIED_CLAIMS (WeakSet). Rejected.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 16: Save/Load 직후 In-Memory Claim Reference 재사용
  // =========================================================================
  recordScenario(
    16,
    'SCENARIO-16-SAVE-LOAD-IN-MEMORY-CROSS-SESSION-REPLAY',
    'Save/Load Boundary: In-Memory Original Object Reused on Hydrated Engine',
    'Persistence Boundary / Global WeakSet Bleed',
    'Claim A is issued in Session 1. Engine is saved and hydrated as a new Session 2 instance. Attacker attaches the original in-memory Claim A object reference to Session 2.',
    'Testing if module-level WeakSet leaks authority across engine instances / reloads in long-running processes.',
    'Global WeakSet Scope',
    () => {
      const engine1 = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-16',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 35
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-16'], rawText: '무당 35' },
        [ev],
        engine1.getSnapshot()
      );
      const originalInMemoryClaim = adm.verifiedClaim!;

      // Hydrate into new independent engine instance
      const engine2 = SovereignEngine.hydrate(engine1.getSnapshot(), engine1.getHistory());

      const snapBefore = engine2.getSnapshot();
      const histBefore = engine2.getHistory();

      const crossSessionProp: StateTransitionProposal = {
        proposalId: 'prop-16-cross-session',
        requestId: 'req-16-cross-session',
        eventId: 'evt-16-cross-session',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Submit pre-hydration in-memory claim to hydrated engine instance',
        verifiedClaims: [originalInMemoryClaim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 35 } } }]
      };

      const valVerdict = EngineValidator.validate(crossSessionProp, snapBefore, new Set(), new Set());
      const commitRes = engine2.submitProposal(crossSessionProp);
      const snapAfter = engine2.getSnapshot();
      const histAfter = engine2.getHistory();

      return {
        inputPayload: crossSessionProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'CONFIRMED BREAK: ISSUED_VERIFIED_CLAIMS is a module-scoped global WeakSet. An in-memory reference created before hydration remains authoritative on newly hydrated engines.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 17: Claim 발급 후 proposal에 넣지 않고 N턴 대기 후 주입
  // =========================================================================
  recordScenario(
    17,
    'SCENARIO-17-DORMANT-CLAIM-DELAYED-INJECTION',
    'Dormant Claim Delayed Injection (Claim hoarded for 5 turns)',
    'Temporal Lifetime / Claim Hoarding',
    'Attacker admits Claim at Turn 1, intentionally withholds it from all proposals for 5 turns, and injects it on Turn 6 without re-admission.',
    'Exploiting lack of TTL / expiration on admitted claims.',
    'Dormant Hoarding',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-17',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 35
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-17'], rawText: '무당 35' },
        [ev],
        engine.getSnapshot()
      );
      const hoardedClaim = adm.verifiedClaim!;

      // 5 turns pass normally
      for (let t = 2; t <= 6; t++) {
        engine.submitProposal({
          proposalId: `prop-turn-${t}`,
          requestId: `req-turn-${t}`,
          eventId: `evt-turn-${t}`,
          expectedStateVersion: t - 1,
          source: 'SYSTEM',
          turn: t,
          timestamp: new Date().toISOString(),
          intentSummary: `Turn ${t}`,
          actions: [{ type: 'ADD_RUMOR', payload: { rumor: `소문 ${t}` } }]
        });
      }

      const snapBefore = engine.getSnapshot(); // Turn = 6, stateVersion = 6
      const histBefore = engine.getHistory();

      // Inject 5-turn old dormant claim
      const delayedProp: StateTransitionProposal = {
        proposalId: 'prop-17-delayed',
        requestId: 'req-17-delayed',
        eventId: 'evt-17-delayed',
        expectedStateVersion: 6,
        source: 'LLM',
        turn: 6,
        timestamp: new Date().toISOString(),
        intentSummary: 'Inject 5-turn old hoarded claim',
        verifiedClaims: [hoardedClaim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 35 } } }]
      };

      const valVerdict = EngineValidator.validate(delayedProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(delayedProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: delayedProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'CONFIRMED BREAK: No TTL or turn-expiration exists for claims. Dormant claim injected at Turn 6 committed unconditionally.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 18: Claim 2개 발급 후 하나만 Commit -> 나머지 하나 N턴 후 주입
  // =========================================================================
  recordScenario(
    18,
    'SCENARIO-18-PARTIALLY-COMMITTED-CLAIM-PAIR',
    'Partially Committed Claim Pair (Claim A committed Turn 1, Claim B held until Turn 5)',
    'Temporal Lifetime / Unused Claim Persistence',
    'Two claims (Claim A and Claim B) are issued together at Turn 1. Claim A is committed. Claim B is kept in reserve and injected at Turn 5.',
    'Testing if committing one claim from an admission batch invalidates or leaves the sibling claim active.',
    'Batch Desynchronization',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const evA: ExternalEvidence = {
        evidenceId: 'ev-18-a',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 30
      };
      const evB: ExternalEvidence = {
        evidenceId: 'ev-18-b',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-shaolin',
        attribute: 'influence',
        value: 35
      };

      const admA = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 30, claimedEvidenceIds: ['ev-18-a'], rawText: '무당 30' },
        [evA],
        engine.getSnapshot()
      );
      const admB = ImmigrationGate.admit(
        { targetEntityId: 'faction-shaolin', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-18-b'], rawText: '소림 35' },
        [evB],
        engine.getSnapshot()
      );

      const claimA = admA.verifiedClaim!;
      const claimB = admB.verifiedClaim!;

      // Commit Claim A at Turn 1
      engine.submitProposal({
        proposalId: 'prop-18-a',
        requestId: 'req-18-a',
        eventId: 'evt-18-a',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Commit Claim A',
        verifiedClaims: [claimA],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 30 } } }]
      });

      // 4 turns pass
      for (let t = 2; t <= 5; t++) {
        engine.submitProposal({
          proposalId: `prop-18-t${t}`,
          requestId: `req-18-t${t}`,
          eventId: `evt-18-t${t}`,
          expectedStateVersion: t,
          source: 'SYSTEM',
          turn: t,
          timestamp: new Date().toISOString(),
          intentSummary: `Turn ${t}`,
          actions: [{ type: 'ADD_RUMOR', payload: { rumor: `소문 ${t}` } }]
        });
      }

      const snapBefore = engine.getSnapshot(); // Turn = 5, stateVersion = 6
      const histBefore = engine.getHistory();

      // Inject uncommitted Claim B at Turn 5
      const delayedPropB: StateTransitionProposal = {
        proposalId: 'prop-18-b-delayed',
        requestId: 'req-18-b-delayed',
        eventId: 'evt-18-b-delayed',
        expectedStateVersion: 6,
        source: 'LLM',
        turn: 5,
        timestamp: new Date().toISOString(),
        intentSummary: 'Inject sibling Claim B after 4 turns',
        verifiedClaims: [claimB],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 35 } } }]
      };

      const valVerdict = EngineValidator.validate(delayedPropB, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(delayedPropB);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: delayedPropB,
        gateVerdict: { admA, admB },
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'CONFIRMED BREAK: Unused sibling claim remained fully authoritative and committed 4 turns later.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 19: 동일 Entity에 대해 상반된 Claim 2개 순차 발급 -> 순차 주입
  // =========================================================================
  recordScenario(
    19,
    'SCENARIO-19-SEQUENTIAL-CONTRADICTORY-CLAIMS',
    'Sequential Contradictory Claims Admitted Across Time',
    'Causality / Contradiction Resolution',
    'Turn 1: Claim A1 (Wudang influence = 30) admitted and committed. Turn 2: Fresh evidence arrives asserting Wudang influence = 15 (Claim A2 admitted and committed).',
    'Verifying that sequential contradictory claims with valid temporal evidence commit properly.',
    'Temporal Causality',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      // Turn 1 Claim
      const ev1: ExternalEvidence = {
        evidenceId: 'ev-19-1',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 30
      };
      const adm1 = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 30, claimedEvidenceIds: ['ev-19-1'], rawText: '무당 30' },
        [ev1],
        engine.getSnapshot()
      );
      engine.submitProposal({
        proposalId: 'prop-19-1',
        requestId: 'req-19-1',
        eventId: 'evt-19-1',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Turn 1 influence 30',
        verifiedClaims: [adm1.verifiedClaim!],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 30 } } }]
      });

      // Turn 2 Claim
      const snapBefore = engine.getSnapshot();
      const histBefore = engine.getHistory();
      const ev2: ExternalEvidence = {
        evidenceId: 'ev-19-2',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 2,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 15
      };
      const adm2 = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 15, claimedEvidenceIds: ['ev-19-2'], rawText: '무당 15' },
        [ev2],
        snapBefore
      );

      const prop2: StateTransitionProposal = {
        proposalId: 'prop-19-2',
        requestId: 'req-19-2',
        eventId: 'evt-19-2',
        expectedStateVersion: 2,
        source: 'LLM',
        turn: 2,
        timestamp: new Date().toISOString(),
        intentSummary: 'Turn 2 influence 15',
        verifiedClaims: [adm2.verifiedClaim!],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 15 } } }]
      };

      const valVerdict = EngineValidator.validate(prop2, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(prop2);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: prop2,
        gateVerdict: { adm1, adm2 },
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: false, // Legitimate sequential update with fresh evidence
        forensicNotes: 'Sequential legitimate evolution commits smoothly.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 20: 동일 Entity에 대해 상반된 Claim 2개 단일 Proposal에 동시 주입
  // =========================================================================
  recordScenario(
    20,
    'SCENARIO-20-INTRA-PROPOSAL-CONTRADICTION',
    'Simultaneous Contradictory Claims in a Single Proposal',
    'Intra-Proposal Atomicity / Conflict',
    'Attacker attaches Claim 1 (Wudang influence = 30) and Claim 2 (Wudang influence = 15) to a single proposal containing conflicting UPDATE_FACTION actions.',
    'Testing if intra-proposal sequential validation handles contradictory claims on the same entity.',
    'Intra-Proposal Contradiction',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev1: ExternalEvidence = {
        evidenceId: 'ev-20-1',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 30
      };
      const ev2: ExternalEvidence = {
        evidenceId: 'ev-20-2',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 15
      };

      const adm1 = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 30, claimedEvidenceIds: ['ev-20-1'], rawText: '무당 30' },
        [ev1],
        engine.getSnapshot()
      );
      const adm2 = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 15, claimedEvidenceIds: ['ev-20-2'], rawText: '무당 15' },
        [ev2],
        engine.getSnapshot()
      );

      const snapBefore = engine.getSnapshot();
      const histBefore = engine.getHistory();

      // Proposal with 2 contradictory actions on the same entity
      const contradictoryProp: StateTransitionProposal = {
        proposalId: 'prop-20-contradictory',
        requestId: 'req-20-contradictory',
        eventId: 'evt-20-contradictory',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Contradictory actions in single proposal',
        verifiedClaims: [adm1.verifiedClaim!, adm2.verifiedClaim!],
        actions: [
          { type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 30 } } },
          { type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 15 } } }
        ]
      };

      const valVerdict = EngineValidator.validate(contradictoryProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(contradictoryProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: contradictoryProp,
        gateVerdict: { adm1, adm2 },
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'Virtual draft sequentially applies action 1 (infl=30) then action 2 (infl=15), resulting in final influence=15. Both actions had matching claims in the array.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 21: Claim 발급 -> 해당 Entity 사망/삭제 -> Claim 주입
  // =========================================================================
  recordScenario(
    21,
    'SCENARIO-21-CLAIM-ON-DEAD-ENTITY',
    'Claim Injection against Historically Dead Entity',
    'Article 2 Invariant / Dead Entity Immutability',
    'Claim is issued to update trust on npc-dead-elder. Attacker attempts to commit UPDATE_NPC on the dead entity using the genuine claim.',
    'Bypassing DEAD NPC status protection using a gate-admitted claim.',
    'Dead Entity Protection',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-21',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'npc-dead-elder',
        attribute: 'trust',
        value: 90
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'npc-dead-elder', targetAttribute: 'trust', claimedValue: 90, claimedEvidenceIds: ['ev-21'], rawText: '망자 장로 신뢰 90' },
        [ev],
        engine.getSnapshot()
      );
      const claim = adm.verifiedClaim!;

      const snapBefore = engine.getSnapshot();
      const histBefore = engine.getHistory();

      const hostileProp: StateTransitionProposal = {
        proposalId: 'prop-21-dead-npc',
        requestId: 'req-21-dead-npc',
        eventId: 'evt-21-dead-npc',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Mutate dead NPC with verified claim',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_NPC', payload: { id: 'npc-dead-elder', changes: { trust: 90 } } }]
      };

      const valVerdict = EngineValidator.validate(hostileProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(hostileProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: hostileProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'DEFENDED: EngineValidator Article 2 protection rejects mutations on DEAD NPCs before claim checks can compromise the invariant.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 22: Claim 발급 -> StateVersion 10회 증가 -> Claim 주입
  // =========================================================================
  recordScenario(
    22,
    'SCENARIO-22-STATEVERSION-10X-AGING',
    'Claim Aging across 10 StateVersion increments',
    'Aging / Version Disconnect',
    'Claim issued at v=1. Sovereign state advances 10 versions (v=11). Attacker submits proposal at v=11 with the 10-version-old claim.',
    'Testing if high state version delta causes any validation failure or rejection.',
    'Version Aging',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-22',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 35
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-22'], rawText: '무당 35' },
        [ev],
        engine.getSnapshot()
      );
      const agedClaim = adm.verifiedClaim!;

      // Advance stateVersion 10 times
      for (let v = 1; v <= 10; v++) {
        engine.submitProposal({
          proposalId: `prop-v-${v}`,
          requestId: `req-v-${v}`,
          eventId: `evt-v-${v}`,
          expectedStateVersion: v,
          source: 'SYSTEM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: `Advancing to ${v + 1}`,
          actions: [{ type: 'ADD_RUMOR', payload: { rumor: `소문 v${v}` } }]
        });
      }

      const snapBefore = engine.getSnapshot(); // stateVersion = 11
      const histBefore = engine.getHistory();

      const agedProp: StateTransitionProposal = {
        proposalId: 'prop-22-aged',
        requestId: 'req-22-aged',
        eventId: 'evt-22-aged',
        expectedStateVersion: 11,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Commit 10-version-aged claim',
        verifiedClaims: [agedClaim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 35 } } }]
      };

      const valVerdict = EngineValidator.validate(agedProp, snapBefore, new Set(), new Set());
      const commitRes = engine.submitProposal(agedProp);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: agedProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'CONFIRMED BREAK: State version aging (+10 versions) does not degrade claim validity. Claim commits at v=11.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 23: WeakSet memory lifecycle 검증 (Module global scope audit)
  // =========================================================================
  recordScenario(
    23,
    'SCENARIO-23-WEAKSET-MODULE-LIFECYCLE-AUDIT',
    'Static Module-Scope WeakSet Lifecycle & Isolation Audit',
    'Memory Architecture / WeakSet Isolation',
    'Audit whether ISSUED_VERIFIED_CLAIMS is instance-bound to SovereignEngine or a static module-level singleton in immigrationGate.ts.',
    'Assessing multi-tenant / multi-session authority isolation.',
    'Architectural Memory Scope',
    () => {
      const engineA = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const engineB = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);

      const ev: ExternalEvidence = {
        evidenceId: 'ev-23',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 35
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-23'], rawText: '무당 35' },
        [ev],
        engineA.getSnapshot()
      );
      const claimFromEngineA = adm.verifiedClaim!;

      // Attempt to submit Claim from Engine A into independent Engine B
      const snapBefore = engineB.getSnapshot();
      const histBefore = engineB.getHistory();

      const crossEngineProp: StateTransitionProposal = {
        proposalId: 'prop-23-cross-engine',
        requestId: 'req-23-cross-engine',
        eventId: 'evt-23-cross-engine',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Submit claim issued for Engine A into Engine B',
        verifiedClaims: [claimFromEngineA],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 35 } } }]
      };

      const valVerdict = EngineValidator.validate(crossEngineProp, snapBefore, new Set(), new Set());
      const commitRes = engineB.submitProposal(crossEngineProp);
      const snapAfter = engineB.getSnapshot();
      const histAfter = engineB.getHistory();

      return {
        inputPayload: crossEngineProp,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'CONFIRMED BREAK: ISSUED_VERIFIED_CLAIMS is a module-level global singleton. Claims issued for one engine instance are recognized as authoritative by all engine instances in the same runtime process.'
      };
    }
  );

  // =========================================================================
  // SCENARIO 24: Concurrent / Sequential Proposal에서 동일 Claim 경합
  // =========================================================================
  recordScenario(
    24,
    'SCENARIO-24-SEQUENTIAL-PROPOSAL-CLAIM-CONTENTION',
    'Proposal Contention with Identical Claim Instance',
    'Concurrency / Single-Use Authority',
    'Two distinct proposals (Proposal 1 and Proposal 2 with different requestIds) both attach the exact same VerifiedClaim instance. Both are submitted sequentially to the engine.',
    'Testing if Proposal 1 consuming the claim prevents Proposal 2 from succeeding.',
    'Claim Contention',
    () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
      const ev: ExternalEvidence = {
        evidenceId: 'ev-24',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 30
      };
      const adm = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 30, claimedEvidenceIds: ['ev-24'], rawText: '무당 30' },
        [ev],
        engine.getSnapshot()
      );
      const claim = adm.verifiedClaim!;

      // Proposal 1
      const prop1: StateTransitionProposal = {
        proposalId: 'prop-24-1',
        requestId: 'req-24-1',
        eventId: 'evt-24-1',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Proposal 1 carrying Claim',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 30 } } }]
      };
      engine.submitProposal(prop1);

      const snapBefore = engine.getSnapshot(); // stateVersion = 2
      const histBefore = engine.getHistory();

      // Proposal 2 (different requestId, expectedStateVersion = 2) carrying SAME claim
      const prop2: StateTransitionProposal = {
        proposalId: 'prop-24-2',
        requestId: 'req-24-2',
        eventId: 'evt-24-2',
        expectedStateVersion: 2,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Proposal 2 carrying SAME Claim',
        verifiedClaims: [claim],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 30 } } }]
      };

      const valVerdict = EngineValidator.validate(prop2, snapBefore, new Set(['req-24-1']), new Set(['evt-24-1']));
      const commitRes = engine.submitProposal(prop2);
      const snapAfter = engine.getSnapshot();
      const histAfter = engine.getHistory();

      return {
        inputPayload: prop2,
        gateVerdict: adm,
        validatorVerdict: valVerdict,
        commitResult: commitRes,
        snapBefore,
        snapAfter,
        histBefore,
        histAfter,
        isAdversarialAttack: true,
        forensicNotes: 'CONFIRMED BREAK: Both proposals succeeded sequentially using the same VerifiedClaim instance. Claim was not consumed or revoked by Proposal 1.'
      };
    }
  );

  const confirmedBreaks = results.filter(r => r.verdict === 'CONFIRMED_BREAK').length;
  const defended = results.filter(r => r.verdict === 'DEFENDED').length;
  const expectedBehaviors = results.filter(r => r.verdict === 'EXPECTED_BEHAVIOR').length;

  return {
    summary: {
      totalScenarios: results.length,
      confirmedBreaks,
      defended,
      expectedBehaviors
    },
    results
  };
}

// If executed directly, run and output evidence
const auditOutput = runUltimateClaimLifecycleRedTeam();
const reportDir = path.resolve(process.cwd(), 'report/13_veil_claim_lifecycle_redteam');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

fs.writeFileSync(
  path.join(reportDir, 'raw_evidence.json'),
  JSON.stringify(auditOutput, null, 2),
  'utf-8'
);

console.log(`[AUDIT COMPLETE] Total Scenarios: ${auditOutput.summary.totalScenarios}`);
console.log(`[BREAKS DETECTED]: ${auditOutput.summary.confirmedBreaks}`);
console.log(`[DEFENDED]: ${auditOutput.summary.defended}`);
console.log(`[EXPECTED]: ${auditOutput.summary.expectedBehaviors}`);
