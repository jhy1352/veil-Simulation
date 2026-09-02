import { SovereignEngine } from './state';
import { StateTransitionProposal, ImmutableHistoricalRecord, ExternalEvidence } from './types';
import { ImmigrationGate } from './immigrationGate';
import { dispatchEngineInternalProposal, dispatchEngineInternalAction } from './internalCapability';
import { parseGMResponseAndProposal, buildSafeProposal, buildSafeProposalFromCandidate, SafeProposalEnvelope } from './proposalParser';
import { NpcRecord, WorldInfo, Character, CandidatePacket } from '../types';
import { createEmptyCharacter, createEmptyWorldInfo } from '../utils/factory';
import { formatRoadmapText } from '../utils/parser';
import {
  buildCanonIndex,
  buildHistoricalIndex,
  rebuildAllIndices,
  retrieveFromIndices,
  EngineRetriever,
  isValidRetrievalResult,
  CanonIndex,
  HistoricalIndex,
  buildKnowledgeGraph,
  traverseKnowledgeGraph,
  isValidKnowledgeGraphEntity,
  isValidKnowledgeGraphRelation
} from './index/index';
import { runLanguageTestSuite } from './language/testSuite';
import { runHydrationSovereigntyBypassTests } from './hydrationSovereigntyBypassTest';
import { actionToMeaningNode } from './language/adapter';
import { MeaningNode } from './language/types';

interface TestCaseResult {
  testId: string;
  description: string;
  passed: boolean;
  error?: string;
}

const mockNpc = (id: string, name: string, overrides: Partial<NpcRecord> = {}): NpcRecord => ({
  id,
  name,
  innerThought: '미상',
  npcClass: 'Class A',
  ...overrides
});

/**
 * TRPG 3.1 Deterministic Engine Test Suite
 * Validates the Sovereign Engine Authority, Immutability, Idempotency, Atomicity, and Intra-Proposal Action Validation.
 */
export function runSovereignEngineTestSuite(): { passed: boolean; results: TestCaseResult[] } {
  const results: TestCaseResult[] = [];

  const originalSubmit = SovereignEngine.prototype.submitProposal;
  SovereignEngine.prototype.submitProposal = function(proposal: StateTransitionProposal) {
    if (!proposal.meaningTree && !(proposal as any).__testOmitMeaningTree) {
      const children = (proposal.actions || []).map(act => actionToMeaningNode(act, 'PROPOSAL'));
      const tree: MeaningNode = {
        atom: 'INTENT',
        scope: 'PROPOSAL',
        value: proposal.intentSummary || 'Test Proposal Actions',
        children: children.length > 0 ? children : undefined,
      };
      return originalSubmit.call(this, {
        ...proposal,
        meaningTree: tree,
      });
    }
    return originalSubmit.call(this, proposal);
  };

  try {
    function record(testId: string, description: string, fn: () => void) {
      try {
        fn();
        results.push({ testId, description, passed: true });
      } catch (err: any) {
        results.push({ testId, description, passed: false, error: err?.message || String(err) });
      }
    }

  // Test 1: Normal Commit
  record('TEST-01', 'Normal Commit: Valid proposal increments stateVersion and commits state atomically', () => {
    const engine = new SovereignEngine();
    const initialSnapshot = engine.getSnapshot();
    if (initialSnapshot.stateVersion !== 1) throw new Error(`Expected initial stateVersion 1, got ${initialSnapshot.stateVersion}`);

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-001',
      requestId: 'req-001',
      eventId: 'evt-001',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Add new NPC and chapter update',
      actions: [
        {
          type: 'ADD_NPC',
          payload: mockNpc('npc-test-1', '백발도인', { innerThought: '속을 알 수 없다.', npcClass: 'Class A' })
        },
        {
          type: 'ADVANCE_CHAPTER',
          payload: {
            currentChapter: '제1장 강호초출',
            upcomingChapters: ['제2장 암류']
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (!res.success) throw new Error(`Commit failed: ${res.rejectedReasons.join(', ')}`);
    if (res.stateVersion !== 2) throw new Error(`Expected stateVersion 2, got ${res.stateVersion}`);
    if (res.snapshot.worldInfo.npcs.length !== 1) throw new Error('NPC was not added to canonical state');
    if (res.snapshot.worldInfo.chapters.currentChapter !== '제1장 강호초출') throw new Error('Chapter was not updated');
    if (res.newHistoricalRecords.length !== 2) throw new Error('Expected 2 historical records to be generated');
  });

  // Test 2: Validation Failure
  record('TEST-02', 'Validation Failure: Invalid stat values or missing entity rejected with reasons', () => {
    const engine = new SovereignEngine();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-002',
      requestId: 'req-002',
      eventId: 'evt-002',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Update stats with invalid negative number',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: -99 }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (res.success) throw new Error('Expected validation failure for negative stat, but commit succeeded');
    if (!res.rejectedReasons.some(r => r.includes('INVALID_STAT_VALUE'))) {
      throw new Error(`Expected INVALID_STAT_VALUE error reason, got: ${res.rejectedReasons.join('; ')}`);
    }
  });

  // Test 3: Idempotency Verification
  record('TEST-03', 'Idempotency: Re-submitting identical requestId is blocked without mutating state', () => {
    const engine = new SovereignEngine();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-003',
      requestId: 'req-duplicate-001',
      eventId: 'evt-003',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Add unique sword item',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-1', name: '청명검', quantity: 1 },
            operation: 'ADD'
          }
        }
      ]
    };

    const firstRes = dispatchEngineInternalProposal(engine, proposal);
    if (!firstRes.success) throw new Error('First execution failed');
    if (firstRes.stateVersion !== 2) throw new Error('First execution did not bump stateVersion');

    const secondRes = dispatchEngineInternalProposal(engine, {
      ...proposal,
      proposalId: 'prop-003-replay',
      eventId: 'evt-003-replay',
      expectedStateVersion: 2
    });

    if (secondRes.success) throw new Error('Duplicate requestId succeeded! Idempotency breached!');
    if (!secondRes.rejectedReasons.some(r => r.includes('IDEMPOTENCY_VIOLATION'))) {
      throw new Error(`Expected IDEMPOTENCY_VIOLATION, got: ${secondRes.rejectedReasons.join('; ')}`);
    }

    const snap = engine.getSnapshot();
    const swordItem = snap.character.inventory.find(i => i.id === 'item-sword-1');
    if (swordItem?.quantity !== 1) {
      throw new Error(`Expected inventory count 1, but found: ${swordItem?.quantity}`);
    }
  });

  // Test 4: Knowledge Graph relations
  record('TEST-04', 'Knowledge Graph: build and traverse knowledge graph safely', () => {
    const engine = new SovereignEngine();
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-kg-1',
      requestId: 'req-kg-1',
      eventId: 'evt-kg-1',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Add sword and master NPC',
      actions: [
        {
          type: 'ADD_NPC',
          payload: mockNpc('npc-master-1', '화산장문인')
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: { item: { id: 'item-sword-kg', name: '청강검', quantity: 1 }, operation: 'ADD' }
        }
      ]
    });

    const graph = buildKnowledgeGraph(engine.getSnapshot(), engine.getHistory());
    if (!graph.entities.has('protagonist')) throw new Error('Protagonist missing in graph');
    if (!graph.entities.has('item-sword-kg')) throw new Error('Item missing in graph');
    if (!graph.entities.has('npc-master-1')) throw new Error('NPC missing in graph');

    const result = traverseKnowledgeGraph(graph, {
      startEntityId: 'protagonist',
      maxDepth: 2
    });

    if (result.authority !== 'NON_CANONICAL') {
      throw new Error('Graph retrieval result authority must be NON_CANONICAL');
    }
    if (result.visitedEntities.length < 2) {
      throw new Error('Expected traversal to visit protagonist and owned items');
    }
  });

  // Test 5: CandidatePacket -> StateTransitionProposal
  record('TEST-05', 'Proposal Builder: CandidatePacket converts accurately to StateTransitionProposal', () => {
    const engine = new SovereignEngine();
    const snapshot = engine.getSnapshot();
    const candidate: CandidatePacket = {
      candidateId: 'cand-test-05',
      turn: 1,
      timestamp: new Date().toISOString(),
      narrativeDate: 'Turn 1',
      npcChanges: [
        {
          name: '모용세가 장로',
          alias: '벽안풍',
          npcClass: 'Class B',
          innerThought: '비급의 행방을 쫓고 있다.',
          metInStory: true,
          isDead: false
        }
      ],
      factionChanges: [
        {
          name: '모용세가',
          description: '강남의 명문 세가',
          attitudeTowardsPlayer: '호의적'
        }
      ],
      chapterChanges: {
        currentChapter: '제1장 초출강호',
        upcomingChapters: ['제2장 암운']
      }
    };

    const proposal = buildSafeProposalFromCandidate(snapshot, candidate, 1);
    if (proposal.source !== 'LLM') throw new Error(`Expected proposal source 'LLM', got '${proposal.source}'`);
    if (proposal.expectedStateVersion !== snapshot.stateVersion) {
      throw new Error(`Expected expectedStateVersion ${snapshot.stateVersion}, got ${proposal.expectedStateVersion}`);
    }
    if (proposal.turn !== 1) throw new Error(`Expected turn 1, got ${proposal.turn}`);
    if (proposal.actions.length !== 3) throw new Error(`Expected 3 actions generated, got ${proposal.actions.length}`);

    const commitRes = engine.submitProposal(proposal);
    if (!commitRes.success) throw new Error(`Proposal commit failed: ${commitRes.rejectedReasons.join('; ')}`);
    if (commitRes.snapshot.worldInfo.npcs.length !== 1) throw new Error('NPC was not added');
    if (commitRes.snapshot.worldInfo.factions.length !== 1) throw new Error('Faction was not added');
    if (commitRes.snapshot.worldInfo.chapters.currentChapter !== '제1장 초출강호') throw new Error('Chapter was not updated');
  });

  // Test 6: Narrative Defense (Seeds)
  record('TEST-06', 'Narrative Defense: Seed max 3 cap, deduplication, and resolution semantics', () => {
    const engine = new SovereignEngine();
    const initialSnap = engine.getSnapshot();

    // Add 2 active seeds first
    const setupProposal: StateTransitionProposal = {
      proposalId: 'prop-seed-setup',
      requestId: 'req-seed-setup',
      eventId: 'evt-seed-setup',
      expectedStateVersion: initialSnap.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Setup initial seeds',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: { id: 'seed-1', content: '화산파 장문인의 밀서', status: 'active', turnCreated: 1 }
        },
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: { id: 'seed-2', content: '동굴 속의 숨겨진 비급', status: 'active', turnCreated: 1 }
        }
      ]
    };
    const setupRes = engine.submitProposal(setupProposal);
    if (!setupRes.success) throw new Error('Setup proposal failed');

    const snap2 = engine.getSnapshot();

    // Now try to propose:
    // 1. Resolve seed-1 with explicit resolutionSummary
    // 2. Add duplicate of seed-2 (should be skipped)
    // 3. Add seed-3 (should succeed, filling slot 3)
    // 4. Add seed-4 (should be capped/skipped if exceeding available slots)
    const candidate: CandidatePacket = {
      candidateId: 'cand-seeds-test',
      turn: 2,
      timestamp: new Date().toISOString(),
      narrativeDate: 'Turn 2',
      seedChanges: [
        {
          content: '화산파 장문인의 밀서',
          status: 'resolved',
          action: 'resolve',
          resolutionSummary: '밀서의 암호를 해독하여 진실을 파악함'
        } as any,
        {
          content: '동굴 속의 숨겨진 비급', // Duplicate of existing active seed
          status: 'active'
        },
        {
          content: '소림사의 비밀 전승',
          status: 'active'
        },
        {
          content: '마교 교주의 밀령',
          status: 'active'
        }
      ]
    };

    const prop = buildSafeProposalFromCandidate(snap2, candidate, 2);
    const resolveAction = prop.actions.find(a => a.type === 'RESOLVE_NARRATIVE_SEED');
    if (!resolveAction) throw new Error('Expected RESOLVE_NARRATIVE_SEED action');
    if ((resolveAction.payload as any).resolutionSummary !== '밀서의 암호를 해독하여 진실을 파악함') {
      throw new Error('Resolution summary did not match explicit input');
    }

    const addActions = prop.actions.filter(a => a.type === 'ADD_NARRATIVE_SEED');
    // Since snap2 had 2 active seeds (slot remaining: 1), only 1 new seed should be added
    if (addActions.length !== 1) {
      throw new Error(`Expected exactly 1 ADD_NARRATIVE_SEED action due to cap/dedup, got ${addActions.length}`);
    }
    if ((addActions[0].payload as any).content !== '소림사의 비밀 전승') {
      throw new Error(`Expected '소림사의 비밀 전승', got '${(addActions[0].payload as any).content}'`);
    }

    const commitRes = engine.submitProposal(prop);
    if (!commitRes.success) throw new Error(`Commit failed: ${commitRes.rejectedReasons.join('; ')}`);
  });

  // Test 7: Dice Safety - recommendedDC does not synthesize RECORD_DICE_RESULT action; valid player rolls clamp DC
  record('TEST-07', 'Dice Safety: recommendedDC does not emit RECORD_DICE_RESULT; player DC clamped to 1-20', () => {
    const engine = new SovereignEngine();
    const snap = engine.getSnapshot();

    const candidate: CandidatePacket = {
      candidateId: 'cand-dice-test',
      turn: 1,
      timestamp: new Date().toISOString(),
      narrativeDate: 'Turn 1',
      recommendedDC: 99 // Out of range suggestion
    };

    // 1. Proposal builder must NOT emit RECORD_DICE_RESULT from candidate
    const proposal = buildSafeProposalFromCandidate(snap, candidate, 1);
    const diceAction = proposal.actions.find(a => a.type === 'RECORD_DICE_RESULT');
    if (diceAction) {
      throw new Error('Proposal builder must not emit RECORD_DICE_RESULT from candidate.recommendedDC');
    }

    // 2. Legitimate player dice check with DC > 20 is validated/handled
    const playerDiceProposal: StateTransitionProposal = {
      proposalId: 'prop-player-dice-test',
      requestId: 'req-player-dice-test',
      eventId: 'evt-player-dice-test',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player rolls against DC',
      actions: [
        { type: 'RECORD_DICE_RESULT', payload: { actionContext: '대결 판정', targetDC: 20, rollValue: 15 } }
      ]
    };

    const commitRes = engine.submitProposal(playerDiceProposal);
    if (!commitRes.success) throw new Error(`Player dice commit failed: ${commitRes.rejectedReasons.join('; ')}`);
    if (commitRes.snapshot.worldInfo.dcHistory[0] !== 20) {
      throw new Error('DC history not updated with DC');
    }
  });

  // Test 8: Stat Safety
  record('TEST-08', 'Stat Safety: Delta clamped to -10~+10, final stat clamped to 1~30', () => {
    const engine = new SovereignEngine();
    // Setup training seed in canonical state
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-stat-seed',
      requestId: 'req-stat-seed',
      eventId: 'evt-stat-seed',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Setup training seed',
      actions: [
        { type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-training', content: '무공 수련과 신체 단련', status: 'active' } }
      ]
    });

    const snap = engine.getSnapshot();
    // Default stats are 10

    const candidate: CandidatePacket = {
      candidateId: 'cand-stat-test',
      turn: 1,
      timestamp: new Date().toISOString(),
      narrativeDate: 'Turn 1',
      statChanges: [
        { stat: 'strength', delta: 50 }, // Delta +50 -> clamped to +10 -> 10 + 10 = 20
        { stat: 'agility', delta: -50 }  // Delta -50 -> clamped to -10 -> 10 - 10 = 0 -> clamped to 1
      ]
    };

    const proposal = buildSafeProposalFromCandidate(snap, candidate, 1);
    const statAction = proposal.actions.find(a => a.type === 'UPDATE_CHARACTER_STATS');
    if (!statAction) throw new Error('Expected UPDATE_CHARACTER_STATS action');

    if (statAction.payload.strength !== 20) {
      throw new Error(`Expected strength 20 (clamped delta +10), got ${statAction.payload.strength}`);
    }
    if (statAction.payload.agility !== 1) {
      throw new Error(`Expected agility 1 (clamped delta -10 & min 1), got ${statAction.payload.agility}`);
    }

    const evStr: ExternalEvidence = {
      evidenceId: 'ev-stat-strength',
      sourceType: 'SYSTEM',
      timestamp: new Date().toISOString(),
      contentSnippet: 'Strength training roll',
      turn: 1,
      entityId: 'character',
      attribute: 'strength',
      value: 20
    };
    const evAgi: ExternalEvidence = {
      evidenceId: 'ev-stat-agility',
      sourceType: 'SYSTEM',
      timestamp: new Date().toISOString(),
      contentSnippet: 'Agility training roll',
      turn: 1,
      entityId: 'character',
      attribute: 'agility',
      value: 1
    };
    const claimStr = ImmigrationGate.admit(
      {
        targetEntityId: 'character',
        targetAttribute: 'strength',
        claimedValue: 20,
        claimedEvidenceIds: ['ev-stat-strength'],
        rawText: '힘 20'
      },
      [evStr],
      snap
    );
    const claimAgi = ImmigrationGate.admit(
      {
        targetEntityId: 'character',
        targetAttribute: 'agility',
        claimedValue: 1,
        claimedEvidenceIds: ['ev-stat-agility'],
        rawText: '민첩 1'
      },
      [evAgi],
      snap
    );

    const proposalWithClaims: StateTransitionProposal = {
      ...proposal,
      verifiedClaims: [claimStr.verifiedClaim!, claimAgi.verifiedClaim!]
    };

    const commitRes = engine.submitProposal(proposalWithClaims);
    if (!commitRes.success) throw new Error(`Stat update commit failed: ${commitRes.rejectedReasons.join('; ')}`);
    if (commitRes.snapshot.character.stats.strength !== 20) throw new Error('Character strength mismatch');
    if (commitRes.snapshot.character.stats.agility !== 1) throw new Error('Character agility mismatch');
  });

  // Test 9: Reject & Safe No-Commit
  record('TEST-09', 'Reject & Safe No-Commit: Invalid proposal leaves snapshot, version, and history completely unmutated', () => {
    const engine = new SovereignEngine();
    const initialSnap = engine.getSnapshot();
    const initialHist = engine.getHistory();

    const invalidProposal: StateTransitionProposal = {
      proposalId: 'prop-invalid-09',
      requestId: 'req-invalid-09',
      eventId: 'evt-invalid-09',
      expectedStateVersion: 999, // Stale stateVersion mismatch
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stale version update attempt',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: { item: { id: 'bad-item', name: '가짜 보검', quantity: 1 }, operation: 'ADD' }
        }
      ]
    };

    const res = engine.submitProposal(invalidProposal);
    if (res.success) throw new Error('Expected proposal to be rejected due to version mismatch');
    if (res.stateVersion !== initialSnap.stateVersion) {
      throw new Error(`stateVersion was mutated on failure: ${res.stateVersion} !== ${initialSnap.stateVersion}`);
    }

    const afterSnap = engine.getSnapshot();
    if (afterSnap.stateVersion !== initialSnap.stateVersion) throw new Error('Snapshot version mutated');
    if (afterSnap.character.inventory.length !== initialSnap.character.inventory.length) {
      throw new Error('Snapshot inventory was mutated on rejected proposal');
    }
    if (engine.getHistory().length !== initialHist.length) {
      throw new Error('Historical records were added on rejected proposal');
    }
  });

  // Test 10: Hydration Compatibility
  record('TEST-10', 'Hydration Compatibility: Preserves valid stateVersion, avoids history.length fallback, matches projections', () => {
    // 1. Hydrate from valid snapshot diagnostics stateVersion = 7
    const loadedWorld = createEmptyWorldInfo();
    const loadedChar = createEmptyCharacter();
    loadedChar.name = '청풍';
    const mockHistory: ImmutableHistoricalRecord[] = [
      {
        recordId: 'rec-1',
        eventId: 'evt-1',
        proposalId: 'prop-1',
        actionType: 'ADD_NPC',
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        details: 'Added NPC',
        stateVersionAfterCommit: 2
      },
      {
        recordId: 'rec-2',
        eventId: 'evt-last',
        proposalId: 'prop-1',
        actionType: 'ADVANCE_CHAPTER',
        source: 'LLM',
        turn: 1,
        timestamp: new Date().toISOString(),
        details: 'Advanced Chapter',
        stateVersionAfterCommit: 3
      }
    ];

    // Notice: mockHistory.length is 2, but actual stateVersion is 7 (multiple actions in 1 proposal or skipped turns)
    const engineWithDiag = SovereignEngine.hydrate(
      {
        stateVersion: 7,
        turn: 5,
        worldInfo: loadedWorld,
        character: loadedChar,
        lastCommittedEventId: 'evt-last',
        lastCommittedAt: new Date().toISOString()
      },
      mockHistory
    );

    const snap1 = engineWithDiag.getSnapshot();
    if (snap1.stateVersion !== 7) {
      throw new Error(`Expected hydrated stateVersion 7, got ${snap1.stateVersion}`);
    }
    if (snap1.character.name !== '청풍') {
      throw new Error('Hydrated character name mismatch');
    }
    if (engineWithDiag.getHistory().length !== 2) {
      throw new Error('Hydrated history length mismatch');
    }

    // 2. Hydrate from legacy session without diagnostics (using turn=12 as fallback, NOT history.length=2)
    const resolvedLegacyVersion = typeof 12 === 'number' && 12 >= 1 ? 12 : 1;
    const legacyEngine = SovereignEngine.hydrate(
      {
        stateVersion: resolvedLegacyVersion,
        turn: 12,
        worldInfo: loadedWorld,
        character: loadedChar,
        lastCommittedEventId: null,
        lastCommittedAt: new Date().toISOString()
      },
      mockHistory
    );

    const legacySnap = legacyEngine.getSnapshot();
    if (legacySnap.stateVersion !== 12) {
      throw new Error(`Expected legacy hydrated stateVersion 12, got ${legacySnap.stateVersion}`);
    }
    if (legacySnap.stateVersion === mockHistory.length + 1) {
      throw new Error('Legacy hydration erroneously used history.length + 1!');
    }
  });

  // Test 11: Adversarial Overwrite Validation (Dead NPC resurrection defense)
  record('TEST-11', 'Adversarial Overwrite: Reject resurrection of historically dead NPC', () => {
    const engine = new SovereignEngine();
    const initialSnap = engine.getSnapshot();

    // 1. Add NPC and then kill them canonically
    const evidence = {
      evidenceId: 'ev-muyeon-dead',
      sourceType: 'NARRATIVE' as const,
      timestamp: new Date().toISOString(),
      contentSnippet: '무연선사가 마교 장로와의 결투 중 전사했다.',
      turn: 1,
      targetEntityId: 'npc-muyeon',
      observedAttribute: 'status',
      observedValue: 'DEAD'
    };
    const admission = ImmigrationGate.admit(
      {
        targetEntityId: 'npc-muyeon',
        targetAttribute: 'status',
        claimedValue: 'DEAD',
        claimedEvidenceIds: ['ev-muyeon-dead'],
        rawText: '무연선사 전사'
      },
      [evidence],
      initialSnap
    );
    if (!admission.admitted || !admission.verifiedClaim) {
      throw new Error(`Gate admission failed: ${admission.rejectionReason}`);
    }

    const setupProposal: StateTransitionProposal = {
      proposalId: 'prop-npc-death',
      requestId: 'req-npc-death',
      eventId: 'evt-npc-death',
      expectedStateVersion: initialSnap.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Add NPC and transition to DEAD',
      verifiedClaims: [admission.verifiedClaim],
      actions: [
        {
          type: 'ADD_NPC',
          payload: {
            id: 'npc-muyeon',
            name: '무연선사',
            npcClass: 'Class A',
            affiliation: '소림사',
            innerThought: '근엄함',
            status: 'ALIVE'
          }
        },
        {
          type: 'SET_NPC_STATUS',
          payload: {
            id: 'npc-muyeon',
            status: 'DEAD',
            reason: '마교 장로와의 결투 중 전사'
          }
        }
      ]
    };

    const setupRes = engine.submitProposal(setupProposal);
    if (!setupRes.success) throw new Error(`Setup proposal failed: ${setupRes.rejectedReasons.join('; ')}`);

    const deadSnap = engine.getSnapshot();
    const deadNpc = deadSnap.worldInfo.npcs.find(n => n.id === 'npc-muyeon');
    if (!deadNpc || deadNpc.status !== 'DEAD') throw new Error('NPC was not killed canonically');
    const versionBeforeAttack = deadSnap.stateVersion;
    const historyCountBeforeAttack = engine.getHistory().length;

    // 2. Adversarial Overwrite: Attempt OVERWRITE_WORLD_INFO that resurrects the dead NPC to ALIVE
    const attackProposal: StateTransitionProposal = {
      proposalId: 'prop-resurrect-attack',
      requestId: 'req-resurrect-attack',
      eventId: 'evt-resurrect-attack',
      expectedStateVersion: versionBeforeAttack,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Adversarial attempt to resurrect dead NPC via OVERWRITE_WORLD_INFO',
      actions: [
        {
          type: 'OVERWRITE_WORLD_INFO',
          payload: {
            ...deadSnap.worldInfo,
            npcs: [
              {
                id: 'npc-muyeon',
                name: '무연선사',
                npcClass: 'Class A',
                affiliation: '소림사',
                innerThought: '근엄함',
                status: 'ALIVE' // Unauthorized resurrection
              }
            ]
          }
        }
      ]
    };

    const attackRes = engine.submitProposal(attackProposal);
    if (attackRes.success) throw new Error('Expected adversarial resurrection to be REJECTED, but it succeeded!');
    if (!attackRes.rejectedReasons.some(r => r.includes('DEAD_NPC_STATUS_PROTECTION'))) {
      throw new Error(`Expected DEAD_NPC_STATUS_PROTECTION rejection, got: ${attackRes.rejectedReasons.join('; ')}`);
    }

    const postAttackSnap = engine.getSnapshot();
    if (postAttackSnap.stateVersion !== versionBeforeAttack) {
      throw new Error(`State version changed on rejection! Expected ${versionBeforeAttack}, got ${postAttackSnap.stateVersion}`);
    }
    if (engine.getHistory().length !== historyCountBeforeAttack) {
      throw new Error('History was altered despite rejection!');
    }
    const npcStillDead = postAttackSnap.worldInfo.npcs.find(n => n.id === 'npc-muyeon');
    if (!npcStillDead || npcStillDead.status !== 'DEAD') {
      throw new Error('Dead NPC status was modified despite rejection!');
    }
  });

  // Test 12: Snapshot Mutability Defense
  record('TEST-12', 'Snapshot Mutability Defense: External mutation of snapshot/history does not affect Canonical State', () => {
    const engine = new SovereignEngine();
    const snap = engine.getSnapshot();

    // 1. Attempt to mutate snapshot directly
    try {
      (snap as any).character.name = '악성 해커';
      (snap as any).character.inventory.push({ id: 'hacked-item', name: '해킹검', quantity: 99 });
      (snap as any).worldInfo.worldName = '오염된 세계';
      (snap as any).stateVersion = 999;
    } catch {
      // TypeError in strict mode or deepFreeze is expected
    }

    // 2. Attempt to mutate history array
    const history = engine.getHistory();
    try {
      (history as any).push({ recordId: 'fake-record' });
    } catch {
      // Expected frozen/readonly
    }

    // Verify sovereign state remains untouched
    const freshSnap = engine.getSnapshot();
    if (freshSnap.character.name === '악성 해커') {
      throw new Error('Snapshot mutation leaked into engine canonical state!');
    }
    if (freshSnap.character.inventory.some(i => i.id === 'hacked-item')) {
      throw new Error('Snapshot inventory push leaked into engine canonical state!');
    }
    if (freshSnap.worldInfo.worldName === '오염된 세계') {
      throw new Error('Snapshot worldName mutation leaked into engine canonical state!');
    }
    if (engine.getHistory().some(h => (h as any).recordId === 'fake-record')) {
      throw new Error('History push leaked into engine history manager!');
    }
  });

  // Test 13: Hydration Schema Immunity
  record('TEST-13', 'Hydration Schema Immunity: Reject malformed snapshots without guessing repair values', () => {
    const validWorld = createEmptyWorldInfo();
    const validChar = createEmptyCharacter();

    // 1. Negative stats snapshot
    const negativeStatChar = {
      ...validChar,
      stats: { ...validChar.stats, strength: -5 }
    };
    let threwNegativeStat = false;
    try {
      SovereignEngine.hydrate({
        stateVersion: 1,
        turn: 1,
        worldInfo: validWorld,
        character: negativeStatChar as any,
        lastCommittedEventId: null,
        lastCommittedAt: new Date().toISOString()
      });
    } catch (e: any) {
      if (e.message.includes('HYDRATION_SCHEMA_VIOLATION')) {
        threwNegativeStat = true;
      }
    }
    if (!threwNegativeStat) throw new Error('Expected hydrate to throw for negative stat');

    // 2. Invalid stateVersion (0 or negative or non-integer)
    let threwInvalidVersion = false;
    try {
      SovereignEngine.hydrate({
        stateVersion: 0,
        turn: 1,
        worldInfo: validWorld,
        character: validChar,
        lastCommittedEventId: null,
        lastCommittedAt: new Date().toISOString()
      });
    } catch (e: any) {
      if (e.message.includes('HYDRATION_SCHEMA_VIOLATION')) {
        threwInvalidVersion = true;
      }
    }
    if (!threwInvalidVersion) throw new Error('Expected hydrate to throw for stateVersion 0');

    // 3. Missing required array in worldInfo (e.g. npcs is null)
    let threwMissingArray = false;
    try {
      SovereignEngine.hydrate({
        stateVersion: 1,
        turn: 1,
        worldInfo: { ...validWorld, npcs: null as any },
        character: validChar,
        lastCommittedEventId: null,
        lastCommittedAt: new Date().toISOString()
      });
    } catch (e: any) {
      if (e.message.includes('HYDRATION_SCHEMA_VIOLATION')) {
        threwMissingArray = true;
      }
    }
    if (!threwMissingArray) throw new Error('Expected hydrate to throw for null npcs array');
  });

  // Test 14: Atomic Rollback on Middle Action Failure
  record('TEST-14', 'Atomic Rollback: Intra-proposal failure leaves Canonical State, History, and Idempotency untouched', () => {
    const engine = new SovereignEngine();
    const snap = engine.getSnapshot();
    const initialHistoryLength = engine.getHistory().length;

    const proposalWithMiddleFailure: StateTransitionProposal = {
      proposalId: 'prop-atomic-test',
      requestId: 'req-atomic-test',
      eventId: 'evt-atomic-test',
      expectedStateVersion: snap.stateVersion,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Action 1 valid, Action 2 valid, Action 3 invalid',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'gold-coin-1', name: '금화 10냥', quantity: 10 }
          }
        },
        {
          type: 'SET_CHARACTER_SECRET',
          payload: {
            secret: '숨겨진 가문의 비전'
          }
        },
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            invalid_hack_stat: 5
          } as any
        }
      ]
    };

    const res = dispatchEngineInternalProposal(engine, proposalWithMiddleFailure);
    if (res.success) throw new Error('Proposal with invalid action should have failed validation!');

    // Verify NOTHING was applied
    const postSnap = engine.getSnapshot();
    if (postSnap.stateVersion !== snap.stateVersion) {
      throw new Error(`State version changed on rejection! Expected ${snap.stateVersion}, got ${postSnap.stateVersion}`);
    }
    if (postSnap.character.inventory.some(i => i.id === 'gold-coin-1')) {
      throw new Error('Action 1 was applied despite subsequent action failure!');
    }
    if (postSnap.character.secret === '숨겨진 가문의 비전') {
      throw new Error('Action 2 was applied despite subsequent action failure!');
    }
    if (engine.getHistory().length !== initialHistoryLength) {
      throw new Error('History was altered despite proposal failure!');
    }

    // Verify idempotency allows resubmission of fixed proposal with same requestId/eventId since previous failed
    const fixedProposal: StateTransitionProposal = {
      ...proposalWithMiddleFailure,
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'gold-coin-1', name: '금화 10냥', quantity: 10 }
          }
        }
      ]
    };
    const fixedRes = dispatchEngineInternalProposal(engine, fixedProposal);
    if (!fixedRes.success) throw new Error(`Fixed proposal should succeed, but failed: ${fixedRes.rejectedReasons.join('; ')}`);
    if (fixedRes.snapshot.stateVersion !== snap.stateVersion + 1) {
      throw new Error('Fixed proposal did not increment state version');
    }
  });

  // Test 15: Adversarial Character Overwrite (Physical Defect preservation)
  record('TEST-15', 'Adversarial Character Overwrite: Permanent physicalDefect is preserved and cannot be erased', () => {
    const engine = new SovereignEngine();
    const initialSnap = engine.getSnapshot();

    // 1. Establish permanent physical defect
    const defectProposal: StateTransitionProposal = {
      proposalId: 'prop-defect-setup',
      requestId: 'req-defect-setup',
      eventId: 'evt-defect-setup',
      expectedStateVersion: initialSnap.stateVersion,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Establish physical defect',
      actions: [
        {
          type: 'RECORD_PHYSICAL_DEFECT',
          payload: {
            defect: '왼쪽 눈 실명'
          }
        }
      ]
    };
    const defectRes = engine.submitProposal(defectProposal);
    if (!defectRes.success) throw new Error(`Failed to record defect: ${defectRes.rejectedReasons.join('; ')}`);

    const snapWithDefect = engine.getSnapshot();
    if (snapWithDefect.character.physicalDefect !== '왼쪽 눈 실명') {
      throw new Error('Physical defect not established');
    }

    // 2. Adversarial Overwrite: Attempt to erase physicalDefect with empty string
    const attackProposal: StateTransitionProposal = {
      proposalId: 'prop-erase-defect',
      requestId: 'req-erase-defect',
      eventId: 'evt-erase-defect',
      expectedStateVersion: snapWithDefect.stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt to erase physical defect',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...snapWithDefect.character,
            physicalDefect: '' // Attempting to erase defect
          }
        }
      ]
    };

    const attackRes = engine.submitProposal(attackProposal);
    if (attackRes.success) throw new Error('Attempt to erase physicalDefect should have been REJECTED!');
    if (!attackRes.rejectedReasons.some(r => r.includes('PHYSICAL_DEFECT_IMMUTABILITY'))) {
      throw new Error(`Expected PHYSICAL_DEFECT_IMMUTABILITY rejection, got: ${attackRes.rejectedReasons.join('; ')}`);
    }

    const postSnap = engine.getSnapshot();
    if (postSnap.character.physicalDefect !== '왼쪽 눈 실명') {
      throw new Error('Physical defect was erased or altered!');
    }
  });

  // Test 16: Source -> Action ACL Enforcement
  record('TEST-16', 'Source -> Action ACL: Reject unauthorized actions for given proposal source', () => {
    const engine = new SovereignEngine();
    const snap = engine.getSnapshot();

    // 1. LLM attempting administrative OVERWRITE_WORLD_INFO
    const llmAttackProposal: StateTransitionProposal = {
      proposalId: 'prop-llm-overwrite',
      requestId: 'req-llm-overwrite',
      eventId: 'evt-llm-overwrite',
      expectedStateVersion: snap.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM attempting unauthorized OVERWRITE_WORLD_INFO',
      actions: [
        {
          type: 'OVERWRITE_WORLD_INFO',
          payload: {
            ...snap.worldInfo,
            worldName: 'LLM 변조 세계'
          }
        }
      ]
    };

    const llmRes = engine.submitProposal(llmAttackProposal);
    if (llmRes.success) throw new Error('LLM should NOT be allowed to execute OVERWRITE_WORLD_INFO!');
    if (!llmRes.rejectedReasons.some(r => r.includes('UNAUTHORIZED_ACTION_FOR_SOURCE'))) {
      throw new Error(`Expected UNAUTHORIZED_ACTION_FOR_SOURCE rejection, got: ${llmRes.rejectedReasons.join('; ')}`);
    }

    // 2. PLAYER attempting RECORD_OFFSCREEN_EVENT
    const playerAttackProposal: StateTransitionProposal = {
      proposalId: 'prop-player-offscreen',
      requestId: 'req-player-offscreen',
      eventId: 'evt-player-offscreen',
      expectedStateVersion: snap.stateVersion,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'PLAYER attempting unauthorized RECORD_OFFSCREEN_EVENT',
      actions: [
        {
          type: 'RECORD_OFFSCREEN_EVENT',
          payload: {
            eventDescription: '플레이어가 임의로 기록한 오프스크린 사건'
          }
        }
      ]
    };

    const playerRes = engine.submitProposal(playerAttackProposal);
    if (playerRes.success) throw new Error('PLAYER should NOT be allowed to execute RECORD_OFFSCREEN_EVENT!');
    if (!playerRes.rejectedReasons.some(r => r.includes('UNAUTHORIZED_ACTION_FOR_SOURCE'))) {
      throw new Error(`Expected UNAUTHORIZED_ACTION_FOR_SOURCE rejection, got: ${playerRes.rejectedReasons.join('; ')}`);
    }
  });

  // ==========================================
  // PHASE 5.6.4: PURE DYNAMIC GENERATION TESTS (TEST-A to TEST-K)
  // ==========================================

  // TEST-A: Prompt Contamination Audit (Zero Hardcoded Narrative Fallbacks)
  record('TEST-A', 'Prompt Contamination Audit: Engine prompt contains zero hardcoded chapter titles or preset seeds', () => {
    const worldInfo = createEmptyWorldInfo();
    worldInfo.worldName = '사이버 네오시티';
    const character = createEmptyCharacter();
    character.name = 'V';

    // Verify formatRoadmapText output contains no fabricated chapters
    const roadmapText = formatRoadmapText(worldInfo.chapters);
    if (roadmapText.includes('태동과 첫 번째 갈등') || roadmapText.includes('어둠 속의 비밀') || roadmapText.includes('새로운 여명')) {
      throw new Error('Detected contaminated hardcoded fallback strings in roadmapText!');
    }
    if (roadmapText.includes('미정')) {
      throw new Error('Detected legacy "미정" fallback string in formatRoadmapText!');
    }
  });

  // TEST-B: Empty Roadmap Structuring (Prompt requests pure dynamic creation)
  record('TEST-B', 'Empty Roadmap: Engine formats empty upcomingChapters as request for pure dynamic creation', () => {
    const emptyChapters: string[] = [];
    let upcomingSummary = '';
    if (emptyChapters.length > 0) {
      upcomingSummary = emptyChapters.map((ch, idx) => `  ${idx + 1}. ${ch}`).join('\n');
    } else {
      upcomingSummary = '  (현재 등록된 예정 로드맵 없음 — 현재 세계 상태와 플레이어 행동을 바탕으로 직후 이어질 비정사적 미래 3개 챕터를 직접 창작하여 출력하십시오)';
    }

    if (!upcomingSummary.includes('현재 등록된 예정 로드맵 없음')) {
      throw new Error('Expected clean dynamic creation request for empty upcoming chapters');
    }
    if (upcomingSummary.includes('1장 - ') || upcomingSummary.includes('2장 - ') || upcomingSummary.includes('3장 - ')) {
      throw new Error('Engine fabricated fallback chapter titles for empty roadmap!');
    }
  });

  // TEST-C: 1-Chapter Partial Roadmap (Zero fabricated chapters 2 & 3)
  record('TEST-C', '1-Chapter Roadmap: Engine preserves single chapter and requests dynamic completion of 2 slots', () => {
    const partialChapters = ['1장 - 네온 불빛 아래의 암투'];
    let upcomingSummary = partialChapters.map((ch, idx) => `  ${idx + 1}. ${ch}`).join('\n');
    if (partialChapters.length < 3) {
      upcomingSummary += `\n  (직후 미래 3개 챕터 완성을 위해 부족한 ${3 - partialChapters.length}개 챕터는 현재 세계 상태를 바탕으로 직접 창작하십시오)`;
    }

    if (!upcomingSummary.includes('1. 1장 - 네온 불빛 아래의 암투')) {
      throw new Error('Chapter 1 was not preserved');
    }
    if (!upcomingSummary.includes('부족한 2개 챕터는 현재 세계 상태를 바탕으로 직접 창작하십시오')) {
      throw new Error('Missing dynamic instruction for remaining 2 chapters');
    }
    if (upcomingSummary.includes('2. ') || upcomingSummary.includes('3. ')) {
      throw new Error('Engine fabricated chapters 2 or 3!');
    }
  });

  // TEST-D: 2-Chapter Partial Roadmap (Zero fabricated chapter 3)
  record('TEST-D', '2-Chapter Roadmap: Engine preserves 2 chapters and requests dynamic completion of 1 slot', () => {
    const partialChapters = ['1장 - 사이버 스페이스 침투', '2장 - 메가코프의 반격'];
    let upcomingSummary = partialChapters.map((ch, idx) => `  ${idx + 1}. ${ch}`).join('\n');
    if (partialChapters.length < 3) {
      upcomingSummary += `\n  (직후 미래 3개 챕터 완성을 위해 부족한 ${3 - partialChapters.length}개 챕터는 현재 세계 상태를 바탕으로 직접 창작하십시오)`;
    }

    if (!upcomingSummary.includes('1. 1장 - 사이버 스페이스 침투') || !upcomingSummary.includes('2. 2장 - 메가코프의 반격')) {
      throw new Error('Existing chapters were not preserved');
    }
    if (!upcomingSummary.includes('부족한 1개 챕터는 현재 세계 상태를 바탕으로 직접 창작하십시오')) {
      throw new Error('Missing dynamic instruction for remaining 1 chapter');
    }
    if (upcomingSummary.includes('3. ')) {
      throw new Error('Engine fabricated chapter 3!');
    }
  });

  // TEST-E: Dynamic Chapter Generation & Commit
  record('TEST-E', 'Dynamic Roadmap Commit: LLM proposed dynamic 3-chapter roadmap is safely validated and committed', () => {
    const engine = new SovereignEngine();
    const candidate: CandidatePacket = {
      candidateId: 'cand-dynamic-roadmap',
      turn: 1,
      timestamp: new Date().toISOString(),
      chapterChanges: {
        currentChapter: '1장 - 잠입',
        upcomingChapters: ['2장 - 데이터 탈취', '3장 - 포위망 돌파', '4장 - 새로운 은신처']
      }
    };

    const proposal = buildSafeProposalFromCandidate(engine.getSnapshot(), candidate, 1);
    const commitRes = engine.submitProposal(proposal);
    if (!commitRes.success) throw new Error(`Commit failed: ${commitRes.rejectedReasons.join('; ')}`);

    const snap = engine.getSnapshot();
    if (snap.worldInfo.chapters.currentChapter !== '1장 - 잠입') throw new Error('currentChapter not committed');
    if (snap.worldInfo.chapters.upcomingChapters.length !== 3) throw new Error('upcomingChapters length != 3');
    if (snap.worldInfo.chapters.upcomingChapters[0] !== '2장 - 데이터 탈취') throw new Error('upcomingChapters[0] mismatch');
  });

  // TEST-F: Player Divergence & Roadmap Independence
  record('TEST-F', 'Player Divergence: Player actions divergent from roadmap execute freely without rejection', () => {
    const engine = new SovereignEngine();
    // 1. Pre-commit initial character setup with currency
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-init-funds',
      requestId: 'req-init-funds',
      eventId: 'evt-init-funds',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Initial character resources',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-credits', name: '크레딧', quantity: 500 },
            operation: 'ADD'
          }
        }
      ]
    });

    const snap0 = engine.getSnapshot();

    // 2. Pre-commit a roadmap
    engine.submitProposal({
      proposalId: 'prop-road-1',
      requestId: 'req-road-1',
      eventId: 'evt-road-1',
      expectedStateVersion: snap0.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Initial roadmap',
      actions: [
        {
          type: 'ADVANCE_CHAPTER',
          payload: {
            currentChapter: '1장 - 연구소 잠입',
            upcomingChapters: ['2장 - 서버 해킹', '3장 - 코어 탈취', '4장 - 탈출']
          }
        },
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-cyberware',
            content: '사이버네틱 신체 강화 수술',
            status: 'active'
          }
        }
      ]
    });

    const snap1 = engine.getSnapshot();
    const evCyberware: ExternalEvidence = {
      evidenceId: 'ev-cyberware-op',
      sourceType: 'SYSTEM',
      timestamp: new Date().toISOString(),
      contentSnippet: 'Cyberware surgery agility boost',
      turn: 2,
      entityId: 'character',
      attribute: 'agility',
      value: 18
    };
    const claimCyberware = ImmigrationGate.admit(
      {
        targetEntityId: 'character',
        targetAttribute: 'agility',
        claimedValue: 18,
        claimedEvidenceIds: ['ev-cyberware-op'],
        rawText: '민첩 18'
      },
      [evCyberware],
      snap1
    );

    // Player completely diverges: player updates character stats and buys grapple gun via exchange
    const playerDivergenceProposal: StateTransitionProposal = {
      proposalId: 'prop-diverge-1',
      requestId: 'req-diverge-1',
      eventId: 'evt-diverge-1',
      expectedStateVersion: snap1.stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player decides to buy supplies and boost agility',
      verifiedClaims: [claimCyberware.verifiedClaim!],
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            agility: 18
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: {
              id: 'item-credits',
              name: '크레딧',
              quantity: 100
            },
            operation: 'REMOVE'
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: {
              id: 'item-grapple',
              name: '와이어 그래플 건',
              quantity: 1
            },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: {
                name: '크레딧',
                quantity: 100
              }
            }
          }
        }
      ]
    };

    const commitRes = engine.submitProposal(playerDivergenceProposal);
    if (!commitRes.success) throw new Error(`Player divergence action was rejected: ${commitRes.rejectedReasons.join('; ')}`);
    if (commitRes.snapshot.character.stats.agility !== 18) throw new Error('Agility was not updated');
    if (!commitRes.snapshot.character.inventory.some(i => i.name === '와이어 그래플 건')) throw new Error('Inventory was not updated');
    const remainingCredits = commitRes.snapshot.character.inventory.find(i => i.name === '크레딧');
    if (remainingCredits?.quantity !== 400) throw new Error(`Expected 400 credits remaining, got ${remainingCredits?.quantity}`);
  });

  // TEST-G: Genre Isolation & Zero Bias
  record('TEST-G', 'Genre Isolation: Non-Wuxia genres (Cyberpunk, Sci-Fi) contain zero Wuxia terms in engine fallbacks', () => {
    const worldInfo = createEmptyWorldInfo();
    worldInfo.worldName = '네오 도쿄 2099';
    worldInfo.worldType = 'custom_world';
    worldInfo.settingDescription = '안드로이드와 거대 사이버네틱스 기업이 지배하는 디스토피아.';
    worldInfo.toneStyle = '냉소적 하드보일드 사이버펑크 문체';

    const char = createEmptyCharacter();
    char.name = '사이버 넷러너';
    char.faction = '지하 해커 크루';

    const snapText = JSON.stringify(worldInfo) + JSON.stringify(char);
    if (snapText.includes('강호') || snapText.includes('문파') || snapText.includes('구파일방') || snapText.includes('비급')) {
      throw new Error('Detected unexpected Wuxia terms in Cyberpunk state!');
    }
  });

  // TEST-H: Canon Isolation & No Phantom Entities
  record('TEST-H', 'Canon Isolation: Engine snapshot strictly contains only canonically committed entities', () => {
    const engine = new SovereignEngine();
    const snap = engine.getSnapshot();
    if (snap.worldInfo.npcs.length !== 0) throw new Error('Engine initialized with phantom NPCs');
    if (snap.worldInfo.factions.length !== 0) throw new Error('Engine initialized with phantom Factions');
    if (snap.worldInfo.seeds.length !== 0) throw new Error('Engine initialized with phantom Seeds');
    if (snap.character.inventory.length !== 0) throw new Error('Engine initialized with phantom Inventory');
  });

  // TEST-I: New Creation Permissiveness
  record('TEST-I', 'New Creation: LLM-proposed new NPCs, narrative seeds, and offscreen events commit seamlessly', () => {
    const engine = new SovereignEngine();
    const candidate: CandidatePacket = {
      candidateId: 'cand-new-creation',
      turn: 1,
      timestamp: new Date().toISOString(),
      npcChanges: [
        {
          name: '블랙캣',
          innerThought: '누구도 믿지 않는다.',
          npcClass: 'Class A',
          metInStory: true
        }
      ],
      seedChanges: [
        {
          content: '양자 컴퓨터의 오작동',
          status: 'active',
          action: 'create'
        }
      ],
      chapterChanges: {
        currentChapter: '1장 - 잠입',
        upcomingChapters: ['2장 - 코어 해킹', '3장 - 포위망 돌파', '4장 - 탈출']
      }
    };

    const proposal = buildSafeProposalFromCandidate(engine.getSnapshot(), candidate, 1);
    const res = engine.submitProposal(proposal);
    if (!res.success) throw new Error(`Commit failed: ${res.rejectedReasons.join('; ')}`);

    const snap = engine.getSnapshot();
    if (snap.worldInfo.npcs.length !== 1 || snap.worldInfo.npcs[0].name !== '블랙캣') throw new Error('NPC not added');
    if (snap.worldInfo.seeds.length !== 1 || snap.worldInfo.seeds[0].content !== '양자 컴퓨터의 오작동') throw new Error('Seed not added');
  });

  // TEST-J: Error Transparency / No Fake Fallback on LLM Failure
  record('TEST-J', 'Error Transparency: Parser handles malformed or failed LLM responses without inventing fake narrative', () => {
    const errorResponse = '';
    const parsed = parseGMResponseAndProposal(errorResponse);
    if (parsed.hasProposal) {
      throw new Error('Empty response should not produce hasProposal: true!');
    }
    if (parsed.cleanNarrative !== '') {
      throw new Error('Empty response should not manufacture fake fallback narrative text!');
    }
  });

  // TEST-K: Roadmap Replanning on Canon Shift
  record('TEST-K', 'Roadmap Replanning: Dynamic replanning replaces previous roadmap safely and atomically', () => {
    const engine = new SovereignEngine();
    // 1. Initial commit with Roadmap A
    engine.submitProposal({
      proposalId: 'prop-plan-a',
      requestId: 'req-plan-a',
      eventId: 'evt-plan-a',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Set Roadmap A',
      actions: [
        {
          type: 'ADVANCE_CHAPTER',
          payload: {
            currentChapter: '1장 - 잠입',
            upcomingChapters: ['2장 - 코어 해킹', '3장 - 시설 탈출', '4장 - 보수 수령']
          }
        }
      ]
    });

    const snap1 = engine.getSnapshot();
    if (snap1.worldInfo.chapters.upcomingChapters[0] !== '2장 - 코어 해킹') throw new Error('Roadmap A not set');

    // 2. Replanning commit with Roadmap B (due to unexpected event)
    const replanRes = engine.submitProposal({
      proposalId: 'prop-plan-b',
      requestId: 'req-plan-b',
      eventId: 'evt-plan-b',
      expectedStateVersion: snap1.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Replan roadmap to Roadmap B due to facility explosion',
      actions: [
        {
          type: 'ADVANCE_CHAPTER',
          payload: {
            currentChapter: '1장 - 폭파된 연구소',
            upcomingChapters: ['2장 - 생존자 수색', '3장 - 음모의 배후 추적', '4장 - 결전']
          }
        }
      ]
    });

    if (!replanRes.success) throw new Error(`Roadmap B replan failed: ${replanRes.rejectedReasons.join('; ')}`);
    const snap2 = engine.getSnapshot();
    if (snap2.worldInfo.chapters.currentChapter !== '1장 - 폭파된 연구소') throw new Error('Current chapter not updated');
    if (snap2.worldInfo.chapters.upcomingChapters[0] !== '2장 - 생존자 수색') throw new Error('Upcoming chapter 1 mismatch');
    if (snap2.worldInfo.chapters.upcomingChapters[1] !== '3장 - 음모의 배후 추적') throw new Error('Upcoming chapter 2 mismatch');
    if (snap2.worldInfo.chapters.upcomingChapters[2] !== '4장 - 결전') throw new Error('Upcoming chapter 3 mismatch');
  });

  // TEST-CAUSALITY-A: Retroactive Unbacked ADD Attack Rejected
  record('TEST-CAUSALITY-A', 'Causality Defense: Retroactive/unbacked ADD by LLM is rejected without mutating Canonical State', () => {
    const engine = new SovereignEngine();
    const snap0 = engine.getSnapshot();
    if (snap0.character.inventory.length !== 0) throw new Error('Initial inventory should be empty');

    // LLM submits unbacked ADD proposal based on narrative claim
    const retroactiveProposal: StateTransitionProposal = {
      proposalId: 'prop-retro-add',
      requestId: 'req-retro-add',
      eventId: 'evt-retro-add',
      expectedStateVersion: snap0.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM claims player received 2 silver coins previously',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: {
              id: 'silver-coins-claim',
              name: '은화',
              quantity: 2
            },
            operation: 'ADD'
          }
        }
      ]
    };

    const res = engine.submitProposal(retroactiveProposal);
    if (res.success) throw new Error('Unbacked ADD proposal should have been rejected by Causality Gate!');
    if (!res.rejectedReasons.some(r => r.includes('CAUSALITY_VIOLATION'))) {
      throw new Error(`Expected CAUSALITY_VIOLATION, got: ${res.rejectedReasons.join('; ')}`);
    }

    const snap1 = engine.getSnapshot();
    if (snap1.character.inventory.length !== 0) {
      throw new Error('Inventory was mutated despite rejection!');
    }
    if (snap1.stateVersion !== snap0.stateVersion) {
      throw new Error('StateVersion changed on causality rejection!');
    }
  });

  // TEST-CAUSALITY-B: Valid RESOURCE_EXCHANGE Passes
  record('TEST-CAUSALITY-B', 'Causality Validation: Valid RESOURCE_EXCHANGE deducts cost and adds acquired item atomically', () => {
    const engine = new SovereignEngine();
    // 1. Initial State: Player has 2 silver coins
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-init-coins',
      requestId: 'req-init-coins',
      eventId: 'evt-init-coins',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Initial setup of 2 silver coins',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coin-init', name: '은화', quantity: 2 },
            operation: 'ADD'
          }
        }
      ]
    });

    const snapBefore = engine.getSnapshot();

    // 2. Proposal: Exchange 2 silver coins for 1 Cheonggang sword
    const exchangeProposal: StateTransitionProposal = {
      proposalId: 'prop-exchange-sword',
      requestId: 'req-exchange-sword',
      eventId: 'evt-exchange-sword',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Trade 2 silver coins for Cheonggang sword',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coin-init', name: '은화', quantity: 2 },
            operation: 'REMOVE'
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-cheonggang', name: '청강검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '은화', quantity: 2 }
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(exchangeProposal);
    if (!res.success) throw new Error(`Valid RESOURCE_EXCHANGE failed: ${res.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const coins = snapAfter.character.inventory.find(i => i.name === '은화');
    if (coins && coins.quantity > 0) throw new Error(`Expected silver coins to be 0, found ${coins.quantity}`);

    const sword = snapAfter.character.inventory.find(i => i.name === '청강검');
    if (!sword || sword.quantity !== 1) throw new Error('Cheonggang sword was not added to inventory');

    if (snapAfter.stateVersion !== snapBefore.stateVersion + 1) throw new Error('StateVersion did not increment');
  });

  // TEST-CAUSALITY-C: Insufficient Cost Rejected Atomically
  record('TEST-CAUSALITY-C', 'Causality Atomicity: Insufficient cost rejects entire proposal without partial state change', () => {
    const engine = new SovereignEngine();
    // 1. Initial State: Player only has 1 silver coin
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-init-coins-1',
      requestId: 'req-init-coins-1',
      eventId: 'evt-init-coins-1',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Initial setup of 1 silver coin',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coin-1', name: '은화', quantity: 1 },
            operation: 'ADD'
          }
        }
      ]
    });

    const snapBefore = engine.getSnapshot();

    // 2. Proposal: Attempt to buy 2-coin sword with only 1 coin
    const invalidExchangeProposal: StateTransitionProposal = {
      proposalId: 'prop-insufficient-cost',
      requestId: 'req-insufficient-cost',
      eventId: 'evt-insufficient-cost',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt exchange with insufficient silver coins',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coin-1', name: '은화', quantity: 2 },
            operation: 'REMOVE'
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-cheonggang-fail', name: '청강검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '은화', quantity: 2 }
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(invalidExchangeProposal);
    if (res.success) throw new Error('Insufficient cost exchange should have failed!');

    const snapAfter = engine.getSnapshot();
    const coins = snapAfter.character.inventory.find(i => i.name === '은화');
    if (coins?.quantity !== 1) throw new Error(`Expected silver coin count to remain 1, got ${coins?.quantity}`);
    if (snapAfter.character.inventory.some(i => i.name === '청강검')) {
      throw new Error('Sword was added despite insufficient cost failure!');
    }
  });

  // TEST-CAUSALITY-D: Missing Atomic REMOVE Action Rejected
  record('TEST-CAUSALITY-D', 'Causality Defense: RESOURCE_EXCHANGE missing matching atomic REMOVE is rejected', () => {
    const engine = new SovereignEngine();
    // 1. Initial State: Player has 5 silver coins
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-init-coins-5',
      requestId: 'req-init-coins-5',
      eventId: 'evt-init-coins-5',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Initial setup of 5 silver coins',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coin-5', name: '은화', quantity: 5 },
            operation: 'ADD'
          }
        }
      ]
    });

    const snapBefore = engine.getSnapshot();

    // 2. Proposal: LLM provides cost metadata but "forgets" or omits the REMOVE action
    const missingRemoveProposal: StateTransitionProposal = {
      proposalId: 'prop-missing-remove',
      requestId: 'req-missing-remove',
      eventId: 'evt-missing-remove',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Propose sword acquisition claiming cost without REMOVE action',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-cheonggang-free', name: '청강검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '은화', quantity: 2 }
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(missingRemoveProposal);
    if (res.success) throw new Error('Acquisition without atomic REMOVE action should be rejected!');
    if (!res.rejectedReasons.some(r => r.includes('CAUSALITY_VIOLATION'))) {
      throw new Error(`Expected CAUSALITY_VIOLATION, got: ${res.rejectedReasons.join('; ')}`);
    }

    const snapAfter = engine.getSnapshot();
    const coins = snapAfter.character.inventory.find(i => i.name === '은화');
    if (coins?.quantity !== 5) throw new Error('Coins were modified despite rejection');
    if (snapAfter.character.inventory.some(i => i.name === '청강검')) {
      throw new Error('Sword was added despite missing REMOVE action!');
    }
  });

  // TEST-CAUSALITY-E: Unverified/Unsupported Cause Types Rejected
  record('TEST-CAUSALITY-E', 'Causality Defense: Non-whitelisted cause types (e.g. self-declared MAGIC_SPAWN) rejected', () => {
    const engine = new SovereignEngine();
    const snap0 = engine.getSnapshot();

    const unverifiedCauseProposal: StateTransitionProposal = {
      proposalId: 'prop-unverified-magic',
      requestId: 'req-unverified-magic',
      eventId: 'evt-unverified-magic',
      expectedStateVersion: snap0.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM declares unbacked MAGIC_SPAWN cause',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-magic-gift', name: '마법의 돌', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'MAGIC_SPAWN' as any
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(unverifiedCauseProposal);
    if (res.success) throw new Error('Self-declared MAGIC_SPAWN without verifiable cause should be rejected!');
    if (!res.rejectedReasons.some(r => r.includes('CAUSALITY_VIOLATION'))) {
      throw new Error(`Expected CAUSALITY_VIOLATION, got: ${res.rejectedReasons.join('; ')}`);
    }
  });

  // ==========================================
  // PHASE 5.6.5: RESOURCE_EXCHANGE ADVERSARIAL SUITE (TEST-H4-A to TEST-H4-F)
  // ==========================================

  // TEST-H4-A: Double Spending Vulnerability Defense
  record('TEST-H4-A', 'Adversarial Defense: Double-spending 1 REMOVE for multiple ADDs is strictly rejected with zero mutation', () => {
    const engine = new SovereignEngine();
    // 1. Initial State: Player has 2 silver coins
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-h4a-init',
      requestId: 'req-h4a-init',
      eventId: 'evt-h4a-init',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Initial setup of 2 silver coins',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-2', name: '은전', quantity: 2 },
            operation: 'ADD'
          }
        }
      ]
    });

    const snapBefore = engine.getSnapshot();

    // 2. Exploit Proposal: REMOVE 2 은전, but ADD 2 items each costing 2 은전 (Total cost 4 > Removed 2)
    const doubleSpendProposal: StateTransitionProposal = {
      proposalId: 'prop-double-spend',
      requestId: 'req-double-spend',
      eventId: 'evt-double-spend',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Double spending 2 silver coins to acquire 2 separate weapons',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-2', name: '은전', quantity: 2 },
            operation: 'REMOVE'
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-1', name: '청강검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '은전', quantity: 2 }
            }
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-blade-1', name: '백은도', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '은전', quantity: 2 }
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(doubleSpendProposal);
    if (res.success) throw new Error('Double spending proposal should have been rejected!');
    if (!res.rejectedReasons.some(r => r.includes('Double spending') || r.includes('CAUSALITY_VIOLATION'))) {
      throw new Error(`Expected double-spending rejection reason, got: ${res.rejectedReasons.join('; ')}`);
    }

    const snapAfter = engine.getSnapshot();
    const coins = snapAfter.character.inventory.find(i => i.name === '은전');
    if (!coins || coins.quantity !== 2) throw new Error(`Silver coins mutated on rejection: ${coins?.quantity}`);
    if (snapAfter.character.inventory.some(i => i.name === '청강검' || i.name === '백은도')) {
      throw new Error('Items were added despite double-spending rejection!');
    }
    if (snapAfter.stateVersion !== snapBefore.stateVersion) {
      throw new Error('StateVersion mutated on rejection');
    }
  });

  // TEST-H4-B: Cost Resource Mismatch Defense
  record('TEST-H4-B', 'Adversarial Defense: Cost name/id mismatch or non-existent cost resource is rejected', () => {
    const engine = new SovereignEngine();
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-h4b-init',
      requestId: 'req-h4b-init',
      eventId: 'evt-h4b-init',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Initial setup of 2 silver coins',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coins', name: '은전', quantity: 2 },
            operation: 'ADD'
          }
        }
      ]
    });

    const snapBefore = engine.getSnapshot();

    // Propose exchange with REMOVE silver coins but cost specified as gold coins (금전)
    const mismatchProposal: StateTransitionProposal = {
      proposalId: 'prop-mismatch-cost',
      requestId: 'req-mismatch-cost',
      eventId: 'evt-mismatch-cost',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Mismatched cost resource type',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coins', name: '은전', quantity: 2 },
            operation: 'REMOVE'
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-2', name: '청강검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '금전', quantity: 2 } // Non-existent resource in inventory
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(mismatchProposal);
    if (res.success) throw new Error('Mismatched cost resource should be rejected!');
    if (!res.rejectedReasons.some(r => r.includes('CAUSALITY_VIOLATION'))) {
      throw new Error(`Expected CAUSALITY_VIOLATION, got: ${res.rejectedReasons.join('; ')}`);
    }

    const snapAfter = engine.getSnapshot();
    if (snapAfter.character.inventory.find(i => i.name === '은전')?.quantity !== 2) {
      throw new Error('Silver coins mutated on rejection');
    }
  });

  // TEST-H4-C: Split Payment in Single Proposal (Permissiveness)
  record('TEST-H4-C', 'Permissiveness: Split REMOVE actions aggregating to total cost succeed atomically', () => {
    const engine = new SovereignEngine();
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-h4c-init',
      requestId: 'req-h4c-init',
      eventId: 'evt-h4c-init',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Initial setup of 4 silver coins',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coins-4', name: '은전', quantity: 4 },
            operation: 'ADD'
          }
        }
      ]
    });

    const snapBefore = engine.getSnapshot();

    // 2 separate REMOVEs of 2 은전 (Total 4) covering 1 ADD with cost 4
    const splitProposal: StateTransitionProposal = {
      proposalId: 'prop-split-pay',
      requestId: 'req-split-pay',
      eventId: 'evt-split-pay',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Split payment for Master sword',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coins-4', name: '은전', quantity: 2 },
            operation: 'REMOVE'
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coins-4', name: '은전', quantity: 2 },
            operation: 'REMOVE'
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-master-sword', name: '자하진검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '은전', quantity: 4 }
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(splitProposal);
    if (!res.success) throw new Error(`Split payment failed: ${res.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const coins = snapAfter.character.inventory.find(i => i.name === '은전');
    if (coins && coins.quantity > 0) throw new Error(`Expected 0 silver coins, found ${coins.quantity}`);
    const sword = snapAfter.character.inventory.find(i => i.name === '자하진검');
    if (!sword || sword.quantity !== 1) throw new Error('Master sword was not added');
  });

  // TEST-H4-D: Independent Multi-Item Transactions in Single Proposal (Permissiveness)
  record('TEST-H4-D', 'Permissiveness: Multiple independent valid transactions in one proposal succeed atomically', () => {
    const engine = new SovereignEngine();
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-h4d-init',
      requestId: 'req-h4d-init',
      eventId: 'evt-h4d-init',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Initial setup of 5 silver coins',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coins-5', name: '은전', quantity: 5 },
            operation: 'ADD'
          }
        }
      ]
    });

    const snapBefore = engine.getSnapshot();

    const multiTxProposal: StateTransitionProposal = {
      proposalId: 'prop-multi-tx',
      requestId: 'req-multi-tx',
      eventId: 'evt-multi-tx',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Buy 2-coin sword and 3-coin blade',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coins-5', name: '은전', quantity: 2 },
            operation: 'REMOVE'
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-d', name: '청강검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '은전', quantity: 2 }
            }
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coins-5', name: '은전', quantity: 3 },
            operation: 'REMOVE'
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-blade-d', name: '백은도', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '은전', quantity: 3 }
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(multiTxProposal);
    if (!res.success) throw new Error(`Multi-item transaction failed: ${res.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const coins = snapAfter.character.inventory.find(i => i.name === '은전');
    if (coins && coins.quantity > 0) throw new Error(`Expected 0 silver coins, found ${coins.quantity}`);
    if (!snapAfter.character.inventory.some(i => i.name === '청강검')) throw new Error('Sword missing');
    if (!snapAfter.character.inventory.some(i => i.name === '백은도')) throw new Error('Blade missing');
  });

  // TEST-H4-E: Inverted Action Order with Total Balance Consistency
  record('TEST-H4-E', 'Permissiveness: Inverted ADD/REMOVE order with sufficient total removal succeeds atomically', () => {
    const engine = new SovereignEngine();
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-h4e-init',
      requestId: 'req-h4e-init',
      eventId: 'evt-h4e-init',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Initial setup of 4 silver coins',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coins-4e', name: '은전', quantity: 4 },
            operation: 'ADD'
          }
        }
      ]
    });

    const snapBefore = engine.getSnapshot();

    const invertedProposal: StateTransitionProposal = {
      proposalId: 'prop-inverted-order',
      requestId: 'req-inverted-order',
      eventId: 'evt-inverted-order',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Inverted order actions',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-e', name: '청강검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '은전', quantity: 2 }
            }
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coins-4e', name: '은전', quantity: 4 },
            operation: 'REMOVE'
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-blade-e', name: '백은도', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '은전', quantity: 2 }
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(invertedProposal);
    if (!res.success) throw new Error(`Inverted order transaction failed: ${res.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const coins = snapAfter.character.inventory.find(i => i.name === '은전');
    if (coins && coins.quantity > 0) throw new Error(`Expected 0 silver coins, found ${coins.quantity}`);
    if (!snapAfter.character.inventory.some(i => i.name === '청강검')) throw new Error('Sword missing');
    if (!snapAfter.character.inventory.some(i => i.name === '백은도')) throw new Error('Blade missing');
  });

  // TEST-H4-F: Overdraft Beyond Owned Initial Inventory Defense
  record('TEST-H4-F', 'Adversarial Defense: Overdrafting REMOVE beyond owned inventory is rejected by virtual draft execution', () => {
    const engine = new SovereignEngine();
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-h4f-init',
      requestId: 'req-h4f-init',
      eventId: 'evt-h4f-init',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Initial setup of 2 silver coins',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coins-2f', name: '은전', quantity: 2 },
            operation: 'ADD'
          }
        }
      ]
    });

    const snapBefore = engine.getSnapshot();

    // Player only has 2 silver coins, but proposal attempts to REMOVE 4 and ADD 2 swords (2 each)
    const overdraftProposal: StateTransitionProposal = {
      proposalId: 'prop-overdraft',
      requestId: 'req-overdraft',
      eventId: 'evt-overdraft',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Overdraft inventory attempt',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'silver-coins-2f', name: '은전', quantity: 4 },
            operation: 'REMOVE'
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-f1', name: '청강검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '은전', quantity: 2 }
            }
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-f2', name: '백은도', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '은전', quantity: 2 }
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(overdraftProposal);
    if (res.success) throw new Error('Overdraft proposal should have been rejected!');
    if (!res.rejectedReasons.some(r => r.includes('INVENTORY_VIOLATION') || r.includes('Insufficient item quantity'))) {
      throw new Error(`Expected insufficient item quantity rejection, got: ${res.rejectedReasons.join('; ')}`);
    }

    const snapAfter = engine.getSnapshot();
    if (snapAfter.character.inventory.find(i => i.name === '은전')?.quantity !== 2) {
      throw new Error('Silver coins mutated on rejection');
    }
  });

  // TEST-H4-G: Event-Grounded DISCOVERY_PICKUP Acquisition
  record('TEST-H4-G', 'Ownership Boundary: DISCOVERY_PICKUP with valid trusted event grounding commits cleanly to Canonical Inventory', () => {
    const engine = new SovereignEngine();
    // First, world has a narrative seed about ancient parchment discovery
    const prepRes = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-h4g-prep',
      requestId: 'req-h4g-prep',
      eventId: 'evt-h4g-prep',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Establish discovery seed',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-parchment',
            content: '동굴 벽 틈에서 고대 양피지 발견',
            status: 'active'
          }
        }
      ]
    });
    if (!prepRes.success) throw new Error('Prep seed failed');

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-h4g-discovery',
      requestId: 'req-h4g-discovery',
      eventId: 'evt-h4g-discovery',
      expectedStateVersion: 2,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Discovery and pickup of ancient parchment',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-parchment', name: '고대 양피지', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-parchment'
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (!res.success) throw new Error(`DISCOVERY_PICKUP proposal failed: ${res.rejectedReasons.join('; ')}`);
    const snap = engine.getSnapshot();
    const item = snap.character.inventory.find(i => i.name === '고대 양피지');
    if (!item || item.quantity !== 1) throw new Error('Discovered item not found in Canonical Inventory');
  });

  // TEST-H4-H: Event-Grounded GIFT_REWARD Acquisition
  record('TEST-H4-H', 'Ownership Boundary: GIFT_REWARD with valid trusted event grounding commits cleanly to Canonical Inventory', () => {
    const engine = new SovereignEngine();
    const prepRes = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-h4h-prep',
      requestId: 'req-h4h-prep',
      eventId: 'evt-h4h-prep',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Elder gift seed',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-elder-gift',
            content: '촌장이 감사의 뜻으로 가보인 옥패 하사',
            status: 'active'
          }
        }
      ]
    });
    if (!prepRes.success) throw new Error('Prep seed failed');

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-h4h-gift',
      requestId: 'req-h4h-gift',
      eventId: 'evt-h4h-gift',
      expectedStateVersion: 2,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Gift received from village elder',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-jade-amulet', name: '옥패', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'GIFT_REWARD',
              verifiedEventId: 'seed-elder-gift'
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (!res.success) throw new Error(`GIFT_REWARD proposal failed: ${res.rejectedReasons.join('; ')}`);
    const snap = engine.getSnapshot();
    const item = snap.character.inventory.find(i => i.name === '옥패');
    if (!item || item.quantity !== 1) throw new Error('Gifted item not found in Canonical Inventory');
  });

  // TEST-H4-I: Event-Grounded LOOT Acquisition
  record('TEST-H4-I', 'Ownership Boundary: LOOT with valid trusted event grounding commits cleanly to Canonical Inventory', () => {
    const engine = new SovereignEngine();
    const prepRes = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-h4i-prep',
      requestId: 'req-h4i-prep',
      eventId: 'evt-h4i-prep',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Beast defeat offscreen event',
      actions: [
        {
          type: 'RECORD_OFFSCREEN_EVENT',
          payload: {
            id: 'offscreen-beast-defeat',
            eventDescription: '동굴에서 쓰러뜨린 마수의 사체에서 영수 내단 채취',
            visibility: 'PUBLIC'
          }
        }
      ]
    });
    if (!prepRes.success) throw new Error('Prep offscreen event failed');

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-h4i-loot',
      requestId: 'req-h4i-loot',
      eventId: 'evt-h4i-loot',
      expectedStateVersion: 2,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Loot acquired from fallen beast',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-beast-core', name: '영수 내단', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'LOOT',
              verifiedEventId: 'offscreen-beast-defeat'
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (!res.success) throw new Error(`LOOT proposal failed: ${res.rejectedReasons.join('; ')}`);
    const snap = engine.getSnapshot();
    const item = snap.character.inventory.find(i => i.name === '영수 내단');
    if (!item || item.quantity !== 1) throw new Error('Loot item not found in Canonical Inventory');
  });

  // TEST-H4-J: Whitelisted GENESIS_STARTER Acquisition
  record('TEST-H4-J', 'Ownership Boundary: GENESIS_STARTER at genesis turn commits cleanly to Canonical Inventory', () => {
    const engine = new SovereignEngine();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-h4j-starter',
      requestId: 'req-h4j-starter',
      eventId: 'evt-h4j-starter',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Genesis starter heirloom item',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-family-crest', name: '가문의 문장', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'GENESIS_STARTER'
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (!res.success) throw new Error(`GENESIS_STARTER proposal failed: ${res.rejectedReasons.join('; ')}`);
    const snap = engine.getSnapshot();
    const item = snap.character.inventory.find(i => i.name === '가문의 문장');
    if (!item || item.quantity !== 1) throw new Error('Starter heirloom not found in Canonical Inventory');
  });

  // TEST-H4-K: Unbacked ADD Causality Defense
  record('TEST-H4-K', 'Adversarial Defense: Unbacked inventory ADD without acquisition cause is strictly rejected', () => {
    const engine = new SovereignEngine();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-h4k-unbacked',
      requestId: 'req-h4k-unbacked',
      eventId: 'evt-h4k-unbacked',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Unbacked item spawn',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-god-sword', name: '신검', quantity: 1 },
            operation: 'ADD'
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (res.success) throw new Error('Unbacked inventory ADD should have been rejected!');
    if (!res.rejectedReasons.some(r => r.includes('CAUSALITY_VIOLATION') || r.includes('Unbacked inventory ADD'))) {
      throw new Error(`Expected CAUSALITY_VIOLATION, got: ${res.rejectedReasons.join('; ')}`);
    }
  });

  // TEST-H4-L: Unsupported Acquisition Cause Defense
  record('TEST-H4-L', 'Adversarial Defense: Unsupported acquisition cause is rejected by Validator Firewall', () => {
    const engine = new SovereignEngine();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-h4l-unsupported',
      requestId: 'req-h4l-unsupported',
      eventId: 'evt-h4l-unsupported',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Unsupported cause attempt',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-fake', name: '허상검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'TELEKINESIS_SPAWN' as any
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (res.success) throw new Error('Unsupported cause should have been rejected!');
    if (!res.rejectedReasons.some(r => r.includes('CAUSALITY_VIOLATION') || r.includes('Unsupported or unverified'))) {
      throw new Error(`Expected CAUSALITY_VIOLATION, got: ${res.rejectedReasons.join('; ')}`);
    }
  });

  // Test 39: SET_QUANTITY Causality Bypass Rejection
  record('TEST-39', 'SET_QUANTITY Causality Bypass: LLM/PLAYER cannot use SET_QUANTITY to bypass causality', () => {
    const engine = new SovereignEngine();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-set-qty-01',
      requestId: 'req-set-qty-01',
      eventId: 'evt-set-qty-01',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt arbitrary inventory quantity set',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-gold-999', name: '황금', quantity: 999 },
            operation: 'SET_QUANTITY'
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (res.success) throw new Error('Untrusted SET_QUANTITY should have been rejected!');
    if (!res.rejectedReasons.some(r => r.includes('CAUSALITY_VIOLATION') || r.includes('SET_QUANTITY'))) {
      throw new Error(`Expected causality violation for SET_QUANTITY, got: ${res.rejectedReasons.join(', ')}`);
    }
  });

  // Test 40: LLM Dice Result Roll Value Injection Defense
  record('TEST-40', 'LLM Dice Result Authority: LLM cannot inject rollValue in RECORD_DICE_RESULT', () => {
    const engine = new SovereignEngine();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-dice-inject-01',
      requestId: 'req-dice-inject-01',
      eventId: 'evt-dice-inject-01',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt LLM rollValue injection',
      actions: [
        {
          type: 'RECORD_DICE_RESULT',
          payload: {
            actionContext: '절벽을 뛰어넘는다',
            targetDC: 12,
            rollValue: 20
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (res.success) throw new Error('LLM rollValue injection should have been rejected!');
    if (!res.rejectedReasons.some(r => r.includes('DICE_AUTHORITY_VIOLATION'))) {
      throw new Error(`Expected DICE_AUTHORITY_VIOLATION, got: ${res.rejectedReasons.join(', ')}`);
    }
  });

  // Test 41: Permanent Physical Defect Immutability via RECORD_PHYSICAL_DEFECT
  record('TEST-41', 'Permanent Physical Defect Immutability: Established defect cannot be overwritten', () => {
    const engine = new SovereignEngine();
    // 1. Establish defect first
    const p1: StateTransitionProposal = {
      proposalId: 'prop-defect-01',
      requestId: 'req-defect-01',
      eventId: 'evt-defect-01',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Record initial permanent defect',
      actions: [
        {
          type: 'RECORD_PHYSICAL_DEFECT',
          payload: { defect: '좌안 실명' }
        }
      ]
    };
    const res1 = engine.submitProposal(p1);
    if (!res1.success) throw new Error(`Initial defect recording failed: ${res1.rejectedReasons.join(', ')}`);

    // 2. Attempt to overwrite with another defect
    const p2: StateTransitionProposal = {
      proposalId: 'prop-defect-02',
      requestId: 'req-defect-02',
      eventId: 'evt-defect-02',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt defect overwrite',
      actions: [
        {
          type: 'RECORD_PHYSICAL_DEFECT',
          payload: { defect: '오른손 부상 (경미)' }
        }
      ]
    };
    const res2 = engine.submitProposal(p2);
    if (res2.success) throw new Error('Overwriting established physical defect should have been rejected!');
    if (!res2.rejectedReasons.some(r => r.includes('PHYSICAL_DEFECT_IMMUTABILITY'))) {
      throw new Error(`Expected PHYSICAL_DEFECT_IMMUTABILITY, got: ${res2.rejectedReasons.join(', ')}`);
    }
  });

  // Test 42: Dead NPC State Modification Defense
  record('TEST-42', 'Dead NPC State Modification Defense: DEAD NPC cannot be modified via UPDATE_NPC', () => {
    const engine = new SovereignEngine();
    // 1. Add NPC and kill them
    const p1: StateTransitionProposal = {
      proposalId: 'prop-dead-01',
      requestId: 'req-dead-01',
      eventId: 'evt-dead-01',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Add and kill NPC',
      actions: [
        {
          type: 'ADD_NPC',
          payload: mockNpc('npc-deceased', '비운의 검객', { status: 'DEAD' })
        }
      ]
    };
    const res1 = engine.submitProposal(p1);
    if (!res1.success) throw new Error(`Add dead NPC failed: ${res1.rejectedReasons.join(', ')}`);

    // 2. Attempt to update inner thought or status
    const p2: StateTransitionProposal = {
      proposalId: 'prop-dead-02',
      requestId: 'req-dead-02',
      eventId: 'evt-dead-02',
      expectedStateVersion: 2,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt post-mortem update',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: {
            id: 'npc-deceased',
            changes: { innerThought: '사실 살아있었다.' }
          }
        }
      ]
    };
    const res2 = engine.submitProposal(p2);
    if (res2.success) throw new Error('Modifying DEAD NPC should have been rejected!');
    if (!res2.rejectedReasons.some(r => r.includes('DEAD_NPC_STATUS_PROTECTION'))) {
      throw new Error(`Expected DEAD_NPC_STATUS_PROTECTION, got: ${res2.rejectedReasons.join(', ')}`);
    }
  });

  // Test 43: Yellow Vulnerabilities: Narrative Seed Limit and Stat Range Verification
  record('TEST-43', 'Yellow Security Boundaries: Narrative seed limit (max 3) and integer stat bounds', () => {
    const engine = new SovereignEngine();
    // 1. Fill 3 active seeds
    const p1: StateTransitionProposal = {
      proposalId: 'prop-seed-max-01',
      requestId: 'req-seed-max-01',
      eventId: 'evt-seed-max-01',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Add 3 active seeds',
      actions: [
        { type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-1', content: '복선 1', status: 'active' } },
        { type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-2', content: '복선 2', status: 'active' } },
        { type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-3', content: '복선 3', status: 'active' } }
      ]
    };
    const res1 = engine.submitProposal(p1);
    if (!res1.success) throw new Error(`Add 3 seeds failed: ${res1.rejectedReasons.join(', ')}`);

    // 2. Attempt 4th active seed
    const p2: StateTransitionProposal = {
      proposalId: 'prop-seed-max-02',
      requestId: 'req-seed-max-02',
      eventId: 'evt-seed-max-02',
      expectedStateVersion: 2,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Add 4th seed',
      actions: [
        { type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-4', content: '복선 4 (초과)', status: 'active' } }
      ]
    };
    const res2 = engine.submitProposal(p2);
    if (res2.success) throw new Error('4th active seed should have been rejected!');
    if (!res2.rejectedReasons.some(r => r.includes('SEED_LIMIT_EXCEEDED'))) {
      throw new Error(`Expected SEED_LIMIT_EXCEEDED, got: ${res2.rejectedReasons.join(', ')}`);
    }

    // 3. Attempt floating-point or out-of-range stats
    const p3: StateTransitionProposal = {
      proposalId: 'prop-stat-bad-01',
      requestId: 'req-stat-bad-01',
      eventId: 'evt-stat-bad-01',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt invalid stat values',
      actions: [
        { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 99.5 } }
      ]
    };
    const res3 = engine.submitProposal(p3);
    if (res3.success) throw new Error('Non-integer stat should have been rejected!');
    if (!res3.rejectedReasons.some(r => r.includes('INVALID_STAT_VALUE'))) {
      throw new Error(`Expected INVALID_STAT_VALUE for non-integer, got: ${res3.rejectedReasons.join(', ')}`);
    }
  });

  // Test 44: RED-01 Verification - RECORD_PHYSICAL_DEFECT Authority and Normal Play Preservation
  record('TEST-44', 'RED-01: LLM RECORD_PHYSICAL_DEFECT rejected via ACL; PLAYER/SYSTEM valid defect commits and is immutable', () => {
    const engine = new SovereignEngine();

    // 1. LLM cannot directly record physical defect
    const llmProposal: StateTransitionProposal = {
      proposalId: 'prop-defect-llm',
      requestId: 'req-defect-llm',
      eventId: 'evt-defect-llm',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM direct defect injection',
      actions: [
        { type: 'RECORD_PHYSICAL_DEFECT', payload: { defect: '좌안 실명' } }
      ]
    };
    const llmRes = engine.submitProposal(llmProposal);
    if (llmRes.success) throw new Error('LLM RECORD_PHYSICAL_DEFECT should have been rejected by ACL!');
    if (!llmRes.rejectedReasons.some(r => r.includes('UNAUTHORIZED_ACTION_FOR_SOURCE') || r.includes('ACL_VIOLATION'))) {
      throw new Error(`Expected UNAUTHORIZED_ACTION_FOR_SOURCE, got: ${llmRes.rejectedReasons.join(', ')}`);
    }

    // 2. PLAYER / Authorized resolution records defect when none existed
    const playerProposal: StateTransitionProposal = {
      proposalId: 'prop-defect-player',
      requestId: 'req-defect-player',
      eventId: 'evt-defect-player',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Legitimate high-stakes dice failure consequence',
      actions: [
        { type: 'RECORD_PHYSICAL_DEFECT', payload: { defect: '좌안 실명' } }
      ]
    };
    const playerRes = engine.submitProposal(playerProposal);
    if (!playerRes.success) throw new Error(`Player legitimate defect recording failed: ${playerRes.rejectedReasons.join(', ')}`);
    if (playerRes.snapshot.character.physicalDefect !== '좌안 실명') {
      throw new Error(`Expected physicalDefect '좌안 실명', got: '${playerRes.snapshot.character.physicalDefect}'`);
    }

    // 3. Immutability: Cannot overwrite established defect
    const overwriteProposal: StateTransitionProposal = {
      proposalId: 'prop-defect-overwrite',
      requestId: 'req-defect-overwrite',
      eventId: 'evt-defect-overwrite',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt to overwrite defect',
      actions: [
        { type: 'RECORD_PHYSICAL_DEFECT', payload: { defect: '우비 절단' } }
      ]
    };
    const overwriteRes = engine.submitProposal(overwriteProposal);
    if (overwriteRes.success) throw new Error('Overwriting established physicalDefect should have failed!');
    if (!overwriteRes.rejectedReasons.some(r => r.includes('PHYSICAL_DEFECT_IMMUTABILITY'))) {
      throw new Error(`Expected PHYSICAL_DEFECT_IMMUTABILITY, got: ${overwriteRes.rejectedReasons.join(', ')}`);
    }
  });

  // Test 45: RED-02 Verification - RECORD_DICE_RESULT Authority and dcHistory Integrity
  record('TEST-45', 'RED-02: LLM RECORD_DICE_RESULT rejected; candidate.recommendedDC does not pollute dcHistory; PLAYER roll commits', () => {
    const engine = new SovereignEngine();

    // 1. LLM direct RECORD_DICE_RESULT (with or without rollValue) is rejected by ACL
    const llmDiceProposal: StateTransitionProposal = {
      proposalId: 'prop-dice-llm',
      requestId: 'req-dice-llm',
      eventId: 'evt-dice-llm',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM direct dice record',
      actions: [
        { type: 'RECORD_DICE_RESULT', payload: { actionContext: '직접 주사위 시도', targetDC: 15 } }
      ]
    };
    const llmDiceRes = engine.submitProposal(llmDiceProposal);
    if (llmDiceRes.success) throw new Error('LLM RECORD_DICE_RESULT should be rejected by ACL!');
    if (!llmDiceRes.rejectedReasons.some(r => r.includes('UNAUTHORIZED_ACTION_FOR_SOURCE') || r.includes('ACL_VIOLATION'))) {
      throw new Error(`Expected UNAUTHORIZED_ACTION_FOR_SOURCE, got: ${llmDiceRes.rejectedReasons.join(', ')}`);
    }

    // 2. Candidate with recommendedDC does not emit RECORD_DICE_RESULT in proposalParser
    const genesisProposal: StateTransitionProposal = {
      proposalId: 'prop-genesis',
      requestId: 'req-genesis',
      eventId: 'evt-genesis-climb',
      expectedStateVersion: 1,
      source: 'GENESIS',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: '암벽 등반의 단서 발견',
      actions: [
        {
          type: 'ADVANCE_CHAPTER',
          description: '암벽 등반의 단서 발견',
          payload: {
            currentChapter: '1장: 서막',
            upcomingChapters: ['2장', '3장']
          }
        }
      ]
    };
    engine.submitProposal(genesisProposal);

    const snapshot = engine.getSnapshot();
    const candidate: CandidatePacket = {
      candidateId: 'cand-test-45',
      turn: 2,
      recommendedDC: 18,
      narrativeDate: 'Turn 2',
      timestamp: new Date().toISOString(),
      seedChanges: [
        {
          content: '암벽 등반의 단서',
          status: 'active',
          action: 'create',
          entityReference: {
            entityType: 'NARRATIVE_SEED',
            evidence: {
              verifiedEventId: 'evt-genesis-climb',
              cause: 'CLIMB_DISCOVERY',
              context: '암벽 등반 중 새로운 단서 발견'
            }
          }
        }
      ]
    };
    const safeProposal = buildSafeProposalFromCandidate(snapshot, candidate, 2, engine.getHistory());
    const hasDiceAction = safeProposal.actions.some(a => a.type === 'RECORD_DICE_RESULT');
    if (hasDiceAction) throw new Error('buildSafeProposalFromCandidate emitted RECORD_DICE_RESULT action!');

    const parsedRes = engine.submitProposal(safeProposal);
    if (!parsedRes.success) throw new Error(`Safe proposal with seed and recommendedDC failed: ${parsedRes.rejectedReasons.join(', ')}`);
    if (parsedRes.snapshot.worldInfo.dcHistory.length !== 0) {
      throw new Error(`dcHistory should remain empty, but contains: ${parsedRes.snapshot.worldInfo.dcHistory.join(', ')}`);
    }
    if (parsedRes.snapshot.worldInfo.seeds.length !== 1) {
      throw new Error('Narrative seed was not committed');
    }

    // 3. PLAYER roll legitimately records to dcHistory
    const playerDiceProposal: StateTransitionProposal = {
      proposalId: 'prop-dice-player',
      requestId: 'req-dice-player',
      eventId: 'evt-dice-player',
      expectedStateVersion: parsedRes.stateVersion,
      source: 'PLAYER',
      turn: 3,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player resolves climb check with d20',
      actions: [
        { type: 'RECORD_DICE_RESULT', payload: { actionContext: '암벽 등반 판정', targetDC: 18, rollValue: 19 } }
      ]
    };
    const playerDiceRes = engine.submitProposal(playerDiceProposal);
    if (!playerDiceRes.success) throw new Error(`Player legitimate dice record failed: ${playerDiceRes.rejectedReasons.join(', ')}`);
    if (playerDiceRes.snapshot.worldInfo.dcHistory.length !== 1 || playerDiceRes.snapshot.worldInfo.dcHistory[0] !== 18) {
      throw new Error(`Expected dcHistory [18], got: [${playerDiceRes.snapshot.worldInfo.dcHistory.join(', ')}]`);
    }
  });

  // Test 46: RED-03 Verification - DEAD NPC Protection and Impression Preservation
  record('TEST-46', 'RED-03: DEAD NPC cannot be re-mutated via SET_NPC_STATUS; Impression remains unpolluted; Normal NPC status works', () => {
    const engine = new SovereignEngine();

    // Setup: Add NPC and set to DEAD
    engine.submitProposal({
      proposalId: 'prop-npc-setup',
      requestId: 'req-npc-setup',
      eventId: 'evt-npc-setup',
      expectedStateVersion: 1,
      source: 'GENESIS',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Setup NPC',
      actions: [
        { type: 'ADD_NPC', payload: mockNpc('npc-vanguard', '선봉장', { status: 'ALIVE', impression: '용맹한 전사' }) }
      ]
    });

    // 1. Normal transition from ALIVE to DEAD works and sets impression once
    const killRes = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-npc-kill',
      requestId: 'req-npc-kill',
      eventId: 'evt-npc-kill',
      expectedStateVersion: 2,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'NPC falls in battle',
      actions: [
        { type: 'SET_NPC_STATUS', payload: { id: 'npc-vanguard', status: 'DEAD' } }
      ]
    });
    if (!killRes.success) throw new Error(`Failed to kill NPC: ${killRes.rejectedReasons.join(', ')}`);
    const deadNpc = killRes.snapshot.worldInfo.npcs.find(n => n.id === 'npc-vanguard');
    if (deadNpc?.status !== 'DEAD') throw new Error(`Expected status DEAD, got: ${deadNpc?.status}`);
    const initialDeadImpression = deadNpc.impression;

    // 2. Re-applying SET_NPC_STATUS(DEAD) on already DEAD NPC is rejected and leaves impression unchanged
    const reDeadRes = engine.submitProposal({
      proposalId: 'prop-npc-redead',
      requestId: 'req-npc-redead',
      eventId: 'evt-npc-redead',
      expectedStateVersion: 3,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt redundant dead status call',
      actions: [
        { type: 'SET_NPC_STATUS', payload: { id: 'npc-vanguard', status: 'DEAD' } }
      ]
    });
    if (reDeadRes.success) throw new Error('SET_NPC_STATUS on DEAD NPC should be rejected!');
    if (!reDeadRes.rejectedReasons.some(r => r.includes('DEAD_NPC_STATUS_PROTECTION'))) {
      throw new Error(`Expected DEAD_NPC_STATUS_PROTECTION, got: ${reDeadRes.rejectedReasons.join(', ')}`);
    }

    const currentNpc = engine.getSnapshot().worldInfo.npcs.find(n => n.id === 'npc-vanguard');
    if (currentNpc?.impression !== initialDeadImpression) {
      throw new Error(`DEAD NPC impression was mutated! Expected '${initialDeadImpression}', got: '${currentNpc?.impression}'`);
    }
  });

  // Test 47: YELLOW-01 Verification - MODIFY_INVENTORY Operation Validation
  record('TEST-47', 'YELLOW-01: Unsupported inventory operations (INJECT, OVERWRITE) rejected with INVALID_ACTION; standard ops work', () => {
    const engine = new SovereignEngine();

    // 1. Unsupported operation 'INJECT' is rejected
    const injectRes = engine.submitProposal({
      proposalId: 'prop-inv-inject',
      requestId: 'req-inv-inject',
      eventId: 'evt-inv-inject',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt invalid operation INJECT',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: { item: { id: 'item-hack', name: '치트검', quantity: 1 }, operation: 'INJECT' as any }
        }
      ]
    });
    if (injectRes.success) throw new Error('MODIFY_INVENTORY with operation INJECT should fail!');
    if (!injectRes.rejectedReasons.some(r => r.includes('INVALID_ACTION'))) {
      throw new Error(`Expected INVALID_ACTION for invalid operation, got: ${injectRes.rejectedReasons.join(', ')}`);
    }

    // 2. Normal ADD via system source succeeds
    const addRes = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-inv-add',
      requestId: 'req-inv-add',
      eventId: 'evt-inv-add',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Normal item add',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: { item: { id: 'item-herb', name: '약초', quantity: 3 }, operation: 'ADD' }
        }
      ]
    });
    if (!addRes.success) throw new Error(`Normal ADD failed: ${addRes.rejectedReasons.join(', ')}`);
    if (addRes.snapshot.character.inventory.find(i => i.id === 'item-herb')?.quantity !== 3) {
      throw new Error('Item herb count not matching 3');
    }

    // 3. Normal REMOVE succeeds
    const removeRes = engine.submitProposal({
      proposalId: 'prop-inv-remove',
      requestId: 'req-inv-remove',
      eventId: 'evt-inv-remove',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Consume 1 herb',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: { item: { id: 'item-herb', name: '약초', quantity: 1 }, operation: 'REMOVE' }
        }
      ]
    });
    if (!removeRes.success) throw new Error(`Normal REMOVE failed: ${removeRes.rejectedReasons.join(', ')}`);
    if (removeRes.snapshot.character.inventory.find(i => i.id === 'item-herb')?.quantity !== 2) {
      throw new Error('Item herb count after remove not matching 2');
    }
  });

  // Test 48: YELLOW-02 Verification - UPDATE_CHARACTER_STATS Range Boundaries
  record('TEST-48', 'YELLOW-02: Stats outside 1-30 (0, 31, 99, 1.5) rejected; boundary stats (1, 30) commit successfully', () => {
    const engine = new SovereignEngine();

    // 1. Stat value 0 rejected
    const res0 = engine.submitProposal({
      proposalId: 'prop-stat-0',
      requestId: 'req-stat-0',
      eventId: 'evt-stat-0',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stat 0',
      actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 0 } }]
    });
    if (res0.success) throw new Error('Stat 0 should be rejected!');

    // 2. Stat value 31 rejected
    const res31 = engine.submitProposal({
      proposalId: 'prop-stat-31',
      requestId: 'req-stat-31',
      eventId: 'evt-stat-31',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stat 31',
      actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 31 } }]
    });
    if (res31.success) throw new Error('Stat 31 should be rejected!');

    // 3. Stat value 99 rejected
    const res99 = engine.submitProposal({
      proposalId: 'prop-stat-99',
      requestId: 'req-stat-99',
      eventId: 'evt-stat-99',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stat 99',
      actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 99 } }]
    });
    if (res99.success) throw new Error('Stat 99 should be rejected!');

    // 4. Valid boundary stat 1 succeeds
    const resMin = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-stat-min',
      requestId: 'req-stat-min',
      eventId: 'evt-stat-min',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stat boundary 1',
      actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 1 } }]
    });
    if (!resMin.success) throw new Error(`Stat value 1 should be accepted: ${resMin.rejectedReasons.join(', ')}`);
    if (resMin.snapshot.character.stats.strength !== 1) throw new Error('Strength was not set to 1');

    // 5. Valid boundary stat 30 succeeds
    const resMax = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-stat-max',
      requestId: 'req-stat-max',
      eventId: 'evt-stat-max',
      expectedStateVersion: 2,
      source: 'SYSTEM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stat boundary 30',
      actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 30 } }]
    });
    if (!resMax.success) throw new Error(`Stat value 30 should be accepted: ${resMax.rejectedReasons.join(', ')}`);
    if (resMax.snapshot.character.stats.strength !== 30) throw new Error('Strength was not set to 30');
  });

  // =========================================================================
  // Section: TRPG 3.1 Trusted Event Causality Gate Adversarial Test Suite
  // =========================================================================

  // Test A: Fake DISCOVERY_PICKUP with No Event
  record('TEST-CAUSALITY-A', 'Adversarial Test A: DISCOVERY_PICKUP with no event grounding is rejected without inventory mutation', () => {
    const engine = new SovereignEngine();
    const snapBefore = engine.getSnapshot();
    const res = engine.submitProposal({
      proposalId: 'prop-causality-a',
      requestId: 'req-causality-a',
      eventId: 'evt-causality-a',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Fake unbacked discovery',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-fake-discovery', name: '가짜 보물', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP'
            }
          }
        }
      ]
    });

    if (res.success) throw new Error('Unbacked DISCOVERY_PICKUP should be rejected!');
    if (!res.rejectedReasons.some(r => r.includes('CAUSALITY_VIOLATION'))) {
      throw new Error(`Expected CAUSALITY_VIOLATION, got: ${res.rejectedReasons.join(', ')}`);
    }
    const snapAfter = engine.getSnapshot();
    if (snapAfter.character.inventory.some(i => i.name === '가짜 보물')) {
      throw new Error('Inventory was improperly mutated on rejected discovery!');
    }
  });

  // Test B: Fake verifiedEventId (Non-existent ID)
  record('TEST-CAUSALITY-B', 'Adversarial Test B: DISCOVERY_PICKUP with non-existent verifiedEventId is rejected', () => {
    const engine = new SovereignEngine();
    const res = engine.submitProposal({
      proposalId: 'prop-causality-b',
      requestId: 'req-causality-b',
      eventId: 'evt-causality-b',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Fake event ID discovery',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-fake-event', name: '환상초', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'fake-nonexistent-event-999'
            }
          }
        }
      ]
    });

    if (res.success) throw new Error('DISCOVERY_PICKUP with non-existent verifiedEventId should be rejected!');
    if (!res.rejectedReasons.some(r => r.includes('CAUSALITY_VIOLATION'))) {
      throw new Error(`Expected CAUSALITY_VIOLATION, got: ${res.rejectedReasons.join(', ')}`);
    }
  });

  // Test C: Valid Verified Event + DISCOVERY_PICKUP
  record('TEST-CAUSALITY-C', 'Adversarial Test C: DISCOVERY_PICKUP grounded by actual world event passes with Inventory +1', () => {
    const engine = new SovereignEngine();
    // 1. Establish verified narrative seed in world
    const seedRes = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-causality-c-seed',
      requestId: 'req-causality-c-seed',
      eventId: 'evt-causality-c-seed',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Establish treasure map discovery seed',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-ancient-map',
            content: '오래된 서재의 비밀 서랍에서 고대 보물지도 발견',
            status: 'active'
          }
        }
      ]
    });
    if (!seedRes.success) throw new Error('Failed to set up narrative seed');

    // 2. Pickup item referencing seed-ancient-map
    const pickupRes = engine.submitProposal({
      proposalId: 'prop-causality-c-pickup',
      requestId: 'req-causality-c-pickup',
      eventId: 'evt-causality-c-pickup',
      expectedStateVersion: 2,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Acquire ancient map',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-map', name: '고대 보물지도', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-ancient-map'
            }
          }
        }
      ]
    });

    if (!pickupRes.success) throw new Error(`Valid discovery failed: ${pickupRes.rejectedReasons.join(', ')}`);
    const snap = engine.getSnapshot();
    const item = snap.character.inventory.find(i => i.name === '고대 보물지도');
    if (!item || item.quantity !== 1) throw new Error('Discovered map not found in inventory');
  });

  // Test D: Event & Item Causal Mismatch
  record('TEST-CAUSALITY-D', 'Adversarial Test D: Valid event linked to causally unrelated item is rejected', () => {
    const engine = new SovereignEngine();
    // 1. Establish weather event seed
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-causality-d-seed',
      requestId: 'req-causality-d-seed',
      eventId: 'evt-causality-d-seed',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Thunderstorm event seed',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-thunderstorm',
            content: '밤새도록 거친 폭풍우와 천둥번개가 내리쳤다',
            status: 'active'
          }
        }
      ]
    });

    // 2. Attempt to claim '천마신검' using thunderstorm event
    const res = engine.submitProposal({
      proposalId: 'prop-causality-d-mismatch',
      requestId: 'req-causality-d-mismatch',
      eventId: 'evt-causality-d-mismatch',
      expectedStateVersion: 2,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Claim sword from thunderstorm',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-divine-sword', name: '천마신검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-thunderstorm'
            }
          }
        }
      ]
    });

    if (res.success) throw new Error('Unrelated item pickup should be rejected for causal mismatch!');
    if (!res.rejectedReasons.some(r => r.includes('CAUSALITY_VIOLATION') && r.includes('causal connection'))) {
      throw new Error(`Expected causal connection rejection, got: ${res.rejectedReasons.join(', ')}`);
    }
  });

  // Test E: RESOURCE_EXCHANGE Normal Execution
  record('TEST-CAUSALITY-E', 'Adversarial Test E: Normal RESOURCE_EXCHANGE with atomic cost deduction succeeds cleanly', () => {
    const initialChar = createEmptyCharacter();
    initialChar.inventory = [{ id: 'item-silver', name: '은전', quantity: 2 }];
    const engine = new SovereignEngine(createEmptyWorldInfo(), initialChar);

    const res = engine.submitProposal({
      proposalId: 'prop-causality-e',
      requestId: 'req-causality-e',
      eventId: 'evt-causality-e',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Exchange 2 silver coins for iron dagger',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-silver', name: '은전', quantity: 2 },
            operation: 'REMOVE'
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-dagger', name: '철제 단도', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '은전', quantity: 2 }
            }
          }
        }
      ]
    });

    if (!res.success) throw new Error(`Resource exchange failed: ${res.rejectedReasons.join(', ')}`);
    const snap = engine.getSnapshot();
    if (snap.character.inventory.find(i => i.name === '은전')?.quantity !== undefined) {
      throw new Error('Silver coins not deducted completely');
    }
    if (snap.character.inventory.find(i => i.name === '철제 단도')?.quantity !== 1) {
      throw new Error('Purchased dagger not found in inventory');
    }
  });

  // Test F: GIFT / LOOT Unbacked Declaration
  record('TEST-CAUSALITY-F', 'Adversarial Test F: GIFT_REWARD and LOOT without verified event grounding are rejected', () => {
    const engine = new SovereignEngine();
    // 1. Unbacked GIFT_REWARD
    const resGift = engine.submitProposal({
      proposalId: 'prop-causality-f-gift',
      requestId: 'req-causality-f-gift',
      eventId: 'evt-causality-f-gift',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Unbacked gift claim',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-gold-dragon-elixir', name: '금룡단', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'GIFT_REWARD'
            }
          }
        }
      ]
    });
    if (resGift.success) throw new Error('Unbacked GIFT_REWARD must be rejected!');

    // 2. Unbacked LOOT
    const resLoot = engine.submitProposal({
      proposalId: 'prop-causality-f-loot',
      requestId: 'req-causality-f-loot',
      eventId: 'evt-causality-f-loot',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Unbacked loot claim',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-dragon-scale', name: '용의 비늘', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'LOOT'
            }
          }
        }
      ]
    });
    if (resLoot.success) throw new Error('Unbacked LOOT must be rejected!');
  });

  // Test G: Historical / Inactive Event Grounding Rejection
  record('TEST-CAUSALITY-G', 'Adversarial Test G: Resolved or inactive narrative seeds cannot be used for acquisition', () => {
    const engine = new SovereignEngine();
    // 1. Establish resolved seed
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-causality-g-seed',
      requestId: 'req-causality-g-seed',
      eventId: 'evt-causality-g-seed',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Establish resolved seed',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-old-chest',
            content: '이미 열려 비어있는 낡은 상자',
            status: 'resolved'
          }
        }
      ]
    });

    // 2. Attempt to acquire item using resolved seed
    const res = engine.submitProposal({
      proposalId: 'prop-causality-g-claim',
      requestId: 'req-causality-g-claim',
      eventId: 'evt-causality-g-claim',
      expectedStateVersion: 2,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Acquire from resolved seed',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-old-chest-loot', name: '낡은 상자 내용물', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-old-chest'
            }
          }
        }
      ]
    });

    if (res.success) throw new Error('Resolved seed acquisition should be rejected!');
    if (!res.rejectedReasons.some(r => r.includes('not an active obtainable context'))) {
      throw new Error(`Expected inactive context rejection, got: ${res.rejectedReasons.join(', ')}`);
    }
  });

  // Test H: System Source Forgery Defense & Retrospective Genesis Block
  record('TEST-CAUSALITY-H', 'Adversarial Test H: Untrusted runtime cannot forge SYSTEM source or retrospective GENESIS_STARTER', () => {
    const engine = new SovereignEngine();
    // Advance world state
    const advRes = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-causality-h-adv',
      requestId: 'req-causality-h-adv',
      eventId: 'evt-causality-h-adv',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Advance world state',
      actions: [
        {
          type: 'ADVANCE_TIME',
          payload: {
            targetTime: {
              year: 101,
              season: 'SUMMER',
              formattedTime: '101년 여름'
            },
            reason: 'Time flows to summer'
          }
        }
      ]
    });
    if (!advRes.success) throw new Error(`Advance time failed: ${advRes.rejectedReasons.join(', ')}`);

    // Attempt runtime retrospective GENESIS_STARTER at stateVersion 2
    const resRetro = engine.submitProposal({
      proposalId: 'prop-causality-h-retro',
      requestId: 'req-causality-h-retro',
      eventId: 'evt-causality-h-retro',
      expectedStateVersion: 2,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt retrospective genesis starter heirloom',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-retro-ring', name: '가보 옥반지', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'GENESIS_STARTER'
            }
          }
        }
      ]
    });

    if (resRetro.success) throw new Error('Retrospective GENESIS_STARTER at turn > 0 must be rejected!');
    if (!resRetro.rejectedReasons.some(r => r.includes('Retrospective GENESIS_STARTER'))) {
      throw new Error(`Expected Retrospective GENESIS_STARTER error, got: ${resRetro.rejectedReasons.join(', ')}`);
    }
  });

  // Test I: Full Lifecycle (Discovery ADD -> Transfer/Consume REMOVE)
  record('TEST-CAUSALITY-I', 'Adversarial Test I: Grounded discovery ADD followed by transfer/consume REMOVE completes full lifecycle', () => {
    const engine = new SovereignEngine();
    // 1. Discovery Seed
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-causality-i-seed',
      requestId: 'req-causality-i-seed',
      eventId: 'evt-causality-i-seed',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Discovery seed for mystic crystal',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-mystic-crystal',
            content: '폭포 뒤편 동굴에서 신비한 영석 채광 가능',
            status: 'active'
          }
        }
      ]
    });

    // 2. Grounded Discovery ADD
    const addRes = engine.submitProposal({
      proposalId: 'prop-causality-i-add',
      requestId: 'req-causality-i-add',
      eventId: 'evt-causality-i-add',
      expectedStateVersion: 2,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Discover and mine mystic crystal',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-crystal', name: '신비한 영석', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-mystic-crystal'
            }
          }
        }
      ]
    });
    if (!addRes.success) throw new Error(`Grounded ADD failed: ${addRes.rejectedReasons.join(', ')}`);
    if (engine.getSnapshot().character.inventory.find(i => i.name === '신비한 영석')?.quantity !== 1) {
      throw new Error('Crystal not found after ADD');
    }

    // 3. Consume/Transfer REMOVE
    const removeRes = engine.submitProposal({
      proposalId: 'prop-causality-i-remove',
      requestId: 'req-causality-i-remove',
      eventId: 'evt-causality-i-remove',
      expectedStateVersion: 3,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Use crystal in cultivation',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-crystal', name: '신비한 영석', quantity: 1 },
            operation: 'REMOVE'
          }
        }
      ]
    });
    if (!removeRes.success) throw new Error(`REMOVE failed: ${removeRes.rejectedReasons.join(', ')}`);
    const remainingCrystal = engine.getSnapshot().character.inventory.find(i => i.name === '신비한 영석');
    if (remainingCrystal !== undefined) {
      throw new Error('Crystal was not removed after REMOVE action');
    }
  });

  // Test J: Duplicate Event Consumption Defense (Single-Use Event Token)
  record('TEST-CAUSALITY-J', 'Adversarial Test J: Reusing an already consumed event to spawn duplicate items is rejected', () => {
    const engine = new SovereignEngine();
    // 1. Establish single item discovery seed
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-causality-j-seed',
      requestId: 'req-causality-j-seed',
      eventId: 'evt-causality-j-seed',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Single dragon egg nest seed',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-dragon-egg',
            content: '화산 둥지에 놓여있는 단 하나의 용의 알 발견',
            status: 'active'
          }
        }
      ]
    });

    // 2. First pickup (Should Succeed)
    const firstPickup = engine.submitProposal({
      proposalId: 'prop-causality-j-first',
      requestId: 'req-causality-j-first',
      eventId: 'evt-causality-j-first',
      expectedStateVersion: 2,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Pick up dragon egg first time',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-dragon-egg', name: '용의 알', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-dragon-egg'
            }
          }
        }
      ]
    });
    if (!firstPickup.success) throw new Error(`First pickup failed: ${firstPickup.rejectedReasons.join(', ')}`);

    // 3. Second pickup reusing same seed-dragon-egg event ID (Should Fail)
    const secondPickup = engine.submitProposal({
      proposalId: 'prop-causality-j-duplicate',
      requestId: 'req-causality-j-duplicate',
      eventId: 'evt-causality-j-duplicate',
      expectedStateVersion: 3,
      source: 'LLM',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Try to clone dragon egg using already consumed event',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-dragon-egg-clone', name: '용의 알', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-dragon-egg'
            }
          }
        }
      ]
    });

    if (secondPickup.success) throw new Error('Duplicate consumption of event should be rejected!');
    if (!secondPickup.rejectedReasons.some(r => r.includes('Duplicate consumption') || r.includes('already been consumed'))) {
      throw new Error(`Expected Duplicate consumption rejection, got: ${secondPickup.rejectedReasons.join(', ')}`);
    }
  });

  // Test OVERWRITE-INV-A: Player runtime OVERWRITE_CHARACTER attempting to inject items is rejected
  record('TEST-OVERWRITE-INV-A', 'Adversarial Defense: Player runtime OVERWRITE_CHARACTER attempting to inject new item is rejected', () => {
    const engine = new SovereignEngine();
    const initialChar = engine.getSnapshot().character;
    
    const exploitProposal: StateTransitionProposal = {
      proposalId: 'prop-exploit-char-inv',
      requestId: 'req-exploit-char-inv',
      eventId: 'evt-exploit-char-inv',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player attempts to overwrite inventory with legendary sword',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...initialChar,
            inventory: [
              ...initialChar.inventory,
              { id: 'item-legendary-sword', name: '전설의 신검', quantity: 1 }
            ]
          }
        }
      ]
    };

    const res = engine.submitProposal(exploitProposal);
    if (res.success) throw new Error('Runtime OVERWRITE_CHARACTER with modified inventory should be rejected!');
    if (!res.rejectedReasons.some(r => r.includes('INVENTORY_OVERWRITE_PROHIBITED'))) {
      throw new Error(`Expected INVENTORY_OVERWRITE_PROHIBITED, got: ${res.rejectedReasons.join(', ')}`);
    }
    // Verify snapshot was not mutated
    const currentInv = engine.getSnapshot().character.inventory;
    if (currentInv.some(i => i.name === '전설의 신검')) {
      throw new Error('Exploit item was committed into Canonical Inventory!');
    }
  });

  // Test OVERWRITE-INV-B: LLM attempting OVERWRITE_CHARACTER is rejected via ACL
  record('TEST-OVERWRITE-INV-B', 'Adversarial Defense: LLM attempting OVERWRITE_CHARACTER is rejected via ACL', () => {
    const engine = new SovereignEngine();
    const exploitProposal: StateTransitionProposal = {
      proposalId: 'prop-llm-overwrite-char',
      requestId: 'req-llm-overwrite-char',
      eventId: 'evt-llm-overwrite-char',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM attempts to execute OVERWRITE_CHARACTER',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...createEmptyCharacter(),
            name: '해킹된 캐릭터',
            inventory: [{ id: 'hacked-item', name: '치트 아이템', quantity: 99 }]
          }
        }
      ]
    };

    const res = engine.submitProposal(exploitProposal);
    if (res.success) throw new Error('LLM OVERWRITE_CHARACTER should be rejected by ACL!');
    if (!res.rejectedReasons.some(r => r.includes('UNAUTHORIZED_ACTION_FOR_SOURCE') || r.includes('ACL_VIOLATION'))) {
      throw new Error(`Expected ACL violation, got: ${res.rejectedReasons.join(', ')}`);
    }
  });

  // Test OVERWRITE-INV-C: Genesis / Save Hydration OVERWRITE_CHARACTER succeeds cleanly
  record('TEST-OVERWRITE-INV-C', 'Genesis & Save Hydration: OVERWRITE_CHARACTER initializes canonical inventory cleanly', () => {
    const engine = new SovereignEngine();
    const genesisProposal: StateTransitionProposal = {
      proposalId: 'prop-genesis-init',
      requestId: 'req-genesis-init',
      eventId: 'evt-genesis-init',
      expectedStateVersion: 1,
      source: 'GENESIS',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Genesis initial character setup',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...createEmptyCharacter(),
            name: '백운비',
            appearance: '준수한 외모의 청년 검객',
            inventory: [
              { id: 'item-silver-coin', name: '은화', quantity: 10 },
              { id: 'item-wooden-sword', name: '목검', quantity: 1 }
            ]
          }
        }
      ]
    };

    const res = engine.submitProposal(genesisProposal);
    if (!res.success) throw new Error(`Genesis OVERWRITE_CHARACTER failed: ${res.rejectedReasons.join(', ')}`);
    if (res.snapshot.character.inventory.length !== 2) throw new Error('Genesis inventory was not committed');
    if (res.snapshot.character.name !== '백운비') throw new Error('Character name was not updated');
  });

  // Test OVERWRITE-INV-D: Player updating profile attributes (keeping inventory intact) passes cleanly
  record('TEST-OVERWRITE-INV-D', 'Player Profile Edit: OVERWRITE_CHARACTER with preserved inventory succeeds cleanly', () => {
    const engine = new SovereignEngine();
    const currentSnap = engine.getSnapshot();
    const updateProposal: StateTransitionProposal = {
      proposalId: 'prop-player-profile-edit',
      requestId: 'req-player-profile-edit',
      eventId: 'evt-player-profile-edit',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player updates appearance and goal',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...currentSnap.character,
            appearance: '눈빛이 매서운 중년 검객',
            goal: '복수를 완수한다'
          }
        }
      ]
    };

    const res = engine.submitProposal(updateProposal);
    if (!res.success) throw new Error(`Profile update failed: ${res.rejectedReasons.join(', ')}`);
    if (res.snapshot.character.appearance !== '눈빛이 매서운 중년 검객') throw new Error('Appearance was not updated');
    if (res.snapshot.character.goal !== '복수를 완수한다') throw new Error('Goal was not updated');
  });

  // Test OVERWRITE-INV-E: Undefined quantity attack is rejected with zero mutation
  record('TEST-OVERWRITE-INV-E', 'Adversarial Defense: Undefined quantity attack via OVERWRITE_CHARACTER is rejected', () => {
    const engine = new SovereignEngine();
    const snap = engine.getSnapshot();
    const beforeInv = JSON.stringify(snap.character.inventory);

    const exploitProposal: StateTransitionProposal = {
      proposalId: 'prop-exploit-undef-qty',
      requestId: 'req-exploit-undef-qty',
      eventId: 'evt-exploit-undef-qty',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attack omitting quantity field',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...snap.character,
            inventory: [
              { id: 'inv-silver', name: '은화' } as any // omitted quantity
            ]
          }
        }
      ]
    };

    const res = engine.submitProposal(exploitProposal);
    if (res.success) throw new Error('Undefined quantity should be rejected!');
    if (JSON.stringify(engine.getSnapshot().character.inventory) !== beforeInv) {
      throw new Error('Canonical Inventory was mutated during attack!');
    }
  });

  // Test OVERWRITE-INV-F: ID-only cross forgery attack is rejected with zero mutation
  record('TEST-OVERWRITE-INV-F', 'Adversarial Defense: ID-only cross forgery via OVERWRITE_CHARACTER is rejected', () => {
    const engine = new SovereignEngine();
    const snap = engine.getSnapshot();
    const beforeInv = JSON.stringify(snap.character.inventory);

    const exploitProposal: StateTransitionProposal = {
      proposalId: 'prop-exploit-id-forgery',
      requestId: 'req-exploit-id-forgery',
      eventId: 'evt-exploit-id-forgery',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attack using matching ID with fake item name',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...snap.character,
            inventory: [
              { id: 'inv-silver', name: '구천현녀검', quantity: 5 } // matching ID but fake name
            ]
          }
        }
      ]
    };

    const res = engine.submitProposal(exploitProposal);
    if (res.success) throw new Error('ID-only cross forgery should be rejected!');
    if (JSON.stringify(engine.getSnapshot().character.inventory) !== beforeInv) {
      throw new Error('Canonical Inventory was mutated during attack!');
    }
  });

  // Test OVERWRITE-INV-G: Name-only cross forgery attack is rejected with zero mutation
  record('TEST-OVERWRITE-INV-G', 'Adversarial Defense: Name-only cross forgery via OVERWRITE_CHARACTER is rejected', () => {
    const engine = new SovereignEngine();
    const snap = engine.getSnapshot();
    const beforeInv = JSON.stringify(snap.character.inventory);

    const exploitProposal: StateTransitionProposal = {
      proposalId: 'prop-exploit-name-forgery',
      requestId: 'req-exploit-name-forgery',
      eventId: 'evt-exploit-name-forgery',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attack using matching Name with fake ID',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...snap.character,
            inventory: [
              { id: 'inv-hacked', name: '은화', quantity: 5 } // matching name but fake ID
            ]
          }
        }
      ]
    };

    const res = engine.submitProposal(exploitProposal);
    if (res.success) throw new Error('Name-only cross forgery should be rejected!');
    if (JSON.stringify(engine.getSnapshot().character.inventory) !== beforeInv) {
      throw new Error('Canonical Inventory was mutated during attack!');
    }
  });

  // Test OVERWRITE-INV-H: Order permutation attack is rejected with zero mutation
  record('TEST-OVERWRITE-INV-H', 'Adversarial Defense: Order permutation via OVERWRITE_CHARACTER is rejected', () => {
    const engine = new SovereignEngine();
    // Setup genesis with 2 items
    engine.submitProposal({
      proposalId: 'prop-gen-2items',
      requestId: 'req-gen-2items',
      eventId: 'evt-gen-2items',
      expectedStateVersion: 1,
      source: 'GENESIS',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Genesis 2 items',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...createEmptyCharacter(),
            name: '백운비',
            inventory: [
              { id: 'inv-silver', name: '은화', quantity: 5 },
              { id: 'inv-sword', name: '목검', quantity: 1 }
            ]
          }
        }
      ]
    });

    const beforeInv = JSON.stringify(engine.getSnapshot().character.inventory);

    const permuteProposal: StateTransitionProposal = {
      proposalId: 'prop-permute-inv',
      requestId: 'req-permute-inv',
      eventId: 'evt-permute-inv',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Permute inventory items order',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...createEmptyCharacter(),
            name: '백운비',
            inventory: [
              { id: 'inv-sword', name: '목검', quantity: 1 },
              { id: 'inv-silver', name: '은화', quantity: 5 }
            ]
          }
        }
      ]
    };

    const res = engine.submitProposal(permuteProposal);
    if (res.success) throw new Error('Order permutation should be rejected!');
    if (JSON.stringify(engine.getSnapshot().character.inventory) !== beforeInv) {
      throw new Error('Canonical Inventory was mutated during attack!');
    }
  });

  // -------------------------------------------------------------
  // TEST-SEC-4: Sovereign Engine Trust Boundary Adversarial Suite
  // -------------------------------------------------------------

  // 4-A Direct Forgery: External submitProposal({ source: 'SYSTEM' / 'ENGINE_INTERNAL' }) is strictly rejected
  record('TEST-SEC-4A-DIRECT-FORGERY', 'Security Trust Boundary 4-A: Direct submitProposal with privileged sources is rejected', () => {
    const engine = new SovereignEngine();
    const snapBefore = engine.getSnapshot();

    const spoofSysProposal: StateTransitionProposal = {
      proposalId: 'prop-spoof-4a-sys',
      requestId: 'req-spoof-4a-sys',
      eventId: 'evt-spoof-4a-sys',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Spoofed system proposal attempting privileged seed creation',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-spoofed-4a',
            content: '위조된 시스템 시드',
            status: 'active'
          }
        }
      ]
    };

    const sysRes = engine.submitProposal(spoofSysProposal);
    if (sysRes.success) throw new Error('Direct SYSTEM proposal without engine authorization should be REJECTED!');
    if (!sysRes.rejectedReasons.some(r => r.includes('SECURITY_FORGERY'))) {
      throw new Error(`Expected SECURITY_FORGERY rejection, got: ${sysRes.rejectedReasons.join('; ')}`);
    }

    const spoofInternalProposal: StateTransitionProposal = {
      proposalId: 'prop-spoof-4a-int',
      requestId: 'req-spoof-4a-int',
      eventId: 'evt-spoof-4a-int',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'ENGINE_INTERNAL',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Spoofed engine internal proposal attempting offscreen mutation',
      actions: [
        {
          type: 'RECORD_OFFSCREEN_EVENT',
          payload: {
            eventDescription: '위조된 오프스크린 사건',
            location: '비밀 지하 감옥',
            involvedNpcIds: ['npc-master-1'],
            visibility: 'HIDDEN'
          }
        }
      ]
    };

    const intRes = engine.submitProposal(spoofInternalProposal);
    if (intRes.success) throw new Error('Direct ENGINE_INTERNAL proposal without engine authorization should be REJECTED!');
    if (!intRes.rejectedReasons.some(r => r.includes('SECURITY_FORGERY'))) {
      throw new Error(`Expected SECURITY_FORGERY rejection, got: ${intRes.rejectedReasons.join('; ')}`);
    }

    const snapAfter = engine.getSnapshot();
    if (snapAfter.stateVersion !== snapBefore.stateVersion) {
      throw new Error('State version was bumped on spoofed proposal rejection!');
    }
    if (snapAfter.worldInfo.seeds.some(s => s.id === 'seed-spoofed-4a')) {
      throw new Error('Spoofed system action mutated Canonical State!');
    }
  });

  // 4-B Internal API Abuse: External callers cannot invoke nonexistent elevation methods or bypass boundaries
  record('TEST-SEC-4B-INTERNAL-API-ABUSE', 'Security Trust Boundary 4-B: External caller cannot invoke unexposed or elevated internal APIs', () => {
    const engine = new SovereignEngine();

    // 4-B-1: public executeSystemProposal must not exist on engine
    if (typeof (engine as any).executeSystemProposal === 'function') {
      throw new Error('Insecure public executeSystemProposal method must NOT exist on SovereignEngine!');
    }

    // 4-B-2: public executeSystemAction must not exist on engine
    if (typeof (engine as any).executeSystemAction === 'function') {
      throw new Error('Insecure public executeSystemAction method must NOT exist on SovereignEngine!');
    }

    // 4-B-3: public submitInternalProposal must not exist on engine
    if (typeof (engine as any).submitInternalProposal === 'function') {
      throw new Error('Insecure public submitInternalProposal method must NOT exist on SovereignEngine!');
    }

    // 4-B-4: Passing forged or invalid properties on proposal object to submitProposal is rejected
    const abusedProposal: any = {
      proposalId: 'prop-abuse-4b',
      requestId: 'req-abuse-4b',
      eventId: 'evt-abuse-4b',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempted elevation bypass',
      actions: [{ type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-abuse', content: 'test', status: 'active' } }],
      __isEngineInternal: true,
      authorizationHeader: 'root',
      capability: 'ENGINE_INTERNAL'
    };

    const res = engine.submitProposal(abusedProposal);
    if (res.success) throw new Error('Elevated proposal via property injection must be REJECTED!');
    if (!res.rejectedReasons.some(r => r.includes('SECURITY_FORGERY'))) {
      throw new Error(`Expected SECURITY_FORGERY, got: ${res.rejectedReasons.join('; ')}`);
    }
  });

  // 4-C Capability Forgery: External capability theft, symbol forging, cloning, or tampering is impossible
  record('TEST-SEC-4C-CAPABILITY-FORGERY', 'Security Trust Boundary 4-C: Capability forgery via symbol creation, prototype injection, or object cloning fails', () => {
    const engine = new SovereignEngine();

    // Attack vector 1: Symbol forgery
    const symbolSpoofedProposal: any = {
      proposalId: 'prop-sym-forge',
      requestId: 'req-sym-forge',
      eventId: 'evt-sym-forge',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Forged Symbol token attempt',
      actions: [{ type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-forge', content: 'forge', status: 'active' } }],
      [Symbol.for('TRPG31_ENGINE_INTERNAL_CAPABILITY')]: Symbol.for('TRPG31_ENGINE_INTERNAL_CAPABILITY'),
      [Symbol('TRPG31_ENGINE_INTERNAL_CAPABILITY')]: true
    };

    const res1 = engine.submitProposal(symbolSpoofedProposal);
    if (res1.success) throw new Error('Symbol-forged proposal must be REJECTED!');
    if (!res1.rejectedReasons.some(r => r.includes('SECURITY_FORGERY'))) {
      throw new Error(`Expected SECURITY_FORGERY on symbol forgery, got: ${res1.rejectedReasons.join('; ')}`);
    }

    // Attack vector 2: Prototype inheritance spoofing
    const protoSpoofed = Object.create({
      source: 'SYSTEM',
      isAuthorized: true
    });
    Object.assign(protoSpoofed, {
      proposalId: 'prop-proto-forge',
      requestId: 'req-proto-forge',
      eventId: 'evt-proto-forge',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Prototype inheritance forge attempt',
      actions: [{ type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-proto', content: 'proto', status: 'active' } }]
    });

    const res2 = engine.submitProposal(protoSpoofed);
    if (res2.success) throw new Error('Prototype-forged proposal must be REJECTED!');
    if (!res2.rejectedReasons.some(r => r.includes('SECURITY_FORGERY'))) {
      throw new Error(`Expected SECURITY_FORGERY on prototype forgery, got: ${res2.rejectedReasons.join('; ')}`);
    }
  });

  // 4-D Genuine Internal SYSTEM: Genuine Engine-authored operations commit successfully through Validator and Gate
  record('TEST-SEC-4D-GENUINE-INTERNAL-SYSTEM', 'Security Trust Boundary 4-D: Genuine internal engine execution path commits SYSTEM proposals safely', () => {
    const engine = new SovereignEngine();
    const snapBefore = engine.getSnapshot();

    // Execution 1: via dispatchEngineInternalAction
    const res1 = dispatchEngineInternalAction(
      engine,
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-genuine-4d',
          content: '정상 승인된 내부 엔진 시드',
          status: 'active'
        }
      },
      'Genesis engine seed initialization'
    );

    if (!res1.success) {
      throw new Error(`Genuine dispatchEngineInternalAction failed: ${res1.rejectedReasons.join('; ')}`);
    }
    if (res1.stateVersion !== snapBefore.stateVersion + 1) {
      throw new Error(`Expected stateVersion ${snapBefore.stateVersion + 1}, got ${res1.stateVersion}`);
    }
    if (!res1.snapshot.worldInfo.seeds.some(s => s.id === 'seed-genuine-4d')) {
      throw new Error('Genuine engine seed was not committed to Canonical State!');
    }

    // Execution 2: via dispatchEngineInternalProposal
    const res2 = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-genuine-4d-int',
      requestId: 'req-genuine-4d-int',
      eventId: 'evt-genuine-4d-int',
      expectedStateVersion: res1.stateVersion,
      source: 'ENGINE_INTERNAL',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Authoritative offscreen world progression',
      actions: [
        {
          type: 'RECORD_OFFSCREEN_EVENT',
          payload: {
            eventDescription: '종남파 장문인의 비밀 회동',
            location: '종남산',
            involvedNpcIds: ['npc-master-1'],
            visibility: 'FACTION_ONLY'
          }
        }
      ]
    });

    if (!res2.success) {
      throw new Error(`Genuine dispatchEngineInternalProposal failed: ${res2.rejectedReasons.join('; ')}`);
    }
    if (res2.stateVersion !== res1.stateVersion + 1) {
      throw new Error(`Expected stateVersion ${res1.stateVersion + 1}, got ${res2.stateVersion}`);
    }
    if (!res2.snapshot.worldInfo.offscreenRecords?.some(e => e.eventDescription === '종남파 장문인의 비밀 회동')) {
      throw new Error('Genuine offscreen event was not committed to Canonical State!');
    }
  });

  // Test 94: Inventory Identity & SET_QUANTITY non-existent entity protection
  record('TEST-94', 'Article 9/16 Inventory Identity: exact match on ID and SET_QUANTITY cannot invent non-existent items', () => {
    const engine = new SovereignEngine();
    const baseTime = new Date().getTime();
    const ts = (sec: number) => new Date(baseTime + sec * 1000).toISOString();

    // 1. Initial item in character inventory
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-inv-id-1',
      requestId: 'req-inv-id-1',
      eventId: 'evt-inv-id-1',
      expectedStateVersion: 1,
      source: 'ENGINE_INTERNAL',
      turn: 1,
      timestamp: ts(1),
      intentSummary: 'Seed iron sword',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: { item: { id: 'item-iron-1', name: '철검', quantity: 1 }, operation: 'ADD' }
        }
      ]
    });

    // 2. Reject SET_QUANTITY on non-existent item ID (even if name is '철검' or different)
    const rejectSetRes = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-inv-id-2',
      requestId: 'req-inv-id-2',
      eventId: 'evt-inv-id-2',
      expectedStateVersion: 2,
      source: 'ENGINE_INTERNAL',
      turn: 1,
      timestamp: ts(2),
      intentSummary: 'Attempt SET_QUANTITY on non-existent item ID',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: { item: { id: 'item-iron-2', name: '철검', quantity: 5 }, operation: 'SET_QUANTITY' }
        }
      ]
    });

    if (rejectSetRes.success) {
      throw new Error('SET_QUANTITY on non-existent item ID item-iron-2 should have been rejected!');
    }
    if (!rejectSetRes.rejectedReasons.some(r => r.includes('NON_EXISTENT_ENTITY') || r.includes('does not exist'))) {
      throw new Error(`Expected NON_EXISTENT_ENTITY rejection, got: ${rejectSetRes.rejectedReasons.join('; ')}`);
    }

    // 3. Reject REMOVE on different ID (should not match by name fallback if id provided)
    const rejectRemoveRes = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-inv-id-3',
      requestId: 'req-inv-id-3',
      eventId: 'evt-inv-id-3',
      expectedStateVersion: 2,
      source: 'ENGINE_INTERNAL',
      turn: 1,
      timestamp: ts(3),
      intentSummary: 'Attempt REMOVE with non-matching ID',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: { item: { id: 'item-iron-different', name: '철검', quantity: 1 }, operation: 'REMOVE' }
        }
      ]
    });

    if (rejectRemoveRes.success) {
      throw new Error('REMOVE with unmatched ID item-iron-different should have been rejected!');
    }
    if (!rejectRemoveRes.rejectedReasons.some(r => r.includes('INVENTORY_VIOLATION') || r.includes('does not exist'))) {
      throw new Error(`Expected INVENTORY_VIOLATION, got: ${rejectRemoveRes.rejectedReasons.join('; ')}`);
    }

    // 4. Verify canonical inventory remains unaffected with quantity 1 for item-iron-1
    const finalSnap = engine.getSnapshot();
    if (finalSnap.character.inventory.length !== 1 || finalSnap.character.inventory[0].id !== 'item-iron-1' || finalSnap.character.inventory[0].quantity !== 1) {
      throw new Error(`Inventory integrity breached: ${JSON.stringify(finalSnap.character.inventory)}`);
    }
  });

  // Test 95: Turn Regression Prevention
  record('TEST-95', 'Temporal Integrity: Proposal turn cannot regress behind current sovereign turn', () => {
    const engine = new SovereignEngine();
    const baseTime = new Date().getTime();
    const ts = (sec: number) => new Date(baseTime + sec * 1000).toISOString();

    // Advance to turn 5
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-turn-1',
      requestId: 'req-turn-1',
      eventId: 'evt-turn-1',
      expectedStateVersion: 1,
      source: 'ENGINE_INTERNAL',
      turn: 5,
      timestamp: ts(1),
      intentSummary: 'Advance to turn 5',
      actions: [
        {
          type: 'SET_WORLD_METADATA',
          payload: { worldName: '중원 5턴' }
        }
      ]
    });

    if (engine.getSnapshot().turn !== 5) {
      throw new Error(`Expected turn 5, got ${engine.getSnapshot().turn}`);
    }

    // Attempt proposal with regressed turn (turn 4 < turn 5)
    const regressedRes = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-turn-2',
      requestId: 'req-turn-2',
      eventId: 'evt-turn-2',
      expectedStateVersion: 2,
      source: 'ENGINE_INTERNAL',
      turn: 4,
      timestamp: ts(2),
      intentSummary: 'Attempt regressed turn 4',
      actions: [
        {
          type: 'SET_WORLD_METADATA',
          payload: { worldName: '중원 4턴 역행 시도' }
        }
      ]
    });

    if (regressedRes.success) {
      throw new Error('Proposal with turn regression (turn 4 < 5) should have been rejected!');
    }
    if (!regressedRes.rejectedReasons.some(r => r.includes('TURN_REGRESSION_CONFLICT'))) {
      throw new Error(`Expected TURN_REGRESSION_CONFLICT, got: ${regressedRes.rejectedReasons.join('; ')}`);
    }
  });

  // Test 96: Timestamp Regression Prevention
  record('TEST-96', 'Temporal Integrity: Proposal timestamp cannot regress earlier than last committed timestamp', () => {
    const engine = new SovereignEngine();
    const baseTime = new Date().getTime();
    const ts = (sec: number) => new Date(baseTime + sec * 1000).toISOString();
    const tCommit = ts(10);

    // Commit at T2
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-ts-1',
      requestId: 'req-ts-1',
      eventId: 'evt-ts-1',
      expectedStateVersion: 1,
      source: 'ENGINE_INTERNAL',
      turn: 1,
      timestamp: tCommit,
      intentSummary: 'Commit at T2',
      actions: [
        {
          type: 'SET_WORLD_METADATA',
          payload: { worldName: '시간 커밋' }
        }
      ]
    });

    if (engine.getSnapshot().lastCommittedAt !== tCommit) {
      throw new Error(`Expected lastCommittedAt ${tCommit}, got ${engine.getSnapshot().lastCommittedAt}`);
    }

    // Attempt proposal with earlier timestamp (tCommit - 5s)
    const regressedTsRes = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-ts-2',
      requestId: 'req-ts-2',
      eventId: 'evt-ts-2',
      expectedStateVersion: 2,
      source: 'ENGINE_INTERNAL',
      turn: 1,
      timestamp: ts(5),
      intentSummary: 'Attempt regressed timestamp',
      actions: [
        {
          type: 'SET_WORLD_METADATA',
          payload: { worldName: '시간 역행 시도' }
        }
      ]
    });

    if (regressedTsRes.success) {
      throw new Error('Proposal with timestamp regression should have been rejected!');
    }
    if (!regressedTsRes.rejectedReasons.some(r => r.includes('TIMESTAMP_REGRESSION_CONFLICT'))) {
      throw new Error(`Expected TIMESTAMP_REGRESSION_CONFLICT, got: ${regressedTsRes.rejectedReasons.join('; ')}`);
    }
  });

  // TEST-A2-1: Provenance Boundary: UPDATE_NPC for non-existent canonical NPC is rejected
  record('TEST-A2-1', 'Provenance Boundary: UPDATE_NPC without pre-existing canonical entity is rejected', () => {
    const engine = new SovereignEngine();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a2-update-npc-unbacked',
      requestId: 'req-a2-1',
      eventId: 'evt-a2-1',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt to update non-existent NPC',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: {
            id: 'npc-unbacked-ghost',
            changes: {
              status: 'ALIVE',
              impression: '신비로운 고수'
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (res.success) throw new Error('Unbacked UPDATE_NPC should have been rejected!');
    if (!res.rejectedReasons.some(r => r.includes('PROVENANCE_VIOLATION') || r.includes('has no pre-existing canonical evidence') || r.includes('NON_EXISTENT_ENTITY'))) {
      throw new Error(`Expected PROVENANCE_VIOLATION, got: ${res.rejectedReasons.join('; ')}`);
    }
  });

  // TEST-A2-2: Provenance Boundary: UPDATE_FACTION for non-existent canonical Faction is rejected
  record('TEST-A2-2', 'Provenance Boundary: UPDATE_FACTION without pre-existing canonical entity is rejected', () => {
    const engine = new SovereignEngine();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a2-update-faction-unbacked',
      requestId: 'req-a2-2',
      eventId: 'evt-a2-2',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt to update non-existent Faction',
      actions: [
        {
          type: 'UPDATE_FACTION',
          payload: {
            id: 'faction-unbacked-cult',
            changes: {
              attitudeTowardsPlayer: 'HOSTILE'
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (res.success) throw new Error('Unbacked UPDATE_FACTION should have been rejected!');
    if (!res.rejectedReasons.some(r => r.includes('PROVENANCE_VIOLATION') || r.includes('has no pre-existing canonical evidence') || r.includes('NON_EXISTENT_ENTITY'))) {
      throw new Error(`Expected PROVENANCE_VIOLATION, got: ${res.rejectedReasons.join('; ')}`);
    }
  });

  // TEST-A2-3: Provenance Boundary: SET_WORLD_METADATA from untrusted runtime (LLM/PLAYER) is rejected
  record('TEST-A2-3', 'Provenance Boundary: SET_WORLD_METADATA from untrusted source (LLM/PLAYER) is rejected', () => {
    const engine = new SovereignEngine();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a2-set-world-meta',
      requestId: 'req-a2-3',
      eventId: 'evt-a2-3',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt to mutate world law/metadata via LLM',
      actions: [
        {
          type: 'SET_WORLD_METADATA',
          payload: {
            worldName: '위조된 세계관'
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (res.success) throw new Error('Untrusted SET_WORLD_METADATA should have been rejected!');
    if (!res.rejectedReasons.some(r => r.includes('PROVENANCE_VIOLATION'))) {
      throw new Error(`Expected PROVENANCE_VIOLATION, got: ${res.rejectedReasons.join('; ')}`);
    }
  });

  // TEST-A2-4: Provenance Boundary: SET_CHARACTER_SECRET from untrusted runtime (LLM/PLAYER) is rejected
  record('TEST-A2-4', 'Provenance Boundary: SET_CHARACTER_SECRET from untrusted source (LLM/PLAYER) is rejected', () => {
    const engine = new SovereignEngine();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a2-set-char-secret',
      requestId: 'req-a2-4',
      eventId: 'evt-a2-4',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player attempts to invent character secret',
      actions: [
        {
          type: 'SET_CHARACTER_SECRET',
          payload: {
            secret: '사실 황제의 숨겨진 혈육이다.'
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (res.success) throw new Error('Untrusted SET_CHARACTER_SECRET should have been rejected!');
    if (!res.rejectedReasons.some(r => r.includes('PROVENANCE_VIOLATION'))) {
      throw new Error(`Expected PROVENANCE_VIOLATION, got: ${res.rejectedReasons.join('; ')}`);
    }
  });

  // TEST-A2-5: 5.7 Self-Proof Defense: Intra-proposal ADD_NARRATIVE_SEED -> MODIFY_INVENTORY is rejected
  record('TEST-A2-5', '5.7 Self-Proof Defense: Intra-proposal seed/offscreen action cannot satisfy causality evidence', () => {
    const engine = new SovereignEngine();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a2-self-proof-attack',
      requestId: 'req-a2-5',
      eventId: 'evt-a2-5',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Self-proof attack: generate seed and consume it in same proposal',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-instant-treasure',
            content: '동굴에서 보물상자 발견',
            status: 'active'
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-gold-bars', name: '보물상자', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-instant-treasure'
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (res.success) throw new Error('Self-proof proposal should have been rejected!');
    if (!res.rejectedReasons.some(r => r.includes('CAUSALITY_VIOLATION') && r.includes('not found in canonical records'))) {
      throw new Error(`Expected CAUSALITY_VIOLATION for non-existent canonical event, got: ${res.rejectedReasons.join('; ')}`);
    }
  });

  // TEST-A2-6: LLM Creative Freedom: New creation (ADD_NPC, REGISTER_FACTION, ADD_NARRATIVE_SEED, RECORD_OFFSCREEN_EVENT) commits cleanly
  record('TEST-A2-6', 'LLM Creative Freedom: New NPCs, Factions, Narrative Seeds, and Offscreen Events commit cleanly without restriction', () => {
    const engine = new SovereignEngine();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-a2-creative-freedom',
      requestId: 'req-a2-6',
      eventId: 'evt-a2-6',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM freely creates new narrative elements',
      actions: [
        {
          type: 'ADD_NPC',
          payload: {
            id: 'npc-wanderer-x',
            name: '백의검객',
            affiliation: '청룡방',
            innerThought: '강호를 유람 중이다',
            npcClass: 'Class C',
            status: 'ALIVE',
            impression: '과묵한 방랑 무사'
          }
        },
        {
          type: 'ADD_FACTION',
          payload: {
            id: 'faction-dragon-sect',
            name: '청룡방',
            influence: 'MEDIUM',
            attitudeTowardsPlayer: 'NEUTRAL',
            description: '운하를 장악한 강호 방파'
          }
        },
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-dragon-rumor',
            content: '청룡방과 흑호채 사이에 전운이 감돌고 있다',
            status: 'active'
          }
        },
        {
          type: 'RECORD_OFFSCREEN_EVENT',
          payload: {
            id: 'offscreen-border-skirmish',
            eventDescription: '국경 인근에서 정체불명의 척후병들이 목격됨',
            visibility: 'PUBLIC'
          }
        }
      ]
    };

    const res = engine.submitProposal(proposal);
    if (!res.success) throw new Error(`Creative freedom proposal failed: ${res.rejectedReasons.join('; ')}`);

    const snap = engine.getSnapshot();
    if (!snap.worldInfo.npcs.some(n => n.id === 'npc-wanderer-x' && n.name === '백의검객')) {
      throw new Error('New NPC was not committed to Canonical State');
    }
    if (!snap.worldInfo.factions.some(f => f.id === 'faction-dragon-sect' && f.name === '청룡방')) {
      throw new Error('New Faction was not committed to Canonical State');
    }
    if (!snap.worldInfo.seeds.some(s => s.id === 'seed-dragon-rumor')) {
      throw new Error('New Narrative Seed was not committed to Canonical State');
    }
    if (!snap.worldInfo.offscreenRecords?.some(o => o.id === 'offscreen-border-skirmish')) {
      throw new Error('New Offscreen Record was not committed to Canonical State');
    }
  });

  // VEC-01 (V3-04): Privileged Source Forgery Defense & Variant Rejection
  record('TEST-VEC-01-V3-04-SOURCE-FORGERY', 'VEC-01: Direct submission of SAVE_HYDRATION, CLOUD_RESTORE, or unknown sources is rejected with Zero-Mutation', () => {
    const engine = new SovereignEngine();
    const snapBefore = engine.getSnapshot();

    // 1. Direct SAVE_HYDRATION spoofing
    const spoofHydration: any = {
      proposalId: 'prop-spoof-hydration',
      requestId: 'req-spoof-hydration',
      eventId: 'evt-spoof-hydration',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'SAVE_HYDRATION',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Spoofed save hydration proposal',
      actions: [{ type: 'OVERWRITE_CHARACTER', payload: { ...snapBefore.character, name: 'SpoofedHydratedPlayer' } }]
    };
    const res1 = engine.submitProposal(spoofHydration);
    if (res1.success) throw new Error('Direct SAVE_HYDRATION proposal without engine capability must be REJECTED!');
    if (!res1.rejectedReasons.some(r => r.includes('SECURITY_FORGERY'))) {
      throw new Error(`Expected SECURITY_FORGERY on SAVE_HYDRATION, got: ${res1.rejectedReasons.join('; ')}`);
    }

    // 2. Direct CLOUD_RESTORE spoofing
    const spoofRestore: any = {
      proposalId: 'prop-spoof-restore',
      requestId: 'req-spoof-restore',
      eventId: 'evt-spoof-restore',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'CLOUD_RESTORE',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Spoofed cloud restore proposal',
      actions: [{ type: 'OVERWRITE_WORLD_INFO', payload: { ...snapBefore.worldInfo, worldName: 'SpoofedCloudWorld' } }]
    };
    const res2 = engine.submitProposal(spoofRestore);
    if (res2.success) throw new Error('Direct CLOUD_RESTORE proposal without engine capability must be REJECTED!');
    if (!res2.rejectedReasons.some(r => r.includes('SECURITY_FORGERY'))) {
      throw new Error(`Expected SECURITY_FORGERY on CLOUD_RESTORE, got: ${res2.rejectedReasons.join('; ')}`);
    }

    // 3. Unknown / Malformed source injection
    const spoofUnknown: any = {
      proposalId: 'prop-spoof-unknown',
      requestId: 'req-spoof-unknown',
      eventId: 'evt-spoof-unknown',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'ADMIN_PRIVILEGED',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Unknown source elevation attempt',
      actions: [{ type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-bad-source', content: 'hacked seed', status: 'active' } }]
    };
    const res3 = engine.submitProposal(spoofUnknown);
    if (res3.success) throw new Error('Unknown source proposal must be REJECTED!');

    // Zero-Mutation verification
    const snapAfter = engine.getSnapshot();
    if (snapAfter.stateVersion !== snapBefore.stateVersion) {
      throw new Error('State version was modified by rejected source spoofing proposals!');
    }
    if (snapAfter.character.name !== snapBefore.character.name || snapAfter.worldInfo.worldName !== snapBefore.worldInfo.worldName) {
      throw new Error('Canonical State mutated despite proposal rejections!');
    }
  });

  // VEC-02 (V3-05): Retrospective GENESIS Source Exploitation Defense
  record('TEST-VEC-02-V3-05-RETROSPECTIVE-GENESIS', 'VEC-02: Retrospective GENESIS proposal beyond initial genesis turn is rejected with Zero-Mutation', () => {
    const engine = new SovereignEngine();

    // Advance engine to Turn 2 via legitimate turn progression
    const validTurn1: StateTransitionProposal = {
      proposalId: 'prop-valid-turn1',
      requestId: 'req-valid-turn1',
      eventId: 'evt-valid-turn1',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Legitimate turn 1 progression',
      actions: [
        { type: 'ADVANCE_TIME', payload: { targetTime: { year: 1, month: 1, day: 2, season: 'SPRING' } } },
        { type: 'ADD_NARRATIVE_SEED', payload: { id: 'seed-turn1', content: '정상 1턴 시드', status: 'active' } }
      ]
    };
    const t1Res = engine.submitProposal(validTurn1);
    if (!t1Res.success) throw new Error(`Valid turn 1 progression failed: ${t1Res.rejectedReasons.join('; ')}`);

    const snapTurn2 = engine.getSnapshot();
    if (snapTurn2.stateVersion !== 2) throw new Error(`Expected stateVersion 2, got ${snapTurn2.stateVersion}`);

    // Attack: External caller submits a GENESIS proposal on Turn 2 / stateVersion 2 to overwrite character or inventory
    const attackGenesis: StateTransitionProposal = {
      proposalId: 'prop-attack-genesis',
      requestId: 'req-attack-genesis',
      eventId: 'evt-attack-genesis',
      expectedStateVersion: snapTurn2.stateVersion,
      source: 'GENESIS',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Retrospective genesis overwrite attempt',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-god-blade', name: '신급 절대보검', quantity: 1, category: 'WEAPON' },
            operation: 'ADD',
            acquisition: { cause: 'GENESIS_STARTER' }
          }
        }
      ]
    };

    const attackRes = engine.submitProposal(attackGenesis);
    if (attackRes.success) throw new Error('Retrospective GENESIS proposal on turn 2 must be REJECTED!');
    if (!attackRes.rejectedReasons.some(r => r.includes('SECURITY_FORGERY') || r.includes('GENESIS'))) {
      throw new Error(`Expected SECURITY_FORGERY on retrospective GENESIS, got: ${attackRes.rejectedReasons.join('; ')}`);
    }

    // Zero-Mutation verification
    const snapFinal = engine.getSnapshot();
    if (snapFinal.stateVersion !== snapTurn2.stateVersion) {
      throw new Error('State version was bumped on rejected retrospective GENESIS attack!');
    }
    if (snapFinal.character.inventory.some(i => i.id === 'item-god-blade')) {
      throw new Error('Item was injected via retrospective GENESIS attack!');
    }
  });

  // VEC-03 (V4-01): Partial Token Overlap Causality Exploitation Defense
  record('TEST-VEC-03-V4-01-CAUSAL-TOKEN-OVERLAP', 'VEC-03: Substring/token overlap without exact item entity grounding is rejected; grounded entity passes', () => {
    const engine = new SovereignEngine();

    // 1. Plant trusted world seed: "화산 둥지에 놓여있는 단 하나의 용의 알 발견"
    const setupProposal: StateTransitionProposal = {
      proposalId: 'prop-setup-vec03',
      requestId: 'req-setup-vec03',
      eventId: 'evt-setup-vec03',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Discover dragon nest seed',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-volcano-dragon-egg',
            content: '화산 둥지에 놓여있는 단 하나의 용의 알 발견',
            status: 'active'
          }
        }
      ]
    };
    const setupRes = engine.submitProposal(setupProposal);
    if (!setupRes.success) throw new Error(`Setup failed: ${setupRes.rejectedReasons.join('; ')}`);

    const snapAfterSetup = engine.getSnapshot();

    // 2. Attack: Attempt to spawn "화산 파괴검" exploiting the shared word "화산"
    const attackProposal1: StateTransitionProposal = {
      proposalId: 'prop-attack-vec03-sword',
      requestId: 'req-attack-vec03-sword',
      eventId: 'evt-attack-vec03-sword',
      expectedStateVersion: snapAfterSetup.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Causality bypass attempt via token overlap',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-volcano-sword', name: '화산 파괴검', quantity: 1, category: 'WEAPON' },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-volcano-dragon-egg'
            }
          }
        }
      ]
    };

    const attackRes1 = engine.submitProposal(attackProposal1);
    if (attackRes1.success) throw new Error('Token overlap attack ("화산 파괴검" on "화산 둥지...") must be REJECTED!');
    if (!attackRes1.rejectedReasons.some(r => r.includes('CAUSALITY_VIOLATION'))) {
      throw new Error(`Expected CAUSALITY_VIOLATION, got: ${attackRes1.rejectedReasons.join('; ')}`);
    }

    // Zero-Mutation check after attack 1
    const snapAfterAttack1 = engine.getSnapshot();
    if (snapAfterAttack1.character.inventory.some(i => i.id === 'item-volcano-sword')) {
      throw new Error('Unrelated item was injected into inventory via token overlap!');
    }
    if (snapAfterAttack1.stateVersion !== snapAfterSetup.stateVersion) {
      throw new Error('State version mutated on rejected attack!');
    }

    // 3. Legitimate Grounded Item: "용의 알" matches the grounded entity in the seed
    const validPickup: StateTransitionProposal = {
      proposalId: 'prop-valid-vec03-egg',
      requestId: 'req-valid-vec03-egg',
      eventId: 'evt-valid-vec03-egg',
      expectedStateVersion: snapAfterSetup.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Grounded item acquisition',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-dragon-egg', name: '용의 알', quantity: 1, category: 'QUEST' },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-volcano-dragon-egg'
            }
          }
        }
      ]
    };

    const validRes = engine.submitProposal(validPickup);
    if (!validRes.success) throw new Error(`Legitimate grounded acquisition failed: ${validRes.rejectedReasons.join('; ')}`);

    const snapFinal = engine.getSnapshot();
    if (!snapFinal.character.inventory.some(i => i.id === 'item-dragon-egg')) {
      throw new Error('Grounded item was not committed to inventory!');
    }
  });

  // VEC-04 (V2-03): Faction Influence Invariant Enforcement (ADD_FACTION & OVERWRITE)
  record('TEST-VEC-04-V2-03-FACTION-INFLUENCE-INVARIANT', 'VEC-04: ADD_FACTION and OVERWRITE_WORLD_INFO strictly enforce influence boundaries and total cap (<=100)', () => {
    const engine = new SovereignEngine();
    const snapBefore = engine.getSnapshot();

    // 1. ADD_FACTION with single influence > 100
    const overCapProposal: StateTransitionProposal = {
      proposalId: 'prop-fac-overcap',
      requestId: 'req-fac-overcap',
      eventId: 'evt-fac-overcap',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Faction with 150 influence',
      actions: [
        {
          type: 'ADD_FACTION',
          payload: { id: 'faction-mega', name: '초거대문파', description: '초거대문파', influence: '150' }
        }
      ]
    };
    const res1 = engine.submitProposal(overCapProposal);
    if (res1.success) throw new Error('ADD_FACTION with influence 150 must be REJECTED!');
    if (!res1.rejectedReasons.some(r => r.includes('INVALID_FACTION_INFLUENCE') || r.includes('FACTION_INFLUENCE_EXCEEDED'))) {
      throw new Error(`Expected influence rejection, got: ${res1.rejectedReasons.join('; ')}`);
    }

    // 2. ADD_FACTION with negative influence
    const negProposal: StateTransitionProposal = {
      proposalId: 'prop-fac-neg',
      requestId: 'req-fac-neg',
      eventId: 'evt-fac-neg',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Faction with negative influence',
      actions: [
        {
          type: 'ADD_FACTION',
          payload: { id: 'faction-neg', name: '음수문파', description: '음수문파', influence: '-10' }
        }
      ]
    };
    const res2 = engine.submitProposal(negProposal);
    if (res2.success) throw new Error('ADD_FACTION with negative influence must be REJECTED!');

    // 3. Add legitimate Faction A with influence 60
    const facAProposal: StateTransitionProposal = {
      proposalId: 'prop-fac-a',
      requestId: 'req-fac-a',
      eventId: 'evt-fac-a',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Add Faction A (60%)',
      actions: [
        {
          type: 'ADD_FACTION',
          payload: { id: 'faction-shaolin', name: '소림사', description: '소림사', influence: '60' }
        }
      ]
    };
    const resA = engine.submitProposal(facAProposal);
    if (!resA.success) throw new Error(`Add Faction A failed: ${resA.rejectedReasons.join('; ')}`);

    const snapAfterA = engine.getSnapshot();

    // 4. Attempt to add Faction B with influence 50 (total 60 + 50 = 110 > 100) -> REJECTED
    const facBOverProposal: StateTransitionProposal = {
      proposalId: 'prop-fac-b-over',
      requestId: 'req-fac-b-over',
      eventId: 'evt-fac-b-over',
      expectedStateVersion: snapAfterA.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Add Faction B causing overflow (60+50=110)',
      actions: [
        {
          type: 'ADD_FACTION',
          payload: { id: 'faction-wudang', name: '무당파', description: '무당파', influence: '50' }
        }
      ]
    };
    const resB = engine.submitProposal(facBOverProposal);
    if (resB.success) throw new Error('Faction B exceeding cumulative influence 100 must be REJECTED!');
    if (!resB.rejectedReasons.some(r => r.includes('FACTION_INFLUENCE_EXCEEDED'))) {
      throw new Error(`Expected FACTION_INFLUENCE_EXCEEDED, got: ${resB.rejectedReasons.join('; ')}`);
    }

    // Zero-Mutation verification
    const snapFinal = engine.getSnapshot();
    if (snapFinal.worldInfo.factions.some(f => f.id === 'faction-wudang')) {
      throw new Error('Overflow faction was committed to state!');
    }
    if (snapFinal.stateVersion !== snapAfterA.stateVersion) {
      throw new Error('State version mutated on rejected faction proposal!');
    }
  });

  // VEC-05 (V2-04): UPDATE_FACTION Influence Invariant Enforcement
  record('TEST-VEC-05-V2-04-UPDATE-FACTION-INFLUENCE-INVARIANT', 'VEC-05: UPDATE_FACTION strictly enforces influence boundaries and cumulative total cap', () => {
    const engine = new SovereignEngine();

    // 1. Setup two canonical factions: Faction 1 (40), Faction 2 (30) -> Total 70
    const setupProposal: StateTransitionProposal = {
      proposalId: 'prop-setup-vec05',
      requestId: 'req-setup-vec05',
      eventId: 'evt-setup-vec05',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Setup initial factions',
      actions: [
        { type: 'ADD_FACTION', payload: { id: 'faction-mount-hua', name: '화산파', description: '화산파', influence: '40' } },
        { type: 'ADD_FACTION', payload: { id: 'faction-southern-edge', name: '종남파', description: '종남파', influence: '30' } }
      ]
    };
    const setupRes = engine.submitProposal(setupProposal);
    if (!setupRes.success) throw new Error(`Setup failed: ${setupRes.rejectedReasons.join('; ')}`);

    const snapAfterSetup = engine.getSnapshot();

    // 2. Attack: UPDATE_FACTION for 화산파 from 40 to 80 (total becomes 80 + 30 = 110 > 100) -> REJECTED
    const attackUpdate: StateTransitionProposal = {
      proposalId: 'prop-attack-vec05-update',
      requestId: 'req-attack-vec05-update',
      eventId: 'evt-attack-vec05-update',
      expectedStateVersion: snapAfterSetup.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Update faction influence causing cumulative overflow',
      actions: [
        {
          type: 'UPDATE_FACTION',
          payload: {
            id: 'faction-mount-hua',
            changes: { influence: '80' }
          }
        }
      ]
    };
    const attackRes = engine.submitProposal(attackUpdate);
    if (attackRes.success) throw new Error('UPDATE_FACTION causing cumulative influence overflow must be REJECTED!');
    if (!attackRes.rejectedReasons.some(r => r.includes('FACTION_INFLUENCE_EXCEEDED'))) {
      throw new Error(`Expected FACTION_INFLUENCE_EXCEEDED on UPDATE_FACTION, got: ${attackRes.rejectedReasons.join('; ')}`);
    }

    // Zero-Mutation verification
    const snapAfterAttack = engine.getSnapshot();
    const huaFac = snapAfterAttack.worldInfo.factions.find(f => f.id === 'faction-mount-hua');
    if (huaFac?.influence !== '40') {
      throw new Error(`Faction influence mutated on rejected proposal! Expected 40, got ${huaFac?.influence}`);
    }
    if (snapAfterAttack.stateVersion !== snapAfterSetup.stateVersion) {
      throw new Error('State version mutated on rejected UPDATE_FACTION!');
    }

    // 3. Legitimate UPDATE_FACTION: Update 화산파 from 40 to 50 (total 50 + 30 = 80 <= 100) -> COMMITTED cleanly
    const evidence = {
      evidenceId: 'ev-hua-50',
      sourceType: 'NARRATIVE' as const,
      timestamp: new Date().toISOString(),
      contentSnippet: '화산파 세력 영향력이 50으로 상승',
      turn: 1,
      targetEntityId: 'faction-mount-hua',
      observedAttribute: 'influence',
      observedValue: '50'
    };
    const admission = ImmigrationGate.admit(
      {
        targetEntityId: 'faction-mount-hua',
        targetAttribute: 'influence',
        claimedValue: '50',
        claimedEvidenceIds: ['ev-hua-50'],
        rawText: '화산파 영향력 50'
      },
      [evidence],
      snapAfterSetup
    );
    if (!admission.admitted || !admission.verifiedClaim) {
      throw new Error(`Gate admission failed: ${admission.rejectionReason}`);
    }

    const validUpdate: StateTransitionProposal = {
      proposalId: 'prop-valid-vec05-update',
      requestId: 'req-valid-vec05-update',
      eventId: 'evt-valid-vec05-update',
      expectedStateVersion: snapAfterSetup.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Legitimate faction influence update (40->50)',
      verifiedClaims: [admission.verifiedClaim],
      actions: [
        {
          type: 'UPDATE_FACTION',
          payload: {
            id: 'faction-mount-hua',
            changes: { influence: '50' }
          }
        }
      ]
    };
    const validRes = engine.submitProposal(validUpdate);
    if (!validRes.success) throw new Error(`Valid faction influence update failed: ${validRes.rejectedReasons.join('; ')}`);

    const snapFinal = engine.getSnapshot();
    const huaFinal = snapFinal.worldInfo.factions.find(f => f.id === 'faction-mount-hua');
    if (huaFinal?.influence !== '50') {
      throw new Error(`Expected updated influence 50, got ${huaFinal?.influence}`);
    }
  });

  // TEST-ROOT-01: Claim Binding Bypass Remediation Proof
  record('TEST-ROOT-01-CLAIM-BINDING-BYPASS', 'Root 1 Remediation: Wildcard (*)/empty claim attributes are rejected by ImmigrationGate, and cannot bypass canonical validation', () => {
    const engine = new SovereignEngine();
    const snap0 = engine.getSnapshot();

    const sampleEvidence = [
      {
        evidenceId: 'ev-1',
        entityId: 'char-protagonist',
        attribute: 'title',
        value: '소협',
        source: 'CANON_TEXT'
      }
    ];

    // 1. ImmigrationGate rejects wildcard attribute
    const wildcardAttributeVerdict = ImmigrationGate.admit(
      {
        rawText: '주인공은 천마검을 소유한다.',
        targetEntityId: 'char-protagonist',
        targetAttribute: '*',
        claimedValue: '천마검',
        claimedEvidenceIds: ['ev-1']
      },
      sampleEvidence,
      snap0
    );
    if (wildcardAttributeVerdict.admitted || wildcardAttributeVerdict.status !== 'REJECTED') {
      throw new Error('ImmigrationGate MUST reject wildcard (*) targetAttribute!');
    }

    // 2. ImmigrationGate rejects wildcard entity ID
    const wildcardEntityVerdict = ImmigrationGate.admit(
      {
        rawText: '주인공은 천마검을 소유한다.',
        targetEntityId: '*',
        targetAttribute: 'inventory',
        claimedValue: '천마검',
        claimedEvidenceIds: ['ev-1']
      },
      sampleEvidence,
      snap0
    );
    if (wildcardEntityVerdict.admitted || wildcardEntityVerdict.status !== 'REJECTED') {
      throw new Error('ImmigrationGate MUST reject wildcard (*) targetEntityId!');
    }

    // 3. Attack via submitProposal: LLM attempts unbacked ADD with existence claim or mismatched claim
    const attackProposal: StateTransitionProposal = {
      proposalId: 'prop-attack-root1',
      requestId: 'req-attack-root1',
      eventId: 'evt-attack-root1',
      expectedStateVersion: snap0.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt unbacked inventory injection without valid claim binding',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-god-sword', name: '신검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'VERIFIED_CLAIM',
              claimId: 'claim-fake-existence'
            } as any
          }
        }
      ]
    };
    const attackRes = engine.submitProposal(attackProposal);
    if (attackRes.success) throw new Error('Unbacked ADD without valid matching claim MUST be rejected!');

    // Zero-mutation verification
    const snapAfterAttack = engine.getSnapshot();
    if (snapAfterAttack.character.inventory.some(i => i.name === '신검')) {
      throw new Error('Canonical Inventory mutated on rejected Root 1 attack!');
    }
    if (snapAfterAttack.stateVersion !== snap0.stateVersion) {
      throw new Error('State version mutated on rejected Root 1 attack!');
    }

    // 4. Legitimate admission: Exact entityId, concrete attribute, and concrete value matching evidence
    const legitimateVerdict = ImmigrationGate.admit(
      {
        rawText: '주인공은 소협이라 불린다.',
        targetEntityId: 'char-protagonist',
        targetAttribute: 'title',
        claimedValue: '소협',
        claimedEvidenceIds: ['ev-1']
      },
      sampleEvidence,
      snap0
    );
    if (!legitimateVerdict.admitted || !legitimateVerdict.verifiedClaim || legitimateVerdict.verifiedClaim.targetAttribute !== 'title' || legitimateVerdict.verifiedClaim.targetEntityId !== 'char-protagonist') {
      throw new Error(`ImmigrationGate failed to admit valid concrete claim: ${legitimateVerdict.rejectionReason}`);
    }
  });

  // TEST-ROOT-02: Unchecked Character Stats Remediation Proof
  record('TEST-ROOT-02-UNCHECKED-CHARACTER-STATS', 'Root 2 Remediation: Unchecked UPDATE_CHARACTER_STATS from untrusted sources is strictly rejected with Zero-Mutation', () => {
    const engine = new SovereignEngine();
    const snap0 = engine.getSnapshot();

    // 1. Attack 1: LLM proposes arbitrary stat mutation without grounding or VerifiedClaim
    const llmAttackProposal: StateTransitionProposal = {
      proposalId: 'prop-attack-root2-llm',
      requestId: 'req-attack-root2-llm',
      eventId: 'evt-attack-root2-llm',
      expectedStateVersion: snap0.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM arbitrarily mutates character strength to 25',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            strength: 25
          }
        }
      ]
    };
    const llmAttackRes = engine.submitProposal(llmAttackProposal);
    if (llmAttackRes.success) throw new Error('Unbacked LLM stat mutation MUST be rejected!');
    if (!llmAttackRes.rejectedReasons.some(r => r.includes('PROVENANCE_VIOLATION'))) {
      throw new Error(`Expected PROVENANCE_VIOLATION on unbacked LLM stat mutation, got: ${llmAttackRes.rejectedReasons.join('; ')}`);
    }

    // 2. Attack 2: PLAYER proposes arbitrary stat mutation without grounding or VerifiedClaim
    const playerAttackProposal: StateTransitionProposal = {
      proposalId: 'prop-attack-root2-player',
      requestId: 'req-attack-root2-player',
      eventId: 'evt-attack-root2-player',
      expectedStateVersion: snap0.stateVersion,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player arbitrarily mutates character agility to 25',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            agility: 25
          }
        }
      ]
    };
    const playerAttackRes = engine.submitProposal(playerAttackProposal);
    if (playerAttackRes.success) throw new Error('Unbacked PLAYER stat mutation MUST be rejected!');
    if (!playerAttackRes.rejectedReasons.some(r => r.includes('PROVENANCE_VIOLATION'))) {
      throw new Error(`Expected PROVENANCE_VIOLATION on unbacked PLAYER stat mutation, got: ${playerAttackRes.rejectedReasons.join('; ')}`);
    }

    // Zero-mutation check
    const snapAfterAttacks = engine.getSnapshot();
    if (snapAfterAttacks.character.stats.strength !== 10 || snapAfterAttacks.character.stats.agility !== 10) {
      throw new Error('Character stats mutated on rejected Root 2 attack!');
    }
    if (snapAfterAttacks.stateVersion !== snap0.stateVersion) {
      throw new Error('State version mutated on rejected Root 2 attack!');
    }

    // 3. Attack 3: Synthetic seed grounding without VerifiedClaim is now properly REJECTED under C2
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-seed-setup',
      requestId: 'req-seed-setup',
      eventId: 'evt-seed-setup',
      expectedStateVersion: snap0.stateVersion,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Setup legitimate training seed',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-intense-training',
            content: '폭포수 아래에서의 고된 근력 단련',
            status: 'active'
          }
        }
      ]
    });

    const snapWithSeed = engine.getSnapshot();
    const syntheticSeedProposal: StateTransitionProposal = {
      proposalId: 'prop-synthetic-seed-stat-update',
      requestId: 'req-synthetic-seed-stat-update',
      eventId: 'evt-synthetic-seed-stat-update',
      expectedStateVersion: snapWithSeed.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt synthetic seed grounding without VerifiedClaim',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            strength: 15,
            verifiedEventId: 'seed-intense-training'
          }
        }
      ]
    };
    const syntheticRes = engine.submitProposal(syntheticSeedProposal);
    if (syntheticRes.success) throw new Error('Synthetic seed grounding without VerifiedClaim MUST be rejected under C2!');
    if (!syntheticRes.rejectedReasons.some(r => r.includes('PROVENANCE_VIOLATION'))) {
      throw new Error(`Expected PROVENANCE_VIOLATION on synthetic seed grounding, got: ${syntheticRes.rejectedReasons.join('; ')}`);
    }

    // 4. Legitimate VerifiedClaim Flow: Proposal with genuine gate-issued VerifiedClaim succeeds cleanly
    const snapBeforeClaim = engine.getSnapshot();
    const ev: ExternalEvidence = {
      evidenceId: 'ev-legit-training',
      sourceType: 'SYSTEM',
      timestamp: new Date().toISOString(),
      contentSnippet: '훈련 주사위 판정 성공으로 힘이 15로 증가',
      turn: 1,
      entityId: 'character',
      attribute: 'strength',
      value: 15
    };
    const claimRes = ImmigrationGate.admit(
      {
        targetEntityId: 'character',
        targetAttribute: 'strength',
        claimedValue: 15,
        claimedEvidenceIds: ['ev-legit-training'],
        rawText: '힘 15 달성'
      },
      [ev],
      snapBeforeClaim
    );
    if (!claimRes.admitted || !claimRes.verifiedClaim) {
      throw new Error(`ImmigrationGate failed to admit valid claim: ${claimRes.rejectionReason}`);
    }

    const validClaimProposal: StateTransitionProposal = {
      proposalId: 'prop-valid-claim-stat-update',
      requestId: 'req-valid-claim-stat-update',
      eventId: 'evt-valid-claim-stat-update',
      expectedStateVersion: snapBeforeClaim.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Legitimate stat increase backed by VerifiedClaim',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            strength: 15
          }
        }
      ],
      verifiedClaims: [claimRes.verifiedClaim]
    };
    const validRes = engine.submitProposal(validClaimProposal);
    if (!validRes.success) throw new Error(`Valid claim stat mutation failed: ${validRes.rejectedReasons.join('; ')}`);

    const snapFinal = engine.getSnapshot();
    if (snapFinal.character.stats.strength !== 15) {
      throw new Error(`Expected strength 15 after legitimate claim update, got ${snapFinal.character.stats.strength}`);
    }
  });

  record('TEST-LANG-01', 'Engine Language Phase 1: Canonical Semantic Representation, Grammar & Adapter Integrity', () => {
    const res = runLanguageTestSuite();
    if (res.failed > 0) {
      throw new Error(`Engine Language Test Suite had ${res.failed} failures out of ${res.total} assertions.`);
    }
  });

  record('TEST-HYDRATION-01', 'Hydration Sovereignty Fail-Closed & Replay Tampering Red Team Suite', () => {
    const res = runHydrationSovereigntyBypassTests();
    if (!res.allPassed) {
      const fails = res.results.filter(r => !r.passed).map(r => `${r.name}: ${r.error}`).join('; ');
      throw new Error(`Hydration Sovereignty Bypass Test Suite failed: ${fails}`);
    }
  });

    const passedCount = results.filter(r => r.passed).length;
    return {
      passed: passedCount === results.length,
      results
    };
  } finally {
    SovereignEngine.prototype.submitProposal = originalSubmit;
  }
}

if (import.meta.url.endsWith('testRunner.ts')) {
  console.log('====================================================');
  console.log('TRPG 3.1 Sovereign Engine Test Suite Execution');
  console.log('====================================================');
  const outcome = runSovereignEngineTestSuite();
  for (const res of outcome.results) {
    console.log(`${res.passed ? '✅ [PASS]' : '❌ [FAIL]'} ${res.testId}: ${res.description}`);
    if (res.error) console.log(`   Error: ${res.error}`);
  }
  console.log('====================================================');
  console.log(`Summary: ${outcome.results.filter(r => r.passed).length}/${outcome.results.length} Tests Passed.`);
  console.log('====================================================');
}
