import { adaptMeaningTreeToProposal } from '../src/engine/language/adapter';
import { MeaningNode } from '../src/engine/language/types';
import { SovereignEngine } from '../src/engine/state';

async function executeR2Attack() {
  console.log('==========================================================================');
  console.log('    R2 TEMPORAL VALIDITY ATTACK RUNNER                                    ');
  console.log('==========================================================================');

  const engine = new SovereignEngine();
  const state0 = engine.getSnapshot();

  // --- STEP 1: Turn N Canonical Event Creation ---
  console.log('\n[STEP 1] Turn N: LLM Submits Offscreen Event Proposal');
  const eventId1 = 'r2-temporal-sword-001';
  const tree1: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'RECORD_OFFSCREEN_EVENT',
    fields: {
      actionType: 'RECORD_OFFSCREEN_EVENT',
      payload: {
        id: eventId1,
        eventId: eventId1,
        eventDescription: '삼화상인이 주인공에게 은검을 선물했다.'
      }
    }
  };

  const proposal1 = adaptMeaningTreeToProposal(tree1, {
    source: 'LLM',
    turn: state0.turn,
    expectedStateVersion: state0.stateVersion,
    eventId: 'evt-r2-turn1',
    requestId: 'req-r2-turn1'
  });

  const res1 = engine.submitProposal(proposal1);
  const state1 = engine.getSnapshot();

  // --- STEP 2: Turn N+1 Invalidation Event Creation ---
  console.log('\n[STEP 2] Turn N+1: LLM Submits Invalidation Event Proposal');
  const eventId2 = 'r2-temporal-sword-002';
  const tree2: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'RECORD_OFFSCREEN_EVENT',
    fields: {
      actionType: 'RECORD_OFFSCREEN_EVENT',
      payload: {
        id: eventId2,
        eventId: eventId2,
        eventDescription: '은검은 사용 중 파괴되어 더 이상 존재하지 않는다.'
      }
    }
  };

  const proposal2 = adaptMeaningTreeToProposal(tree2, {
    source: 'LLM',
    turn: state1.turn + 1,
    expectedStateVersion: state1.stateVersion,
    eventId: 'evt-r2-turn2',
    requestId: 'req-r2-turn2'
  });

  const res2 = engine.submitProposal(proposal2);
  const state2 = engine.getSnapshot();

  // --- STEP 3: Turn N+2 Reuse Old Event for Inventory ADD ---
  console.log('\n[STEP 3] Turn N+2: LLM Reuses Stale Canonical Event for Inventory ADD');
  const tree3: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'MODIFY_INVENTORY',
    fields: {
      actionType: 'MODIFY_INVENTORY',
      payload: {
        operation: 'ADD',
        item: {
          id: 'item-r2-silver-sword',
          name: '은검',
          quantity: 1
        },
        acquisition: {
          cause: 'GIFT',
          verifiedEventId: eventId1
        }
      }
    }
  };

  const proposal3 = adaptMeaningTreeToProposal(tree3, {
    source: 'LLM',
    turn: state2.turn + 1,
    expectedStateVersion: state2.stateVersion,
    eventId: 'evt-r2-turn3',
    requestId: 'req-r2-turn3'
  });

  const res3 = engine.submitProposal(proposal3);
  const state3 = engine.getSnapshot();

  console.log('\n=== R2 TEMPORAL VALIDITY ATTACK RESULT ===');
  console.log('STEP 1 EVENT COMMIT:', res1.success);
  console.log('STEP 1 STATE VERSION:', state1.stateVersion);
  console.log('STEP 1 TURN:', state1.turn);
  console.log('');
  console.log('STEP 2 INVALIDATION COMMIT:', res2.success);
  console.log('STEP 2 STATE VERSION:', state2.stateVersion);
  console.log('STEP 2 TURN:', state2.turn);
  console.log('');
  console.log('STEP 3 INVENTORY COMMIT:', res3.success);
  console.log('STEP 3 REJECTION REASONS:', JSON.stringify(res3.rejectedReasons || []));
  console.log('');
  console.log('INVENTORY BEFORE STEP 3:', JSON.stringify(state2.character.inventory));
  console.log('INVENTORY AFTER STEP 3:', JSON.stringify(state3.character.inventory));
  console.log('');
  const oldRecord = state3.worldInfo.offscreenRecords?.find(r => r.id === eventId1);
  console.log('OLD EVENT STILL IN CANONICAL:', oldRecord !== undefined);
  console.log('OLD EVENT ID:', oldRecord?.id || 'NOT FOUND');
  console.log('OLD EVENT STATUS:', (oldRecord as any)?.status || 'N/A');
  console.log('OLD EVENT ACTIVE FLAG:', (oldRecord as any)?.active || 'N/A');
  console.log('');
  const historyOld = engine.getHistory().filter(h => h.eventId === eventId1 || (h.details && h.details.includes(eventId1)));
  const historyInvalid = engine.getHistory().filter(h => h.eventId === eventId2 || (h.details && h.details.includes(eventId2)));
  console.log('HISTORY OLD EVENT:', historyOld.length > 0 ? historyOld.map(h => h.recordId).join(', ') : 'NONE');
  console.log('HISTORY INVALIDATION EVENT:', historyInvalid.length > 0 ? historyInvalid.map(h => h.recordId).join(', ') : 'NONE');
  console.log('');
  console.log('CANONICAL STATE MUTATED:', JSON.stringify(state2.character.inventory) !== JSON.stringify(state3.character.inventory));
  console.log('');

  let attackStatus = '';
  if (res1.success && res2.success && res3.success && JSON.stringify(state2.character.inventory) !== JSON.stringify(state3.character.inventory)) {
    attackStatus = 'RED: STALE CANONICAL EVIDENCE EXPLOIT';
  } else if (!res3.success) {
    attackStatus = 'BLOCKED';
  } else {
    attackStatus = 'TEMPORAL INVALIDATION MODEL MISSING';
  }
  console.log('ATTACK STATUS:', attackStatus);
}

executeR2Attack();
