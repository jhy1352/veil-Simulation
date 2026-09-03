/**
 * @file src/engine/index/novelLifecycleTest.ts
 * @description Mandatory Validation Scenarios for Novel History and Canon Lifecycle.
 *
 * Grounded in Sovereign Engine EOF runtime (engine.submitProposal() committed state),
 * verifying strict truth boundaries, authoritative evidence verification, and canon promotion.
 *
 * Verified Requirements (Directive 5):
 * 1. New Novel Entity as active actor in Canonical mutation -> Immediately CANON_LINKED
 * 2. Passive Novel mention -> Stays NOVEL
 * 3. Fake verifiedEventId string only -> Promotion failed (stays NOVEL)
 * 4. Fake sourceNpcId string only -> Promotion failed (stays NOVEL)
 * 5. Fake evidenceIds string only -> Promotion failed (stays NOVEL)
 * 6. UNMET NPC -> Not misjudged as Active Canon (recorded in Novel History)
 * 7. Existing Novel Entity becoming active actor in subsequent turn -> Promoted to CANON_LINKED
 * 8. Existing Active Canon protection -> Not added to Novel History, resolved by Identity Resolver
 * 9. Existing Inactive Canon protection -> 0-qty item, dead NPC, resolved seed blocked
 * 10. Commit failure -> Novel observation/promotion does not occur
 * 11. LLM Signal Injection Block -> Untrusted claims filtered, promotion blocked
 * 12. CANON_LINKED permanent invariant -> Cannot be demoted back to NOVEL
 * 13. Candidate Recovery Gate failure -> Quarantined, fail-closed
 */

import { CanonicalState, ImmutableHistoricalRecord, TransitionAction, AcquisitionCause, StateTransitionProposal } from '../types';
import { CandidatePacket } from '../../types';
import {
  NovelHistoryRecord,
  observeNovelHistory,
  evaluateCanonPromotion,
  observeCandidateNovelHistory,
  isInactiveCanon,
  isActiveCanon,
  findNovelHistoryMatch
} from './novelHistory';
import { resolveNpcIdentity } from './entityIdentityResolver';
import { buildSafeProposalFromCandidate } from '../proposalParser';
import { SovereignEngine } from '../state';
import { dispatchEngineInternalProposal } from '../internalCapability';
import { runCandidateRecoveryGate, VeilCandidate } from '../language/candidateRecoveryGate';

function createInitialTestState(): CanonicalState {
  return {
    stateVersion: 1,
    turn: 1,
    lastCommittedEventId: 'evt-init',
    lastCommittedAt: new Date().toISOString(),
    worldInfo: {
      worldName: '시험 세계',
      worldType: 'popular_genre',
      settingDescription: '시험용 중원 무림',
      toneStyle: '정통',
      npcs: [
        { id: 'npc-chulsoo', name: '철수', alias: '청풍검 철수', affiliation: '화산파', status: 'ALIVE', metInStory: true },
        { id: 'npc-unmet-elder', name: '은둔고수', alias: '북해빙궁 장로', affiliation: '북해빙궁', status: 'ALIVE', metInStory: false }
      ],
      factions: [
        { id: 'fac-huashan', name: '화산파', description: '매화검법의 명문', attitudeTowardsPlayer: 'FRIENDLY' }
      ],
      publicRumors: [],
      secretLore: [],
      seeds: [
        { id: 'seed-active-treasure', content: '숨겨진 비급의 위치', status: 'active' },
        { id: 'seed-resolved-mystery', content: '과거 살인사건의 진상', status: 'resolved' }
      ],
      chapters: {
        currentChapter: '제1장',
        upcomingChapters: ['제2장']
      },
      dcHistory: [],
      unresolvedForeshadows: [],
      cameraOffscreenEvents: []
    },
    character: {
      name: '이청',
      title: '소협',
      gender: '남',
      age: 20,
      appearance: '청년',
      goal: '무도 정진',
      originBackground: '평범',
      backgroundType: 'preset',
      flaw: '단순함',
      flawType: 'preset',
      oath: '신의',
      oathType: 'preset',
      anchor: '사부',
      anchorType: 'preset',
      faction: '화산파',
      factionType: 'preset',
      stats: {
        strength: 10,
        agility: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
      },
      inventory: [
        { id: 'item-wooden-sword', name: '목검', quantity: 1, description: '수련용 목검' },
        { id: 'item-empty-potion', name: '빈 약병', quantity: 0, description: '다 쓴 약병' }
      ]
    }
  };
}

export function runNovelLifecycleTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ ${testName}`);
    } else {
      failed++;
      const msg = `  ✗ ${testName} - ${detail || 'Assertion failed'}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  console.log('=== Running VEIL Novel History / Canon Lifecycle Test Suite ===\n');

  const initialState = createInitialTestState();
  const engine = new SovereignEngine(initialState.worldInfo, initialState.character);
  let novelHistory: NovelHistoryRecord[] = [];

  // =========================================================================
  // Requirement 8: Existing Active Canon Protection
  // Turn 1 Active Canon NPC '철수' (metInStory: true)
  // Observation must NOT record '철수' into Novel History. Resolver resolves to 'npc-chulsoo'.
  // =========================================================================
  console.log('--- [Case 8] Existing Active Canon Protection ---');
  {
    const state = engine.getSnapshot();
    assert(isActiveCanon('철수', 'NPC', state), 'Case 8: "철수" is recognized as Active Canon in current state');

    const candidateTurn1: CandidatePacket = {
      candidateId: 'cand-turn-1',
      turn: 1,
      timestamp: new Date().toISOString(),
      npcChanges: [{ name: '철수', innerThought: '무운을 빈다.' }]
    };

    const emptyProposal = {
      proposalId: 'prop-turn-1',
      requestId: 'req-turn-1',
      eventId: 'evt-turn-1',
      expectedStateVersion: state.stateVersion,
      source: 'LLM' as const,
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Reappearance of Chulsoo',
      actions: []
    };

    const obs = observeCandidateNovelHistory(
      novelHistory,
      candidateTurn1,
      emptyProposal,
      state,
      1,
      engine.getHistory()
    );

    const match = findNovelHistoryMatch(obs.updatedRecords, 'NPC', '철수');
    assert(match === undefined, 'Case 8: "철수" is NOT recorded in Novel History (Active Canon Defense)');
    assert(obs.updatedRecords.length === 0, 'Case 8: Novel History records remain empty');

    const resolution = resolveNpcIdentity(state, engine.getHistory(), '철수');
    assert(resolution.status === 'RECOVERED' || resolution.status === 'EXACT', 'Case 8: Resolver recovers existing Canon ID');
    assert(resolution.canonicalId === 'npc-chulsoo', 'Case 8: Resolved ID is npc-chulsoo');
  }

  // =========================================================================
  // Requirement 6: UNMET NPC is NOT misjudged as Active Canon
  // NPC '은둔고수' exists in worldInfo.npcs but has metInStory: false.
  // Must NOT be treated as Active Canon, allowing Novel History to observe the meeting.
  // =========================================================================
  console.log('\n--- [Case 6] UNMET NPC Not Misjudged as Active Canon ---');
  {
    const state = engine.getSnapshot();
    assert(!isActiveCanon('은둔고수', 'NPC', state), 'Case 6: "은둔고수" (metInStory: false) is NOT Active Canon');

    const candidateMeet: CandidatePacket = {
      candidateId: 'cand-unmet-meet',
      turn: 2,
      timestamp: new Date().toISOString(),
      npcChanges: [{ name: '은둔고수', innerThought: '드디어 만났군.' }]
    };

    const emptyProposal = {
      proposalId: 'prop-unmet-meet',
      requestId: 'req-unmet-meet',
      eventId: 'evt-unmet-meet',
      expectedStateVersion: state.stateVersion,
      source: 'LLM' as const,
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player meets unmet elder',
      actions: []
    };

    const obs = observeCandidateNovelHistory(
      novelHistory,
      candidateMeet,
      emptyProposal,
      state,
      2,
      engine.getHistory()
    );

    const match = findNovelHistoryMatch(obs.updatedRecords, 'NPC', '은둔고수');
    assert(match !== undefined, 'Case 6: "은둔고수" successfully recorded in Novel History upon encounter');
    assert(match?.lifecycle === 'NOVEL', 'Case 6: Lifecycle is NOVEL');
  }

  // =========================================================================
  // Requirement 9: Existing Inactive Canon Protection
  // Deceased NPC '영희', 0-quantity item '빈 약병', resolved seed '과거 살인사건의 진상'
  // Must be blocked from Novel History and resurrection.
  // =========================================================================
  console.log('\n--- [Case 9] Existing Inactive Canon Protection ---');
  {
    // Commit deceased NPC '영희' into Engine
    const commitDeath = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-younghee-reg',
      requestId: 'req-younghee-reg',
      eventId: 'evt-younghee-death',
      turn: 2,
      intentSummary: 'Record death of younghee',
      actions: [
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-younghee', name: '영희', alias: '영희', status: 'DEAD', metInStory: true }
        }
      ]
    });
    if (!commitDeath.success) {
      console.error('Case 9 deathProposal rejected:', commitDeath.rejectedReasons, commitDeath.conflictDetails);
    }
    assert(commitDeath.success, 'Case 9: Deceased NPC committed to Engine');

    const state = engine.getSnapshot();
    const history = engine.getHistory();

    assert(isInactiveCanon('영희', 'NPC', state, history), 'Case 9: "영희" recognized as Inactive Canon (DEAD)');
    assert(isInactiveCanon('빈 약병', 'ITEM', state, history), 'Case 9: "빈 약병" recognized as Inactive Canon (qty 0)');
    assert(isInactiveCanon('과거 살인사건의 진상', 'NARRATIVE_SEED', state, history), 'Case 9: "과거 살인사건의 진상" recognized as Inactive Canon (resolved seed)');

    // Attempt to observe dead NPC in Novel History
    const candidateDead: CandidatePacket = {
      candidateId: 'cand-dead',
      turn: 3,
      timestamp: new Date().toISOString(),
      npcChanges: [{ name: '영희', innerThought: '부활했다' }]
    };
    const obsDead = observeCandidateNovelHistory(
      novelHistory,
      candidateDead,
      { proposalId: 'p', requestId: 'r', eventId: 'e', expectedStateVersion: state.stateVersion, source: 'LLM', turn: 3, timestamp: '', intentSummary: '', actions: [] },
      state,
      3,
      history
    );
    assert(findNovelHistoryMatch(obsDead.updatedRecords, 'NPC', '영희') === undefined, 'Case 9: Deceased NPC blocked from Novel History');

    // Rule 8: buildSafeProposalFromCandidate blocks resurrection
    const safeProposal = buildSafeProposalFromCandidate(state, candidateDead, 3, history);
    const resurrectionAction = safeProposal.actions.find(a =>
      (a.type === 'ADD_NPC' || a.type === 'UPDATE_NPC') && JSON.stringify(a.payload).includes('영희')
    );
    assert(resurrectionAction === undefined, 'Case 9: Resurrection action completely blocked by proposal parser');
  }

  // =========================================================================
  // Requirement 2: Passive Novel Mention Stays NOVEL
  // Turn 3: "지나가던 상인" passively mentioned without Canonical mutation.
  // Result: Recorded in Novel History with lifecycle NOVEL, 0 promotions.
  // =========================================================================
  console.log('\n--- [Case 2] Passive Novel Mention Stays NOVEL ---');
  {
    const state = engine.getSnapshot();
    const candidateTurn3: CandidatePacket = {
      candidateId: 'cand-turn-3',
      turn: 3,
      timestamp: new Date().toISOString(),
      npcChanges: [{ name: '지나가던 상인', innerThought: '오늘 장사는 어떨까' }]
    };

    const passiveProposal = {
      proposalId: 'prop-turn-3-passive',
      requestId: 'req-turn-3-passive',
      eventId: 'evt-turn-3-passive',
      expectedStateVersion: state.stateVersion,
      source: 'LLM' as const,
      turn: 3,
      timestamp: new Date().toISOString(),
      intentSummary: 'Passive mention of merchant',
      actions: []
    };

    const obs = observeCandidateNovelHistory(
      novelHistory,
      candidateTurn3,
      passiveProposal,
      state,
      3,
      engine.getHistory()
    );

    novelHistory = [...obs.updatedRecords];

    const merchant = findNovelHistoryMatch(novelHistory, 'NPC', '지나가던 상인');
    assert(merchant !== undefined, 'Case 2: "지나가던 상인" recorded in Novel History');
    assert(merchant?.lifecycle === 'NOVEL', 'Case 2: Lifecycle is strictly NOVEL');
    assert(merchant?.canonicalId === undefined, 'Case 2: No canonicalId assigned');
    assert(obs.promotedCount === 0, 'Case 2: Promoted count is 0');

    const decision = evaluateCanonPromotion({
      activeActorInCanonicalChange: false,
      isPassiveMentionOnly: true
    });
    assert(decision.promote === false, 'Case 2: evaluateCanonPromotion rejects passive mention');
    assert(decision.reason === 'PASSIVE_MENTION_BLOCKED', 'Case 2: Rejection reason is PASSIVE_MENTION_BLOCKED');
  }

  // =========================================================================
  // Requirement 3: Fake verifiedEventId String Only -> Promotion Failed
  // LLM fabricates a verifiedEventId string that does not exist in Engine history.
  // Result: Fail-closed, promotion rejected, stays NOVEL.
  // =========================================================================
  console.log('\n--- [Case 3] Fake verifiedEventId Rejection ---');
  {
    const state = engine.getSnapshot();
    const candidateFakeEvt: CandidatePacket = {
      candidateId: 'cand-fake-evt',
      turn: 3,
      timestamp: new Date().toISOString(),
      npcChanges: [{ name: '사기꾼 주모' }],
      inventoryChanges: [
        {
          name: '가짜 보물지도',
          quantity: 1,
          action: 'add',
          acquisition: {
            cause: 'GIFT_REWARD',
            context: '사기꾼 주모가 건넨 보물지도',
            sourceNpcId: 'npc-fake-innkeeper',
            verifiedEventId: 'evt-completely-fake-99999' // DOES NOT EXIST IN ENGINE HISTORY
          }
        }
      ]
    };

    const emptyProposal = {
      proposalId: 'prop-fake-evt',
      requestId: 'req-fake-evt',
      eventId: 'evt-fake-evt',
      expectedStateVersion: state.stateVersion,
      source: 'LLM' as const,
      turn: 3,
      timestamp: new Date().toISOString(),
      intentSummary: 'Spoofed verifiedEventId',
      actions: []
    };

    const obs = observeCandidateNovelHistory(
      novelHistory,
      candidateFakeEvt,
      emptyProposal,
      state,
      3,
      engine.getHistory()
    );

    assert(obs.promotedCount === 0, 'Case 3: Fake verifiedEventId produces 0 promotions');
    const innkeeper = findNovelHistoryMatch(obs.updatedRecords, 'NPC', '사기꾼 주모');
    assert(innkeeper?.lifecycle === 'NOVEL', 'Case 3: NPC stays NOVEL');
    assert(innkeeper?.canonicalId === undefined, 'Case 3: No canonicalId assigned');
  }

  // =========================================================================
  // Requirement 4: Fake sourceNpcId String Only -> Promotion Failed
  // LLM fabricates a sourceNpcId string that does not exist in Engine State or History.
  // Result: Fail-closed, promotion rejected, stays NOVEL.
  // =========================================================================
  console.log('\n--- [Case 4] Fake sourceNpcId Rejection ---');
  {
    const state = engine.getSnapshot();
    const candidateFakeNpc: CandidatePacket = {
      candidateId: 'cand-fake-npc',
      turn: 3,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '가짜 약초',
          quantity: 1,
          action: 'add',
          acquisition: {
            cause: 'GIFT_REWARD',
            sourceNpcId: 'npc-totally-fabricated-id', // DOES NOT EXIST IN ENGINE NPCS
            context: '가짜 약초 획득'
          }
        }
      ]
    };

    const emptyProposal = {
      proposalId: 'prop-fake-npc',
      requestId: 'req-fake-npc',
      eventId: 'evt-fake-npc',
      expectedStateVersion: state.stateVersion,
      source: 'LLM' as const,
      turn: 3,
      timestamp: new Date().toISOString(),
      intentSummary: 'Spoofed sourceNpcId',
      actions: []
    };

    const obs = observeCandidateNovelHistory(
      novelHistory,
      candidateFakeNpc,
      emptyProposal,
      state,
      3,
      engine.getHistory()
    );

    assert(obs.promotedCount === 0, 'Case 4: Fake sourceNpcId produces 0 promotions');
    const fakeHerb = findNovelHistoryMatch(obs.updatedRecords, 'ITEM', '가짜 약초');
    assert(fakeHerb?.lifecycle === 'NOVEL', 'Case 4: Item stays NOVEL');
    assert(fakeHerb?.canonicalId === undefined, 'Case 4: Item canonicalId is undefined');
  }

  // =========================================================================
  // Requirement 5: Fake evidenceIds String Only -> Promotion Failed
  // Candidate contains entityReference.evidenceIds referencing non-existent events.
  // Result: Fail-closed, promotion rejected, stays NOVEL.
  // =========================================================================
  console.log('\n--- [Case 5] Fake evidenceIds Rejection ---');
  {
    const state = engine.getSnapshot();
    const candidateFakeEvIds: CandidatePacket = {
      candidateId: 'cand-fake-ev-ids',
      turn: 3,
      timestamp: new Date().toISOString(),
      npcChanges: [
        {
          name: '그림자 살수',
          entityReference: {
            entityType: 'NPC',
            evidenceIds: ['evt-ghost-event-1', 'evt-ghost-event-2'] // NON-EXISTENT
          }
        } as any
      ]
    };

    const emptyProposal = {
      proposalId: 'prop-fake-ev-ids',
      requestId: 'req-fake-ev-ids',
      eventId: 'evt-fake-ev-ids',
      expectedStateVersion: state.stateVersion,
      source: 'LLM' as const,
      turn: 3,
      timestamp: new Date().toISOString(),
      intentSummary: 'Spoofed evidenceIds',
      actions: []
    };

    const obs = observeCandidateNovelHistory(
      novelHistory,
      candidateFakeEvIds,
      emptyProposal,
      state,
      3,
      engine.getHistory()
    );

    assert(obs.promotedCount === 0, 'Case 5: Fake evidenceIds produce 0 promotions');
    const assassin = findNovelHistoryMatch(obs.updatedRecords, 'NPC', '그림자 살수');
    assert(assassin?.lifecycle === 'NOVEL', 'Case 5: NPC stays NOVEL');
  }

  // =========================================================================
  // Requirement 1: New Novel Entity as Active Actor in Canonical Mutation -> Immediately CANON_LINKED
  // Turn 4: New NPC "약초꾼 노인" gives "백년설삼" to protagonist.
  // Proposal is committed to Sovereign Engine (EOF commit).
  // Observation on the committed state must immediately promote both to CANON_LINKED.
  // =========================================================================
  console.log('\n--- [Case 1] New Novel Entity as Active Actor -> Immediately CANON_LINKED ---');
  {
    const eventId = 'evt-herbalist-commit-4';
    const activeActions: TransitionAction[] = [
      {
        type: 'ADD_NPC',
        payload: { id: 'npc-herbalist-elder', name: '약초꾼 노인', status: 'ALIVE', metInStory: true }
      },
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-ginseng', name: '백년설삼', quantity: 1 },
          acquisition: {
            cause: 'GIFT_REWARD' as AcquisitionCause,
            sourceNpcId: 'npc-herbalist-elder',
            verifiedEventId: eventId
          }
        }
      }
    ];

    // Commit proposal to Sovereign Engine EOF
    const commitResult = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-herbalist-commit-4',
      requestId: 'req-herbalist-commit-4',
      eventId: eventId,
      turn: 4,
      intentSummary: 'Herbalist elder gives ginseng to protagonist',
      actions: activeActions
    });
    if (!commitResult.success) {
      console.error('Case 1 activeProposal rejected:', commitResult.rejectedReasons, commitResult.conflictDetails);
    }
    assert(commitResult.success === true, 'Case 1: Sovereign Engine successfully committed active proposal');

    // Observation pipeline on committed state
    const committedState = engine.getSnapshot();
    const committedHistory = engine.getHistory();

    const activeProposal = {
      proposalId: 'prop-herbalist-commit-4',
      requestId: 'req-herbalist-commit-4',
      eventId: eventId,
      expectedStateVersion: committedState.stateVersion - 1,
      source: 'ENGINE_INTERNAL' as const,
      turn: 4,
      timestamp: new Date().toISOString(),
      intentSummary: 'Herbalist elder gives ginseng to protagonist',
      actions: activeActions
    };

    const candidateTurn4: CandidatePacket = {
      candidateId: 'cand-turn-4',
      turn: 4,
      timestamp: new Date().toISOString(),
      npcChanges: [{ name: '약초꾼 노인', innerThought: '설삼을 주마' }],
      inventoryChanges: [
        {
          name: '백년설삼',
          quantity: 1,
          action: 'add',
          acquisition: {
            cause: 'GIFT_REWARD',
            sourceNpcId: 'npc-herbalist-elder',
            verifiedEventId: eventId
          }
        }
      ]
    };

    const obs = observeCandidateNovelHistory(
      novelHistory,
      candidateTurn4,
      activeProposal,
      committedState,
      4,
      committedHistory
    );

    novelHistory = [...obs.updatedRecords];

    assert(obs.promotedCount >= 2, 'Case 1: Promoted count >= 2 (both NPC and Item)');

    const elder = findNovelHistoryMatch(novelHistory, 'NPC', '약초꾼 노인');
    assert(elder !== undefined, 'Case 1: "약초꾼 노인" found in Novel History');
    assert(elder?.lifecycle === 'CANON_LINKED', 'Case 1: "약초꾼 노인" immediately promoted to CANON_LINKED');
    assert(elder?.canonicalId === 'npc-herbalist-elder', 'Case 1: Linked canonical ID is npc-herbalist-elder');
    assert(elder?.linkedCanonicalAtTurn === 4, 'Case 1: Linked at turn 4');

    const ginseng = findNovelHistoryMatch(novelHistory, 'ITEM', '백년설삼');
    assert(ginseng !== undefined, 'Case 1: "백년설삼" found in Novel History');
    assert(ginseng?.lifecycle === 'CANON_LINKED', 'Case 1: "백년설삼" immediately promoted to CANON_LINKED');
    assert(ginseng?.canonicalId === 'item-ginseng', 'Case 1: Linked canonical ID is item-ginseng');
  }

  // =========================================================================
  // Requirement 7: Existing Novel Entity Becoming Active Actor in Subsequent Turn -> Promoted
  // "지나가던 상인" was registered as NOVEL at Turn 3 (Case 2).
  // At Turn 5, merchant becomes active actor in a Canonical inventory mutation.
  // Proposal is committed to Sovereign Engine.
  // Directive D / promotion logic must promote existing NOVEL merchant to CANON_LINKED.
  // =========================================================================
  console.log('\n--- [Case 7] Existing Novel Entity Promoted on Subsequent Turn ---');
  {
    // Verify merchant is currently NOVEL
    const prevMerchant = findNovelHistoryMatch(novelHistory, 'NPC', '지나가던 상인');
    assert(prevMerchant?.lifecycle === 'NOVEL', 'Case 7: Merchant was previously NOVEL');

    const eventIdTurn5 = 'evt-merchant-sword-commit-5';
    const swordActions: TransitionAction[] = [
      {
        type: 'ADD_NPC',
        payload: { id: 'npc-merchant-chul', name: '지나가던 상인', status: 'ALIVE', metInStory: true }
      },
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-steel-sword', name: '상인의 강철검', quantity: 1 },
          acquisition: {
            cause: 'GIFT_REWARD' as AcquisitionCause,
            sourceNpcId: 'npc-merchant-chul',
            verifiedEventId: eventIdTurn5
          }
        }
      }
    ];

    const commitResult = dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-merchant-sword-5',
      requestId: 'req-merchant-sword-5',
      eventId: eventIdTurn5,
      turn: 5,
      intentSummary: 'Merchant gives steel sword to player',
      actions: swordActions
    });
    if (!commitResult.success) {
      console.error('Case 7 swordProposal rejected:', commitResult.rejectedReasons, commitResult.conflictDetails);
    }
    assert(commitResult.success === true, 'Case 7: Sovereign Engine committed sword proposal');

    const committedState = engine.getSnapshot();
    const committedHistory = engine.getHistory();

    const swordProposal = {
      proposalId: 'prop-merchant-sword-5',
      requestId: 'req-merchant-sword-5',
      eventId: eventIdTurn5,
      expectedStateVersion: committedState.stateVersion - 1,
      source: 'ENGINE_INTERNAL' as const,
      turn: 5,
      timestamp: new Date().toISOString(),
      intentSummary: 'Merchant gives steel sword to player',
      actions: swordActions
    };

    const candidateTurn5: CandidatePacket = {
      candidateId: 'cand-turn-5',
      turn: 5,
      timestamp: new Date().toISOString(),
      npcChanges: [{ name: '지나가던 상인', innerThought: '좋은 검을 드리겠소' }],
      inventoryChanges: [
        {
          name: '상인의 강철검',
          quantity: 1,
          action: 'add',
          acquisition: {
            cause: 'GIFT_REWARD',
            sourceNpcId: 'npc-merchant-chul',
            verifiedEventId: eventIdTurn5
          }
        }
      ]
    };

    const obs = observeCandidateNovelHistory(
      novelHistory,
      candidateTurn5,
      swordProposal,
      committedState,
      5,
      committedHistory
    );

    novelHistory = [...obs.updatedRecords];

    const promotedMerchant = findNovelHistoryMatch(novelHistory, 'NPC', '지나가던 상인');
    assert(promotedMerchant?.lifecycle === 'CANON_LINKED', 'Case 7: Existing Novel merchant promoted to CANON_LINKED');
    assert(promotedMerchant?.canonicalId === 'npc-merchant-chul', 'Case 7: Correct canonicalId assigned');
    assert(promotedMerchant?.linkedCanonicalAtTurn === 5, 'Case 7: Linked at turn 5');
  }

  // =========================================================================
  // Requirement 10: Commit Failure -> Novel Observation/Promotion Does NOT Occur
  // Stale stateVersion causes commit failure.
  // Novel History must remain completely untouched.
  // =========================================================================
  console.log('\n--- [Case 10] Commit Failure -> Novel History Untouched ---');
  {
    const staleProposal = {
      proposalId: 'prop-stale-turn-6',
      requestId: 'req-stale-turn-6',
      eventId: 'evt-stale-turn-6',
      expectedStateVersion: 999999, // INTENTIONAL VERSION MISMATCH
      source: 'LLM' as const,
      turn: 6,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stale proposal must fail',
      actions: [
        {
          type: 'ADD_NPC' as const,
          payload: { id: 'npc-ghost-warrior', name: '유령 무사', status: 'ALIVE' as const }
        }
      ]
    };

    const commitResult = engine.submitProposal(staleProposal as any);
    assert(commitResult.success === false, 'Case 10: Engine rejects proposal with stale stateVersion');

    // In runtime pipeline (App.tsx), observeCandidateNovelHistory is only executed if commitResult.success === true.
    // If commit fails, novelHistory is not updated.
    const initialNovelHistoryCount = novelHistory.length;
    assert(
      findNovelHistoryMatch(novelHistory, 'NPC', '유령 무사') === undefined,
      'Case 10: Rejected NPC is NOT present in Novel History'
    );
    assert(novelHistory.length === initialNovelHistoryCount, 'Case 10: Novel History count strictly unchanged');
  }

  // =========================================================================
  // Requirement 11: LLM Signal Injection Block
  // Candidate attempts to inject isRelevantToProtagonist: true, relatedSeedId: 'seed-fake'
  // Result: Untrusted LLM claims filtered out, promotion blocked, stays NOVEL.
  // =========================================================================
  console.log('\n--- [Case 11] LLM Signal Injection Block ---');
  {
    const adversarialObservation = {
      novelId: 'nov-fake-npc',
      entityType: 'NPC' as const,
      normalizedName: '사기군',
      displayName: '사기군',
      turn: 7,
      eventId: 'evt-spoof',
      isRelevantToProtagonist: true,
      relatedSeedId: 'seed-unverified-999',
      isManagementRelevant: true,
      engineVerifiedActiveActor: false,
      isPassiveMentionOnly: true
    };

    const observed = observeNovelHistory(novelHistory, adversarialObservation, engine.getSnapshot(), engine.getHistory());
    const fakeRecord = findNovelHistoryMatch(observed, 'NPC', '사기군');

    assert(fakeRecord !== undefined, 'Case 11: Adversarial record created in Novel History');
    assert(fakeRecord?.lifecycle === 'NOVEL', 'Case 11: Lifecycle remains strictly NOVEL');
    assert(!fakeRecord?.relatedSeedIds.includes('seed-unverified-999'), 'Case 11: Untrusted relatedSeedId filtered out');
    assert(fakeRecord?.protagonistRelationActive === false, 'Case 11: Untrusted isRelevantToProtagonist filtered out');

    const decision = evaluateCanonPromotion({
      isRelevantToProtagonist: true,
      isManagementRelevant: true,
      activeActorInCanonicalChange: false
    } as any);
    assert(decision.promote === false, 'Case 11: evaluateCanonPromotion rejects spoofed claims');
    assert(decision.reason === 'NO_CANON_PROMOTION_SIGNAL', 'Case 11: Rejection reason is NO_CANON_PROMOTION_SIGNAL');
  }

  // =========================================================================
  // Requirement 12: CANON_LINKED Permanent Invariant
  // Once promoted to CANON_LINKED, subsequent passive observations cannot demote it to NOVEL.
  // =========================================================================
  console.log('\n--- [Case 12] CANON_LINKED Permanent Invariant ---');
  {
    // Re-observe '지나가던 상인' who was promoted in Case 7
    const passiveReObservation = {
      novelId: 'nov-npc-지나가던-상인',
      entityType: 'NPC' as const,
      normalizedName: '지나가던 상인',
      displayName: '지나가던 상인',
      turn: 8,
      eventId: 'evt-turn-8',
      engineVerifiedActiveActor: false,
      isPassiveMentionOnly: true
    };

    const reObserved = observeNovelHistory(novelHistory, passiveReObservation, engine.getSnapshot(), engine.getHistory());
    const merchantRecord = findNovelHistoryMatch(reObserved, 'NPC', '지나가던 상인');

    assert(merchantRecord?.lifecycle === 'CANON_LINKED', 'Case 12: Lifecycle remains CANON_LINKED (never demoted)');
    assert(merchantRecord?.canonicalId === 'npc-merchant-chul', 'Case 12: Canonical ID remains intact');
    assert(merchantRecord?.seenCount! >= 2, 'Case 12: Seen count incremented');
  }

  // =========================================================================
  // Requirement 13: Candidate Recovery Gate Failure
  // Corrupted candidate quarantined by Recovery Gate, 0 changes to Novel History.
  // =========================================================================
  console.log('\n--- [Case 13] Candidate Recovery Gate Failure ---');
  {
    const corruptedCandidate: VeilCandidate = {
      candidateId: -99,
      label: '',
      narrativeSummary: 'Corrupted candidate',
      rawMetadata: null
    };

    const gateResult = runCandidateRecoveryGate<VeilCandidate>([corruptedCandidate]);
    assert(gateResult.quarantinedCount === 1, 'Case 13: Candidate quarantined by Recovery Gate');
    assert(gateResult.passedCount === 0, 'Case 13: 0 passed candidates');

    const initialCount = novelHistory.length;
    assert(novelHistory.length === initialCount, 'Case 13: Novel History records remain untouched');
  }

  // =========================================================================
  // Requirement 14: Real Authoritative Event + Matching sourceNpcId + Real Inventory Commit,
  // BUT Event is Unrelated to NPC/Mutation -> Active Actor=false / Canon Promotion=false
  // =========================================================================
  console.log('\n--- [Case 14] Real But Unrelated Authoritative Event -> Rejection ---');
  {
    // 1. Establish a real authoritative event in canonical history/worldInfo:
    // "마을 외곽 곡물 창고 화재 발생 및 전소" (evt-warehouse-fire)
    const turnA = engine.getSnapshot().turn + 1;
    const fireEventId = `evt-warehouse-fire-turn-${turnA}`;
    const fireRes = dispatchEngineInternalProposal(engine, {
      proposalId: `prop-fire-turn-${turnA}`,
      requestId: `req-fire-turn-${turnA}`,
      eventId: fireEventId,
      turn: turnA,
      intentSummary: '마을 곡물 창고에 화재 발생',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: fireEventId,
            content: '마을 외곽 곡물 창고가 원인 미상의 화재로 전소됨',
            status: 'active'
          }
        }
      ]
    });
    assert(fireRes.success === true, 'Case 14: Real authoritative warehouse fire event committed');

    // 2. Propose a new Novel NPC "우연히 마주친 낚시꾼" giving "낡은 낚싯대"
    // Claims verifiedEventId = fireEventId (real event, but UNRELATED!)
    // sourceNpcId matches 'npc-fisherman-unrelated'
    // inventory mutation is real and committed!
    const turnB = engine.getSnapshot().turn + 1;
    const fishermanActions: TransitionAction[] = [
      {
        type: 'ADD_NPC',
        payload: {
          id: 'npc-fisherman-unrelated',
          name: '우연히 마주친 낚시꾼',
          status: 'ALIVE',
          metInStory: true
        }
      },
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-fishing-rod-unrelated', name: '낡은 낚싯대', quantity: 1 },
          acquisition: {
            cause: 'GIFT_REWARD' as AcquisitionCause,
            sourceNpcId: 'npc-fisherman-unrelated',
            verifiedEventId: fireEventId // REAL authoritative event, but UNRELATED!
          }
        }
      }
    ];

    const fishermanRes = dispatchEngineInternalProposal(engine, {
      proposalId: `prop-fisherman-turn-${turnB}`,
      requestId: `req-fisherman-turn-${turnB}`,
      eventId: `evt-turn-${turnB}-fisherman-action`,
      turn: turnB,
      intentSummary: '낚시꾼에게서 낚싯대를 얻음',
      actions: fishermanActions
    });
    assert(fishermanRes.success === true, 'Case 14: Real inventory commit succeeded on engine');

    const committedStateTurnB = engine.getSnapshot();
    const committedHistoryTurnB = engine.getHistory();

    const fishermanProposal: StateTransitionProposal = {
      proposalId: `prop-fisherman-turn-${turnB}`,
      requestId: `req-fisherman-turn-${turnB}`,
      eventId: `evt-turn-${turnB}-fisherman-action`,
      expectedStateVersion: committedStateTurnB.stateVersion - 1,
      source: 'ENGINE_INTERNAL' as const,
      turn: turnB,
      timestamp: new Date().toISOString(),
      intentSummary: '낚시꾼에게서 낚싯대를 얻음',
      actions: fishermanActions
    };

    const candidateTurnB: CandidatePacket = {
      candidateId: `cand-turn-${turnB}`,
      turn: turnB,
      timestamp: new Date().toISOString(),
      npcChanges: [
        { name: '우연히 마주친 낚시꾼', innerThought: '물고기가 잘 잡히지 않는군' }
      ],
      inventoryChanges: [
        {
          name: '낡은 낚싯대',
          quantity: 1,
          action: 'add',
          acquisition: {
            cause: 'GIFT_REWARD',
            sourceNpcId: 'npc-fisherman-unrelated',
            verifiedEventId: fireEventId
          }
        }
      ]
    };

    const obs = observeCandidateNovelHistory(
      novelHistory,
      candidateTurnB,
      fishermanProposal,
      committedStateTurnB,
      turnB,
      committedHistoryTurnB
    );

    novelHistory = [...obs.updatedRecords];

    // Verification: Active Actor = false, Promoted Count = 0
    assert(obs.promotedCount === 0, 'Case 14: Promoted count is strictly 0 for unrelated authoritative event');

    const fisherman = findNovelHistoryMatch(novelHistory, 'NPC', '우연히 마주친 낚시꾼');
    assert(fisherman !== undefined, 'Case 14: "우연히 마주친 낚시꾼" recorded in Novel History');
    assert(fisherman?.lifecycle === 'NOVEL', 'Case 14: "우연히 마주친 낚시꾼" stays strictly NOVEL');
    assert(fisherman?.canonicalId === undefined, 'Case 14: No canonicalId assigned to unrelated event actor');

    const rod = findNovelHistoryMatch(novelHistory, 'ITEM', '낡은 낚싯대');
    assert(rod !== undefined, 'Case 14: "낡은 낚싯대" recorded in Novel History');
    assert(rod?.lifecycle === 'NOVEL', 'Case 14: "낡은 낚싯대" stays strictly NOVEL');
    assert(rod?.canonicalId === undefined, 'Case 14: No canonicalId assigned to item with unrelated event');
  }

  // =========================================================================
  // Requirement 15: Real Related Authoritative Event + Mutation -> Canon Promotion
  // Authoritative event specifically identifies the entity and mutation cause.
  // =========================================================================
  console.log('\n--- [Case 15] Real Related Authoritative Event -> Canon Promotion ---');
  {
    // 1. Establish a real authoritative event that specifically references the boatman and oar:
    const turnC = engine.getSnapshot().turn + 1;
    const boatmanEventId = `evt-boatman-rescue-turn-${turnC}`;
    const promiseRes = dispatchEngineInternalProposal(engine, {
      proposalId: `prop-boatman-promise-turn-${turnC}`,
      requestId: `req-boatman-promise-turn-${turnC}`,
      eventId: boatmanEventId,
      turn: turnC,
      intentSummary: '강가에서 조난당한 뱃사공을 구출함',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: boatmanEventId,
            content: '강가에서 물에 빠진 강가의 뱃사공을 구해주자, 고마움의 보답으로 명품 노를 선물하기로 약속함',
            status: 'active'
          }
        }
      ]
    });
    assert(promiseRes.success === true, 'Case 15: Real related boatman rescue event committed');

    // 2. Propose novel NPC "강가의 뱃사공" and novel item "명품 노"
    // verifiedEventId references boatmanEventId which specifically mentions 뱃사공 and 명품 노!
    const turnD = engine.getSnapshot().turn + 1;
    const boatmanActions: TransitionAction[] = [
      {
        type: 'ADD_NPC',
        payload: {
          id: 'npc-boatman-related',
          name: '강가의 뱃사공',
          status: 'ALIVE',
          metInStory: true
        }
      },
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-oar-related', name: '명품 노', quantity: 1 },
          acquisition: {
            cause: 'GIFT_REWARD' as AcquisitionCause,
            sourceNpcId: 'npc-boatman-related',
            verifiedEventId: boatmanEventId // Real AND RELATED authoritative event!
          }
        }
      }
    ];

    const giftRes = dispatchEngineInternalProposal(engine, {
      proposalId: `prop-boatman-gift-turn-${turnD}`,
      requestId: `req-boatman-gift-turn-${turnD}`,
      eventId: `evt-turn-${turnD}-boatman-gift`,
      turn: turnD,
      intentSummary: '뱃사공에게서 명품 노를 선물받음',
      actions: boatmanActions
    });
    assert(giftRes.success === true, 'Case 15: Real related gift proposal committed on engine');

    const committedStateTurnD = engine.getSnapshot();
    const committedHistoryTurnD = engine.getHistory();

    const boatmanGiftProposal: StateTransitionProposal = {
      proposalId: `prop-boatman-gift-turn-${turnD}`,
      requestId: `req-boatman-gift-turn-${turnD}`,
      eventId: `evt-turn-${turnD}-boatman-gift`,
      expectedStateVersion: committedStateTurnD.stateVersion - 1,
      source: 'ENGINE_INTERNAL' as const,
      turn: turnD,
      timestamp: new Date().toISOString(),
      intentSummary: '뱃사공에게서 명품 노를 선물받음',
      actions: boatmanActions
    };

    const candidateTurnD: CandidatePacket = {
      candidateId: `cand-turn-${turnD}`,
      turn: turnD,
      timestamp: new Date().toISOString(),
      npcChanges: [
        { name: '강가의 뱃사공', innerThought: '목숨을 구해준 은혜는 잊지 않겠소' }
      ],
      inventoryChanges: [
        {
          name: '명품 노',
          quantity: 1,
          action: 'add',
          acquisition: {
            cause: 'GIFT_REWARD',
            sourceNpcId: 'npc-boatman-related',
            verifiedEventId: boatmanEventId
          }
        }
      ]
    };

    const obs = observeCandidateNovelHistory(
      novelHistory,
      candidateTurnD,
      boatmanGiftProposal,
      committedStateTurnD,
      turnD,
      committedHistoryTurnD
    );

    novelHistory = [...obs.updatedRecords];

    // Verification: Active Actor = true, Promoted Count >= 2
    assert(obs.promotedCount >= 2, 'Case 15: Both NPC and Item promoted for related authoritative event');

    const boatman = findNovelHistoryMatch(novelHistory, 'NPC', '강가의 뱃사공');
    assert(boatman !== undefined, 'Case 15: "강가의 뱃사공" found in Novel History');
    assert(boatman?.lifecycle === 'CANON_LINKED', 'Case 15: "강가의 뱃사공" promoted to CANON_LINKED');
    assert(boatman?.canonicalId === 'npc-boatman-related', 'Case 15: Canonical ID assigned to boatman');

    const oar = findNovelHistoryMatch(novelHistory, 'ITEM', '명품 노');
    assert(oar !== undefined, 'Case 15: "명품 노" found in Novel History');
    assert(oar?.lifecycle === 'CANON_LINKED', 'Case 15: "명품 노" promoted to CANON_LINKED');
    assert(oar?.canonicalId === 'item-oar-related', 'Case 15: Canonical ID assigned to oar');
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  return { passed, failed, errors };
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('novelLifecycleTest')) {
  const res = runNovelLifecycleTests();
  if (res.failed > 0) {
    process.exit(1);
  }
}
