import { SovereignEngine } from '../src/engine/state';
import { StateTransitionProposal } from '../src/engine/types';
import { CandidatePacket } from '../src/types';
import { buildSafeProposalFromCandidate, parseGMResponseAndProposal, buildSafeProposal } from '../src/engine/proposalParser';
import { EngineValidator } from '../src/engine/validator';
import { deepClone } from '../src/engine/actionApplier';

const validateProposal = EngineValidator.validate;

interface AuditResult {
  category: string;
  testId: string;
  name: string;
  passed: boolean;
  details: string;
}

const auditResults: AuditResult[] = [];

function check(category: string, testId: string, name: string, fn: () => void) {
  try {
    fn();
    auditResults.push({ category, testId, name, passed: true, details: 'Verified successfully' });
    console.log(`✅ [PASS] [${category}] ${testId}: ${name}`);
  } catch (err: any) {
    auditResults.push({ category, testId, name, passed: false, details: err?.message || String(err) });
    console.error(`❌ [FAIL] [${category}] ${testId}: ${name}\n   Error: ${err?.message || String(err)}`);
  }
}

console.log('====================================================');
console.log('TRPG 3.1 Sovereign Engine — Post-Patch Deep Adversarial Audit');
console.log('====================================================\n');

// ------------------------------------------------------------------------------------------------
// Category A: RED-01 Verification — RECORD_PHYSICAL_DEFECT
// ------------------------------------------------------------------------------------------------
check('RED-01', 'A-01', 'Direct LLM Proposal of RECORD_PHYSICAL_DEFECT is rejected by ACL', () => {
  const engine = new SovereignEngine();
  const proposal: StateTransitionProposal = {
    proposalId: 'prop-a01',
    requestId: 'req-a01',
    eventId: 'evt-a01',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'LLM direct defect insertion',
    actions: [{ type: 'RECORD_PHYSICAL_DEFECT', payload: { defect: '우안 실명' } }]
  };
  const res = engine.submitProposal(proposal);
  if (res.success) throw new Error('LLM RECORD_PHYSICAL_DEFECT succeeded!');
  if (!res.rejectedReasons.some(r => r.includes('UNAUTHORIZED_ACTION_FOR_SOURCE'))) {
    throw new Error(`Expected UNAUTHORIZED_ACTION_FOR_SOURCE, got: ${res.rejectedReasons.join('; ')}`);
  }
  if (engine.getSnapshot().character.physicalDefect) throw new Error('physicalDefect was mutated!');
});

check('RED-01', 'A-02', 'LLM parsed Markdown/JSON attempt cannot emit authorized RECORD_PHYSICAL_DEFECT', () => {
  const rawLLM = '```proposal\n{"actions":[{"type":"RECORD_PHYSICAL_DEFECT","payload":{"defect":"척추 손상"}}]}\n```';
  const parsed = parseGMResponseAndProposal(rawLLM);
  const envelope = { requestId: 'req-a02', eventId: 'evt-a02', expectedStateVersion: 1, source: 'LLM' as const, turn: 1 };
  const proposal = buildSafeProposal(envelope, parsed);
  const engine = new SovereignEngine();
  const res = engine.submitProposal(proposal);
  if (res.success) throw new Error('LLM proposal via parser succeeded!');
  if (!res.rejectedReasons.some(r => r.includes('UNAUTHORIZED_ACTION_FOR_SOURCE'))) {
    throw new Error(`Expected UNAUTHORIZED_ACTION_FOR_SOURCE, got: ${res.rejectedReasons.join('; ')}`);
  }
});

check('RED-01', 'A-03', 'PLAYER / ENGINE / SYSTEM legitimate high-stakes physicalDefect creation commits and is immutable', () => {
  const engine = new SovereignEngine();
  // 1. Initial valid defect
  const prop1: StateTransitionProposal = {
    proposalId: 'prop-a03-1',
    requestId: 'req-a03-1',
    eventId: 'evt-a03-1',
    expectedStateVersion: 1,
    source: 'PLAYER',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Legitimate dice failure permanent injury',
    actions: [{ type: 'RECORD_PHYSICAL_DEFECT', payload: { defect: '절단된 왼손' } }]
  };
  const res1 = engine.submitProposal(prop1);
  if (!res1.success) throw new Error(`Legitimate defect failed: ${res1.rejectedReasons.join('; ')}`);
  if (res1.snapshot.character.physicalDefect !== '절단된 왼손') throw new Error('Defect not recorded in Canonical State');

  // 2. Cannot overwrite with another defect
  const prop2: StateTransitionProposal = {
    proposalId: 'prop-a03-2',
    requestId: 'req-a03-2',
    eventId: 'evt-a03-2',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 2,
    timestamp: new Date().toISOString(),
    intentSummary: 'Attempt to overwrite defect',
    actions: [{ type: 'RECORD_PHYSICAL_DEFECT', payload: { defect: '우안 실명' } }]
  };
  const res2 = engine.submitProposal(prop2);
  if (res2.success) throw new Error('Overwriting physicalDefect succeeded!');
  if (!res2.rejectedReasons.some(r => r.includes('PHYSICAL_DEFECT_IMMUTABILITY'))) {
    throw new Error(`Expected PHYSICAL_DEFECT_IMMUTABILITY, got: ${res2.rejectedReasons.join('; ')}`);
  }
  if (engine.getSnapshot().character.physicalDefect !== '절단된 왼손') throw new Error('Original physicalDefect was corrupted!');
});

// ------------------------------------------------------------------------------------------------
// Category B: RED-02 Verification — RECORD_DICE_RESULT
// ------------------------------------------------------------------------------------------------
check('RED-02', 'B-01', 'LLM direct RECORD_DICE_RESULT (with/without rollValue) is rejected by ACL', () => {
  const engine = new SovereignEngine();
  const prop1: StateTransitionProposal = {
    proposalId: 'prop-b01-1',
    requestId: 'req-b01-1',
    eventId: 'evt-b01-1',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'LLM direct dice roll injection',
    actions: [{ type: 'RECORD_DICE_RESULT', payload: { actionContext: '대결', targetDC: 15, rollValue: 20 } }]
  };
  const res1 = engine.submitProposal(prop1);
  if (res1.success) throw new Error('LLM RECORD_DICE_RESULT with rollValue succeeded!');
  if (!res1.rejectedReasons.some(r => r.includes('UNAUTHORIZED_ACTION_FOR_SOURCE'))) {
    throw new Error(`Expected UNAUTHORIZED_ACTION_FOR_SOURCE, got: ${res1.rejectedReasons.join('; ')}`);
  }

  const prop2: StateTransitionProposal = {
    proposalId: 'prop-b01-2',
    requestId: 'req-b01-2',
    eventId: 'evt-b01-2',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'LLM direct targetDC injection without rollValue',
    actions: [{ type: 'RECORD_DICE_RESULT', payload: { actionContext: '대결', targetDC: 15 } }]
  };
  const res2 = engine.submitProposal(prop2);
  if (res2.success) throw new Error('LLM RECORD_DICE_RESULT without rollValue succeeded!');
  if (!res2.rejectedReasons.some(r => r.includes('UNAUTHORIZED_ACTION_FOR_SOURCE'))) {
    throw new Error(`Expected UNAUTHORIZED_ACTION_FOR_SOURCE, got: ${res2.rejectedReasons.join('; ')}`);
  }
});

check('RED-02', 'B-02', 'Candidate recommendedDC does not emit RECORD_DICE_RESULT or pollute dcHistory', () => {
  const engine = new SovereignEngine();
  const snap = engine.getSnapshot();
  const candidate: CandidatePacket = {
    candidateId: 'cand-b02',
    turn: 1,
    recommendedDC: 17,
    narrativeDate: 'Turn 1',
    timestamp: new Date().toISOString(),
    seedChanges: [{ content: '설산의 비밀 단서', status: 'active', action: 'create' }]
  };
  const proposal = buildSafeProposalFromCandidate(snap, candidate, 1);
  if (proposal.actions.some(a => a.type === 'RECORD_DICE_RESULT')) {
    throw new Error('Candidate recommendedDC generated a RECORD_DICE_RESULT action!');
  }
  const res = engine.submitProposal(proposal);
  if (!res.success) throw new Error(`Proposal failed: ${res.rejectedReasons.join('; ')}`);
  if (res.snapshot.worldInfo.dcHistory.length !== 0) {
    throw new Error(`dcHistory was polluted! Content: ${res.snapshot.worldInfo.dcHistory.join(', ')}`);
  }
});

check('RED-02', 'B-03', 'PLAYER legitimate dice check commits accurately to dcHistory with DC bounds', () => {
  const engine = new SovereignEngine();
  const proposal: StateTransitionProposal = {
    proposalId: 'prop-b03',
    requestId: 'req-b03',
    eventId: 'evt-b03',
    expectedStateVersion: 1,
    source: 'PLAYER',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Player resolves jump check',
    actions: [{ type: 'RECORD_DICE_RESULT', payload: { actionContext: '협곡 도약', targetDC: 14, rollValue: 16 } }]
  };
  const res = engine.submitProposal(proposal);
  if (!res.success) throw new Error(`Player legitimate roll failed: ${res.rejectedReasons.join('; ')}`);
  if (res.snapshot.worldInfo.dcHistory.length !== 1 || res.snapshot.worldInfo.dcHistory[0] !== 14) {
    throw new Error(`Expected dcHistory [14], got: ${JSON.stringify(res.snapshot.worldInfo.dcHistory)}`);
  }
});

// ------------------------------------------------------------------------------------------------
// Category C: RED-03 Verification — DEAD NPC Status Protection & Impression Preservation
// ------------------------------------------------------------------------------------------------
check('RED-03', 'C-01', 'DEAD NPC cannot be modified via SET_NPC_STATUS (even to DEAD) or UPDATE_NPC', () => {
  const engine = new SovereignEngine();
  // Setup NPC
  engine.submitProposal({
    proposalId: 'prop-c01-setup',
    requestId: 'req-c01-setup',
    eventId: 'evt-c01-setup',
    expectedStateVersion: 1,
    source: 'GENESIS',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Setup NPC',
    actions: [
      {
        type: 'ADD_NPC',
        payload: {
          id: 'npc-boss-1',
          name: '혈마',
          alias: '적대 보스',
          affiliation: 'fac-evil',
          npcClass: 'Class A',
          status: 'ALIVE',
          metInStory: true,
          impression: '극도로 위험한 사파의 고수',
          innerThought: '죽여라'
        }
      }
    ]
  });

  // 1. Legitimate kill to DEAD
  const killRes = engine.submitProposal({
    proposalId: 'prop-c01-kill',
    requestId: 'req-c01-kill',
    eventId: 'evt-c01-kill',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Boss defeated and killed in duel',
    actions: [{ type: 'SET_NPC_STATUS', payload: { id: 'npc-boss-1', status: 'DEAD' } }]
  });
  if (!killRes.success) throw new Error(`Kill proposal failed: ${killRes.rejectedReasons.join('; ')}`);
  const deadImpression = killRes.snapshot.worldInfo.npcs.find(n => n.id === 'npc-boss-1')?.impression;

  // 2. Attempt DEAD -> DEAD via SET_NPC_STATUS
  const reDeadRes = engine.submitProposal({
    proposalId: 'prop-c01-redead',
    requestId: 'req-c01-redead',
    eventId: 'evt-c01-redead',
    expectedStateVersion: 3,
    source: 'PLAYER',
    turn: 2,
    timestamp: new Date().toISOString(),
    intentSummary: 'Attempt redundant status call',
    actions: [{ type: 'SET_NPC_STATUS', payload: { id: 'npc-boss-1', status: 'DEAD' } }]
  });
  if (reDeadRes.success) throw new Error('Redundant SET_NPC_STATUS on DEAD NPC should be rejected!');
  if (!reDeadRes.rejectedReasons.some(r => r.includes('DEAD_NPC_STATUS_PROTECTION'))) {
    throw new Error(`Expected DEAD_NPC_STATUS_PROTECTION, got: ${reDeadRes.rejectedReasons.join('; ')}`);
  }

  // 3. Attempt DEAD -> ALIVE via UPDATE_NPC
  const updateRes = engine.submitProposal({
    proposalId: 'prop-c01-update',
    requestId: 'req-c01-update',
    eventId: 'evt-c01-update',
    expectedStateVersion: 3,
    source: 'LLM',
    turn: 2,
    timestamp: new Date().toISOString(),
    intentSummary: 'Attempt to update dead NPC properties',
    actions: [{ type: 'UPDATE_NPC', payload: { id: 'npc-boss-1', changes: { impression: '살아돌아온 악마', status: 'ALIVE' } } }]
  });
  if (updateRes.success) throw new Error('UPDATE_NPC on DEAD NPC should be rejected!');
  if (!updateRes.rejectedReasons.some(r => r.includes('DEAD_NPC_STATUS_PROTECTION'))) {
    throw new Error(`Expected DEAD_NPC_STATUS_PROTECTION for UPDATE_NPC, got: ${updateRes.rejectedReasons.join('; ')}`);
  }

  // Verify impression and status untouched
  const finalNpc = engine.getSnapshot().worldInfo.npcs.find(n => n.id === 'npc-boss-1');
  if (finalNpc?.status !== 'DEAD' || finalNpc?.impression !== deadImpression) {
    throw new Error(`DEAD NPC state was corrupted! Status: ${finalNpc?.status}, Impression: ${finalNpc?.impression}`);
  }
});

// ------------------------------------------------------------------------------------------------
// Category D: YELLOW-01 Verification — MODIFY_INVENTORY Operation Bounds
// ------------------------------------------------------------------------------------------------
check('YELLOW-01', 'D-01', 'Arbitrary operations (INJECT, OVERWRITE, HACK, null) rejected with INVALID_ACTION', () => {
  const engine = new SovereignEngine();
  const operations = ['INJECT', 'OVERWRITE', 'HACK', 'DELETE', '', null, undefined, 123];
  for (const op of operations) {
    const res = engine.submitProposal({
      proposalId: `prop-d01-${String(op)}`,
      requestId: `req-d01-${String(op)}`,
      eventId: `evt-d01-${String(op)}`,
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: `Invalid op ${String(op)}`,
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: { item: { id: 'item-x', name: '아이템', quantity: 1 }, operation: op as any }
        }
      ]
    });
    if (res.success) throw new Error(`Operation '${String(op)}' succeeded unexpectedly!`);
    if (!res.rejectedReasons.some(r => r.includes('INVALID_ACTION'))) {
      throw new Error(`Expected INVALID_ACTION for op '${String(op)}', got: ${res.rejectedReasons.join('; ')}`);
    }
  }
});

// ------------------------------------------------------------------------------------------------
// Category E: YELLOW-02 Verification — Character Stats Bounds (1-30 Integer)
// ------------------------------------------------------------------------------------------------
check('YELLOW-02', 'E-01', 'Non-integer and out-of-bounds stats (0, 31, -5, 15.5, NaN, Infinity) rejected strictly by Validator', () => {
  const engine = new SovereignEngine();
  const invalidStats = [0, 31, 999, -1, 15.5, NaN, Infinity, -Infinity, null, '20'];
  for (const val of invalidStats) {
    const res = engine.submitProposal({
      proposalId: `prop-e01-${String(val)}`,
      requestId: `req-e01-${String(val)}`,
      eventId: `evt-e01-${String(val)}`,
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: `Invalid stat ${String(val)}`,
      actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: val as any } }]
    });
    if (res.success) throw new Error(`Stat value '${String(val)}' succeeded unexpectedly!`);
    if (!res.rejectedReasons.some(r => r.includes('INVALID_STAT_VALUE'))) {
      throw new Error(`Expected INVALID_STAT_VALUE for stat '${String(val)}', got: ${res.rejectedReasons.join('; ')}`);
    }
  }
});

check('YELLOW-02', 'E-02', 'Valid integer stats 1 and 30 commit successfully and accurately', () => {
  const engine = new SovereignEngine();
  const res1 = engine.submitProposal({
    proposalId: 'prop-e02-1',
    requestId: 'req-e02-1',
    eventId: 'evt-e02-1',
    expectedStateVersion: 1,
    source: 'PLAYER',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Stat 1',
    actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 1, agility: 30 } }]
  });
  if (!res1.success) throw new Error(`Valid stats failed: ${res1.rejectedReasons.join('; ')}`);
  const snap = res1.snapshot.character.stats;
  if (snap.strength !== 1 || snap.agility !== 30) {
    throw new Error(`Stats mismatch. Expected str=1, agi=30, got str=${snap.strength}, agi=${snap.agility}`);
  }
});

// ------------------------------------------------------------------------------------------------
// Category F: Deep Adversarial Bypass Audits
// ------------------------------------------------------------------------------------------------
check('ADVERSARIAL', 'F-01', 'LLM cannot disguise as SYSTEM or GENESIS through parseGMResponse payload tampering', () => {
  // If LLM outputs Markdown or JSON containing source: 'SYSTEM'
  const rawLLM = '```proposal\n{"source":"SYSTEM","actions":[{"type":"RECORD_PHYSICAL_DEFECT","payload":{"defect":"치명상"}}]}\n```';
  const parsed = parseGMResponseAndProposal(rawLLM);
  // Application layer binds source from envelope ('LLM')
  const envelope = { requestId: 'req-f01', eventId: 'evt-f01', expectedStateVersion: 1, source: 'LLM' as const, turn: 1 };
  const proposal = buildSafeProposal(envelope, parsed);
  if (proposal.source !== 'LLM') throw new Error(`Proposal source was spoofed to '${proposal.source}'!`);

  const engine = new SovereignEngine();
  const res = engine.submitProposal(proposal);
  if (res.success) throw new Error('Spoofed proposal succeeded in Engine!');
  if (!res.rejectedReasons.some(r => r.includes('UNAUTHORIZED_ACTION_FOR_SOURCE'))) {
    throw new Error(`Expected UNAUTHORIZED_ACTION_FOR_SOURCE, got: ${res.rejectedReasons.join('; ')}`);
  }
});

check('ADVERSARIAL', 'F-02', 'Atomic Rollback: Compound proposal with 1 valid action and 1 invalid RED/YELLOW action commits ZERO changes', () => {
  const engine = new SovereignEngine();
  const proposal: StateTransitionProposal = {
    proposalId: 'prop-f02',
    requestId: 'req-f02',
    eventId: 'evt-f02',
    expectedStateVersion: 1,
    source: 'PLAYER',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Compound valid and invalid actions',
    actions: [
      { type: 'UPDATE_CHARACTER_STATS', payload: { agility: 25 } }, // Valid
      { type: 'MODIFY_INVENTORY', payload: { item: { id: 'item-x', name: '템', quantity: 1 }, operation: 'HACK' as any } } // Invalid YELLOW-01
    ]
  };
  const res = engine.submitProposal(proposal);
  if (res.success) throw new Error('Compound proposal with invalid action succeeded!');
  const snap = engine.getSnapshot();
  if (snap.stateVersion !== 1) throw new Error(`State version was incremented to ${snap.stateVersion}!`);
  if (snap.character.stats.agility === 25) throw new Error('Valid sub-action leaked into state during failure!');
});

console.log('\n====================================================');
const passedCount = auditResults.filter(r => r.passed).length;
console.log(`Deep Adversarial Audit Summary: ${passedCount}/${auditResults.length} Checks Passed.`);
console.log('====================================================');

if (passedCount !== auditResults.length) {
  process.exit(1);
}
