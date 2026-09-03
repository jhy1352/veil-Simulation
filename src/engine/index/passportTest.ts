import { CHARACTER_PASSPORT_ID, projectPassports } from './passport';
import type { CanonicalState, ImmutableHistoricalRecord } from '../types';
import type { Character, WorldInfo } from '../../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function createTestWorld(): WorldInfo {
  return {
    worldName: '강호무림',
    worldType: 'popular_genre',
    toneStyle: '정통 무협',
    settingDescription: '중원 무림의 격변기',
    factions: [{ id: 'fac-shaolin', name: '소림사', description: '천하무림의 태산북두', influence: 90 }],
    npcs: [
      { id: 'npc-abbot', name: '방장 스님', affiliation: 'fac-shaolin', status: 'ALIVE', role: '소림 방장' },
      { id: 'npc-fallen', name: '몰락한 검객', affiliation: 'fac-shaolin', status: 'DEAD', role: '과거의 영웅' }
    ],
    seeds: [
      { id: 'seed-active', content: '사라진 비급', status: 'active' },
      { id: 'seed-resolved', content: '마교 척결', status: 'resolved' }
    ],
    chapters: { currentChapter: '1장 입문', upcomingChapters: ['2장 수련'] },
    publicRumors: [],
    secretLore: [],
    dcHistory: [],
    unresolvedForeshadows: [],
    cameraOffscreenEvents: []
  };
}

function createTestCharacter(): Character {
  return {
    name: '단우현', gender: '남', age: 20, appearance: '준수한 무협 청년', goal: '무림지존',
    originBackground: '평범한 출신', backgroundType: 'preset', flaw: '성급함', flawType: 'preset',
    oath: '정의수호', oathType: 'preset', anchor: '사형', anchorType: 'preset', faction: '소림사', factionType: 'preset',
    stats: { strength: 14, agility: 12, constitution: 10, intelligence: 13, wisdom: 10, charisma: 10 },
    inventory: [
      { id: 'item-iron-sword', name: '철검', quantity: 1, description: '일반 철검' },
      { id: 'item-broken-dagger', name: '부러진 단검', quantity: 0, description: '쓸모없어진 단검' }
    ]
  };
}

function createTestState(world = createTestWorld(), character = createTestCharacter()): CanonicalState {
  return {
    worldInfo: world, character, stateVersion: 1, turn: 1,
    lastCommittedEventId: 'evt-genesis', lastCommittedAt: new Date().toISOString()
  };
}

function historyRecord(recordId: string, turn: number, eventId: string, actionType: any = 'RECORD_DICE_RESULT', payload: any = {}): ImmutableHistoricalRecord {
  return {
    recordId, proposalId: `proposal-${recordId}`, turn, timestamp: new Date().toISOString(), source: 'ENGINE_INTERNAL',
    actionType, details: `history ${recordId}`, stateVersionAfterCommit: turn, eventId,
    canonicalAction: { type: actionType, payload }
  };
}

function novelRecord(overrides: Partial<any> = {}): any {
  return {
    novelId: 'novel:npc:떠돌이_의원', rawName: '떠돌이 의원', normalizedName: '떠돌이 의원', displayName: '떠돌이 의원',
    entityType: 'NPC', lifecycle: 'NOVEL', firstSeenTurn: 1, lastSeenTurn: 1, lastRelevantTurn: 1, seenCount: 1,
    sourceEventIds: ['evt-1'], relatedSeedIds: [], protagonistRelationActive: false, ...overrides
  };
}

async function runTests(): Promise<void> {
  console.log('=== Running VEIL Identity Passport Test Suite ===\n');

  console.log('--- Test Suite 1: Canon baseline ---');
  {
    const passports = projectPassports(createTestState(), [], []);
    const character = passports.passports.find(p => p.entityId === CHARACTER_PASSPORT_ID);
    const livingNpc = passports.passports.find(p => p.entityId === 'npc-abbot');
    const deadNpc = passports.passports.find(p => p.entityId === 'npc-fallen');
    const sword = passports.passports.find(p => p.entityId === 'item-iron-sword');
    const brokenDagger = passports.passports.find(p => p.entityId === 'item-broken-dagger');
    const activeSeed = passports.passports.find(p => p.entityId === 'seed-active');
    const resolvedSeed = passports.passports.find(p => p.entityId === 'seed-resolved');

    assert(character?.passportId === 'passport:canon:character:protagonist:v1', 'Character receives deterministic Canon v1 passportId');
    assert(character?.status === 'ACTIVE', 'Character baseline passport is ACTIVE');
    assert(livingNpc?.status === 'ACTIVE', 'Living NPC baseline passport is ACTIVE');
    assert(deadNpc?.status === 'RETIRED', 'Dead NPC baseline passport is RETIRED');
    assert(sword?.status === 'ACTIVE', 'Positive-quantity item baseline passport is ACTIVE');
    assert(brokenDagger?.status === 'RETIRED', 'Zero-quantity item baseline passport is RETIRED');
    assert(activeSeed?.status === 'ACTIVE', 'Active seed baseline passport is ACTIVE');
    assert(resolvedSeed?.status === 'RETIRED', 'Resolved seed baseline passport is RETIRED');
  }

  console.log('\n--- Test Suite 2: Inventory history references ---');
  {
    const state = createTestState();
    state.character.inventory.push({ id: 'item-bamboo-hat', name: '삿갓', quantity: 1 });
    const record = historyRecord('rec-inventory-1', 2, 'evt-inventory-1', 'MODIFY_INVENTORY', {
      item: { id: 'item-bamboo-hat', name: '삿갓', quantity: 1 }, operation: 'ADD',
      acquisition: { sourceNpcId: 'npc-merchant', cost: { id: 'item-copper-coin', name: '동전', quantity: 5 } }
    });
    const passports = projectPassports(state, [record], []);
    const hat = passports.passports.find(p => p.entityId === 'item-bamboo-hat');
    const merchant = passports.passports.find(p => p.entityId === 'npc-merchant');
    const coin = passports.passports.find(p => p.entityId === 'item-copper-coin');

    assert(Boolean(hat), 'Inventory item receives a Passport from canonical MODIFY_INVENTORY evidence');
    assert(hat?.stamps.length === 1 && hat.stamps[0].recordId === 'rec-inventory-1', 'Inventory Passport points to the exact immutable History record');
    assert(Boolean(merchant) && merchant?.stamps[0]?.recordId === 'rec-inventory-1', 'Acquisition source NPC is indexed from authoritative evidence');
    assert(Boolean(coin) && coin?.stamps[0]?.recordId === 'rec-inventory-1', 'Acquisition cost item is indexed from authoritative evidence');
  }

  console.log('\n--- Test Suite 3: Novel baseline ---');
  {
    const record = historyRecord('rec-novel-1', 1, 'evt-1');
    const novel = novelRecord({ lastSeenTurn: 1, sourceEventIds: ['evt-1'] });
    const passports = projectPassports(createTestState(), [record], [novel]);
    const p1 = passports.passports.find(p => p.entityId === novel.novelId);
    assert(p1?.passportId === 'passport:novel:novel:npc:떠돌이_의원:v1', 'Pure Novel entity receives deterministic Novel v1 passportId');
    assert(p1?.historyDomain === 'NOVEL', 'Pure Novel Passport remains NOVEL domain');
    assert(p1?.passportVersion === 1, 'Pure Novel Passport starts at version 1');
    assert(p1?.status === 'ACTIVE', 'Pure Novel Passport is ACTIVE');
    assert(p1?.stamps.length === 1 && p1.stamps[0].recordId === 'rec-novel-1', 'Novel Passport references History without copying it');
  }

  console.log('\n--- Test Suite 4: Promotion creates a real predecessor chain ---');
  {
    const state = createTestState();
    state.worldInfo.npcs.push({ id: 'npc-doctor', name: '떠돌이 의원', status: 'ALIVE' });
    const records = [historyRecord('rec-1', 1, 'evt-1'), historyRecord('rec-2', 2, 'evt-2')];
    const novel = novelRecord({
      canonicalId: 'npc-doctor', lifecycle: 'CANON_LINKED', firstSeenTurn: 1, lastSeenTurn: 2, sourceEventIds: ['evt-1', 'evt-2'],
      transitionHistory: [
        { fromDomain: 'NOVEL', toDomain: 'NOVEL', version: 1, turn: 1 },
        { fromDomain: 'NOVEL', toDomain: 'CANON', version: 2, turn: 2, predecessorId: 'novel:npc:떠돌이_의원' }
      ]
    });
    const passports = projectPassports(state, records, [novel]);
    const p1 = passports.passports.find(p => p.passportId === 'passport:novel:novel:npc:떠돌이_의원:v1');
    const p2 = passports.passports.find(p => p.passportId === 'passport:canon:npc-doctor:v2');

    assert(Boolean(p1), 'Promotion preserves the original Novel Passport as a lineage node');
    assert(Boolean(p2), 'Promotion creates a new Canon Passport node');
    assert(p1?.status === 'RETIRED', 'Pre-promotion Novel Passport becomes RETIRED');
    assert(p2?.status === 'ACTIVE', 'Post-promotion Canon Passport becomes ACTIVE');
    assert(p2?.predecessorPassportId === p1?.passportId, 'Canon predecessor points to actual Passport ID, never Novel ID');
    assert(p1?.stamps.length === 1 && p1.stamps[0].recordId === 'rec-1', 'P1 contains only its History segment');
    assert(p2?.stamps.length === 1 && p2.stamps[0].recordId === 'rec-2', 'P2 contains only the incremental History segment');
  }

  console.log('\n--- Test Suite 5: Promotion -> Demotion -> Re-promotion ---');
  {
    const state = createTestState();
    state.worldInfo.npcs.push({ id: 'npc-doctor', name: '떠돌이 의원', status: 'ALIVE' });
    const records = [
      historyRecord('rec-1', 1, 'evt-1'), historyRecord('rec-2', 2, 'evt-2'),
      historyRecord('rec-3', 3, 'evt-3'), historyRecord('rec-4', 4, 'evt-4')
    ];
    const novel = novelRecord({
      canonicalId: 'npc-doctor', demotedFromCanonicalId: 'npc-doctor', lifecycle: 'CANON_LINKED',
      firstSeenTurn: 1, lastSeenTurn: 4, sourceEventIds: ['evt-1', 'evt-2', 'evt-3', 'evt-4'],
      transitionHistory: [
        { fromDomain: 'NOVEL', toDomain: 'NOVEL', version: 1, turn: 1 },
        { fromDomain: 'NOVEL', toDomain: 'CANON', version: 2, turn: 2, predecessorId: 'novel:npc:떠돌이_의원' },
        { fromDomain: 'CANON', toDomain: 'NOVEL', version: 3, turn: 3, predecessorId: 'npc-doctor' },
        { fromDomain: 'NOVEL', toDomain: 'CANON', version: 4, turn: 4, predecessorId: 'novel:npc:떠돌이_의원' }
      ]
    });
    const passports = projectPassports(state, records, [novel]);
    const p1 = passports.passports.find(p => p.passportVersion === 1 && p.historyDomain === 'NOVEL');
    const p2 = passports.passports.find(p => p.passportVersion === 2 && p.historyDomain === 'CANON');
    const p3 = passports.passports.find(p => p.passportVersion === 3 && p.historyDomain === 'NOVEL');
    const p4 = passports.passports.find(p => p.passportVersion === 4 && p.historyDomain === 'CANON');

    assert([p1, p2, p3, p4].every(Boolean), 'Exactly four expected lineage nodes exist');
    assert(passports.passports.filter(p => (p.entityId === novel.novelId || p.entityId === 'npc-doctor') && (p.passportVersion === 1 || p.passportVersion === 2 || p.passportVersion === 3 || p.passportVersion === 4)).length === 4, 'No duplicate Passport node is created for the same transition');
    assert(p1?.status === 'RETIRED', 'P1 Novel is RETIRED after promotion');
    assert(p2?.status === 'RETIRED', 'P2 Canon is RETIRED after authoritative demotion');
    assert(p3?.status === 'RETIRED', 'P3 Novel is RETIRED after re-promotion');
    assert(p4?.status === 'ACTIVE', 'P4 Canon is the single ACTIVE Passport');
    assert(p2?.predecessorPassportId === p1?.passportId, 'P2 points to P1');
    assert(p3?.predecessorPassportId === p2?.passportId, 'P3 points to P2');
    assert(p4?.predecessorPassportId === p3?.passportId, 'P4 points to P3');
    assert(p1?.stamps[0]?.recordId === 'rec-1', 'P1 owns only its delta evidence');
    assert(p2?.stamps[0]?.recordId === 'rec-2', 'P2 owns only its delta evidence');
    assert(p3?.stamps[0]?.recordId === 'rec-3', 'P3 owns only its delta evidence');
    assert(p4?.stamps[0]?.recordId === 'rec-4', 'P4 owns only its delta evidence');
    assert(new Set(passports.passports.map(p => p.passportId)).size === passports.passports.length, 'All Passport IDs are unique');
  }

  console.log('\n--- Test Suite 6: Determinism & immutability ---');
  {
    const records = [historyRecord('rec-a', 2, 'evt-a'), historyRecord('rec-b', 1, 'evt-b')];
    const state = createTestState();
    const first = projectPassports(state, records, []);
    const second = projectPassports(state, [...records].reverse(), []);
    assert(JSON.stringify(first) === JSON.stringify(second), 'Passport projection is deterministic regardless of History input order');
    assert(Object.isFrozen(first), 'PassportState is frozen');
    assert(first.passports.every(p => Object.isFrozen(p)), 'Every Passport node is frozen');
    assert(first.passports.every(p => Object.isFrozen(p.stamps)), 'Every Passport stamp collection is frozen');
  }

  console.log(`\n=== Passport tests complete: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) throw new Error(`Passport test suite failed: ${failed} assertion(s)`);
}

void runTests();
