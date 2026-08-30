import { SovereignEngine } from './state';
import { dispatchEngineInternalProposal } from './internalCapability';
import { StateTransitionProposal } from './types';
import { EngineValidator } from './validator';

function captureFullSnapshot(engine: SovereignEngine) {
  const snap = engine.getSnapshot();
  const hist = engine.getHistory();
  const diag = engine.getDiagnostics();
  return {
    turn: snap.turn,
    stateVersion: snap.stateVersion,
    lastCommittedEventId: snap.lastCommittedEventId,
    lastCommittedAt: snap.lastCommittedAt,
    inventory: JSON.parse(JSON.stringify(snap.character.inventory || [])),
    characterStats: JSON.parse(JSON.stringify(snap.character.stats || {})),
    npcs: JSON.parse(JSON.stringify(snap.worldInfo.npcs || [])),
    factions: JSON.parse(JSON.stringify(snap.worldInfo.factions || [])),
    seeds: JSON.parse(JSON.stringify(snap.worldInfo.narrativeSeeds || [])),
    historyCount: hist.length,
    lastHistoryItem: hist.length > 0 ? hist[hist.length - 1] : null,
    totalRecordedEvents: diag.totalRecordedEvents,
    totalExecutedRequests: diag.totalExecutedRequests,
    eventRegistry: Array.from((engine as any).recordedEventIds ?? []),
    requestRegistry: Array.from((engine as any).executedRequestIds ?? []),
  };
}

function runAndReport(testId: string, testName: string, engine: SovereignEngine, proposal: StateTransitionProposal) {
  const before = captureFullSnapshot(engine);
  const valRes = EngineValidator.validate(
    proposal,
    engine.getSnapshot(),
    new Set(before.requestRegistry),
    new Set(before.eventRegistry),
    engine.getHistory()
  );
  const commitRes = engine.submitProposal(proposal);
  const after = captureFullSnapshot(engine);

  console.log(`\n======================================================================`);
  console.log(`[TEST_RUN]: ${testId} - ${testName}`);
  console.log(`----------------------------------------------------------------------`);
  console.log(`[BEFORE]`);
  console.log(JSON.stringify(before, null, 2));
  console.log(`\n[PROPOSAL]`);
  console.log(JSON.stringify(proposal, null, 2));
  console.log(`\n[VALIDATOR]`);
  console.log(JSON.stringify(valRes, null, 2));
  console.log(`\n[COMMIT]`);
  console.log(JSON.stringify(commitRes, null, 2));
  console.log(`\n[AFTER]`);
  console.log(JSON.stringify(after, null, 2));
  console.log(`======================================================================\n`);
}

console.log('######################################################################');
console.log('TRPG 3.1 Sovereign Engine: Detailed Behavioral Forensic Suite');
console.log('######################################################################\n');

// =====================================================================
// 1. SET_QUANTITY (4 combinations of ID/Name & Quantities: 5->7, 5->0, 5->-1, Non-existent ID)
// =====================================================================

// 1.1 SET_QUANTITY 5 -> 7 (Same ID, Same Name) via PLAYER
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-sq-init-1',
    requestId: 'req-sq-init-1',
    eventId: 'evt-sq-init-1',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T08:00:00.000Z',
    intentSummary: 'Genesis 5 silver',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver-1', name: '은화', quantity: 5 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      }
    ]
  });

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-sq-1',
    requestId: 'req-sq-1',
    eventId: 'evt-sq-1',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T08:00:01.000Z',
    intentSummary: 'PLAYER SET_QUANTITY 5 -> 7',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'SET_QUANTITY',
          item: { id: 'item-silver-1', name: '은화', quantity: 7 }
        }
      }
    ]
  };
  runAndReport('1.1-SET_QUANTITY-5to7', 'PLAYER SET_QUANTITY 5 -> 7 (Same ID, Same Name)', engine, proposal);
}

// 1.2 SET_QUANTITY 5 -> 0 (Zero Quantity boundary)
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-sq-init-2',
    requestId: 'req-sq-init-2',
    eventId: 'evt-sq-init-2',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T08:00:00.000Z',
    intentSummary: 'Genesis 5 silver',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver-2', name: '은화', quantity: 5 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      }
    ]
  });

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-sq-2',
    requestId: 'req-sq-2',
    eventId: 'evt-sq-2',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T08:00:02.000Z',
    intentSummary: 'PLAYER SET_QUANTITY 5 -> 0',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'SET_QUANTITY',
          item: { id: 'item-silver-2', name: '은화', quantity: 0 }
        }
      }
    ]
  };
  runAndReport('1.2-SET_QUANTITY-5to0', 'PLAYER SET_QUANTITY 5 -> 0', engine, proposal);
}

// 1.3 SET_QUANTITY 5 -> -1 (Negative Quantity attack)
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-sq-init-3',
    requestId: 'req-sq-init-3',
    eventId: 'evt-sq-init-3',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T08:00:00.000Z',
    intentSummary: 'Genesis 5 silver',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver-3', name: '은화', quantity: 5 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      }
    ]
  });

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-sq-3',
    requestId: 'req-sq-3',
    eventId: 'evt-sq-3',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T08:00:03.000Z',
    intentSummary: 'PLAYER SET_QUANTITY 5 -> -1',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'SET_QUANTITY',
          item: { id: 'item-silver-3', name: '은화', quantity: -1 }
        }
      }
    ]
  };
  runAndReport('1.3-SET_QUANTITY-5toNeg1', 'PLAYER SET_QUANTITY 5 -> -1', engine, proposal);
}

// 1.4 SET_QUANTITY (Same Name '은화', Different ID 'item-other-id')
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-sq-init-4',
    requestId: 'req-sq-init-4',
    eventId: 'evt-sq-init-4',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T08:00:00.000Z',
    intentSummary: 'Genesis 5 silver',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver-orig', name: '은화', quantity: 5 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      }
    ]
  });

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-sq-4',
    requestId: 'req-sq-4',
    eventId: 'evt-sq-4',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T08:00:04.000Z',
    intentSummary: 'PLAYER SET_QUANTITY with matching Name but different ID',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'SET_QUANTITY',
          item: { id: 'item-different-id', name: '은화', quantity: 2 }
        }
      }
    ]
  };
  runAndReport('1.4-SET_QUANTITY-DiffIdSameName', 'PLAYER SET_QUANTITY Diff ID Same Name', engine, proposal);
}

// 1.5 SET_QUANTITY (Same ID 'item-silver-orig', Different Name '금화')
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-sq-init-5',
    requestId: 'req-sq-init-5',
    eventId: 'evt-sq-init-5',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T08:00:00.000Z',
    intentSummary: 'Genesis 5 silver',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-silver-orig', name: '은화', quantity: 5 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      }
    ]
  });

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-sq-5',
    requestId: 'req-sq-5',
    eventId: 'evt-sq-5',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T08:00:05.000Z',
    intentSummary: 'PLAYER SET_QUANTITY with matching ID but different Name',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'SET_QUANTITY',
          item: { id: 'item-silver-orig', name: '금화', quantity: 2 }
        }
      }
    ]
  };
  runAndReport('1.5-SET_QUANTITY-SameIdDiffName', 'PLAYER SET_QUANTITY Same ID Diff Name', engine, proposal);
}

// =====================================================================
// 2. TIMESTAMP REGRESSION (Normal -> Past Timestamp Proposal)
// =====================================================================
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-time-init',
    requestId: 'req-time-init',
    eventId: 'evt-time-init',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T12:00:00.000Z',
    intentSummary: 'Genesis at 12:00',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: { id: 'seed-time-1', content: '시간 12:00 시드', status: 'active' }
      }
    ]
  });

  // Attempt proposal with timestamp far in the past: 1999-01-01
  const pastProposal: StateTransitionProposal = {
    proposalId: 'prop-time-past',
    requestId: 'req-time-past',
    eventId: 'evt-time-past',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: '1999-01-01T00:00:00.000Z',
    intentSummary: 'Past timestamp regression attempt',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: { id: 'seed-past-1', content: '과거 시드', status: 'active' }
      }
    ]
  };
  runAndReport('2.1-TIMESTAMP-REGRESSION', 'Proposal with past timestamp (1999 vs 2026)', engine, pastProposal);
}

// =====================================================================
// 3. SAVE/HYDRATE TAMPERING (Snapshot Turn/History Tampering & Hydration Paths)
// =====================================================================
{
  const engineOrig = new SovereignEngine();
  dispatchEngineInternalProposal(engineOrig, {
    proposalId: 'prop-hyd-init',
    requestId: 'req-hyd-init',
    eventId: 'evt-hyd-init',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T08:00:00.000Z',
    intentSummary: 'Genesis item',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-hyd-1', name: '은화', quantity: 5 },
          acquisition: { cause: 'GENESIS_STARTER' }
        }
      }
    ]
  });

  const snap = engineOrig.getSnapshot();
  const hist = engineOrig.getHistory();
  const reqs = Array.from((engineOrig as any).executedRequestIds ?? []) as string[];
  const evts = Array.from((engineOrig as any).recordedEventIds ?? []) as string[];

  // 3.1 Tamper Snapshot Turn to 999
  const tamperedTurnSnap = JSON.parse(JSON.stringify(snap));
  tamperedTurnSnap.turn = 999;
  const engineHydratedTurn = SovereignEngine.hydrate(tamperedTurnSnap, hist, reqs, evts);

  const proposalTurn: StateTransitionProposal = {
    proposalId: 'prop-hyd-turn',
    requestId: 'req-hyd-turn',
    eventId: 'evt-hyd-turn',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1, // turn 1 against turn 999
    timestamp: '2026-08-23T08:00:10.000Z',
    intentSummary: 'Turn 1 against tampered turn 999',
    actions: [
      {
        type: 'UPDATE_CHARACTER_STATS',
        payload: { hp: 95 }
      }
    ]
  };
  runAndReport('3.1-HYDRATE-TAMPERED-TURN', 'Hydrated with tampered turn=999, submit turn=1', engineHydratedTurn, proposalTurn);

  // 3.2 Tamper History by appending forged committed event
  const forgedHist = JSON.parse(JSON.stringify(hist));
  forgedHist.push({
    recordId: 'rec-forged-1',
    eventId: 'forged-event-id',
    proposalId: 'prop-forged-1',
    turn: 1,
    timestamp: '2026-08-23T08:00:05.000Z',
    source: 'LLM',
    actionType: 'MODIFY_INVENTORY',
    details: 'Forged history event',
    stateVersionAfterCommit: 3
  });

  try {
    const engineHydratedForgedHist = SovereignEngine.hydrate(snap, forgedHist, reqs, evts);
    const proposalHist: StateTransitionProposal = {
      proposalId: 'prop-hyd-hist',
      requestId: 'req-hyd-hist',
      eventId: 'evt-hyd-hist',
      expectedStateVersion: snap.stateVersion,
      source: 'PLAYER',
      turn: 1,
      timestamp: '2026-08-23T08:00:11.000Z',
      intentSummary: 'Submit against forged history',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { hp: 90 }
        }
      ]
    };
    runAndReport('3.2-HYDRATE-FORGED-HISTORY', 'Hydrated with forged history entry, submit proposal', engineHydratedForgedHist, proposalHist);
  } catch (err: any) {
    console.log(`\n======================================================================`);
    console.log(`[TEST_RUN]: 3.2-HYDRATE-FORGED-HISTORY - Hydrated with forged history entry`);
    console.log(`----------------------------------------------------------------------`);
    console.log(`[HYDRATION_REJECTION_CAUGHT]: ${err?.message || String(err)}`);
    console.log(`[VERDICT]: PASS (Sovereign Hydration Integrity Firewall successfully blocked corrupted state)`);
    console.log(`======================================================================\n`);
  }
}

// =====================================================================
// 4. HISTORY <-> CANONICAL STATE (State and History exact correspondence)
// =====================================================================
{
  const engine = new SovereignEngine();
  const proposal: StateTransitionProposal = {
    proposalId: 'prop-corr-1',
    requestId: 'req-corr-1',
    eventId: 'evt-corr-1',
    expectedStateVersion: 1,
    source: 'PLAYER',
    turn: 1,
    timestamp: '2026-08-23T08:00:00.000Z',
    intentSummary: 'Stat change and impression update',
    actions: [
      {
        type: 'UPDATE_CHARACTER_STATS',
        payload: { strength: 15 }
      }
    ]
  };
  runAndReport('4.1-HISTORY-STATE-CORRESPONDENCE', 'Verify exact correspondence of State changes and History records', engine, proposal);
}

// =====================================================================
// 5. NPC / FACTION / SEED IDENTITY (ID/Name conflicts & wrong targeting)
// =====================================================================

// 5.1 UPDATE_NPC targeting wrong ID vs wrong Name
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-npc-init',
    requestId: 'req-npc-init',
    eventId: 'evt-npc-init',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T08:00:00.000Z',
    intentSummary: 'Genesis register NPC',
    actions: [
      {
        type: 'ADD_NPC',
        payload: {
          id: 'npc-master-zhang',
          name: '장삼봉',
          factionId: 'fac-wudang',
          relationship: 'NEUTRAL',
          status: 'ALIVE',
          gender: 'MALE',
          notes: '무당파 개파조사',
          firstMetTurn: 1
        }
      }
    ]
  });

  // Attempt UPDATE_NPC targeting ID 'npc-wrong-id'
  const propNpc1: StateTransitionProposal = {
    proposalId: 'prop-npc-1',
    requestId: 'req-npc-1',
    eventId: 'evt-npc-1',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T08:00:01.000Z',
    intentSummary: 'Update NPC targeting wrong ID',
    actions: [
      {
        type: 'UPDATE_NPC',
        payload: {
          id: 'npc-wrong-id',
          changes: {
            relationship: 'FRIENDLY'
          }
        }
      }
    ]
  };
  runAndReport('5.1-NPC-WRONG-ID', 'UPDATE_NPC targeting non-existent ID', engine, propNpc1);
}

// 5.2 UPDATE_FACTION targeting wrong ID
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-fac-init',
    requestId: 'req-fac-init',
    eventId: 'evt-fac-init',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T08:00:00.000Z',
    intentSummary: 'Genesis register Faction',
    actions: [
      {
        type: 'ADD_FACTION',
        payload: {
          id: 'fac-wudang',
          name: '무당파',
          reputation: 'NEUTRAL',
          isDiscovered: true,
          description: '무당산 도가 문파'
        }
      }
    ]
  });

  const propFac1: StateTransitionProposal = {
    proposalId: 'prop-fac-1',
    requestId: 'req-fac-1',
    eventId: 'evt-fac-1',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T08:00:01.000Z',
    intentSummary: 'Update Faction targeting non-existent ID',
    actions: [
      {
        type: 'UPDATE_FACTION',
        payload: {
          id: 'fac-shaolin',
          changes: {
            reputation: 'HONORED'
          }
        }
      }
    ]
  };
  runAndReport('5.2-FACTION-WRONG-ID', 'UPDATE_FACTION targeting non-existent ID', engine, propFac1);
}

// 5.3 RESOLVE_NARRATIVE_SEED targeting wrong ID
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-seed-init',
    requestId: 'req-seed-init',
    eventId: 'evt-seed-init',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T08:00:00.000Z',
    intentSummary: 'Genesis narrative seed',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-cave-secret',
          content: '동굴 속의 비밀',
          status: 'active'
        }
      }
    ]
  });

  const propSeed1: StateTransitionProposal = {
    proposalId: 'prop-seed-1',
    requestId: 'req-seed-1',
    eventId: 'evt-seed-1',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T08:00:01.000Z',
    intentSummary: 'Resolve seed targeting non-existent ID',
    actions: [
      {
        type: 'RESOLVE_NARRATIVE_SEED',
        payload: {
          id: 'seed-nonexistent',
          resolutionSummary: '해결됨'
        }
      }
    ]
  };
  runAndReport('5.3-SEED-WRONG-ID', 'RESOLVE_NARRATIVE_SEED targeting non-existent ID', engine, propSeed1);
}

// =====================================================================
// 6. VERIFIEDEVENTID ADVERSARIAL (Substring, Similar ID, Forged prefix/suffix)
// =====================================================================
{
  const engine = new SovereignEngine();
  dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-adv-seed-init',
    requestId: 'req-adv-seed-init',
    eventId: 'evt-adv-seed-init',
    expectedStateVersion: 1,
    source: 'SYSTEM',
    turn: 1,
    timestamp: '2026-08-23T08:00:00.000Z',
    intentSummary: 'Genesis target seed',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-target-12345',
          content: '천년설삼 발견',
          status: 'active'
        }
      }
    ]
  });

  // 6.1 Prefix match attack: 'seed-target'
  const propPrefix: StateTransitionProposal = {
    proposalId: 'prop-adv-pre',
    requestId: 'req-adv-pre',
    eventId: 'evt-adv-pre',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T08:00:02.000Z',
    intentSummary: 'Prefix match attack on verifiedEventId',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-ginseng', name: '천년설삼', quantity: 1 },
          acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'seed-target' }
        }
      }
    ]
  };
  runAndReport('6.1-VERIFIED_EVENT_ID-PREFIX', 'verifiedEventId prefix match attack', engine, propPrefix);

  // 6.2 Suffix match attack: '12345'
  const propSuffix: StateTransitionProposal = {
    proposalId: 'prop-adv-suf',
    requestId: 'req-adv-suf',
    eventId: 'evt-adv-suf',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: '2026-08-23T08:00:03.000Z',
    intentSummary: 'Suffix match attack on verifiedEventId',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'item-ginseng', name: '천년설삼', quantity: 1 },
          acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: '12345' }
        }
      }
    ]
  };
  runAndReport('6.2-VERIFIED_EVENT_ID-SUFFIX', 'verifiedEventId suffix match attack', engine, propSuffix);
}
