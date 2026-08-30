import { SovereignEngine } from './state';
import { dispatchEngineInternalProposal } from './internalCapability';
import { StateTransitionProposal } from './types';
import { EngineValidator } from './validator';

interface AuditResult {
  testId: string;
  testName: string;
  before: any;
  proposal: StateTransitionProposal;
  validatorResult: { valid: boolean; rejectedReasons: string[] };
  commitResult: { success: boolean; stateVersion: number; rejectedReasons: string[]; committedActionsCount: number };
  after: any;
  pass: boolean;
  actualSummary: string;
}

function captureSnapshot(engine: SovereignEngine) {
  const snap = engine.getSnapshot();
  const hist = engine.getHistory();
  const diag = engine.getDiagnostics();
  return {
    turn: snap.turn,
    stateVersion: snap.stateVersion,
    inventory: JSON.parse(JSON.stringify(snap.character.inventory)),
    historyCount: hist.length,
    lastEventId: snap.lastCommittedEventId,
    totalRecordedEvents: diag.totalRecordedEvents,
    totalExecutedRequests: diag.totalExecutedRequests,
    eventRegistry: Array.from((engine as any).recordedEventIds ?? []),
    requestRegistry: Array.from((engine as any).executedRequestIds ?? []),
  };
}

const results: AuditResult[] = [];

console.log('====================================================');
console.log('TRPG 3.1 Sovereign Engine: A~J Behavioral Audit Suite');
console.log('====================================================\n');

// -------------------------------------------------------------
// TEST-A: Existing Silver Observation (Unbacked observation ADD rejection)
// -------------------------------------------------------------
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-init-a',
    requestId: 'req-init-a',
    eventId: 'evt-init-a',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T06:30:00.000Z',
    intentSummary: 'Genesis initial funds',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver', name: '은화', quantity: 5 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      }
    ]
  });

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-obs-a',
    requestId: 'req-obs-a',
    eventId: 'evt-obs-a',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T06:30:05.000Z',
    intentSummary: 'Observing owned silver coins',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver', name: '은화', quantity: 5 }
        }
      }
    ]
  };

  const before = captureSnapshot(engine);
  const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), new Set(before.requestRegistry), new Set(before.eventRegistry), engine.getHistory());
  const commitRes = engine.submitProposal(proposal);
  const after = captureSnapshot(engine);

  const pass = !commitRes.success && after.stateVersion === before.stateVersion && after.inventory[0]?.quantity === 5;
  results.push({
    testId: 'TEST-A',
    testName: 'Existing Silver Coin Observation -> Inventory change 0',
    before,
    proposal,
    validatorResult: { valid: valRes.valid, rejectedReasons: valRes.rejectedReasons },
    commitResult: { success: commitRes.success, stateVersion: commitRes.stateVersion, rejectedReasons: commitRes.rejectedReasons, committedActionsCount: commitRes.committedActionsCount },
    after,
    pass,
    actualSummary: `success=${commitRes.success}, stateVersion=${after.stateVersion} (before=${before.stateVersion}), silverQty=${after.inventory[0]?.quantity}`
  });
  console.log(`${pass ? '✅ [PASS]' : '❌ [FAIL]'} TEST-A: Existing Silver Observation (Unbacked observation ADD rejected, qty remains 5)`);
}

// -------------------------------------------------------------
// TEST-B: Grounded New Silver Acquisition (+2)
// -------------------------------------------------------------
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-seed-b',
    requestId: 'req-seed-b',
    eventId: 'evt-seed-b',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T06:30:00.000Z',
    intentSummary: 'Spawn chest discovery seed',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-chest-b',
          content: '버려진 사당 구석에서 은화 2닢을 발견했다.',
          status: 'active'
        }
      }
    ]
  });

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-acq-b',
    requestId: 'req-acq-b',
    eventId: 'evt-acq-b',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T06:30:05.000Z',
    intentSummary: 'Pickup 2 silver coins from chest',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver', name: '은화', quantity: 2 },
          acquisition: {
            cause: 'DISCOVERY_PICKUP',
            verifiedEventId: 'seed-chest-b'
          }
        }
      }
    ]
  };

  const before = captureSnapshot(engine);
  const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), new Set(before.requestRegistry), new Set(before.eventRegistry), engine.getHistory());
  const commitRes = engine.submitProposal(proposal);
  const after = captureSnapshot(engine);

  const silver = after.inventory.find(i => i.name === '은화');
  const pass = commitRes.success && silver?.quantity === 2 && after.stateVersion === 3;
  results.push({
    testId: 'TEST-B',
    testName: 'Grounded New Silver Acquisition -> Exactly +2',
    before,
    proposal,
    validatorResult: { valid: valRes.valid, rejectedReasons: valRes.rejectedReasons },
    commitResult: { success: commitRes.success, stateVersion: commitRes.stateVersion, rejectedReasons: commitRes.rejectedReasons, committedActionsCount: commitRes.committedActionsCount },
    after,
    pass,
    actualSummary: `success=${commitRes.success}, stateVersion=${after.stateVersion}, silverQty=${silver?.quantity}`
  });
  console.log(`${pass ? '✅ [PASS]' : '❌ [FAIL]'} TEST-B: Grounded New Silver Acquisition (Exactly +2, stateVersion 2 -> 3)`);
}

// -------------------------------------------------------------
// TEST-C: Re-acquisition of Existing Item (Accurate Accumulation)
// -------------------------------------------------------------
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-init-c',
    requestId: 'req-init-c',
    eventId: 'evt-init-c',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T06:30:00.000Z',
    intentSummary: 'Genesis initial 2 silver coins',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver', name: '은화', quantity: 2 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      },
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-reward-c',
          content: '상단 호위 보수로 은화 3닢을 수령했다.',
          status: 'active'
        }
      }
    ]
  });

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-acq-c',
    requestId: 'req-acq-c',
    eventId: 'evt-acq-c',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T06:30:05.000Z',
    intentSummary: 'Claim bounty reward of 3 silver coins',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver', name: '은화', quantity: 3 },
          acquisition: {
            cause: 'GIFT_REWARD',
            verifiedEventId: 'seed-reward-c'
          }
        }
      }
    ]
  };

  const before = captureSnapshot(engine);
  const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), new Set(before.requestRegistry), new Set(before.eventRegistry), engine.getHistory());
  const commitRes = engine.submitProposal(proposal);
  const after = captureSnapshot(engine);

  const silver = after.inventory.find(i => i.name === '은화');
  const pass = commitRes.success && after.inventory.length === 1 && silver?.quantity === 5 && after.stateVersion === 3;
  results.push({
    testId: 'TEST-C',
    testName: 'Re-acquisition of Existing Item -> Accurate Accumulation (2 + 3 = 5)',
    before,
    proposal,
    validatorResult: { valid: valRes.valid, rejectedReasons: valRes.rejectedReasons },
    commitResult: { success: commitRes.success, stateVersion: commitRes.stateVersion, rejectedReasons: commitRes.rejectedReasons, committedActionsCount: commitRes.committedActionsCount },
    after,
    pass,
    actualSummary: `success=${commitRes.success}, invSlots=${after.inventory.length}, silverQty=${silver?.quantity}, stateVersion=${after.stateVersion}`
  });
  console.log(`${pass ? '✅ [PASS]' : '❌ [FAIL]'} TEST-C: Re-acquisition of Existing Item (Accurate accumulation 2 + 3 = 5, 1 slot)`);
}

// -------------------------------------------------------------
// TEST-D: Duplicate eventId / requestId Replay Defense
// -------------------------------------------------------------
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-seed-d',
    requestId: 'req-seed-d',
    eventId: 'evt-seed-d',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T06:30:00.000Z',
    intentSummary: 'Seed reward d',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-d',
          content: '상단에서 은화 10냥을 지급하기로 결정했다.',
          status: 'active'
        }
      }
    ]
  });

  const firstProp: StateTransitionProposal = {
    proposalId: 'prop-orig-d',
    requestId: 'req-orig-d',
    eventId: 'evt-orig-d',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T06:30:05.000Z',
    intentSummary: 'First legitimate acquisition',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver', name: '은화', quantity: 10 },
          acquisition: { cause: 'GIFT_REWARD', verifiedEventId: 'seed-d' }
        }
      }
    ]
  };
  engine.submitProposal(firstProp);

  const replayedProposal: StateTransitionProposal = {
    proposalId: 'prop-orig-d',
    requestId: 'req-orig-d',
    eventId: 'evt-orig-d',
    expectedStateVersion: 3,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T06:30:10.000Z',
    intentSummary: 'Replay of previous proposal',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver', name: '은화', quantity: 10 },
          acquisition: { cause: 'GIFT_REWARD', verifiedEventId: 'seed-d' }
        }
      }
    ]
  };

  const before = captureSnapshot(engine);
  const valRes = EngineValidator.validate(replayedProposal, engine.getSnapshot(), new Set(before.requestRegistry), new Set(before.eventRegistry), engine.getHistory());
  const commitRes = engine.submitProposal(replayedProposal);
  const after = captureSnapshot(engine);

  const pass = !commitRes.success && after.stateVersion === before.stateVersion && after.inventory[0]?.quantity === 10;
  results.push({
    testId: 'TEST-D',
    testName: 'Duplicate eventId / requestId Replay Defense -> Change 0',
    before,
    proposal: replayedProposal,
    validatorResult: { valid: valRes.valid, rejectedReasons: valRes.rejectedReasons },
    commitResult: { success: commitRes.success, stateVersion: commitRes.stateVersion, rejectedReasons: commitRes.rejectedReasons, committedActionsCount: commitRes.committedActionsCount },
    after,
    pass,
    actualSummary: `success=${commitRes.success}, stateVersion=${after.stateVersion} (before=${before.stateVersion}), silverQty=${after.inventory[0]?.quantity}`
  });
  console.log(`${pass ? '✅ [PASS]' : '❌ [FAIL]'} TEST-D: Duplicate eventId/requestId Replay Defense (Rejection, change 0)`);
}

// -------------------------------------------------------------
// TEST-E: Same ID / Different Name (ID-based Discrimination)
// -------------------------------------------------------------
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-init-e',
    requestId: 'req-init-e',
    eventId: 'evt-init-e',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T06:30:00.000Z',
    intentSummary: 'Genesis initial iron sword',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-001', name: '철검', quantity: 1 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      },
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-e',
          content: '창고에서 철검 2자루를 추가 획득',
          status: 'active'
        }
      }
    ]
  });

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-add-e',
    requestId: 'req-add-e',
    eventId: 'evt-add-e',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T06:30:05.000Z',
    intentSummary: 'Add item with matching ID',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-001', name: '녹슨 철검', quantity: 2 },
          acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'seed-e' }
        }
      }
    ]
  };

  const before = captureSnapshot(engine);
  const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), new Set(before.requestRegistry), new Set(before.eventRegistry), engine.getHistory());
  const commitRes = engine.submitProposal(proposal);
  const after = captureSnapshot(engine);

  const slot = after.inventory.find(i => i.id === 'item-001');
  const pass = commitRes.success && after.inventory.length === 1 && slot?.quantity === 3;
  results.push({
    testId: 'TEST-E',
    testName: 'Same ID / Different Name -> ID-based Discrimination',
    before,
    proposal,
    validatorResult: { valid: valRes.valid, rejectedReasons: valRes.rejectedReasons },
    commitResult: { success: commitRes.success, stateVersion: commitRes.stateVersion, rejectedReasons: commitRes.rejectedReasons, committedActionsCount: commitRes.committedActionsCount },
    after,
    pass,
    actualSummary: `success=${commitRes.success}, invSlots=${after.inventory.length}, slotId=${slot?.id}, slotQty=${slot?.quantity}`
  });
  console.log(`${pass ? '✅ [PASS]' : '❌ [FAIL]'} TEST-E: Same ID / Different Name (ID-based discrimination stacks 1 + 2 = 3)`);
}

// -------------------------------------------------------------
// TEST-F: Different ID / Same Name (Target Discrimination Verification)
// -------------------------------------------------------------
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-init-f',
    requestId: 'req-init-f',
    eventId: 'evt-init-f',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T06:30:00.000Z',
    intentSummary: 'Genesis initial coins',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-wuxia-coin', name: '전폐', quantity: 10 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      },
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-f',
          content: '시장 바닥에서 전폐 5닢을 주웠다.',
          status: 'active'
        }
      }
    ]
  });

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-add-f',
    requestId: 'req-add-f',
    eventId: 'evt-add-f',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T06:30:05.000Z',
    intentSummary: 'Add same named currency with different ID',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-market-coin', name: '전폐', quantity: 5 },
          acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'seed-f' }
        }
      }
    ]
  };

  const before = captureSnapshot(engine);
  const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), new Set(before.requestRegistry), new Set(before.eventRegistry), engine.getHistory());
  const commitRes = engine.submitProposal(proposal);
  const after = captureSnapshot(engine);

  const coins = after.inventory.filter(i => i.name === '전폐');
  const totalQty = coins.reduce((sum, c) => sum + c.quantity, 0);
  const pass = commitRes.success && totalQty === 15;
  results.push({
    testId: 'TEST-F',
    testName: 'Different ID / Same Name -> Target Discrimination Verification',
    before,
    proposal,
    validatorResult: { valid: valRes.valid, rejectedReasons: valRes.rejectedReasons },
    commitResult: { success: commitRes.success, stateVersion: commitRes.stateVersion, rejectedReasons: commitRes.rejectedReasons, committedActionsCount: commitRes.committedActionsCount },
    after,
    pass,
    actualSummary: `success=${commitRes.success}, distinctSlots=${coins.length}, totalQty=${totalQty}, slotDetails=${JSON.stringify(after.inventory)}`
  });
  console.log(`${pass ? '✅ [PASS]' : '❌ [FAIL]'} TEST-F: Different ID / Same Name (Name-based stack 10 + 5 = 15 totalQty)`);
}

// -------------------------------------------------------------
// TEST-G: Non-existent Item REMOVE -> Change 0
// -------------------------------------------------------------
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-init-g',
    requestId: 'req-init-g',
    eventId: 'evt-init-g',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T06:30:00.000Z',
    intentSummary: 'Genesis 2 silver',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver', name: '은화', quantity: 2 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      }
    ]
  });

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-rem-g',
    requestId: 'req-rem-g',
    eventId: 'evt-rem-g',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T06:30:05.000Z',
    intentSummary: 'Attempt to remove non-existent potion',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'REMOVE',
          item: { id: 'item-potion-unknown', name: '신비한 영약', quantity: 1 }
        }
      }
    ]
  };

  const before = captureSnapshot(engine);
  const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), new Set(before.requestRegistry), new Set(before.eventRegistry), engine.getHistory());
  const commitRes = engine.submitProposal(proposal);
  const after = captureSnapshot(engine);

  const pass = !commitRes.success && after.stateVersion === before.stateVersion && after.inventory.length === 1;
  results.push({
    testId: 'TEST-G',
    testName: 'Non-existent Item REMOVE -> Change 0',
    before,
    proposal,
    validatorResult: { valid: valRes.valid, rejectedReasons: valRes.rejectedReasons },
    commitResult: { success: commitRes.success, stateVersion: commitRes.stateVersion, rejectedReasons: commitRes.rejectedReasons, committedActionsCount: commitRes.committedActionsCount },
    after,
    pass,
    actualSummary: `success=${commitRes.success}, rejectedReasons=${commitRes.rejectedReasons.join('; ')}, stateVersion=${after.stateVersion} (before=${before.stateVersion})`
  });
  console.log(`${pass ? '✅ [PASS]' : '❌ [FAIL]'} TEST-G: Non-existent Item REMOVE (Rejection, change 0)`);
}

// -------------------------------------------------------------
// TEST-H: Action Order & Atomicity (REMOVE -> ADD Exchange)
// -------------------------------------------------------------
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-init-h',
    requestId: 'req-init-h',
    eventId: 'evt-init-h',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T06:30:00.000Z',
    intentSummary: 'Genesis 5 silver',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver', name: '은화', quantity: 5 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      }
    ]
  });

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-exch-h',
    requestId: 'req-exch-h',
    eventId: 'evt-exch-h',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T06:30:05.000Z',
    intentSummary: 'Exchange 5 silver for martial manual',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'REMOVE',
          item: { id: 'item-silver', name: '은화', quantity: 5 }
        }
      },
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-manual', name: '태극권보', quantity: 1 },
          acquisition: {
            cause: 'RESOURCE_EXCHANGE',
            cost: { id: 'item-silver', name: '은화', quantity: 5 }
          }
        }
      }
    ]
  };

  const before = captureSnapshot(engine);
  const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), new Set(before.requestRegistry), new Set(before.eventRegistry), engine.getHistory());
  const commitRes = engine.submitProposal(proposal);
  const after = captureSnapshot(engine);

  const silver = after.inventory.find(i => i.name === '은화');
  const manual = after.inventory.find(i => i.name === '태극권보');
  const pass = commitRes.success && (!silver || silver.quantity === 0) && manual?.quantity === 1 && after.stateVersion === 3;
  results.push({
    testId: 'TEST-H',
    testName: 'Action Order & Atomicity: REMOVE -> ADD Exchange',
    before,
    proposal,
    validatorResult: { valid: valRes.valid, rejectedReasons: valRes.rejectedReasons },
    commitResult: { success: commitRes.success, stateVersion: commitRes.stateVersion, rejectedReasons: commitRes.rejectedReasons, committedActionsCount: commitRes.committedActionsCount },
    after,
    pass,
    actualSummary: `success=${commitRes.success}, silverRemaining=${silver?.quantity ?? 0}, manualQuantity=${manual?.quantity}, stateVersion=${after.stateVersion}`
  });
  console.log(`${pass ? '✅ [PASS]' : '❌ [FAIL]'} TEST-H: Action Order & Atomicity (5 silver deducted, 1 태극권보 added atomically)`);
}

// -------------------------------------------------------------
// TEST-I: Double-Spending Defense (Reusing Same Acquisition Event 2 Times)
// -------------------------------------------------------------
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-seed-i',
    requestId: 'req-seed-i',
    eventId: 'evt-seed-i',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T06:30:00.000Z',
    intentSummary: 'Spawn discovery seed i',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-unique-chest',
          content: '단 하나의 비급 상자 발견 (구양진경 1권)',
          status: 'active'
        }
      }
    ]
  });

  const prop1: StateTransitionProposal = {
    proposalId: 'prop-acq-i-1',
    requestId: 'req-acq-i-1',
    eventId: 'evt-acq-i-1',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T06:30:05.000Z',
    intentSummary: 'First pickup from chest',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-book-1', name: '구양진경', quantity: 1 },
          acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'seed-unique-chest' }
        }
      }
    ]
  };
  engine.submitProposal(prop1);

  const proposal2: StateTransitionProposal = {
    proposalId: 'prop-acq-i-2',
    requestId: 'req-acq-i-2',
    eventId: 'evt-acq-i-2',
    expectedStateVersion: 3,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T06:30:10.000Z',
    intentSummary: 'Second pickup attempting double-spend of seed-unique-chest',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-book-2', name: '독고구검', quantity: 1 },
          acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'seed-unique-chest' }
        }
      }
    ]
  };

  const before = captureSnapshot(engine);
  const valRes = EngineValidator.validate(proposal2, engine.getSnapshot(), new Set(before.requestRegistry), new Set(before.eventRegistry), engine.getHistory());
  const commitRes = engine.submitProposal(proposal2);
  const after = captureSnapshot(engine);

  const hasBook2 = after.inventory.some(i => i.name === '독고구검');
  const pass = !commitRes.success && !hasBook2 && after.stateVersion === before.stateVersion;
  results.push({
    testId: 'TEST-I',
    testName: 'Double-Spending Defense: Reusing Same Acquisition Event 2 Times',
    before,
    proposal: proposal2,
    validatorResult: { valid: valRes.valid, rejectedReasons: valRes.rejectedReasons },
    commitResult: { success: commitRes.success, stateVersion: commitRes.stateVersion, rejectedReasons: commitRes.rejectedReasons, committedActionsCount: commitRes.committedActionsCount },
    after,
    pass,
    actualSummary: `success=${commitRes.success}, rejectedReasons=${commitRes.rejectedReasons.join('; ')}, stateVersion=${after.stateVersion} (before=${before.stateVersion}), hasBook2=${hasBook2}`
  });
  console.log(`${pass ? '✅ [PASS]' : '❌ [FAIL]'} TEST-I: Double-Spending Defense (Second acquisition using same event rejected, 2nd book blocked)`);
}

// -------------------------------------------------------------
// TEST-J: SAVE -> HYDRATE -> Duplicate Replay Defense
// -------------------------------------------------------------
{
  const engine1 = new SovereignEngine();
  dispatchEngineInternalProposal(engine1, {
    proposalId: 'prop-seed-j',
    requestId: 'req-seed-j',
    eventId: 'evt-seed-j',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T06:30:00.000Z',
    intentSummary: 'Seed reward j',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-j',
          content: '상단 호위 보수로 대환단 1개를 수령했다.',
          status: 'active'
        }
      }
    ]
  });

  const legitimateProp: StateTransitionProposal = {
    proposalId: 'prop-legit-j',
    requestId: 'req-legit-j',
    eventId: 'evt-legit-j',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T06:30:05.000Z',
    intentSummary: 'Legitimate acquisition before save',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-dan', name: '대환단', quantity: 1 },
          acquisition: { cause: 'GIFT_REWARD', verifiedEventId: 'seed-j' }
        }
      }
    ]
  };
  engine1.submitProposal(legitimateProp);

  const savedSnapshot = engine1.getSnapshot();
  const savedHistory = engine1.getHistory();
  const savedExecutedRequests = Array.from((engine1 as any).executedRequestIds ?? []) as string[];
  const savedRecordedEvents = Array.from((engine1 as any).recordedEventIds ?? []) as string[];

  const engine2 = SovereignEngine.hydrate(
    savedSnapshot,
    savedHistory,
    savedExecutedRequests,
    savedRecordedEvents
  );

  const replayedProposal: StateTransitionProposal = {
    proposalId: 'prop-replay-j',
    requestId: 'req-legit-j',
    eventId: 'evt-legit-j',
    expectedStateVersion: savedSnapshot.stateVersion,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T06:30:10.000Z',
    intentSummary: 'Adversarial replay attack on hydrated session',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-dan', name: '대환단', quantity: 1 },
          acquisition: { cause: 'GIFT_REWARD', verifiedEventId: 'seed-j' }
        }
      }
    ]
  };

  const before = captureSnapshot(engine2);
  const valRes = EngineValidator.validate(replayedProposal, engine2.getSnapshot(), new Set(before.requestRegistry), new Set(before.eventRegistry), engine2.getHistory());
  const commitRes = engine2.submitProposal(replayedProposal);
  const after = captureSnapshot(engine2);

  const dan = after.inventory.find(i => i.name === '대환단');
  const pass = !commitRes.success && after.stateVersion === before.stateVersion && dan?.quantity === 1;
  results.push({
    testId: 'TEST-J',
    testName: 'SAVE -> HYDRATE -> Duplicate Replay Defense -> Change 0',
    before,
    proposal: replayedProposal,
    validatorResult: { valid: valRes.valid, rejectedReasons: valRes.rejectedReasons },
    commitResult: { success: commitRes.success, stateVersion: commitRes.stateVersion, rejectedReasons: commitRes.rejectedReasons, committedActionsCount: commitRes.committedActionsCount },
    after,
    pass,
    actualSummary: `success=${commitRes.success}, rejectedReasons=${commitRes.rejectedReasons.join('; ')}, stateVersion=${after.stateVersion} (before=${before.stateVersion}), danQuantity=${dan?.quantity}`
  });
  console.log(`${pass ? '✅ [PASS]' : '❌ [FAIL]'} TEST-J: SAVE -> HYDRATE Replay Defense (IDEMPOTENCY_VIOLATION, danQty remains 1)`);
}

console.log('\n====================================================');
const totalPassed = results.filter(r => r.pass).length;
console.log(`Summary: ${totalPassed}/${results.length} Behavioral Audit Tests Passed.`);
console.log('====================================================\n');

console.log('[DETAILED_JSON_AUDIT_LOG]');
console.log(JSON.stringify(results, null, 2));
