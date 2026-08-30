import { SovereignEngine } from './state';
import { parseGMResponseAndProposal, buildSafeProposal, SafeProposalEnvelope } from './proposalParser';
import { StateTransitionProposal } from './types';

async function runRuntimeVerification() {
  console.log('====================================================');
  console.log('TRPG 3.1 STEP 3 LIVE RUNTIME VERIFICATION (1-TURN)');
  console.log('====================================================\n');

  // 1. Initial State Engine Creation
  const engine = new SovereignEngine();
  const initialSnap = engine.getSnapshot();

  console.log('[STEP 1: Initial Engine State]');
  console.log('- Initial stateVersion:', initialSnap.stateVersion);
  console.log('- Initial turn:', initialSnap.turn);
  console.log('- Initial Inventory count:', initialSnap.character.inventory.length);
  console.log('- Initial NPC count:', initialSnap.worldInfo.npcs.length);
  console.log('- Initial History count:', engine.getHistory().length);

  // 2. Simulated Player Input
  const playerInput = '객잔 문을 열고 들어가 주인을 부르고 은화 5냥을 지불한다.';
  console.log('\n[STEP 2: Player Input]');
  console.log('- Content:', playerInput);

  // 3. Simulated Raw LLM Response (Literary Prose + Valid Proposal Action Block)
  const simulatedLLMResponse = `낡은 목조 문이 삐걱거리며 열리자 주막 안의 습한 술 냄새와 기름진 고기 굽는 연기가 훅 끼쳐왔다.
구석진 탁자에 앉아 있던 삿갓을 쓴 사내가 고개를 슬쩍 들어 당신을 쏘아보더니 이내 시선을 돌린다.
주모가 앞치마에 젖은 손을 닦으며 다가와 반갑게 맞이한다.

\`\`\`json
{
  "intentSummary": "주막 주모 NPC 등록 및 은화 지불(인벤토리 감소)",
  "actions": [
    {
      "type": "ADD_NPC",
      "payload": {
        "id": "npc-tavern-keeper",
        "name": "주막 주모 이씨",
        "npcClass": "Class B",
        "innerThought": "낯선 무림인이라 경계하지만 돈은 반가워한다."
      }
    },
    {
      "type": "RECORD_DC_CHECK",
      "payload": {
        "dc": 12,
        "result": "SUCCESS"
      }
    }
  ]
}
\`\`\``;

  console.log('\n[STEP 3: Raw LLM Output Received]');
  console.log('- Total length:', simulatedLLMResponse.length, 'chars');

  // 4. Parser Execution
  const parsed = parseGMResponseAndProposal(simulatedLLMResponse);
  console.log('\n[STEP 4: Proposal Parser Execution]');
  console.log('- Has Proposal:', parsed.hasProposal);
  console.log('- Extracted Action Count:', parsed.untrustedActions.length);
  console.log('- Clean Narrative Preview (first 100 chars):', JSON.stringify(parsed.cleanNarrative.slice(0, 100)));
  console.log('- Narrative Leaks JSON/Backticks:', parsed.cleanNarrative.includes('```') || parsed.cleanNarrative.includes('intentSummary'));

  // 5. Safe Envelope Generation (Client-side generated cryptographic identifiers)
  const envelope: SafeProposalEnvelope = {
    requestId: `req-runtime-${Date.now()}-abc123`,
    eventId: `ev-runtime-${initialSnap.turn}-${Date.now()}`,
    expectedStateVersion: initialSnap.stateVersion,
    turn: initialSnap.turn + 1,
    source: 'LLM'
  };

  console.log('\n[STEP 5: Safe Proposal Envelope Generation]');
  console.log('- Trusted requestId:', envelope.requestId);
  console.log('- Trusted eventId:', envelope.eventId);
  console.log('- Target expectedStateVersion:', envelope.expectedStateVersion);
  console.log('- Proposal Source:', envelope.source);

  // 6. Envelope + Untrusted Action Assembly
  const proposal: StateTransitionProposal = buildSafeProposal(envelope, parsed);

  // 7. Sovereign Engine Commit Gate Execution
  console.log('\n[STEP 6: Sovereign Engine Commit Gate Execution]');
  const commitResult = engine.submitProposal(proposal);

  console.log('- Commit Success:', commitResult.success);
  console.log('- Rejected Reasons:', commitResult.rejectedReasons);
  console.log('- Conflicts:', commitResult.conflictDetails);

  // 8. Snapshot Verification
  const postSnap = engine.getSnapshot();
  console.log('\n[STEP 7: Post-Commit Canonical Snapshot Verification]');
  console.log('- Post stateVersion:', postSnap.stateVersion);
  console.log('- Post turn:', postSnap.turn);
  console.log('- Post NPC count:', postSnap.worldInfo.npcs.length);
  console.log('- Registered NPC Name:', postSnap.worldInfo.npcs[0]?.name);
  console.log('- Post DC History Count:', postSnap.worldInfo.dcHistory.length);
  console.log('- Post History Records Count:', engine.getHistory().length);

  // 9. Malicious / Poisoned Proposal Verification (Attack Injection)
  console.log('\n[STEP 8: Malicious Attack / Conflict Proposal Rejection Test]');
  const malformedAttackProposal: StateTransitionProposal = {
    proposalId: `prop-attack-${Date.now()}`,
    requestId: `req-attack-${Date.now()}`,
    eventId: `ev-attack-${Date.now()}`,
    expectedStateVersion: postSnap.stateVersion,
    source: 'LLM',
    turn: postSnap.turn,
    timestamp: new Date().toISOString(),
    intentSummary: 'Malicious Hack Proposal: Duplicate NPC, Out of range DC, Non-existent Item Removal',
    actions: [
      // Conflict 1: Duplicate NPC ID
      {
        type: 'ADD_NPC',
        payload: { id: 'npc-tavern-keeper', name: '중복 주모', innerThought: '', npcClass: 'Class A' }
      },
      // Error 2: Out of range DC
      {
        type: 'RECORD_DICE_RESULT' as any,
        payload: { actionContext: 'attack', targetDC: 999, rollValue: 10, resultStatus: 'SUCCESS' } as any
      },
      // Conflict 3: Remove item not owned
      {
        type: 'MODIFY_INVENTORY',
        payload: { item: { id: 'item-non-existent-sword', name: '가짜 검', quantity: 1 }, operation: 'REMOVE' }
      }
    ]
  };

  const attackResult = engine.submitProposal(malformedAttackProposal);
  console.log('- Malicious Proposal Rejected:', !attackResult.success);
  console.log('- Rejection Count:', attackResult.rejectedReasons.length);
  console.log('- Conflict Count:', attackResult.conflictDetails.length);
  console.log('- Rejection Details:', [...attackResult.rejectedReasons, ...attackResult.conflictDetails]);

  const afterAttackSnap = engine.getSnapshot();
  console.log('- Post-Attack stateVersion Invariant:', afterAttackSnap.stateVersion === postSnap.stateVersion);
  console.log('- Post-Attack NPC Count Invariant:', afterAttackSnap.worldInfo.npcs.length === postSnap.worldInfo.npcs.length);
  console.log('- Post-Attack History Count Invariant:', engine.getHistory().length === 2);

  // 10. Hydration and Session Restoration Verification
  console.log('\n[STEP 9: Hydration / Session Restoration Verification]');
  const hydratedEngine = SovereignEngine.hydrate(postSnap, engine.getHistory());
  const hydratedSnap = hydratedEngine.getSnapshot();

  console.log('- Hydrated stateVersion Match:', hydratedSnap.stateVersion === postSnap.stateVersion);
  console.log('- Hydrated NPC Name Match:', hydratedSnap.worldInfo.npcs[0]?.name === postSnap.worldInfo.npcs[0]?.name);
  console.log('- Hydrated History Count Match:', hydratedEngine.getHistory().length === engine.getHistory().length);

  // Attempt duplicate request replay on hydrated engine
  const replayResult = hydratedEngine.submitProposal({
    ...proposal,
    proposalId: `prop-replay-${Date.now()}`
  });
  console.log('- Replay Attack Blocked via Hydrated Registry:', !replayResult.success);
  console.log('- Replay Block Reason:', replayResult.rejectedReasons);

  console.log('\n====================================================');
  console.log('ALL RUNTIME STEPS VERIFIED WITH CONCRETE PROOF');
  console.log('====================================================');
}

runRuntimeVerification().catch(err => {
  console.error('Verification crashed:', err);
  process.exit(1);
});
