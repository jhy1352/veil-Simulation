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
  hasPositiveNoveltyEvidence,
  buildInventoryIdentityGraph
} from './entityIdentityResolver';
import { buildSafeProposalFromCandidate } from '../proposalParser';
import { validateCandidateStructure, runCandidateRecoveryGate } from '../language/candidateRecoveryGate';

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

  // Test F: Legitimate Novel Entity with Positive Acquisition Evidence -> NOVEL
  {
    const resolution = resolveInventoryItemIdentity(state, history, '청룡언월도', {
      entityType: 'ITEM',
      evidence: {
        cause: 'DUNGEON_REWARD',
        context: '비경을 탐색하고 획득함',
        sourceNpcId: 'npc-abbot'
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
              context: '비경을 탐색하고 획득함'
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

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  return { passed, failed, errors };
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('entityIdentityResolverTest')) {
  const res = runEntityIdentityTests();
  if (res.failed > 0) {
    process.exit(1);
  }
}
