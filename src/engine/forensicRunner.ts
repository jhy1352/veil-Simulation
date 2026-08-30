import { SovereignEngine } from './state';
import { dispatchEngineInternalProposal } from './internalCapability';
import { StateTransitionProposal } from './types';
import { EngineValidator } from './validator';
import { parseGMResponseAndProposal, buildSafeProposal } from './proposalParser';

console.log('=== SECTION 1: INVENTORY IDENTITY (ADD / REMOVE / SET_QUANTITY / RESOURCE_EXCHANGE with ID/Name combinations) ===');

// 1.1 ADD with ID match but Name mismatch vs Name match but ID mismatch
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-inv-init-1',
    requestId: 'req-inv-init-1',
    eventId: 'evt-inv-init-1',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T07:00:00.000Z',
    intentSummary: 'Genesis initial items',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-sword-1', name: '철검', quantity: 1 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      },
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: { id: 'seed-sword-add', content: '검을 발견함', status: 'active' }
      }
    ]
  });

  console.log('[1.1 Initial Inventory]:', JSON.stringify(engine.getSnapshot().character.inventory));

  // Try ADD with same ID 'item-sword-1' but Name '보검'
  const prop1: StateTransitionProposal = {
    proposalId: 'prop-inv-1-a',
    requestId: 'req-inv-1-a',
    eventId: 'evt-inv-1-a',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T07:00:01.000Z',
    intentSummary: 'ADD same ID different Name',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-sword-1', name: '보검', quantity: 2 },
          acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'seed-sword-add' }
        }
      }
    ]
  };
  const res1 = engine.submitProposal(prop1);
  console.log('[1.1 ADD same ID different Name result]: success=', res1.success, 'rejectedReasons=', res1.rejectedReasons);
  console.log('[1.1 Inventory after 1-a]:', JSON.stringify(engine.getSnapshot().character.inventory));
}

// 1.2 REMOVE with ID match vs Name match
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-inv-init-2',
    requestId: 'req-inv-init-2',
    eventId: 'evt-inv-init-2',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T07:00:00.000Z',
    intentSummary: 'Genesis items for REMOVE test',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-coin-a', name: '은화', quantity: 5 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      }
    ]
  });

  // REMOVE targeting ID 'different-id' but Name '은화'
  const propRemName: StateTransitionProposal = {
    proposalId: 'prop-rem-name',
    requestId: 'req-rem-name',
    eventId: 'evt-rem-name',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T07:00:02.000Z',
    intentSummary: 'REMOVE by matching name but different ID',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'REMOVE',
          item: { id: 'item-coin-different', name: '은화', quantity: 2 }
        }
      }
    ]
  };
  const resRemName = engine.submitProposal(propRemName);
  console.log('[1.2 REMOVE diff ID same Name result]: success=', resRemName.success, 'rejectedReasons=', resRemName.rejectedReasons);
  console.log('[1.2 Inventory after REMOVE by name]:', JSON.stringify(engine.getSnapshot().character.inventory));

  // REMOVE targeting ID 'item-coin-a' but Name '금화' (name mismatch)
  const propRemId: StateTransitionProposal = {
    proposalId: 'prop-rem-id',
    requestId: 'req-rem-id',
    eventId: 'evt-rem-id',
    expectedStateVersion: engine.getSnapshot().stateVersion,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T07:00:03.000Z',
    intentSummary: 'REMOVE by matching ID but different Name',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'REMOVE',
          item: { id: 'item-coin-a', name: '금화', quantity: 1 }
        }
      }
    ]
  };
  const resRemId = engine.submitProposal(propRemId);
  console.log('[1.2 REMOVE same ID diff Name result]: success=', resRemId.success, 'rejectedReasons=', resRemId.rejectedReasons);
  console.log('[1.2 Inventory after REMOVE by ID]:', JSON.stringify(engine.getSnapshot().character.inventory));
}

// 1.3 SET_QUANTITY
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-inv-init-3',
    requestId: 'req-inv-init-3',
    eventId: 'evt-inv-init-3',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T07:00:00.000Z',
    intentSummary: 'Genesis items for SET_QUANTITY',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'SET_QUANTITY',
          item: { id: 'item-pill', name: '소환단', quantity: 3 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      }
    ]
  });

  // LLM attempting SET_QUANTITY to increase items
  const propSetLLM: StateTransitionProposal = {
    proposalId: 'prop-set-llm',
    requestId: 'req-set-llm',
    eventId: 'evt-set-llm',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T07:00:04.000Z',
    intentSummary: 'LLM attempting SET_QUANTITY 3 -> 10',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'SET_QUANTITY',
          item: { id: 'item-pill', name: '소환단', quantity: 10 }
        }
      }
    ]
  };
  const resSetLLM = engine.submitProposal(propSetLLM);
  console.log('[1.3 LLM SET_QUANTITY 3 -> 10 result]: success=', resSetLLM.success, 'rejectedReasons=', resSetLLM.rejectedReasons);

  // PLAYER attempting SET_QUANTITY
  const propSetPlayer: StateTransitionProposal = {
    proposalId: 'prop-set-player',
    requestId: 'req-set-player',
    eventId: 'evt-set-player',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T07:00:05.000Z',
    intentSummary: 'PLAYER attempting SET_QUANTITY 3 -> 0',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'SET_QUANTITY',
          item: { id: 'item-pill', name: '소환단', quantity: 0 }
        }
      }
    ]
  };
  const resSetPlayer = engine.submitProposal(propSetPlayer);
  console.log('[1.3 PLAYER SET_QUANTITY 3 -> 0 result]: success=', resSetPlayer.success, 'rejectedReasons=', resSetPlayer.rejectedReasons);
  console.log('[1.3 Inventory after SET_QUANTITY]:', JSON.stringify(engine.getSnapshot().character.inventory));
}

// 1.4 RESOURCE_EXCHANGE with mismatched Cost ID vs Cost Name
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-inv-init-4',
    requestId: 'req-inv-init-4',
    eventId: 'evt-inv-init-4',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T07:00:00.000Z',
    intentSummary: 'Genesis 10 silver coins',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver-real', name: '은화', quantity: 10 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      }
    ]
  });

  // Exchange: REMOVE specifies id 'item-silver-real', ADD acquisition.cost specifies id 'fake-silver-id' but name '은화'
  const propExchMismatch: StateTransitionProposal = {
    proposalId: 'prop-exch-mismatch',
    requestId: 'req-exch-mismatch',
    eventId: 'evt-exch-mismatch',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T07:00:06.000Z',
    intentSummary: 'Exchange with cost ID mismatch',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'REMOVE',
          item: { id: 'item-silver-real', name: '은화', quantity: 5 }
        }
      },
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-bow', name: '장궁', quantity: 1 },
          acquisition: {
            cause: 'RESOURCE_EXCHANGE',
            cost: { id: 'fake-silver-id', name: '은화', quantity: 5 }
          }
        }
      }
    ]
  };
  const resExchMismatch = engine.submitProposal(propExchMismatch);
  console.log('[1.4 RESOURCE_EXCHANGE cost ID mismatch result]: success=', resExchMismatch.success, 'rejectedReasons=', resExchMismatch.rejectedReasons);
  console.log('[1.4 Inventory after mismatch exchange]:', JSON.stringify(engine.getSnapshot().character.inventory));
}

console.log('\n=== SECTION 2: TURN REGRESSION (Attempting commit with proposal turn < snapshot.turn) ===');
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-turn-init',
    requestId: 'req-turn-init',
    eventId: 'evt-turn-init',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T07:00:00.000Z',
    intentSummary: 'Genesis turn 1',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: { id: 'seed-turn-1', content: 'Turn 1 seed', status: 'active' }
      }
    ]
  });

  // Advance turn to 5 via player proposal
  const propTurnAdv: StateTransitionProposal = {
    proposalId: 'prop-turn-adv',
    requestId: 'req-turn-adv',
    eventId: 'evt-turn-adv',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 5,
    timestamp: '2026-08-23T07:00:10.000Z',
    intentSummary: 'Advance turn to 5',
    actions: []
  };
  const resAdv = engine.submitProposal(propTurnAdv);
  console.log('[2.1 Turn advance to 5]: success=', resAdv.success, 'current snapshot turn=', engine.getSnapshot().turn, 'stateVersion=', engine.getSnapshot().stateVersion);

  // Now attempt turn regression: submit proposal with turn: 2 (< 5)
  const propTurnRegress: StateTransitionProposal = {
    proposalId: 'prop-turn-regress',
    requestId: 'req-turn-regress',
    eventId: 'evt-turn-regress',
    expectedStateVersion: engine.getSnapshot().stateVersion,
    source: 'LLM',
    turn: 2,
    timestamp: '2026-08-23T07:00:15.000Z',
    intentSummary: 'Attempted turn regression turn=2 when snapshot turn=5',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: { id: 'seed-regress', content: 'Regressive seed', status: 'active' }
      }
    ]
  };

  const valRes = EngineValidator.validate(
    propTurnRegress,
    engine.getSnapshot(),
    new Set(Array.from((engine as any).executedRequestIds ?? [])),
    new Set(Array.from((engine as any).recordedEventIds ?? [])),
    engine.getHistory()
  );
  const resRegress = engine.submitProposal(propTurnRegress);
  console.log('[2.2 Turn regression Validator valid]:', valRes.valid, 'rejectedReasons:', valRes.rejectedReasons);
  console.log('[2.2 Turn regression Commit success]:', resRegress.success, 'rejectedReasons:', resRegress.rejectedReasons);
  console.log('[2.2 Snapshot turn after regression attempt]:', engine.getSnapshot().turn, 'stateVersion:', engine.getSnapshot().stateVersion);
}

console.log('\n=== SECTION 3: EVENT TRUST BOUNDARY ===');

// 3.1 Fake seed / Fake offscreen event (non-existent verifiedEventId)
{
  const engine = new SovereignEngine();
  const proposal: StateTransitionProposal = {
    proposalId: 'prop-fake-seed',
    requestId: 'req-fake-seed',
    eventId: 'evt-fake-seed',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T07:00:20.000Z',
    intentSummary: 'Acquisition referencing completely fake seed ID',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-gold', name: '금괴', quantity: 1 },
          acquisition: {
            cause: 'DISCOVERY_PICKUP',
            verifiedEventId: 'fake-nonexistent-seed-999'
          }
        }
      }
    ]
  };
  const res = engine.submitProposal(proposal);
  console.log('[3.1 Fake Seed Acquisition]: success=', res.success, 'rejectedReasons=', res.rejectedReasons);
}

// 3.2 Substring verifiedEventId attack
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-seed-real',
    requestId: 'req-seed-real',
    eventId: 'evt-seed-real',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T07:00:00.000Z',
    intentSummary: 'Create real seed',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: { id: 'seed-chest-gold-100', content: '황금 상자 발견', status: 'active' }
      }
    ]
  });

  // Attempt to use substring 'seed-chest-gold'
  const propSubstring: StateTransitionProposal = {
    proposalId: 'prop-sub-1',
    requestId: 'req-sub-1',
    eventId: 'evt-sub-1',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T07:00:21.000Z',
    intentSummary: 'Attempt acquisition with substring event ID',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-gold', name: '황금', quantity: 1 },
          acquisition: {
            cause: 'DISCOVERY_PICKUP',
            verifiedEventId: 'seed-chest-gold' // Substring, not exact match
          }
        }
      }
    ]
  };
  const resSub = engine.submitProposal(propSubstring);
  console.log('[3.2 Substring verifiedEventId result]: success=', resSub.success, 'rejectedReasons=', resSub.rejectedReasons);
}

// 3.3 CREATE EVENT -> CONSUME EVENT in the SAME proposal
{
  const engine = new SovereignEngine();
  const propSameTurn: StateTransitionProposal = {
    proposalId: 'prop-same-turn',
    requestId: 'req-same-turn',
    eventId: 'evt-same-turn',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T07:00:22.000Z',
    intentSummary: 'Create seed and consume it in same proposal',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: { id: 'seed-self-created', content: '보물상자 발견 (보물 1개)', status: 'active' }
      },
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-treasure', name: '보물', quantity: 1 },
          acquisition: {
            cause: 'DISCOVERY_PICKUP',
            verifiedEventId: 'seed-self-created'
          }
        }
      }
    ]
  };
  const resSameTurn = engine.submitProposal(propSameTurn);
  console.log('[3.3 CREATE EVENT -> CONSUME in same proposal result]: success=', resSameTurn.success, 'rejectedReasons=', resSameTurn.rejectedReasons);
  console.log('[3.3 Inventory after same-proposal creation]:', JSON.stringify(engine.getSnapshot().character.inventory));
}

// 3.4 PLAYER -> WorldInfo / Seed Creation -> Acquisition
{
  const engine = new SovereignEngine();
  const propPlayerSeed: StateTransitionProposal = {
    proposalId: 'prop-player-seed',
    requestId: 'req-player-seed',
    eventId: 'evt-player-seed',
    expectedStateVersion: 1,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T07:00:23.000Z',
    intentSummary: 'Player attempting to add narrative seed or world fact directly',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: { id: 'seed-player-injected', content: '플레이어가 전설의 검을 발견했다', status: 'active' }
      }
    ]
  };
  const resPlayerSeed = engine.submitProposal(propPlayerSeed);
  console.log('[3.4 PLAYER ADD_NARRATIVE_SEED result]: success=', resPlayerSeed.success, 'rejectedReasons=', resPlayerSeed.rejectedReasons);
}

console.log('\n=== SECTION 4: ACTUAL PARSER GOLDEN PATH ("은화를 봤다" vs "은화를 획득했다") ===');

// 4.1 Parsing observation: "은화를 보았다"
{
  const observationRawLLMResponse = `
사당 한구석에 흩어진 은화 5닢이 달빛을 받아 반짝였다. 당신은 그저 물끄러미 은화를 바라보았다.

\`\`\`json
{
  "intentSummary": "은화를 바라봄",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "ADD",
        "item": {
          "id": "item-silver",
          "name": "은화",
          "quantity": 5
        }
      }
    }
  ]
}
\`\`\`
`;

  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-genesis-4',
    requestId: 'req-genesis-4',
    eventId: 'evt-genesis-4',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T07:00:00.000Z',
    intentSummary: 'Genesis starter 5 silver',
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

  const parsed = parseGMResponseAndProposal(observationRawLLMResponse);
  const envelope = {
    requestId: 'req-parse-obs',
    eventId: 'evt-parse-obs',
    expectedStateVersion: engine.getSnapshot().stateVersion,
    turn: engine.getSnapshot().turn,
    source: 'LLM' as const
  };
  const proposal = buildSafeProposal(envelope, parsed);
  console.log('[4.1 Parsed Proposal for "은화를 보았다"]:', JSON.stringify(proposal, null, 2));

  const commitObs = engine.submitProposal(proposal);
  console.log('[4.1 Commit Result for "은화를 보았다"]:', 'success=', commitObs.success, 'rejectedReasons=', commitObs.rejectedReasons);
  console.log('[4.1 Inventory after "은화를 보았다"]:', JSON.stringify(engine.getSnapshot().character.inventory), 'stateVersion=', engine.getSnapshot().stateVersion);
}

// 4.2 Parsing grounded acquisition: "은화를 획득했다" (with Narrative Seed Grounding)
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-genesis-4-b',
    requestId: 'req-genesis-4-b',
    eventId: 'evt-genesis-4-b',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T07:00:00.000Z',
    intentSummary: 'Seed reward event',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-shrine-silver-2',
          content: '사당 제단 아래에서 은화 2닢을 발견함',
          status: 'active'
        }
      }
    ]
  });

  const acquisitionRawLLMResponse = `
당신은 사당 제단 아래로 손을 뻗어 먼지 쌓인 은화 2닢을 집어 품에 넣었다.

\`\`\`json
{
  "intentSummary": "사당에서 은화 2닢 획득",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "ADD",
        "item": {
          "id": "item-silver",
          "name": "은화",
          "quantity": 2
        },
        "acquisition": {
          "cause": "DISCOVERY_PICKUP",
          "verifiedEventId": "seed-shrine-silver-2"
        }
      }
    }
  ]
}
\`\`\`
`;

  const parsed = parseGMResponseAndProposal(acquisitionRawLLMResponse);
  const envelope = {
    requestId: 'req-parse-acq',
    eventId: 'evt-parse-acq',
    expectedStateVersion: engine.getSnapshot().stateVersion,
    turn: engine.getSnapshot().turn,
    source: 'LLM' as const
  };
  const proposal = buildSafeProposal(envelope, parsed);
  console.log('[4.2 Parsed Proposal for "은화를 획득했다"]:', JSON.stringify(proposal, null, 2));

  const commitAcq = engine.submitProposal(proposal);
  console.log('[4.2 Commit Result for "은화를 획득했다"]:', 'success=', commitAcq.success, 'rejectedReasons=', commitAcq.rejectedReasons);
  console.log('[4.2 Inventory after "은화를 획득했다"]:', JSON.stringify(engine.getSnapshot().character.inventory), 'stateVersion=', engine.getSnapshot().stateVersion);
}

console.log('\n=== SECTION 5: SAVE/HYDRATE TAMPERING (inventory / history / registry / stateVersion / turn) ===');

// 5.1 Hydrating with tampered inventory (Item not present in history records)
{
  const engineOriginal = new SovereignEngine();
  dispatchEngineInternalProposal(engineOriginal, {
    proposalId: 'prop-orig-5-1',
    requestId: 'req-orig-5-1',
    eventId: 'evt-orig-5-1',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T07:00:00.000Z',
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

  const snap = engineOriginal.getSnapshot();
  const hist = engineOriginal.getHistory();
  const reqs = Array.from((engineOriginal as any).executedRequestIds ?? []) as string[];
  const evts = Array.from((engineOriginal as any).recordedEventIds ?? []) as string[];

  // Tamper: Inject a legendary sword directly into snapshot inventory
  const tamperedSnap = JSON.parse(JSON.stringify(snap));
  tamperedSnap.character.inventory.push({ id: 'tampered-dragon-blade', name: '청룡언월도', quantity: 1 });

  const hydratedEngineTamperedInv = SovereignEngine.hydrate(tamperedSnap, hist, reqs, evts);
  console.log('[5.1 Hydrated with tampered inventory]: Snapshot inventory=', JSON.stringify(hydratedEngineTamperedInv.getSnapshot().character.inventory));
}

// 5.2 Hydrating with missing/erased requestRegistry (allowing replay attack)
{
  const engineOriginal = new SovereignEngine();
  dispatchEngineInternalProposal(engineOriginal, {
    proposalId: 'prop-orig-5-2',
    requestId: 'req-orig-5-2',
    eventId: 'evt-orig-5-2',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T07:00:00.000Z',
    intentSummary: 'Genesis reward seed',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: { id: 'seed-dan-5-2', content: '대환단 획득 가능', status: 'active' }
      }
    ]
  });

  const legitimateProp: StateTransitionProposal = {
    proposalId: 'prop-acq-5-2',
    requestId: 'req-acq-5-2',
    eventId: 'evt-acq-5-2',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T07:00:30.000Z',
    intentSummary: 'Legitimate acquisition of pill',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-dan', name: '대환단', quantity: 1 },
          acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'seed-dan-5-2' }
        }
      }
    ]
  };
  engineOriginal.submitProposal(legitimateProp);

  const snap = engineOriginal.getSnapshot();
  const hist = engineOriginal.getHistory();

  // Tamper: Wipe out executedRequestIds and recordedEventIds
  const wipedReqs: string[] = [];
  const wipedEvts: string[] = [];

  const hydratedWipedEngine = SovereignEngine.hydrate(snap, hist, wipedReqs, wipedEvts);
  console.log('[5.2 Hydrated with wiped registries]: requestRegistry length=', (hydratedWipedEngine as any).executedRequestIds.size);

  // Attempt replay attack on wiped engine with the same requestId & eventId
  const replayProp: StateTransitionProposal = {
    proposalId: 'prop-replay-5-2',
    requestId: 'req-acq-5-2',
    eventId: 'evt-acq-5-2',
    expectedStateVersion: snap.stateVersion,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T07:00:35.000Z',
    intentSummary: 'Replaying acquisition against engine with wiped registries',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-dan', name: '대환단', quantity: 1 },
          acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'seed-dan-5-2' }
        }
      }
    ]
  };
  const resReplayWiped = hydratedWipedEngine.submitProposal(replayProp);
  console.log('[5.2 Replay against wiped registries result]: success=', resReplayWiped.success, 'rejectedReasons=', resReplayWiped.rejectedReasons);
  console.log('[5.2 Inventory of wiped engine after replay]:', JSON.stringify(hydratedWipedEngine.getSnapshot().character.inventory));
}

// 5.3 Hydrating with tampered stateVersion (e.g. forced stateVersion = 999)
{
  const engineOriginal = new SovereignEngine();
  const snap = engineOriginal.getSnapshot();
  const hist = engineOriginal.getHistory();
  const reqs = Array.from((engineOriginal as any).executedRequestIds ?? []) as string[];
  const evts = Array.from((engineOriginal as any).recordedEventIds ?? []) as string[];

  const tamperedVersionSnap = JSON.parse(JSON.stringify(snap));
  tamperedVersionSnap.stateVersion = 999;

  const hydratedVersionEngine = SovereignEngine.hydrate(tamperedVersionSnap, hist, reqs, evts);
  console.log('[5.3 Hydrated with tampered stateVersion 999]: snapshot stateVersion=', hydratedVersionEngine.getSnapshot().stateVersion);

  // Next proposal expecting version 2 (based on 1 history item) vs expecting 999
  const propExp2: StateTransitionProposal = {
    proposalId: 'prop-exp-2',
    requestId: 'req-exp-2',
    eventId: 'evt-exp-2',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T07:00:40.000Z',
    intentSummary: 'Proposal expecting stateVersion 2',
    actions: []
  };
  const resExp2 = hydratedVersionEngine.submitProposal(propExp2);
  console.log('[5.3 Submit expecting stateVersion=2 against hydrated version=999]: success=', resExp2.success, 'rejectedReasons=', resExp2.rejectedReasons);

  const propExp999: StateTransitionProposal = {
    proposalId: 'prop-exp-999',
    requestId: 'req-exp-999',
    eventId: 'evt-exp-999',
    expectedStateVersion: 999,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T07:00:41.000Z',
    intentSummary: 'Proposal expecting stateVersion 999',
    actions: []
  };
  const resExp999 = hydratedVersionEngine.submitProposal(propExp999);
  console.log('[5.3 Submit expecting stateVersion=999 against hydrated version=999]: success=', resExp999.success, 'new stateVersion=', hydratedVersionEngine.getSnapshot().stateVersion);
}
