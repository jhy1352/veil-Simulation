import { createEmptyCharacter, createEmptyWorldInfo } from '../../utils/factory';
import { CanonicalState, ImmutableHistoricalRecord } from '../types';
import { buildOffscreenWakeContext } from './offscreenHistoricalWake';

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
world.currentTime = { year: 2, season: 'AUTUMN', month: 9, day: 14 };
world.npcs.push({
  id: 'npc-mira',
  name: '미라',
  status: 'ALIVE',
  location: '도시-B',
  trust: 40
});
world.factions.push({
  id: 'faction-merchants',
  name: '상인 길드',
  description: '도시의 상업 세력'
});

const character = createEmptyCharacter();
const canonicalState: CanonicalState = {
  stateVersion: 8,
  turn: 400,
  worldInfo: world,
  character,
  lastCommittedEventId: 'evt-400',
  lastCommittedAt: '2026-09-04T00:00:00.000Z'
};

const npcBaseline: ImmutableHistoricalRecord = {
  recordId: 'rec-250',
  eventId: 'evt-250',
  proposalId: 'prop-250',
  turn: 250,
  timestamp: '2026-08-31T00:00:00.000Z',
  narrativeTime: { year: 2, season: 'SUMMER', month: 7, day: 12 },
  source: 'ENGINE_INTERNAL',
  actionType: 'UPDATE_NPC',
  details: '{"id":"npc-mira","changes":{"location":"마을-A"}}',
  canonicalAction: {
    type: 'UPDATE_NPC',
    payload: { id: 'npc-mira', changes: { location: '마을-A' } }
  },
  stateVersionAfterCommit: 6,
  informationAccess: 'PUBLIC'
};

const npcUpdate: ImmutableHistoricalRecord = {
  recordId: 'rec-301',
  eventId: 'evt-301',
  proposalId: 'prop-301',
  turn: 301,
  timestamp: '2026-09-01T00:00:00.000Z',
  narrativeTime: { year: 2, season: 'SUMMER', month: 8, day: 1 },
  source: 'ENGINE_INTERNAL',
  actionType: 'UPDATE_NPC',
  details: '{"id":"npc-mira","changes":{"location":"도시-B"}}',
  canonicalAction: {
    type: 'UPDATE_NPC',
    payload: { id: 'npc-mira', changes: { location: '도시-B' } }
  },
  stateVersionAfterCommit: 7,
  informationAccess: 'PUBLIC'
};

const unrelatedEvent: ImmutableHistoricalRecord = {
  recordId: 'rec-350',
  eventId: 'evt-350',
  proposalId: 'prop-350',
  turn: 350,
  timestamp: '2026-09-02T00:00:00.000Z',
  narrativeTime: { year: 2, season: 'AUTUMN', month: 9, day: 1 },
  source: 'ENGINE_INTERNAL',
  actionType: 'ADD_RUMOR',
  details: '{"rumor":"북쪽 항구의 폭풍"}',
  canonicalAction: {
    type: 'ADD_RUMOR',
    payload: { rumor: '북쪽 항구의 폭풍' }
  },
  stateVersionAfterCommit: 8,
  informationAccess: 'PUBLIC'
};

const futureNpcUpdate: ImmutableHistoricalRecord = {
  recordId: 'rec-450',
  eventId: 'evt-450',
  proposalId: 'prop-450',
  turn: 450,
  timestamp: '2026-09-05T00:00:00.000Z',
  narrativeTime: { year: 2, season: 'WINTER', month: 12, day: 1 },
  source: 'ENGINE_INTERNAL',
  actionType: 'UPDATE_NPC',
  details: '{"id":"npc-mira","changes":{"location":"성-C"}}',
  canonicalAction: {
    type: 'UPDATE_NPC',
    payload: { id: 'npc-mira', changes: { location: '성-C' } }
  },
  stateVersionAfterCommit: 9,
  informationAccess: 'PUBLIC'
};

const history = [npcBaseline, npcUpdate, unrelatedEvent, futureNpcUpdate] as const;
const originalNpc = JSON.stringify(world.npcs);
const originalHistory = JSON.stringify(history);

const context = buildOffscreenWakeContext(
  canonicalState,
  history,
  300,
  400,
  ['npc-mira']
);

assert(context.fromTurn === 300 && context.toTurn === 400, 'Wake interval is preserved');
assert(context.elapsedTurns === 100, 'Elapsed turns are calculated without simulating intermediate turns');
assert(context.anchors.length === 1, 'Requested anchor scope contains only the selected NPC');
assert(context.anchors[0].entityId === 'npc-mira', 'NPC anchor keeps canonical identity');
assert(context.anchors[0].currentLocation === '도시-B', 'Anchor exposes the current canonical location');
assert(context.anchors[0].lastHistoricalTurn === 250, 'Anchor baseline excludes history after fromTurn');
assert(context.anchors[0].lastHistoricalRecordId === 'rec-250', 'Anchor baseline keeps the latest record at or before fromTurn boundary');
assert(context.relevantHistory.length === 1, 'Relevant history excludes unrelated and future records');
assert(context.relevantHistory[0].recordId === 'rec-301', 'Relevant history preserves immutable record provenance');
assert(context.generationPolicy === 'CAUSAL_SKELETON_ONLY', 'Wake context explicitly limits generation to causal skeletons');
assert(context.authority === 'NON_CANONICAL_CONTEXT', 'Wake context cannot become world authority');
assert(JSON.stringify(world.npcs) === originalNpc, 'Context construction does not mutate CanonicalState');
assert(JSON.stringify(history) === originalHistory, 'Context construction does not mutate History');

let threw = false;
try {
  buildOffscreenWakeContext(canonicalState, history, 401, 400, ['npc-mira']);
} catch {
  threw = true;
}
assert(threw, 'Reverse time interval is rejected closed-gate style');

console.log(`\nOffscreen Historical Wake: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
