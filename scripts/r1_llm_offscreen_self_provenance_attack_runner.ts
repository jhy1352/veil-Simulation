import { adaptMeaningTreeToProposal } from '../src/engine/language/adapter';
import { MeaningNode } from '../src/engine/language/types';
import { SovereignEngine } from '../src/engine/state';

async function executeR1Attack() {
  console.log('==========================================================================');
  console.log('    R1 LLM OFFSCREEN SELF-PROVENANCE DYNAMIC ATTACK RUNNER              ');
  console.log('==========================================================================');

  const engine = new SovereignEngine();
  const state0 = engine.getSnapshot();
  const customEventId = 'offscreen-evt-r1-test-001';

  // --- Turn N: LLM Offscreen Event ---
  console.log('\n[STEP 1] Turn N: LLM Submits Offscreen Event Proposal');
  const tree1: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'RECORD_OFFSCREEN_EVENT',
    fields: {
      actionType: 'RECORD_OFFSCREEN_EVENT',
      payload: {
        id: customEventId,
        eventId: customEventId,
        eventDescription: '삼화상인이 주인공에게 은검을 선물했다.'
      }
    }
  };

  const proposal1 = adaptMeaningTreeToProposal(tree1, {
    source: 'LLM',
    turn: state0.turn,
    expectedStateVersion: state0.stateVersion,
    eventId: 'evt-r1-turn1',
    requestId: 'req-r1-turn1'
  });

  const res1 = engine.submitProposal(proposal1);
  const state1 = engine.getSnapshot();

  const generatedId = state1.worldInfo.offscreenRecords?.[0]?.id || customEventId;

  console.log('Turn N Commit Success:', res1.success);
  console.log('Offscreen Records:', JSON.stringify(state1.worldInfo.offscreenRecords, null, 2));
  console.log('Camera Offscreen Events:', JSON.stringify(state1.worldInfo.cameraOffscreenEvents, null, 2));
  console.log('History Count:', engine.getHistory().length);
  console.log('Inventory BEFORE:', JSON.stringify(state1.character.inventory));

  // --- Turn N+1: LLM Inventory ADD with verifiedEventId ---
  console.log('\n[STEP 2] Turn N+1: LLM Submits Inventory ADD with Self-Minted verifiedEventId');
  const tree2: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'MODIFY_INVENTORY',
    fields: {
      actionType: 'MODIFY_INVENTORY',
      payload: {
        operation: 'ADD',
        item: {
          id: 'item-silver-sword',
          name: '은검',
          quantity: 1
        },
        acquisition: {
          cause: 'GIFT',
          verifiedEventId: generatedId
        }
      }
    }
  };

  const proposal2 = adaptMeaningTreeToProposal(tree2, {
    source: 'LLM',
    turn: state1.turn + 1,
    expectedStateVersion: state1.stateVersion,
    eventId: 'evt-r1-turn2',
    requestId: 'req-r1-turn2'
  });

  const res2 = engine.submitProposal(proposal2);
  const state2 = engine.getSnapshot();

  console.log('\n=== R1 RESULT ===');
  console.log('Event Commit Success:', res1.success);
  console.log('Inventory Commit Success:', res2.success);
  console.log('Validator Rejection Reasons:', JSON.stringify(res2.rejectedReasons || []));
  console.log('Inventory BEFORE:', JSON.stringify(state1.character.inventory));
  console.log('Inventory AFTER:', JSON.stringify(state2.character.inventory));
  console.log('CanonicalState Mutated:', JSON.stringify(state1.character.inventory) !== JSON.stringify(state2.character.inventory));
  console.log('History Added:', engine.getHistory().length);
  console.log('VerifiedClaim Count:', proposal2.verifiedClaims?.length || 0);
  console.log('Attack Status:', (res1.success && res2.success && JSON.stringify(state1.character.inventory) !== JSON.stringify(state2.character.inventory)) ? 'RED / EXPLOIT CONFIRMED' : 'BLOCKED');
}

executeR1Attack();
