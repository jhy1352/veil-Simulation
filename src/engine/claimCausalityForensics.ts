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
import * as fs from 'fs';
import * as path from 'path';

export interface ForensicsTestResult {
  testId: string;
  category: string;
  targetVector: string;
  description: string;
  verdict: 'DEFENDED' | 'EXPLOITED' | 'EXPECTED_BEHAVIOR';
  vulnerabilityDiscovered: boolean;
  pipelineStage: string;
  stateBefore: {
    stateVersion: number;
    turn: number;
    targetEntitySummary: any;
  };
  stateAfter: {
    stateVersion: number;
    turn: number;
    targetEntitySummary: any;
  };
  stateMutated: boolean;
  stateVersionDelta: number;
  historyCountDelta: number;
  validatorVerdict: {
    isValid: boolean;
    rejectedReasons: readonly string[];
    conflictDetails: readonly string[];
  };
  commitResult: {
    success: boolean;
    committedActionsCount: number;
  };
  boundaryCheckResult?: {
    isValid: boolean;
    violationReasons: string[];
  };
  exploitDetails?: string;
  callGraphTrace: string;
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

export function runFullClaimCausalityForensicsSuite(): {
  total: number;
  defended: number;
  exploited: number;
  expectedBehavior: number;
  results: ForensicsTestResult[];
} {
  const results: ForensicsTestResult[] = [];

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
        impression: 'None',
        role: 'Former Elder',
        affiliation: '소림사',
        personality: 'Stern',
        trust: 0,
        affinity: 0
      }
    ];
    return world;
  }

  function createStandardCharacter(): Character {
    const char = createEmptyCharacter();
    char.name = '백무결';
    char.stats = {
      strength: 14,
      agility: 12,
      constitution: 13,
      intelligence: 10,
      wisdom: 11,
      charisma: 10
    };
    return char;
  }

  // =========================================================================
  // CATEGORY A: TARGET 1 - UPDATE_NPC
  // =========================================================================

  // Test A1: Exact Claim -> UPDATE_NPC
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-npc-trust-85',
      entityId: 'npc-hyeon-gong',
      entityType: 'NPC',
      attribute: 'trust',
      value: 85,
      source: 'QUEST_COMPLETION_TREATISE'
    };
    const claimCandidate: UntrustedClaim = {
      rawText: '현공 방장의 신뢰도가 85로 상승했다.',
      targetEntityId: 'npc-hyeon-gong',
      targetAttribute: 'trust',
      claimedValue: 85,
      claimedEvidenceIds: ['ev-npc-trust-85']
    };
    const admission = ImmigrationGate.admit(claimCandidate, [evidence], snapBefore);
    const verifiedClaim = admission.verifiedClaim!;

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a1',
      requestId: 'req-a1',
      eventId: 'evt-a1',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Update Hyeon-gong trust to 85',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-hyeon-gong', changes: { trust: 85 } }
        }
      ],
      verifiedClaims: [verifiedClaim]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const hyeonGongAfter = snapAfter.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong');
    const success = commitRes.success && hyeonGongAfter?.trust === 85;

    results.push({
      testId: 'TEST-A1-EXACT-CLAIM-UPDATE-NPC',
      category: 'TARGET_1_UPDATE_NPC',
      targetVector: 'Exact Claim Grounding',
      description: 'Admit exact claim (trust: 85) and verify UPDATE_NPC succeeds and transitions Canonical State',
      verdict: success ? 'EXPECTED_BEHAVIOR' : 'EXPLOITED',
      vulnerabilityDiscovered: !success,
      pipelineStage: 'Sovereign Commit Gate',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: hyeonGongAfter },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'ImmigrationGate.admit -> EngineValidator.validate (hasMatchingVerifiedClaim) -> SovereignEngine.submitProposal -> Commit'
    });
  }

  // Test A2: EXISTENCE / Wildcard Claim -> Ungrounded Attribute Mutation
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-npc-exist',
      entityId: 'npc-hyeon-gong',
      entityType: 'NPC',
      attribute: 'EXISTENCE',
      value: true,
      source: 'TEMPLE_CENSUS'
    };
    const claimCandidate: UntrustedClaim = {
      rawText: '현공 방장이 존재함을 확인했다.',
      targetEntityId: 'npc-hyeon-gong',
      targetAttribute: 'EXISTENCE',
      claimedValue: true,
      claimedEvidenceIds: ['ev-npc-exist']
    };
    const admission = ImmigrationGate.admit(claimCandidate, [evidence], snapBefore);
    const verifiedClaim = admission.verifiedClaim!;

    // Hostile attempt: Using EXISTENCE claim to mutate arbitrary ungrounded attribute (trust: 99 and role: 'Grand Emperor')
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a2',
      requestId: 'req-a2',
      eventId: 'evt-a2',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Mutate ungrounded role & trust via EXISTENCE claim',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-hyeon-gong', changes: { trust: 99, role: 'Grand Emperor' } }
        }
      ],
      verifiedClaims: [verifiedClaim]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const hyeonGongAfter = snapAfter.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong');

    // If EXISTENCE claim allows ungrounded role/trust changes to commit, it is an EXPLOIT
    const exploited = commitRes.success && hyeonGongAfter?.role === 'Grand Emperor';

    results.push({
      testId: 'TEST-A2-EXISTENCE-WILDCARD-UNGROUNDED-MUTATION',
      category: 'TARGET_1_UPDATE_NPC',
      targetVector: 'EXISTENCE Claim Wildcard Bypass',
      description: 'Attempt to use an EXISTENCE claim to bypass attribute-specific verification on UPDATE_NPC (trust=99, role=Grand Emperor)',
      verdict: exploited ? 'EXPLOITED' : 'DEFENDED',
      vulnerabilityDiscovered: exploited,
      pipelineStage: 'EngineValidator (hasMatchingVerifiedClaim wildcard check)',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: hyeonGongAfter },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      exploitDetails: exploited ? 'CRITICAL: hasMatchingVerifiedClaim treats targetAttribute: EXISTENCE as a wildcard, allowing arbitrary ungrounded mutations on any attribute.' : undefined,
      callGraphTrace: 'ImmigrationGate.admit(EXISTENCE) -> EngineValidator.validate -> hasMatchingVerifiedClaim(c.targetAttribute === EXISTENCE) -> Bypass -> Commit'
    });
  }

  // Test A3: Name-Based Alternative Entity ID Matching
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-name-match',
      entityId: '현공 방장', // Name instead of ID
      entityType: 'NPC',
      attribute: 'trust',
      value: 75,
      source: 'REPUTATION_RECORD'
    };
    const claimCandidate: UntrustedClaim = {
      rawText: '현공 방장의 신뢰도가 75로 올랐다.',
      targetEntityId: '현공 방장',
      targetAttribute: 'trust',
      claimedValue: 75,
      claimedEvidenceIds: ['ev-name-match']
    };
    const admission = ImmigrationGate.admit(claimCandidate, [evidence], snapBefore);
    const verifiedClaim = admission.verifiedClaim!;

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a3',
      requestId: 'req-a3',
      eventId: 'evt-a3',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Update trust using name-based verified claim',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-hyeon-gong', changes: { trust: 75 } }
        }
      ],
      verifiedClaims: [verifiedClaim]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const hyeonGongAfter = snapAfter.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong');

    results.push({
      testId: 'TEST-A3-NAME-BASED-ALTERNATIVE-ENTITY-MATCHING',
      category: 'TARGET_1_UPDATE_NPC',
      targetVector: 'Alternative Entity ID Matching',
      description: 'Verify if claim issued for NPC Name ("현공 방장") authorizes UPDATE_NPC on ID ("npc-hyeon-gong")',
      verdict: commitRes.success ? 'EXPECTED_BEHAVIOR' : 'DEFENDED',
      vulnerabilityDiscovered: false,
      pipelineStage: 'EngineValidator.hasMatchingVerifiedClaim',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: hyeonGongAfter },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'ImmigrationGate.admit(Name) -> EngineValidator.hasMatchingVerifiedClaim(alternativeEntityId: targetNpc.name) -> Commit'
    });
  }

  // Test A4: Partial Claim vs Multi-field Update
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-trust-only',
      entityId: 'npc-hyeon-gong',
      entityType: 'NPC',
      attribute: 'trust',
      value: 80,
      source: 'TESTIMONY'
    };
    const claimCandidate: UntrustedClaim = {
      rawText: '현공 방장 신뢰도 80',
      targetEntityId: 'npc-hyeon-gong',
      targetAttribute: 'trust',
      claimedValue: 80,
      claimedEvidenceIds: ['ev-trust-only']
    };
    const admission = ImmigrationGate.admit(claimCandidate, [evidence], snapBefore);
    const verifiedClaim = admission.verifiedClaim!;

    // Hostile payload: Update trust: 80 AND sneak ungrounded affinity: 95
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a4',
      requestId: 'req-a4',
      eventId: 'evt-a4',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Update trust and sneak affinity',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-hyeon-gong', changes: { trust: 80, affinity: 95 } }
        }
      ],
      verifiedClaims: [verifiedClaim]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const defended = !commitRes.success && valRes.rejectedReasons.some(r => r.includes('CLAIM_AUTHORITY_VIOLATION'));

    results.push({
      testId: 'TEST-A4-PARTIAL-CLAIM-MULTI-FIELD-INJECTION',
      category: 'TARGET_1_UPDATE_NPC',
      targetVector: 'Partial Verification Sneak',
      description: 'Provide claim for 1 attribute (trust) while mutating 2 attributes (trust, affinity)',
      verdict: defended ? 'DEFENDED' : 'EXPLOITED',
      vulnerabilityDiscovered: !defended,
      pipelineStage: 'EngineValidator.UPDATE_NPC multi-field check',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: snapAfter.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'EngineValidator.UPDATE_NPC -> for of Object.entries(changes) -> Unverified affinity rejected'
    });
  }

  // Test A5: Dead NPC Mutation with Valid Claim
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-dead-trust',
      entityId: 'npc-dead-elder',
      entityType: 'NPC',
      attribute: 'trust',
      value: 70,
      source: 'FORGED_SCROLL'
    };
    const claimCandidate: UntrustedClaim = {
      rawText: '망자 장로의 신뢰도가 상승했다.',
      targetEntityId: 'npc-dead-elder',
      targetAttribute: 'trust',
      claimedValue: 70,
      claimedEvidenceIds: ['ev-dead-trust']
    };
    const admission = ImmigrationGate.admit(claimCandidate, [evidence], snapBefore);
    const verifiedClaim = admission.verifiedClaim!;

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a5',
      requestId: 'req-a5',
      eventId: 'evt-a5',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Mutate deceased NPC with valid claim',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-dead-elder', changes: { trust: 70 } }
        }
      ],
      verifiedClaims: [verifiedClaim]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const defended = !commitRes.success && valRes.rejectedReasons.some(r => r.includes('DEAD_NPC_STATUS_PROTECTION'));

    results.push({
      testId: 'TEST-A5-DEAD-NPC-MUTATION-WITH-CLAIM',
      category: 'TARGET_1_UPDATE_NPC',
      targetVector: 'Dead Entity Invariant Override',
      description: 'Attempt to mutate DEAD NPC attributes using a valid Gate-issued VerifiedClaim',
      verdict: defended ? 'DEFENDED' : 'EXPLOITED',
      vulnerabilityDiscovered: !defended,
      pipelineStage: 'EngineValidator DEAD_NPC_STATUS_PROTECTION',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.npcs.find(n => n.id === 'npc-dead-elder') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: snapAfter.worldInfo.npcs.find(n => n.id === 'npc-dead-elder') },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'EngineValidator.UPDATE_NPC -> targetNpc.status === DEAD -> Blocked before claim evaluation'
    });
  }

  // Test A6: Immutable ID Tampering in UPDATE_NPC
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-id-tamper',
      entityId: 'npc-hyeon-gong',
      attribute: 'trust',
      value: 60,
      source: 'NOTE'
    };
    const admission = ImmigrationGate.admit({
      rawText: '신뢰도 60',
      targetEntityId: 'npc-hyeon-gong',
      targetAttribute: 'trust',
      claimedValue: 60,
      claimedEvidenceIds: ['ev-id-tamper']
    }, [evidence], snapBefore);

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a6',
      requestId: 'req-a6',
      eventId: 'evt-a6',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Mutate immutable NPC ID',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-hyeon-gong', changes: { id: 'npc-hyeon-gong-hijacked' as any, trust: 60 } }
        }
      ],
      verifiedClaims: [admission.verifiedClaim!]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const defended = !commitRes.success && valRes.rejectedReasons.some(r => r.includes('IMMUTABLE_FIELD_PROTECTION'));

    results.push({
      testId: 'TEST-A6-IMMUTABLE-ID-MUTATION-ATTEMPT',
      category: 'TARGET_1_UPDATE_NPC',
      targetVector: 'Immutable Field Protection',
      description: 'Attempt to mutate immutable NPC ID field via UPDATE_NPC',
      verdict: defended ? 'DEFENDED' : 'EXPLOITED',
      vulnerabilityDiscovered: !defended,
      pipelineStage: 'EngineValidator IMMUTABLE_FIELD_PROTECTION',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: snapAfter.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'EngineValidator.UPDATE_NPC -> changes.id !== id -> Blocked'
    });
  }

  // Test A7: Name Collision via UPDATE_NPC with Claim
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-name-col',
      entityId: 'npc-hyeon-gong',
      attribute: 'name',
      value: '청허 도장',
      source: 'FORGERY'
    };
    const admission = ImmigrationGate.admit({
      rawText: '이름 변경',
      targetEntityId: 'npc-hyeon-gong',
      targetAttribute: 'name',
      claimedValue: '청허 도장',
      claimedEvidenceIds: ['ev-name-col']
    }, [evidence], snapBefore);

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a7',
      requestId: 'req-a7',
      eventId: 'evt-a7',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Rename Hyeon-gong to Cheong-heo (collision)',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-hyeon-gong', changes: { name: '청허 도장' } }
        }
      ],
      verifiedClaims: [admission.verifiedClaim!]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const defended = !commitRes.success && valRes.rejectedReasons.some(r => r.includes('NPC_CONFLICT'));

    results.push({
      testId: 'TEST-A7-NAME-COLLISION-VIA-UPDATE-NPC',
      category: 'TARGET_1_UPDATE_NPC',
      targetVector: 'Name Uniqueness Invariant',
      description: 'Attempt to rename NPC to an existing NPC name using a verified claim',
      verdict: defended ? 'DEFENDED' : 'EXPLOITED',
      vulnerabilityDiscovered: !defended,
      pipelineStage: 'EngineValidator NPC_CONFLICT',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: snapAfter.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'EngineValidator.UPDATE_NPC -> draftWorld.npcs.some(name collision) -> Blocked'
    });
  }

  // Test A8: Value Mismatch (Claim has 70, Action has 90)
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-trust-70',
      entityId: 'npc-hyeon-gong',
      attribute: 'trust',
      value: 70,
      source: 'LETTER'
    };
    const admission = ImmigrationGate.admit({
      rawText: '신뢰도 70',
      targetEntityId: 'npc-hyeon-gong',
      targetAttribute: 'trust',
      claimedValue: 70,
      claimedEvidenceIds: ['ev-trust-70']
    }, [evidence], snapBefore);

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a8',
      requestId: 'req-a8',
      eventId: 'evt-a8',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Inflate trust to 90 with claim for 70',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-hyeon-gong', changes: { trust: 90 } }
        }
      ],
      verifiedClaims: [admission.verifiedClaim!]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const defended = !commitRes.success && valRes.rejectedReasons.some(r => r.includes('CLAIM_AUTHORITY_VIOLATION'));

    results.push({
      testId: 'TEST-A8-VALUE-MISMATCH-CLAIM-VS-ACTION',
      category: 'TARGET_1_UPDATE_NPC',
      targetVector: 'Value Grounding Check',
      description: 'Attempt to submit UPDATE_NPC with value (90) inflated above verified claim value (70)',
      verdict: defended ? 'DEFENDED' : 'EXPLOITED',
      vulnerabilityDiscovered: !defended,
      pipelineStage: 'EngineValidator.hasMatchingVerifiedClaim isDeepEqual',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: snapAfter.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'EngineValidator.hasMatchingVerifiedClaim -> isDeepEqual(70, 90) -> false -> Blocked'
    });
  }

  // Test A9: Forged Cloned Claim (JSON object without WeakSet registration)
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-real',
      entityId: 'npc-hyeon-gong',
      attribute: 'trust',
      value: 80,
      source: 'SCROLL'
    };
    const admission = ImmigrationGate.admit({
      rawText: '신뢰도 80',
      targetEntityId: 'npc-hyeon-gong',
      targetAttribute: 'trust',
      claimedValue: 80,
      claimedEvidenceIds: ['ev-real']
    }, [evidence], snapBefore);

    // Deep clone the claim to break object reference in WeakSet
    const forgedClone: VerifiedClaim = Object.freeze(JSON.parse(JSON.stringify(admission.verifiedClaim!)));

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a9',
      requestId: 'req-a9',
      eventId: 'evt-a9',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Submit forged clone of VerifiedClaim',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-hyeon-gong', changes: { trust: 80 } }
        }
      ],
      verifiedClaims: [forgedClone]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const defended = !commitRes.success && valRes.rejectedReasons.some(r => r.includes('CLAIM_AUTHORITY_VIOLATION'));

    results.push({
      testId: 'TEST-A9-FORGED-CLONED-CLAIM-OBJECT',
      category: 'TARGET_1_UPDATE_NPC',
      targetVector: 'WeakSet Capability Identity',
      description: 'Attempt to bypass gate using structurally identical JSON clone of a VerifiedClaim',
      verdict: defended ? 'DEFENDED' : 'EXPLOITED',
      vulnerabilityDiscovered: !defended,
      pipelineStage: 'ImmigrationGate.isValidVerifiedClaim (WeakSet.has)',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: snapAfter.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'EngineValidator -> ImmigrationGate.isValidVerifiedClaim(forgedClone) -> WeakSet.has() === false -> Rejected'
    });
  }

  // =========================================================================
  // CATEGORY B: TARGET 2 - UPDATE_FACTION
  // =========================================================================

  // Test B1: Exact Claim -> UPDATE_FACTION
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-fac-inf-35',
      entityId: 'faction-shaolin',
      entityType: 'FACTION',
      attribute: 'influence',
      value: 35,
      source: 'MARTIAL_ALLIANCE_TREATY'
    };
    const admission = ImmigrationGate.admit({
      rawText: '소림사의 세력이 35로 증가했다.',
      targetEntityId: 'faction-shaolin',
      targetAttribute: 'influence',
      claimedValue: 35,
      claimedEvidenceIds: ['ev-fac-inf-35']
    }, [evidence], snapBefore);

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-b1',
      requestId: 'req-b1',
      eventId: 'evt-b1',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Update Shaolin influence to 35',
      actions: [
        {
          type: 'UPDATE_FACTION',
          payload: { id: 'faction-shaolin', changes: { influence: 35 } }
        }
      ],
      verifiedClaims: [admission.verifiedClaim!]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const shaolinAfter = snapAfter.worldInfo.factions.find(f => f.id === 'faction-shaolin');
    const success = commitRes.success && shaolinAfter?.influence === 35;

    results.push({
      testId: 'TEST-B1-EXACT-CLAIM-UPDATE-FACTION',
      category: 'TARGET_2_UPDATE_FACTION',
      targetVector: 'Exact Faction Grounding',
      description: 'Admit exact claim (influence: 35) and verify UPDATE_FACTION succeeds and updates Canonical State',
      verdict: success ? 'EXPECTED_BEHAVIOR' : 'EXPLOITED',
      vulnerabilityDiscovered: !success,
      pipelineStage: 'Sovereign Commit Gate',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.factions.find(f => f.id === 'faction-shaolin') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: shaolinAfter },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'ImmigrationGate.admit -> EngineValidator (UPDATE_FACTION) -> Sovereign Commit'
    });
  }

  // Test B2: Faction Influence Overflow (> 100) with Valid Claim
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot(); // Shaolin 30, Wudang 25, Mount Hua 20 (Total = 75)
    // Attempt Shaolin influence = 60 (Total would be 60 + 25 + 20 = 105 > 100)
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-fac-inf-60',
      entityId: 'faction-shaolin',
      attribute: 'influence',
      value: 60,
      source: 'ALLIANCE_TREATY'
    };
    const admission = ImmigrationGate.admit({
      rawText: '소림사 세력 60',
      targetEntityId: 'faction-shaolin',
      targetAttribute: 'influence',
      claimedValue: 60,
      claimedEvidenceIds: ['ev-fac-inf-60']
    }, [evidence], snapBefore);

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-b2',
      requestId: 'req-b2',
      eventId: 'evt-b2',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Update Shaolin influence causing cumulative overflow',
      actions: [
        {
          type: 'UPDATE_FACTION',
          payload: { id: 'faction-shaolin', changes: { influence: 60 } }
        }
      ],
      verifiedClaims: [admission.verifiedClaim!]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const defended = !commitRes.success && valRes.rejectedReasons.some(r => r.includes('FACTION_INFLUENCE_EXCEEDED'));

    results.push({
      testId: 'TEST-B2-FACTION-INFLUENCE-CUMULATIVE-OVERFLOW',
      category: 'TARGET_2_UPDATE_FACTION',
      targetVector: 'Cumulative Invariant vs Claim Authority',
      description: 'Attempt to update faction influence with valid claim to value causing cumulative sum > 100',
      verdict: defended ? 'DEFENDED' : 'EXPLOITED',
      vulnerabilityDiscovered: !defended,
      pipelineStage: 'EngineValidator FACTION_INFLUENCE_EXCEEDED',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.factions.map(f => ({ id: f.id, inf: f.influence })) },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: snapAfter.worldInfo.factions.map(f => ({ id: f.id, inf: f.influence })) },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'EngineValidator.UPDATE_FACTION -> otherTotal + incomingNum > 100 -> Blocked'
    });
  }

  // Test B3: Faction Name Collision with Valid Claim
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-fac-rename',
      entityId: 'faction-wudang',
      attribute: 'name',
      value: '소림사',
      source: 'MOCK'
    };
    const admission = ImmigrationGate.admit({
      rawText: '무당파 이름 소림사로 변경',
      targetEntityId: 'faction-wudang',
      targetAttribute: 'name',
      claimedValue: '소림사',
      claimedEvidenceIds: ['ev-fac-rename']
    }, [evidence], snapBefore);

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-b3',
      requestId: 'req-b3',
      eventId: 'evt-b3',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Rename Wudang to Shaolin (collision)',
      actions: [
        {
          type: 'UPDATE_FACTION',
          payload: { id: 'faction-wudang', changes: { name: '소림사' } }
        }
      ],
      verifiedClaims: [admission.verifiedClaim!]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const defended = !commitRes.success && valRes.rejectedReasons.some(r => r.includes('FACTION_CONFLICT'));

    results.push({
      testId: 'TEST-B3-FACTION-NAME-COLLISION',
      category: 'TARGET_2_UPDATE_FACTION',
      targetVector: 'Faction Name Uniqueness Invariant',
      description: 'Attempt to rename a faction to an existing faction name with a valid claim',
      verdict: defended ? 'DEFENDED' : 'EXPLOITED',
      vulnerabilityDiscovered: !defended,
      pipelineStage: 'EngineValidator FACTION_CONFLICT',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.factions.find(f => f.id === 'faction-wudang') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: snapAfter.worldInfo.factions.find(f => f.id === 'faction-wudang') },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'EngineValidator.UPDATE_FACTION -> draftWorld.factions.some(name collision) -> Blocked'
    });
  }

  // Test B4: Faction EXISTENCE / Wildcard Claim Bypass
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-fac-exist',
      entityId: 'faction-wudang',
      attribute: 'EXISTENCE',
      value: true,
      source: 'CENSUS'
    };
    const admission = ImmigrationGate.admit({
      rawText: '무당파 존재 확인',
      targetEntityId: 'faction-wudang',
      targetAttribute: 'EXISTENCE',
      claimedValue: true,
      claimedEvidenceIds: ['ev-fac-exist']
    }, [evidence], snapBefore);

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-b4',
      requestId: 'req-b4',
      eventId: 'evt-b4',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Mutate ungrounded faction description via EXISTENCE claim',
      actions: [
        {
          type: 'UPDATE_FACTION',
          payload: { id: 'faction-wudang', changes: { description: '완전히 타락한 마교 분파' } }
        }
      ],
      verifiedClaims: [admission.verifiedClaim!]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const wudangAfter = snapAfter.worldInfo.factions.find(f => f.id === 'faction-wudang');

    const exploited = commitRes.success && wudangAfter?.description === '완전히 타락한 마교 분파';

    results.push({
      testId: 'TEST-B4-FACTION-EXISTENCE-WILDCARD-BYPASS',
      category: 'TARGET_2_UPDATE_FACTION',
      targetVector: 'EXISTENCE Claim Wildcard Bypass',
      description: 'Attempt to use Faction EXISTENCE claim to mutate ungrounded description',
      verdict: exploited ? 'EXPLOITED' : 'DEFENDED',
      vulnerabilityDiscovered: exploited,
      pipelineStage: 'EngineValidator.hasMatchingVerifiedClaim',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.factions.find(f => f.id === 'faction-wudang') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: wudangAfter },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      exploitDetails: exploited ? 'CRITICAL: Faction UPDATE_FACTION permits arbitrary description mutation when an EXISTENCE claim is provided.' : undefined,
      callGraphTrace: 'ImmigrationGate.admit(EXISTENCE) -> EngineValidator.hasMatchingVerifiedClaim -> Bypass -> Commit'
    });
  }

  // =========================================================================
  // CATEGORY C: TARGET 3 - SET_NPC_STATUS
  // =========================================================================

  // Test C1: Exact Status Claim (ALIVE -> INCAPACITATED/MISSING)
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-status-missing',
      entityId: 'npc-hyeon-gong',
      attribute: 'status',
      value: 'MISSING',
      source: 'DISAPPEARANCE_REPORT'
    };
    const admission = ImmigrationGate.admit({
      rawText: '현공 방장이 행방불명되었다.',
      targetEntityId: 'npc-hyeon-gong',
      targetAttribute: 'status',
      claimedValue: 'MISSING',
      claimedEvidenceIds: ['ev-status-missing']
    }, [evidence], snapBefore);

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-c1',
      requestId: 'req-c1',
      eventId: 'evt-c1',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Set Hyeon-gong status to MISSING',
      actions: [
        {
          type: 'SET_NPC_STATUS',
          payload: { id: 'npc-hyeon-gong', status: 'MISSING' }
        }
      ],
      verifiedClaims: [admission.verifiedClaim!]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const hyeonGongAfter = snapAfter.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong');
    const success = commitRes.success && hyeonGongAfter?.status === 'MISSING';

    results.push({
      testId: 'TEST-C1-EXACT-STATUS-CLAIM-COMMIT',
      category: 'TARGET_3_SET_NPC_STATUS',
      targetVector: 'Status Transition Grounding',
      description: 'Admit exact status claim (MISSING) and verify SET_NPC_STATUS commits cleanly',
      verdict: success ? 'EXPECTED_BEHAVIOR' : 'EXPLOITED',
      vulnerabilityDiscovered: !success,
      pipelineStage: 'Sovereign Commit Gate',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: hyeonGongAfter },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'ImmigrationGate.admit -> EngineValidator (SET_NPC_STATUS) -> Sovereign Commit'
    });
  }

  // Test C2: Dead NPC Revival Attempt with Valid Claim
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const evidence: ExternalEvidence = {
      evidenceId: 'ev-revive',
      entityId: 'npc-dead-elder',
      attribute: 'status',
      value: 'ALIVE',
      source: 'NECROMANCY_CLAIM'
    };
    const admission = ImmigrationGate.admit({
      rawText: '망자 장로가 부활했다.',
      targetEntityId: 'npc-dead-elder',
      targetAttribute: 'status',
      claimedValue: 'ALIVE',
      claimedEvidenceIds: ['ev-revive']
    }, [evidence], snapBefore);

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-c2',
      requestId: 'req-c2',
      eventId: 'evt-c2',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Revive DEAD NPC with valid claim',
      actions: [
        {
          type: 'SET_NPC_STATUS',
          payload: { id: 'npc-dead-elder', status: 'ALIVE' }
        }
      ],
      verifiedClaims: [admission.verifiedClaim!]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const defended = !commitRes.success && valRes.rejectedReasons.some(r => r.includes('DEAD_NPC_STATUS_PROTECTION'));

    results.push({
      testId: 'TEST-C2-DEAD-NPC-REVIVAL-ATTEMPT',
      category: 'TARGET_3_SET_NPC_STATUS',
      targetVector: 'Dead Entity Permanent Status Invariant',
      description: 'Attempt to revive a DEAD NPC to ALIVE status using a Gate-issued VerifiedClaim',
      verdict: defended ? 'DEFENDED' : 'EXPLOITED',
      vulnerabilityDiscovered: !defended,
      pipelineStage: 'EngineValidator DEAD_NPC_STATUS_PROTECTION',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.npcs.find(n => n.id === 'npc-dead-elder') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: snapAfter.worldInfo.npcs.find(n => n.id === 'npc-dead-elder') },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'EngineValidator.SET_NPC_STATUS -> targetNpc.status === DEAD -> Blocked'
    });
  }

  // =========================================================================
  // CATEGORY D: INTRA-PROPOSAL & PIPELINE DYNAMICS
  // =========================================================================

  // Test D1: Intra-Proposal Contradiction (2 Conflicting Actions with Claims in 1 Proposal)
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const ev1: ExternalEvidence = { evidenceId: 'ev-t80', entityId: 'npc-hyeon-gong', attribute: 'trust', value: 80, source: 'S1' };
    const ev2: ExternalEvidence = { evidenceId: 'ev-t20', entityId: 'npc-hyeon-gong', attribute: 'trust', value: 20, source: 'S2' };

    const c1 = ImmigrationGate.admit({ rawText: 't80', targetEntityId: 'npc-hyeon-gong', targetAttribute: 'trust', claimedValue: 80, claimedEvidenceIds: ['ev-t80'] }, [ev1], snapBefore).verifiedClaim!;
    const c2 = ImmigrationGate.admit({ rawText: 't20', targetEntityId: 'npc-hyeon-gong', targetAttribute: 'trust', claimedValue: 20, claimedEvidenceIds: ['ev-t20'] }, [ev2], snapBefore).verifiedClaim!;

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-d1',
      requestId: 'req-d1',
      eventId: 'evt-d1',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Contradictory intra-proposal actions',
      actions: [
        { type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { trust: 80 } } },
        { type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { trust: 20 } } }
      ],
      verifiedClaims: [c1, c2]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const hyeonGongAfter = snapAfter.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong');

    // Both pass validator sequentially, Action 2 clobbers Action 1 in the same turn commit
    const clobbered = commitRes.success && hyeonGongAfter?.trust === 20;

    results.push({
      testId: 'TEST-D1-INTRA-PROPOSAL-CONTRADICTION',
      category: 'INTRA_PROPOSAL_PIPELINE',
      targetVector: 'Intra-Proposal Action Atomicity',
      description: 'Single proposal containing contradictory actions on same entity/attribute with both claims admitted',
      verdict: clobbered ? 'EXPLOITED' : 'DEFENDED',
      vulnerabilityDiscovered: clobbered,
      pipelineStage: 'Virtual Draft Sequential Execution',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: hyeonGongAfter },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      exploitDetails: clobbered ? 'WARNING: Single proposal with contradictory mutations sequentially overwrites without intra-proposal conflict rejection.' : undefined,
      callGraphTrace: 'EngineValidator -> applies Action 1 (trust=80) -> applies Action 2 (trust=20) -> Sequential Commit'
    });
  }

  // Test D2: Intra-Proposal Draft Entity Modification (ADD_NPC -> UPDATE_NPC in same proposal)
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const ev: ExternalEvidence = { evidenceId: 'ev-new-npc', entityId: 'npc-brand-new', attribute: 'trust', value: 90, source: 'S' };
    const claim = ImmigrationGate.admit({ rawText: 'new', targetEntityId: 'npc-brand-new', targetAttribute: 'trust', claimedValue: 90, claimedEvidenceIds: ['ev-new-npc'] }, [ev], snapBefore).verifiedClaim!;

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-d2',
      requestId: 'req-d2',
      eventId: 'evt-d2',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'ADD_NPC then UPDATE_NPC in same proposal',
      actions: [
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-brand-new', name: '신규 도사', status: 'ALIVE', role: 'Novice', trust: 50, affinity: 50 } as any
        },
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-brand-new', changes: { trust: 90 } }
        }
      ],
      verifiedClaims: [claim]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const defended = !commitRes.success && valRes.rejectedReasons.some(r => r.includes('PROVENANCE_VIOLATION'));

    results.push({
      testId: 'TEST-D2-INTRA-PROPOSAL-DRAFT-PROVENANCE',
      category: 'INTRA_PROPOSAL_PIPELINE',
      targetVector: 'Draft Provenance Boundary',
      description: 'Attempt to ADD an NPC and UPDATE it in the same proposal before prior canonical commit',
      verdict: defended ? 'DEFENDED' : 'EXPLOITED',
      vulnerabilityDiscovered: !defended,
      pipelineStage: 'EngineValidator PROVENANCE_VIOLATION',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: null },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: snapAfter.worldInfo.npcs.find(n => n.id === 'npc-brand-new') },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'EngineValidator.UPDATE_NPC -> canonicalNpc not in currentState -> PROVENANCE_VIOLATION -> Blocked'
    });
  }

  // =========================================================================
  // CATEGORY E: POST-COMMIT REPLAY & TEMPORAL LIFECYCLE
  // =========================================================================

  // Test E1: Same-Turn Claim Replay (Turn 1 Commit -> Replay in Proposal 2)
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snap0 = engine.getSnapshot();
    const ev: ExternalEvidence = { evidenceId: 'ev-e1', entityId: 'npc-hyeon-gong', attribute: 'trust', value: 80, source: 'S' };
    const claim = ImmigrationGate.admit({ rawText: 't80', targetEntityId: 'npc-hyeon-gong', targetAttribute: 'trust', claimedValue: 80, claimedEvidenceIds: ['ev-e1'] }, [ev], snap0).verifiedClaim!;

    // Proposal 1: Normal commit
    const prop1: StateTransitionProposal = {
      proposalId: 'prop-e1-1',
      requestId: 'req-e1-1',
      eventId: 'evt-e1-1',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'First commit',
      actions: [{ type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { trust: 80 } } }],
      verifiedClaims: [claim]
    };
    const res1 = engine.submitProposal(prop1);

    // Intermediate state mutation
    const snap1 = engine.getSnapshot();

    // Proposal 2: Hostile replay of identical claim with fresh requestId/eventId
    const prop2: StateTransitionProposal = {
      proposalId: 'prop-e1-2',
      requestId: 'req-e1-2',
      eventId: 'evt-e1-2',
      expectedStateVersion: snap1.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Replayed commit with same claim',
      actions: [{ type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { trust: 80 } } }],
      verifiedClaims: [claim]
    };
    const res2 = engine.submitProposal(prop2);
    const snap2 = engine.getSnapshot();

    const exploited = res1.success && res2.success;

    results.push({
      testId: 'TEST-E1-SAME-TURN-POST-COMMIT-REPLAY',
      category: 'POST_COMMIT_TEMPORAL_LIFECYCLE',
      targetVector: 'Single-Use Authority Consumption',
      description: 'Attempt to reuse the identical VerifiedClaim object in a second proposal after successful commit',
      verdict: exploited ? 'EXPLOITED' : 'DEFENDED',
      vulnerabilityDiscovered: exploited,
      pipelineStage: 'Sovereign Commit Gate (Claim Consumption)',
      stateBefore: { stateVersion: snap0.stateVersion, turn: snap0.turn, targetEntitySummary: snap0.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateAfter: { stateVersion: snap2.stateVersion, turn: snap2.turn, targetEntitySummary: snap2.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateMutated: snap2.stateVersion > snap1.stateVersion,
      stateVersionDelta: snap2.stateVersion - snap0.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: EngineValidator.validate(prop2, snap1, new Set(), new Set(), engine.getHistory()),
      commitResult: { success: res2.success, committedActionsCount: res2.committedActionsCount },
      exploitDetails: exploited ? 'CONFIRMED BREAK: VerifiedClaim is not revoked or consumed upon commit; replaying the in-memory object in subsequent proposals succeeds.' : undefined,
      callGraphTrace: 'ImmigrationGate.admit -> Proposal 1 Commit -> Proposal 2 submitProposal(same claim) -> Commit Succeeded'
    });
  }

  // Test E2: Stale Claim at Future Turn (Turn 1 Claim Replayed at Turn 5)
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snap0 = engine.getSnapshot();
    const ev: ExternalEvidence = { evidenceId: 'ev-e2', entityId: 'faction-shaolin', attribute: 'influence', value: 40, source: 'T1' };
    const claimT1 = ImmigrationGate.admit({ rawText: 'inf40', targetEntityId: 'faction-shaolin', targetAttribute: 'influence', claimedValue: 40, claimedEvidenceIds: ['ev-e2'] }, [ev], snap0).verifiedClaim!;

    // Turn 1 Commit
    engine.submitProposal({
      proposalId: 'prop-t1',
      requestId: 'req-t1',
      eventId: 'evt-t1',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Turn 1 commit',
      actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 40 } } }],
      verifiedClaims: [claimT1]
    });

    // Advance turns 2, 3, 4 with system actions
    for (let t = 2; t <= 4; t++) {
      const snap = engine.getSnapshot();
      engine.submitProposal({
        proposalId: `prop-t${t}`,
        requestId: `req-t${t}`,
        eventId: `evt-t${t}`,
        expectedStateVersion: snap.stateVersion,
        source: 'PLAYER',
        turn: t,
        timestamp: new Date().toISOString(),
        intentSummary: `Turn ${t} advance`,
        actions: [{ type: 'SET_WORLD_METADATA', payload: { settingDescription: `Turn ${t} state` } }]
      });
    }

    const snap4 = engine.getSnapshot();

    // Turn 5: Hostile replay of Turn 1 claim
    const prop5: StateTransitionProposal = {
      proposalId: 'prop-t5-replay',
      requestId: 'req-t5-replay',
      eventId: 'evt-t5-replay',
      expectedStateVersion: snap4.stateVersion,
      source: 'LLM',
      turn: 5,
      timestamp: new Date().toISOString(),
      intentSummary: 'Replay Turn 1 claim at Turn 5',
      actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 40 } } }],
      verifiedClaims: [claimT1]
    };

    const valRes = EngineValidator.validate(prop5, snap4, new Set(), new Set(), engine.getHistory());
    const res5 = engine.submitProposal(prop5);
    const snap5 = engine.getSnapshot();

    const exploited = res5.success;

    results.push({
      testId: 'TEST-E2-STALE-CLAIM-FUTURE-TURN-REPLAY',
      category: 'POST_COMMIT_TEMPORAL_LIFECYCLE',
      targetVector: 'Turn Boundary Temporal Decoupling',
      description: 'Replay a Turn 1 VerifiedClaim (verifiedAtTurn: 1) in a Turn 5 proposal',
      verdict: exploited ? 'EXPLOITED' : 'DEFENDED',
      vulnerabilityDiscovered: exploited,
      pipelineStage: 'EngineValidator hasMatchingVerifiedClaim (Turn Check)',
      stateBefore: { stateVersion: snap4.stateVersion, turn: snap4.turn, targetEntitySummary: snap4.worldInfo.factions.find(f => f.id === 'faction-shaolin') },
      stateAfter: { stateVersion: snap5.stateVersion, turn: snap5.turn, targetEntitySummary: snap5.worldInfo.factions.find(f => f.id === 'faction-shaolin') },
      stateMutated: snap5.stateVersion > snap4.stateVersion,
      stateVersionDelta: snap5.stateVersion - snap4.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: res5.success, committedActionsCount: res5.committedActionsCount },
      exploitDetails: exploited ? 'CONFIRMED BREAK: hasMatchingVerifiedClaim does not validate c.verifiedAtTurn === proposal.turn; Turn 1 claim committed at Turn 5.' : undefined,
      callGraphTrace: 'EngineValidator.hasMatchingVerifiedClaim -> Ignores c.verifiedAtTurn -> Commit Succeeded'
    });
  }

  // Test E3: Historical State Reversal (Turn 1 claim used in Turn 3 to overwrite Turn 2 decline)
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snap0 = engine.getSnapshot();
    const ev: ExternalEvidence = { evidenceId: 'ev-t1-inf35', entityId: 'faction-shaolin', attribute: 'influence', value: 35, source: 'T1' };
    const claimT1 = ImmigrationGate.admit({ rawText: 'inf35', targetEntityId: 'faction-shaolin', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-t1-inf35'] }, [ev], snap0).verifiedClaim!;

    // Turn 1: Shaolin influence -> 35
    engine.submitProposal({
      proposalId: 'prop-rev-t1',
      requestId: 'req-rev-t1',
      eventId: 'evt-rev-t1',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Turn 1 Shaolin influence to 35',
      actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 35 } } }],
      verifiedClaims: [claimT1]
    });

    // Turn 2: Shaolin suffers defeat, influence reduced to 10 by Player action
    const snap1 = engine.getSnapshot();
    engine.submitProposal({
      proposalId: 'prop-rev-t2',
      requestId: 'req-rev-t2',
      eventId: 'evt-rev-t2',
      expectedStateVersion: snap1.stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Turn 2 Shaolin defeated, influence drops to 10',
      actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 10 } } }]
    });

    const snap2 = engine.getSnapshot();

    // Turn 3: Hostile actor uses Turn 1 Claim (influence=35) to reverse canonical defeat without new evidence
    const prop3: StateTransitionProposal = {
      proposalId: 'prop-rev-t3',
      requestId: 'req-rev-t3',
      eventId: 'evt-rev-t3',
      expectedStateVersion: snap2.stateVersion,
      source: 'LLM',
      turn: 3,
      timestamp: new Date().toISOString(),
      intentSummary: 'Replay Turn 1 claim to reverse Turn 2 defeat',
      actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 35 } } }],
      verifiedClaims: [claimT1]
    };

    const valRes = EngineValidator.validate(prop3, snap2, new Set(), new Set(), engine.getHistory());
    const res3 = engine.submitProposal(prop3);
    const snap3 = engine.getSnapshot();
    const shaolinAfter = snap3.worldInfo.factions.find(f => f.id === 'faction-shaolin');

    const exploited = res3.success && shaolinAfter?.influence === 35;

    results.push({
      testId: 'TEST-E3-HISTORICAL-STATE-REVERSAL-EXPLOIT',
      category: 'POST_COMMIT_TEMPORAL_LIFECYCLE',
      targetVector: 'Historical State Reversal',
      description: 'Replay Turn 1 claim (infl=35) at Turn 3 to overwrite Turn 2 decline (infl=10) back to 35 without fresh evidence',
      verdict: exploited ? 'EXPLOITED' : 'DEFENDED',
      vulnerabilityDiscovered: exploited,
      pipelineStage: 'EngineValidator / Sovereign Commit',
      stateBefore: { stateVersion: snap2.stateVersion, turn: snap2.turn, targetEntitySummary: snap2.worldInfo.factions.find(f => f.id === 'faction-shaolin') },
      stateAfter: { stateVersion: snap3.stateVersion, turn: snap3.turn, targetEntitySummary: shaolinAfter },
      stateMutated: snap3.stateVersion > snap2.stateVersion,
      stateVersionDelta: snap3.stateVersion - snap2.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: res3.success, committedActionsCount: res3.committedActionsCount },
      exploitDetails: exploited ? 'CONFIRMED BREAK: Replaying historical claim reversed genuine Turn 2 defeat back to 35 without fresh grounding.' : undefined,
      callGraphTrace: 'Turn 1 Commit(35) -> Turn 2 Defeat(10) -> Turn 3 Replay Claim(35) -> State Reversed to 35'
    });
  }

  // =========================================================================
  // CATEGORY F: CROSS-AUTHORITY & SCOPE BLEEDING
  // =========================================================================

  // Test F1: Cross-Entity Transference (Shaolin claim -> Wudang mutation)
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const ev: ExternalEvidence = { evidenceId: 'ev-f1', entityId: 'faction-shaolin', attribute: 'influence', value: 35, source: 'S' };
    const claim = ImmigrationGate.admit({ rawText: 'inf35', targetEntityId: 'faction-shaolin', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-f1'] }, [ev], snapBefore).verifiedClaim!;

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-f1',
      requestId: 'req-f1',
      eventId: 'evt-f1',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Apply Shaolin claim to Wudang',
      actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-wudang', changes: { influence: 35 } } }],
      verifiedClaims: [claim]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const defended = !commitRes.success && valRes.rejectedReasons.some(r => r.includes('CLAIM_AUTHORITY_VIOLATION'));

    results.push({
      testId: 'TEST-F1-CROSS-ENTITY-CLAIM-HIJACKING',
      category: 'CROSS_AUTHORITY_BLEEDING',
      targetVector: 'Entity Boundary Validation',
      description: 'Attempt to use a claim issued for Shaolin to authorize mutation on Wudang',
      verdict: defended ? 'DEFENDED' : 'EXPLOITED',
      vulnerabilityDiscovered: !defended,
      pipelineStage: 'EngineValidator hasMatchingVerifiedClaim (Entity Check)',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.factions.find(f => f.id === 'faction-wudang') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: snapAfter.worldInfo.factions.find(f => f.id === 'faction-wudang') },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'EngineValidator.hasMatchingVerifiedClaim -> entityId !== targetEntityId -> Blocked'
    });
  }

  // Test F2: Cross-Attribute Transference (influence claim -> hostility mutation)
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapBefore = engine.getSnapshot();
    const ev: ExternalEvidence = { evidenceId: 'ev-f2', entityId: 'faction-shaolin', attribute: 'influence', value: 35, source: 'S' };
    const claim = ImmigrationGate.admit({ rawText: 'inf35', targetEntityId: 'faction-shaolin', targetAttribute: 'influence', claimedValue: 35, claimedEvidenceIds: ['ev-f2'] }, [ev], snapBefore).verifiedClaim!;

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-f2',
      requestId: 'req-f2',
      eventId: 'evt-f2',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Apply influence claim to hostility attribute',
      actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { hostility: 35 } } }],
      verifiedClaims: [claim]
    };

    const valRes = EngineValidator.validate(proposal, snapBefore, new Set(), new Set(), engine.getHistory());
    const commitRes = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();

    const defended = !commitRes.success && valRes.rejectedReasons.some(r => r.includes('CLAIM_AUTHORITY_VIOLATION'));

    results.push({
      testId: 'TEST-F2-CROSS-ATTRIBUTE-CLAIM-HIJACKING',
      category: 'CROSS_AUTHORITY_BLEEDING',
      targetVector: 'Attribute Boundary Validation',
      description: 'Attempt to use an influence claim to authorize a hostility attribute mutation',
      verdict: defended ? 'DEFENDED' : 'EXPLOITED',
      vulnerabilityDiscovered: !defended,
      pipelineStage: 'EngineValidator hasMatchingVerifiedClaim (Attribute Check)',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapBefore.worldInfo.factions.find(f => f.id === 'faction-shaolin') },
      stateAfter: { stateVersion: snapAfter.stateVersion, turn: snapAfter.turn, targetEntitySummary: snapAfter.worldInfo.factions.find(f => f.id === 'faction-shaolin') },
      stateMutated: snapAfter.stateVersion > snapBefore.stateVersion,
      stateVersionDelta: snapAfter.stateVersion - snapBefore.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: valRes,
      commitResult: { success: commitRes.success, committedActionsCount: commitRes.committedActionsCount },
      callGraphTrace: 'EngineValidator.hasMatchingVerifiedClaim -> targetAttribute !== attribute -> Blocked'
    });
  }

  // Test F3: Cross-Instance WeakSet Leakage
  {
    const engineA = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapA = engineA.getSnapshot();
    const ev: ExternalEvidence = { evidenceId: 'ev-inst-leak', entityId: 'npc-hyeon-gong', attribute: 'trust', value: 88, source: 'S' };
    const claimA = ImmigrationGate.admit({ rawText: 'trust88', targetEntityId: 'npc-hyeon-gong', targetAttribute: 'trust', claimedValue: 88, claimedEvidenceIds: ['ev-inst-leak'] }, [ev], snapA).verifiedClaim!;

    // Create completely isolated Engine B
    const engineB = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snapB = engineB.getSnapshot();

    const proposalB: StateTransitionProposal = {
      proposalId: 'prop-b-leak',
      requestId: 'req-b-leak',
      eventId: 'evt-b-leak',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Submit claim admitted on Engine A to Engine B',
      actions: [{ type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { trust: 88 } } }],
      verifiedClaims: [claimA]
    };

    const resB = engineB.submitProposal(proposalB);
    const snapBAfter = engineB.getSnapshot();

    const exploited = resB.success;

    results.push({
      testId: 'TEST-F3-CROSS-ENGINE-INSTANCE-WEAKSET-BLEED',
      category: 'CROSS_AUTHORITY_BLEEDING',
      targetVector: 'Module Scope WeakSet Singleton',
      description: 'Submit a VerifiedClaim issued on Engine Instance A into an independent Engine Instance B',
      verdict: exploited ? 'EXPLOITED' : 'DEFENDED',
      vulnerabilityDiscovered: exploited,
      pipelineStage: 'ImmigrationGate Module-level ISSUED_VERIFIED_CLAIMS WeakSet',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: snapB.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateAfter: { stateVersion: snapBAfter.stateVersion, turn: snapBAfter.turn, targetEntitySummary: snapBAfter.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateMutated: snapBAfter.stateVersion > snapB.stateVersion,
      stateVersionDelta: snapBAfter.stateVersion - snapB.stateVersion,
      historyCountDelta: engineB.getHistory().length,
      validatorVerdict: EngineValidator.validate(proposalB, snapB, new Set(), new Set(), engineB.getHistory()),
      commitResult: { success: resB.success, committedActionsCount: resB.committedActionsCount },
      exploitDetails: exploited ? 'CONFIRMED BREAK: ISSUED_VERIFIED_CLAIMS WeakSet is module-scoped, allowing claims to cross engine session boundaries.' : undefined,
      callGraphTrace: 'Engine A admit -> ISSUED_VERIFIED_CLAIMS.add -> Engine B submitProposal -> WeakSet.has(claimA) === true -> Commit'
    });
  }

  // =========================================================================
  // CATEGORY G: FAILURE PATH AUTHORITY RETENTION
  // =========================================================================

  // Test G1: Post-Rejection Retry (Proposal rejected due to secondary invalid action -> Claim reused in clean retry)
  {
    const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter(), [], 1, 1);
    const snap0 = engine.getSnapshot();
    const ev: ExternalEvidence = { evidenceId: 'ev-g1', entityId: 'npc-hyeon-gong', attribute: 'trust', value: 85, source: 'S' };
    const claim = ImmigrationGate.admit({ rawText: 'trust85', targetEntityId: 'npc-hyeon-gong', targetAttribute: 'trust', claimedValue: 85, claimedEvidenceIds: ['ev-g1'] }, [ev], snap0).verifiedClaim!;

    // Proposal 1: Has valid action with claim + poisoned action (mutate DEAD NPC)
    const prop1: StateTransitionProposal = {
      proposalId: 'prop-g1-fail',
      requestId: 'req-g1-fail',
      eventId: 'evt-g1-fail',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Poisoned proposal',
      actions: [
        { type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { trust: 85 } } },
        { type: 'SET_NPC_STATUS', payload: { id: 'npc-dead-elder', status: 'ALIVE' } }
      ],
      verifiedClaims: [claim]
    };
    const res1 = engine.submitProposal(prop1);

    // Proposal 2: Clean retry with same claim
    const prop2: StateTransitionProposal = {
      proposalId: 'prop-g1-clean',
      requestId: 'req-g1-clean',
      eventId: 'evt-g1-clean',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Clean retry',
      actions: [
        { type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { trust: 85 } } }
      ],
      verifiedClaims: [claim]
    };
    const res2 = engine.submitProposal(prop2);
    const snapFinal = engine.getSnapshot();
    const hyeonGong = snapFinal.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong');

    const expected = !res1.success && res2.success && hyeonGong?.trust === 85;

    results.push({
      testId: 'TEST-G1-POST-REJECTION-RETRY-RESILIENCE',
      category: 'FAILURE_PATH_RETENTION',
      targetVector: 'Post-Rejection Claim Availability',
      description: 'Verify claim remains available for clean retry after previous proposal was rejected',
      verdict: expected ? 'EXPECTED_BEHAVIOR' : 'EXPLOITED',
      vulnerabilityDiscovered: false,
      pipelineStage: 'EngineValidator & Commit Gate',
      stateBefore: { stateVersion: snap0.stateVersion, turn: snap0.turn, targetEntitySummary: snap0.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong') },
      stateAfter: { stateVersion: snapFinal.stateVersion, turn: snapFinal.turn, targetEntitySummary: hyeonGong },
      stateMutated: snapFinal.stateVersion > snap0.stateVersion,
      stateVersionDelta: snapFinal.stateVersion - snap0.stateVersion,
      historyCountDelta: engine.getHistory().length,
      validatorVerdict: EngineValidator.validate(prop2, snap0, new Set(), new Set(), engine.getHistory()),
      commitResult: { success: res2.success, committedActionsCount: res2.committedActionsCount },
      callGraphTrace: 'Proposal 1 Rejected -> Claim retained in WeakSet -> Proposal 2 Retry -> Commit Succeeded'
    });
  }

  // Test G2: MutationBoundary Semantic Subset Check
  {
    const candProposal: StateTransitionProposal = {
      proposalId: 'cand-prop',
      requestId: 'req-cand',
      eventId: 'evt-cand',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Candidate proposal',
      actions: [
        { type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { trust: 80 } } }
      ]
    };

    const finalProposalTampered: StateTransitionProposal = {
      proposalId: 'final-prop',
      requestId: 'req-final',
      eventId: 'evt-final',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Final proposal with tampered value',
      actions: [
        { type: 'UPDATE_NPC', payload: { id: 'npc-hyeon-gong', changes: { trust: 99 } } }
      ]
    };

    const boundaryCheck = validateLLM2MutationBoundary(candProposal, finalProposalTampered);
    const defended = !boundaryCheck.isValid && boundaryCheck.violationReasons.some(r => r.includes('MUTATION_BOUNDARY_VIOLATION'));

    results.push({
      testId: 'TEST-G2-MUTATION-BOUNDARY-TAMPER-BLOCK',
      category: 'MUTATION_BOUNDARY_CONTRACT',
      targetVector: 'LLM#2 Mutation Boundary Enforcement',
      description: 'Validate that LLM#2 final proposal value inflation (trust=99 vs candidate trust=80) is strictly blocked by boundary',
      verdict: defended ? 'DEFENDED' : 'EXPLOITED',
      vulnerabilityDiscovered: !defended,
      pipelineStage: 'validateLLM2MutationBoundary',
      stateBefore: { stateVersion: 1, turn: 1, targetEntitySummary: null },
      stateAfter: { stateVersion: 1, turn: 1, targetEntitySummary: null },
      stateMutated: false,
      stateVersionDelta: 0,
      historyCountDelta: 0,
      validatorVerdict: { isValid: false, rejectedReasons: [], conflictDetails: [] },
      commitResult: { success: false, committedActionsCount: 0 },
      boundaryCheckResult: boundaryCheck,
      callGraphTrace: 'validateLLM2MutationBoundary -> isActionSemanticSubset -> Value Mismatch -> MUTATION_BOUNDARY_VIOLATION'
    });
  }

  const total = results.length;
  const defended = results.filter(r => r.verdict === 'DEFENDED').length;
  const exploited = results.filter(r => r.verdict === 'EXPLOITED').length;
  const expectedBehavior = results.filter(r => r.verdict === 'EXPECTED_BEHAVIOR').length;

  return {
    total,
    defended,
    exploited,
    expectedBehavior,
    results
  };
}

export function executeAndExportForensics(): void {
  console.log('=== STARTING VEIL CLAIM CAUSALITY RUNTIME FORENSICS ===');
  const suiteResult = runFullClaimCausalityForensicsSuite();

  const reportDir = path.join(process.cwd(), 'report', '14_veil_claim_causality_runtime_forensics');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const rawEvidencePath = path.join(reportDir, 'raw_evidence.json');
  fs.writeFileSync(rawEvidencePath, JSON.stringify(suiteResult, null, 2), 'utf-8');

  console.log(`[FORENSICS COMPLETE] Total: ${suiteResult.total} | Defended: ${suiteResult.defended} | Exploited: ${suiteResult.exploited} | Expected: ${suiteResult.expectedBehavior}`);
  console.log(`Raw evidence written to: ${rawEvidencePath}`);
}
