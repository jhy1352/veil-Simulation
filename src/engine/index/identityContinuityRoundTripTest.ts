import { SovereignEngine } from '../state';
import type { CanonicalState, ImmutableHistoricalRecord, TransitionAction } from '../types';
import { dispatchEngineInternalProposal } from '../internalCapability';
import { projectPassports } from './passport';
import { resolveNpcIdentity, resolveInventoryItemIdentity } from './entityIdentityResolver';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`✓ ${message}`);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function makeProposal(engine: SovereignEngine) {
  const state = engine.getSnapshot();
  const actions: TransitionAction[] = [
    {
      type: 'ADD_NPC',
      payload: {
        id: 'npc-roundtrip-merchant',
        name: '연속성 상인',
        status: 'ALIVE',
        role: '상인'
      }
    },
    {
      type: 'MODIFY_INVENTORY',
      payload: {
        item: {
          id: 'item-roundtrip-token',
          name: '연속성 증표',
          quantity: 1,
          description: 'Save/Load Round-Trip 검증용 아이템'
        },
        operation: 'ADD',
        acquisition: {
          cause: 'GIFT_REWARD',
          sourceNpcId: 'npc-roundtrip-merchant'
        }
      }
    }
  ];

  return dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-roundtrip-1',
    requestId: 'req-roundtrip-1',
    eventId: 'evt-roundtrip-1',
    expectedStateVersion: state.stateVersion,
    turn: state.turn + 1,
    intentSummary: 'Persistence round-trip: create canonical NPC and inventory item',
    actions
  });
}

function run(): void {
  console.log('\n=== Identity Continuity Persistence Round-Trip Tests ===\n');

  // A real engine commit creates the authoritative snapshot + immutable History.
  const engine = new SovereignEngine();
  const genesis = engine.getGenesisSnapshot();
  const commit = makeProposal(engine);

  assert(commit.success, 'Round-trip fixture commits through the Sovereign Commit Gate');
  assert(commit.committedActionsCount === 2, 'Round-trip fixture commits both identity-bearing actions');

  const savedSnapshot = clone(engine.getSnapshot());
  const savedHistory = clone([...engine.getHistory()]) as ImmutableHistoricalRecord[];
  const savedGenesis = clone(genesis);
  const savedPassports = projectPassports(savedSnapshot, savedHistory, []);

  // Persistence boundary: force a JSON serialization/deserialization cycle.
  const persistedSnapshot = JSON.parse(JSON.stringify(savedSnapshot)) as CanonicalState;
  const persistedHistory = JSON.parse(JSON.stringify(savedHistory)) as ImmutableHistoricalRecord[];
  const persistedGenesis = JSON.parse(JSON.stringify(savedGenesis)) as CanonicalState;

  const restored = SovereignEngine.hydrate(
    persistedSnapshot,
    persistedHistory,
    undefined,
    undefined,
    persistedGenesis
  );
  const restoredSnapshot = restored.getSnapshot();
  const restoredHistory = [...restored.getHistory()];
  const restoredPassports = projectPassports(restoredSnapshot, restoredHistory, []);

  console.log('\n--- State / History Round-Trip ---');
  assert(
    stableJson(savedSnapshot) === stableJson(restoredSnapshot),
    'CanonicalState is byte-equivalent after JSON Save/Load + Hydration'
  );
  assert(
    stableJson(savedHistory) === stableJson(restoredHistory),
    'Immutable History is byte-equivalent after JSON Save/Load + Hydration'
  );
  assert(
    stableJson(savedGenesis) === stableJson(restored.getGenesisSnapshot()),
    'Genesis anchor is preserved after Hydration'
  );

  console.log('\n--- Identity Resolution Round-Trip ---');
  const savedNpc = resolveNpcIdentity(savedSnapshot, savedHistory, '연속성 상인');
  const restoredNpc = resolveNpcIdentity(restoredSnapshot, restoredHistory, '연속성 상인');
  assert(savedNpc.status === 'RECOVERED' && restoredNpc.status === 'RECOVERED', 'NPC identity remains uniquely recoverable');
  assert(savedNpc.canonicalId === 'npc-roundtrip-merchant', 'Saved NPC resolves to canonical ID');
  assert(restoredNpc.canonicalId === savedNpc.canonicalId, 'Restored NPC resolves to the identical canonical ID');
  assert(stableJson(savedNpc) === stableJson(restoredNpc), 'NPC identity resolution result is identical after Hydration');

  const savedItem = resolveInventoryItemIdentity(savedSnapshot, savedHistory, '연속성 증표');
  const restoredItem = resolveInventoryItemIdentity(restoredSnapshot, restoredHistory, '연속성 증표');
  assert(savedItem.status === 'RECOVERED' && restoredItem.status === 'RECOVERED', 'Inventory item identity remains uniquely recoverable');
  assert(savedItem.canonicalId === 'item-roundtrip-token', 'Saved inventory item resolves to canonical ID');
  assert(restoredItem.canonicalId === savedItem.canonicalId, 'Restored inventory item resolves to the identical canonical ID');
  assert(stableJson(savedItem) === stableJson(restoredItem), 'Inventory identity resolution result is identical after Hydration');

  console.log('\n--- Passport Projection Round-Trip ---');
  assert(
    stableJson(savedPassports) === stableJson(restoredPassports),
    'Passport projection is identical before and after Save/Load + Hydration'
  );

  const savedNpcPassport = savedPassports.passports.find(p => p.entityId === 'npc-roundtrip-merchant');
  const restoredNpcPassport = restoredPassports.passports.find(p => p.entityId === 'npc-roundtrip-merchant');
  const savedItemPassport = savedPassports.passports.find(p => p.entityId === 'item-roundtrip-token');
  const restoredItemPassport = restoredPassports.passports.find(p => p.entityId === 'item-roundtrip-token');

  assert(Boolean(savedNpcPassport && restoredNpcPassport), 'NPC Passport exists on both sides of the persistence boundary');
  assert(Boolean(savedItemPassport && restoredItemPassport), 'Inventory Passport exists on both sides of the persistence boundary');
  assert(savedNpcPassport?.passportId === restoredNpcPassport?.passportId, 'NPC Passport ID survives unchanged');
  assert(savedItemPassport?.passportId === restoredItemPassport?.passportId, 'Inventory Passport ID survives unchanged');
  assert(savedNpcPassport?.stamps[0]?.recordId === commit.newHistoricalRecords[0]?.recordId, 'NPC Passport points to authoritative committed History');
  assert(savedItemPassport?.stamps[0]?.recordId === commit.newHistoricalRecords[1]?.recordId, 'Inventory Passport points to authoritative committed History');

  // Repeat the persistence boundary once more. A correct derived projection must not drift.
  const secondRestore = SovereignEngine.hydrate(
    JSON.parse(JSON.stringify(restoredSnapshot)) as CanonicalState,
    JSON.parse(JSON.stringify(restoredHistory)) as ImmutableHistoricalRecord[],
    undefined,
    undefined,
    persistedGenesis
  );
  const secondSnapshot = secondRestore.getSnapshot();
  const secondHistory = [...secondRestore.getHistory()];
  const secondPassports = projectPassports(secondSnapshot, secondHistory, []);

  console.log('\n--- Second Save/Load Idempotence ---');
  assert(stableJson(restoredSnapshot) === stableJson(secondSnapshot), 'Second Save/Load does not mutate CanonicalState');
  assert(stableJson(restoredHistory) === stableJson(secondHistory), 'Second Save/Load does not mutate History');
  assert(stableJson(restoredPassports) === stableJson(secondPassports), 'Second Save/Load does not drift Passport projection');

  console.log('\n=== Identity Continuity Persistence Round-Trip: PASS ===\n');
}

run();
