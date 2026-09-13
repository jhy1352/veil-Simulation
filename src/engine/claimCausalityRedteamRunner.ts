import { SovereignEngine } from './state';
import { ImmigrationGate } from './immigrationGate';
import { EngineValidator } from './validator';
import { dispatchEngineInternalProposal } from './internalCapability';
import {
  StateTransitionProposal,
  ExternalEvidence,
  UntrustedClaim,
  VerifiedClaim,
  CanonicalState
} from './types';
import { createEmptyWorldInfo, createEmptyCharacter } from '../utils/factory';
import { WorldInfo, Character } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface RedteamTestResult {
  testId: string;
  chain: string;
  targetVector: string;
  description: string;
  attackHypothesis: string;
  isBaselineCheck: boolean;
  verdict: 'DEFENDED' | 'EXPLOITED' | 'EXPECTED_BEHAVIOR';
  vulnerabilityDiscovered: boolean;
  pipelineStage: string;
  stateBefore: {
    stateVersion: number;
    turn: number;
    targetSummary: any;
  };
  proposalSummary: {
    requestId: string;
    eventId: string;
    source: string;
    actionTypes: string[];
    verifiedClaimsCount: number;
    claimSummaries: any[];
  };
  validatorVerdict: {
    isValid: boolean;
    rejectedReasons: readonly string[];
    conflictDetails: readonly string[];
  };
  commitResult: {
    success: boolean;
    committedActionsCount: number;
    rejectedReasons: readonly string[];
  };
  stateAfter: {
    stateVersion: number;
    turn: number;
    targetSummary: any;
  };
  stateMutated: boolean;
  stateVersionDelta: number;
  historyCountDelta: number;
  canonicalDiff: any;
  forensicProof: string;
}

function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
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
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!isDeepEqual(a[k], b[k])) return false;
  }
  return true;
}

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

export function executeRedTeamCampaign(): {
  total: number;
  defended: number;
  exploited: number;
  expectedBehavior: number;
  results: RedteamTestResult[];
} {
  const results: RedteamTestResult[] = [];

  function getTs(offsetSeconds = 1): string {
    return new Date(Date.now() + offsetSeconds * 1000).toISOString();
  }

  function runAttack(params: {
    testId: string;
    chain: string;
    targetVector: string;
    description: string;
    attackHypothesis: string;
    isBaselineCheck: boolean;
    setup: () => {
      engine: SovereignEngine;
      proposal: StateTransitionProposal;
      targetExtractor: (state: CanonicalState) => any;
    };
  }) {
    const { engine, proposal, targetExtractor } = params.setup();
    const snapshotBefore = engine.getSnapshot();
    const targetBefore = targetExtractor(snapshotBefore);
    const historyBeforeCount = engine.getHistory().length;

    // Run direct validator verdict check for forensics
    const executedReqs = new Set<string>();
    const recordedEvents = new Set<string>();
    if (snapshotBefore.lastCommittedEventId) recordedEvents.add(snapshotBefore.lastCommittedEventId);
    const validatorVerdict = EngineValidator.validate(
      proposal,
      snapshotBefore,
      executedReqs,
      recordedEvents,
      engine.getHistory()
    );

    // Commit through Sovereign Engine Gate
    const commitResult = engine.submitProposal(proposal);
    const snapshotAfter = engine.getSnapshot();
    const targetAfter = targetExtractor(snapshotAfter);
    const historyAfterCount = engine.getHistory().length;

    const stateMutated = !isDeepEqual(snapshotBefore, snapshotAfter);
    const stateVersionDelta = snapshotAfter.stateVersion - snapshotBefore.stateVersion;
    const historyCountDelta = historyAfterCount - historyBeforeCount;

    let verdict: 'DEFENDED' | 'EXPLOITED' | 'EXPECTED_BEHAVIOR';
    let vulnerabilityDiscovered = false;

    if (params.isBaselineCheck) {
      if (commitResult.success && stateMutated) {
        verdict = 'EXPECTED_BEHAVIOR';
        vulnerabilityDiscovered = false;
      } else {
        verdict = 'DEFENDED';
        vulnerabilityDiscovered = false;
      }
    } else {
      if (commitResult.success && stateMutated) {
        verdict = 'EXPLOITED';
        vulnerabilityDiscovered = true;
      } else {
        verdict = 'DEFENDED';
        vulnerabilityDiscovered = false;
      }
    }

    const testRes: RedteamTestResult = {
      testId: params.testId,
      chain: params.chain,
      targetVector: params.targetVector,
      description: params.description,
      attackHypothesis: params.attackHypothesis,
      isBaselineCheck: params.isBaselineCheck,
      verdict,
      vulnerabilityDiscovered,
      pipelineStage: commitResult.success ? 'CANONICAL_COMMIT_GATE' : 'ENGINE_VALIDATOR',
      stateBefore: {
        stateVersion: snapshotBefore.stateVersion,
        turn: snapshotBefore.turn,
        targetSummary: targetBefore
      },
      proposalSummary: {
        requestId: proposal.requestId,
        eventId: proposal.eventId,
        source: proposal.source,
        actionTypes: proposal.actions ? proposal.actions.map(a => a.type) : [],
        verifiedClaimsCount: proposal.verifiedClaims?.length || 0,
        claimSummaries: (proposal.verifiedClaims || []).map(c => ({
          claimId: c.claimId,
          targetEntityId: c.targetEntityId,
          targetAttribute: c.targetAttribute,
          verifiedValue: c.verifiedValue,
          confidence: c.confidence
        }))
      },
      validatorVerdict: {
        isValid: validatorVerdict.isValid,
        rejectedReasons: validatorVerdict.rejectedReasons,
        conflictDetails: validatorVerdict.conflictDetails
      },
      commitResult: {
        success: commitResult.success,
        committedActionsCount: commitResult.committedActionsCount,
        rejectedReasons: commitResult.rejectedReasons
      },
      stateAfter: {
        stateVersion: snapshotAfter.stateVersion,
        turn: snapshotAfter.turn,
        targetSummary: targetAfter
      },
      stateMutated,
      stateVersionDelta,
      historyCountDelta,
      canonicalDiff: {
        before: targetBefore,
        after: targetAfter,
        changed: !isDeepEqual(targetBefore, targetAfter)
      },
      forensicProof: commitResult.success
        ? `SUCCESSFUL_CANONICAL_COMMIT: stateVersion progressed ${snapshotBefore.stateVersion} -> ${snapshotAfter.stateVersion}, target state mutated: ${JSON.stringify(targetAfter)}`
        : `DEFENDED_REJECTION: ${commitResult.rejectedReasons.join('; ')}`
    };

    results.push(testRes);
  }

  // =========================================================================
  // CHAIN A: CLAIM -> DERIVED MUTATION & WILDCARD AUTHORITY ESCALATION
  // =========================================================================

  // A1: Baseline Exact Grounded Claim
  runAttack({
    testId: 'RED-A1-BASELINE-EXACT-GROUNDED-COMMIT',
    chain: 'CHAIN_A_WILDCARD_ESCALATION',
    targetVector: 'UPDATE_NPC_EXACT_CLAIM',
    description: 'Verifies that a legitimate exact claim with matching value commits normally.',
    attackHypothesis: 'Legitimate admission pipeline should succeed and commit state changes.',
    isBaselineCheck: true,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-a1',
        entityId: 'npc-hyeon-gong',
        entityType: 'NPC',
        attribute: 'trust',
        value: 80,
        source: 'QUEST_RECORD'
      };
      const untrusted: UntrustedClaim = {
        rawText: '현공 방장의 신뢰도가 80으로 상승했다.',
        targetEntityId: 'npc-hyeon-gong',
        targetAttribute: 'trust',
        claimedValue: 80,
        claimedEvidenceIds: ['ev-a1']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;
      const proposal: StateTransitionProposal = {
        proposalId: 'prop-a1',
        requestId: 'req-a1',
        eventId: 'ev-a1-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-hyeon-gong',
              changes: { trust: 80 }
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong')
      };
    }
  });

  // A2: NPC EXISTENCE Claim -> Arbitrary Multi-Attribute Escalation
  runAttack({
    testId: 'RED-A2-NPC-EXISTENCE-WILDCARD-ESCALATION',
    chain: 'CHAIN_A_WILDCARD_ESCALATION',
    targetVector: 'UPDATE_NPC_EXISTENCE_WILDCARD',
    description: 'Admit EXISTENCE claim for NPC, then attempt to mutate trust to 99 and role to Grand Emperor.',
    attackHypothesis: 'EXISTENCE wildcard in validator allows unverified attribute mutations to bypass grounding and commit.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-a2',
        entityId: 'npc-hyeon-gong',
        entityType: 'NPC',
        attribute: 'EXISTENCE',
        value: true,
        source: 'CENSUS'
      };
      const untrusted: UntrustedClaim = {
        rawText: '현공 방장이 사원에 존재한다.',
        targetEntityId: 'npc-hyeon-gong',
        targetAttribute: 'EXISTENCE',
        claimedValue: true,
        claimedEvidenceIds: ['ev-a2']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;
      const proposal: StateTransitionProposal = {
        proposalId: 'prop-a2',
        requestId: 'req-a2',
        eventId: 'ev-a2-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-hyeon-gong',
              changes: { trust: 99, role: 'Grand Emperor' }
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong')
      };
    }
  });

  // A3: Faction EXISTENCE Claim -> Arbitrary Influence Escalation
  runAttack({
    testId: 'RED-A3-FACTION-EXISTENCE-WILDCARD-ESCALATION',
    chain: 'CHAIN_A_WILDCARD_ESCALATION',
    targetVector: 'UPDATE_FACTION_EXISTENCE_WILDCARD',
    description: 'Admit EXISTENCE claim for Faction, then attempt to mutate influence to 45 and description.',
    attackHypothesis: 'Faction EXISTENCE wildcard allows ungrounded influence mutation to commit.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-a3',
        entityId: 'faction-shaolin',
        entityType: 'FACTION',
        attribute: 'EXISTENCE',
        value: true,
        source: 'MAP'
      };
      const untrusted: UntrustedClaim = {
        rawText: '소림사가 무림에 실존한다.',
        targetEntityId: 'faction-shaolin',
        targetAttribute: 'EXISTENCE',
        claimedValue: true,
        claimedEvidenceIds: ['ev-a3']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;
      const proposal: StateTransitionProposal = {
        proposalId: 'prop-a3',
        requestId: 'req-a3',
        eventId: 'ev-a3-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_FACTION',
            payload: {
              id: 'faction-shaolin',
              changes: { influence: 45, description: '천하제일문파' }
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.factions.find(f => f.id === 'faction-shaolin')
      };
    }
  });

  // A4: Status SET_NPC_STATUS with EXISTENCE Claim
  runAttack({
    testId: 'RED-A4-STATUS-EXISTENCE-WILDCARD-ESCALATION',
    chain: 'CHAIN_A_WILDCARD_ESCALATION',
    targetVector: 'SET_NPC_STATUS_EXISTENCE_WILDCARD',
    description: 'Admit EXISTENCE claim for NPC, then attempt SET_NPC_STATUS to MISSING without status evidence.',
    attackHypothesis: 'SET_NPC_STATUS accepts EXISTENCE wildcard claim and commits arbitrary status change.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-a4',
        entityId: 'npc-cheong-heo',
        entityType: 'NPC',
        attribute: 'EXISTENCE',
        value: true,
        source: 'TEMPLE_VISIT'
      };
      const untrusted: UntrustedClaim = {
        rawText: '청허 도장이 존재한다.',
        targetEntityId: 'npc-cheong-heo',
        targetAttribute: 'EXISTENCE',
        claimedValue: true,
        claimedEvidenceIds: ['ev-a4']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;
      const proposal: StateTransitionProposal = {
        proposalId: 'prop-a4',
        requestId: 'req-a4',
        eventId: 'ev-a4-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'SET_NPC_STATUS',
            payload: {
              id: 'npc-cheong-heo',
              status: 'MISSING'
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-cheong-heo')
      };
    }
  });

  // A5: Asterisk Wildcard '*' Attribute Claim Escalation
  runAttack({
    testId: 'RED-A5-ASTERISK-WILDCARD-ESCALATION',
    chain: 'CHAIN_A_WILDCARD_ESCALATION',
    targetVector: 'UPDATE_NPC_ASTERISK_WILDCARD',
    description: 'Admit claim with targetAttribute: "*", then mutate affinity and impression.',
    attackHypothesis: 'Asterisk wildcard in validator allows unverified attribute modifications.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-a5',
        entityId: 'npc-hyeon-gong',
        entityType: 'NPC',
        attribute: '*',
        value: 'UNIVERSAL',
        source: 'DIVINE_ORACLE'
      };
      const untrusted: UntrustedClaim = {
        rawText: '모든 속성 허용 와일드카드 증거',
        targetEntityId: 'npc-hyeon-gong',
        targetAttribute: '*',
        claimedValue: 'UNIVERSAL',
        claimedEvidenceIds: ['ev-a5']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;
      const proposal: StateTransitionProposal = {
        proposalId: 'prop-a5',
        requestId: 'req-a5',
        eventId: 'ev-a5-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-hyeon-gong',
              changes: { affinity: 95, impression: 'Devoted' }
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong')
      };
    }
  });

  // =========================================================================
  // CHAIN B: CROSS-ENTITY & IDENTITY CONFUSION / HIJACKING
  // =========================================================================

  // B1: Hijack Claim Issued for Entity A to Mutate Entity B
  runAttack({
    testId: 'RED-B1-CROSS-ENTITY-ID-HIJACK-ATTEMPT',
    chain: 'CHAIN_B_IDENTITY_CONFUSION',
    targetVector: 'CROSS_ENTITY_CLAIM_HIJACK',
    description: 'Use claim issued for npc-hyeon-gong to mutate npc-cheong-heo.',
    attackHypothesis: 'Validator must strictly block claim reuse on differing targetEntityId.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-b1',
        entityId: 'npc-hyeon-gong',
        entityType: 'NPC',
        attribute: 'trust',
        value: 80,
        source: 'TREATISE'
      };
      const untrusted: UntrustedClaim = {
        rawText: '현공 방장의 신뢰도가 80이다.',
        targetEntityId: 'npc-hyeon-gong',
        targetAttribute: 'trust',
        claimedValue: 80,
        claimedEvidenceIds: ['ev-b1']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;
      const proposal: StateTransitionProposal = {
        proposalId: 'prop-b1',
        requestId: 'req-b1',
        eventId: 'ev-b1-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-cheong-heo',
              changes: { trust: 80 }
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-cheong-heo')
      };
    }
  });

  // B2: Target Entity Name Fallback Match (Alternative Entity ID Match)
  runAttack({
    testId: 'RED-B2-ENTITY-NAME-FALLBACK-MATCH',
    chain: 'CHAIN_B_IDENTITY_CONFUSION',
    targetVector: 'ALTERNATIVE_NAME_CLAIM_MATCH',
    description: 'Claim issued with targetEntityId set to NPC Name instead of ID, verifying if alternativeEntityId matches.',
    attackHypothesis: 'Validator matches alternativeEntityId (targetNpc.name), allowing name-based claim binding.',
    isBaselineCheck: true,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-b2',
        entityId: '현공 방장',
        entityType: 'NPC',
        attribute: 'affinity',
        value: 75,
        source: 'LETTER'
      };
      const untrusted: UntrustedClaim = {
        rawText: '현공 방장의 친밀도가 75로 변경되었다.',
        targetEntityId: '현공 방장',
        targetAttribute: 'affinity',
        claimedValue: 75,
        claimedEvidenceIds: ['ev-b2']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;
      const proposal: StateTransitionProposal = {
        proposalId: 'prop-b2',
        requestId: 'req-b2',
        eventId: 'ev-b2-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-hyeon-gong',
              changes: { affinity: 75 }
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong')
      };
    }
  });

  // B3: Dead NPC Revival & Mutation Lock Defense
  runAttack({
    testId: 'RED-B3-DEAD-NPC-MUTATION-LOCK',
    chain: 'CHAIN_B_IDENTITY_CONFUSION',
    targetVector: 'DEAD_NPC_IMMUTABILITY',
    description: 'Attempt to mutate status or trust of dead NPC even with validly admitted claim.',
    attackHypothesis: 'Dead NPC status protection must reject action before claim evaluation.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-b3',
        entityId: 'npc-dead-elder',
        entityType: 'NPC',
        attribute: 'trust',
        value: 100,
        source: 'NECROMANCY_CLAIM'
      };
      const untrusted: UntrustedClaim = {
        rawText: '망자 장로가 부활하여 신뢰도가 100이다.',
        targetEntityId: 'npc-dead-elder',
        targetAttribute: 'trust',
        claimedValue: 100,
        claimedEvidenceIds: ['ev-b3']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;
      const proposal: StateTransitionProposal = {
        proposalId: 'prop-b3',
        requestId: 'req-b3',
        eventId: 'ev-b3-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-dead-elder',
              changes: { trust: 100 }
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-dead-elder')
      };
    }
  });

  // B4: Forged Cloned Claim Object Structure (Not in Gate WeakSet)
  runAttack({
    testId: 'RED-B4-FORGED-CLONED-CLAIM-OBJECT',
    chain: 'CHAIN_B_IDENTITY_CONFUSION',
    targetVector: 'WEAKSET_MEMBERSHIP_FORGERY',
    description: 'Manually construct a VerifiedClaim object with valid signature structure but not registered in ISSUED_VERIFIED_CLAIMS.',
    attackHypothesis: 'WeakSet.has check in ImmigrationGate must reject forged claim objects.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const forgedClaim: VerifiedClaim = Object.freeze({
        claimId: 'forged-claim-999',
        targetEntityId: 'npc-hyeon-gong',
        targetAttribute: 'trust',
        verifiedValue: 90,
        confidence: 0.99,
        verifiedAtTurn: 1,
        evidenceSummary: 'Forged proof',
        gateSignature: 'gate-sig-forged-999',
        admittedAt: getTs(1),
        supportingEvidenceIds: ['ev-forged-999']
      });
      const proposal: StateTransitionProposal = {
        proposalId: 'prop-b4',
        requestId: 'req-b4',
        eventId: 'ev-b4-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-hyeon-gong',
              changes: { trust: 90 }
            }
          }
        ],
        verifiedClaims: [forgedClaim]
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong')
      };
    }
  });

  // B5: Value Mismatch Inflation Attempt (Claim 60 vs Action 99)
  runAttack({
    testId: 'RED-B5-VALUE-MISMATCH-INFLATION',
    chain: 'CHAIN_B_IDENTITY_CONFUSION',
    targetVector: 'CLAIM_VALUE_MISMATCH_REJECTION',
    description: 'Claim issued for trust: 60, but action attempts to commit trust: 99.',
    attackHypothesis: 'Validator enforces deep-equality between claimed verifiedValue and action payload, rejecting mismatch.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-b5',
        entityId: 'npc-hyeon-gong',
        entityType: 'NPC',
        attribute: 'trust',
        value: 60,
        source: 'CONFIRMATION'
      };
      const untrusted: UntrustedClaim = {
        rawText: '현공 방장의 신뢰도가 60이다.',
        targetEntityId: 'npc-hyeon-gong',
        targetAttribute: 'trust',
        claimedValue: 60,
        claimedEvidenceIds: ['ev-b5']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;
      const proposal: StateTransitionProposal = {
        proposalId: 'prop-b5',
        requestId: 'req-b5',
        eventId: 'ev-b5-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-hyeon-gong',
              changes: { trust: 99 } // Value mismatch
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong')
      };
    }
  });

  // =========================================================================
  // CHAIN C: TEMPORAL REPLAY & LIFECYCLE VULNERABILITIES
  // =========================================================================

  // C1: Same-Turn Replay (Reusing admitted claim across 2 successive proposals in same turn)
  runAttack({
    testId: 'RED-C1-SAME-TURN-CLAIM-REPLAY',
    chain: 'CHAIN_C_TEMPORAL_REPLAY',
    targetVector: 'UNCONSUMED_CLAIM_REPLAY_SAME_TURN',
    description: 'Use the same VerifiedClaim in Proposal 1 (commits v=1->2), then replay the exact same claim reference in Proposal 2.',
    attackHypothesis: 'Without claim consumption/invalidation, an admitted claim can be replayed indefinitely in subsequent proposals.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-c1',
        entityId: 'npc-hyeon-gong',
        entityType: 'NPC',
        attribute: 'trust',
        value: 70,
        source: 'REPORT'
      };
      const untrusted: UntrustedClaim = {
        rawText: '현공 방장의 신뢰도가 70으로 변경되었다.',
        targetEntityId: 'npc-hyeon-gong',
        targetAttribute: 'trust',
        claimedValue: 70,
        claimedEvidenceIds: ['ev-c1']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;

      // Execute Proposal 1
      const prop1: StateTransitionProposal = {
        proposalId: 'prop-c1-p1',
        requestId: 'req-c1-p1',
        eventId: 'ev-c1-p1',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-hyeon-gong',
              changes: { trust: 70 }
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      engine.submitProposal(prop1);

      // Proposal 2: Replay the identical verified claim reference (mutating another attribute or re-asserting)
      const prop2: StateTransitionProposal = {
        proposalId: 'prop-c1-p2',
        requestId: 'req-c1-p2',
        eventId: 'ev-c1-p2',
        turn: 1,
        expectedStateVersion: 2,
        timestamp: getTs(2),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-hyeon-gong',
              changes: { trust: 70 }
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal: prop2,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong')
      };
    }
  });

  // C2: Cross-Turn Stale Claim Replay (Turn 1 claim replayed at Turn 5)
  runAttack({
    testId: 'RED-C2-CROSS-TURN-STALE-CLAIM-REPLAY',
    chain: 'CHAIN_C_TEMPORAL_REPLAY',
    targetVector: 'CROSS_TURN_CLAIM_REPLAY',
    description: 'Admit claim at Turn 1. Progress engine turns to Turn 5. Replay Turn 1 claim at Turn 5.',
    attackHypothesis: 'Validator does not check claim.verifiedAtTurn against current proposal turn, allowing temporal replay.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-c2',
        entityId: 'faction-wudang',
        entityType: 'FACTION',
        attribute: 'influence',
        value: 35,
        source: 'EMPEROR_EDICT'
      };
      const untrusted: UntrustedClaim = {
        rawText: '무당파의 영향력이 35이다.',
        targetEntityId: 'faction-wudang',
        targetAttribute: 'influence',
        claimedValue: 35,
        claimedEvidenceIds: ['ev-c2']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;

      // Advance engine to Turn 5 via system actions
      for (let t = 1; t <= 4; t++) {
        dispatchEngineInternalProposal(engine, {
          proposalId: `prop-c2-adv-${t}`,
          requestId: `req-c2-adv-${t}`,
          eventId: `ev-c2-adv-${t}`,
          turn: t + 1,
          expectedStateVersion: t,
          timestamp: getTs(t),
          source: 'SYSTEM',
          intentSummary: 'Advance time',
          actions: [
            {
              type: 'ADVANCE_TIME',
              payload: { targetTime: { year: 100 + t, season: 'SPRING', month: 3, day: 15, timeOfDay: 'NOON' } }
            }
          ]
        });
      }

      const currentSnap = engine.getSnapshot();
      const propTurn5: StateTransitionProposal = {
        proposalId: 'prop-c2-replay-turn5',
        requestId: 'req-c2-replay-turn5',
        eventId: 'ev-c2-replay-turn5',
        turn: currentSnap.turn,
        expectedStateVersion: currentSnap.stateVersion,
        timestamp: getTs(10),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_FACTION',
            payload: {
              id: 'faction-wudang',
              changes: { influence: 35 }
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal: propTurn5,
        targetExtractor: s => s.worldInfo.factions.find(f => f.id === 'faction-wudang')
      };
    }
  });

  // C3: Counter-Factual History Reversal (Reversing battle outcome using old claim)
  runAttack({
    testId: 'RED-C3-COUNTERFACTUAL-HISTORY-REVERSAL',
    chain: 'CHAIN_C_TEMPORAL_REPLAY',
    targetVector: 'HISTORY_REVERSAL_EXPLOIT',
    description: 'Turn 1 claim verified Shaolin influence 35. Turn 2 battle reduced Shaolin influence to 10. Replay Turn 1 claim to erase battle loss.',
    attackHypothesis: 'Replayed historical claim can overwrite canonical battle consequences without fresh evidence.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-c3',
        entityId: 'faction-shaolin',
        entityType: 'FACTION',
        attribute: 'influence',
        value: 35,
        source: 'VICTORY_DISPATCH'
      };
      const untrusted: UntrustedClaim = {
        rawText: '소림사 세력이 35로 번창했다.',
        targetEntityId: 'faction-shaolin',
        targetAttribute: 'influence',
        claimedValue: 35,
        claimedEvidenceIds: ['ev-c3']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const turn1Claim = verdict.verifiedClaim;

      // Turn 1 proposal commits 35 influence
      engine.submitProposal({
        proposalId: 'prop-c3-t1',
        requestId: 'req-c3-t1',
        eventId: 'ev-c3-t1',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 35 } } }],
        verifiedClaims: turn1Claim ? [turn1Claim] : []
      });

      // Turn 2: Major defeat reduces influence to 10
      dispatchEngineInternalProposal(engine, {
        proposalId: 'prop-c3-t2-defeat',
        requestId: 'req-c3-t2-defeat',
        eventId: 'ev-c3-t2-defeat',
        turn: 2,
        expectedStateVersion: 2,
        timestamp: getTs(2),
        source: 'SYSTEM',
        intentSummary: 'Shaolin major defeat in battle',
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 10 } } }]
      });

      // Turn 3: Replay Turn 1 claim to revert defeat back to 35
      const propRevert: StateTransitionProposal = {
        proposalId: 'prop-c3-t3-revert',
        requestId: 'req-c3-t3-revert',
        eventId: 'ev-c3-t3-revert',
        turn: 3,
        expectedStateVersion: 3,
        timestamp: getTs(3),
        source: 'LLM',
        actions: [{ type: 'UPDATE_FACTION', payload: { id: 'faction-shaolin', changes: { influence: 35 } } }],
        verifiedClaims: turn1Claim ? [turn1Claim] : []
      };
      return {
        engine,
        proposal: propRevert,
        targetExtractor: s => s.worldInfo.factions.find(f => f.id === 'faction-shaolin')
      };
    }
  });

  // C4: Stale State Version Proposal Replay
  runAttack({
    testId: 'RED-C4-STALE-STATE-VERSION-REPLAY',
    chain: 'CHAIN_C_TEMPORAL_REPLAY',
    targetVector: 'STALE_STATE_VERSION_REJECTION',
    description: 'Submit proposal with expectedStateVersion: 1 when current sovereign version is 2.',
    attackHypothesis: 'EngineValidator enforces expectedStateVersion === currentState.stateVersion and rejects stale proposals.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      // Progress engine to version 2
      dispatchEngineInternalProposal(engine, {
        proposalId: 'prop-c4-adv',
        requestId: 'req-c4-adv',
        eventId: 'ev-c4-adv',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'SYSTEM',
        intentSummary: 'System rumor registration',
        actions: [{ type: 'ADD_RUMOR', payload: { rumor: '새로운 소문' } }]
      });

      // Now submit stale proposal claiming expectedStateVersion: 1
      const staleProp: StateTransitionProposal = {
        proposalId: 'prop-c4-stale',
        requestId: 'req-c4-stale',
        eventId: 'ev-c4-stale',
        turn: 1,
        expectedStateVersion: 1, // Stale! Current is 2
        timestamp: getTs(2),
        source: 'LLM',
        actions: [{ type: 'ADD_RUMOR', payload: { rumor: '묵은 소문' } }]
      };
      return {
        engine,
        proposal: staleProp,
        targetExtractor: s => s.worldInfo.rumors
      };
    }
  });

  // =========================================================================
  // CHAIN D: INTRA-PROPOSAL CONFLICT & PIPELINE OVERWRITES
  // =========================================================================

  // D1: Intra-Proposal Action Overwrite (Action 1 verified -> Action 2 ungrounded overwrite)
  runAttack({
    testId: 'RED-D1-INTRA-PROPOSAL-CONTRADICTION-OVERWRITE',
    chain: 'CHAIN_D_INTRA_PROPOSAL_PIPELINE',
    targetVector: 'INTRA_PROPOSAL_ACTION_OVERWRITE',
    description: 'Proposal with 2 actions on same NPC: Action 1 trust 80 (has claim), Action 2 trust 20 (no claim for 20).',
    attackHypothesis: 'Validator checks claims for each action. Action 2 should fail claim check if 20 lacks claim.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-d1',
        entityId: 'npc-hyeon-gong',
        entityType: 'NPC',
        attribute: 'trust',
        value: 80,
        source: 'WITNESS'
      };
      const untrusted: UntrustedClaim = {
        rawText: '현공 방장 신뢰도 80',
        targetEntityId: 'npc-hyeon-gong',
        targetAttribute: 'trust',
        claimedValue: 80,
        claimedEvidenceIds: ['ev-d1']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;

      const proposal: StateTransitionProposal = {
        proposalId: 'prop-d1',
        requestId: 'req-d1',
        eventId: 'ev-d1-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: { id: 'npc-hyeon-gong', changes: { trust: 80 } }
          },
          {
            type: 'UPDATE_NPC',
            payload: { id: 'npc-hyeon-gong', changes: { trust: 20 } }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong')
      };
    }
  });

  // D2: Draft Entity Provenance Violation (Creating NPC & Updating in same proposal)
  runAttack({
    testId: 'RED-D2-DRAFT-PROVENANCE-VIOLATION',
    chain: 'CHAIN_D_INTRA_PROPOSAL_PIPELINE',
    targetVector: 'DRAFT_PROVENANCE_BOUNDARY',
    description: 'ADD_NPC in Action 1, then UPDATE_NPC in Action 2 within same proposal before canonical commit.',
    attackHypothesis: 'EngineValidator requires pre-existing canonical evidence in currentState for UPDATE_NPC, rejecting draft update.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const proposal: StateTransitionProposal = {
        proposalId: 'prop-d2',
        requestId: 'req-d2',
        eventId: 'ev-d2-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'ADD_NPC',
            payload: {
              id: 'npc-new-wanderer',
              name: '유랑협객',
              status: 'ALIVE',
              impression: 'Mysterious',
              role: 'Wanderer',
              affiliation: '무소속',
              personality: 'Quiet',
              trust: 30,
              affinity: 30
            }
          },
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-new-wanderer',
              changes: { trust: 80 }
            }
          }
        ]
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-new-wanderer')
      };
    }
  });

  // D3: Multi-Field Partial Claim Injection
  runAttack({
    testId: 'RED-D3-PARTIAL-CLAIM-MULTI-FIELD-INJECTION',
    chain: 'CHAIN_D_INTRA_PROPOSAL_PIPELINE',
    targetVector: 'MULTI_FIELD_PARTIAL_CLAIM',
    description: 'UPDATE_NPC with changes: { trust: 80, affinity: 99 } where claim only covers trust: 80.',
    attackHypothesis: 'Validator must check every attribute in changes object and reject if affinity lacks claim.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-d3',
        entityId: 'npc-hyeon-gong',
        entityType: 'NPC',
        attribute: 'trust',
        value: 80,
        source: 'TESTIMONY'
      };
      const untrusted: UntrustedClaim = {
        rawText: '현공 방장의 신뢰도가 80이다.',
        targetEntityId: 'npc-hyeon-gong',
        targetAttribute: 'trust',
        claimedValue: 80,
        claimedEvidenceIds: ['ev-d3']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;

      const proposal: StateTransitionProposal = {
        proposalId: 'prop-d3',
        requestId: 'req-d3',
        eventId: 'ev-d3-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-hyeon-gong',
              changes: { trust: 80, affinity: 99 }
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-hyeon-gong')
      };
    }
  });

  // D4: Faction Total Influence Overflow Attempt
  runAttack({
    testId: 'RED-D4-FACTION-TOTAL-INFLUENCE-OVERFLOW',
    chain: 'CHAIN_D_INTRA_PROPOSAL_PIPELINE',
    targetVector: 'FACTION_INFLUENCE_OVERFLOW',
    description: 'Attempt to update Wudang influence to 60, making total 30+60+20 = 110 > 100.',
    attackHypothesis: 'Validator enforces cumulative faction influence <= 100 and rejects proposal.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const snap = engine.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-d4',
        entityId: 'faction-wudang',
        entityType: 'FACTION',
        attribute: 'influence',
        value: 60,
        source: 'IMPERIAL_CENSUS'
      };
      const untrusted: UntrustedClaim = {
        rawText: '무당파 영향력 60',
        targetEntityId: 'faction-wudang',
        targetAttribute: 'influence',
        claimedValue: 60,
        claimedEvidenceIds: ['ev-d4']
      };
      const verdict = ImmigrationGate.admit(untrusted, [evidence], snap);
      const verified = verdict.verifiedClaim;

      const proposal: StateTransitionProposal = {
        proposalId: 'prop-d4',
        requestId: 'req-d4',
        eventId: 'ev-d4-commit',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_FACTION',
            payload: {
              id: 'faction-wudang',
              changes: { influence: 60 }
            }
          }
        ],
        verifiedClaims: verified ? [verified] : []
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo.factions.find(f => f.id === 'faction-wudang')
      };
    }
  });

  // =========================================================================
  // CHAIN E: CROSS-INSTANCE TENANT BLEED & BOUNDARY BREAK
  // =========================================================================

  // E1: Module-Scoped WeakSet Multi-Instance Tenant Bleed
  runAttack({
    testId: 'RED-E1-CROSS-INSTANCE-WEAKSET-BLEED',
    chain: 'CHAIN_E_CROSS_INSTANCE_BLEED',
    targetVector: 'MODULE_SCOPED_WEAKSET_BLEED',
    description: 'Claim admitted for Instance A is submitted to completely independent Engine Instance B.',
    attackHypothesis: 'Module-scoped WeakSet admits claim in Instance B because reference check succeeds globally.',
    isBaselineCheck: false,
    setup: () => {
      const engineA = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const engineB = new SovereignEngine(createStandardWorld(), createStandardCharacter());

      const snapA = engineA.getSnapshot();
      const evidence: ExternalEvidence = {
        evidenceId: 'ev-e1',
        entityId: 'npc-cheong-heo',
        entityType: 'NPC',
        attribute: 'trust',
        value: 85,
        source: 'INSTANCE_A_RECORD'
      };
      const untrusted: UntrustedClaim = {
        rawText: 'Instance A world event: 청허 도장 신뢰도 85',
        targetEntityId: 'npc-cheong-heo',
        targetAttribute: 'trust',
        claimedValue: 85,
        claimedEvidenceIds: ['ev-e1']
      };
      const verdictA = ImmigrationGate.admit(untrusted, [evidence], snapA);
      const claimFromInstanceA = verdictA.verifiedClaim;

      // Submit to Engine Instance B
      const proposalB: StateTransitionProposal = {
        proposalId: 'prop-e1-instB',
        requestId: 'req-e1-instB',
        eventId: 'ev-e1-instB',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [
          {
            type: 'UPDATE_NPC',
            payload: {
              id: 'npc-cheong-heo',
              changes: { trust: 85 }
            }
          }
        ],
        verifiedClaims: claimFromInstanceA ? [claimFromInstanceA] : []
      };
      return {
        engine: engineB,
        proposal: proposalB,
        targetExtractor: s => s.worldInfo.npcs.find(n => n.id === 'npc-cheong-heo')
      };
    }
  });

  // E2: Empty Proposal Actions Rejection Check
  runAttack({
    testId: 'RED-E2-EMPTY-PROPOSAL-REJECTION',
    chain: 'CHAIN_E_CROSS_INSTANCE_BLEED',
    targetVector: 'EMPTY_PROPOSAL_REJECTION',
    description: 'Submit proposal with empty actions array.',
    attackHypothesis: 'EngineValidator strictly rejects empty proposals.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const proposal: StateTransitionProposal = {
        proposalId: 'prop-e2-empty',
        requestId: 'req-e2-empty',
        eventId: 'ev-e2-empty',
        turn: 1,
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: []
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.worldInfo
      };
    }
  });

  // E3: Turn Regression Check
  runAttack({
    testId: 'RED-E3-TURN-REGRESSION-REJECTION',
    chain: 'CHAIN_E_CROSS_INSTANCE_BLEED',
    targetVector: 'TURN_REGRESSION_REJECTION',
    description: 'Submit proposal with turn: 0 when engine turn is 1.',
    attackHypothesis: 'EngineValidator rejects turn regression.',
    isBaselineCheck: false,
    setup: () => {
      const engine = new SovereignEngine(createStandardWorld(), createStandardCharacter());
      const proposal: StateTransitionProposal = {
        proposalId: 'prop-e3-turn-regress',
        requestId: 'req-e3-turn-regress',
        eventId: 'ev-e3-turn-regress',
        turn: 0, // Regressed turn! Current turn is 1
        expectedStateVersion: 1,
        timestamp: getTs(1),
        source: 'LLM',
        actions: [{ type: 'ADD_RUMOR', payload: { rumor: '회귀 소문' } }]
      };
      return {
        engine,
        proposal,
        targetExtractor: s => s.turn
      };
    }
  });

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

export function runAndSaveRedTeamEvidence(): void {
  const runResult = executeRedTeamCampaign();
  const reportDir = path.join(process.cwd(), 'report', '15_claim_causality_redteam');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const rawJsonPath = path.join(reportDir, 'raw_evidence.json');
  fs.writeFileSync(rawJsonPath, JSON.stringify(runResult, null, 2), 'utf-8');

  console.log(`[RED_TEAM_FORENSICS_II] Execution complete.`);
  console.log(`Total: ${runResult.total}, Defended: ${runResult.defended}, Exploited: ${runResult.exploited}, Expected: ${runResult.expectedBehavior}`);
  console.log(`Evidence written to ${rawJsonPath}`);
}

runAndSaveRedTeamEvidence();
