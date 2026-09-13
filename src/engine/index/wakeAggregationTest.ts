import { createEmptyCharacter, createEmptyWorldInfo } from '../../utils/factory';
import { CanonicalState, ImmutableHistoricalRecord } from '../types';
import { aggregateOffscreenWake } from './wakeAggregation';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}

const world = createEmptyWorldInfo();
world.npcs.push(
  { id: 'npc-mira', name: '미라', status: 'ALIVE', location: '도시-B', trust: 40 },
  { id: 'npc-arin', name: '아린', status: 'ALIVE', location: '도시-B', trust: 20 }
);
world.factions.push({ id: 'faction-merchants', name: '상인 길드', description: '도시의 상업 세력' });

const canonicalState: CanonicalState = {
  stateVersion: 8,
  turn: 400,
  worldInfo: world,
  character: createEmptyCharacter(),
  lastCommittedEventId: 'evt-400',
  lastCommittedAt: '2026-09-04T00:00:00.000Z'
};

function record(
  recordId: string,
  turn: number,
  payload: Record<string, unknown>
): ImmutableHistoricalRecord {
  return {
    recordId,
    eventId: `evt-${turn}`,
    proposalId: `prop-${turn}`,
    turn,
    timestamp: `2026-09-${String(Math.min(30, Math.max(1, turn - 300))).padStart(2, '0')}T00:00:00.000Z`,
    source: 'ENGINE_INTERNAL',
    actionType: 'UPDATE_NPC',
    details: JSON.stringify(payload),
    canonicalAction: { type: 'UPDATE_NPC', payload: payload as any },
    stateVersionAfterCommit: turn,
    informationAccess: 'PUBLIC'
  };
}

const history = [
  record('rec-301', 301, {
    id: 'npc-mira',
    changes: { location: '도시-B' },
    involvedNpcIds: ['npc-arin'],
    factionId: 'faction-merchants'
  }),
  record('rec-320', 320, {
    id: 'npc-arin',
    changes: { status: 'ALIVE' },
    involvedNpcIds: ['npc-mira']
  }),
  record('rec-350', 350, {
    id: 'npc-unrelated',
    changes: { location: '북쪽 항구' }
  })
] as const;

const result = aggregateOffscreenWake({
  canonicalState,
  history,
  fromTurn: 300,
  toTurn: 400,
  seedAnchorEntityIds: ['npc-mira']
});

assert(result.anchorEntityIds.includes('npc-mira'), 'Seed anchor remains in the wake cluster');
assert(result.anchorEntityIds.includes('npc-arin'), 'Co-occurring NPC is aggregated into the same cluster');
assert(result.anchorEntityIds.includes('faction-merchants'), 'Co-occurring faction is aggregated into the same cluster');
assert(!result.anchorEntityIds.includes('npc-unrelated'), 'Unrelated historical entity is not aggregated');
assert(result.context.anchors.length === 3, 'One wake context contains the three related structural anchors');
assert(result.context.relevantHistory.length === 2, 'Wake context includes only records touching the aggregated cluster');
assert(result.context.relevantHistory.every(r => r.turn >= 300 && r.turn <= 400), 'Aggregated history remains interval-bounded');
assert(result.context.generationPolicy === 'CAUSAL_SKELETON_ONLY', 'Aggregation preserves causal-skeleton generation policy');
assert(result.context.authority === 'NON_CANONICAL_CONTEXT', 'Aggregation remains non-canonical context');

const repeat = aggregateOffscreenWake({
  canonicalState,
  history,
  fromTurn: 300,
  toTurn: 400,
  seedAnchorEntityIds: ['npc-mira']
});
assert(
  JSON.stringify(result.anchorEntityIds) === JSON.stringify(repeat.anchorEntityIds),
  'Identical input produces deterministic anchor aggregation'
);

console.log(`\nWake Aggregation: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
