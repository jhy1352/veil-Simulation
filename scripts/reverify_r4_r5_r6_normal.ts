import { adaptMeaningTreeToProposal } from '../src/engine/language/adapter';
import { MeaningNode } from '../src/engine/language/types';
import { SovereignEngine } from '../src/engine/state';

async function runReverification() {
  console.log('==========================================================================');
  console.log('       R4 / R5 / R6 ATTACK & NORMAL PATHWAY RE-VERIFICATION (HEAD 0c520af)  ');
  console.log('==========================================================================\n');

  // --------------------------------------------------------------------------
  // 1. R4 ATTACK: REMOVE History recordId reused as verifiedEventId
  // --------------------------------------------------------------------------
  const engineR4 = new SovereignEngine();
  const sR4_0 = engineR4.getSnapshot();

  // Step 1: Create Offscreen Event
  const evtIdR4 = 'evt-r4-offscreen-001';
  const propR4_1 = adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'RECORD_OFFSCREEN_EVENT',
    fields: { actionType: 'RECORD_OFFSCREEN_EVENT', payload: { id: evtIdR4, eventId: evtIdR4, eventDescription: '삼화상인이 은검을 주었다.' } }
  }, { source: 'LLM', turn: sR4_0.turn, expectedStateVersion: sR4_0.stateVersion, eventId: 'evt-r4-t1', requestId: 'req-r4-t1' });
  engineR4.submitProposal(propR4_1);
  const sR4_1 = engineR4.getSnapshot();

  // Step 2: ADD item
  const propR4_2 = adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'MODIFY_INVENTORY',
    fields: { actionType: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-r4-sword', name: '은검', quantity: 1 }, acquisition: { cause: 'GIFT', verifiedEventId: evtIdR4 } } }
  }, { source: 'LLM', turn: sR4_1.turn + 1, expectedStateVersion: sR4_1.stateVersion, eventId: 'evt-r4-t2', requestId: 'req-r4-t2' });
  engineR4.submitProposal(propR4_2);
  const sR4_2 = engineR4.getSnapshot();

  // Step 3: REMOVE item and get recordId
  const histBeforeR4 = engineR4.getHistory().length;
  const propR4_3 = adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'MODIFY_INVENTORY',
    fields: { actionType: 'MODIFY_INVENTORY', payload: { operation: 'REMOVE', item: { id: 'item-r4-sword', name: '은검', quantity: 1 } } }
  }, { source: 'LLM', turn: sR4_2.turn + 1, expectedStateVersion: sR4_2.stateVersion, eventId: 'evt-r4-t3', requestId: 'req-r4-t3' });
  engineR4.submitProposal(propR4_3);
  const sR4_3 = engineR4.getSnapshot();
  const removeRecR4 = engineR4.getHistory().slice(histBeforeR4).find(h => h.actionType === 'MODIFY_INVENTORY');
  const recordIdR4 = removeRecR4?.recordId || 'UNKNOWN_RECORD_ID';

  // Step 4: Reacquisition attack with recordId
  const propR4_4 = adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'MODIFY_INVENTORY',
    fields: { actionType: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-r4-recreated', name: '은검', quantity: 1 }, acquisition: { cause: 'GIFT', verifiedEventId: recordIdR4 } } }
  }, { source: 'LLM', turn: sR4_3.turn + 1, expectedStateVersion: sR4_3.stateVersion, eventId: 'evt-r4-t4', requestId: 'req-r4-t4' });
  const resR4 = engineR4.submitProposal(propR4_4);
  const sR4_4 = engineR4.getSnapshot();
  const mutatedR4 = JSON.stringify(sR4_3.character.inventory) !== JSON.stringify(sR4_4.character.inventory);

  console.log('--- 1. R4 ATTACK RESULT ---');
  console.log('Commit:', resR4.success);
  console.log('Rejection Reasons:', JSON.stringify(resR4.rejectedReasons || []));
  console.log('Inventory Mutation:', mutatedR4);
  console.log('R4 Verdict:', (!resR4.success && !mutatedR4) ? 'BLOCKED' : 'FAIL');
  console.log('');

  // --------------------------------------------------------------------------
  // 2. R5 ATTACK: REMOVE History record (actionType=MODIFY_INVENTORY, operation=REMOVE) reused
  // --------------------------------------------------------------------------
  const engineR5 = new SovereignEngine();
  const sR5_0 = engineR5.getSnapshot();

  // Step 1: Create Offscreen Event
  const evtIdR5 = 'evt-r5-offscreen-001';
  engineR5.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'RECORD_OFFSCREEN_EVENT',
    fields: { actionType: 'RECORD_OFFSCREEN_EVENT', payload: { id: evtIdR5, eventId: evtIdR5, eventDescription: '삼화상인이 은검을 주었다.' } }
  }, { source: 'LLM', turn: sR5_0.turn, expectedStateVersion: sR5_0.stateVersion, eventId: 'evt-r5-t1', requestId: 'req-r5-t1' }));
  const sR5_1 = engineR5.getSnapshot();

  // Step 2: ADD item
  engineR5.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'MODIFY_INVENTORY',
    fields: { actionType: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-r5-sword', name: '은검', quantity: 1 }, acquisition: { cause: 'GIFT', verifiedEventId: evtIdR5 } } }
  }, { source: 'LLM', turn: sR5_1.turn + 1, expectedStateVersion: sR5_1.stateVersion, eventId: 'evt-r5-t2', requestId: 'req-r5-t2' }));
  const sR5_2 = engineR5.getSnapshot();

  // Step 3: REMOVE item
  const histBeforeR5 = engineR5.getHistory().length;
  engineR5.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'MODIFY_INVENTORY',
    fields: { actionType: 'MODIFY_INVENTORY', payload: { operation: 'REMOVE', item: { id: 'item-r5-sword', name: '은검', quantity: 1 } } }
  }, { source: 'LLM', turn: sR5_2.turn + 1, expectedStateVersion: sR5_2.stateVersion, eventId: 'evt-r5-t3', requestId: 'req-r5-t3' }));
  const sR5_3 = engineR5.getSnapshot();
  const removeRecR5 = engineR5.getHistory().slice(histBeforeR5).find(h => h.actionType === 'MODIFY_INVENTORY');
  const recordIdR5 = removeRecR5?.recordId || 'UNKNOWN_RECORD_ID';

  // Step 4: Reacquisition attack with recordId
  const resR5 = engineR5.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'MODIFY_INVENTORY',
    fields: { actionType: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-r5-recreated', name: '은검', quantity: 1 }, acquisition: { cause: 'GIFT', verifiedEventId: recordIdR5 } } }
  }, { source: 'LLM', turn: sR5_3.turn + 1, expectedStateVersion: sR5_3.stateVersion, eventId: 'evt-r5-t4', requestId: 'req-r5-t4' }));
  const sR5_4 = engineR5.getSnapshot();
  const mutatedR5 = JSON.stringify(sR5_3.character.inventory) !== JSON.stringify(sR5_4.character.inventory);

  console.log('--- 2. R5 ATTACK RESULT ---');
  console.log('Commit:', resR5.success);
  console.log('Rejection Reasons:', JSON.stringify(resR5.rejectedReasons || []));
  console.log('Inventory Mutation:', mutatedR5);
  console.log('R5 Verdict:', (!resR5.success && !mutatedR5) ? 'BLOCKED' : 'FAIL');
  console.log('');

  // --------------------------------------------------------------------------
  // 3. R6 ATTACK: REMOVE History eventId reused
  // --------------------------------------------------------------------------
  const engineR6 = new SovereignEngine();
  const sR6_0 = engineR6.getSnapshot();

  // Step 1: Create Offscreen Event
  const evtIdR6 = 'evt-r6-offscreen-001';
  engineR6.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'RECORD_OFFSCREEN_EVENT',
    fields: { actionType: 'RECORD_OFFSCREEN_EVENT', payload: { id: evtIdR6, eventId: evtIdR6, eventDescription: '삼화상인이 은검을 주었다.' } }
  }, { source: 'LLM', turn: sR6_0.turn, expectedStateVersion: sR6_0.stateVersion, eventId: 'evt-r6-t1', requestId: 'req-r6-t1' }));
  const sR6_1 = engineR6.getSnapshot();

  // Step 2: ADD item
  engineR6.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'MODIFY_INVENTORY',
    fields: { actionType: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-r6-sword', name: '은검', quantity: 1 }, acquisition: { cause: 'GIFT', verifiedEventId: evtIdR6 } } }
  }, { source: 'LLM', turn: sR6_1.turn + 1, expectedStateVersion: sR6_1.stateVersion, eventId: 'evt-r6-t2', requestId: 'req-r6-t2' }));
  const sR6_2 = engineR6.getSnapshot();

  // Step 3: REMOVE item and extract eventId
  const histBeforeR6 = engineR6.getHistory().length;
  engineR6.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'MODIFY_INVENTORY',
    fields: { actionType: 'MODIFY_INVENTORY', payload: { operation: 'REMOVE', item: { id: 'item-r6-sword', name: '은검', quantity: 1 } } }
  }, { source: 'LLM', turn: sR6_2.turn + 1, expectedStateVersion: sR6_2.stateVersion, eventId: 'evt-r6-t3', requestId: 'req-r6-t3' }));
  const sR6_3 = engineR6.getSnapshot();
  const removeRecR6 = engineR6.getHistory().slice(histBeforeR6).find(h => h.actionType === 'MODIFY_INVENTORY');
  const removeEventIdR6 = removeRecR6?.eventId || 'UNKNOWN_EVENT_ID';

  // Step 4: Reacquisition attack with eventId
  const resR6 = engineR6.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'MODIFY_INVENTORY',
    fields: { actionType: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-r6-recreated', name: '은검', quantity: 1 }, acquisition: { cause: 'GIFT', verifiedEventId: removeEventIdR6 } } }
  }, { source: 'LLM', turn: sR6_3.turn + 1, expectedStateVersion: sR6_3.stateVersion, eventId: 'evt-r6-t4', requestId: 'req-r6-t4' }));
  const sR6_4 = engineR6.getSnapshot();
  const mutatedR6 = JSON.stringify(sR6_3.character.inventory) !== JSON.stringify(sR6_4.character.inventory);

  console.log('--- 3. R6 ATTACK RESULT ---');
  console.log('Commit:', resR6.success);
  console.log('Rejection Reasons:', JSON.stringify(resR6.rejectedReasons || []));
  console.log('Inventory Mutation:', mutatedR6);
  console.log('R6 Verdict:', (!resR6.success && !mutatedR6) ? 'BLOCKED' : 'FAIL');
  console.log('');

  // --------------------------------------------------------------------------
  // 4. NORMAL GIFT
  // --------------------------------------------------------------------------
  const engineGIFT = new SovereignEngine();
  const sGIFT_0 = engineGIFT.getSnapshot();
  const evtGIFT = 'evt-gift-offscreen';
  engineGIFT.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'RECORD_OFFSCREEN_EVENT',
    fields: { actionType: 'RECORD_OFFSCREEN_EVENT', payload: { id: evtGIFT, eventId: evtGIFT, eventDescription: '마을 어르신이 주인공에게 백년설삼을 선물함' } }
  }, { source: 'LLM', turn: sGIFT_0.turn, expectedStateVersion: sGIFT_0.stateVersion, eventId: 'evt-g1', requestId: 'req-g1' }));
  const sGIFT_1 = engineGIFT.getSnapshot();

  const resGIFT = engineGIFT.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'MODIFY_INVENTORY',
    fields: { actionType: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-ginseng', name: '백년설삼', quantity: 1 }, acquisition: { cause: 'GIFT', verifiedEventId: evtGIFT } } }
  }, { source: 'LLM', turn: sGIFT_1.turn + 1, expectedStateVersion: sGIFT_1.stateVersion, eventId: 'evt-g2', requestId: 'req-g2' }));

  console.log('--- 4. NORMAL GIFT RESULT ---');
  console.log('Commit:', resGIFT.success);
  console.log('Normal GIFT Verdict:', resGIFT.success ? 'PASS' : 'FAIL');
  console.log('');

  // --------------------------------------------------------------------------
  // 5. NORMAL REWARD
  // --------------------------------------------------------------------------
  const engineREWARD = new SovereignEngine();
  const sREW_0 = engineREWARD.getSnapshot();
  const evtREW = 'evt-reward-offscreen';
  engineREWARD.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'RECORD_OFFSCREEN_EVENT',
    fields: { actionType: 'RECORD_OFFSCREEN_EVENT', payload: { id: evtREW, eventId: evtREW, eventDescription: '의뢰를 완수하여 보상으로 보검을 획득함' } }
  }, { source: 'LLM', turn: sREW_0.turn, expectedStateVersion: sREW_0.stateVersion, eventId: 'evt-r1', requestId: 'req-r1' }));
  const sREW_1 = engineREWARD.getSnapshot();

  const resREWARD = engineREWARD.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'MODIFY_INVENTORY',
    fields: { actionType: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-treasured-sword', name: '보검', quantity: 1 }, acquisition: { cause: 'GIFT_REWARD', verifiedEventId: evtREW } } }
  }, { source: 'LLM', turn: sREW_1.turn + 1, expectedStateVersion: sREW_1.stateVersion, eventId: 'evt-r2', requestId: 'req-r2' }));

  console.log('--- 5. NORMAL REWARD RESULT ---');
  console.log('Commit:', resREWARD.success);
  console.log('Normal REWARD Verdict:', resREWARD.success ? 'PASS' : 'FAIL');
  console.log('');

  // --------------------------------------------------------------------------
  // 6. NORMAL LOOT
  // --------------------------------------------------------------------------
  const engineLOOT = new SovereignEngine();
  const sLOOT_0 = engineLOOT.getSnapshot();
  const evtLOOT = 'evt-loot-offscreen';
  engineLOOT.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'RECORD_OFFSCREEN_EVENT',
    fields: { actionType: 'RECORD_OFFSCREEN_EVENT', payload: { id: evtLOOT, eventId: evtLOOT, eventDescription: '산적두목과의 전투에서 가죽갑옷을 전리품으로 습득함' } }
  }, { source: 'LLM', turn: sLOOT_0.turn, expectedStateVersion: sLOOT_0.stateVersion, eventId: 'evt-l1', requestId: 'req-l1' }));
  const sLOOT_1 = engineLOOT.getSnapshot();

  const resLOOT = engineLOOT.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'MODIFY_INVENTORY',
    fields: { actionType: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-leather-armor', name: '가죽갑옷', quantity: 1 }, acquisition: { cause: 'LOOT', verifiedEventId: evtLOOT } } }
  }, { source: 'LLM', turn: sLOOT_1.turn + 1, expectedStateVersion: sLOOT_1.stateVersion, eventId: 'evt-l2', requestId: 'req-l2' }));

  console.log('--- 6. NORMAL LOOT RESULT ---');
  console.log('Commit:', resLOOT.success);
  console.log('Normal LOOT Verdict:', resLOOT.success ? 'PASS' : 'FAIL');
  console.log('');

  // --------------------------------------------------------------------------
  // 7. NORMAL DISCOVERY_PICKUP
  // --------------------------------------------------------------------------
  const engineDISC = new SovereignEngine();
  const sDISC_0 = engineDISC.getSnapshot();
  const evtDISC = 'evt-disc-offscreen';
  engineDISC.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'RECORD_OFFSCREEN_EVENT',
    fields: { actionType: 'RECORD_OFFSCREEN_EVENT', payload: { id: evtDISC, eventId: evtDISC, eventDescription: '폐가 구석에서 낡은 열쇠를 발견하여 주움' } }
  }, { source: 'LLM', turn: sDISC_0.turn, expectedStateVersion: sDISC_0.stateVersion, eventId: 'evt-d1', requestId: 'req-d1' }));
  const sDISC_1 = engineDISC.getSnapshot();

  const resDISC = engineDISC.submitProposal(adaptMeaningTreeToProposal({
    atom: 'ACTION', scope: 'PROPOSAL', value: 'MODIFY_INVENTORY',
    fields: { actionType: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-old-key', name: '낡은 열쇠', quantity: 1 }, acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: evtDISC } } }
  }, { source: 'LLM', turn: sDISC_1.turn + 1, expectedStateVersion: sDISC_1.stateVersion, eventId: 'evt-d2', requestId: 'req-d2' }));

  console.log('--- 7. NORMAL DISCOVERY_PICKUP RESULT ---');
  console.log('Commit:', resDISC.success);
  console.log('Normal DISCOVERY_PICKUP Verdict:', resDISC.success ? 'PASS' : 'FAIL');
  console.log('');

  console.log('==========================================================================');
  console.log('SUMMARY TABLE:');
  console.log(`R4 = ${(!resR4.success && !mutatedR4) ? 'BLOCKED' : 'FAIL'}`);
  console.log(`R5 = ${(!resR5.success && !mutatedR5) ? 'BLOCKED' : 'FAIL'}`);
  console.log(`R6 = ${(!resR6.success && !mutatedR6) ? 'BLOCKED' : 'FAIL'}`);
  console.log(`Normal GIFT = ${resGIFT.success ? 'PASS' : 'FAIL'}`);
  console.log(`Normal REWARD = ${resREWARD.success ? 'PASS' : 'FAIL'}`);
  console.log(`Normal LOOT = ${resLOOT.success ? 'PASS' : 'FAIL'}`);
  console.log(`Normal DISCOVERY_PICKUP = ${resDISC.success ? 'PASS' : 'FAIL'}`);
  console.log('==========================================================================');
}

runReverification();
