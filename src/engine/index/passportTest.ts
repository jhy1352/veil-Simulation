import { CHARACTER_PASSPORT_ID, projectPassports } from './passport';
import { SovereignEngine } from '../state';
import { buildSafeProposalFromCandidate } from '../proposalParser';
import type { CanonicalState, ImmutableHistoricalRecord } from '../types';
import type { CandidatePacket, Character, WorldInfo } from '../../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
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
    factions: [
      { id: 'fac-shaolin', name: '소림사', description: '천하무림의 태산북두', influence: 90 }
    ],
    npcs: [
      { id: 'npc-abbot', name: '방장 스님', affiliation: 'fac-shaolin', status: 'ALIVE', role: '소림 방장' },
      { id: 'npc-fallen', name: '몰락한 검객', affiliation: 'fac-shaolin', status: 'DEAD', role: '과거의 영웅' }
    ],
    seeds: [
      { id: 'seed-active', content: '사라진 비급', status: 'active' },
      { id: 'seed-resolved', content: '마교 척결', status: 'resolved' }
    ],
    chapters: {
      currentChapter: '1장 입문',
      upcomingChapters: ['2장 수련']
    },
    publicRumors: [],
    secretLore: [],
    dcHistory: [],
    unresolvedForeshadows: [],
    cameraOffscreenEvents: []
  };
}

function createTestCharacter(): Character {
  return {
    name: '단우현',
    gender: '남',
    age: 20,
    appearance: '준수한 무협 청년',
    goal: '무림지존',
    originBackground: '평범한 출신',
    backgroundType: 'preset',
    flaw: '성급함',
    flawType: 'preset',
    oath: '정의수호',
    oathType: 'preset',
    anchor: '사형',
    anchorType: 'preset',
    faction: '소림사',
    factionType: 'preset',
    stats: {
      strength: 14,
      agility: 12,
      constitution: 10,
      intelligence: 13,
      wisdom: 10,
      charisma: 10
    },
    inventory: [
      { id: 'item-iron-sword', name: '철검', quantity: 1, description: '일반 철검' },
      { id: 'item-broken-dagger', name: '부러진 단검', quantity: 0, description: '쓸모없어진 단검' }
    ]
  };
}

function createTestState(world: WorldInfo, character: Character, version = 1, eventId = 'evt-genesis'): CanonicalState {
  return {
    worldInfo: world,
    character,
    stateVersion: version,
    turn: 1,
    lastCommittedEventId: eventId,
    lastCommittedAt: new Date().toISOString()
  };
}

async function runTests() {
  console.log('=== Running VEIL Identity Passport Test Suite ===\n');

  // --- Test Suite 1: Genesis & Canon Entity Baseline ---
  console.log('--- Test Suite 1: Genesis & Canon Entity Baseline ---');
  {
    const world = createTestWorld();
    const char = createTestCharacter();
    const state = createTestState(world, char, 1, 'evt-genesis');

    const passportState = projectPassports(state, [], []);

    const charPassport = passportState.passports.find(p => p.entityId === CHARACTER_PASSPORT_ID);
    assert(Boolean(charPassport), 'Character has synthetic passport character:protagonist');
    assert(charPassport?.historyDomain === 'CANON', 'Character passport is CANON domain');
    assert(charPassport?.passportVersion === 1, 'Character passport version is 1');
    assert(charPassport?.status === 'ACTIVE', 'Character passport status is ACTIVE');

    const abbotPassport = passportState.passports.find(p => p.entityId === 'npc-abbot');
    assert(Boolean(abbotPassport), 'Living NPC has passport');
    assert(abbotPassport?.status === 'ACTIVE', 'Living NPC passport status is ACTIVE');
    assert(abbotPassport?.historyDomain === 'CANON', 'Living NPC is CANON domain');

    const factionPassport = passportState.passports.find(p => p.entityId === 'fac-shaolin');
    assert(Boolean(factionPassport), 'Faction has passport');
    assert(factionPassport?.status === 'ACTIVE', 'Faction passport status is ACTIVE');

    const swordPassport = passportState.passports.find(p => p.entityId === 'item-iron-sword');
    assert(Boolean(swordPassport), 'Item with quantity > 0 has passport');
    assert(swordPassport?.status === 'ACTIVE', 'Item with quantity > 0 is ACTIVE');

    const activeSeedPassport = passportState.passports.find(p => p.entityId === 'seed-active');
    assert(Boolean(activeSeedPassport), 'Active narrative seed has passport');
    assert(activeSeedPassport?.status === 'ACTIVE', 'Active narrative seed is ACTIVE');
  }

  // --- Test Suite 2: Over-eager ACTIVE Correction (Retirement & Inactivity) ---
  console.log('\n--- Test Suite 2: Over-eager ACTIVE Correction ---');
  {
    const world = createTestWorld();
    const char = createTestCharacter();
    const state = createTestState(world, char, 1, 'evt-genesis');

    const passportState = projectPassports(state, [], []);

    const fallenPassport = passportState.passports.find(p => p.entityId === 'npc-fallen');
    assert(Boolean(fallenPassport), 'Dead NPC is indexed in Canon passports');
    assert(fallenPassport?.status === 'RETIRED', 'Dead NPC status is strictly RETIRED (not over-eager ACTIVE)');

    const brokenDaggerPassport = passportState.passports.find(p => p.entityId === 'item-broken-dagger');
    assert(Boolean(brokenDaggerPassport), 'Zero-quantity item is indexed in Canon passports');
    assert(brokenDaggerPassport?.status === 'RETIRED', 'Zero-quantity item is strictly RETIRED');

    const resolvedSeedPassport = passportState.passports.find(p => p.entityId === 'seed-resolved');
    assert(Boolean(resolvedSeedPassport), 'Resolved narrative seed is indexed in Canon passports');
    assert(resolvedSeedPassport?.status === 'RETIRED', 'Resolved narrative seed is strictly RETIRED');
  }

  // --- Test Suite 3: OVERWRITE_CHARACTER and Inventory Reference Extraction ---
  console.log('\n--- Test Suite 3: OVERWRITE_CHARACTER and Reference Extraction ---');
  {
    const world = createTestWorld();
    const char = createTestCharacter();
    const state: CanonicalState = {
      worldInfo: world,
      character: {
        ...char,
        inventory: [
          { id: 'item-dragon-saber', name: '용도', quantity: 1, description: '보검' },
          { id: 'item-phoenix-ring', name: '봉황반지', quantity: 1, description: '가문의 반지' }
        ]
      },
      stateVersion: 2,
      turn: 1,
      lastCommittedEventId: 'evt-overwrite',
      lastCommittedAt: new Date().toISOString()
    };

    const historyRecord: ImmutableHistoricalRecord = {
      recordId: 'rec-overwrite-1',
      proposalId: 'prop-overwrite-1',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'OVERWRITE_CHARACTER',
      details: '주인공 캐릭터 덮어쓰기',
      stateVersionAfterCommit: 2,
      eventId: 'evt-overwrite',
      canonicalAction: {
        type: 'OVERWRITE_CHARACTER',
        payload: {
          ...char,
          inventory: [
            { id: 'item-dragon-saber', name: '용도', quantity: 1, description: '보검' },
            { id: 'item-phoenix-ring', name: '봉황반지', quantity: 1, description: '가문의 반지' }
          ]
        }
      }
    };

    const passportState = projectPassports(state, [historyRecord], []);

    const saberPassport = passportState.passports.find(p => p.entityId === 'item-dragon-saber');
    assert(Boolean(saberPassport), 'Inventory item from OVERWRITE_CHARACTER receives passport');
    assert(saberPassport?.historyDomain === 'CANON', 'OVERWRITE_CHARACTER inventory item is CANON domain');
    assert(saberPassport?.status === 'ACTIVE', 'OVERWRITE_CHARACTER inventory item is ACTIVE in state');
    assert(saberPassport?.stamps.length === 1, 'Inventory item receives historical stamp from OVERWRITE_CHARACTER');
    assert(saberPassport?.stamps[0].recordId === 'rec-overwrite-1', 'Stamp references exact history recordId');

    const ringPassport = passportState.passports.find(p => p.entityId === 'item-phoenix-ring');
    assert(Boolean(ringPassport), 'Second inventory item from OVERWRITE_CHARACTER receives passport');
    assert(ringPassport?.stamps.length === 1, 'Second item receives historical stamp');

    // Also verify historical item that was replaced is marked RETIRED
    const oldSwordPassport = passportState.passports.find(p => p.entityId === 'item-iron-sword');
    if (oldSwordPassport) {
      assert(oldSwordPassport.status === 'RETIRED', 'Old inventory item no longer in character inventory is RETIRED');
    }
  }

  // --- Test Suite 4: MODIFY_INVENTORY Source NPC & Cost Extraction ---
  console.log('\n--- Test Suite 4: MODIFY_INVENTORY Reference Extraction ---');
  {
    const world = createTestWorld();
    const char = createTestCharacter();
    const state: CanonicalState = {
      worldInfo: world,
      character: {
        ...char,
        inventory: [
          ...char.inventory,
          { id: 'item-bamboo-hat', name: '삿갓', quantity: 1, description: '대나무 삿갓' }
        ]
      },
      stateVersion: 2,
      turn: 1,
      lastCommittedEventId: 'evt-modify-inv',
      lastCommittedAt: new Date().toISOString()
    };

    const modifyInvRecord: ImmutableHistoricalRecord = {
      recordId: 'rec-mod-inv-1',
      proposalId: 'prop-mod-inv-1',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'MODIFY_INVENTORY',
      details: '삿갓 구매',
      stateVersionAfterCommit: 2,
      eventId: 'evt-modify-inv',
      canonicalAction: {
        type: 'MODIFY_INVENTORY',
        payload: {
          item: { id: 'item-bamboo-hat', name: '삿갓', quantity: 1, description: '대나무 삿갓' },
          operation: 'ADD',
          acquisition: {
            cause: 'RESOURCE_EXCHANGE',
            sourceNpcId: 'npc-merchant',
            cost: { id: 'item-copper-coin', name: '동전', quantity: 5 }
          }
        }
      }
    };

    const passportState = projectPassports(state, [modifyInvRecord], []);

    const hatPassport = passportState.passports.find(p => p.entityId === 'item-bamboo-hat');
    assert(Boolean(hatPassport), 'Modified inventory item has passport');
    assert(hatPassport?.stamps.length === 1, 'Hat receives stamp from MODIFY_INVENTORY');

    const merchantPassport = passportState.passports.find(p => p.entityId === 'npc-merchant');
    assert(Boolean(merchantPassport), 'Source NPC referenced in acquisition receives passport');
    assert(merchantPassport?.stamps.length === 1, 'Source NPC receives stamp');
    assert(merchantPassport?.status === 'RETIRED', 'NPC not in current WorldInfo is RETIRED');

    const coinPassport = passportState.passports.find(p => p.entityId === 'item-copper-coin');
    assert(Boolean(coinPassport), 'Cost item referenced in acquisition receives passport');
    assert(coinPassport?.stamps.length === 1, 'Cost item receives stamp');
    assert(coinPassport?.status === 'RETIRED', 'Spent cost item not in current inventory is RETIRED');
  }

  // --- Test Suite 5: Novel <-> Canon Lifecycle, Promotion, Versioning & Predecessor Link ---
  console.log('\n--- Test Suite 5: Novel <-> Canon Promotion & Lineage Tracking ---');
  {
    const world = createTestWorld();
    const char = createTestCharacter();
    const state = createTestState(world, char, 1, 'evt-genesis');

    // Phase 1: Novel candidate entity observed
    const novelRecord: any = {
      novelId: 'novel:npc:떠돌이_의원',
      rawName: '떠돌이 의원',
      normalizedName: '떠돌이 의원',
      entityType: 'NPC',
      lifecycle: 'NOVEL',
      firstSeenTurn: 2,
      lastSeenTurn: 2,
      seenCount: 1,
      sourceEventIds: ['evt-rescue-1']
    };

    const historyRecord1: ImmutableHistoricalRecord = {
      recordId: 'rec-event-1',
      proposalId: 'prop-event-1',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'RECORD_DICE_RESULT',
      details: '주사위 판정',
      stateVersionAfterCommit: 1,
      eventId: 'evt-rescue-1',
      canonicalAction: {
        type: 'RECORD_DICE_RESULT',
        payload: { actionContext: '치료 시도', targetDC: 12, rollValue: 15, resultStatus: 'SUCCESS' }
      }
    };

    const phase1Passports = projectPassports(state, [historyRecord1], [novelRecord]);

    const novelPassport1 = phase1Passports.passports.find(p => p.entityId === 'novel:npc:떠돌이_의원');
    assert(Boolean(novelPassport1), 'Novel entity has passport in phase 1');
    assert(novelPassport1?.historyDomain === 'NOVEL', 'Novel passport domain is NOVEL');
    assert(novelPassport1?.passportVersion === 1, 'Novel passport initial version is 1');
    assert(novelPassport1?.status === 'ACTIVE', 'Novel passport status is ACTIVE');
    assert(novelPassport1?.predecessorPassportId === undefined, 'Novel passport has no predecessor');
    assert(novelPassport1?.stamps.length === 1, 'Novel passport receives stamp resolved against sourceEventId');
    assert(novelPassport1?.stamps[0].recordId === 'rec-event-1', 'Stamp references exact history recordId');

    // Phase 2: Novel entity promoted to Canon (CANON_LINKED)
    const promotedNovelRecord: any = {
      ...novelRecord,
      lifecycle: 'CANON_LINKED',
      canonicalId: 'npc-wandering-doc',
      lastSeenTurn: 3,
      seenCount: 2,
      sourceEventIds: ['evt-rescue-1', 'evt-doc-join']
    };

    // Add promoted NPC to CanonicalState
    world.npcs.push({
      id: 'npc-wandering-doc',
      name: '떠돌이 의원',
      status: 'ALIVE',
      role: '의원',
      affiliation: 'fac-shaolin'
    });

    const historyRecord2: ImmutableHistoricalRecord = {
      recordId: 'rec-event-2',
      proposalId: 'prop-event-2',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'ADD_NPC',
      details: '의원 합류',
      stateVersionAfterCommit: 1,
      eventId: 'evt-doc-join',
      canonicalAction: {
        type: 'ADD_NPC',
        payload: {
          id: 'npc-wandering-doc',
          name: '떠돌이 의원',
          status: 'ALIVE',
          role: '의원',
          affiliation: 'fac-shaolin'
        }
      }
    };

    const phase2Passports = projectPassports(state, [historyRecord1, historyRecord2], [promotedNovelRecord]);

    // Check Novel Passport after promotion: status must transition to RETIRED
    const novelPassport2 = phase2Passports.passports.find(p => p.entityId === 'novel:npc:떠돌이_의원');
    assert(Boolean(novelPassport2), 'Novel passport still exists after promotion (forensic continuity)');
    assert(novelPassport2?.historyDomain === 'NOVEL', 'Novel passport domain remains NOVEL');
    assert(novelPassport2?.status === 'RETIRED', 'Novel passport status is RETIRED upon promotion to Canon');
    assert(novelPassport2?.passportVersion === 1, 'Novel passport version remains 1');

    // Check Promoted Canon Passport
    const canonDocPassport = phase2Passports.passports.find(p => p.entityId === 'npc-wandering-doc');
    assert(Boolean(canonDocPassport), 'Promoted Canon entity receives Canon passport');
    assert(canonDocPassport?.historyDomain === 'CANON', 'Promoted passport domain is CANON');
    assert(canonDocPassport?.passportVersion === 2, 'Promoted Canon passport increments version to 2');
    assert(canonDocPassport?.predecessorPassportId === 'novel:npc:떠돌이_의원', 'Canon passport links to novel predecessor ID');
    assert(canonDocPassport?.status === 'ACTIVE', 'Promoted Canon passport status is ACTIVE');
    assert(canonDocPassport?.stamps.length === 1, 'Promoted Canon passport receives canonical action stamp');
    assert(canonDocPassport?.stamps[0].recordId === 'rec-event-2', 'Canonical stamp matches ADD_NPC recordId');

    // Phase 3: Demoted / Inactive Novel entity
    const inactiveNovelRecord: any = {
      novelId: 'novel:npc:망각된_나그네',
      rawName: '망각된 나그네',
      normalizedName: '망각된 나그네',
      entityType: 'NPC',
      lifecycle: 'INACTIVE_NOVEL',
      firstSeenTurn: 1,
      lastSeenTurn: 1,
      seenCount: 1,
      sourceEventIds: []
    };

    const phase3Passports = projectPassports(state, [], [inactiveNovelRecord]);
    const inactivePassport = phase3Passports.passports.find(p => p.entityId === 'novel:npc:망각된_나그네');
    assert(Boolean(inactivePassport), 'INACTIVE_NOVEL entity receives passport');
    assert(inactivePassport?.status === 'RETIRED', 'INACTIVE_NOVEL passport is strictly RETIRED');
  }

  // --- Test Suite 6: Full SovereignEngine EOF Pipeline Integration ---
  console.log('\n--- Test Suite 6: SovereignEngine Post-EOF Commit Integration ---');
  {
    const world = createTestWorld();
    const char = createTestCharacter();
    const initialHistory: ImmutableHistoricalRecord[] = [
      {
        recordId: 'rec-cave-event',
        eventId: 'evt-cave-event',
        proposalId: 'prop-cave-event',
        turn: 1,
        timestamp: new Date().toISOString(),
        source: 'ENGINE_INTERNAL',
        actionType: 'RECORD_OFFSCREEN_EVENT',
        details: '동굴 탐험 중 기이한 은거고수와 비급서의 기척을 발견함',
        stateVersionAfterCommit: 1
      }
    ];

    const engine = new SovereignEngine(world, char, initialHistory, 1, 1);

    // Initial snapshot passport state
    let passports = projectPassports(engine.getSnapshot(), engine.getHistory(), []);
    assert(passports.passports.length > 0, 'Genesis passports projected from engine');

    // Attempt invalid proposal with stale stateVersion
    const invalidProposal: any = {
      proposalId: 'prop-invalid',
      requestId: 'req-stale',
      eventId: 'evt-stale',
      expectedStateVersion: 999, // Stale version
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      actions: [
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-ghost', name: '유령 NPC', status: 'ALIVE', role: '귀신', affiliation: 'fac-shaolin' }
        }
      ]
    };

    const failedCommit = engine.submitProposal(invalidProposal);
    assert(!failedCommit.success, 'Commit gate rejects stale proposal');

    // Verify passports are NOT updated on failed commit
    const unchangedPassports = projectPassports(engine.getSnapshot(), engine.getHistory(), []);
    const ghost = unchangedPassports.passports.find(p => p.entityId === 'npc-ghost');
    assert(!ghost, 'Ghost NPC is NOT projected in passports when commit fails');

    // Now submit a valid candidate through buildSafeProposalFromCandidate
    const candidatePacket: CandidatePacket = {
      candidateId: 'cand-eof-hermit',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '비급서',
          action: 'add',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            evidence: {
              cause: 'DISCOVERY',
              context: '동굴에서 비급서 발견',
              verifiedEventId: 'evt-cave-event'
            }
          }
        }
      ],
      npcChanges: [
        {
          name: '은거고수',
          npcClass: 'MAJOR_NAMED',
          metInStory: true,
          entityReference: {
            entityType: 'NPC',
            evidence: {
              cause: 'FIRST_ENCOUNTER',
              context: '동굴에서 조우',
              verifiedEventId: 'evt-cave-event'
            }
          }
        }
      ]
    };

    const validProposal = buildSafeProposalFromCandidate(
      engine.getSnapshot(),
      candidatePacket,
      1,
      engine.getHistory()
    );

    const validCommit = engine.submitProposal(validProposal);
    if (!validCommit.success) {
      console.error('validCommit rejected reasons:', validCommit.rejectedReasons);
    }
    assert(validCommit.success, 'Engine successfully commits valid proposal');

    // Update passports strictly POST-EOF
    passports = projectPassports(validCommit.snapshot, engine.getHistory(), []);

    const addNpcAction = validProposal.actions.find(a => a.type === 'ADD_NPC');
    const hermitId = addNpcAction?.payload?.id;
    const hermitPassport = passports.passports.find(p => p.entityId === hermitId);
    assert(Boolean(hermitPassport), 'Hermit NPC passport created post-EOF commit');
    assert(hermitPassport?.status === 'ACTIVE', 'Hermit NPC is ACTIVE');
    assert(hermitPassport?.stamps.length === 1, 'Hermit NPC receives stamp from committed proposal');

    const addInvAction = validProposal.actions.find(a => a.type === 'MODIFY_INVENTORY');
    const bookId = addInvAction?.payload?.item?.id;
    const bookPassport = passports.passports.find(p => p.entityId === bookId);
    assert(Boolean(bookPassport), 'Secret Book passport created post-EOF commit');
    assert(bookPassport?.status === 'ACTIVE', 'Secret Book is ACTIVE');
    assert(bookPassport?.stamps.length === 1, 'Secret Book receives stamp from committed proposal');
  }

  // --- Test Suite 7: Deterministic Ordering & Immutability ---
  console.log('\n--- Test Suite 7: Deterministic Ordering & Immutability ---');
  {
    const world = createTestWorld();
    const char = createTestCharacter();
    const state = createTestState(world, char, 1, 'evt-genesis');

    const novelRecord: any = {
      novelId: 'novel:npc:가객',
      rawName: '가객',
      normalizedName: '가객',
      entityType: 'NPC',
      lifecycle: 'NOVEL',
      firstSeenTurn: 1,
      lastSeenTurn: 1,
      seenCount: 1,
      sourceEventIds: []
    };

    const passportState = projectPassports(state, [], [novelRecord]);

    assert(Object.isFrozen(passportState), 'PassportState is frozen');
    assert(Object.isFrozen(passportState.passports), 'passports array is frozen');
    for (const p of passportState.passports) {
      assert(Object.isFrozen(p), `Passport ${p.entityId} is frozen`);
      assert(Object.isFrozen(p.stamps), `Passport ${p.entityId} stamps are frozen`);
    }

    // Check CANON before NOVEL ordering
    let seenNovel = false;
    let orderValid = true;
    for (const p of passportState.passports) {
      if (p.historyDomain === 'NOVEL') {
        seenNovel = true;
      } else if (seenNovel && p.historyDomain === 'CANON') {
        orderValid = false;
      }
    }
    assert(orderValid, 'All CANON passports precede NOVEL passports deterministically');
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error in test runner:', err);
  process.exit(1);
});
