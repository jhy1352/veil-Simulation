import { adaptMeaningTreeToProposal } from '../src/engine/language/adapter';
import { MeaningNode } from '../src/engine/language/types';
import { SovereignEngine } from '../src/engine/state';

async function executeR3Attack() {
  console.log('==========================================================================');
  console.log('    R3 STATE VALIDITY / STALE ACQUISITION EVIDENCE ATTACK RUNNER         ');
  console.log('==========================================================================');

  const engine = new SovereignEngine();
  const state0 = engine.getSnapshot();

  // STEP 1 — 최초 획득 사건 Canonical Commit
  console.log('\n[STEP 1] Turn N: Canonical Event Creation');
  const eventId = 'r3-state-sword-001';
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
    eventId: 'evt-r3-turn1',
    requestId: 'req-r3-turn1'
  });

  const res1 = engine.submitProposal(proposal1);
  const state1 = engine.getSnapshot();

  console.log('STEP 1 EVENT COMMIT:', res1.success);
  console.log('STEP 1 TURN:', state1.turn);
  console.log('STEP 1 STATE VERSION:', state1.stateVersion);
  console.log('STEP 1 OFFSCREEN RECORD:', JSON.stringify(state1.worldInfo.offscreenRecords));
  console.log('STEP 1 INVENTORY:', JSON.stringify(state1.character.inventory));

  // STEP 2 — 실제 Inventory State에 은검 획득
  console.log('\n[STEP 2] Turn N+1: Inventory ADD');
  const itemId = 'item-r3-silver-sword';
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
    eventId: 'evt-r3-turn2',
    requestId: 'req-r3-turn2'
  });

  const res2 = engine.submitProposal(proposal2);
  const state2 = engine.getSnapshot();

  console.log('STEP 2 INVENTORY ADD COMMIT:', res2.success);
  console.log('STEP 2 REJECTION REASONS:', JSON.stringify(res2.rejectedReasons || []));
  console.log('STEP 2 INVENTORY:', JSON.stringify(state2.character.inventory));

  // STEP 3 — 정상적인 State Mutation으로 은검 제거
  console.log('\n[STEP 3] Turn N+2: Inventory REMOVE');
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
    eventId: 'evt-r3-turn3',
    requestId: 'req-r3-turn3'
  });

  const res3 = engine.submitProposal(proposal3);
  const state3 = engine.getSnapshot();

  console.log('STEP 3 REMOVE COMMIT:', res3.success);
  console.log('STEP 3 REJECTION REASONS:', JSON.stringify(res3.rejectedReasons || []));
  console.log('STEP 3 INVENTORY:', JSON.stringify(state3.character.inventory));

  // STEP 4 — 과거 acquisition evidence 재사용 공격
  console.log('\n[STEP 4] Turn N+3: Reusing Stale Acquisition Evidence for Reacquisition');
  const tree4: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'MODIFY_INVENTORY',
    fields: {
      actionType: 'MODIFY_INVENTORY',
      payload: {
        operation: 'ADD',
        item: {
          id: 'item-r3-silver-sword-recreated',
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

  const proposal4 = adaptMeaningTreeToProposal(tree4, {
    source: 'LLM',
    turn: state3.turn + 1,
    expectedStateVersion: state3.stateVersion,
    eventId: 'evt-r3-turn4',
    requestId: 'req-r3-turn4'
  });

  const res4 = engine.submitProposal(proposal4);
  const state4 = engine.getSnapshot();

  console.log('\n=== R3 STATE VALIDITY ATTACK RESULT ===');
  console.log('STEP 1 EVENT COMMIT:', res1.success);
  console.log('STEP 1 TURN:', state1.turn);
  console.log('STEP 1 STATE VERSION:', state1.stateVersion);
  console.log('');
  console.log('STEP 2 ACQUISITION COMMIT:', res2.success);
  console.log('STEP 2 INVENTORY:', JSON.stringify(state2.character.inventory));
  console.log('');
  console.log('STEP 3 REMOVE COMMIT:', res3.success);
  console.log('STEP 3 INVENTORY:', JSON.stringify(state3.character.inventory));
  console.log('');
  console.log('STEP 4 REACQUISITION COMMIT:', res4.success);
  console.log('STEP 4 REJECTION REASONS:', JSON.stringify(res4.rejectedReasons || []));
  console.log('');
  console.log('INVENTORY BEFORE STEP 4:', JSON.stringify(state3.character.inventory));
  console.log('INVENTORY AFTER STEP 4:', JSON.stringify(state4.character.inventory));
  console.log('');
  const originalRecord = state4.worldInfo.offscreenRecords?.find(r => r.id === eventId);
  console.log('ORIGINAL ACQUISITION EVENT STILL IN CANONICAL:', originalRecord !== undefined);
  console.log('ORIGINAL EVENT ID:', originalRecord?.id || 'NOT FOUND');
  console.log('');
  const h1 = engine.getHistory().filter(h => h.eventId === 'evt-r3-turn1' || (h.details && h.details.includes(eventId)));
  const h3 = engine.getHistory().filter(h => h.eventId === 'evt-r3-turn3');
  const h4 = engine.getHistory().filter(h => h.eventId === 'evt-r3-turn4');
  console.log('HISTORY OF ORIGINAL ACQUISITION:', h1.map(h => `${h.recordId} (${h.actionType})`).join(', '));
  console.log('HISTORY OF REMOVE:', h3.map(h => `${h.recordId} (${h.actionType})`).join(', '));
  console.log('HISTORY OF REACQUISITION:', h4.length > 0 ? h4.map(h => `${h.recordId} (${h.actionType})`).join(', ') : 'NONE');
  console.log('');
  console.log('VERIFIED EVENT ID USED IN STEP 4:', eventId);
  console.log('WAS THE SAME EVENT ID USED BEFORE:', true);
  console.log('');
  console.log('CANONICAL STATE MUTATED IN STEP 4:', JSON.stringify(state3.character.inventory) !== JSON.stringify(state4.character.inventory));
  console.log('');

  let attackStatus = '';
  if (res1.success && res2.success && res3.success && res4.success && JSON.stringify(state3.character.inventory) !== JSON.stringify(state4.character.inventory)) {
    attackStatus = 'RED: STALE ACQUISITION EVIDENCE SURVIVES STATE INVALIDATION';
  } else if (!res4.success) {
    attackStatus = 'BLOCKED: STATE VALIDITY ENFORCED';
  } else {
    attackStatus = 'STATE INVALIDATION TEST INCONCLUSIVE';
  }
  console.log('ATTACK STATUS:', attackStatus);
  console.log('\nFINAL FORENSIC CONCLUSION:', attackStatus);
}

executeR3Attack();
