/**
 * Regression tests for malformed inventory cost quantities.
 * Cost quantities are item counts, so they must be finite positive integers.
 */

import { CanonicalState } from '../types';
import { CandidatePacket } from '../../types';
import { buildSafeProposalFromCandidate } from '../proposalParser';

function createState(): CanonicalState {
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
      npcs: [],
      factions: [],
      publicRumors: [],
      secretLore: [],
      seeds: [],
      chapters: {
        currentChapter: '1장',
        upcomingChapters: []
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
        { id: 'item-iron-sword', name: '철검', quantity: 3, description: '보유 수량 3' },
        { id: 'item-ancestral-blade', name: '가보의 보검', quantity: 1, description: '보유 수량 1' }
      ]
    }
  };
}

function makeCandidate(quantity: number): CandidatePacket {
  return {
    candidateId: `cand-cost-quantity-${String(quantity)}`,
    turn: 1,
    timestamp: new Date().toISOString(),
    inventoryChanges: [
      {
        name: '가보의 보검',
        action: 'add',
        quantity: 1,
        cause: 'RESOURCE_EXCHANGE',
        cost: {
          id: 'item-iron-sword',
          name: '철검',
          quantity
        },
        entityReference: {
          entityType: 'ITEM',
          claimedEntityId: 'item-ancestral-blade',
          evidence: {
            cause: 'RESOURCE_EXCHANGE',
            context: '철검을 대가로 거래'
          }
        }
      }
    ]
  };
}

function assert(condition: boolean, name: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${name}`);
  }
  console.log(`✓ ${name}`);
}

export function runInventoryCostQuantityBoundaryTests(): void {
  console.log('\n=== Inventory Cost Quantity Boundary Tests ===\n');

  const invalidQuantities: Array<[number, string]> = [
    [NaN, 'NaN'],
    [Infinity, 'Infinity'],
    [-Infinity, '-Infinity'],
    [0, '0'],
    [-1, '-1'],
    [0.5, '0.5']
  ];

  for (const [quantity, label] of invalidQuantities) {
    const proposal = buildSafeProposalFromCandidate(createState(), makeCandidate(quantity), 1);
    const addAction = proposal.actions.find(
      action => action.type === 'MODIFY_INVENTORY' && action.payload?.operation === 'ADD'
    );
    assert(!addAction, `Malformed cost quantity ${label} fails closed (no ADD action)`);
  }

  const validProposal = buildSafeProposalFromCandidate(createState(), makeCandidate(2), 1);
  const validAdd = validProposal.actions.find(
    action => action.type === 'MODIFY_INVENTORY' && action.payload?.operation === 'ADD'
  );
  assert(!!validAdd, 'Valid integer cost quantity 2 remains accepted');
  assert(
    (validAdd?.payload as any)?.acquisition?.cost?.id === 'item-iron-sword',
    'Valid integer cost retains canonical cost ID'
  );
  assert(
    (validAdd?.payload as any)?.acquisition?.cost?.quantity === 2,
    'Valid integer cost retains exact quantity 2'
  );

  console.log('\nResult: all inventory cost quantity boundary tests passed.\n');
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('inventoryCostQuantityBoundaryTest')) {
  runInventoryCostQuantityBoundaryTests();
}
