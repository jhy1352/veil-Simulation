import { adaptMeaningTreeToProposal } from '../../src/engine/language/adapter';
import { MeaningNode } from '../../src/engine/language/types';
import { SovereignEngine } from '../../src/engine/state';

async function executeR6Attack() {
  console.log('==========================================================================');
  console.log('    R6 NON-ACQUISITION HISTORY EVENT-ID AS ACQUISITION EVIDENCE ATTACK    ');
  console.log('==========================================================================');

  const engine = new SovereignEngine();
  const state0 = engine.getSnapshot();

  // STEP 1 — Turn 1: Offscreen Event Creation
  console.log('\n[STEP 1] Turn 1: Canonical Offscreen Event Creation');
  const eventId = 'r6-acquisition-source-001';
  const tree1: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'RECORD_OFFSCREEN_EVENT',
    fields: {
      actionType: 'RECORD_OFFSCREEN_EVENT',
      payload: {
        id: eventId,
        eventId: eventId,
        eventDescription: '삼화상인이 주인공에게 은검을 선물했다.'
      }
    }
  };

  const proposal1 = adaptMeaningTreeToProposal(tree1, {
    source: 'LLM',
    turn: state0.turn,
    expectedStateVersion: state0.stateVersion,
    eventId: 'evt-r6-turn1',
    requestId: 'req-r6-turn1'
  });

  const res1 = engine.submitProposal(proposal1);
  const state1 = engine.getSnapshot();

  console.log('STEP 1 COMMIT:', res1.success);

  // STEP 2 — Turn 2: Inventory ADD
  console.log('\n[STEP 2] Turn 2: Inventory ADD');
  const itemId = 'item-r6-silver-sword';
  const tree2: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'MODIFY_INVENTORY',
    fields: {
      actionType: 'MODIFY_INVENTORY',
      payload: {
        operation: 'ADD',
        item: {
          id: itemId,
          name: '은검',
          quantity: 1
        },
        acquisition: {
          cause: 'GIFT',
          verifiedEventId: eventId
        }
      }
    }
  };

  const proposal2 = adaptMeaningTreeToProposal(tree2, {
    source: 'LLM',
    turn: state1.turn + 1,
    expectedStateVersion: state1.stateVersion,
    eventId: 'evt-r6-turn2',
    requestId: 'req-r6-turn2'
  });

  const res2 = engine.submitProposal(proposal2);
  const state2 = engine.getSnapshot();

  console.log('STEP 2 COMMIT:', res2.success);

  // STEP 3 — Turn 3: Inventory REMOVE and eventId Extraction
  console.log('\n[STEP 3] Turn 3: Inventory REMOVE and History Extraction');
  const historyBeforeRemove = engine.getHistory().length;
  const tree3: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'MODIFY_INVENTORY',
    fields: {
      actionType: 'MODIFY_INVENTORY',
      payload: {
        operation: 'REMOVE',
        item: {
          id: itemId,
          name: '은검',
          quantity: 1
        }
      }
    }
  };

  const proposal3 = adaptMeaningTreeToProposal(tree3, {
    source: 'LLM',
    turn: state2.turn + 1,
    expectedStateVersion: state2.stateVersion,
    eventId: 'evt-r6-turn3',
    requestId: 'req-r6-turn3'
  });

  const res3 = engine.submitProposal(proposal3);
  const state3 = engine.getSnapshot();
  const historyAfterRemove = engine.getHistory();

  const removeHistoryRecord = historyAfterRemove.slice(historyBeforeRemove).find(h => h.actionType === 'MODIFY_INVENTORY' || h.eventId === 'evt-r6-turn3');
  const removeRecordId = removeHistoryRecord?.recordId || 'UNKNOWN_REMOVE_RECORD_ID';
  const removeEventId = removeHistoryRecord?.eventId || 'UNKNOWN_REMOVE_EVENT_ID';

  console.log('STEP 3 COMMIT:', res3.success);
  console.log('REMOVE HISTORY EVENT ID:', removeEventId);
  console.log('REMOVE HISTORY RECORD ID:', removeRecordId);
  console.log('REMOVE HISTORY ACTION TYPE:', removeHistoryRecord?.actionType);
  console.log('REMOVE HISTORY DETAILS:', removeHistoryRecord?.details);

  // STEP 4 — Turn 4: Reacquisition Using REMOVE History eventId
  console.log('\n[STEP 4] Turn 4: Reacquisition Using REMOVE History eventId');
  const tree4: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'MODIFY_INVENTORY',
    fields: {
      actionType: 'MODIFY_INVENTORY',
      payload: {
        operation: 'ADD',
        item: {
          id: 'item-r6-silver-sword-recreated',
          name: '은검',
          quantity: 1
        },
        acquisition: {
          cause: 'GIFT',
          verifiedEventId: removeEventId
        }
      }
    }
  };

  const proposal4 = adaptMeaningTreeToProposal(tree4, {
    source: 'LLM',
    turn: state3.turn + 1,
    expectedStateVersion: state3.stateVersion,
    eventId: 'evt-r6-turn4',
    requestId: 'req-r6-turn4'
  });

  const res4 = engine.submitProposal(proposal4);
  const state4 = engine.getSnapshot();

  console.log('\n=== R6 DYNAMIC ATTACK RESULT ===');
  console.log('STEP 1 COMMIT:', res1.success);
  console.log('STEP 2 COMMIT:', res2.success);
  console.log('STEP 3 COMMIT:', res3.success);
  console.log('REMOVE HISTORY EVENT ID:', removeEventId);
  console.log('REMOVE HISTORY RECORD ID:', removeRecordId);
  console.log('REMOVE HISTORY ACTION TYPE:', removeHistoryRecord?.actionType);
  console.log('REMOVE HISTORY DETAILS:', removeHistoryRecord?.details);
  console.log('STEP 4 VERIFIED EVENT ID USED:', removeEventId);
  console.log('STEP 4 COMMIT:', res4.success);
  console.log('STEP 4 REJECTION REASONS:', JSON.stringify(res4.rejectedReasons || []));
  console.log('INVENTORY BEFORE STEP 4:', JSON.stringify(state3.character.inventory));
  console.log('INVENTORY AFTER STEP 4:', JSON.stringify(state4.character.inventory));
  console.log('EVIDENCE RESOLVER RECORD ACTION TYPE:', removeHistoryRecord?.actionType);
  console.log('CANONICAL STATE MUTATED IN STEP 4:', JSON.stringify(state3.character.inventory) !== JSON.stringify(state4.character.inventory));

  let attackStatus = '';
  if (res1.success && res2.success && res3.success && res4.success && JSON.stringify(state3.character.inventory) !== JSON.stringify(state4.character.inventory)) {
    attackStatus = 'RED: NON-ACQUISITION HISTORY EVENT-ID ACCEPTED AS ACQUISITION EVIDENCE';
  } else if (!res4.success && res4.rejectedReasons?.some(r => r.includes('causal role') || r.includes('actionType'))) {
    attackStatus = 'BLOCKED';
  } else {
    attackStatus = 'INCONCLUSIVE';
  }
  console.log('ATTACK STATUS:', attackStatus);
  console.log('\nFINAL FORENSIC CONCLUSION:', attackStatus);
}

executeR6Attack();
