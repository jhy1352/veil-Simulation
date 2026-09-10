/**
 * @file src/engine/index/entityIdentityResolverTest.ts
 * @description Unit & Integration Tests for Canonical Entity Identity Resolver & Continuity
 */

import { CanonicalState, ImmutableHistoricalRecord } from '../types';
import { CandidatePacket } from '../../types';
import {
  resolveEntityIdentity,
  resolveInventoryItemIdentity,
  resolveCandidateInventoryIdentity,
  resolveNpcIdentity,
  resolveFactionIdentity,
  resolveNarrativeSeedIdentity,
  resolveCharacterIdentity,
  hasPositiveNoveltyEvidence,
  buildInventoryIdentityGraph
} from './entityIdentityResolver';
import { buildSafeProposalFromCandidate } from '../proposalParser';
import { validateCandidateStructure, runCandidateRecoveryGate } from '../language/candidateRecoveryGate';
import { SovereignEngine } from '../state';
import { EngineValidator } from '../validator';
import { ImmigrationGate } from '../immigrationGate';

function createMockState(): CanonicalState {
  return {
    stateVersion: 1,
    turn: 1,
    lastCommittedEventId: 'evt-init',
    lastCommittedAt: new Date().toISOString(),
    worldInfo: {
      worldName: '무림세계',
      worldType: 'popular_genre',
      settingDescription: '중원 무림',
      toneStyle: '진지함',
      npcs: [
        { id: 'npc-abbot', name: '방장 스님', alias: '현공 대사', affiliation: '소림사', status: 'ALIVE' }
      ],
      factions: [
        { id: 'fac-shaolin', name: '소림사', description: '천하제일 명문정파', attitudeTowardsPlayer: 'FRIENDLY' }
      ],
      publicRumors: [],
      secretLore: [],
      seeds: [],
      chapters: {
        currentChapter: '1장 입문',
        upcomingChapters: ['2장 수련']
      },
      dcHistory: [],
      unresolvedForeshadows: [],
      cameraOffscreenEvents: []
    },
    character: {
      name: '이청',
      title: '검객',
      gender: '남',
      age: 20,
      appearance: '준수한 청년',
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
        strength: 12,
        agility: 14,
        constitution: 12,
        intelligence: 10,
        wisdom: 10,
        charisma: 8
      },
      inventory: [
        { id: 'item-iron-sword', name: '철검', quantity: 1, description: '평범한 철검' },
        { id: 'item-ancestral-blade', name: '가보의 보검', quantity: 1, description: '가문 대대로 내려온 보검' }
      ]
    }
  };
}

export function runEntityIdentityTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('\n=== Running VEIL Canonical Entity Identity Resolver Test Suite ===\n');

  const state = createMockState();
  const history: ImmutableHistoricalRecord[] = [
    {
      recordId: 'rec-1',
      eventId: 'evt-1',
      proposalId: 'prop-1',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'MODIFY_INVENTORY',
      details: 'Acquired item-iron-sword during training',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-2',
      eventId: 'evt-2',
      proposalId: 'prop-2',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'UPDATE_NPC',
      details: 'Spoke with npc-abbot and discovered hidden armory',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-armory',
      eventId: 'evt-armory',
      proposalId: 'prop-armory',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'MODIFY_INVENTORY',
      details: 'Spoke with npc-abbot and discovered hidden armory containing 청룡언월도',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-npc-wudang',
      eventId: 'evt-npc-wudang',
      proposalId: 'prop-npc-wudang',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'ADD_NPC',
      details: 'Met and encountered 무당파 장문인 장삼봉 in the valley',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-fac-wudang',
      eventId: 'evt-fac-wudang',
      proposalId: 'prop-fac-wudang',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'ADD_FACTION',
      details: 'Discovered and encountered new faction 무당파 in Hubei province',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-seed-shadow',
      eventId: 'evt-seed-shadow',
      proposalId: 'prop-seed-shadow',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'ADD_NARRATIVE_SEED',
      details: 'Explored cave and discovered mysterious clue of 동굴 속의 흑영',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-bomb-shop',
      eventId: 'evt-bomb-shop',
      proposalId: 'prop-bomb-shop',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'MODIFY_INVENTORY',
      details: 'Visited blacksmith shop and acquired 벽력탄',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-huashan-npc',
      eventId: 'evt-huashan-npc',
      proposalId: 'prop-huashan-npc',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'ADD_NPC',
      details: 'Visited Huashan mountain and met 화산파 장문인',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-huashan-fac',
      eventId: 'evt-huashan-fac',
      proposalId: 'prop-huashan-fac',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'ADD_FACTION',
      details: 'Formally discovered and encountered faction 화산파',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-seed-eof',
      eventId: 'evt-seed-eof',
      proposalId: 'prop-seed-eof',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'ADD_NARRATIVE_SEED',
      details: 'Discovered narrative clue regarding 새로운 비급의 행방',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-item-yongcheon',
      eventId: 'evt-item-yongcheon',
      proposalId: 'prop-item-yongcheon',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'MODIFY_INVENTORY',
      details: 'Excavated and discovered ancient sword 용천검',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-npc-diancang',
      eventId: 'evt-npc-diancang',
      proposalId: 'prop-npc-diancang',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'ADD_NPC',
      details: 'Encountered and met visiting diplomat 점창파사절',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-fac-diancang',
      eventId: 'evt-fac-diancang',
      proposalId: 'prop-fac-diancang',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'ADD_FACTION',
      details: 'Formally established diplomatic contact with faction 점창파',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-seed-key',
      eventId: 'evt-seed-key',
      proposalId: 'prop-seed-key',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'ADD_NARRATIVE_SEED',
      details: 'Discovered stone tablet clue regarding 비경의 열쇠에 관한 단서',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-char-lee',
      eventId: 'evt-char-lee',
      proposalId: 'prop-char-lee',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'OVERWRITE_CHARACTER',
      details: 'Welcomed permanent story companion 동행자이설화',
      stateVersionAfterCommit: 1
    },
    {
      recordId: 'rec-abbot-beads',
      eventId: 'evt-abbot-beads',
      proposalId: 'prop-abbot-beads',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'MODIFY_INVENTORY',
      details: 'Abbot npc-abbot bestowed and gifted 방장의염주 in the secret chamber',
      stateVersionAfterCommit: 1
    }
  ];

  // Test A: Exact Match with Valid Claimed ID
  {
    const resolution = resolveInventoryItemIdentity(state, history, '철검', {
      entityType: 'ITEM',
      claimedEntityId: 'item-iron-sword',
      evidence: { context: '전투 중 사용' }
    });
    assert(resolution.status === 'EXACT', 'Test A1: Exact match status');
    assert(resolution.canonicalId === 'item-iron-sword', 'Test A2: Canonical ID preserved');

    // Proposal Parser Integration
    const candidate: CandidatePacket = {
      candidateId: 'cand-1',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '철검',
          action: 'remove',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            claimedEntityId: 'item-iron-sword',
            evidence: { context: '전투 중 파손' }
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(state, candidate, 1, history);
    const invAction = prop.actions.find(a => a.type === 'MODIFY_INVENTORY');
    assert(!!invAction, 'Test A3: Proposal contains inventory action');
    assert(invAction?.payload?.item?.id === 'item-iron-sword', 'Test A4: Proposal maintains canonical ID');
  }

  // Test B: Recovered Identity when Claimed ID is missing but Name matches uniquely
  {
    const resolution = resolveInventoryItemIdentity(state, history, '가보의 보검', {
      entityType: 'ITEM',
      evidence: { sourceNpcId: 'npc-abbot', context: '방장에게 건넴' }
    });
    assert(resolution.status === 'RECOVERED', 'Test B1: Recovered status without LLM ID');
    assert(resolution.canonicalId === 'item-ancestral-blade', 'Test B2: Recovered exact canonical ID');

    const candidate: CandidatePacket = {
      candidateId: 'cand-2',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '가보의 보검',
          action: 'remove',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            evidence: { sourceNpcId: 'npc-abbot', context: '방장에게 건넴' }
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(state, candidate, 1, history);
    const invAction = prop.actions.find(a => a.type === 'MODIFY_INVENTORY');
    assert(!!invAction, 'Test B3: Recovered proposal contains inventory action');
    assert(invAction?.payload?.item?.id === 'item-ancestral-blade', 'Test B4: Recovered ID used in proposal');
  }

  // Test C: Homonym / Ambiguity Blocks Mutation
  {
    // Duplicate item name in state
    const ambiguousState = createMockState();
    ambiguousState.character.inventory.push({
      id: 'item-pot-2',
      name: '철검',
      quantity: 1,
      description: '또 다른 철검'
    });
    const resolution = resolveInventoryItemIdentity(ambiguousState, history, '철검', {
      entityType: 'ITEM',
      evidence: { context: '사용' }
    });
    assert(resolution.status === 'AMBIGUOUS', 'Test C1: Ambiguous status for multiple matches');

    const candidate: CandidatePacket = {
      candidateId: 'cand-3',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '철검',
          action: 'remove',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            evidence: { context: '사용' }
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(ambiguousState, candidate, 1, history);
    const invAction = prop.actions.find(a => a.type === 'MODIFY_INVENTORY');
    assert(!invAction, 'Test C2: Ambiguous item mutation is strictly blocked in proposal');
  }

  // Test D: Conflict on Bogus or Mismatched Claimed ID
  {
    const resolution = resolveInventoryItemIdentity(state, history, '철검', {
      entityType: 'ITEM',
      claimedEntityId: 'item-non-existent-999',
      evidence: { context: '사용' }
    });
    assert(resolution.status === 'CONFLICT', 'Test D1: Conflict on non-existent claimed ID');

    const resolution2 = resolveInventoryItemIdentity(state, history, '철검', {
      entityType: 'ITEM',
      claimedEntityId: 'item-ancestral-blade', // points to '가보의 보검', not '철검'
      evidence: { context: '사용' }
    });
    assert(resolution2.status === 'CONFLICT', 'Test D2: Conflict on name-ID mismatch');

    const candidate: CandidatePacket = {
      candidateId: 'cand-4',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '철검',
          action: 'remove',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            claimedEntityId: 'item-ancestral-blade',
            evidence: { context: '사용' }
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(state, candidate, 1, history);
    const invAction = prop.actions.find(a => a.type === 'MODIFY_INVENTORY');
    assert(!invAction, 'Test D3: Conflicting item mutation is blocked in proposal');
  }

  // Test E: Index Miss without Novelty Evidence -> AMBIGUOUS (Mutation Prohibited)
  {
    const resolution = resolveInventoryItemIdentity(state, history, '미확인 보물', {
      entityType: 'ITEM',
      evidence: {} // No positive evidence
    });
    assert(resolution.status === 'AMBIGUOUS', 'Test E1: Index miss without evidence is AMBIGUOUS, not NOVEL');
    assert(!resolution.canonicalId, 'Test E2: No canonical ID issued');

    const candidate: CandidatePacket = {
      candidateId: 'cand-5',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '미확인 보물',
          action: 'add',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            evidence: {}
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(state, candidate, 1, history);
    const invAction = prop.actions.find(a => a.type === 'MODIFY_INVENTORY');
    assert(!invAction, 'Test E3: Index miss without evidence is blocked from mutating state');
  }

  // Test F: Strict NOVEL Gate Testing
  // Test F-1: Legitimate Novel Entity with Positive Authoritative Evidence -> NOVEL
  {
    const resolution = resolveInventoryItemIdentity(state, history, '청룡언월도', {
      entityType: 'ITEM',
      evidence: {
        cause: 'DUNGEON_REWARD',
        context: '비경을 탐색하고 획득함',
        sourceNpcId: 'npc-abbot',
        verifiedEventId: 'evt-armory'
      }
    });
    assert(resolution.status === 'NOVEL', 'Test F1: NOVEL status granted when positive evidence exists');
    assert(resolution.canonicalId === undefined, 'Test F2: Resolver does NOT issue ID');

    const candidate: CandidatePacket = {
      candidateId: 'cand-6',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '청룡언월도',
          action: 'add',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            evidence: {
              cause: 'DUNGEON_REWARD',
              context: '비경을 탐색하고 획득함',
              sourceNpcId: 'npc-abbot',
              verifiedEventId: 'evt-armory'
            }
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(state, candidate, 1, history);
    const invAction = prop.actions.find(a => a.type === 'MODIFY_INVENTORY');
    assert(!!invAction, 'Test F3: Engine allocates new canonical ID and produces proposal');
    assert(typeof invAction?.payload?.item?.id === 'string' && invAction.payload.item.id.startsWith('item-'), 'Test F4: Engine generated item ID prefix');
    assert(invAction?.payload?.item?.entityReference?.resolvedEntityId === invAction?.payload?.item?.id, 'Test F5: Engine transient resolvedEntityId populated');
  }

  // Test F-2: False Positive Prevention - Event exists, but does NOT mention candidate entity -> AMBIGUOUS
  {
    const resolution = resolveInventoryItemIdentity(state, history, '청룡언월도', {
      entityType: 'ITEM',
      evidence: {
        cause: 'DUNGEON_REWARD',
        context: '비경을 탐색하고 획득함',
        sourceNpcId: 'npc-abbot',
        verifiedEventId: 'evt-2' // 'Spoke with npc-abbot and discovered hidden armory' (does NOT mention 청룡언월도)
      }
    });
    assert(resolution.status === 'AMBIGUOUS', 'Test F-FP1: Unrelated event existence alone MUST NOT authorize NOVEL (fails closed to AMBIGUOUS)');
  }

  // Test F-3: False Positive Prevention - sourceNpcId alone without verifiedEventId -> AMBIGUOUS
  {
    const resolution = resolveInventoryItemIdentity(state, history, '천상비검', {
      entityType: 'ITEM',
      evidence: {
        cause: 'GIFT',
        context: '방장에게서 직접 선물받음',
        sourceNpcId: 'npc-abbot'
        // verifiedEventId omitted
      }
    });
    assert(resolution.status === 'AMBIGUOUS', 'Test F-FP2: sourceNpcId alone without authoritative verifiedEventId MUST NOT authorize NOVEL');
  }

  // Test F-4: False Positive Prevention - Non-existent verifiedEventId -> AMBIGUOUS
  {
    const resolution = resolveInventoryItemIdentity(state, history, '천상비검', {
      entityType: 'ITEM',
      evidence: {
        cause: 'DUNGEON_REWARD',
        context: '비경에서 획득',
        verifiedEventId: 'evt-non-existent-999'
      }
    });
    assert(resolution.status === 'AMBIGUOUS', 'Test F-FP3: Non-existent verifiedEventId MUST NOT authorize NOVEL');
  }

  // Test Gate: Candidate Recovery Gate Validation
  {
    // Valid candidate with complete entityReference bundle
    const validCandidate = {
      candidateId: 1,
      label: 'Valid Option',
      narrativeSummary: 'Summary',
      rawMetadata: {
        inventoryChanges: [
          {
            name: '철검',
            quantity: 1,
            action: 'add',
            entityReference: {
              entityType: 'ITEM',
              evidence: { cause: 'PURCHASE' }
            }
          }
        ]
      }
    };
    const gateRes = runCandidateRecoveryGate([validCandidate]);
    assert(gateRes.passedCount === 1, 'Gate Test 1: Complete bundle passes gate');

    // Missing entityReference bundle -> quarantined
    const missingRefCandidate = {
      candidateId: 2,
      label: 'Corrupted Option',
      narrativeSummary: 'Summary',
      rawMetadata: {
        inventoryChanges: [
          {
            name: '철검',
            quantity: 1,
            action: 'add'
            // missing entityReference
          }
        ]
      }
    };
    const gateRes2 = runCandidateRecoveryGate([missingRefCandidate]);
    assert(gateRes2.quarantinedCount === 1, 'Gate Test 2: Missing entityReference bundle is quarantined');

    // LLM attempts to forge resolvedEntityId -> quarantined
    const forgedResolvedCandidate = {
      candidateId: 3,
      label: 'Forged Option',
      narrativeSummary: 'Summary',
      rawMetadata: {
        inventoryChanges: [
          {
            name: '철검',
            quantity: 1,
            action: 'add',
            entityReference: {
              entityType: 'ITEM',
              evidence: { cause: 'LOOT' },
              resolvedEntityId: 'forged-item-id-from-llm'
            }
          }
        ]
      }
    };
    const gateRes3 = runCandidateRecoveryGate([forgedResolvedCandidate]);
    assert(gateRes3.quarantinedCount === 1, 'Gate Test 3: LLM-supplied resolvedEntityId is quarantined');
  }

  // ==========================================
  // Test Suite: NPC Identity Continuity
  // ==========================================
  console.log('\n--- NPC Identity Continuity Tests ---');
  {
    // Test NPC-1: Exact Match by Name & ID
    const res1 = resolveNpcIdentity(state, history, '방장 스님', {
      entityType: 'NPC',
      claimedEntityId: 'npc-abbot',
      evidence: { context: '대화' }
    });
    assert(res1.status === 'EXACT', 'NPC Test 1: Exact match status');
    assert(res1.canonicalId === 'npc-abbot', 'NPC Test 1: Preserves canonical ID');

    // Test NPC-2: Recovered Match (Alias or Name without Claimed ID)
    const res2 = resolveNpcIdentity(state, history, '현공 대사', {
      entityType: 'NPC',
      evidence: { context: '법당에서 마주침' }
    });
    assert(res2.status === 'RECOVERED', 'NPC Test 2: Recovered by alias');
    assert(res2.canonicalId === 'npc-abbot', 'NPC Test 2: Matches canonical ID npc-abbot');

    // Test NPC-3: Novel NPC with Valid Specific Historical Event Evidence -> NOVEL
    const res3 = resolveNpcIdentity(state, history, '장삼봉', {
      entityType: 'NPC',
      evidence: {
        cause: 'MET_DURING_STORY',
        verifiedEventId: 'evt-npc-wudang',
        context: '무당파 장문인 장삼봉을 만남'
      }
    });
    assert(res3.status === 'NOVEL', 'NPC Test 3: Novel status with valid verifiedEventId');
    assert(res3.canonicalId === undefined, 'NPC Test 3: Resolver does not issue ID');

    // Test NPC-3-FP: False Positive Prevention - Unrelated event existence alone MUST NOT authorize NOVEL
    const res3FP = resolveNpcIdentity(state, history, '장삼봉', {
      entityType: 'NPC',
      evidence: {
        cause: 'MET_DURING_STORY',
        verifiedEventId: 'evt-1', // 'Acquired item-iron-sword during training' (unrelated to 장삼봉)
        context: '무당파 장문인을 만남'
      }
    });
    assert(res3FP.status === 'AMBIGUOUS', 'NPC Test 3-FP: Unrelated event existence alone rejected as AMBIGUOUS');

    // Test NPC-4: Index Miss without Evidence -> AMBIGUOUS
    const res4 = resolveNpcIdentity(state, history, '괴한', {
      entityType: 'NPC',
      evidence: {}
    });
    assert(res4.status === 'AMBIGUOUS', 'NPC Test 4: Index miss without evidence is AMBIGUOUS');

    // Test NPC-5: Conflict on Mismatched Claimed ID
    const res5 = resolveNpcIdentity(state, history, '방장 스님', {
      entityType: 'NPC',
      claimedEntityId: 'npc-wrong-id-999',
      evidence: { context: '대화' }
    });
    assert(res5.status === 'CONFLICT', 'NPC Test 5: Conflict on bogus claimed ID');
  }

  // ==========================================
  // Test Suite: FACTION Identity Continuity
  // ==========================================
  console.log('\n--- Faction Identity Continuity Tests ---');
  {
    // Test FAC-1: Exact Match
    const res1 = resolveFactionIdentity(state, history, '소림사', {
      entityType: 'FACTION',
      claimedEntityId: 'fac-shaolin',
      evidence: { context: '방문' }
    });
    assert(res1.status === 'EXACT', 'Faction Test 1: Exact match');
    assert(res1.canonicalId === 'fac-shaolin', 'Faction Test 1: Preserves fac-shaolin ID');

    // Test FAC-2: Recovered Match
    const res2 = resolveFactionIdentity(state, history, '소림사', {
      entityType: 'FACTION',
      evidence: { context: '문파 교류' }
    });
    assert(res2.status === 'RECOVERED', 'Faction Test 2: Recovered without claimed ID');
    assert(res2.canonicalId === 'fac-shaolin', 'Faction Test 2: Matches fac-shaolin');

    // Test FAC-3: Novel Faction with Authoritative Event Evidence
    const res3 = resolveFactionIdentity(state, history, '무당파', {
      entityType: 'FACTION',
      evidence: {
        cause: 'ENCOUNTERED_NEW_FACTION',
        context: '호북성에서 무당파를 접함',
        verifiedEventId: 'evt-fac-wudang'
      }
    });
    assert(res3.status === 'NOVEL', 'Faction Test 3: Novel faction with cause');

    // Test FAC-3-FP: False Positive Prevention - Unrelated event alone MUST NOT authorize NOVEL
    const res3FP = resolveFactionIdentity(state, history, '무당파', {
      entityType: 'FACTION',
      evidence: {
        cause: 'ENCOUNTERED_NEW_FACTION',
        context: '호북성에서 무당파를 접함',
        verifiedEventId: 'evt-1' // 'Acquired item-iron-sword during training' (unrelated to 무당파)
      }
    });
    assert(res3FP.status === 'AMBIGUOUS', 'Faction Test 3-FP: Unrelated event existence alone rejected as AMBIGUOUS');

    // Test FAC-4: Index Miss without Cause -> AMBIGUOUS
    const res4 = resolveFactionIdentity(state, history, '비밀결사', {
      entityType: 'FACTION',
      evidence: {}
    });
    assert(res4.status === 'AMBIGUOUS', 'Faction Test 4: Index miss without evidence is AMBIGUOUS');
  }

  // ==========================================
  // Test Suite: NARRATIVE_SEED Identity Continuity
  // ==========================================
  console.log('\n--- Narrative Seed Identity Continuity Tests ---');
  {
    const stateWithSeed = createMockState();
    stateWithSeed.worldInfo.seeds = [
      { id: 'seed-stolen-manual', content: '도난당한 비급의 행방', status: 'active', turnCreated: 1 }
    ];

    // Test SEED-1: Exact Match
    const res1 = resolveNarrativeSeedIdentity(stateWithSeed, history, '도난당한 비급의 행방', {
      entityType: 'NARRATIVE_SEED',
      claimedEntityId: 'seed-stolen-manual',
      evidence: { context: '단서 발견' }
    });
    assert(res1.status === 'EXACT', 'Seed Test 1: Exact match');
    assert(res1.canonicalId === 'seed-stolen-manual', 'Seed Test 1: Matches seed-stolen-manual');

    // Test SEED-2: Novel Seed with Valid Authoritative Event Evidence
    const res2 = resolveNarrativeSeedIdentity(stateWithSeed, history, '동굴 속의 흑영', {
      entityType: 'NARRATIVE_SEED',
      evidence: {
        cause: 'DISCOVERED_FORESHADOW',
        context: '동굴 탐험 중 기이한 그림자를 봄',
        verifiedEventId: 'evt-seed-shadow'
      }
    });
    assert(res2.status === 'NOVEL', 'Seed Test 2: Novel seed with cause');

    // Test SEED-2-FP: False Positive Prevention - Unrelated event alone MUST NOT authorize NOVEL
    const res2FP = resolveNarrativeSeedIdentity(stateWithSeed, history, '동굴 속의 흑영', {
      entityType: 'NARRATIVE_SEED',
      evidence: {
        cause: 'DISCOVERED_FORESHADOW',
        context: '동굴 탐험 중 기이한 그림자를 봄',
        verifiedEventId: 'evt-1' // 'Acquired item-iron-sword during training' (unrelated to 동굴 속의 흑영)
      }
    });
    assert(res2FP.status === 'AMBIGUOUS', 'Seed Test 2-FP: Unrelated event existence alone rejected as AMBIGUOUS');

    // Test SEED-3: Index Miss without Evidence -> AMBIGUOUS
    const res3 = resolveNarrativeSeedIdentity(stateWithSeed, history, '알 수 없는 소문', {
      entityType: 'NARRATIVE_SEED',
      evidence: {}
    });
    assert(res3.status === 'AMBIGUOUS', 'Seed Test 3: Index miss without evidence is AMBIGUOUS');

    // Test SEED-4: Resolution Proposal
    const candidate: CandidatePacket = {
      candidateId: 'cand-seed-res',
      turn: 1,
      timestamp: new Date().toISOString(),
      seedChanges: [
        {
          content: '도난당한 비급의 행방',
          status: 'resolved',
          action: 'resolve',
          resolutionSummary: '도적을 제압하고 비급을 회수함',
          entityReference: {
            entityType: 'NARRATIVE_SEED',
            claimedEntityId: 'seed-stolen-manual',
            evidence: { context: '해결' }
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(stateWithSeed, candidate, 1, history);
    const resolveAction = prop.actions.find(a => a.type === 'RESOLVE_NARRATIVE_SEED');
    assert(!!resolveAction, 'Seed Test 4: Proposal contains RESOLVE_NARRATIVE_SEED');
    assert(resolveAction?.payload?.id === 'seed-stolen-manual', 'Seed Test 4: Resolves exact seed canonical ID');
  }

  // ==========================================
  // Test Suite: CHARACTER Identity Continuity
  // ==========================================
  console.log('\n--- Character Identity Continuity Tests ---');
  {
    // Test Char-1: Recovered by unique protagonist name
    const res1 = resolveCharacterIdentity(state, history, '이청', {
      entityType: 'CHARACTER',
      evidence: { context: '주인공 행동' }
    });
    assert(res1.status === 'RECOVERED', 'Character Test 1: Matches protagonist without claimed ID');
    assert(res1.canonicalId === 'protagonist', 'Character Test 1: Canonical ID is protagonist');

    // Test Char-2: Exact match with claimedEntityId: 'protagonist'
    const res2 = resolveCharacterIdentity(state, history, '이청', {
      entityType: 'CHARACTER',
      claimedEntityId: 'protagonist',
      evidence: { context: '주인공 직접 판정' }
    });
    assert(res2.status === 'EXACT', 'Character Test 2: Exact match with claimed protagonist ID');
    assert(res2.canonicalId === 'protagonist', 'Character Test 2: Preserves protagonist ID');

    // Test Char-3: Mismatch on claimedEntityId: 'protagonist' with wrong name
    const res3 = resolveCharacterIdentity(state, history, '가짜주인공', {
      entityType: 'CHARACTER',
      claimedEntityId: 'protagonist',
      evidence: {}
    });
    assert(res3.status === 'CONFLICT', 'Character Test 3: Mismatched character name against claimed protagonist ID produces CONFLICT');

    // Test Char-4: Conflicting character identity in candidate packet blocks stat changes
    const spoofedCharCandidate: CandidatePacket = {
      candidateId: 'cand-char-spoof',
      turn: 1,
      timestamp: new Date().toISOString(),
      characterChanges: {
        name: '가짜주인공',
        entityReference: {
          entityType: 'CHARACTER',
          claimedEntityId: 'protagonist',
          evidence: {}
        }
      },
      statChanges: [{ stat: 'strength', delta: 5 }]
    };
    const spoofedProp = buildSafeProposalFromCandidate(state, spoofedCharCandidate, 1, history);
    const hasStatAction = spoofedProp.actions.some(a => a.type === 'UPDATE_CHARACTER_STATS');
    assert(!hasStatAction, 'Character Test 4: Conflicting character identity strictly blocks character stat mutations');
  }

  // ==========================================
  // Test Suite: End-to-End Pipeline (EOF) Verification
  // ==========================================
  console.log('\n--- Full EOF Pipeline & SovereignEngine Commit Tests ---');
  {
    const engine = new SovereignEngine(state.worldInfo, state.character, history, state.stateVersion, state.turn);

    // 1. Candidate with Item, NPC, Faction, Seed changes
    const validCandidatePacket: CandidatePacket = {
      candidateId: 'cand-eof-1',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '철검',
          action: 'remove',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            claimedEntityId: 'item-iron-sword',
            evidence: { context: '사용 후 마모' }
          }
        },
        {
          name: '벽력탄',
          action: 'add',
          quantity: 2,
          entityReference: {
            entityType: 'ITEM',
            evidence: {
              cause: 'PURCHASE',
              context: '대장간에서 구매',
              verifiedEventId: 'evt-bomb-shop'
            }
          }
        }
      ],
      npcChanges: [
        {
          name: '방장 스님',
          innerThought: '젊은 검객의 자질이 뛰어나구나.',
          metInStory: true,
          entityReference: {
            entityType: 'NPC',
            claimedEntityId: 'npc-abbot',
            evidence: { context: '수련 대화' }
          }
        },
        {
          name: '화산파 장문인',
          npcClass: 'MAJOR_NAMED',
          metInStory: true,
          entityReference: {
            entityType: 'NPC',
            evidence: {
              cause: 'FIRST_ENCOUNTER',
              context: '화산파 본산 방문',
              verifiedEventId: 'evt-huashan-npc'
            }
          }
        }
      ],
      factionChanges: [
        {
          name: '화산파',
          description: '화산의 검파',
          attitudeTowardsPlayer: 'NEUTRAL',
          entityReference: {
            entityType: 'FACTION',
            evidence: {
              cause: 'ENCOUNTER',
              context: '새로운 문파 접촉',
              verifiedEventId: 'evt-huashan-fac'
            }
          }
        }
      ],
      seedChanges: [
        {
          content: '새로운 비급의 행방',
          status: 'active',
          action: 'create',
          entityReference: {
            entityType: 'NARRATIVE_SEED',
            evidence: {
              cause: 'DISCOVERY',
              context: '비급의 행방에 관한 단서 발견',
              verifiedEventId: 'evt-seed-eof'
            }
          }
        }
      ]
    };

    // Step 1: Candidate Recovery Gate
    const validRawMetadata = {
      inventoryChanges: validCandidatePacket.inventoryChanges,
      newNpcs: validCandidatePacket.npcChanges,
      newFactions: validCandidatePacket.factionChanges,
      foreshadowSeeds: ['새로운 비급의 행방']
    };
    const gateResult = runCandidateRecoveryGate([{
      candidateId: 1,
      label: 'EOF Step Option',
      narrativeSummary: 'Full transition test',
      rawMetadata: validRawMetadata
    }]);
    assert(gateResult.passedCount === 1, 'EOF Test 1: Candidate passes Recovery Gate');

    // Step 2: Proposal Construction & Identity Resolution
    const proposal = buildSafeProposalFromCandidate(state, validCandidatePacket, 1, history);
    assert(proposal.actions.length >= 5, 'EOF Test 2: Proposal contains all validated actions');

    const claimInnerThought = ImmigrationGate.admit(
      {
        rawText: '수련 대화',
        targetEntityId: 'npc-abbot',
        targetAttribute: 'innerThought',
        claimedValue: '젊은 검객의 자질이 뛰어나구나.',
        claimedEvidenceIds: ['evt-abbot-thought']
      },
      [{
        evidenceId: 'evt-abbot-thought',
        entityId: 'npc-abbot',
        attribute: 'innerThought',
        value: '젊은 검객의 자질이 뛰어나구나.',
        content: '수련 대화에서 방장 스님이 감탄함'
      }],
      state
    );
    const claimMetInStory = ImmigrationGate.admit(
      {
        rawText: '수련 대화',
        targetEntityId: 'npc-abbot',
        targetAttribute: 'metInStory',
        claimedValue: true,
        claimedEvidenceIds: ['evt-abbot-thought']
      },
      [{
        evidenceId: 'evt-abbot-thought',
        entityId: 'npc-abbot',
        attribute: 'metInStory',
        value: true,
        content: '수련 대화에서 방장 스님이 감탄함'
      }],
      state
    );
    const newClaims = [...(proposal.verifiedClaims || [])];
    if (claimInnerThought.verifiedClaim) {
      newClaims.push(claimInnerThought.verifiedClaim);
    }
    if (claimMetInStory.verifiedClaim) {
      newClaims.push(claimMetInStory.verifiedClaim);
    }
    (proposal as any).verifiedClaims = newClaims;

    // Step 3: Sovereign Engine Validation
    const validationVerdict = EngineValidator.validate(proposal, state, new Set(), new Set(), history);
    if (!validationVerdict.isValid) {
      console.error('EOF Test 3 Validation Errors:', validationVerdict.rejectedReasons, validationVerdict.conflictDetails);
    }
    assert(validationVerdict.isValid, 'EOF Test 3: EngineValidator approves the proposal');

    // Step 4: Sovereign Engine Commit
    const commitResult = engine.submitProposal(proposal);
    if (!commitResult.success) {
      console.error('EOF Test 4 Commit Error:', commitResult.rejectedReasons || (commitResult as any).error);
    }
    assert(commitResult.success, 'EOF Test 4: SovereignEngine successfully commits the proposal');

    // Verify Canonical State Mutations
    const updatedState = engine.getSnapshot();
    const ironSword = updatedState.character.inventory.find(i => i.id === 'item-iron-sword');
    assert(!ironSword, 'EOF Test 5: Existing 철검 successfully removed');

    const thunderBomb = updatedState.character.inventory.find(i => i.name === '벽력탄');
    assert(!!thunderBomb && thunderBomb.quantity === 2, 'EOF Test 6: Novel 벽력탄 added with Engine-issued ID');

    const abbotNpc = updatedState.worldInfo.npcs.find(n => n.id === 'npc-abbot');
    assert(abbotNpc?.innerThought === '젊은 검객의 자질이 뛰어나구나.', 'EOF Test 7: Canonical NPC innerThought updated');

    const huashanNpc = updatedState.worldInfo.npcs.find(n => n.name === '화산파 장문인');
    assert(!!huashanNpc && huashanNpc.id.startsWith('npc-'), 'EOF Test 8: Novel NPC added with Engine-issued ID');

    const huashanFaction = updatedState.worldInfo.factions.find(f => f.name === '화산파');
    assert(!!huashanFaction && huashanFaction.id.startsWith('fac-'), 'EOF Test 9: Novel Faction added with Engine-issued ID');

    const newSeed = updatedState.worldInfo.seeds.find(s => s.content.includes('새로운 비급의 행방'));
    assert(!!newSeed && newSeed.id.startsWith('seed-'), 'EOF Test 10: Novel Seed added with Engine-issued ID');

    // Step 5: Historical Record Verification
    const committedHistory = engine.getHistory();
    assert(committedHistory.length >= 6, 'EOF Test 11: Immutable Historical Records created for all actions');
  }

  // ==========================================
  // Test Suite: Red Team Adversarial Attacks
  // ==========================================
  console.log('\n--- Red Team Adversarial Attack Tests ---');
  {
    // Attack 1: Fake Event ID Novelty Forgery
    const fakeEventRes = resolveInventoryItemIdentity(state, history, '신검', {
      entityType: 'ITEM',
      evidence: {
        verifiedEventId: 'evt-fabricated-non-existent-999',
        cause: 'FABRICATED'
      }
    });
    assert(fakeEventRes.status === 'AMBIGUOUS', 'Red Team 1: Fabricated eventId is rejected as AMBIGUOUS');

    // Attack 2: Bogus sourceNpcId Novelty Forgery
    const fakeNpcRes = resolveInventoryItemIdentity(state, history, '마도비급', {
      entityType: 'ITEM',
      evidence: {
        sourceNpcId: 'npc-fabricated-ghost',
        cause: 'GIFT'
      }
    });
    assert(fakeNpcRes.status === 'AMBIGUOUS', 'Red Team 2: Fabricated sourceNpcId is rejected as AMBIGUOUS');

    // Attack 3: Unauthorized Claimed ID Override on Existing Entity
    const spoofedFaction = resolveFactionIdentity(state, history, '소림사', {
      entityType: 'FACTION',
      claimedEntityId: 'fac-hacked-custom-id',
      evidence: { context: '해킹 시도' }
    });
    assert(spoofedFaction.status === 'CONFLICT', 'Red Team 3: Spoofed claimedEntityId on canonical entity triggers CONFLICT');
  }

  // ==========================================
  // Test Suite: 5-Entity Spoofed Cause/Context/Cost Adversarial Rejection Tests
  // Strict Invariant: LLM string claims ("cause", "context", "cost") alone can NEVER authorize NOVEL.
  // ==========================================
  console.log('\n--- Adversarial Attack Tests: 5-Entity Spoofed Cause/Context/Cost Rejection ---');
  {
    // 1. ITEM: Unindexed item with only cause, context, and cost
    const itemAttack = resolveInventoryItemIdentity(state, history, '천하무쌍보도', {
      entityType: 'ITEM',
      evidence: {
        cause: 'RESOURCE_EXCHANGE',
        context: '노점상에서 큰 돈을 주고 구입함',
        cost: { name: '은화', quantity: 100 }
      }
    });
    assert(itemAttack.status === 'AMBIGUOUS', '5-Entity Attack ITEM: cause/context/cost alone rejected as AMBIGUOUS');
    assert(itemAttack.canonicalId === undefined, '5-Entity Attack ITEM: No canonical ID issued');

    // 2. NPC: Unindexed NPC with only cause and context
    const npcAttack = resolveNpcIdentity(state, history, '의문의도인', {
      entityType: 'NPC',
      evidence: {
        cause: 'FIRST_ENCOUNTER',
        context: '산길에서 우연히 마주침'
      }
    });
    assert(npcAttack.status === 'AMBIGUOUS', '5-Entity Attack NPC: cause/context alone rejected as AMBIGUOUS');
    assert(npcAttack.canonicalId === undefined, '5-Entity Attack NPC: No canonical ID issued');

    // 3. FACTION: Unindexed Faction with only cause and context
    const facAttack = resolveFactionIdentity(state, history, '흑룡방', {
      entityType: 'FACTION',
      evidence: {
        cause: 'ENCOUNTER',
        context: '소문으로 들은 새로운 암흑 문파'
      }
    });
    assert(facAttack.status === 'AMBIGUOUS', '5-Entity Attack FACTION: cause/context alone rejected as AMBIGUOUS');
    assert(facAttack.canonicalId === undefined, '5-Entity Attack FACTION: No canonical ID issued');

    // 4. NARRATIVE_SEED: Unindexed Seed with only cause and context
    const seedAttack = resolveNarrativeSeedIdentity(state, history, '천하대란의 조짐', {
      entityType: 'NARRATIVE_SEED',
      evidence: {
        cause: 'DISCOVERY',
        context: '객잔에서 귓속말로 들음'
      }
    });
    assert(seedAttack.status === 'AMBIGUOUS', '5-Entity Attack SEED: cause/context alone rejected as AMBIGUOUS');
    assert(seedAttack.canonicalId === undefined, '5-Entity Attack SEED: No canonical ID issued');

    // 5. CHARACTER: Unindexed Character with only cause and context
    const charAttack = resolveCharacterIdentity(state, history, '가짜주인공', {
      entityType: 'CHARACTER',
      evidence: {
        cause: 'GENESIS_STARTER',
        context: '새로운 주인공 설정'
      }
    });
    assert(charAttack.status === 'AMBIGUOUS', '5-Entity Attack CHARACTER: cause/context alone rejected as AMBIGUOUS');
    assert(charAttack.canonicalId === undefined, '5-Entity Attack CHARACTER: No canonical ID issued');

    // Attack 6: Canonical NPC source claimed without authoritative historical acquisition proof
    // Create an NPC that exists canonically in state, but has NO historical record of giving/creating this item
    const stateWithNewNpc = createMockState();
    stateWithNewNpc.worldInfo.npcs.push({
      id: 'npc-stranger',
      name: '이름없는행인',
      npcClass: 'COMMON',
      status: 'ALIVE',
      metInStory: false
    });
    const unprovenNpcSource = resolveInventoryItemIdentity(stateWithNewNpc, history, '행인의보검', {
      entityType: 'ITEM',
      evidence: {
        sourceNpcId: 'npc-stranger',
        cause: 'GIFT_REWARD',
        context: '행인에게 하사받음'
      }
    });
    assert(unprovenNpcSource.status === 'AMBIGUOUS', 'Adversarial sourceNpcId: Canonical NPC without historical evidence rejected as AMBIGUOUS');
  }

  // ==========================================
  // Test Suite: 5-Entity Authoritative Positive Novelty Tests
  // Verified Event ID or Canonical Event Evidence MUST exist in history
  // ==========================================
  console.log('\n--- Positive Authoritative Verification Tests: 5-Entity Authoritative Novelty ---');
  {
    // 1. ITEM: Verified Authoritative Event Anchor -> NOVEL
    const itemPos = resolveInventoryItemIdentity(state, history, '용천검', {
      entityType: 'ITEM',
      evidence: {
        verifiedEventId: 'evt-item-yongcheon',
        cause: 'DISCOVERY_PICKUP',
        context: '수련장에서 정식 발굴'
      }
    });
    assert(itemPos.status === 'NOVEL', '5-Entity Positive ITEM: Authoritative event grants NOVEL');
    assert(itemPos.canonicalId === undefined, '5-Entity Positive ITEM: Resolver does not issue ID');

    // 2. NPC: Verified Authoritative Event Anchor -> NOVEL
    const npcPos = resolveNpcIdentity(state, history, '점창파사절', {
      entityType: 'NPC',
      evidence: {
        verifiedEventId: 'evt-npc-diancang',
        cause: 'FIRST_ENCOUNTER',
        context: '수련 중 찾아온 사절'
      }
    });
    assert(npcPos.status === 'NOVEL', '5-Entity Positive NPC: Authoritative event grants NOVEL');
    assert(npcPos.canonicalId === undefined, '5-Entity Positive NPC: Resolver does not issue ID');

    // 3. FACTION: Verified Authoritative Event Anchor -> NOVEL
    const facPos = resolveFactionIdentity(state, history, '점창파', {
      entityType: 'FACTION',
      evidence: {
        verifiedEventId: 'evt-fac-diancang',
        cause: 'ENCOUNTER',
        context: '사절 방문을 통한 공식 외교 접촉'
      }
    });
    assert(facPos.status === 'NOVEL', '5-Entity Positive FACTION: Authoritative event grants NOVEL');
    assert(facPos.canonicalId === undefined, '5-Entity Positive FACTION: Resolver does not issue ID');

    // 4. NARRATIVE_SEED: Verified Authoritative Event Anchor -> NOVEL
    const seedPos = resolveNarrativeSeedIdentity(state, history, '비경의 열쇠에 관한 단서', {
      entityType: 'NARRATIVE_SEED',
      evidence: {
        verifiedEventId: 'evt-seed-key',
        cause: 'DISCOVERY',
        context: '수련장 비석에 새겨진 단서'
      }
    });
    assert(seedPos.status === 'NOVEL', '5-Entity Positive SEED: Authoritative event grants NOVEL');
    assert(seedPos.canonicalId === undefined, '5-Entity Positive SEED: Resolver does not issue ID');

    // 5. CHARACTER: Verified Authoritative Event Anchor -> NOVEL
    const charPos = resolveCharacterIdentity(state, history, '동행자이설화', {
      entityType: 'CHARACTER',
      evidence: {
        verifiedEventId: 'evt-char-lee',
        cause: 'GENESIS_STARTER',
        context: '세계에 공식 편입된 영구 동행자'
      }
    });
    assert(charPos.status === 'NOVEL', '5-Entity Positive CHARACTER: Authoritative event grants NOVEL');
    assert(charPos.canonicalId === undefined, '5-Entity Positive CHARACTER: Resolver does not issue ID');

    // 6. Canonical sourceNpcId with authoritative history event verification
    const provenNpcSource = resolveInventoryItemIdentity(state, history, '방장의염주', {
      entityType: 'ITEM',
      evidence: {
        sourceNpcId: 'npc-abbot',
        verifiedEventId: 'evt-abbot-beads',
        cause: 'GIFT_REWARD',
        context: '방장이 비밀 보물창고에서 하사한 염주'
      }
    });
    assert(provenNpcSource.status === 'NOVEL', 'Positive sourceNpcId: Canonical NPC with verified historical event grants NOVEL');
  }

  // ==========================================
  // Test Suite: Inventory Cost ID Regression Tests
  // Verifies that effectiveCost in proposalParser:
  // - Resolves existing canonical ID for exact / recovered cost items
  // - Strictly fails-closed (blocks action) on fake ID, ambiguous name, or nonexistent cost item
  // - Never records LLM fake IDs in provenance
  // - Never uses generateProposalId('item') for cost ID
  // ==========================================
  console.log('\n--- Inventory Cost ID Regression Tests ---');
  {
    const stateForCost = createMockState();
    const historyForCost: ImmutableHistoricalRecord[] = [
      {
        recordId: 'rec-cost-base',
        eventId: 'evt-cost-anchor',
        proposalId: 'prop-cost-base',
        turn: 1,
        timestamp: new Date().toISOString(),
        source: 'ENGINE_INTERNAL',
        actionType: 'MODIFY_INVENTORY',
        details: 'Visited blacksmith shop and acquired 벽력탄',
        stateVersionAfterCommit: 1
      }
    ];

    // 1. Exact Canonical ID match: Cost ID matches existing canonical item 'item-iron-sword'
    const exactCostCandidate: CandidatePacket = {
      candidateId: 'cand-cost-exact',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '벽력탄',
          action: 'add',
          quantity: 1,
          cause: 'RESOURCE_EXCHANGE',
          cost: {
            id: 'item-iron-sword',
            name: '철검',
            quantity: 1
          },
          entityReference: {
            entityType: 'ITEM',
            evidence: {
              cause: 'RESOURCE_EXCHANGE',
              verifiedEventId: 'evt-cost-anchor',
              context: '철검을 대가로 벽력탄을 구입함'
            }
          }
        },
        {
          name: '철검',
          action: 'remove',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            claimedEntityId: 'item-iron-sword',
            evidence: {}
          }
        }
      ]
    };
    const exactProp = buildSafeProposalFromCandidate(stateForCost, exactCostCandidate, 1, historyForCost);
    const exactAdd = exactProp.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!!exactAdd, 'Cost Regression 1: Exact canonical cost item produces valid ADD action');
    assert((exactAdd?.payload as any)?.acquisition?.cost?.id === 'item-iron-sword', 'Cost Regression 1: Exact cost confirms canonical ID item-iron-sword, NOT a generated ID');
    assert((exactAdd?.payload as any)?.item?.id !== 'item-iron-sword' && (exactAdd?.payload as any)?.item?.id?.startsWith('item-'), 'Cost Regression 1: Acquired item retains NOVEL ID generation');

    // 2. Recovered Canonical ID: Candidate omits cost.id, Identity Resolver recovers 'item-iron-sword'
    const recoveredCostCandidate: CandidatePacket = {
      candidateId: 'cand-cost-recovered',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '벽력탄',
          action: 'add',
          quantity: 1,
          cause: 'RESOURCE_EXCHANGE',
          cost: {
            name: '철검',
            quantity: 1
          },
          entityReference: {
            entityType: 'ITEM',
            evidence: {
              cause: 'RESOURCE_EXCHANGE',
              verifiedEventId: 'evt-cost-anchor',
              context: '철검을 대가로 벽력탄을 구입함'
            }
          }
        },
        {
          name: '철검',
          action: 'remove',
          quantity: 1
        }
      ]
    };
    const recProp = buildSafeProposalFromCandidate(stateForCost, recoveredCostCandidate, 1, historyForCost);
    const recAdd = recProp.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!!recAdd, 'Cost Regression 2: Recovered cost item produces valid ADD action');
    assert((recAdd?.payload as any)?.acquisition?.cost?.id === 'item-iron-sword', 'Cost Regression 2: Recovered cost resolves canonical ID item-iron-sword from Engine indices');

    // 3. Fake / Spoofed Cost ID: LLM claims an ungrounded fake ID 'fake-sword-999' -> CONFLICT -> fail-closed
    const fakeCostCandidate: CandidatePacket = {
      candidateId: 'cand-cost-fake',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '벽력탄',
          action: 'add',
          quantity: 1,
          cause: 'RESOURCE_EXCHANGE',
          cost: {
            id: 'fake-sword-999',
            name: '철검',
            quantity: 1
          },
          entityReference: {
            entityType: 'ITEM',
            evidence: {
              cause: 'RESOURCE_EXCHANGE',
              verifiedEventId: 'evt-cost-anchor',
              context: '철검을 대가로 벽력탄을 구입함'
            }
          }
        },
        {
          name: '철검',
          action: 'remove',
          quantity: 1
        }
      ]
    };
    const fakeProp = buildSafeProposalFromCandidate(stateForCost, fakeCostCandidate, 1, historyForCost);
    const fakeAdd = fakeProp.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!fakeAdd, 'Cost Regression 3: Fake/spoofed cost ID strictly fails closed (no ADD action produced)');

    // 4. Ambiguous Cost Item: Multiple items match the name in state -> AMBIGUOUS -> fail-closed
    const stateWithAmbiguous = createMockState();
    stateWithAmbiguous.character.inventory.push({
      id: 'item-iron-sword-second',
      name: '철검',
      quantity: 1,
      description: '또 다른 철검'
    });
    const ambiguousProp = buildSafeProposalFromCandidate(stateWithAmbiguous, recoveredCostCandidate, 1, historyForCost);
    const ambAdd = ambiguousProp.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!ambAdd, 'Cost Regression 4: Ambiguous cost item strictly fails closed (no ADD action produced)');

    // 5. Non-existent Cost Item: Player does not possess the claimed cost item -> fail-closed
    const nonexistentCostCandidate: CandidatePacket = {
      candidateId: 'cand-cost-nonexistent',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '벽력탄',
          action: 'add',
          quantity: 1,
          cause: 'RESOURCE_EXCHANGE',
          cost: {
            name: '전설의용린',
            quantity: 1
          },
          entityReference: {
            entityType: 'ITEM',
            evidence: {
              cause: 'RESOURCE_EXCHANGE',
              verifiedEventId: 'evt-cost-anchor',
              context: '용린을 대가로 벽력탄을 구입함'
            }
          }
        }
      ]
    };
    const nonProp = buildSafeProposalFromCandidate(stateForCost, nonexistentCostCandidate, 1, historyForCost);
    const nonAdd = nonProp.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!nonAdd, 'Cost Regression 5: Non-existent cost item strictly fails closed (no ADD action produced)');

    // 6. Cost inferred from companion removedItem without explicit cost object
    const companionCostCandidate: CandidatePacket = {
      candidateId: 'cand-cost-companion',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '벽력탄',
          action: 'add',
          quantity: 1,
          cause: 'PURCHASE',
          entityReference: {
            entityType: 'ITEM',
            evidence: {
              cause: 'RESOURCE_EXCHANGE',
              verifiedEventId: 'evt-cost-anchor',
              context: '철검을 대가로 벽력탄을 구입함'
            }
          }
        },
        {
          name: '철검',
          action: 'remove',
          quantity: 1
        }
      ]
    };
    const companionProp = buildSafeProposalFromCandidate(stateForCost, companionCostCandidate, 1, historyForCost);
    const companionAdd = companionProp.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!!companionAdd, 'Cost Regression 6: Companion removed item infers cost successfully');
    assert((companionAdd?.payload as any)?.acquisition?.cost?.id === 'item-iron-sword', 'Cost Regression 6: Inferred cost resolves canonical ID item-iron-sword without generateProposalId');
  }

  // ==========================================
  // Test Suite: Inventory Cost Ownership / Availability Gate Tests
  // Verifies the 9 mandatory ownership and availability regression cases:
  // 1. 보유 1 / 비용 1 -> PASS
  // 2. 보유 3 / 비용 2 -> PASS
  // 3. 보유 1 / 비용 2 -> FAIL (fail-closed)
  // 4. 보유 0 + History에 과거 존재 -> FAIL (fail-closed)
  // 5. 과거 존재했지만 현재 삭제됨 -> FAIL (fail-closed)
  // 6. 동일 이름 AMBIGUOUS -> FAIL (fail-closed)
  // 7. fake ID -> FAIL (fail-closed)
  // 8. Cost ID 없이 정상 이름만 존재 -> Identity 복구 후 현재 보유량 검사
  // 9. 신규 획득 Item NOVEL ID 생성 -> 기존 동작 유지
  // ==========================================
  console.log('\n--- Inventory Cost Ownership / Availability Gate Tests ---');
  {
    const historyWithSword: ImmutableHistoricalRecord[] = [
      {
        recordId: 'rec-sword-hist',
        eventId: 'evt-cost-anchor',
        proposalId: 'prop-cost-base',
        turn: 1,
        timestamp: new Date().toISOString(),
        source: 'ENGINE_INTERNAL',
        actionType: 'MODIFY_INVENTORY',
        details: 'Visited blacksmith shop and acquired 벽력탄 with canonical 철검',
        stateVersionAfterCommit: 1
      }
    ];

    const createCandidateWithCost = (costObj: { id?: string; name: string; quantity: number }): CandidatePacket => ({
      candidateId: 'cand-cost-test',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '벽력탄',
          action: 'add',
          quantity: 1,
          cause: 'RESOURCE_EXCHANGE',
          cost: costObj,
          entityReference: {
            entityType: 'ITEM',
            evidence: {
              cause: 'RESOURCE_EXCHANGE',
              verifiedEventId: 'evt-cost-anchor',
              context: '비용 지불 거래'
            }
          }
        }
      ]
    });

    // 1. 보유 1 / 비용 1 -> PASS
    const stateOwned1 = createMockState();
    stateOwned1.character.inventory = [
      { id: 'item-iron-sword', name: '철검', quantity: 1, description: '보유 수량 1' }
    ];
    const prop1 = buildSafeProposalFromCandidate(
      stateOwned1,
      createCandidateWithCost({ id: 'item-iron-sword', name: '철검', quantity: 1 }),
      1,
      historyWithSword
    );
    const addAction1 = prop1.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!!addAction1, 'Ownership Gate 1: 보유 1 / 비용 1 -> PASS (거래 승인)');
    assert((addAction1?.payload as any)?.acquisition?.cost?.id === 'item-iron-sword', 'Ownership Gate 1: Canonical cost ID confirmed');
    assert((addAction1?.payload as any)?.acquisition?.cost?.quantity === 1, 'Ownership Gate 1: Cost quantity matches 1');

    // 2. 보유 3 / 비용 2 -> PASS
    const stateOwned3 = createMockState();
    stateOwned3.character.inventory = [
      { id: 'item-iron-sword', name: '철검', quantity: 3, description: '보유 수량 3' }
    ];
    const prop2 = buildSafeProposalFromCandidate(
      stateOwned3,
      createCandidateWithCost({ name: '철검', quantity: 2 }),
      1,
      historyWithSword
    );
    const addAction2 = prop2.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!!addAction2, 'Ownership Gate 2: 보유 3 / 비용 2 -> PASS (거래 승인)');
    assert((addAction2?.payload as any)?.acquisition?.cost?.id === 'item-iron-sword', 'Ownership Gate 2: Canonical cost ID confirmed');
    assert((addAction2?.payload as any)?.acquisition?.cost?.quantity === 2, 'Ownership Gate 2: Cost quantity matches 2');

    // 3. 보유 1 / 비용 2 -> FAIL
    const stateOwned1Cost2 = createMockState();
    stateOwned1Cost2.character.inventory = [
      { id: 'item-iron-sword', name: '철검', quantity: 1, description: '보유 수량 1' }
    ];
    const prop3 = buildSafeProposalFromCandidate(
      stateOwned1Cost2,
      createCandidateWithCost({ name: '철검', quantity: 2 }),
      1,
      historyWithSword
    );
    const addAction3 = prop3.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!addAction3, 'Ownership Gate 3: 보유 1 / 비용 2 -> FAIL (수량 부족 차단)');

    // 4. 보유 0 + History에 과거 존재 -> FAIL
    const stateOwned0 = createMockState();
    stateOwned0.character.inventory = [
      { id: 'item-iron-sword', name: '철검', quantity: 0, description: '보유 수량 0' }
    ];
    const prop4 = buildSafeProposalFromCandidate(
      stateOwned0,
      createCandidateWithCost({ name: '철검', quantity: 1 }),
      1,
      historyWithSword
    );
    const addAction4 = prop4.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!addAction4, 'Ownership Gate 4: 보유 0 + History 과거 존재 -> FAIL (수량 0 사용 차단)');

    // 5. 과거 존재했지만 현재 삭제됨 (인벤토리에 없음) -> FAIL
    const stateDeleted = createMockState();
    stateDeleted.character.inventory = []; // 완전히 제거됨
    const prop5 = buildSafeProposalFromCandidate(
      stateDeleted,
      createCandidateWithCost({ name: '철검', quantity: 1 }),
      1,
      historyWithSword
    );
    const addAction5 = prop5.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!addAction5, 'Ownership Gate 5: 과거 존재했지만 현재 삭제됨 -> FAIL (미보유 차단)');

    // 6. 동일 이름 AMBIGUOUS -> FAIL
    const stateAmbiguous = createMockState();
    stateAmbiguous.character.inventory = [
      { id: 'item-iron-sword-1', name: '철검', quantity: 1, description: '철검 1' },
      { id: 'item-iron-sword-2', name: '철검', quantity: 1, description: '철검 2' }
    ];
    const prop6 = buildSafeProposalFromCandidate(
      stateAmbiguous,
      createCandidateWithCost({ name: '철검', quantity: 1 }),
      1,
      historyWithSword
    );
    const addAction6 = prop6.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!addAction6, 'Ownership Gate 6: 동일 이름 AMBIGUOUS -> FAIL (모호성 차단)');

    // 7. fake ID -> FAIL
    const stateFake = createMockState();
    stateFake.character.inventory = [
      { id: 'item-iron-sword', name: '철검', quantity: 1, description: '정상 철검' }
    ];
    const prop7 = buildSafeProposalFromCandidate(
      stateFake,
      createCandidateWithCost({ id: 'fake-sword-999', name: '철검', quantity: 1 }),
      1,
      historyWithSword
    );
    const addAction7 = prop7.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!addAction7, 'Ownership Gate 7: fake ID -> FAIL (미승인 가짜 ID 차단)');

    // 8. Cost ID 없이 정상 이름만 존재 -> Identity 복구 후 현재 보유량 검사
    // 8a: 보유량 1 >= 비용 1 -> Identity 복구 후 승인
    const stateRecoveredPass = createMockState();
    stateRecoveredPass.character.inventory = [
      { id: 'item-iron-sword', name: '철검', quantity: 1, description: '정상 철검' }
    ];
    const prop8a = buildSafeProposalFromCandidate(
      stateRecoveredPass,
      createCandidateWithCost({ name: '철검', quantity: 1 }), // ID 없음
      1,
      historyWithSword
    );
    const addAction8a = prop8a.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!!addAction8a, 'Ownership Gate 8a: Cost ID 생략 시 이름으로 Identity 복구 후 보유량 충족 시 PASS');
    assert((addAction8a?.payload as any)?.acquisition?.cost?.id === 'item-iron-sword', 'Ownership Gate 8a: Resolved to canonical ID');

    // 8b: 보유량 0 < 비용 1 -> Identity 복구되었으나 보유량 부족으로 FAIL
    const stateRecoveredFail = createMockState();
    stateRecoveredFail.character.inventory = [
      { id: 'item-iron-sword', name: '철검', quantity: 0, description: '수량 0 철검' }
    ];
    const prop8b = buildSafeProposalFromCandidate(
      stateRecoveredFail,
      createCandidateWithCost({ name: '철검', quantity: 1 }), // ID 없음
      1,
      historyWithSword
    );
    const addAction8b = prop8b.actions.find(a => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD');
    assert(!addAction8b, 'Ownership Gate 8b: Cost ID 생략 시 Identity 복구되었으나 보유량 0으로 FAIL');

    // 9. 신규 획득 Item NOVEL ID 생성 -> 기존 동작 유지
    assert(
      (addAction1?.payload as any)?.item?.id !== 'item-iron-sword' &&
      (addAction1?.payload as any)?.item?.id?.startsWith('item-'),
      'Ownership Gate 9: 신규 획득 Item NOVEL ID 생성 -> 기존 동작 유지'
    );
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  return { passed, failed, errors };
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('entityIdentityResolverTest')) {
  const res = runEntityIdentityTests();
  if (res.failed > 0) {
    process.exit(1);
  }
}
