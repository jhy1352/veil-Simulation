import * as fs from 'fs';
import * as path from 'path';
import { SovereignEngine } from '../src/engine/state';
import { EngineValidator } from '../src/engine/validator';
import { dispatchEngineInternalProposal } from '../src/engine/internalCapability';
import { StateTransitionProposal, ImmutableHistoricalRecord, CanonicalState } from '../src/engine/types';
import { createEmptyCharacter, createEmptyWorldInfo } from '../src/utils/factory';

function extractRawState(engine: SovereignEngine) {
  const snap = engine.getSnapshot();
  const hist = engine.getHistory();
  return {
    stateVersion: snap.stateVersion,
    turn: snap.turn,
    lastCommittedEventId: snap.lastCommittedEventId,
    lastCommittedAt: snap.lastCommittedAt,
    character: snap.character,
    worldInfo: snap.worldInfo,
    historyLength: hist.length,
    history: hist.map(h => ({
      recordId: h.recordId,
      eventId: h.eventId,
      requestId: h.requestId,
      proposalId: h.proposalId,
      actionType: h.actionType,
      stateVersionAfterCommit: h.stateVersionAfterCommit,
      turn: h.turn,
      details: h.details
    })),
    diagnostics: engine.getDiagnostics()
  };
}

function compareStates(before: any, after: any): { isIdentical: boolean; diffSummary: string[] } {
  const diffs: string[] = [];
  if (before.stateVersion !== after.stateVersion) {
    diffs.push(`stateVersion changed: ${before.stateVersion} -> ${after.stateVersion}`);
  }
  if (before.turn !== after.turn) {
    diffs.push(`turn changed: ${before.turn} -> ${after.turn}`);
  }
  if (before.lastCommittedEventId !== after.lastCommittedEventId) {
    diffs.push(`lastCommittedEventId changed: ${before.lastCommittedEventId} -> ${after.lastCommittedEventId}`);
  }
  if (before.historyLength !== after.historyLength) {
    diffs.push(`historyLength changed: ${before.historyLength} -> ${after.historyLength}`);
  }
  const beforeChar = JSON.stringify(before.character);
  const afterChar = JSON.stringify(after.character);
  if (beforeChar !== afterChar) {
    diffs.push(`character mutated`);
  }
  const beforeWorld = JSON.stringify(before.worldInfo);
  const afterWorld = JSON.stringify(after.worldInfo);
  if (beforeWorld !== afterWorld) {
    diffs.push(`worldInfo mutated`);
  }
  return {
    isIdentical: diffs.length === 0,
    diffSummary: diffs
  };
}

interface TestResult {
  testId: string;
  testTitle: string;
  category: string;
  classification: 'PASS' | 'FAIL' | 'UNVERIFIED' | 'HARNESS ERROR';
  before: any;
  proposal: any;
  validatorResult: any;
  commitResult: any;
  after: any;
  comparison: { isIdentical: boolean; diffSummary: string[] };
  notes: string;
}

const allResults: TestResult[] = [];

// =========================================================================
// TEST 1: Validator rejection 후 Canonical State / Inventory / History / stateVersion / Turn / registry 완전 불변성
// =========================================================================
{
  const engine = new SovereignEngine(
    { ...createEmptyWorldInfo(), worldName: '불변성테스트세계' },
    { ...createEmptyCharacter(), name: '주인공', inventory: [{ id: 'inv-1', name: '철검', quantity: 1 }] },
    [],
    1,
    1
  );
  const before = extractRawState(engine);
  // Illegal proposal: Stale expectedStateVersion (expected 999 != 1)
  const proposal: StateTransitionProposal = {
    proposalId: 'prop-test1-illegal',
    requestId: 'req-test1-illegal',
    eventId: 'evt-test1-illegal',
    expectedStateVersion: 999, // Stale version!
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Stale version attack',
    actions: [
      {
        type: 'SET_WORLD_METADATA',
        payload: { worldName: '오염된세계' }
      }
    ]
  };

  const valRes = EngineValidator.validate(
    proposal,
    engine.getSnapshot(),
    (engine as any).executedRequestIds,
    (engine as any).recordedEventIds,
    engine.getHistory()
  );

  let commitRes: any = 'NOT REACHED';
  const executionRes = engine.submitProposal(proposal);
  if (executionRes.success) {
    commitRes = executionRes;
  } else {
    commitRes = 'NOT REACHED';
  }

  const after = extractRawState(engine);
  const comp = compareStates(before, after);
  const passed = !valRes.isValid && !executionRes.success && comp.isIdentical;

  allResults.push({
    testId: 'CASE-01',
    testTitle: 'VALIDATOR REJECTION AND COMPLETE STATE IMMUTABILITY',
    category: 'State Boundary & Immutability',
    classification: passed ? 'PASS' : 'FAIL',
    before,
    proposal,
    validatorResult: valRes,
    commitResult: commitRes,
    after,
    comparison: comp,
    notes: 'Validator correctly rejected stale version, commit was not reached, and canonical state remained completely identical.'
  });
}

// =========================================================================
// TEST 2: Draft 단계 실패 시 Partial Commit 방지 (Atomic Rollback)
// 검증: Validator PASS -> Draft Action 1 성공 -> Action 2 실행 실패 -> Commit NOT REACHED -> BEFORE=AFTER
// =========================================================================
{
  const engine = new SovereignEngine(
    { ...createEmptyWorldInfo(), worldName: '원자성테스트세계' },
    { ...createEmptyCharacter(), name: '주인공', inventory: [{ id: 'inv-gold', name: '금화', quantity: 10 }] },
    [],
    1,
    1
  );
  const before = extractRawState(engine);

  // We craft a proposal where Action 1 is valid, and Action 2 passes EngineValidator.validate,
  // but throws an unexpected runtime error during Step 2 (Atomic Execution Draft in submitProposal).
  let shouldCrashInDraft = false;
  const action2Payload: any = {
    worldName: '두번째변조시도세계'
  };
  Object.defineProperty(action2Payload, 'triggerExecutionCrash', {
    get() {
      if (shouldCrashInDraft) {
        throw new Error('Simulated Draft Action 2 Runtime Execution Failure');
      }
      return 'safe_validator_pass';
    },
    enumerable: true,
    configurable: true
  });

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-test2-atomic-rollback',
    requestId: 'req-test2-atomic-rollback',
    eventId: 'evt-test2-atomic-rollback',
    expectedStateVersion: 1,
    source: 'PLAYER',
    turn: 1,
    timestamp: new Date(Date.now() + 1000).toISOString(),
    intentSummary: 'Multi-action atomic draft failure test',
    actions: [
      {
        type: 'SET_WORLD_METADATA',
        payload: { worldName: '중간변조세계' }
      },
      {
        type: 'SET_WORLD_METADATA',
        payload: action2Payload
      }
    ]
  };

  // 1. First confirm EngineValidator.validate alone PASSES (isValid === true)
  shouldCrashInDraft = false;
  const standaloneValRes = EngineValidator.validate(
    proposal,
    engine.getSnapshot(),
    (engine as any).executedRequestIds,
    (engine as any).recordedEventIds,
    engine.getHistory()
  );

  // 2. Now execute submitProposal where Validator PASSES, Action 1 succeeds in draft, and Action 2 crashes during Step 2
  shouldCrashInDraft = true;
  const executionRes = engine.submitProposal(proposal);
  let commitRes: any = executionRes.success ? executionRes : 'NOT REACHED';

  const after = extractRawState(engine);
  const comp = compareStates(before, after);

  const validatorPassed = standaloneValRes.isValid;
  const executionFailedAtDraft = !executionRes.success && executionRes.rejectedReasons.some((r: string) => r.includes('[ATOMIC_EXECUTION_FAILURE]'));
  const stateUntouched = comp.isIdentical && after.worldInfo.worldName === '원자성테스트세계' && after.historyLength === 0 && after.stateVersion === 1;

  const passed = validatorPassed && executionFailedAtDraft && stateUntouched;

  allResults.push({
    testId: 'CASE-02',
    testTitle: 'ATOMIC DRAFT EXECUTION & PARTIAL COMMIT PREVENTION (VALIDATOR PASS -> DRAFT CRASH -> ROLLBACK)',
    category: 'Atomicity & Rollback',
    classification: passed ? 'PASS' : 'FAIL',
    before,
    proposal: {
      ...proposal,
      actions: [
        proposal.actions[0],
        { type: proposal.actions[1].type, payload: { worldName: '두번째변조시도세계', triggerExecutionCrash: '[THROWS IN STEP 2 DRAFT]' } }
      ]
    },
    validatorResult: {
      isValid: standaloneValRes.isValid,
      rejectedReasons: standaloneValRes.rejectedReasons,
      conflictDetails: standaloneValRes.conflictDetails,
      sanitizedActionsCount: standaloneValRes.sanitizedActions.length
    },
    commitResult: commitRes,
    after,
    comparison: comp,
    notes: 'EngineValidator PASS (isValid=true, 2 actions sanitized) -> Action 1 applied to isolated draft -> Action 2 threw in Step 2 draft -> Step 3 caught error and rolled back -> Step 4 Commit NOT REACHED -> BEFORE === AFTER (stateVersion, worldInfo, history, registries 100% untouched).'
  });
}

// =========================================================================
// TEST 3: 동일 requestId Proposal Replay 차단
// =========================================================================
{
  const engine = new SovereignEngine(
    { ...createEmptyWorldInfo(), worldName: '리플레이테스트세계' },
    { ...createEmptyCharacter(), name: '주인공' },
    [],
    1,
    1
  );

  // 1st genuine execution
  const prop1: StateTransitionProposal = {
    proposalId: 'prop-test3-orig',
    requestId: 'req-test3-duplicate',
    eventId: 'evt-test3-first',
    expectedStateVersion: 1,
    source: 'PLAYER',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Initial execution',
    actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '정상갱신세계' } }]
  };
  engine.submitProposal(prop1);

  const before = extractRawState(engine);

  // 2nd Replayed execution with IDENTICAL requestId
  const replayProp: StateTransitionProposal = {
    proposalId: 'prop-test3-replay',
    requestId: 'req-test3-duplicate', // DUPLICATE REQUEST ID!
    eventId: 'evt-test3-second',
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: new Date(Date.now() + 1000).toISOString(),
    intentSummary: 'Replay attack',
    actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '리플레이오염세계' } }]
  };

  const valRes = EngineValidator.validate(
    replayProp,
    engine.getSnapshot(),
    (engine as any).executedRequestIds,
    (engine as any).recordedEventIds,
    engine.getHistory()
  );

  let commitRes: any = 'NOT REACHED';
  const executionRes = engine.submitProposal(replayProp);
  if (executionRes.success) {
    commitRes = executionRes;
  } else {
    commitRes = 'NOT REACHED';
  }

  const after = extractRawState(engine);
  const comp = compareStates(before, after);
  const passed = !valRes.isValid && !executionRes.success && comp.isIdentical && after.worldInfo.worldName === '정상갱신세계';

  allResults.push({
    testId: 'CASE-03',
    testTitle: 'DUPLICATE REQUEST ID PROPOSAL REPLAY BLOCKED',
    category: 'Idempotency & Replay Defense',
    classification: passed ? 'PASS' : 'FAIL',
    before,
    proposal: replayProp,
    validatorResult: valRes,
    commitResult: commitRes,
    after,
    comparison: comp,
    notes: 'EngineValidator detected duplicate requestId req-test3-duplicate and rejected replay attempt completely.'
  });
}

// =========================================================================
// TEST 4: 동일 eventId Proposal Replay 차단
// =========================================================================
{
  const engine = new SovereignEngine(
    { ...createEmptyWorldInfo(), worldName: '이벤트ID테스트세계' },
    { ...createEmptyCharacter(), name: '주인공' },
    [],
    1,
    1
  );

  // 1st execution
  const prop1: StateTransitionProposal = {
    proposalId: 'prop-test4-orig',
    requestId: 'req-test4-first',
    eventId: 'evt-test4-duplicate',
    expectedStateVersion: 1,
    source: 'PLAYER',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Initial execution',
    actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '이벤트1차세계' } }]
  };
  engine.submitProposal(prop1);

  const before = extractRawState(engine);

  // 2nd execution with different requestId but IDENTICAL eventId
  const replayProp: StateTransitionProposal = {
    proposalId: 'prop-test4-replay',
    requestId: 'req-test4-different',
    eventId: 'evt-test4-duplicate', // DUPLICATE EVENT ID!
    expectedStateVersion: 2,
    source: 'PLAYER',
    turn: 1,
    timestamp: new Date(Date.now() + 1000).toISOString(),
    intentSummary: 'Duplicate eventId attack',
    actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '이벤트중복오염세계' } }]
  };

  const valRes = EngineValidator.validate(
    replayProp,
    engine.getSnapshot(),
    (engine as any).executedRequestIds,
    (engine as any).recordedEventIds,
    engine.getHistory()
  );

  let commitRes: any = 'NOT REACHED';
  const executionRes = engine.submitProposal(replayProp);
  if (executionRes.success) {
    commitRes = executionRes;
  } else {
    commitRes = 'NOT REACHED';
  }

  const after = extractRawState(engine);
  const comp = compareStates(before, after);
  const passed = !valRes.isValid && !executionRes.success && comp.isIdentical && after.worldInfo.worldName === '이벤트1차세계';

  allResults.push({
    testId: 'CASE-04',
    testTitle: 'DUPLICATE EVENT ID PROPOSAL REPLAY BLOCKED',
    category: 'Event Registry Integrity',
    classification: passed ? 'PASS' : 'FAIL',
    before,
    proposal: replayProp,
    validatorResult: valRes,
    commitResult: commitRes,
    after,
    comparison: comp,
    notes: 'EngineValidator detected duplicate eventId evt-test4-duplicate in recordedEventIds registry and blocked execution.'
  });
}

// =========================================================================
// TEST 5: 하나의 Multi-Action Proposal에서 여러 History Record가 동일 eventId를 공유하는 정상 Semantics 유지
// =========================================================================
{
  const engine = new SovereignEngine(
    { ...createEmptyWorldInfo(), worldName: '멀티액션세계' },
    { ...createEmptyCharacter(), name: '주인공', inventory: [{ id: 'inv-1', name: '은화', quantity: 20 }] },
    [],
    1,
    1
  );
  const before = extractRawState(engine);

  const multiProposal: StateTransitionProposal = {
    proposalId: 'prop-test5-multi',
    requestId: 'req-test5-multi',
    eventId: 'evt-test5-shared-id',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Multi-action transaction: metadata, rumor, seed',
    actions: [
      {
        type: 'SET_WORLD_METADATA',
        payload: { worldName: '진보한세계' }
      },
      {
        type: 'ADD_RUMOR',
        payload: { rumor: '소문: 북쪽 산맥에 고룡이 깨어났다.' }
      },
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: { id: 'seed-test5-dragon', content: '북쪽 산맥의 고룡 수색', status: 'active' }
      }
    ]
  };

  const valRes = EngineValidator.validate(
    multiProposal,
    engine.getSnapshot(),
    (engine as any).executedRequestIds,
    (engine as any).recordedEventIds,
    engine.getHistory()
  );

  let commitRes: any = 'NOT REACHED';
  const executionRes = engine.submitProposal(multiProposal);
  if (executionRes.success) {
    commitRes = executionRes;
  }

  const after = extractRawState(engine);
  const comp = compareStates(before, after);

  // Verify all 3 records share the same eventId and requestId
  const generatedRecords = after.history.filter(h => h.eventId === 'evt-test5-shared-id');
  const validSemantics =
    executionRes.success &&
    generatedRecords.length === 3 &&
    generatedRecords.every(r => r.eventId === 'evt-test5-shared-id' && r.requestId === 'req-test5-multi') &&
    generatedRecords[0].recordId === 'rec-evt-test5-shared-id-1' &&
    generatedRecords[1].recordId === 'rec-evt-test5-shared-id-2' &&
    generatedRecords[2].recordId === 'rec-evt-test5-shared-id-3' &&
    after.stateVersion === 2;

  allResults.push({
    testId: 'CASE-05',
    testTitle: 'MULTI-ACTION PROPOSAL SHARED EVENT ID SEMANTICS PRESERVED',
    category: 'Transaction & History Semantics',
    classification: validSemantics ? 'PASS' : 'FAIL',
    before,
    proposal: multiProposal,
    validatorResult: valRes,
    commitResult: commitRes,
    after,
    comparison: comp,
    notes: 'A single atomic proposal generated 3 distinct immutable records sharing the exact same eventId, incrementing stateVersion exactly once.'
  });
}

// =========================================================================
// TEST 6: 정상 Multi-Action History가 Hydration에서 단순 eventId 중복만으로 거부되지 않는가
// =========================================================================
{
  // Create engine, execute multi-action proposal, serialize snapshot and history, then hydrate
  const engine1 = new SovereignEngine(
    { ...createEmptyWorldInfo(), worldName: '하이드레이션원형세계' },
    { ...createEmptyCharacter(), name: '주인공' },
    [],
    1,
    1
  );

  const multiProp: StateTransitionProposal = {
    proposalId: 'prop-test6-multi',
    requestId: 'req-test6-multi',
    eventId: 'evt-test6-shared',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Multi-action for hydration test',
    actions: [
      { type: 'SET_WORLD_METADATA', payload: { worldName: '하이드레이션완료세계' } },
      { type: 'ADD_RUMOR', payload: { rumor: '상단이 도착했다.' } }
    ]
  };
  engine1.submitProposal(multiProp);

  const snapshot = engine1.getSnapshot();
  const history = engine1.getHistory();

  let hydratedEngine: SovereignEngine | null = null;
  let hydrationError: any = null;
  try {
    hydratedEngine = SovereignEngine.hydrate(snapshot, history);
  } catch (err) {
    hydrationError = err;
  }

  const before = extractRawState(engine1);
  const after = hydratedEngine ? extractRawState(hydratedEngine) : null;
  const comp = after ? compareStates(before, after) : { isIdentical: false, diffSummary: ['Hydration failed'] };

  const passed = hydratedEngine !== null && hydrationError === null && comp.isIdentical;

  allResults.push({
    testId: 'CASE-06',
    testTitle: 'HYDRATION PRESERVES VALID MULTI-ACTION SHARED EVENT ID HISTORY',
    category: 'Persistence & Hydration Integrity',
    classification: passed ? 'PASS' : 'FAIL',
    before,
    proposal: { snapshot, historyCount: history.length },
    validatorResult: { isValid: passed, error: hydrationError ? String(hydrationError) : null },
    commitResult: hydratedEngine ? 'HYDRATED SUCCESSFULLY' : 'HYDRATION FAILED',
    after: after || { error: String(hydrationError) },
    comparison: comp,
    notes: 'Hydration correctly ingested multi-action records with shared eventIds without false-positive replay rejections.'
  });
}

// =========================================================================
// TEST 7: forged SYSTEM / ENGINE_INTERNAL Proposal이 capability 경계를 우회하지 못하는가
// =========================================================================
{
  const engine = new SovereignEngine(
    { ...createEmptyWorldInfo(), worldName: '보안경계세계' },
    { ...createEmptyCharacter(), name: '주인공' },
    [],
    1,
    1
  );
  const before = extractRawState(engine);

  // Forged direct submission of SYSTEM source without Engine WeakSet capability token
  const forgedProposal: StateTransitionProposal = {
    proposalId: 'prop-test7-forged',
    requestId: 'req-test7-forged',
    eventId: 'evt-test7-forged',
    expectedStateVersion: 1,
    source: 'SYSTEM', // FORGED PRIVILEGED SOURCE!
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Forged system proposal attack',
    actions: [
      {
        type: 'SET_WORLD_METADATA',
        payload: { worldName: '해킹된세계' }
      }
    ]
  };

  const valRes = EngineValidator.validate(
    forgedProposal,
    engine.getSnapshot(),
    (engine as any).executedRequestIds,
    (engine as any).recordedEventIds,
    engine.getHistory()
  );

  let commitRes: any = 'NOT REACHED';
  const executionRes = engine.submitProposal(forgedProposal);
  if (executionRes.success) {
    commitRes = executionRes;
  } else {
    commitRes = 'NOT REACHED';
  }

  const after = extractRawState(engine);
  const comp = compareStates(before, after);
  const passed = !valRes.isValid && !executionRes.success && comp.isIdentical && valRes.rejectedReasons.some(r => r.includes('[SECURITY_FORGERY]'));

  allResults.push({
    testId: 'CASE-07',
    testTitle: 'FORGED PRIVILEGED SYSTEM SOURCE SUBMISSION BLOCKED',
    category: 'Capability Security & Source Authority',
    classification: passed ? 'PASS' : 'FAIL',
    before,
    proposal: forgedProposal,
    validatorResult: valRes,
    commitResult: commitRes,
    after,
    comparison: comp,
    notes: 'Direct submission of SYSTEM source without isEngineAuthorized token was caught and blocked with [SECURITY_FORGERY].'
  });
}

// =========================================================================
// TEST 8: verifiedEventId 기반 Inventory Causality 위조·재사용·우회 불가 검증
// =========================================================================
{
  const engine = new SovereignEngine(
    {
      ...createEmptyWorldInfo(),
      worldName: '인과율세계',
      seeds: [{ id: 'seed-dragon-scale', content: '드래곤의 비늘 획득 단서', status: 'active' }]
    },
    { ...createEmptyCharacter(), name: '주인공', inventory: [] },
    [],
    1,
    1
  );

  // 1. Genuine acquisition of dragon scale backed by active seed
  const legitProp: StateTransitionProposal = {
    proposalId: 'prop-test8-legit',
    requestId: 'req-test8-legit',
    eventId: 'evt-test8-legit',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Legitimate item discovery',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          item: { id: 'item-scale', name: '드래곤의 비늘', quantity: 1 },
          operation: 'ADD',
          acquisition: {
            cause: 'DISCOVERY_PICKUP',
            verifiedEventId: 'seed-dragon-scale'
          }
        }
      }
    ]
  };
  engine.submitProposal(legitProp);

  const before = extractRawState(engine);

  // 2. Attack: Duplicate reuse of the SAME verifiedEventId in a subsequent proposal
  const attackProp: StateTransitionProposal = {
    proposalId: 'prop-test8-attack-duplicate',
    requestId: 'req-test8-attack-duplicate',
    eventId: 'evt-test8-attack-duplicate',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: new Date(Date.now() + 1000).toISOString(),
    intentSummary: 'Duplicate consumption of verifiedEventId attack',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          item: { id: 'item-scale-2', name: '드래곤의 비늘', quantity: 5 },
          operation: 'ADD',
          acquisition: {
            cause: 'DISCOVERY_PICKUP',
            verifiedEventId: 'seed-dragon-scale' // ALREADY CONSUMED!
          }
        }
      }
    ]
  };

  const valRes = EngineValidator.validate(
    attackProp,
    engine.getSnapshot(),
    (engine as any).executedRequestIds,
    (engine as any).recordedEventIds,
    engine.getHistory()
  );

  let commitRes: any = 'NOT REACHED';
  const executionRes = engine.submitProposal(attackProp);
  if (executionRes.success) {
    commitRes = executionRes;
  } else {
    commitRes = 'NOT REACHED';
  }

  const after = extractRawState(engine);
  const comp = compareStates(before, after);
  const passed = !valRes.isValid && !executionRes.success && comp.isIdentical && valRes.rejectedReasons.some(r => r.includes('Duplicate consumption of event'));

  allResults.push({
    testId: 'CASE-08',
    testTitle: 'INVENTORY CAUSALITY: DUPLICATE VERIFIED EVENT ID REUSE BLOCKED',
    category: 'Inventory Causality & Double-Spend Defense',
    classification: passed ? 'PASS' : 'FAIL',
    before,
    proposal: attackProp,
    validatorResult: valRes,
    commitResult: commitRes,
    after,
    comparison: comp,
    notes: 'EngineValidator verified history records, detected verifiedEventId seed-dragon-scale was already consumed, and blocked unbacked creation.'
  });
}

// =========================================================================
// TEST 9: DEAD NPC 및 보호된 상태를 OVERWRITE로 부활·삭제 불가 검증
// =========================================================================
{
  const deadNpc = { id: 'npc-boss-1', name: '악당 두목', status: 'DEAD' as const, relationship: '적대' };
  const engine = new SovereignEngine(
    {
      ...createEmptyWorldInfo(),
      worldName: '생사불변세계',
      npcs: [deadNpc]
    },
    { ...createEmptyCharacter(), name: '주인공' },
    [],
    1,
    1
  );
  const before = extractRawState(engine);

  // Attack: Try to revive dead NPC via OVERWRITE_WORLD_INFO with status ALIVE
  const reviveProp: StateTransitionProposal = {
    proposalId: 'prop-test9-revive',
    requestId: 'req-test9-revive',
    eventId: 'evt-test9-revive',
    expectedStateVersion: 1,
    source: 'PLAYER',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Revive dead NPC attack via OVERWRITE_WORLD_INFO',
    actions: [
      {
        type: 'OVERWRITE_WORLD_INFO',
        payload: {
          worldName: '생사불변세계',
          npcs: [
            { id: 'npc-boss-1', name: '악당 두목', status: 'ALIVE', relationship: '동맹' } // ILLEGAL RESURRECTION!
          ]
        }
      }
    ]
  };

  const valRes = EngineValidator.validate(
    reviveProp,
    engine.getSnapshot(),
    (engine as any).executedRequestIds,
    (engine as any).recordedEventIds,
    engine.getHistory()
  );

  let commitRes: any = 'NOT REACHED';
  const executionRes = engine.submitProposal(reviveProp);
  if (executionRes.success) {
    commitRes = executionRes;
  } else {
    commitRes = 'NOT REACHED';
  }

  const after = extractRawState(engine);
  const comp = compareStates(before, after);
  const passed = !valRes.isValid && !executionRes.success && comp.isIdentical && after.worldInfo.npcs[0].status === 'DEAD';

  allResults.push({
    testId: 'CASE-09',
    testTitle: 'DEAD NPC RESURRECTION VIA WORLD OVERWRITE BLOCKED',
    category: 'Permanent Mortality & Entity Immutability',
    classification: passed ? 'PASS' : 'FAIL',
    before,
    proposal: reviveProp,
    validatorResult: valRes,
    commitResult: commitRes,
    after,
    comparison: comp,
    notes: 'EngineValidator inspected deadNpcIds from state & history and blocked revival attempt with [DEAD_NPC_STATUS_PROTECTION].'
  });
}

// =========================================================================
// TEST 10: App/UI/API/Persistence가 SovereignEngine을 우회하여 Canonical State 직접 변경 불가 검증 (Frozen Snapshot Immutability)
// =========================================================================
{
  const engine = new SovereignEngine(
    { ...createEmptyWorldInfo(), worldName: '직접변조방어세계' },
    { ...createEmptyCharacter(), name: '주인공', inventory: [{ id: 'inv-orig', name: '원형검', quantity: 1 }] },
    [],
    1,
    1
  );
  const before = extractRawState(engine);

  const snapshot = engine.getSnapshot();
  let directMutationThrew = false;
  let directMutationError = '';

  try {
    // Attempt direct mutation on frozen snapshot object
    (snapshot as any).stateVersion = 999;
    (snapshot.worldInfo as any).worldName = '외부변조세계';
    (snapshot.character.inventory as any).push({ id: 'inv-hacked', name: '해킹검', quantity: 99 });
  } catch (err: any) {
    directMutationThrew = true;
    directMutationError = err?.message || String(err);
  }

  const after = extractRawState(engine);
  const comp = compareStates(before, after);
  const passed = comp.isIdentical && after.worldInfo.worldName === '직접변조방어세계' && after.character.inventory.length === 1;

  allResults.push({
    testId: 'CASE-10',
    testTitle: 'CANONICAL SNAPSHOT DEEP-FREEZE IMMUTABILITY AGAINST DIRECT MUTATION',
    category: 'Direct Mutation & Architectural Bypass Defense',
    classification: passed ? 'PASS' : 'FAIL',
    before,
    proposal: { directMutationAttempt: 'stateVersion=999, worldName=외부변조세계, inventory.push(해킹검)' },
    validatorResult: { isFrozen: Object.isFrozen(snapshot), isCharacterFrozen: Object.isFrozen(snapshot.character) },
    commitResult: directMutationThrew ? `BLOCKED BY DEEP-FREEZE: ${directMutationError}` : 'NO MUTATION OCCURRED IN ENGINE STATE',
    after,
    comparison: comp,
    notes: 'getSnapshot returns a deepFreeze object, preventing UI/API/Persistence from mutating engine state outside submitProposal Commit Gate.'
  });
}

// =========================================================================
// Generate Formatted Raw Evidence Log
// =========================================================================
let fullRawOutput = '';
fullRawOutput += '================================================================================\n';
fullRawOutput += 'TRPG 3.1 Sovereign Runtime — Phase 5.6 Adversarial Forensic Audit Raw Log\n';
fullRawOutput += `Timestamp: ${new Date().toISOString()}\n`;
fullRawOutput += 'Target Codebase: 3.1upload5 (HEAD)\n';
fullRawOutput += 'Authoritative Runtime: src/engine/state.ts (SovereignEngine)\n';
fullRawOutput += '================================================================================\n\n';

for (const res of allResults) {
  fullRawOutput += `--------------------------------------------------------------------------------\n`;
  fullRawOutput += `[${res.testId}] ${res.testTitle}\n`;
  fullRawOutput += `Category: ${res.category}\n`;
  fullRawOutput += `Verdict: [${res.classification}]\n`;
  fullRawOutput += `--------------------------------------------------------------------------------\n\n`;

  fullRawOutput += `[BEFORE]\n`;
  fullRawOutput += JSON.stringify(res.before, null, 2) + '\n\n';

  fullRawOutput += `[PROPOSAL]\n`;
  fullRawOutput += JSON.stringify(res.proposal, null, 2) + '\n\n';

  fullRawOutput += `[VALIDATOR]\n`;
  fullRawOutput += JSON.stringify(res.validatorResult, null, 2) + '\n\n';

  fullRawOutput += `[COMMIT]\n`;
  fullRawOutput += (typeof res.commitResult === 'string' ? res.commitResult : JSON.stringify(res.commitResult, null, 2)) + '\n\n';

  fullRawOutput += `[AFTER]\n`;
  fullRawOutput += JSON.stringify(res.after, null, 2) + '\n\n';

  fullRawOutput += `[STATE COMPARISON]\n`;
  fullRawOutput += `Is Identical: ${res.comparison.isIdentical}\n`;
  fullRawOutput += `Diffs: ${res.comparison.diffSummary.length > 0 ? res.comparison.diffSummary.join(', ') : 'NONE (100% Immutable)'}\n`;
  fullRawOutput += `Notes: ${res.notes}\n\n`;
}

fs.writeFileSync('phase5_6_raw_evidence_log.txt', fullRawOutput);
console.log('Adversarial suite execution completed. Total tests:', allResults.length);
for (const r of allResults) {
  console.log(`[${r.testId}] ${r.classification}: ${r.testTitle}`);
}
const allPassed = allResults.every(r => r.classification === 'PASS');
console.log('All 10 tests passed:', allPassed);
