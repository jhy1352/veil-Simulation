import {
  DEFAULT_NOVEL_HISTORY_POLICY,
  demoteCanonRecordToNovel,
  evaluateCanonPromotion,
  findNovelHistoryMatch,
  isNovelHistoryInactive,
  observeNovelHistory,
  classifyNovelHistoryLifecycle,
  promoteNovelRecordToCanon
} from './novelHistory';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[NOVEL_HISTORY_TEST_FAILED] ${message}`);
}

export function runNovelHistoryBoundaryTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  const run = (name: string, fn: () => void) => {
    try {
      fn();
      passed++;
    } catch (error) {
      failed++;
      throw new Error(`${name}: ${(error as Error).message}`);
    }
  };

  run('NOVEL does not auto-promote', () => {
    const decision = evaluateCanonPromotion({
      activeActorInCanonicalChange: false,
      deeplyRelatedToSeed: false,
      closelyRelatedToProtagonist: false
    });
    assert(!decision.promote, 'ordinary Novel observation must not become Canon');
  });

  run('deep Seed relation promotes', () => {
    const decision = evaluateCanonPromotion({
      activeActorInCanonicalChange: false,
      deeplyRelatedToSeed: true,
      closelyRelatedToProtagonist: false
    });
    assert(decision.promote, 'deep Seed relation must permit Canon promotion');
  });

  run('close protagonist relation promotes', () => {
    const decision = evaluateCanonPromotion({
      activeActorInCanonicalChange: false,
      deeplyRelatedToSeed: false,
      closelyRelatedToProtagonist: true
    });
    assert(decision.promote, 'close protagonist relation must permit Canon promotion');
  });

  run('mere appearance does not refresh management relevance', () => {
    let records = observeNovelHistory([], {
      novelId: 'novel-1',
      entityType: 'NPC',
      normalizedName: '홍길동',
      displayName: '홍길동',
      turn: 1,
      isManagementRelevant: true
    });
    records = observeNovelHistory(records, {
      novelId: 'novel-1',
      entityType: 'NPC',
      normalizedName: '홍길동',
      displayName: '홍길동',
      turn: 20,
      isManagementRelevant: false
    });
    assert(records[0].lastRelevantTurn === 1, 'incidental reappearance must not refresh relevance');
    assert(isNovelHistoryInactive(records[0], 20), 'inactive NPC should be eligible after threshold');
  });

  run('protagonist relationship protects from downgrade', () => {
    const records = observeNovelHistory([], {
      novelId: 'novel-2',
      entityType: 'NPC',
      normalizedName: '동료A',
      displayName: '동료A',
      turn: 1,
      isRelevantToProtagonist: true,
      isManagementRelevant: true
    });
    assert(!isNovelHistoryInactive(records[0], 100), 'active protagonist relationship must block downgrade');
  });

  run('reappearance reconnects to one Novel record', () => {
    const records = observeNovelHistory([], {
      novelId: 'novel-3',
      entityType: 'ITEM',
      normalizedName: '낡은 반지',
      displayName: '낡은 반지',
      turn: 1
    });
    const match = findNovelHistoryMatch(records, 'ITEM', ' 낡은   반지 ');
    assert(match?.novelId === 'novel-3', 'normalized reappearance must resolve to the same Novel record');
  });

  run('lifecycle keeps linked Canon authoritative', () => {
    const lifecycle = classifyNovelHistoryLifecycle({
      entityType: 'NPC',
      lastRelevantTurn: 1,
      protagonistRelationActive: false,
      lifecycle: 'CANON_LINKED'
    }, 100, DEFAULT_NOVEL_HISTORY_POLICY);
    assert(lifecycle === 'CANON_LINKED', 'Canon-linked history must not be downgraded by Novel policy');
  });

  run('promotion-demotion-repromotion preserves complete domain transition history', () => {
    const initial = observeNovelHistory([], {
      novelId: 'novel-lineage-1',
      entityType: 'NPC',
      normalizedName: '연속성NPC',
      displayName: '연속성NPC',
      turn: 1,
      engineVerifiedActiveActor: false,
      isPassiveMentionOnly: true
    });

    const promoted = promoteNovelRecordToCanon(
      initial,
      'novel-lineage-1',
      'NPC',
      'canon-npc-1',
      5
    );
    const promotedRecord = promoted[0];

    assert(promotedRecord.lifecycle === 'CANON_LINKED', 'first promotion must make current lifecycle CANON_LINKED');
    assert(promotedRecord.transitionHistory?.length === 2, 'first promotion must retain initial Novel state plus Canon transition');
    assert(promotedRecord.transitionHistory?.[0]?.fromDomain === 'NOVEL', 'initial lineage entry must be Novel-domain history');
    assert(promotedRecord.transitionHistory?.[0]?.toDomain === 'NOVEL', 'initial lineage entry must preserve the original Novel state');
    assert(promotedRecord.transitionHistory?.[0]?.version === 1, 'initial Novel state must be version 1');
    assert(promotedRecord.transitionHistory?.[1]?.fromDomain === 'NOVEL', 'promotion must originate from Novel');
    assert(promotedRecord.transitionHistory?.[1]?.toDomain === 'CANON', 'promotion must terminate in Canon');
    assert(promotedRecord.transitionHistory?.[1]?.version === 2, 'first promotion must be version 2');
    assert(promotedRecord.transitionHistory?.[1]?.predecessorId === 'novel-lineage-1', 'promotion predecessor must be the Novel identity');

    const demotedResult = demoteCanonRecordToNovel(
      promoted,
      'canon-npc-1',
      'NPC',
      '연속성NPC',
      12,
      'AUTHORITATIVE_CAUSAL_INVALIDATION',
      'event-invalidation-1'
    );
    const demotedRecord = demotedResult.novelRecord;

    assert(demotedRecord.lifecycle === 'DEMOTED_NOVEL', 'demotion must make the current lifecycle DEMOTED_NOVEL');
    assert(demotedRecord.canonicalId === 'canon-npc-1', 'demotion must preserve the original Canonical ID');
    assert(demotedRecord.demotedFromCanonicalId === 'canon-npc-1', 'demotion must retain the source Canonical ID');
    assert(demotedRecord.transitionHistory?.length === 3, 'demotion must append rather than replace transition history');
    assert(demotedRecord.transitionHistory?.[1]?.toDomain === 'CANON', 'historical CANON_LINKED transition must remain preserved');
    assert(demotedRecord.transitionHistory?.[1]?.version === 2, 'historical promotion must remain version 2 after demotion');
    assert(demotedRecord.transitionHistory?.[2]?.fromDomain === 'CANON', 'demotion must originate from Canon');
    assert(demotedRecord.transitionHistory?.[2]?.toDomain === 'NOVEL', 'demotion must terminate in Novel');
    assert(demotedRecord.transitionHistory?.[2]?.version === 3, 'demotion must be version 3');
    assert(demotedRecord.transitionHistory?.[2]?.predecessorId === 'canon-npc-1', 'demotion predecessor must be the Canonical ID');
    assert(demotedRecord.sourceEventIds.includes('event-invalidation-1'), 'validated invalidation event must remain attached as evidence');

    const repromoted = promoteNovelRecordToCanon(
      demotedResult.updatedRecords,
      'novel-lineage-1',
      'NPC',
      'canon-npc-1',
      20
    );
    const repromotedRecord = repromoted[0];

    assert(repromotedRecord.lifecycle === 'CANON_LINKED', 're-promotion must restore current lifecycle CANON_LINKED');
    assert(repromotedRecord.canonicalId === 'canon-npc-1', 're-promotion must preserve Canonical identity continuity');
    assert(repromotedRecord.transitionHistory?.length === 4, 're-promotion must append a fourth lineage entry');
    assert(repromotedRecord.transitionHistory?.[0]?.version === 1, 'version 1 must remain immutable');
    assert(repromotedRecord.transitionHistory?.[1]?.version === 2, 'version 2 Canon promotion must remain immutable');
    assert(repromotedRecord.transitionHistory?.[2]?.version === 3, 'version 3 Canon demotion must remain immutable');
    assert(repromotedRecord.transitionHistory?.[3]?.fromDomain === 'NOVEL', 're-promotion must originate from Novel');
    assert(repromotedRecord.transitionHistory?.[3]?.toDomain === 'CANON', 're-promotion must terminate in Canon');
    assert(repromotedRecord.transitionHistory?.[3]?.version === 4, 're-promotion must be version 4');
    assert(repromotedRecord.transitionHistory?.[3]?.predecessorId === 'novel-lineage-1', 're-promotion predecessor must again be the stable Novel identity');
  });

  return { passed, failed };
}
