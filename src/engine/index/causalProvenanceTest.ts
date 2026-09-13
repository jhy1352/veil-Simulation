import { HistoryManager } from '../history';
import { ImmutableHistoricalRecord } from '../types';

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (!condition) throw new Error(`❌ [FAIL] ${message}`);
  passed++;
  console.log(`✅ [PASS] ${message}`);
}

function record(params: {
  recordId: string;
  eventId: string;
  turn: number;
  actionType: ImmutableHistoricalRecord['actionType'];
  payload: any;
  causalParentRecordId?: string;
}): ImmutableHistoricalRecord {
  return {
    recordId: params.recordId,
    eventId: params.eventId,
    proposalId: `prop-${params.eventId}`,
    turn: params.turn,
    timestamp: new Date(2026, 0, params.turn).toISOString(),
    source: 'LLM',
    actionType: params.actionType,
    details: JSON.stringify(params.payload),
    canonicalAction: { type: params.actionType, payload: params.payload } as any,
    stateVersionAfterCommit: params.turn + 1,
    ...(params.causalParentRecordId ? { causalParentRecordId: params.causalParentRecordId } : {})
  };
}

// 1. A unique verified event resolves to its exact recordId.
{
  const history = new HistoryManager();
  history.append(record({
    recordId: 'rec-source-1', eventId: 'evt-source-1', turn: 1,
    actionType: 'ADD_NPC', payload: { id: 'npc-a', name: 'A' }
  }));
  history.append(record({
    recordId: 'rec-acq-1', eventId: 'evt-acq-1', turn: 2,
    actionType: 'MODIFY_INVENTORY',
    payload: {
      item: { id: 'item-a', name: '검', quantity: 1 },
      operation: 'ADD',
      acquisition: { cause: 'GIFT_REWARD', verifiedEventId: 'evt-source-1' }
    }
  }));
  assert(history.getAllRecords()[1].causalParentRecordId === 'rec-source-1', 'Unique verifiedEventId links exact parent recordId');
}

// 2. An event with multiple records is ambiguous without stronger evidence: do not guess.
{
  const history = new HistoryManager();
  history.append(record({ recordId: 'rec-multi-1', eventId: 'evt-multi', turn: 1, actionType: 'ADD_NPC', payload: { id: 'npc-a' } }));
  history.append(record({ recordId: 'rec-multi-2', eventId: 'evt-multi', turn: 1, actionType: 'ADD_NPC', payload: { id: 'npc-b' } }));
  history.append(record({
    recordId: 'rec-acq-2', eventId: 'evt-acq-2', turn: 2,
    actionType: 'MODIFY_INVENTORY',
    payload: { item: { id: 'item-b', name: '활', quantity: 1 }, operation: 'ADD', acquisition: { verifiedEventId: 'evt-multi' } }
  }));
  assert(history.getAllRecords()[2].causalParentRecordId === undefined, 'Ambiguous verified event never receives an invented parent');
}

// 3. Explicit parent must exist.
{
  let rejected = false;
  try {
    new HistoryManager([record({
      recordId: 'rec-acq-3', eventId: 'evt-acq-3', turn: 2,
      actionType: 'MODIFY_INVENTORY',
      payload: { item: { id: 'item-c', name: '방패', quantity: 1 }, operation: 'ADD', acquisition: { verifiedEventId: 'evt-source-3' } },
      causalParentRecordId: 'rec-missing'
    })]);
  } catch (err: any) {
    rejected = String(err?.message).includes('[HISTORY_PROVENANCE_VIOLATION]');
  }
  assert(rejected, 'Missing explicit causal parent is fail-closed');
}

// 4. Parent must belong to verifiedEventId.
{
  let rejected = false;
  try {
    new HistoryManager([
      record({ recordId: 'rec-wrong-event', eventId: 'evt-other', turn: 1, actionType: 'ADD_NPC', payload: { id: 'npc-d' } }),
      record({
        recordId: 'rec-acq-4', eventId: 'evt-acq-4', turn: 2,
        actionType: 'MODIFY_INVENTORY',
        payload: { item: { id: 'item-d', name: '도끼', quantity: 1 }, operation: 'ADD', acquisition: { verifiedEventId: 'evt-expected' } },
        causalParentRecordId: 'rec-wrong-event'
      })
    ]);
  } catch (err: any) {
    rejected = String(err?.message).includes('[HISTORY_PROVENANCE_VIOLATION]');
  }
  assert(rejected, 'Cross-event causal parent is rejected');
}

// 5. Self-parenting is impossible.
{
  let rejected = false;
  try {
    new HistoryManager([record({
      recordId: 'rec-self', eventId: 'evt-self', turn: 1,
      actionType: 'MODIFY_INVENTORY',
      payload: { item: { id: 'item-e', name: '망토', quantity: 1 }, operation: 'ADD', acquisition: { verifiedEventId: 'evt-self' } },
      causalParentRecordId: 'rec-self'
    })]);
  } catch (err: any) {
    rejected = String(err?.message).includes('[HISTORY_PROVENANCE_VIOLATION]');
  }
  assert(rejected, 'Self-referential causal parent is rejected');
}

// 6. Explicit parent survives append immutability and remains queryable by event.
{
  const history = new HistoryManager();
  history.append(record({ recordId: 'rec-source-6', eventId: 'evt-source-6', turn: 1, actionType: 'ADD_NPC', payload: { id: 'npc-f' } }));
  history.append(record({
    recordId: 'rec-acq-6', eventId: 'evt-acq-6', turn: 2,
    actionType: 'MODIFY_INVENTORY',
    payload: { item: { id: 'item-f', name: '반지', quantity: 1 }, operation: 'ADD', acquisition: { verifiedEventId: 'evt-source-6' } },
    causalParentRecordId: 'rec-source-6'
  }));
  const acq = history.getRecordsByEventId('evt-acq-6')[0];
  assert(acq.causalParentRecordId === 'rec-source-6', 'Causal parent survives immutable History indexing');
}

console.log(`\nCausal Provenance Tests: ${passed}/${total} passed.`);
