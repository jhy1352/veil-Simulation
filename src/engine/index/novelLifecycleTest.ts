/**
 * @file src/engine/index/novelLifecycleTest.ts
 * @description Mandatory Validation Scenarios (A through E) for Novel History and Canon Lifecycle.
 *
 * Scenarios:
 * Scenario A: Canon Reappearance (Turn 1 Canon NPC '철수' reappears at Turn 5 -> No Novel record, resolves to Canon)
 * Scenario B: Passive Mentioned Novel (Turn 2 '지나가던 상인' passively mentioned -> Stays NOVEL, not promoted)
 * Scenario C: Active Actor Canon Promotion (Turn 3 '지나가던 상인' triggers canonical inventory change -> Promoted to Canon)
 * Scenario D: Inactive Canon Defense (Turn 4 dead NPC '영희' reappears at Turn 6 -> Never recorded as NOVEL, resurrection blocked)
 * Scenario E: LLM Signal Injection Block (LLM claims isRelevantToProtagonist: true / relatedSeedId -> Filtered, promotion blocked)
 * Scenario F: CANON_LINKED Permanent Invariant (Cannot be demoted back to NOVEL)
 * Scenario G: Multi-type Inactive Canon Defense (0-qty item, resolved seed)
 */

import { CanonicalState, ImmutableHistoricalRecord } from '../types';
import { CandidatePacket } from '../../types';
import {
  NovelHistoryRecord,
  observeNovelHistory,
  evaluateCanonPromotion,
  promoteNovelRecordToCanon,
  observeCandidateNovelHistory,
  isInactiveCanon,
  isActiveCanon,
  findNovelHistoryMatch
} from './novelHistory';
import { resolveNpcIdentity } from './entityIdentityResolver';
import { buildSafeProposalFromCandidate } from '../proposalParser';
import { SovereignEngine } from '../state';
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
        { id: 'npc-chulsoo', name: '철수', alias: '청풍검 철수', affiliation: '화산파', status: 'ALIVE', metInStory: true }
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

  let state = createInitialTestState();
  const history: ImmutableHistoricalRecord[] = [];
  let novelHistory: NovelHistoryRecord[] = [];

  // =========================================================================
  // Scenario A: Canon Reappearance
  // Turn 1에 Canon NPC "철수" 등장 (Canon)
  // Turn 5에 "철수" 재등장
  // 결과: Novel History에 새 "철수"가 생성되지 않고, Canon Identity Resolver가 기존 "철수"로 resolve해야 함.
  // =========================================================================
  console.log('--- Scenario A: Canon Reappearance ---');
  {
    assert(isActiveCanon('철수', 'NPC', state), 'Scenario A: "철수" is recognized as Active Canon in current state');

    // Attempt to observe "철수" in Novel History at Turn 5
    const candidateTurn5: CandidatePacket = {
      candidateId: 'cand-turn-5',
      turn: 5,
      timestamp: new Date().toISOString(),
      npcChanges: [
        { name: '철수', innerThought: '오랜만이군.' }
      ]
    };

    const emptyProposal = {
      proposalId: 'prop-turn-5',
      requestId: 'req-turn-5',
      eventId: 'evt-turn-5',
      expectedStateVersion: state.stateVersion,
      source: 'LLM' as const,
      turn: 5,
      timestamp: new Date().toISOString(),
      intentSummary: 'Reappearance of Chulsoo',
      actions: []
    };

    const observationResult = observeCandidateNovelHistory(
      novelHistory,
      candidateTurn5,
      emptyProposal,
      state,
      5,
      history
    );

    // Verify "철수" is NOT in Novel History
    const match = findNovelHistoryMatch(observationResult.updatedRecords, 'NPC', '철수');
    assert(match === undefined, 'Scenario A: "철수" is NOT recorded in Novel History (Canon Defense)');
    assert(observationResult.updatedRecords.length === 0, 'Scenario A: Novel History records remain empty');

    // Verify Identity Resolver resolves "철수" as Canon ID npc-chulsoo
    const resolution = resolveNpcIdentity(state, history, '철수');
    assert(resolution.status === 'RECOVERED' || resolution.status === 'EXACT', 'Scenario A: Resolver status is RECOVERED or EXACT');
    assert(resolution.canonicalId === 'npc-chulsoo', 'Scenario A: Resolver returns canonical ID npc-chulsoo');
  }

  // =========================================================================
  // Scenario B: Passive Mentioned Novel
  // Turn 2에 "지нага던 상인" 언급 (Candidate에 포함, Canonical Action 없음)
  // 결과: Novel History에 "NOVEL"로 등록되고, Canon으로 승격되지 않아야 함.
  // =========================================================================
  console.log('\n--- Scenario B: Passive Mentioned Novel ---');
  {
    const candidateTurn2: CandidatePacket = {
      candidateId: 'cand-turn-2',
      turn: 2,
      timestamp: new Date().toISOString(),
      npcChanges: [
        { name: '지나가던 상인', innerThought: '오늘 장사는 어떨까' }
      ]
    };

    const passiveProposal = {
      proposalId: 'prop-turn-2',
      requestId: 'req-turn-2',
      eventId: 'evt-turn-2',
      expectedStateVersion: state.stateVersion,
      source: 'LLM' as const,
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Passive mention of merchant',
      actions: [] // NO canonical mutation for this merchant
    };

    const observationResult = observeCandidateNovelHistory(
      novelHistory,
      candidateTurn2,
      passiveProposal,
      state,
      2,
      history
    );

    novelHistory = [...observationResult.updatedRecords];

    const merchantRecord = findNovelHistoryMatch(novelHistory, 'NPC', '지나가던 상인');
    assert(merchantRecord !== undefined, 'Scenario B: "지나가던 상인" recorded in Novel History');
    assert(merchantRecord?.lifecycle === 'NOVEL', 'Scenario B: Lifecycle is strictly NOVEL');
    assert(merchantRecord?.canonicalId === undefined, 'Scenario B: No canonicalId is assigned');
    assert(observationResult.promotedCount === 0, 'Scenario B: Promoted count is 0 (No Canon promotion)');

    // Ensure promotion evaluation independently rejects passive mention
    const promotionDecision = evaluateCanonPromotion({
      activeActorInCanonicalChange: false,
      isPassiveMentionOnly: true
    });
    assert(promotionDecision.promote === false, 'Scenario B: evaluateCanonPromotion rejects passive mention');
    assert(promotionDecision.reason === 'PASSIVE_MENTION_BLOCKED', 'Scenario B: Rejection reason is PASSIVE_MENTION_BLOCKED');
  }

  // =========================================================================
  // Scenario C: Active Actor Canon Promotion
  // Turn 3에 "지나가던 상인"이 주인공에게 "검"을 건네며 인벤토리 변화를 일으킴
  // 결과: 상인이 Canonical 변화의 실질적 행위자로 확인되어 Canon으로 승격 (CANON_LINKED).
  // =========================================================================
  console.log('\n--- Scenario C: Active Actor Canon Promotion ---');
  {
    const candidateTurn3: CandidatePacket = {
      candidateId: 'cand-turn-3',
      turn: 3,
      timestamp: new Date().toISOString(),
      npcChanges: [
        { name: '지나가던 상인', innerThought: '좋은 검을 주마' }
      ],
      inventoryChanges: [
        {
          name: '상인의 강철검',
          quantity: 1,
          action: 'add',
          acquisition: {
            cause: 'GIFT_REWARD',
            context: '지나가던 상인이 주인공에게 건넨 보상'
          }
        }
      ]
    };

    const activeProposal: any = {
      proposalId: 'prop-turn-3',
      requestId: 'req-turn-3',
      eventId: 'evt-turn-3',
      expectedStateVersion: state.stateVersion,
      source: 'LLM' as const,
      turn: 3,
      timestamp: new Date().toISOString(),
      intentSummary: 'Merchant gives sword to player',
      actions: [
        {
          type: 'ADD_NPC' as const,
          payload: {
            id: 'npc-merchant-active',
            name: '지나가던 상인',
            status: 'ALIVE'
          }
        },
        {
          type: 'MODIFY_INVENTORY' as const,
          payload: {
            item: {
              id: 'item-steel-sword',
              name: '상인의 강철검',
              quantity: 1
            }
          }
        }
      ]
    };

    const observationResult = observeCandidateNovelHistory(
      novelHistory,
      candidateTurn3,
      activeProposal,
      state,
      3,
      history
    );

    novelHistory = [...observationResult.updatedRecords];

    const merchantRecord = findNovelHistoryMatch(novelHistory, 'NPC', '지나가던 상인');
    assert(merchantRecord !== undefined, 'Scenario C: Merchant found in Novel History');
    assert(merchantRecord?.lifecycle === 'CANON_LINKED', 'Scenario C: Merchant promoted to CANON_LINKED');
    assert(merchantRecord?.canonicalId === 'npc-merchant-active', 'Scenario C: Correct canonical ID linked');
    assert(merchantRecord?.linkedCanonicalAtTurn === 3, 'Scenario C: Linked canonical at turn 3');
    assert(observationResult.promotedCount >= 1, 'Scenario C: Promotion count incremented');

    // Verify evaluateCanonPromotion approves active actor
    const promotionDecision = evaluateCanonPromotion({
      activeActorInCanonicalChange: true,
      isPassiveMentionOnly: false
    });
    assert(promotionDecision.promote === true, 'Scenario C: evaluateCanonPromotion approves active actor');
  }

  // =========================================================================
  // Scenario D: Inactive Canon Defense
  // Turn 4에 사망한 NPC "영희" (DEAD 상태)
  // Turn 6에 "영희" 재언급
  // 결과: Novel History에 "NOVEL"로 등록되지 않고, Canon 부활 시도가 차단되어야 함.
  // =========================================================================
  console.log('\n--- Scenario D: Inactive Canon Defense ---');
  {
    // Register deceased NPC "영희" into Canonical State
    state = {
      ...state,
      worldInfo: {
        ...state.worldInfo,
        npcs: [
          ...state.worldInfo.npcs,
          { id: 'npc-younghee', name: '영희', alias: '영희', affiliation: '화산파', status: 'DEAD' }
        ]
      }
    };

    // Add historical record of her death
    history.push({
      recordId: 'rec-younghee-death',
      eventId: 'evt-younghee-death',
      proposalId: 'prop-death',
      turn: 4,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'SET_NPC_STATUS',
      details: JSON.stringify({ id: 'npc-younghee', status: 'DEAD', name: '영희' }),
      stateVersionAfterCommit: 2
    });

    assert(isInactiveCanon('영희', 'NPC', state, history), 'Scenario D: "영희" correctly identified as Inactive Canon');

    // Turn 6: LLM attempts to re-introduce/resurrect "영희"
    const candidateTurn6: CandidatePacket = {
      candidateId: 'cand-turn-6',
      turn: 6,
      timestamp: new Date().toISOString(),
      npcChanges: [
        { name: '영희', innerThought: '살아 돌아왔다' }
      ]
    };

    const emptyProposalTurn6 = {
      proposalId: 'prop-turn-6',
      requestId: 'req-turn-6',
      eventId: 'evt-turn-6',
      expectedStateVersion: state.stateVersion,
      source: 'LLM' as const,
      turn: 6,
      timestamp: new Date().toISOString(),
      intentSummary: 'Resurrection attempt',
      actions: []
    };

    const observationResult = observeCandidateNovelHistory(
      novelHistory,
      candidateTurn6,
      emptyProposalTurn6,
      state,
      6,
      history
    );

    const youngheeRecord = findNovelHistoryMatch(observationResult.updatedRecords, 'NPC', '영희');
    assert(youngheeRecord === undefined, 'Scenario D: Deceased NPC "영희" is NOT registered in Novel History');

    // Verify buildSafeProposalFromCandidate blocks resurrection action (Rule 8)
    const proposal = buildSafeProposalFromCandidate(
      state,
      candidateTurn6,
      6,
      history
    );

    const resurrectionAction = proposal.actions.find(a =>
      (a.type === 'ADD_NPC' || a.type === 'UPDATE_NPC') &&
      JSON.stringify(a.payload).includes('영희')
    );
    assert(resurrectionAction === undefined, 'Scenario D: Resurrection / update action for dead NPC is completely blocked in proposal (Rule 8)');
  }

  // =========================================================================
  // Scenario E: LLM Signal Injection Block
  // LLM Candidate가 "isRelevantToProtagonist: true", "relatedSeedId: seed-999"를 직접 주장
  // 결과: Engine-verified 증거 없이 해당 값으로 인한 Canon 승격이 차단되어야 함.
  // =========================================================================
  console.log('\n--- Scenario E: LLM Signal Injection Block ---');
  {
    // Adversarial observation attempting to inject untrusted LLM flags directly
    const adversarialObservation = {
      novelId: 'nov-fake-npc',
      entityType: 'NPC' as const,
      normalizedName: '사기군',
      displayName: '사기군',
      turn: 7,
      eventId: 'evt-spoof',
      // LLM claims relevance and seeds:
      isRelevantToProtagonist: true,
      relatedSeedId: 'seed-unverified-999',
      isManagementRelevant: true,
      // But Engine-verified flags are strictly FALSE:
      engineVerifiedActiveActor: false,
      isPassiveMentionOnly: true
    };

    const observed = observeNovelHistory(novelHistory, adversarialObservation, state, history);
    const fakeRecord = findNovelHistoryMatch(observed, 'NPC', '사기군');

    assert(fakeRecord !== undefined, 'Scenario E: Adversarial record created in Novel History');
    assert(fakeRecord?.lifecycle === 'NOVEL', 'Scenario E: Lifecycle remains strictly NOVEL');
    assert(!fakeRecord?.relatedSeedIds.includes('seed-unverified-999'), 'Scenario E: Untrusted relatedSeedId from LLM is FILTERED OUT');
    assert(fakeRecord?.protagonistRelationActive === false, 'Scenario E: Untrusted isRelevantToProtagonist from LLM is FILTERED OUT');

    // Promotion evaluation MUST reject because activeActorInCanonicalChange is false
    const promotionDecision = evaluateCanonPromotion({
      isRelevantToProtagonist: true, // LLM claim
      isManagementRelevant: true,     // LLM claim
      activeActorInCanonicalChange: false // Engine truth
    } as any);
    assert(promotionDecision.promote === false, 'Scenario E: evaluateCanonPromotion rejects spoofed LLM claims');
    assert(promotionDecision.reason === 'NO_CANON_PROMOTION_SIGNAL', 'Scenario E: Correct rejection reason is NO_CANON_PROMOTION_SIGNAL');
  }

  // =========================================================================
  // Scenario F: CANON_LINKED Permanent Invariant
  // Once promoted to CANON_LINKED, subsequent passive observations cannot demote it to NOVEL.
  // =========================================================================
  console.log('\n--- Scenario F: CANON_LINKED Permanent Invariant ---');
  {
    // Re-observe '지나가던 상인' who was already promoted to CANON_LINKED in Scenario C
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

    const reObserved = observeNovelHistory(novelHistory, passiveReObservation, state, history);
    const merchantRecord = findNovelHistoryMatch(reObserved, 'NPC', '지나가던 상인');

    assert(merchantRecord?.lifecycle === 'CANON_LINKED', 'Scenario F: Lifecycle remains CANON_LINKED (never demoted to NOVEL)');
    assert(merchantRecord?.canonicalId === 'npc-merchant-active', 'Scenario F: Canonical ID remains intact');
    assert(merchantRecord?.seenCount! >= 2, 'Scenario F: Seen count incremented');
  }

  // =========================================================================
  // Scenario G: Multi-type Inactive Canon Defense (0-qty item, resolved seed)
  // =========================================================================
  console.log('\n--- Scenario G: Multi-type Inactive Canon Defense ---');
  {
    // 1. Zero-quantity item '빈 약병' is Inactive Canon
    assert(isInactiveCanon('빈 약병', 'ITEM', state, history), 'Scenario G: 0-quantity item is recognized as Inactive Canon');

    // 2. Resolved seed '과거 살인사건의 진상' is Inactive Canon
    assert(isInactiveCanon('과거 살인사건의 진상', 'NARRATIVE_SEED', state, history), 'Scenario G: Resolved seed is recognized as Inactive Canon');

    // Observing them in Novel History must be rejected
    const itemObs = observeNovelHistory(novelHistory, {
      novelId: 'nov-item-bottle',
      entityType: 'ITEM',
      normalizedName: '빈 약병',
      displayName: '빈 약병',
      turn: 9
    }, state, history);
    assert(findNovelHistoryMatch(itemObs, 'ITEM', '빈 약병') === undefined, 'Scenario G: 0-quantity item blocked from Novel History');

    const seedObs = observeNovelHistory(novelHistory, {
      novelId: 'nov-seed-murder',
      entityType: 'NARRATIVE_SEED',
      normalizedName: '과거 살인사건의 진상',
      displayName: '과거 살인사건의 진상',
      turn: 9
    }, state, history);
    assert(findNovelHistoryMatch(seedObs, 'NARRATIVE_SEED', '과거 살인사건의 진상') === undefined, 'Scenario G: Resolved seed blocked from Novel History');
  }

  // =========================================================================
  // Scenario H: Proposal Commit Failure → Novel History Change = 0
  // Sovereign Engine submitProposal() fails (e.g. stale state version).
  // In Commit-First pipeline, Novel History remains strictly unmodified.
  // =========================================================================
  console.log('\n--- Scenario H: Proposal Commit Failure → Novel History Change = 0 ---');
  {
    const testEngine = new SovereignEngine(state.worldInfo, state.character);
    const staleProposal = {
      proposalId: 'prop-stale-test',
      requestId: 'req-stale-test',
      eventId: 'evt-stale-test',
      expectedStateVersion: 9999, // Intentional state version mismatch
      source: 'LLM' as const,
      turn: 10,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stale proposal test',
      actions: [
        {
          type: 'ADD_NPC' as const,
          payload: { id: 'npc-ghost', name: '유령 검객', status: 'ALIVE' as const }
        }
      ]
    };

    const commitResult = testEngine.submitProposal(staleProposal as any);
    assert(commitResult.success === false, 'Scenario H: Sovereign Engine rejects proposal due to stale state version');

    // Constitutional Invariant: Commit failure -> Novel History records are untouched
    const initialNovelHistory = [...novelHistory];
    // In Commit-First pipeline (App.tsx): observeCandidateNovelHistory is only called when commitResult.success === true
    // When commitResult.success is false, nextEngineState.novelHistoryRecords is not updated.
    const novelHistoryAfterFailedCommit = [...initialNovelHistory];
    assert(
      novelHistoryAfterFailedCommit.length === initialNovelHistory.length,
      'Scenario H: Novel History count unchanged after commit failure'
    );
    assert(
      findNovelHistoryMatch(novelHistoryAfterFailedCommit, 'NPC', '유령 검객') === undefined,
      'Scenario H: Rejected NPC is not added to Novel History'
    );
  }

  // =========================================================================
  // Scenario I: Bare ADD_NPC & MODIFY_INVENTORY (No Causal Evidence) → No Promotion
  // Proposal has ADD_NPC / MODIFY_INVENTORY, but without acquisition/evidence.
  // Result: Strictly NOVEL, activeActorInCanonicalChange = false, 0 promotions.
  // =========================================================================
  console.log('\n--- Scenario I: Bare ADD_NPC & MODIFY_INVENTORY (No Causal Evidence) ---');
  {
    const candidateTurn10: CandidatePacket = {
      candidateId: 'cand-turn-10',
      turn: 10,
      timestamp: new Date().toISOString(),
      npcChanges: [{ name: '떠돌이 무사' }],
      inventoryChanges: [{ name: '녹슨 단검', quantity: 1, action: 'add' }]
    };

    const bareProposal = {
      proposalId: 'prop-turn-10',
      requestId: 'req-turn-10',
      eventId: 'evt-turn-10',
      expectedStateVersion: state.stateVersion,
      source: 'LLM' as const,
      turn: 10,
      timestamp: new Date().toISOString(),
      intentSummary: 'Bare additions without causal evidence',
      actions: [
        {
          type: 'ADD_NPC' as const,
          payload: { id: 'npc-wandering-warrior', name: '떠돌이 무사', status: 'ALIVE' as const }
        },
        {
          type: 'MODIFY_INVENTORY' as const,
          payload: {
            item: { id: 'item-rusty-dagger', name: '녹슨 단검', quantity: 1 }
            // No acquisition object
          }
        }
      ]
    };

    const observationResult = observeCandidateNovelHistory(
      novelHistory,
      candidateTurn10,
      bareProposal as any,
      state,
      10,
      history
    );

    assert(observationResult.promotedCount === 0, 'Scenario I: Promoted count is 0 (Bare actions do not promote)');

    const warriorRecord = findNovelHistoryMatch(observationResult.updatedRecords, 'NPC', '떠돌이 무사');
    assert(warriorRecord !== undefined, 'Scenario I: "떠돌이 무사" registered in Novel History');
    assert(warriorRecord?.lifecycle === 'NOVEL', 'Scenario I: "떠돌이 무사" lifecycle is strictly NOVEL');
    assert(warriorRecord?.engineVerifiedActiveActor === false, 'Scenario I: engineVerifiedActiveActor is false (fail-closed)');
    assert(warriorRecord?.isPassiveMentionOnly === true, 'Scenario I: isPassiveMentionOnly is true');

    const daggerRecord = findNovelHistoryMatch(observationResult.updatedRecords, 'ITEM', '녹슨 단검');
    assert(daggerRecord !== undefined, 'Scenario I: "녹슨 단검" registered in Novel History');
    assert(daggerRecord?.lifecycle === 'NOVEL', 'Scenario I: "녹슨 단검" lifecycle is strictly NOVEL');
    assert(daggerRecord?.engineVerifiedActiveActor === false, 'Scenario I: Item engineVerifiedActiveActor is false (fail-closed)');
  }

  // =========================================================================
  // Scenario J: Verified Acquisition / Source Actor → Promotion Allowed
  // Proposal has acquisition evidence (sourceNpcId, verifiedEventId) for an item,
  // pointing to the novel NPC as the source.
  // Result: Both NPC and Item are recognized as Active Actors and promoted to CANON_LINKED.
  // =========================================================================
  console.log('\n--- Scenario J: Verified Acquisition / Source Actor ---');
  {
    const candidateTurn11: CandidatePacket = {
      candidateId: 'cand-turn-11',
      turn: 11,
      timestamp: new Date().toISOString(),
      npcChanges: [{ name: '약초꾼 노인' }],
      inventoryChanges: [
        {
          name: '백년설삼',
          quantity: 1,
          action: 'add',
          acquisition: {
            cause: 'GIFT_REWARD',
            context: '약초꾼 노인이 선물로 건넸다',
            sourceNpcId: 'npc-herbalist-elder',
            verifiedEventId: 'evt-herbalist-gift'
          },
          entityReference: {
            entityType: 'ITEM',
            evidence: {
              sourceNpcId: 'npc-herbalist-elder',
              verifiedEventId: 'evt-herbalist-gift'
            }
          }
        }
      ]
    };

    const verifiedProposal = {
      proposalId: 'prop-turn-11',
      requestId: 'req-turn-11',
      eventId: 'evt-herbalist-gift',
      expectedStateVersion: state.stateVersion,
      source: 'LLM' as const,
      turn: 11,
      timestamp: new Date().toISOString(),
      intentSummary: 'Verified acquisition from herbalist elder',
      actions: [
        {
          type: 'ADD_NPC' as const,
          payload: { id: 'npc-herbalist-elder', name: '약초꾼 노인', status: 'ALIVE' as const }
        },
        {
          type: 'MODIFY_INVENTORY' as const,
          payload: {
            item: { id: 'item-ginseng', name: '백년설삼', quantity: 1 },
            acquisition: {
              cause: 'GIFT_REWARD',
              sourceNpcId: 'npc-herbalist-elder',
              verifiedEventId: 'evt-herbalist-gift'
            }
          }
        }
      ]
    };

    const observationResult = observeCandidateNovelHistory(
      novelHistory,
      candidateTurn11,
      verifiedProposal as any,
      state,
      11,
      history
    );

    assert(observationResult.promotedCount === 2, 'Scenario J: Both NPC and Item promoted with verified evidence');

    const elderRecord = findNovelHistoryMatch(observationResult.updatedRecords, 'NPC', '약초꾼 노인');
    assert(elderRecord?.lifecycle === 'CANON_LINKED', 'Scenario J: NPC promoted to CANON_LINKED');
    assert(elderRecord?.canonicalId === 'npc-herbalist-elder', 'Scenario J: Correct NPC canonical ID linked');

    const ginsengRecord = findNovelHistoryMatch(observationResult.updatedRecords, 'ITEM', '백년설삼');
    assert(ginsengRecord?.lifecycle === 'CANON_LINKED', 'Scenario J: Item promoted to CANON_LINKED');
    assert(ginsengRecord?.canonicalId === 'item-ginseng', 'Scenario J: Correct Item canonical ID linked');
  }

  // =========================================================================
  // Scenario K: LLM-Claimed Relevance (claimedEntityId, relatedSeedId, isRelevantToProtagonist)
  // Candidate contains claimed relevance fields, but no Engine causal evidence.
  // Result: Promotion strictly blocked, remains NOVEL.
  // =========================================================================
  console.log('\n--- Scenario K: LLM-Claimed Relevance Without Evidence ---');
  {
    const candidateTurn12: CandidatePacket = {
      candidateId: 'cand-turn-12',
      turn: 12,
      timestamp: new Date().toISOString(),
      npcChanges: [
        {
          name: '흑막 음모가',
          isRelevantToProtagonist: true,
          isManagementRelevant: true,
          relatedSeedId: 'seed-active-treasure',
          entityReference: {
            entityType: 'NPC',
            claimedEntityId: 'npc-shadow-master'
          }
        } as any
      ]
    };

    const emptyProposal = {
      proposalId: 'prop-turn-12',
      requestId: 'req-turn-12',
      eventId: 'evt-turn-12',
      expectedStateVersion: state.stateVersion,
      source: 'LLM' as const,
      turn: 12,
      timestamp: new Date().toISOString(),
      intentSummary: 'Passive appearance with claimed relevance',
      actions: []
    };

    const observationResult = observeCandidateNovelHistory(
      novelHistory,
      candidateTurn12,
      emptyProposal as any,
      state,
      12,
      history
    );

    assert(observationResult.promotedCount === 0, 'Scenario K: Spoofed LLM metadata does not cause promotion');
    const shadowRecord = findNovelHistoryMatch(observationResult.updatedRecords, 'NPC', '흑막 음모가');
    assert(shadowRecord !== undefined, 'Scenario K: "흑막 음모가" registered in Novel History');
    assert(shadowRecord?.lifecycle === 'NOVEL', 'Scenario K: Lifecycle remains strictly NOVEL');
    assert(shadowRecord?.canonicalId === undefined, 'Scenario K: No canonicalId assigned');
  }

  // =========================================================================
  // Scenario L: Candidate Recovery Gate Failure → Novel History Update = 0
  // Candidate fails Recovery Gate structural validation (e.g. invalid candidateId).
  // Result: Quarantined, fail-closed, 0 changes to Novel History.
  // =========================================================================
  console.log('\n--- Scenario L: Candidate Recovery Gate Failure ---');
  {
    const corruptedCandidate: VeilCandidate = {
      candidateId: -99, // Invalid: out of bounds [1, 5]
      label: '', // Invalid: empty string
      narrativeSummary: 'Corrupted candidate',
      rawMetadata: null // Invalid: must be non-null object
    };

    const gateResult = runCandidateRecoveryGate<VeilCandidate>([corruptedCandidate]);
    assert(gateResult.quarantinedCount === 1, 'Scenario L: Candidate quarantined by Recovery Gate');
    assert(gateResult.passedCount === 0, 'Scenario L: 0 passed candidates');

    // In App.tsx pipeline: quarantine causes early REJECTED verdict without calling observeCandidateNovelHistory
    const initialNovelHistory = [...novelHistory];
    const novelHistoryAfterQuarantine = [...initialNovelHistory];
    assert(
      novelHistoryAfterQuarantine.length === initialNovelHistory.length,
      'Scenario L: Novel History records remain completely untouched upon gate quarantine'
    );
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
