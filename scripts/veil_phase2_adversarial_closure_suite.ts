import { SovereignEngine } from '../src/engine/state.ts';
import { EngineValidator } from '../src/engine/validator.ts';
import { extractCandidatesFromMetadata } from '../src/utils/engineValidator.ts';
import { buildSafeProposalFromCandidate } from '../src/engine/proposalParser.ts';
import { validateLLM2MutationBoundary } from '../src/engine/mutationBoundary.ts';
import { CanonicalState, StateTransitionProposal, StateTransitionAction } from '../src/engine/types.ts';
import { createEmptyWorldInfo, createEmptyCharacter } from '../src/utils/factory.ts';

interface TestResult {
  suite: string;
  testId: string;
  testTitle: string;
  classification: 'VERIFIED' | 'UNVERIFIED' | 'FAIL' | 'TEST-PRECONDITION CONFLICT';
  sourceLine: string;
  attackDescription: string;
  expectedBehavior: string;
  actualBehavior: string;
  pass: boolean;
}

const results: TestResult[] = [];

function recordResult(r: TestResult) {
  results.push(r);
  const icon = r.pass ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} [${r.suite}] ${r.testId}: ${r.testTitle} -> ${r.classification}`);
  if (!r.pass) {
    console.log(`    Expected: ${r.expectedBehavior}`);
    console.log(`    Actual:   ${r.actualBehavior}`);
  }
}

const dummySnapshot: CanonicalState = {
  stateVersion: 1,
  turn: 1,
  worldInfo: {
    ...createEmptyWorldInfo(),
    worldName: '적대적폐쇄세계',
    settingDescription: '적대적 검증 세계관',
    currentTime: { year: 100, month: 1, day: 1, timeOfDay: 'MORNING', formattedTime: '100년 1월 1일 아침' },
    chapters: { currentChapter: '서막', upcomingChapters: ['1장', '2장', '3장'] },
    npcs: [{ id: 'npc-1', name: '장삼', status: 'ALIVE', affinity: 10, details: '마을 상인' }],
    factions: [{ id: 'fac-1', name: '청운파', status: 'ACTIVE', influence: 50 }],
    seeds: [{ id: 'seed-1', title: '산적들의 준동', content: '산적 무리', status: 'active' }]
  } as any,
  character: {
    ...createEmptyCharacter(),
    name: '주인공',
    stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    inventory: [{ id: 'inv-gold-1', name: '은화', quantity: 20 }]
  } as any,
  lastCommittedEventId: null,
  lastCommittedAt: new Date().toISOString()
};

console.log('================================================================');
console.log('TRPG 3.1 — VEIL 2차 적대적 검증 및 구조적 폐쇄 테스트 스위트');
console.log('================================================================\n');

// =========================================================================
// SECTION A: Mutation Boundary (FinalProposal.Mutations ⊆ ApprovedCandidate.Mutations)
// =========================================================================

// A1: Selected candidate binding (Candidate 1 approved vs Final Proposal)
{
  const candProposal: StateTransitionProposal = {
    proposalId: 'prop-cand-1',
    requestId: 'req-cand-1',
    eventId: 'evt-cand-1',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Acquire herbal medicine',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'inv-herb-1', name: '지혈초', quantity: 1 },
          acquisition: { cause: 'RESOURCE_EXCHANGE', verifiedEventId: 'evt-cand-1', cost: { name: '은화', quantity: 5 } }
        }
      }
    ]
  };

  const validFinal: StateTransitionProposal = {
    ...candProposal,
    proposalId: 'prop-final-1'
  };

  const check = validateLLM2MutationBoundary(candProposal, validFinal);
  recordResult({
    suite: 'MUTATION_BOUNDARY',
    testId: 'MB-01',
    testTitle: 'Approved candidate exact semantic match passes',
    classification: check.isValid ? 'VERIFIED' : 'FAIL',
    sourceLine: 'src/engine/mutationBoundary.ts',
    attackDescription: 'Candidate 1 exact match final proposal',
    expectedBehavior: 'isValid === true, violationReasons empty',
    actualBehavior: `isValid === ${check.isValid}, violations: ${check.violationReasons.join('; ')}`,
    pass: check.isValid
  });
}

// A2: Cross-candidate mutation mixing (Candidate A action + Candidate B action)
{
  const candA: StateTransitionProposal = {
    proposalId: 'prop-cand-A',
    requestId: 'req-cand-A',
    eventId: 'evt-cand-A',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Candidate A: Add medicine',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'inv-herb-1', name: '지혈초', quantity: 1 },
          acquisition: { cause: 'RESOURCE_EXCHANGE', verifiedEventId: 'evt-cand-A' }
        }
      }
    ]
  };

  const stitchedFinal: StateTransitionProposal = {
    proposalId: 'prop-final-stitched',
    requestId: 'req-final-stitched',
    eventId: 'evt-final-stitched',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Stitched: Candidate A medicine + Candidate B sword',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'inv-herb-1', name: '지혈초', quantity: 1 },
          acquisition: { cause: 'RESOURCE_EXCHANGE', verifiedEventId: 'evt-cand-A' }
        }
      },
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'inv-sword-1', name: '청강검', quantity: 1 },
          acquisition: { cause: 'FOUND', verifiedEventId: 'evt-cand-B' }
        }
      }
    ]
  };

  const check = validateLLM2MutationBoundary(candA, stitchedFinal);
  const blocked = !check.isValid && check.violationReasons.some(r => r.includes('청강검') || r.includes('MUTATION_BOUNDARY_VIOLATION'));
  recordResult({
    suite: 'MUTATION_BOUNDARY',
    testId: 'MB-02',
    testTitle: 'Cross-Candidate Mutation Mixing (Stitching) Blocked',
    classification: blocked ? 'VERIFIED' : 'FAIL',
    sourceLine: 'src/engine/mutationBoundary.ts',
    attackDescription: 'Candidate A selected, final proposal appends Candidate B item (청강검)',
    expectedBehavior: 'isValid === false, reject stitched action from candidate B',
    actualBehavior: `isValid === ${check.isValid}, violations: ${check.violationReasons.join('; ')}`,
    pass: blocked
  });
}

// A3: Item ID mutation / omission
{
  const candProposal: StateTransitionProposal = {
    proposalId: 'prop-cand-id',
    requestId: 'req-cand-id',
    eventId: 'evt-cand-id',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Add item with specific ID',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'inv-item-authentic-100', name: '영약', quantity: 1 },
          acquisition: { cause: 'FOUND', verifiedEventId: 'evt-cand-id' }
        }
      }
    ]
  };

  const forgedIdFinal: StateTransitionProposal = {
    ...candProposal,
    proposalId: 'prop-final-forged-id',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'inv-item-forged-999', name: '영약', quantity: 1 },
          acquisition: { cause: 'FOUND', verifiedEventId: 'evt-cand-id' }
        }
      }
    ]
  };

  const check = validateLLM2MutationBoundary(candProposal, forgedIdFinal);
  const blocked = !check.isValid && check.violationReasons.some(r => r.includes('id') || r.includes('MUTATION_BOUNDARY_VIOLATION'));
  recordResult({
    suite: 'MUTATION_BOUNDARY',
    testId: 'MB-03',
    testTitle: 'Item ID Tampering/Substitution Blocked',
    classification: blocked ? 'VERIFIED' : 'FAIL',
    sourceLine: 'src/engine/mutationBoundary.ts:50-89',
    attackDescription: 'Same item name but forged item ID (inv-item-forged-999)',
    expectedBehavior: 'isValid === false, ID mismatch caught',
    actualBehavior: `isValid === ${check.isValid}, violations: ${check.violationReasons.join('; ')}`,
    pass: blocked
  });
}

// A4: NPC ID/Name OR-match bypass attempt (Altering status to DEAD or unapproved fields)
{
  const candProposal: StateTransitionProposal = {
    proposalId: 'prop-cand-npc',
    requestId: 'req-cand-npc',
    eventId: 'evt-cand-npc',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Update NPC affinity',
    actions: [
      {
        type: 'UPDATE_NPC',
        payload: {
          id: 'npc-1',
          name: '장삼',
          affinity: 15,
          status: 'ALIVE'
        }
      }
    ]
  };

  const hostileNpcFinal: StateTransitionProposal = {
    ...candProposal,
    proposalId: 'prop-final-npc-dead',
    actions: [
      {
        type: 'UPDATE_NPC',
        payload: {
          id: 'npc-1',
          name: '장삼',
          affinity: 15,
          status: 'DEAD', // Sneaked assassination!
          details: '사망함'
        }
      }
    ]
  };

  const check = validateLLM2MutationBoundary(candProposal, hostileNpcFinal);
  const blocked = !check.isValid && check.violationReasons.some(r => r.includes('NPC') || r.includes('status') || r.includes('MUTATION_BOUNDARY_VIOLATION'));
  recordResult({
    suite: 'MUTATION_BOUNDARY',
    testId: 'MB-04',
    testTitle: 'NPC Payload Tampering (Sneak Status Change) Blocked',
    classification: blocked ? 'VERIFIED' : 'FAIL',
    sourceLine: 'src/engine/mutationBoundary.ts:120-138',
    attackDescription: 'Candidate updated affinity with ALIVE, Final changed status to DEAD',
    expectedBehavior: 'isValid === false, status/payload mismatch rejected',
    actualBehavior: `isValid === ${check.isValid}, violations: ${check.violationReasons.join('; ')}`,
    pass: blocked
  });
}

// A5: Payload arbitrary field addition/injection
{
  const candProposal: StateTransitionProposal = {
    proposalId: 'prop-cand-clean',
    requestId: 'req-cand-clean',
    eventId: 'evt-cand-clean',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Clean seed update',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-10',
          title: '새로운 징조',
          content: '서쪽에서 일어난 연기'
        }
      }
    ]
  };

  const injectedFinal: StateTransitionProposal = {
    ...candProposal,
    proposalId: 'prop-final-injected',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-10',
          title: '새로운 징조',
          content: '서쪽에서 일어난 연기',
          unapprovedAdminPrivilege: true,
          arbitraryScoreBoost: 999
        }
      }
    ]
  };

  const check = validateLLM2MutationBoundary(candProposal, injectedFinal);
  const blocked = !check.isValid;
  recordResult({
    suite: 'MUTATION_BOUNDARY',
    testId: 'MB-05',
    testTitle: 'Payload Arbitrary Property Injection Blocked',
    classification: blocked ? 'VERIFIED' : 'FAIL',
    sourceLine: 'src/engine/mutationBoundary.ts:140-157',
    attackDescription: 'Inject arbitrary fields (unapprovedAdminPrivilege) into seed payload',
    expectedBehavior: 'isValid === false, reject unapproved payload properties',
    actualBehavior: `isValid === ${check.isValid}, violations: ${check.violationReasons.join('; ')}`,
    pass: blocked
  });
}

// A6: Acquisition Cost Tampering (Removing or reducing cost)
{
  const candProposal: StateTransitionProposal = {
    proposalId: 'prop-cand-cost',
    requestId: 'req-cand-cost',
    eventId: 'evt-cand-cost',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Buy sword for 10 silver',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'inv-sword-1', name: '청강검', quantity: 1 },
          acquisition: {
            cause: 'RESOURCE_EXCHANGE',
            verifiedEventId: 'evt-cand-cost',
            cost: { name: '은화', quantity: 10 }
          }
        }
      }
    ]
  };

  const tamperedCostFinal: StateTransitionProposal = {
    ...candProposal,
    proposalId: 'prop-final-tampered-cost',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'inv-sword-1', name: '청강검', quantity: 1 },
          acquisition: {
            cause: 'RESOURCE_EXCHANGE',
            verifiedEventId: 'evt-cand-cost',
            cost: { name: '은화', quantity: 1 } // Reduced from 10 to 1!
          }
        }
      }
    ]
  };

  const check = validateLLM2MutationBoundary(candProposal, tamperedCostFinal);
  const blocked = !check.isValid && check.violationReasons.some(r => r.includes('cost') || r.includes('MUTATION_BOUNDARY_VIOLATION'));
  recordResult({
    suite: 'MUTATION_BOUNDARY',
    testId: 'MB-06',
    testTitle: 'Acquisition Cost Tampering (Cost Reduction) Blocked',
    classification: blocked ? 'VERIFIED' : 'FAIL',
    sourceLine: 'src/engine/mutationBoundary.ts:72-88',
    attackDescription: 'Candidate required 10 silver cost, Final reduced cost to 1 silver',
    expectedBehavior: 'isValid === false, cost discrepancy caught',
    actualBehavior: `isValid === ${check.isValid}, violations: ${check.violationReasons.join('; ')}`,
    pass: blocked
  });
}

// A7: Action Duplication (Multiplying single candidate action into 5 actions)
{
  const candProposal: StateTransitionProposal = {
    proposalId: 'prop-cand-single',
    requestId: 'req-cand-single',
    eventId: 'evt-cand-single',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Add single herb',
    actions: [
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: { id: 'inv-herb-1', name: '지혈초', quantity: 1 },
          acquisition: { cause: 'FOUND', verifiedEventId: 'evt-cand-single' }
        }
      }
    ]
  };

  const duplicatedFinal: StateTransitionProposal = {
    ...candProposal,
    proposalId: 'prop-final-multiplied',
    actions: [
      candProposal.actions[0],
      candProposal.actions[0],
      candProposal.actions[0],
      candProposal.actions[0],
      candProposal.actions[0] // 5 identical actions to multiply quantity by 5x
    ]
  };

  const check = validateLLM2MutationBoundary(candProposal, duplicatedFinal);
  const blocked = !check.isValid;
  recordResult({
    suite: 'MUTATION_BOUNDARY',
    testId: 'MB-07',
    testTitle: 'Action Duplication Multiplication Attack Blocked',
    classification: blocked ? 'VERIFIED' : 'FAIL',
    sourceLine: 'src/engine/mutationBoundary.ts',
    attackDescription: 'Candidate had 1 action, Final duplicated it 5 times',
    expectedBehavior: 'isValid === false, cardinality or 1-to-1 matching violation',
    actualBehavior: `isValid === ${check.isValid}, violations: ${check.violationReasons.join('; ')}`,
    pass: blocked
  });
}

// =========================================================================
// SECTION B: PreAuth Boundary (Side-Effect Freeness & Independent Evaluation)
// =========================================================================

// B1: PreAuth Side-Effect Freeness (Canonical state completely untouched)
{
  const engine = new SovereignEngine(
    dummySnapshot.worldInfo,
    dummySnapshot.character,
    [],
    1,
    1
  );

  const stateBefore = JSON.stringify(engine.getSnapshot());
  const historyBefore = engine.getHistory().length;

  const rawMetadata = {
    candidate1: { foreshadowSeeds: ['후보1 복선'] },
    candidate2: { itemAcquisition: { name: '환각검', quantity: 1, cause: 'UNVERIFIED' } }, // invalid
    candidate3: { upcomingChapters: ['1장', '2장', '3장'] }
  };

  const cand1 = extractCandidatesFromMetadata(rawMetadata.candidate1 as any, 1, '100년 1월 1일 아침');
  const cand2 = extractCandidatesFromMetadata(rawMetadata.candidate2 as any, 1, '100년 1월 1일 아침');
  const cand3 = extractCandidatesFromMetadata(rawMetadata.candidate3 as any, 1, '100년 1월 1일 아침');

  const p1 = buildSafeProposalFromCandidate(engine.getSnapshot(), cand1, 1, []);
  const p2 = buildSafeProposalFromCandidate(engine.getSnapshot(), cand2, 1, []);
  const p3 = buildSafeProposalFromCandidate(engine.getSnapshot(), cand3, 1, []);

  const v1 = EngineValidator.validate(p1, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
  const v2 = EngineValidator.validate(p2, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
  const v3 = EngineValidator.validate(p3, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());

  const stateAfter = JSON.stringify(engine.getSnapshot());
  const historyAfter = engine.getHistory().length;

  const stateUntouched = stateBefore === stateAfter && historyBefore === historyAfter;
  const independentClassification = v1.isValid && !v2.isValid && v3.isValid;

  recordResult({
    suite: 'PRE_AUTH',
    testId: 'PA-01',
    testTitle: 'Pre-Auth Side-Effect Freeness & Independent ALLOW/REJECT',
    classification: stateUntouched && independentClassification ? 'VERIFIED' : 'FAIL',
    sourceLine: 'src/engine/validator.ts',
    attackDescription: 'Evaluate 3 candidates (Valid, Invalid unverified item, Valid chapter)',
    expectedBehavior: 'State 100% frozen, Candidate 1=ALLOW, Candidate 2=REJECT, Candidate 3=ALLOW',
    actualBehavior: `stateUntouched: ${stateUntouched}, C1=${v1.isValid}, C2=${v2.isValid}, C3=${v3.isValid}`,
    pass: stateUntouched && independentClassification
  });
}

// B2: ALL_REJECTED yields Zero Mutations
{
  const engine = new SovereignEngine(
    dummySnapshot.worldInfo,
    dummySnapshot.character,
    [],
    1,
    1
  );

  const rawMetadataAllInvalid = {
    c1: { itemAcquisition: { name: '은화', quantity: 999, cause: 'UNVERIFIED' } },
    c2: { itemAcquisition: { name: '신검', quantity: 1, cause: 'UNVERIFIED' } }
  };

  const cand1 = extractCandidatesFromMetadata(rawMetadataAllInvalid.c1 as any, 1, '100년 1월 1일 아침');
  const cand2 = extractCandidatesFromMetadata(rawMetadataAllInvalid.c2 as any, 1, '100년 1월 1일 아침');

  const p1 = buildSafeProposalFromCandidate(engine.getSnapshot(), cand1, 1, []);
  const p2 = buildSafeProposalFromCandidate(engine.getSnapshot(), cand2, 1, []);

  const v1 = EngineValidator.validate(p1, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
  const v2 = EngineValidator.validate(p2, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());

  const allRejected = !v1.isValid && !v2.isValid;
  const stateVersion = engine.getSnapshot().stateVersion;

  recordResult({
    suite: 'PRE_AUTH',
    testId: 'PA-02',
    testTitle: 'ALL_REJECTED Scenario yields zero state change',
    classification: allRejected && stateVersion === 1 ? 'VERIFIED' : 'FAIL',
    sourceLine: 'src/engine/validator.ts',
    attackDescription: 'All candidates rejected by Pre-Auth Gate',
    expectedBehavior: 'All candidates rejected, stateVersion remains 1',
    actualBehavior: `allRejected=${allRejected}, stateVersion=${stateVersion}`,
    pass: allRejected && stateVersion === 1
  });
}

// =========================================================================
// SECTION C: CASE-02~05 Reconstructed with Valid Source/Action Pairings
// =========================================================================

// C1: Reconstructed CASE-02 (Atomic Draft Execution & Rollback)
{
  const engine = new SovereignEngine(
    { ...createEmptyWorldInfo(), worldName: '원자성테스트세계' },
    { ...createEmptyCharacter(), name: '주인공' },
    [],
    1,
    1
  );

  let shouldCrashInDraft = false;
  const action2Payload: any = {
    rumor: '두번째변조시도'
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
    proposalId: 'prop-c02-atomic',
    requestId: 'req-c02-atomic',
    eventId: 'evt-c02-atomic',
    expectedStateVersion: 1,
    source: 'LLM', // Valid source for ADD_RUMOR
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Multi-action atomic draft failure test with LLM source',
    actions: [
      {
        type: 'ADD_RUMOR',
        payload: { rumor: '첫번째소문' }
      },
      {
        type: 'ADD_RUMOR',
        payload: action2Payload
      }
    ]
  };

  // 1. Validator passes
  shouldCrashInDraft = false;
  const valRes = EngineValidator.validate(
    proposal,
    engine.getSnapshot(),
    (engine as any).executedRequestIds,
    (engine as any).recordedEventIds,
    engine.getHistory()
  );

  // 2. Draft crash during execution
  shouldCrashInDraft = true;
  const execRes = engine.submitProposal(proposal);

  const snapshot = engine.getSnapshot();
  const rumorsCount = (snapshot.worldInfo.publicRumors || []).length;
  const passed = valRes.isValid &&
                 !execRes.success &&
                 execRes.rejectedReasons.some(r => r.includes('[ATOMIC_EXECUTION_FAILURE]')) &&
                 rumorsCount === 0 &&
                 snapshot.stateVersion === 1;

  recordResult({
    suite: 'CORE_5_7',
    testId: 'CASE-02-RECONSTRUCTED',
    testTitle: 'Atomic Draft Execution & Rollback on Mid-Execution Failure',
    classification: passed ? 'VERIFIED' : 'FAIL',
    sourceLine: 'src/engine/state.ts:250-310',
    attackDescription: 'Validator passes, Action 1 applies to draft, Action 2 throws in draft',
    expectedBehavior: 'Validator passes, submitProposal fails with ATOMIC_EXECUTION_FAILURE, state rolled back',
    actualBehavior: `valValid=${valRes.isValid}, execSuccess=${execRes.success}, rumorsCount=${rumorsCount}, reasons: ${execRes.rejectedReasons.join('; ')}`,
    pass: passed
  });
}

// C2: Reconstructed CASE-03 (Duplicate Request ID Proposal Replay Blocked)
{
  const engine = new SovereignEngine(
    { ...createEmptyWorldInfo(), worldName: '리플레이테스트세계' },
    { ...createEmptyCharacter(), name: '주인공' },
    [],
    1,
    1
  );

  const prop1: StateTransitionProposal = {
    proposalId: 'prop-c03-1',
    requestId: 'req-c03-dup',
    eventId: 'evt-c03-1',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Initial execution',
    actions: [{ type: 'ADD_RUMOR', payload: { rumor: '정상소문' } }]
  };
  const exec1 = engine.submitProposal(prop1);

  const prop2Replay: StateTransitionProposal = {
    proposalId: 'prop-c03-2',
    requestId: 'req-c03-dup', // Duplicate Request ID
    eventId: 'evt-c03-2',
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Replay with same requestId',
    actions: [{ type: 'ADD_RUMOR', payload: { rumor: '오염소문' } }]
  };

  const val2 = EngineValidator.validate(
    prop2Replay,
    engine.getSnapshot(),
    (engine as any).executedRequestIds,
    (engine as any).recordedEventIds,
    engine.getHistory()
  );
  const exec2 = engine.submitProposal(prop2Replay);

  const snapshot = engine.getSnapshot();
  const rumorsCount = (snapshot.worldInfo.publicRumors || []).length;
  const passed = exec1.success &&
                 !val2.isValid &&
                 val2.rejectedReasons.some(r => r.includes('[IDEMPOTENCY_VIOLATION]')) &&
                 !exec2.success &&
                 rumorsCount === 1 &&
                 snapshot.stateVersion === 2;

  recordResult({
    suite: 'CORE_5_7',
    testId: 'CASE-03-RECONSTRUCTED',
    testTitle: 'Duplicate Request ID Replay Blocked by Idempotency Registry',
    classification: passed ? 'VERIFIED' : 'FAIL',
    sourceLine: 'src/engine/validator.ts:80-95',
    attackDescription: 'Submit 2nd proposal with already committed requestId (req-c03-dup)',
    expectedBehavior: 'Validator rejects with IDEMPOTENCY_VIOLATION, state unchanged at version 2',
    actualBehavior: `val2Valid=${val2.isValid}, reasons=${val2.rejectedReasons.join('; ')}, rumorsCount=${rumorsCount}`,
    pass: passed
  });
}

// C3: Reconstructed CASE-04 (Duplicate Event ID Proposal Replay Blocked)
{
  const engine = new SovereignEngine(
    { ...createEmptyWorldInfo(), worldName: '이벤트ID테스트세계' },
    { ...createEmptyCharacter(), name: '주인공' },
    [],
    1,
    1
  );

  const prop1: StateTransitionProposal = {
    proposalId: 'prop-c04-1',
    requestId: 'req-c04-1',
    eventId: 'evt-c04-dup',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Initial execution',
    actions: [{ type: 'ADD_RUMOR', payload: { rumor: '이벤트1차' } }]
  };
  const exec1 = engine.submitProposal(prop1);

  const prop2Replay: StateTransitionProposal = {
    proposalId: 'prop-c04-2',
    requestId: 'req-c04-2', // Different requestId
    eventId: 'evt-c04-dup', // Duplicate Event ID!
    expectedStateVersion: 2,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Replay with same eventId',
    actions: [{ type: 'ADD_RUMOR', payload: { rumor: '이벤트중복' } }]
  };

  const val2 = EngineValidator.validate(
    prop2Replay,
    engine.getSnapshot(),
    (engine as any).executedRequestIds,
    (engine as any).recordedEventIds,
    engine.getHistory()
  );
  const exec2 = engine.submitProposal(prop2Replay);

  const snapshot = engine.getSnapshot();
  const rumorsCount = (snapshot.worldInfo.publicRumors || []).length;
  const passed = exec1.success &&
                 !val2.isValid &&
                 val2.rejectedReasons.some(r => r.includes('[EVENT_CONFLICT]')) &&
                 !exec2.success &&
                 rumorsCount === 1 &&
                 snapshot.stateVersion === 2;

  recordResult({
    suite: 'CORE_5_7',
    testId: 'CASE-04-RECONSTRUCTED',
    testTitle: 'Duplicate Event ID Proposal Replay Blocked by Event Registry',
    classification: passed ? 'VERIFIED' : 'FAIL',
    sourceLine: 'src/engine/validator.ts:98-115',
    attackDescription: 'Submit 2nd proposal with already recorded eventId (evt-c04-dup)',
    expectedBehavior: 'Validator rejects with EVENT_CONFLICT, state unchanged at version 2',
    actualBehavior: `val2Valid=${val2.isValid}, reasons=${val2.rejectedReasons.join('; ')}, rumorsCount=${rumorsCount}`,
    pass: passed
  });
}

// C4: Reconstructed CASE-05 (Multi-Action Proposal Shared Event ID Semantics)
{
  const engine = new SovereignEngine(
    { ...createEmptyWorldInfo(), worldName: '멀티액션세계' },
    { ...createEmptyCharacter(), name: '주인공' },
    [],
    1,
    1
  );

  const multiProposal: StateTransitionProposal = {
    proposalId: 'prop-c05-multi',
    requestId: 'req-c05-multi',
    eventId: 'evt-c05-shared-id',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Multi-action transaction with shared eventId',
    actions: [
      {
        type: 'ADD_RUMOR',
        payload: { rumor: '소문: 고룡의 출현' }
      },
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: { id: 'seed-c05-dragon', title: '고룡의 흔적', content: '북쪽 산맥', status: 'active', significance: '중요' }
      },
      {
        type: 'ADD_NPC',
        payload: { id: 'npc-c05-scout', name: '정찰병', role: '전사', affinity: 0 }
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

  const commitRes = engine.submitProposal(multiProposal);
  const history = engine.getHistory();
  const allShareEventId = history.length === 3 && history.every(r => r.eventId === 'evt-c05-shared-id');
  const eventIdInRegistry = (engine as any).recordedEventIds.has('evt-c05-shared-id');

  const passed = valRes.isValid && commitRes.success && allShareEventId && eventIdInRegistry;

  recordResult({
    suite: 'CORE_5_7',
    testId: 'CASE-05-RECONSTRUCTED',
    testTitle: 'Multi-Action Proposal Shared Event ID Semantics Preserved',
    classification: passed ? 'VERIFIED' : 'FAIL',
    sourceLine: 'src/engine/state.ts:280-320',
    attackDescription: 'Proposal with 3 actions commits atomically and all 3 history records share same eventId',
    expectedBehavior: 'All 3 actions commit, 3 history records share eventId, eventId recorded in registry',
    actualBehavior: `commitSuccess=${commitRes.success}, historyCount=${history.length}, allShareId=${allShareEventId}`,
    pass: passed
  });
}

console.log('\n================================================================');
const total = results.length;
const passed = results.filter(r => r.pass).length;
const failed = total - passed;
console.log(`TOTAL AUDIT CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');
