import { SovereignEngine } from './state';
import { ImmigrationGate } from './immigrationGate';
import { EngineValidator } from './validator';
import { StateTransitionProposal, TransitionAction, ExternalEvidence, UntrustedClaim, VerifiedClaim } from './types';
import { createEmptyWorldInfo, createEmptyCharacter } from '../utils/factory';
import { NpcRecord, FactionRecord, Character } from '../types';
import { MeaningNode } from './language/types';
import { adaptMeaningTreeToProposal } from './language/adapter';

export interface KillTestResult {
  testId: string;
  category: string;
  description: string;
  attackVector: string;
  passed: boolean;
  verdictExpected: 'REJECT' | 'COMMIT';
  verdictActual: 'REJECT' | 'COMMIT';
  stateBeforeVsAfterMutated: boolean;
  historyBeforeVsAfterPolluted: boolean;
  zeroMutationGuaranteed: boolean;
  error?: string;
  details: {
    callPath: string;
    validatorOutput: any;
    commitOutput: any;
    stateVersionBefore: number;
    stateVersionAfter: number;
    historyCountBefore: number;
    historyCountAfter: number;
  };
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

export function runFinalAuthorityKillTestSuite(): {
  total: number;
  passed: number;
  failed: number;
  results: KillTestResult[];
} {
  const results: KillTestResult[] = [];

  function executeAttack(
    testId: string,
    category: string,
    description: string,
    attackVector: string,
    engineSetup: () => SovereignEngine,
    proposalBuilder: (engine: SovereignEngine) => StateTransitionProposal,
    expectedOutcome: 'REJECT' | 'COMMIT' = 'REJECT'
  ) {
    const engine = engineSetup();
    const snapBefore = engine.getSnapshot();
    const historyBefore = engine.getHistory();
    const historyCountBefore = historyBefore.length;
    const stateVersionBefore = snapBefore.stateVersion;

    const proposal = proposalBuilder(engine);

    const callPath = 'LLM -> MutationBoundary -> Validator -> Draft/ActionApplier -> Sovereign Commit';
    
    // Direct validator call
    const validatorVerdict = EngineValidator.validate(
      proposal,
      snapBefore,
      new Set(),
      new Set(),
      historyBefore
    );

    // Sovereign commit call
    const commitResult = engine.submitProposal(proposal);

    const snapAfter = engine.getSnapshot();
    const historyAfter = engine.getHistory();
    const historyCountAfter = historyAfter.length;
    const stateVersionAfter = snapAfter.stateVersion;

    const isStateMutated = !deepEqual(snapBefore, snapAfter);
    const isHistoryPolluted = historyCountAfter !== historyCountBefore;

    let testPassed = false;
    let actualOutcome: 'REJECT' | 'COMMIT' = commitResult.success ? 'COMMIT' : 'REJECT';

    if (expectedOutcome === 'REJECT') {
      // Must reject, 0 mutation, 0 pollution
      testPassed = !commitResult.success && !isStateMutated && !isHistoryPolluted;
    } else {
      // Must commit, state version increments, history increments
      testPassed = commitResult.success && isStateMutated && isHistoryPolluted;
    }

    results.push({
      testId,
      category,
      description,
      attackVector,
      passed: testPassed,
      verdictExpected: expectedOutcome,
      verdictActual: actualOutcome,
      stateBeforeVsAfterMutated: isStateMutated,
      historyBeforeVsAfterPolluted: isHistoryPolluted,
      zeroMutationGuaranteed: !isStateMutated && !isHistoryPolluted,
      error: !testPassed ? `Expected ${expectedOutcome} but got ${actualOutcome}. Mutated=${isStateMutated}, Polluted=${isHistoryPolluted}. Reasons: ${commitResult.rejectedReasons?.join(', ')}` : undefined,
      details: {
        callPath,
        validatorOutput: { isValid: validatorVerdict.isValid, rejectedReasons: validatorVerdict.rejectedReasons },
        commitOutput: { success: commitResult.success, rejectedReasons: commitResult.rejectedReasons },
        stateVersionBefore,
        stateVersionAfter,
        historyCountBefore,
        historyCountAfter
      }
    });
  }

  // Common Setup Helper
  function createStandardTestEngine(): SovereignEngine {
    const world = createEmptyWorldInfo();
    world.factions = [
      { id: 'faction-shaolin', name: '소림사', influence: 30, description: '정파의 태두', hostility: 0 },
      { id: 'faction-wudang', name: '무당파', influence: 25, description: '도교 문파', hostility: 0 }
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
      }
    ];
    const character = createEmptyCharacter();
    character.name = '청운';
    character.stats = { strength: 12, agility: 14, constitution: 13, intelligence: 15, wisdom: 11, charisma: 10 };
    character.inventory = [
      { id: 'item-herb', name: '상처약', quantity: 3, description: '회복용 약초' }
    ];
    return new SovereignEngine(world, character, [], 1, 1);
  }

  // =========================================================================
  // CATEGORY 1: Forged / Clone / Deserialization VerifiedClaim Attacks
  // =========================================================================

  // 1.1 Structural Forge
  executeAttack(
    'KILL-01-STRUCTURAL-FORGE',
    'CATEGORY 1: Forgery & Object Authority',
    'Structural forge: Object with identical fields but without WeakSet registration',
    '{ claimId: "vclm-1-fake", status: "VERIFIED", targetEntityId: "npc-hyeon-gong", targetAttribute: "status", verifiedValue: "DEAD" }',
    createStandardTestEngine,
    (engine) => {
      const forgedClaim: any = {
        claimId: 'vclm-1-fake',
        status: 'VERIFIED',
        targetEntityId: 'npc-hyeon-gong',
        targetAttribute: 'status',
        verifiedValue: 'DEAD',
        evidenceIds: ['ev-fake'],
        verifiedAtTurn: 1,
        verifiedAtTimestamp: new Date().toISOString(),
        provenance: { source: 'ATTACKER', evidenceCount: 1 }
      };
      return {
        proposalId: 'prop-kill-01',
        requestId: 'req-kill-01',
        eventId: 'ev-kill-01',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Structural forge claim status change',
        verifiedClaims: [forgedClaim],
        actions: [
          {
            type: 'SET_NPC_STATUS',
            payload: { id: 'npc-hyeon-gong', status: 'DEAD' }
          }
        ]
      };
    }
  );

  // 1.2 JSON Deserialization Clone
  executeAttack(
    'KILL-02-JSON-DESERIALIZE-CLONE',
    'CATEGORY 1: Forgery & Object Authority',
    'JSON.parse(JSON.stringify(genuineClaim)) loses WeakSet authority',
    'JSON clone of genuine gate-issued claim',
    createStandardTestEngine,
    (engine) => {
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-genuine-1',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '현공 방장이 피를 토하고 쓰러져 사망했다.',
        turn: 1,
        entityId: 'npc-hyeon-gong',
        attribute: 'status',
        value: 'DEAD'
      };
      const untrusted: UntrustedClaim = {
        targetEntityId: 'npc-hyeon-gong',
        targetAttribute: 'status',
        claimedValue: 'DEAD',
        claimedEvidenceIds: ['ev-genuine-1'],
        rawText: '현공 방장 사망'
      };
      const admitRes = ImmigrationGate.admit(untrusted, [ev], snap);
      const genuineClaim = admitRes.verifiedClaim!;

      // Clone via JSON (new object identity in memory)
      const deserializedClone = JSON.parse(JSON.stringify(genuineClaim));

      return {
        proposalId: 'prop-kill-02',
        requestId: 'req-kill-02',
        eventId: 'ev-kill-02',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'JSON deserialized claim',
        verifiedClaims: [deserializedClone],
        actions: [
          {
            type: 'SET_NPC_STATUS',
            payload: { id: 'npc-hyeon-gong', status: 'DEAD' }
          }
        ]
      };
    }
  );

  // 1.3 Object.assign Shallow Copy
  executeAttack(
    'KILL-03-OBJECT-ASSIGN-CLONE',
    'CATEGORY 1: Forgery & Object Authority',
    'Object.assign({}, genuineClaim) loses WeakSet authority',
    'Object.assign shallow clone',
    createStandardTestEngine,
    (engine) => {
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-genuine-2',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '소림사의 세력 영향력이 50으로 상승했다.',
        turn: 1,
        entityId: 'faction-shaolin',
        attribute: 'influence',
        value: 50
      };
      const admitRes = ImmigrationGate.admit(
        {
          targetEntityId: 'faction-shaolin',
          targetAttribute: 'influence',
          claimedValue: 50,
          claimedEvidenceIds: ['ev-genuine-2'],
          rawText: '소림사 세력 50'
        },
        [ev],
        snap
      );
      const shallowCopy = Object.assign({}, admitRes.verifiedClaim);

      return {
        proposalId: 'prop-kill-03',
        requestId: 'req-kill-03',
        eventId: 'ev-kill-03',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Object.assign clone',
        verifiedClaims: [shallowCopy],
        actions: [
          {
            type: 'UPDATE_FACTION',
            payload: { id: 'faction-shaolin', changes: { influence: 50 } }
          }
        ]
      };
    }
  );

  // 1.4 Prototype Inheritance Attack (Object.create)
  executeAttack(
    'KILL-04-PROTOTYPE-INHERITANCE',
    'CATEGORY 1: Forgery & Object Authority',
    'Object.create(genuineClaim) inherits properties but is a distinct object reference',
    'Object.create prototype inheritance',
    createStandardTestEngine,
    (engine) => {
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-genuine-3',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '청허 도장의 호감도가 80으로 상승했다.',
        turn: 1,
        entityId: 'npc-cheong-heo',
        attribute: 'affinity',
        value: 80
      };
      const admitRes = ImmigrationGate.admit(
        {
          targetEntityId: 'npc-cheong-heo',
          targetAttribute: 'affinity',
          claimedValue: 80,
          claimedEvidenceIds: ['ev-genuine-3'],
          rawText: '청허 도장 호감도 80'
        },
        [ev],
        snap
      );
      const protoObj = Object.create(admitRes.verifiedClaim!);

      return {
        proposalId: 'prop-kill-04',
        requestId: 'req-kill-04',
        eventId: 'ev-kill-04',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Prototype object injection',
        verifiedClaims: [protoObj],
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: { id: 'npc-cheong-heo', changes: { affinity: 80 } }
          }
        ]
      };
    }
  );

  // =========================================================================
  // CATEGORY 2: Genuine but Unrelated Claim / Value Spoofing
  // =========================================================================

  // 2.1 Entity Mismatch (Claim on NPC A, Action on NPC B)
  executeAttack(
    'KILL-05-ENTITY-MISMATCH',
    'CATEGORY 2: Genuine Claim / Target Discrepancy',
    'Genuine Claim on npc-hyeon-gong applied to npc-cheong-heo',
    'Claim.entityId != Action.entityId',
    createStandardTestEngine,
    (engine) => {
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-gen-5',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '현공 방장이 입적했다.',
        turn: 1,
        entityId: 'npc-hyeon-gong',
        attribute: 'status',
        value: 'DEAD'
      };
      const admitRes = ImmigrationGate.admit(
        {
          targetEntityId: 'npc-hyeon-gong',
          targetAttribute: 'status',
          claimedValue: 'DEAD',
          claimedEvidenceIds: ['ev-gen-5'],
          rawText: '현공 방장 입적'
        },
        [ev],
        snap
      );

      return {
        proposalId: 'prop-kill-05',
        requestId: 'req-kill-05',
        eventId: 'ev-kill-05',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Entity mismatch attack',
        verifiedClaims: [admitRes.verifiedClaim!],
        actions: [
          {
            type: 'SET_NPC_STATUS',
            payload: { id: 'npc-cheong-heo', status: 'DEAD' } // Targets different NPC
          }
        ]
      };
    }
  );

  // 2.2 Attribute Mismatch (Claim on impression, Action on status)
  executeAttack(
    'KILL-06-ATTRIBUTE-MISMATCH',
    'CATEGORY 2: Genuine Claim / Target Discrepancy',
    'Genuine Claim on impression applied to status mutation',
    'Claim.attribute != Action.attribute',
    createStandardTestEngine,
    (engine) => {
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-gen-6',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '현공 방장의 인상이 존경스러워졌다.',
        turn: 1,
        entityId: 'npc-hyeon-gong',
        attribute: 'impression',
        value: 'Revered'
      };
      const admitRes = ImmigrationGate.admit(
        {
          targetEntityId: 'npc-hyeon-gong',
          targetAttribute: 'impression',
          claimedValue: 'Revered',
          claimedEvidenceIds: ['ev-gen-6'],
          rawText: '현공 방장 인상'
        },
        [ev],
        snap
      );

      return {
        proposalId: 'prop-kill-06',
        requestId: 'req-kill-06',
        eventId: 'ev-kill-06',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Attribute mismatch attack',
        verifiedClaims: [admitRes.verifiedClaim!],
        actions: [
          {
            type: 'SET_NPC_STATUS',
            payload: { id: 'npc-hyeon-gong', status: 'DEAD' }
          }
        ]
      };
    }
  );

  // 2.3 Value Mismatch (Claim on influence 35, Action requests influence 80)
  executeAttack(
    'KILL-07-VALUE-MISMATCH',
    'CATEGORY 2: Genuine Claim / Target Discrepancy',
    'Genuine Claim on influence: 35, action requests influence: 80',
    'Claim.verifiedValue != Action.payload.changes.influence',
    createStandardTestEngine,
    (engine) => {
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-gen-7',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '소림사 세력이 35로 약간 상승했다.',
        turn: 1,
        entityId: 'faction-shaolin',
        attribute: 'influence',
        value: 35
      };
      const admitRes = ImmigrationGate.admit(
        {
          targetEntityId: 'faction-shaolin',
          targetAttribute: 'influence',
          claimedValue: 35,
          claimedEvidenceIds: ['ev-gen-7'],
          rawText: '소림사 세력 35'
        },
        [ev],
        snap
      );

      return {
        proposalId: 'prop-kill-07',
        requestId: 'req-kill-07',
        eventId: 'ev-kill-07',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Value mismatch attack',
        verifiedClaims: [admitRes.verifiedClaim!],
        actions: [
          {
            type: 'UPDATE_FACTION',
            payload: { id: 'faction-shaolin', changes: { influence: 80 } }
          }
        ]
      };
    }
  );

  // =========================================================================
  // CATEGORY 3: Piggybacking in `UPDATE_NPC.changes`
  // =========================================================================

  // 3.1 Partial Claim Piggyback (Valid claim for impression, but sneaks role change)
  executeAttack(
    'KILL-08-PIGGYBACK-UNVERIFIED-FIELD',
    'CATEGORY 3: Piggybacking & Compound Mutations',
    'Compound changes: impression has VerifiedClaim, but role is unverified',
    'UPDATE_NPC.changes contains { impression: "V", role: "Unverified" }',
    createStandardTestEngine,
    (engine) => {
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-gen-8',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '현공 방장의 인상이 존경스러워졌다.',
        turn: 1,
        entityId: 'npc-hyeon-gong',
        attribute: 'impression',
        value: 'Revered'
      };
      const admitRes = ImmigrationGate.admit(
        {
          targetEntityId: 'npc-hyeon-gong',
          targetAttribute: 'impression',
          claimedValue: 'Revered',
          claimedEvidenceIds: ['ev-gen-8'],
          rawText: '현공 방장 인상'
        },
        [ev],
        snap
      );

      return {
        proposalId: 'prop-kill-08',
        requestId: 'req-kill-08',
        eventId: 'ev-kill-08',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Piggyback unverified role in UPDATE_NPC',
        verifiedClaims: [admitRes.verifiedClaim!],
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-hyeon-gong',
              changes: {
                impression: 'Revered',
                role: '천하제일고수' // Piggybacked unverified field
              }
            }
          }
        ]
      };
    }
  );

  // 3.2 Piggyback status change inside UPDATE_NPC
  executeAttack(
    'KILL-09-PIGGYBACK-STATUS-IN-UPDATE-NPC',
    'CATEGORY 3: Piggybacking & Compound Mutations',
    'Compound changes: impression has VerifiedClaim, but status is secretly mutated to DEAD',
    'UPDATE_NPC.changes contains { impression: "V", status: "DEAD" }',
    createStandardTestEngine,
    (engine) => {
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-gen-9',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '현공 방장의 인상이 온화해졌다.',
        turn: 1,
        entityId: 'npc-hyeon-gong',
        attribute: 'impression',
        value: 'Gentle'
      };
      const admitRes = ImmigrationGate.admit(
        {
          targetEntityId: 'npc-hyeon-gong',
          targetAttribute: 'impression',
          claimedValue: 'Gentle',
          claimedEvidenceIds: ['ev-gen-9'],
          rawText: '현공 방장 인상'
        },
        [ev],
        snap
      );

      return {
        proposalId: 'prop-kill-09',
        requestId: 'req-kill-09',
        eventId: 'ev-kill-09',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Piggyback status in UPDATE_NPC',
        verifiedClaims: [admitRes.verifiedClaim!],
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-hyeon-gong',
              changes: {
                impression: 'Gentle',
                status: 'DEAD' // Unverified status hijacking
              }
            }
          }
        ]
      };
    }
  );

  // =========================================================================
  // CATEGORY 4: Cross-Action Authority Theft / Single Claim Hijack
  // =========================================================================

  // 4.1 Action 1 has Valid Claim, Action 2 has No Claim (Attempting partial commit or bypass)
  executeAttack(
    'KILL-10-CROSS-ACTION-THEFT',
    'CATEGORY 4: Multi-Action Isolation & Atomicity',
    'Proposal contains 2 actions: Action 1 has valid claim, Action 2 has no claim',
    'Valid Claim on Action 1, Unverified Action 2 in single proposal',
    createStandardTestEngine,
    (engine) => {
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-gen-10',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '소림사 세력이 40으로 상승했다.',
        turn: 1,
        entityId: 'faction-shaolin',
        attribute: 'influence',
        value: 40
      };
      const admitRes = ImmigrationGate.admit(
        {
          targetEntityId: 'faction-shaolin',
          targetAttribute: 'influence',
          claimedValue: 40,
          claimedEvidenceIds: ['ev-gen-10'],
          rawText: '소림사 세력 40'
        },
        [ev],
        snap
      );

      return {
        proposalId: 'prop-kill-10',
        requestId: 'req-kill-10',
        eventId: 'ev-kill-10',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Compound proposal with 1 valid and 1 invalid action',
        verifiedClaims: [admitRes.verifiedClaim!],
        actions: [
          {
            type: 'UPDATE_FACTION',
            payload: { id: 'faction-shaolin', changes: { influence: 40 } }
          },
          {
            type: 'SET_NPC_STATUS',
            payload: { id: 'npc-cheong-heo', status: 'DEAD' } // No claim for cheong-heo
          }
        ]
      };
    }
  );

  // 4.2 Reusing 1 Claim to Authorize 2 Conflicting Actions
  executeAttack(
    'KILL-11-CLAIM-REUSE-CONFLICT',
    'CATEGORY 4: Multi-Action Isolation & Atomicity',
    'Single claim on influence 40 used to justify 2 competing faction updates',
    'Action 1 sets influence 40, Action 2 sets influence 60 with same claim',
    createStandardTestEngine,
    (engine) => {
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-gen-11',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '소림사 세력이 40으로 상승했다.',
        turn: 1,
        entityId: 'faction-shaolin',
        attribute: 'influence',
        value: 40
      };
      const admitRes = ImmigrationGate.admit(
        {
          targetEntityId: 'faction-shaolin',
          targetAttribute: 'influence',
          claimedValue: 40,
          claimedEvidenceIds: ['ev-gen-11'],
          rawText: '소림사 세력 40'
        },
        [ev],
        snap
      );

      return {
        proposalId: 'prop-kill-11',
        requestId: 'req-kill-11',
        eventId: 'ev-kill-11',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Single claim authorizing conflicting action',
        verifiedClaims: [admitRes.verifiedClaim!],
        actions: [
          {
            type: 'UPDATE_FACTION',
            payload: { id: 'faction-shaolin', changes: { influence: 40 } }
          },
          {
            type: 'UPDATE_FACTION',
            payload: { id: 'faction-shaolin', changes: { influence: 60 } } // Discrepant from claim
          }
        ]
      };
    }
  );

  // =========================================================================
  // CATEGORY 5: Claim-less LLM Mutations across All State Targets
  // =========================================================================

  // 5.1 LLM ungrounded inventory ADD
  executeAttack(
    'KILL-12-LLM-UNGROUNDED-INVENTORY-ADD',
    'CATEGORY 5: Claimless LLM Mutations',
    'LLM attempts MODIFY_INVENTORY ADD without valid acquisition cause / verifiedEventId',
    'MODIFY_INVENTORY ADD with phantom item',
    createStandardTestEngine,
    (engine) => ({
      proposalId: 'prop-kill-12',
      requestId: 'req-kill-12',
      eventId: 'ev-kill-12',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Phantom inventory injection',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-god-sword', name: '의천검', quantity: 1 },
            acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'ev-non-existent' }
          }
        }
      ]
    })
  );

  // 5.2 LLM SET_QUANTITY Causality Bypass
  executeAttack(
    'KILL-13-LLM-SET-QUANTITY-BYPASS',
    'CATEGORY 5: Claimless LLM Mutations',
    'LLM attempts MODIFY_INVENTORY SET_QUANTITY to inflate existing item quantity',
    'MODIFY_INVENTORY SET_QUANTITY from LLM source',
    createStandardTestEngine,
    (engine) => ({
      proposalId: 'prop-kill-13',
      requestId: 'req-kill-13',
      eventId: 'ev-kill-13',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Inflate herb quantity via SET_QUANTITY',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'SET_QUANTITY',
            item: { id: 'item-herb', name: '상처약', quantity: 99 }
          }
        }
      ]
    })
  );

  // 5.3 LLM ACL Violation: RECORD_PHYSICAL_DEFECT
  executeAttack(
    'KILL-14-LLM-RECORD-PHYSICAL-DEFECT-ACL',
    'CATEGORY 5: Claimless LLM Mutations',
    'LLM attempts RECORD_PHYSICAL_DEFECT (prohibited for LLM source by ACL)',
    'RECORD_PHYSICAL_DEFECT by LLM',
    createStandardTestEngine,
    (engine) => ({
      proposalId: 'prop-kill-14',
      requestId: 'req-kill-14',
      eventId: 'ev-kill-14',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Impose permanent defect via LLM',
      actions: [
        {
          type: 'RECORD_PHYSICAL_DEFECT',
          payload: { defect: '오른팔 절단' }
        }
      ]
    })
  );

  // 5.4 LLM ACL Violation: OVERWRITE_WORLD_INFO
  executeAttack(
    'KILL-15-LLM-OVERWRITE-WORLD-INFO-ACL',
    'CATEGORY 5: Claimless LLM Mutations',
    'LLM attempts OVERWRITE_WORLD_INFO (prohibited for LLM source by ACL)',
    'OVERWRITE_WORLD_INFO by LLM',
    createStandardTestEngine,
    (engine) => ({
      proposalId: 'prop-kill-15',
      requestId: 'req-kill-15',
      eventId: 'ev-kill-15',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Wipe and replace world info via LLM',
      actions: [
        {
          type: 'OVERWRITE_WORLD_INFO',
          payload: createEmptyWorldInfo()
        }
      ]
    })
  );

  // 5.5 LLM ACL Violation: OVERWRITE_CHARACTER
  executeAttack(
    'KILL-16-LLM-OVERWRITE-CHARACTER-ACL',
    'CATEGORY 5: Claimless LLM Mutations',
    'LLM attempts OVERWRITE_CHARACTER (prohibited for LLM source by ACL)',
    'OVERWRITE_CHARACTER by LLM',
    createStandardTestEngine,
    (engine) => ({
      proposalId: 'prop-kill-16',
      requestId: 'req-kill-16',
      eventId: 'ev-kill-16',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Overwrite protagonist character via LLM',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: createEmptyCharacter()
        }
      ]
    })
  );

  // =========================================================================
  // CATEGORY 6: Source Forgery & Provenance Escalation
  // =========================================================================

  // 6.1 Direct submission of SYSTEM source without capability token
  executeAttack(
    'KILL-17-SOURCE-FORGERY-SYSTEM',
    'CATEGORY 6: Source Forgery & Authority Escalation',
    'Attacker submits proposal with source="SYSTEM" directly to submitProposal',
    'source="SYSTEM" direct submission',
    createStandardTestEngine,
    (engine) => ({
      proposalId: 'prop-kill-17',
      requestId: 'req-kill-17',
      eventId: 'ev-kill-17',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Forged SYSTEM source execution',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: createEmptyCharacter()
        }
      ]
    })
  );

  // 6.2 Direct submission of SAVE_HYDRATION / CLOUD_RESTORE source
  executeAttack(
    'KILL-18-SOURCE-FORGERY-SAVE-HYDRATION',
    'CATEGORY 6: Source Forgery & Authority Escalation',
    'Attacker submits proposal with source="SAVE_HYDRATION" directly to submitProposal',
    'source="SAVE_HYDRATION" direct submission',
    createStandardTestEngine,
    (engine) => ({
      proposalId: 'prop-kill-18',
      requestId: 'req-kill-18',
      eventId: 'ev-kill-18',
      expectedStateVersion: 1,
      source: 'SAVE_HYDRATION',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Forged SAVE_HYDRATION source execution',
      actions: [
        {
          type: 'OVERWRITE_WORLD_INFO',
          payload: createEmptyWorldInfo()
        }
      ]
    })
  );

  // 6.3 Proposal Metadata Escalation
  executeAttack(
    'KILL-19-METADATA-AUTHORITY-ESCALATION',
    'CATEGORY 6: Source Forgery & Authority Escalation',
    'Attacker injects arbitrary metadata flags trying to bypass checks',
    'metadata: { bypassValidation: true, isSuperUser: true, verified: true }',
    createStandardTestEngine,
    (engine) => ({
      proposalId: 'prop-kill-19',
      requestId: 'req-kill-19',
      eventId: 'ev-kill-19',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Metadata escalation attack',
      metadata: {
        bypassValidation: true,
        isSuperUser: true,
        trusted: true,
        isSystem: true
      } as any,
      actions: [
        {
          type: 'SET_NPC_STATUS',
          payload: { id: 'npc-hyeon-gong', status: 'DEAD' }
        }
      ]
    })
  );

  // =========================================================================
  // CATEGORY 7: Legitimate Permissiveness & Creation Freedom Verification
  // =========================================================================

  // 7.1 Legitimate Gate Admission & Commit (Positive Control 1)
  executeAttack(
    'KILL-20-LEGITIMATE-CLAIM-COMMIT',
    'CATEGORY 7: Legitimate Authority & Permissiveness',
    'Legitimate immigration admission + proposal execution commits cleanly',
    'Genuine Gate Admission -> Sovereign Commit',
    createStandardTestEngine,
    (engine) => {
      const snap = engine.getSnapshot();
      const ev: ExternalEvidence = {
        evidenceId: 'ev-legit-20',
        sourceType: 'NARRATIVE',
        timestamp: new Date().toISOString(),
        contentSnippet: '무당파의 세력 영향력이 35로 증가했다.',
        turn: 1,
        entityId: 'faction-wudang',
        attribute: 'influence',
        value: 35
      };
      const admitRes = ImmigrationGate.admit(
        {
          targetEntityId: 'faction-wudang',
          targetAttribute: 'influence',
          claimedValue: 35,
          claimedEvidenceIds: ['ev-legit-20'],
          rawText: '무당파 세력 35'
        },
        [ev],
        snap
      );
      if (!admitRes.admitted || !admitRes.verifiedClaim) {
        throw new Error(`Gate admission failed: ${admitRes.rejectionReason}`);
      }

      const node: MeaningNode = {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'UPDATE_FACTION',
        fields: {
          actionType: 'UPDATE_FACTION',
          payload: { id: 'faction-wudang', changes: { influence: 35 } }
        }
      };

      const proposal = adaptMeaningTreeToProposal(node, {
        proposalId: 'prop-kill-20',
        requestId: 'req-kill-20',
        eventId: 'ev-kill-20',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Legitimate faction update'
      });
      proposal.verifiedClaims = [admitRes.verifiedClaim];
      return proposal;
    },
    'COMMIT' // Expected to COMMIT cleanly
  );

  // 7.2 Creative Freedom: LLM Adds New NPC, Narrative Seed, and Offscreen Event (Positive Control 2)
  executeAttack(
    'KILL-21-CREATIVE-FREEDOM-NEW-ENTITIES',
    'CATEGORY 7: Legitimate Authority & Permissiveness',
    'LLM introduces new NPC, narrative seed, and offscreen event (Rule Authority)',
    'ADD_NPC + ADD_NARRATIVE_SEED + RECORD_OFFSCREEN_EVENT',
    createStandardTestEngine,
    (engine) => {
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
                id: 'npc-dan-mok',
                name: '단목혜',
                status: 'ALIVE',
                impression: 'Mysterious',
                role: 'Wanderer',
                personality: 'Quiet',
                affiliation: '무소속'
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
                id: 'seed-ancient-scroll',
                content: '장경각 지하에서 오래된 비급의 흔적이 발견되었다.',
                status: 'active'
              }
            }
          },
          {
            atom: 'ACTION',
            scope: 'PROPOSAL',
            value: 'RECORD_OFFSCREEN_EVENT',
            fields: {
              actionType: 'RECORD_OFFSCREEN_EVENT',
              payload: {
                eventId: 'off-black-wind',
                eventDescription: '흑풍채가 하북 상단을 습격했다.',
                narrativeTime: { year: 1, season: 'SPRING', month: 3, day: 15, timeOfDay: 'NIGHT' }
              }
            }
          }
        ]
      };

      return adaptMeaningTreeToProposal(rootTree, {
        proposalId: 'prop-kill-21',
        requestId: 'req-kill-21',
        eventId: 'ev-kill-21',
        expectedStateVersion: 1,
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        intentSummary: 'Introduce new world elements'
      });
    },
    'COMMIT' // Expected to COMMIT cleanly
  );

  return {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results
  };
}

// Auto-run if invoked directly
if (typeof process !== 'undefined' && process.argv[1]?.includes('finalAuthorityKillTest')) {
  console.log('====================================================');
  console.log('VEIL HOSTILE RUNTIME FORENSIC KILL-TEST SUITE');
  console.log('====================================================');
  const suiteResult = runFinalAuthorityKillTestSuite();
  for (const r of suiteResult.results) {
    const symbol = r.passed ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`${symbol} ${r.testId}: ${r.description}`);
    if (!r.passed && r.error) {
      console.log(`   Error: ${r.error}`);
    }
  }
  console.log('====================================================');
  console.log(`Summary: ${suiteResult.passed}/${suiteResult.total} Tests Passed.`);
  console.log('====================================================');
  if (suiteResult.failed > 0) {
    process.exit(1);
  }
}
