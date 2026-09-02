import {
  DEFAULT_NOVEL_HISTORY_POLICY,
  evaluateCanonPromotion,
  findNovelHistoryMatch,
  isNovelHistoryInactive,
  observeNovelHistory,
  classifyNovelHistoryLifecycle
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

  return { passed, failed };
}
