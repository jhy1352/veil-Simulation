/**
 * @file src/engine/language/triageModuleTest.ts
 * @description Unit & Integration Test Suite for VEIL Triage Module & Recovery Separation
 */

import { runTriagePipeline, TRIAGE_STAMP_HEADER } from './triageModule.ts';
import { runCandidateRecoveryGate, getRecoveryCallCount, resetRecoveryCallCount } from './candidateRecoveryGate.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(`Test failed: ${msg}`);
  } else {
    console.log(`✅ [PASS] ${msg}`);
  }
}

export function runTriageModuleTestSuite() {
  console.log('====================================================');
  console.log('VEIL Triage & Recovery Module Test Suite Running...');
  console.log('====================================================');

  // Test 1: Normal Candidate Pass-Through & Triage/Recovery Pipeline Execution
  {
    resetRecoveryCallCount();
    const rawInput = `
[ZERO_MUTATION_NARRATIVE]
주변을 주의 깊게 둘러보았으나 특별한 변화는 일어나지 않았다.
[ZERO_MUTATION_END]

[CANDIDATES_BLOCK]
[
  {
    "candidateId": 1,
    "label": "수첩 확인",
    "narrativeSummary": "수첩을 열어 적힌 내용을 읽는다.",
    "rawMetadata": {},
    "semanticEvents": [
      {
        "atom": "CLAIM",
        "scope": "CANONICAL",
        "entity": "NOTEBOOK"
      }
    ]
  }
]
[CANDIDATES_END]
`;

    const triageRes = runTriagePipeline(rawInput);
    assert(triageRes.triageApplied === true, 'Test 1.1: triageApplied is true for untriaged input');
    assert(Boolean(triageRes.triageStamp && triageRes.triageStamp.startsWith(TRIAGE_STAMP_HEADER)), 'Test 1.2: TRIAGE_STAMP generated correctly');
    assert(triageRes.zeroMutationNarrative === '주변을 주의 깊게 둘러보았으나 특별한 변화는 일어나지 않았다.', 'Test 1.3: Zero-Mutation narrative extracted correctly');
    assert(typeof triageRes.rawCandidatesBlock === 'string', 'Test 1.4: rawCandidatesBlock extracted as raw string');

    // Prove Triage alone did NOT call Recovery Gate
    assert(getRecoveryCallCount() === 0, 'Test 1.5: Triage alone does not invoke Recovery Gate');

    // Run Recovery Gate as the single authority
    const gateRes = runCandidateRecoveryGate(triageRes.rawCandidatesBlock);
    assert(gateRes.passedCount === 1, 'Test 1.6: Recovery Gate passed valid candidate');
    assert(getRecoveryCallCount() === 1, 'Test 1.7: Recovery Gate call count is exactly 1');

    const candidate1 = gateRes.passedCandidates[0];
    assert(candidate1.candidateId === 1, 'Test 1.8: Canonical candidateId assigned as 1');
    assert(candidate1.semanticEvents![0].modality === undefined, 'Test 1.9: Omitted modality remains undefined');
    assert(candidate1.semanticEvents![0].scope === 'CANONICAL', 'Test 1.10: CANONICAL scope remains CANONICAL');
  }

  // Test 2: Syntax-Recoverable JSON (Trailing Comma)
  {
    resetRecoveryCallCount();
    const syntaxRecoverableInput = `
[ZERO_MUTATION_NARRATIVE]
정적만이 가득하다.
[ZERO_MUTATION_END]

[CANDIDATES_BLOCK]
[
  {
    "label": "Trailing Comma Candidate",
    "narrativeSummary": "Testing syntax recovery delegation",
    "rawMetadata": {}
  },
]
[CANDIDATES_END]
`;

    const triageRes = runTriagePipeline(syntaxRecoverableInput);
    assert(typeof triageRes.rawCandidatesBlock === 'string', 'Test 2.1: Triage extracts raw block despite syntax error');

    const gateRes = runCandidateRecoveryGate(triageRes.rawCandidatesBlock);
    assert(gateRes.passedCount === 1, 'Test 2.2: Syntax error recovered by Recovery Gate');
    assert(gateRes.passedCandidates[0].label === 'Trailing Comma Candidate', 'Test 2.3: Recovered candidate payload preserved');
    assert(getRecoveryCallCount() === 1, 'Test 2.4: Recovery call count is 1');
  }

  // Test 3: Partial Recovery Failure (Corrupted Candidate 2 Quarantined, Candidates 1 & 3 Passed)
  {
    resetRecoveryCallCount();
    const partialCorruptInput = `
[ZERO_MUTATION_NARRATIVE]
정적만이 가득하다.
[ZERO_MUTATION_END]

[CANDIDATES_BLOCK]
[
  {
    "label": "Valid Candidate 1",
    "narrativeSummary": "Summary 1",
    "rawMetadata": {}
  },
  {
    "label": 12345,
    "narrativeSummary": "Invalid non-string label candidate",
    "rawMetadata": {}
  },
  {
    "label": "Valid Candidate 3",
    "narrativeSummary": "Summary 3",
    "rawMetadata": {}
  }
]
[CANDIDATES_END]
`;

    const triageRes = runTriagePipeline(partialCorruptInput);
    const gateRes = runCandidateRecoveryGate(triageRes.rawCandidatesBlock);

    assert(gateRes.passedCount === 2, 'Test 3.1: 2 valid candidates passed');
    assert(gateRes.quarantinedCount === 1, 'Test 3.2: 1 corrupted candidate quarantined');
    assert(gateRes.quarantinedCandidates[0].index === 1, 'Test 3.3: Index 1 candidate was quarantined');
    assert(gateRes.passedCandidates[0].label === 'Valid Candidate 1', 'Test 3.4: Candidate 1 passed cleanly');
    assert(gateRes.passedCandidates[1].label === 'Valid Candidate 3', 'Test 3.5: Candidate 3 passed cleanly');
    assert(getRecoveryCallCount() === 1, 'Test 3.6: Recovery call count is 1');
  }

  // Test 4: Zero-Mutation Only Input (Missing CANDIDATES_BLOCK)
  {
    resetRecoveryCallCount();
    const zeroOnlyInput = `
[ZERO_MUTATION_NARRATIVE]
바람 소리만이 고요히 들려온다.
[ZERO_MUTATION_END]
`;

    const triageRes = runTriagePipeline(zeroOnlyInput);
    assert(triageRes.zeroMutationNarrative === '바람 소리만이 고요히 들려온다.', 'Test 4.1: Zero-mutation narrative extracted');
    assert(triageRes.rawCandidatesBlock === null, 'Test 4.2: rawCandidatesBlock is null when tag is absent');
    assert(getRecoveryCallCount() === 0, 'Test 4.3: Recovery Gate not called for zero-mutation only input');
  }

  // Test 5: 1-Shot Guard on Stamped Input
  {
    resetRecoveryCallCount();
    const stampedInput = `/* TRIAGE_STAMP_V1_12345678_abcdef */
[ZERO_MUTATION_NARRATIVE]
아무런 일도 일어나지 않았다.
[ZERO_MUTATION_END]
`;

    const result = runTriagePipeline({ rawResponseText: stampedInput, triageStamp: 'TRIAGE_STAMP_V1_12345678_abcdef' });
    assert(result.triageApplied === false, 'Test 5.1: Bypasses re-triage on already stamped input');
    assert(result.triageStamp === 'TRIAGE_STAMP_V1_12345678_abcdef', 'Test 5.2: Preserves existing TRIAGE_STAMP');
  }

  console.log('====================================================');
  console.log('All Triage & Recovery Module Tests PASSED!');
  console.log('====================================================');
}

if (process.argv[1] && process.argv[1].endsWith('triageModuleTest.ts')) {
  runTriageModuleTestSuite();
}
