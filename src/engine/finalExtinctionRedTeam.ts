import { SovereignEngine } from './state';
import { ImmigrationGate } from './immigrationGate';
import { EngineValidator } from './validator';
import { validateLLM2MutationBoundary } from './mutationBoundary';
import {
  StateTransitionProposal,
  TransitionAction,
  ExternalEvidence,
  UntrustedClaim,
  VerifiedClaim,
  CanonicalState,
  ImmutableHistoricalRecord
} from './types';
import { createEmptyWorldInfo, createEmptyCharacter } from '../utils/factory';
import { NpcRecord, FactionRecord, Character, WorldInfo } from '../types';
import { MeaningNode } from './language/types';
import { adaptMeaningTreeToProposal } from './language/adapter';
import * as fs from 'fs';
import * as path from 'path';

export interface RedTeamTestResult {
  testId: string;
  category: string;
  description: string;
  attackVector: string;
  vulnerabilityDiscovered: boolean;
  verdict: 'DEFENDED' | 'EXPLOITED' | 'EXPECTED_COMMIT';
  pipelineStageDetected: string;
  stateMutated: boolean;
  historyPolluted: boolean;
  stateVersionDelta: number;
  historyCountDelta: number;
  rejectedReasons?: readonly string[];
  conflictDetails?: readonly string[];
  exploitDetails?: string;
  callGraphAudit: string;
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

export function runFullExtinctionRedTeamSuite(): {
  total: number;
  defended: number;
  exploited: number;
  expectedCommit: number;
  results: RedTeamTestResult[];
} {
  const results: RedTeamTestResult[] = [];

  function createStandardWorld(): WorldInfo {
    const world = createEmptyWorldInfo();
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

  function createStandardEngine(): SovereignEngine {
    return new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
  }

  function executeAttack(
    testId: string,
    category: string,
    description: string,
    attackVector: string,
    isPositiveControl: boolean,
    testFn: () => {
      engine: SovereignEngine;
      proposal: StateTransitionProposal;
      candidateProposal?: StateTransitionProposal;
    }
  ) {
    const { engine, proposal, candidateProposal } = testFn();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();

    const callGraph = 'ImmigrationGate -> MutationBoundary -> Validator -> Draft -> Sovereign Commit';

    let detectedStage = 'NONE';
    let boundaryRejected = false;
    let boundaryReasons: string[] = [];

    // Stage 1: Mutation Boundary Check (if candidate proposal provided)
    if (candidateProposal) {
      const boundaryCheck = validateLLM2MutationBoundary(candidateProposal, proposal);
      if (!boundaryCheck.isValid) {
        boundaryRejected = true;
        boundaryReasons = boundaryCheck.violationReasons;
        detectedStage = 'MutationBoundary';
      }
    }

    // Stage 2: Sovereign Commit (which invokes EngineValidator and atomic commit gate)
    const commitResult = engine.submitProposal(proposal);

    if (!commitResult.success && detectedStage === 'NONE') {
      detectedStage = 'EngineValidator / SovereignCommitGate';
    } else if (commitResult.success) {
      detectedStage = 'SovereignCommitGate (COMMITTED)';
    }

    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();

    const isMutated = !deepEqual(snapBefore, snapAfter);
    const isHistoryPolluted = histAfter.length !== histBefore.length;
    const stateVersionDelta = snapAfter.stateVersion - snapBefore.stateVersion;
    const historyCountDelta = histAfter.length - histBefore.length;

    let verdict: 'DEFENDED' | 'EXPLOITED' | 'EXPECTED_COMMIT';
    let vulnerabilityDiscovered = false;
    let exploitDetails: string | undefined;

    if (isPositiveControl) {
      if (commitResult.success && isMutated && stateVersionDelta === 1) {
        verdict = 'EXPECTED_COMMIT';
      } else {
        verdict = 'EXPLOITED'; // Failed positive control
        exploitDetails = `Positive control rejected: ${commitResult.rejectedReasons?.join('; ')}`;
      }
    } else {
      // Hostile Attack
      if (commitResult.success) {
        verdict = 'EXPLOITED';
        vulnerabilityDiscovered = true;
        exploitDetails = `CRITICAL BREAK: Hostile proposal successfully committed to Canonical State! Version changed by +${stateVersionDelta}. Actions executed: ${JSON.stringify(proposal.actions)}`;
      } else if (isMutated || isHistoryPolluted || stateVersionDelta !== 0) {
        verdict = 'EXPLOITED';
        vulnerabilityDiscovered = true;
        exploitDetails = `CRITICAL BREAK: Proposal rejected but side effects leaked! StateMutated=${isMutated}, HistoryPolluted=${isHistoryPolluted}, VersionDelta=${stateVersionDelta}`;
      } else {
        verdict = 'DEFENDED';
      }
    }

    results.push({
      testId,
      category,
      description,
      attackVector,
      vulnerabilityDiscovered,
      verdict,
      pipelineStageDetected: detectedStage,
      stateMutated: isMutated,
      historyPolluted: isHistoryPolluted,
      stateVersionDelta,
      historyCountDelta,
      rejectedReasons: commitResult.rejectedReasons || (boundaryReasons.length > 0 ? boundaryReasons : undefined),
      conflictDetails: commitResult.conflictDetails,
      exploitDetails,
      callGraphAudit: callGraph
    });
  }

  // =========================================================================
  // ATTACK 1: Genuine Claim Transference across Entities
  // =========================================================================
  executeAttack(
    'RED-01-CLAIM-TRANSFER-CROSS-ENTITY',
    'Claim Hijacking & Transference',
    'Transfers genuine claim on Shaolin Faction to mutate Wudang Faction',
    'admit(Shaolin influence=40) -> Action(Wudang influence=40)',
    false,
    () => {
      const engine = createStandardEngine();
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-shaolin-40',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '소림사의 영향력이 40으로 상승했다.',
        turn: 1,
        entityId: 'faction-shaolin',
        attribute: 'influence',
        value: 40
      };
      const admit = ImmigrationGate.admit(
        { targetEntityId: 'faction-shaolin', targetAttribute: 'influence', claimedValue: 40, claimedEvidenceIds: ['ev-shaolin-40'] },
        [ev],
        snap
      );
      return {
        engine,
        proposal: {
          proposalId: 'prop-red-01',
          requestId: 'req-red-01',
          eventId: 'ev-red-01',
          expectedStateVersion: 1,
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Entity mismatch claim transfer',
          verifiedClaims: [admit.verifiedClaim!],
          actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 40 } } }]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 2: Genuine Claim Transference across Attributes
  // =========================================================================
  executeAttack(
    'RED-02-CLAIM-TRANSFER-CROSS-ATTRIBUTE',
    'Claim Hijacking & Transference',
    'Transfers genuine claim on NPC impression to mutate NPC affinity',
    'admit(impression="Revered") -> Action(affinity=90)',
    false,
    () => {
      const engine = createStandardEngine();
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-impr-rev',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '현공 방장의 인상이 존경스러워졌다.',
        turn: 1,
        entityId: 'npc-hyeon-gong',
        attribute: 'impression',
        value: 'Revered'
      };
      const admit = ImmigrationGate.admit(
        { targetEntityId: 'npc-hyeon-gong', targetAttribute: 'impression', claimedValue: 'Revered', claimedEvidenceIds: ['ev-impr-rev'] },
        [ev],
        snap
      );
      return {
        engine,
        proposal: {
          proposalId: 'prop-red-02',
          requestId: 'req-red-02',
          eventId: 'ev-red-02',
          expectedStateVersion: 1,
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Attribute mismatch claim transfer',
          verifiedClaims: [admit.verifiedClaim!],
          actions: [{ type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { affinity: 90 } } }]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 3: Claim Value Inflation & Value Spoofing
  // =========================================================================
  executeAttack(
    'RED-03-CLAIM-VALUE-INFLATION',
    'Claim Hijacking & Transference',
    'Uses genuine claim for affinity 65 to request affinity 99',
    'admit(affinity=65) -> Action(affinity=99)',
    false,
    () => {
      const engine = createStandardEngine();
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-aff-65',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '현공 방장의 호감도가 65가 되었다.',
        turn: 1,
        entityId: 'npc-hyeon-gong',
        attribute: 'affinity',
        value: 65
      };
      const admit = ImmigrationGate.admit(
        { targetEntityId: 'npc-hyeon-gong', targetAttribute: 'affinity', claimedValue: 65, claimedEvidenceIds: ['ev-aff-65'] },
        [ev],
        snap
      );
      return {
        engine,
        proposal: {
          proposalId: 'prop-red-03',
          requestId: 'req-red-03',
          eventId: 'ev-red-03',
          expectedStateVersion: 1,
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Value mismatch claim transfer',
          verifiedClaims: [admit.verifiedClaim!],
          actions: [{ type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { affinity: 99 } } }]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 4: Piggybacking Multi-Field in UPDATE_NPC
  // =========================================================================
  executeAttack(
    'RED-04-PIGGYBACK-MULTI-FIELD-UPDATE-NPC',
    'Multi-Action & Piggyback Attacks',
    'UPDATE_NPC combines verified impression with unverified personality and trust',
    'UPDATE_NPC.changes = { impression: "V", personality: "Hostile", trust: 10 }',
    false,
    () => {
      const engine = createStandardEngine();
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-impr-4',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '현공 방장이 인자한 표정을 지었다.',
        turn: 1,
        entityId: 'npc-hyeon-gong',
        attribute: 'impression',
        value: 'Benevolent'
      };
      const admit = ImmigrationGate.admit(
        { targetEntityId: 'npc-hyeon-gong', targetAttribute: 'impression', claimedValue: 'Benevolent', claimedEvidenceIds: ['ev-impr-4'] },
        [ev],
        snap
      );
      return {
        engine,
        proposal: {
          proposalId: 'prop-red-04',
          requestId: 'req-red-04',
          eventId: 'ev-red-04',
          expectedStateVersion: 1,
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Piggyback personality and trust into UPDATE_NPC',
          verifiedClaims: [admit.verifiedClaim!],
          actions: [
            {
              type: 'UPDATE_NPC',
              payload: {
                id: 'npc-hyeon-gong',
                changes: {
                  impression: 'Benevolent',
                  personality: 'Hostile',
                  trust: 10
                }
              }
            }
          ]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 5: Multi-Action Compound Proposal Isolation
  // =========================================================================
  executeAttack(
    'RED-05-MULTI-ACTION-PROPOSAL-ISOLATION',
    'Multi-Action & Piggyback Attacks',
    'Proposal contains 1 valid action and 1 unverified fatal action (SET_NPC_STATUS DEAD)',
    'Action 1 = Valid, Action 2 = SET_NPC_STATUS(DEAD without claim)',
    false,
    () => {
      const engine = createStandardEngine();
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-fac-5',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '화산파의 영향력이 25로 상승했다.',
        turn: 1,
        entityId: 'faction-mount-hua',
        attribute: 'influence',
        value: 25
      };
      const admit = ImmigrationGate.admit(
        { targetEntityId: 'faction-mount-hua', targetAttribute: 'influence', claimedValue: 25, claimedEvidenceIds: ['ev-fac-5'] },
        [ev],
        snap
      );
      return {
        engine,
        proposal: {
          proposalId: 'prop-red-05',
          requestId: 'req-red-05',
          eventId: 'ev-red-05',
          expectedStateVersion: 1,
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Multi-action compound proposal with 1 invalid action',
          verifiedClaims: [admit.verifiedClaim!],
          actions: [
            { type: 'UPDATE_FACTION', payload: { id: 'faction-mount-hua', changes: { influence: 25 } } },
            { type: 'SET_NPC_STATUS', payload: { id: 'npc-cheong-heo', status: 'DEAD' } }
          ]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 6: Cross-Turn Stale Claim Replay Vulnerability Audit
  // =========================================================================
  executeAttack(
    'RED-06-CROSS-TURN-STALE-CLAIM-REPLAY',
    'Temporal & Replay Attacks',
    'Reuses Turn 1 VerifiedClaim in Turn 2 after intermediate state change to revert world',
    'Turn 1 Claim(Wudang=35) -> Turn 2 state changes Wudang to 15 -> Attacker replays Turn 1 Claim in Turn 3 to force Wudang=35',
    false,
    () => {
      const engine = createStandardEngine();
      const snap1 = engine.getSnapshot();

      // Step 1: Legitimate Turn 1 commit
      const ev1: ExternalEvidence = {
        evidenceId: 'ev-legit-t1',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '무당파의 영향력이 35로 상승했다.',
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 35
      };
      const admit1 = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-legit-t1'] },
        [ev1],
        snap1
      );
      const prop1: StateTransitionProposal = {
        proposalId: 'prop-t1-legit',
        requestId: 'req-t1-legit',
        eventId: 'ev-t1-legit',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Legitimate turn 1 action',
        verifiedClaims: [admit1.verifiedClaim!],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 35 } } }]
      };
      engine.submitProposal(prop1);

      // Step 2: Turn 2 Event lowers Wudang influence to 15
      const ev2: ExternalEvidence = {
        evidenceId: 'ev-legit-t2',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '무당파가 습격을 받아 영향력이 15로 급락했다.',
        turn: 2,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 15
      };
      const admit2 = ImmigrationGate.admit(
        { targetEntityId: 'faction-wudang', targetAttribute: 'influence', claimedValue: 15, claimedEvidenceIds: ['ev-legit-t2'] },
        [ev2],
        engine.getSnapshot()
      );
      engine.submitProposal({
        proposalId: 'prop-t2-legit',
        requestId: 'req-t2-legit',
        eventId: 'ev-t2-legit',
        expectedStateVersion: 2,
        source: 'LLM',
        turn: 2,
        timestamp: new Date().toISOString(),
        intentSummary: 'Wudang influence drops to 15',
        verifiedClaims: [admit2.verifiedClaim!],
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 15 } } }]
      });

      // Step 3: Turn 3 Attacker replays OLD Turn 1 claim (admit1.verifiedClaim) to revert Wudang influence to 35 without Turn 3 evidence
      return {
        engine,
        proposal: {
          proposalId: 'prop-red-06-replay',
          requestId: 'req-red-06-replay',
          eventId: 'ev-red-06-replay',
          expectedStateVersion: 3,
          source: 'LLM',
          turn: 3,
          timestamp: new Date().toISOString(),
          intentSummary: 'Replay stale Turn 1 claim in Turn 3 without Turn 3 evidence',
          verifiedClaims: [admit1.verifiedClaim!],
          actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 35 } } }]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 7: Idempotent Request ID Replay
  // =========================================================================
  executeAttack(
    'RED-07-IDEMPOTENT-REQUEST-ID-REPLAY',
    'Temporal & Replay Attacks',
    'Replays exact same proposal requestId to attempt duplicate action execution',
    'Submit proposal with requestId="req-fixed-id-100"',
    false,
    () => {
      const engine = createStandardEngine();
      engine.submitProposal({
        proposalId: 'prop-first-exec',
        requestId: 'req-fixed-id-100',
        eventId: 'ev-fixed-id-100',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'First execution',
        actions: [{ type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-unique-1', content: '신비한 검보 발견', status: 'active' } }]
      });

      return {
        engine,
        proposal: {
          proposalId: 'prop-second-exec',
          requestId: 'req-fixed-id-100', // DUPLICATE REQUEST ID
          eventId: 'ev-different-200',
          expectedStateVersion: engine.getSnapshot().stateVersion,
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Duplicate request ID replay attack',
          actions: [{ type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-unique-2', content: '또 다른 검보', status: 'active' } }]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 8: Stale State Version / TOCTOU Race
  // =========================================================================
  executeAttack(
    'RED-08-STALE-STATE-VERSION-TOCTOU',
    'Temporal & Replay Attacks',
    'Submits proposal with stale expectedStateVersion=1 when state is at version 2',
    'expectedStateVersion=1 vs current stateVersion=2',
    false,
    () => {
      const engine = createStandardEngine();
      engine.submitProposal({
        proposalId: 'prop-v1-to-v2',
        requestId: 'req-v1-to-v2',
        eventId: 'ev-v1-to-v2',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'State progression',
        actions: [{ type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-test', content: 'test', status: 'active' } }]
      });

      return {
        engine,
        proposal: {
          proposalId: 'prop-red-08-toctou',
          requestId: 'req-red-08-toctou',
          eventId: 'ev-red-08-toctou',
          expectedStateVersion: 1, // STALE VERSION
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'TOCTOU race submission with stale version',
          actions: [{ type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-toctou', content: 'toctou', status: 'active' } }]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 9: Object Freeze & In-Place Tampering
  // =========================================================================
  executeAttack(
    'RED-09-OBJECT-FREEZE-BREACH-ATTEMPT',
    'Memory & Reference Tampering',
    'Attempts in-place property modification of genuine frozen claim',
    'claim.targetEntityId = "npc-cheong-heo" after issuance',
    false,
    () => {
      const engine = createStandardEngine();
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-freeze-test',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '현공 방장의 인상이 온화해졌다.',
        turn: 1,
        entityId: 'npc-hyeon-gong',
        attribute: 'impression',
        value: 'Gentle'
      };
      const admit = ImmigrationGate.admit(
        { targetEntityId: 'npc-hyeon-gong', targetAttribute: 'impression', claimedValue: 'Gentle', claimedEvidenceIds: ['ev-freeze-test'] },
        [ev],
        snap
      );
      const genuineClaim = admit.verifiedClaim!;

      try {
        (genuineClaim as any).targetEntityId = 'npc-cheong-heo';
        (genuineClaim as any).verifiedValue = 'DEAD';
      } catch (e) {}

      return {
        engine,
        proposal: {
          proposalId: 'prop-red-09',
          requestId: 'req-red-09',
          eventId: 'ev-red-09',
          expectedStateVersion: 1,
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Tampered claim submission',
          verifiedClaims: [genuineClaim],
          actions: [{ type: 'SET_NPC_STATUS', payload: { id: 'npc-cheong-heo', status: 'DEAD' } }]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 10: Array Injection of Unauthorized Forged Claim
  // =========================================================================
  executeAttack(
    'RED-10-ARRAY-INJECTION-FORGED-CLAIM',
    'Memory & Reference Tampering',
    'Array splicing: 1 genuine claim + 1 forged claim in verifiedClaims array',
    'verifiedClaims = [genuineClaim, forgedClaim]',
    false,
    () => {
      const engine = createStandardEngine();
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-arr-10',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '현공 방장의 인상이 맑아졌다.',
        turn: 1,
        entityId: 'npc-hyeon-gong',
        attribute: 'impression',
        value: 'Pure'
      };
      const admit = ImmigrationGate.admit(
        { targetEntityId: 'npc-hyeon-gong', targetAttribute: 'impression', claimedValue: 'Pure', claimedEvidenceIds: ['ev-arr-10'] },
        [ev],
        snap
      );

      const forgedClaim: any = {
        claimId: 'vclm-1-fake-injected',
        status: 'VERIFIED',
        targetEntityId: 'npc-cheong-heo',
        targetAttribute: 'status',
        verifiedValue: 'DEAD',
        evidenceIds: ['ev-arr-10'],
        verifiedAtTurn: 1,
        provenance: { source: 'ATTACKER', evidenceCount: 1 }
      };

      return {
        engine,
        proposal: {
          proposalId: 'prop-red-10',
          requestId: 'req-red-10',
          eventId: 'ev-red-10',
          expectedStateVersion: 1,
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Injected forged claim in array',
          verifiedClaims: [admit.verifiedClaim!, forgedClaim],
          actions: [
            { type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { impression: 'Pure' } } },
            { type: 'SET_NPC_STATUS', payload: { id: 'npc-cheong-heo', status: 'DEAD' } }
          ]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 11: Dead NPC Revival Prohibition
  // =========================================================================
  executeAttack(
    'RED-11-DEAD-NPC-REVIVAL-PROHIBITION',
    'Invariant Protections',
    'Attempts to mutate DEAD NPC (npc-dead-elder) status back to ALIVE',
    'SET_NPC_STATUS(npc-dead-elder, ALIVE)',
    false,
    () => {
      const engine = createStandardEngine();
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-revive-11',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '망자 장로가 기적적으로 소생했다.',
        turn: 1,
        entityId: 'npc-dead-elder',
        attribute: 'status',
        value: 'ALIVE'
      };
      const admit = ImmigrationGate.admit(
        { targetEntityId: 'npc-dead-elder', targetAttribute: 'status', claimedValue: 'ALIVE', claimedEvidenceIds: ['ev-revive-11'] },
        [ev],
        snap
      );
      return {
        engine,
        proposal: {
          proposalId: 'prop-red-11',
          requestId: 'req-red-11',
          eventId: 'ev-red-11',
          expectedStateVersion: 1,
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Attempt to revive deceased NPC',
          verifiedClaims: [admit.verifiedClaim!],
          actions: [{ type: 'SET_NPC_STATUS', payload: { id: 'npc-dead-elder', status: 'ALIVE' } }]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 12: Faction Influence Cap Overflow
  // =========================================================================
  executeAttack(
    'RED-12-FACTION-INFLUENCE-CAP-OVERFLOW',
    'Invariant Protections',
    'ADD_FACTION causes total cumulative influence to exceed 100',
    'Existing influence = 30+25+20 = 75. New faction influence = 35 (Total = 110 > 100)',
    false,
    () => {
      const engine = createStandardEngine();
      return {
        engine,
        proposal: {
          proposalId: 'prop-red-12',
          requestId: 'req-red-12',
          eventId: 'ev-red-12',
          expectedStateVersion: 1,
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Overflow total faction influence cap',
          actions: [
            {
              type: 'ADD_FACTION',
              payload: {
                id: 'faction-kunlun',
                name: '곤륜파',
                influence: 35,
                description: '서역 곤륜산의 문파'
              }
            }
          ]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 13: Mutation Boundary Inventory Inflation
  // =========================================================================
  executeAttack(
    'RED-13-MUTATION-BOUNDARY-INVENTORY-INFLATION',
    'Mutation Boundary Enforcement',
    'Approved candidate item qty=1, final action requests item qty=5',
    'Candidate: qty=1 -> Final: qty=5',
    false,
    () => {
      const engine = createStandardEngine();
      const candidate: StateTransitionProposal = {
        proposalId: 'prop-cand-13',
        requestId: 'req-cand-13',
        eventId: 'ev-cand-13',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Candidate approval',
        actions: [
          {
            type: 'MODIFY_INVENTORY',
            payload: {
              operation: 'REMOVE',
              item: { id: 'item-herb', name: '상처약', quantity: 1 }
            }
          }
        ]
      };
      const finalProp: StateTransitionProposal = {
        proposalId: 'prop-final-13',
        requestId: 'req-final-13',
        eventId: 'ev-final-13',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Final action inflating remove quantity',
        actions: [
          {
            type: 'MODIFY_INVENTORY',
            payload: {
              operation: 'REMOVE',
              item: { id: 'item-herb', name: '상처약', quantity: 5 }
            }
          }
        ]
      };
      return {
        engine,
        candidateProposal: candidate,
        proposal: finalProp
      };
    }
  );

  // =========================================================================
  // ATTACK 14: Source Escalation to SYSTEM without Capability
  // =========================================================================
  executeAttack(
    'RED-14-SOURCE-ESCALATION-SYSTEM-SPOOF',
    'Authority & Source Escalation',
    'LLM attempts to claim source="SYSTEM" without engine internal capability',
    'source="SYSTEM" with arbitrary actions',
    false,
    () => {
      const engine = createStandardEngine();
      return {
        engine,
        proposal: {
          proposalId: 'prop-red-14',
          requestId: 'req-red-14',
          eventId: 'ev-red-14',
          expectedStateVersion: 1,
          source: 'SYSTEM' as any,
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Source escalation to SYSTEM',
          actions: [{ type: 'OVERWRITE_CHARACTER', payload: createEmptyCharacter() }]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 15: Source Escalation to GENESIS after Turn 1
  // =========================================================================
  executeAttack(
    'RED-15-SOURCE-ESCALATION-GENESIS-POST-TURN-1',
    'Authority & Source Escalation',
    'LLM attempts to claim source="GENESIS" when stateVersion > 1',
    'source="GENESIS" at stateVersion=2',
    false,
    () => {
      const engine = createStandardEngine();
      // Advance to version 2
      engine.submitProposal({
        proposalId: 'prop-v1-to-v2',
        requestId: 'req-v1-to-v2',
        eventId: 'ev-v1-to-v2',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Advance',
        actions: [{ type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-adv', content: 'adv', status: 'active' } }]
      });

      return {
        engine,
        proposal: {
          proposalId: 'prop-red-15',
          requestId: 'req-red-15',
          eventId: 'ev-red-15',
          expectedStateVersion: 2,
          source: 'GENESIS' as any,
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Source escalation to GENESIS after genesis',
          actions: [{ type: 'OVERWRITE_WORLD_INFO', payload: createEmptyWorldInfo() }]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 16: JSON Deserialized Clone of VerifiedClaim
  // =========================================================================
  executeAttack(
    'RED-16-JSON-DESERIALIZED-CLAIM-CLONE',
    'Memory & Reference Tampering',
    'Submits JSON.parse(JSON.stringify(genuineClaim))',
    'JSON clone stripped of WeakSet identity',
    false,
    () => {
      const engine = createStandardEngine();
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-json-16',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '소림사의 영향력이 35로 상승했다.',
        turn: 1,
        entityId: 'faction-shaolin',
        attribute: 'influence',
        value: 35
      };
      const admit = ImmigrationGate.admit(
        { targetEntityId: 'faction-shaolin', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-json-16'] },
        [ev],
        snap
      );
      const clonedClaim = JSON.parse(JSON.stringify(admit.verifiedClaim));

      return {
        engine,
        proposal: {
          proposalId: 'prop-red-16',
          requestId: 'req-red-16',
          eventId: 'ev-red-16',
          expectedStateVersion: 1,
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'JSON deserialized claim submission',
          verifiedClaims: [clonedClaim],
          actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 35 } } }]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 17: Prototype Inheritance of VerifiedClaim
  // =========================================================================
  executeAttack(
    'RED-17-PROTOTYPE-INHERITANCE-CLAIM',
    'Memory & Reference Tampering',
    'Submits Object.create(genuineClaim)',
    'Prototype inheritance object attempting WeakSet authority',
    false,
    () => {
      const engine = createStandardEngine();
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-proto-17',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '소림사의 영향력이 35로 상승했다.',
        turn: 1,
        entityId: 'faction-shaolin',
        attribute: 'influence',
        value: 35
      };
      const admit = ImmigrationGate.admit(
        { targetEntityId: 'faction-shaolin', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-proto-17'] },
        [ev],
        snap
      );
      const protoClaim = Object.create(admit.verifiedClaim!);

      return {
        engine,
        proposal: {
          proposalId: 'prop-red-17',
          requestId: 'req-red-17',
          eventId: 'ev-red-17',
          expectedStateVersion: 1,
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Prototype inheritance claim submission',
          verifiedClaims: [protoClaim],
          actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 35 } } }]
        }
      };
    }
  );

  // =========================================================================
  // ATTACK 18: Unverified Inventory SET_QUANTITY Operation
  // =========================================================================
  executeAttack(
    'RED-18-INVENTORY-SET-QUANTITY-UNTRUSTED-SOURCE',
    'Authority & Source Escalation',
    'LLM attempts MODIFY_INVENTORY with SET_QUANTITY operation to spawn items',
    'MODIFY_INVENTORY SET_QUANTITY iron-sword=999 from LLM source',
    false,
    () => {
      const engine = createStandardEngine();
      return {
        engine,
        proposal: {
          proposalId: 'prop-red-18',
          requestId: 'req-red-18',
          eventId: 'ev-red-18',
          expectedStateVersion: 1,
          source: 'LLM',
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Arbitrary item spawning via SET_QUANTITY',
          actions: [
            {
              type: 'MODIFY_INVENTORY',
              payload: {
                operation: 'SET_QUANTITY',
                item: { id: 'item-iron-sword', name: '철검', quantity: 999 }
              }
            }
          ]
        }
      };
    }
  );

  // =========================================================================
  // POSITIVE CONTROLS
  // =========================================================================
  executeAttack(
    'POS-01-LEGITIMATE-CLAIM-COMMIT',
    'Positive Controls',
    'Legitimate Admission of Shaolin influence change through full pipeline',
    'Genuine Evidence -> Admit -> Proposal with Claim -> Sovereign Commit',
    true,
    () => {
      const engine = createStandardEngine();
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-pos-01',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '소림사의 영향력이 35로 정당하게 상승했다.',
        turn: 1,
        entityId: 'faction-shaolin',
        attribute: 'influence',
        value: 35
      };
      const admit = ImmigrationGate.admit(
        { targetEntityId: 'faction-shaolin', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-pos-01'] },
        [ev],
        snap
      );
      const node: MeaningNode = {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'UPDATE_FACTION',
        fields: {
          actionType: 'UPDATE_FACTION',
          payload: { id: 'faction-shaolin', changes: { influence: 35 } }
        }
      };

      const proposal = adaptMeaningTreeToProposal(node, {
        proposalId: 'prop-pos-01',
        requestId: 'req-pos-01',
        eventId: 'ev-pos-01',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Legitimate faction update'
      });
      proposal.verifiedClaims = [admit.verifiedClaim!];

      return {
        engine,
        proposal
      };
    }
  );

  executeAttack(
    'POS-02-CREATIVE-FREEDOM-CREATION',
    'Positive Controls',
    'LLM introduces new NPC and Narrative Seed under Rule Authority',
    'ADD_NPC + ADD_NARRATIVE_SEED with valid schema and unique IDs',
    true,
    () => {
      const engine = createStandardEngine();
      const rootTree: MeaningNode = {
        atom: 'INTENT',
        scope: 'PROPOSAL',
        children: [
          {
            atom: 'ACTION',
            scope: 'PROPOSAL',
            value: 'ADD_NPC',
            fields: {
              actionType: 'ADD_NPC',
              payload: {
                id: 'npc-nam-gung',
                name: '남궁세가 가주',
                status: 'ALIVE',
                impression: 'Proud',
                role: 'Patriarch',
                affiliation: '남궁세가',
                personality: 'Stern'
              }
            }
          },
          {
            atom: 'ACTION',
            scope: 'PROPOSAL',
            value: 'ADD_NARRATIVE_SEED',
            fields: {
              actionType: 'ADD_NARRATIVE_SEED',
              payload: {
                id: 'seed-nam-gung-crisis',
                content: '남궁세가에 정체불명의 자객이 침입했다.',
                status: 'active'
              }
            }
          }
        ]
      };

      const proposal = adaptMeaningTreeToProposal(rootTree, {
        proposalId: 'prop-pos-02',
        requestId: 'req-pos-02',
        eventId: 'ev-pos-02',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Introduce new world elements under creative freedom'
      });

      return {
        engine,
        proposal
      };
    }
  );

  executeAttack(
    'POS-03-INVENTORY-CONSUMPTION',
    'Positive Controls',
    'Player/LLM consumes 1 owned herb from inventory',
    'MODIFY_INVENTORY REMOVE item-herb qty=1 (Owned=3 -> Remaining=2)',
    true,
    () => {
      const engine = createStandardEngine();
      const node: MeaningNode = {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'MODIFY_INVENTORY',
        fields: {
          actionType: 'MODIFY_INVENTORY',
          payload: {
            operation: 'REMOVE',
            item: { id: 'item-herb', name: '상처약', quantity: 1 }
          }
        }
      };

      const proposal = adaptMeaningTreeToProposal(node, {
        proposalId: 'prop-pos-03',
        requestId: 'req-pos-03',
        eventId: 'ev-pos-03',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Consume healing herb'
      });

      return {
        engine,
        proposal
      };
    }
  );

  return {
    total: results.length,
    defended: results.filter(r => r.verdict === 'DEFENDED').length,
    exploited: results.filter(r => r.verdict === 'EXPLOITED').length,
    expectedCommit: results.filter(r => r.verdict === 'EXPECTED_COMMIT').length,
    results
  };
}

// Auto-run if executed directly
if (typeof process !== 'undefined' && process.argv[1]?.includes('finalExtinctionRedTeam')) {
  console.log('====================================================');
  console.log('VEIL FINAL EXTINCTION RED TEAM RUNTIME FORENSICS');
  console.log('====================================================');
  const suite = runFullExtinctionRedTeamSuite();
  for (const r of suite.results) {
    let symbol = '🛡️ [DEFENDED]';
    if (r.verdict === 'EXPLOITED') symbol = '💥 [EXPLOITED / VULNERABILITY DISCOVERED]';
    if (r.verdict === 'EXPECTED_COMMIT') symbol = '✅ [EXPECTED COMMIT]';
    console.log(`${symbol} ${r.testId}: ${r.description}`);
    if (r.exploitDetails) {
      console.log(`   Exploit Details: ${r.exploitDetails}`);
    }
  }
  console.log('====================================================');
  console.log(`Summary: Total ${suite.total} | Defended: ${suite.defended} | Exploited: ${suite.exploited} | Positive Controls: ${suite.expectedCommit}`);
  console.log('====================================================');

  // Save raw evidence
  const reportDir = path.join(process.cwd(), 'report', '12_veil_final_extinction_redteam');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(path.join(reportDir, 'raw_evidence.json'), JSON.stringify(suite, null, 2), 'utf-8');
}
