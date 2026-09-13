import { CanonicalState, ImmutableHistoricalRecord } from '../types';
import { SovereignEngine, computeCanonicalStateHash } from '../state';
import { createEmptyCharacter, createEmptyWorldInfo } from '../../utils/factory';
import { applyActionToDraftState } from '../actionApplier';

let passed = 0;
let total = 0;

function assertRejects(name: string, run: () => void): void {
  total++;
  try {
    run();
  } catch (err: any) {
    if (String(err?.message).includes('HYDRATION_')) {
      passed++;
      console.log(`✓ ${name}`);
      return;
    }
    throw err;
  }
  throw new Error(`FAIL: ${name} was accepted by hydrate()`);
}

function makeSnapshot(overrides: Partial<CanonicalState> = {}): CanonicalState {
  return {
    stateVersion: 2,
    turn: 2,
    worldInfo: createEmptyWorldInfo(),
    character: createEmptyCharacter(),
    lastCommittedEventId: 'evt-2',
    lastCommittedAt: '2026-01-02T00:00:00.000Z',
    ...overrides
  };
}

function makeRecord(params: {
  recordId: string;
  eventId: string;
  proposalId: string;
  turn: number;
  version: number;
  previousStateHash?: string;
  canonicalAction?: ImmutableHistoricalRecord['canonicalAction'];
}): ImmutableHistoricalRecord {
  const defaultAction = {
    type: 'ADD_NPC',
    payload: { id: `npc-${params.recordId}`, name: 'Red Team NPC' }
  } as any;

  return {
    recordId: params.recordId,
    eventId: params.eventId,
    proposalId: params.proposalId,
    turn: params.turn,
    timestamp: `2026-01-0${params.turn}T00:00:00.000Z`,
    source: 'LLM',
    actionType: 'ADD_NPC',
    details: '{}',
    canonicalAction: params.canonicalAction !== undefined ? params.canonicalAction : defaultAction,
    stateVersionAfterCommit: params.version,
    ...(params.previousStateHash !== undefined ? { previousStateHash: params.previousStateHash } : {})
  };
}

function makeGenesis(): CanonicalState {
  return {
    stateVersion: 1,
    turn: 1,
    worldInfo: createEmptyWorldInfo(),
    character: createEmptyCharacter(),
    lastCommittedEventId: null,
    lastCommittedAt: '2026-01-01T00:00:00.000Z'
  };
}

function hashAfterAction(genesis: CanonicalState, action: ImmutableHistoricalRecord['canonicalAction']): string {
  const world = JSON.parse(JSON.stringify(genesis.worldInfo));
  const character = JSON.parse(JSON.stringify(genesis.character));
  applyActionToDraftState(action as any, world, character);
  return computeCanonicalStateHash({
    ...genesis,
    stateVersion: 2,
    turn: 1,
    worldInfo: world,
    character,
    lastCommittedEventId: 'evt-5a',
    lastCommittedAt: '2026-01-01T00:00:00.000Z'
  });
}

// 1. Non-empty history with null lastCommittedEventId must be rejected.
{
  const history = [makeRecord({
    recordId: 'rec-1', eventId: 'evt-1', proposalId: 'prop-1', turn: 2, version: 2
  })];
  assertRejects('Non-empty history + null lastCommittedEventId is rejected', () => {
    SovereignEngine.hydrate(makeSnapshot({ lastCommittedEventId: null }), history);
  });
}

// 2. A progressed current-format history with every provenance hash removed must be rejected
// before it can be treated as an unverified legacy chain.
{
  const history = [makeRecord({
    recordId: 'rec-2', eventId: 'evt-2', proposalId: 'prop-2', turn: 2, version: 2
  })];
  assertRejects('Hashless progressed history is rejected closed', () => {
    SovereignEngine.hydrate(makeSnapshot({ lastCommittedEventId: 'evt-2' }), history);
  });
}

// 3. Distinct proposals cannot commit the same stateVersion.
{
  const validHash = 'csh_0000000000000000';
  const history = [
    makeRecord({ recordId: 'rec-3a', eventId: 'evt-3a', proposalId: 'prop-3a', turn: 2, version: 2, previousStateHash: validHash }),
    makeRecord({ recordId: 'rec-3b', eventId: 'evt-3b', proposalId: 'prop-3b', turn: 2, version: 2, previousStateHash: validHash })
  ];
  assertRejects('Duplicate stateVersion across proposals is rejected', () => {
    SovereignEngine.hydrate(makeSnapshot({ lastCommittedEventId: 'evt-3b' }), history);
  });
}

// 4. Records belonging to one proposal must agree on event/turn/version even without hashes.
{
  const history = [
    makeRecord({ recordId: 'rec-4a', eventId: 'evt-4a', proposalId: 'prop-4', turn: 2, version: 2 }),
    makeRecord({ recordId: 'rec-4b', eventId: 'evt-4b', proposalId: 'prop-4', turn: 3, version: 3 })
  ];
  assertRejects('Hashless proposal metadata conflict is rejected', () => {
    SovereignEngine.hydrate(makeSnapshot({
      stateVersion: 3,
      turn: 3,
      lastCommittedEventId: 'evt-4b',
      lastCommittedAt: '2026-01-03T00:00:00.000Z'
    }), history);
  });
}

// 5. The same proposal cannot reappear after another proposal. This uses a valid Genesis
// anchor so rejection must come from the interleaving/grouping integrity, not the anchor gate.
{
  const genesis = makeGenesis();
  const actionA1 = {
    type: 'ADD_NPC',
    payload: { id: 'npc-5a', name: 'A1' }
  } as any;
  const actionB = {
    type: 'ADD_NPC',
    payload: { id: 'npc-5b', name: 'B' }
  } as any;
  const genesisHash = computeCanonicalStateHash(genesis);
  const afterAHash = hashAfterAction(genesis, actionA1);
  const history = [
    makeRecord({ recordId: 'rec-5a', eventId: 'evt-5a', proposalId: 'prop-A', turn: 1, version: 2, previousStateHash: genesisHash, canonicalAction: actionA1 }),
    makeRecord({ recordId: 'rec-5b', eventId: 'evt-5b', proposalId: 'prop-B', turn: 2, version: 3, previousStateHash: afterAHash, canonicalAction: actionB }),
    makeRecord({ recordId: 'rec-5c', eventId: 'evt-5c', proposalId: 'prop-A', turn: 3, version: 4, previousStateHash: afterAHash, canonicalAction: actionA1 })
  ];
  assertRejects('Interleaved proposal A-B-A history is rejected', () => {
    SovereignEngine.hydrate({
      ...makeSnapshot(),
      stateVersion: 4,
      turn: 3,
      worldInfo: createEmptyWorldInfo(),
      character: createEmptyCharacter(),
      lastCommittedEventId: 'evt-5c',
      lastCommittedAt: '2026-01-03T00:00:00.000Z'
    }, history, undefined, undefined, genesis);
  });
}

// 6. Deleting an intermediate committed proposal must not be accepted as a valid shortened chain.
{
  const history = [
    makeRecord({ recordId: 'rec-6a', eventId: 'evt-6a', proposalId: 'prop-6a', turn: 1, version: 2 }),
    makeRecord({ recordId: 'rec-6c', eventId: 'evt-6c', proposalId: 'prop-6c', turn: 3, version: 4 })
  ];
  assertRejects('Missing intermediate committed proposal is rejected', () => {
    SovereignEngine.hydrate(makeSnapshot({
      stateVersion: 4,
      turn: 3,
      lastCommittedEventId: 'evt-6c',
      lastCommittedAt: '2026-01-03T00:00:00.000Z'
    }), history);
  });
}

// 7. A canonical action is mandatory whenever provenance replay is active.
{
  const history = [
    makeRecord({
      recordId: 'rec-7', eventId: 'evt-7', proposalId: 'prop-7', turn: 2, version: 2,
      previousStateHash: 'csh_0000000000000000',
      canonicalAction: null as any
    })
  ];
  assertRejects('Missing canonicalAction is rejected during replay', () => {
    SovereignEngine.hydrate(makeSnapshot({ lastCommittedEventId: 'evt-7' }), history);
  });
}

// 8. Invalid provenance syntax must never enter the replay path.
{
  const history = [makeRecord({
    recordId: 'rec-8', eventId: 'evt-8', proposalId: 'prop-8', turn: 2, version: 2,
    previousStateHash: 'not-a-canonical-state-hash'
  })];
  assertRejects('Malformed previousStateHash is rejected', () => {
    SovereignEngine.hydrate(makeSnapshot({ lastCommittedEventId: 'evt-8' }), history);
  });
}

// 9. Snapshot stateVersion cannot claim to be older than the committed historical tail.
{
  const history = [makeRecord({
    recordId: 'rec-9', eventId: 'evt-9', proposalId: 'prop-9', turn: 2, version: 3
  })];
  assertRejects('Snapshot stateVersion regression is rejected', () => {
    SovereignEngine.hydrate(makeSnapshot({
      stateVersion: 2,
      lastCommittedEventId: 'evt-9'
    }), history);
  });
}

// 10. Snapshot tail event must be exactly the final historical event.
{
  const history = [makeRecord({
    recordId: 'rec-10', eventId: 'evt-10', proposalId: 'prop-10', turn: 2, version: 2
  })];
  assertRejects('Snapshot lastCommittedEventId mismatch is rejected', () => {
    SovereignEngine.hydrate(makeSnapshot({ lastCommittedEventId: 'forged-tail' }), history);
  });
}

console.log(`\nHydration Red-Team v2 Tests: ${passed}/${total} passed.`);
if (passed !== total) {
  throw new Error(`Hydration Red-Team v2 failed: ${passed}/${total} passed.`);
}
