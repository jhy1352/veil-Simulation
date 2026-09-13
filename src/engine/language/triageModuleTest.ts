/**
 * @file src/engine/language/triageModuleTest.ts
 * @description Unit & Regression Test Suite for VEIL Triage Module
 */

import { runTriagePipeline, TRIAGE_STAMP_HEADER } from './triageModule.ts';

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
  console.log('VEIL Triage Module Test Suite Running...');
  console.log('====================================================');

  // Test 1: Untriaged input gets TRIAGE_STAMP attached and applied
  {
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

    const result = runTriagePipeline(rawInput);
    assert(result.triageApplied === true, 'Triage 1.1: triageApplied is true for untriaged input');
    assert(Boolean(result.triageStamp && result.triageStamp.startsWith(TRIAGE_STAMP_HEADER)), 'Triage 1.2: TRIAGE_STAMP generated correctly');
    assert(result.zeroMutationNarrative === '주변을 주의 깊게 둘러보았으나 특별한 변화는 일어나지 않았다.', 'Triage 1.3: Zero-Mutation narrative extracted correctly');
    assert(Array.isArray(result.rawCandidates) && result.rawCandidates.length === 1, 'Triage 1.4: Candidates extracted correctly');
    
    // Check modality="NONE" default and scope normalization
    const candidate1 = result.rawCandidates![0];
    assert(candidate1.semanticEvents![0].modality === 'NONE', 'Triage 1.5: Omitted modality defaulted to NONE');
    assert(candidate1.semanticEvents![0].scope === 'CLAIM', 'Triage 1.6: Unbacked CANONICAL scope normalized to CLAIM');
  }

  // Test 2: 1-Shot Execution Guard: Stamped input bypasses re-triage
  {
    const stampedInput = `/* TRIAGE_STAMP_V1_12345678_abcdef */
[ZERO_MUTATION_NARRATIVE]
아무런 일도 일어나지 않았다.
[ZERO_MUTATION_END]
`;

    const result = runTriagePipeline({ rawResponseText: stampedInput, triageStamp: 'TRIAGE_STAMP_V1_12345678_abcdef' });
    assert(result.triageApplied === false, 'Triage 2.1: Bypasses re-triage on already stamped input');
    assert(result.triageStamp === 'TRIAGE_STAMP_V1_12345678_abcdef', 'Triage 2.2: Preserves existing TRIAGE_STAMP');
  }

  // Test 3: Candidate Count Enforcement (max 5)
  {
    const raw6Candidates = `
[ZERO_MUTATION_NARRATIVE]
정적만이 가득하다.
[ZERO_MUTATION_END]

[CANDIDATES_BLOCK]
[
  { "label": "1" }, { "label": "2" }, { "label": "3" }, { "label": "4" }, { "label": "5" }, { "label": "6" }
]
[CANDIDATES_END]
`;

    const result = runTriagePipeline(raw6Candidates);
    assert(result.rawCandidates!.length === 5, 'Triage 3.1: Candidates strictly capped at max 5');
    assert(result.rawCandidates![4].candidateId === 5, 'Triage 3.2: 5th candidate has canonical ID 5');
  }

  // Test 4: Missing Zero-Mutation Narrative falls back to deterministic non-mutation text
  {
    const missingZeroInput = `
[CANDIDATES_BLOCK]
[ { "label": "테스트" } ]
[CANDIDATES_END]
`;

    const result = runTriagePipeline(missingZeroInput);
    assert(result.zeroMutationNarrative.includes('선언한 행동을 시도하였으나'), 'Triage 4.1: Missing zero-mutation narrative falls back to deterministic non-mutation text');
  }

  // Test 5: Recovery-fixable JSON syntax error (e.g. trailing comma) passes through parseCandidatesBlock without early deletion
  {
    const syntaxRecoverableInput = `
[ZERO_MUTATION_NARRATIVE]
정적만이 가득하다.
[ZERO_MUTATION_END]

[CANDIDATES_BLOCK]
[
  {
    "label": "Trailing Comma Candidate",
    "narrativeSummary": "Testing syntax recovery delegation",
  },
]
[CANDIDATES_END]
`;

    const result = runTriagePipeline(syntaxRecoverableInput);
    assert(Array.isArray(result.rawCandidates) && result.rawCandidates.length === 1, 'Triage 5.1: Syntax-recoverable candidate passed to Recovery gate without early Triage deletion');
    assert(result.rawCandidates![0].label === 'Trailing Comma Candidate', 'Triage 5.2: Recovered candidate payload preserved');
    assert(result.rawCandidates![0].candidateId === 1, 'Triage 5.3: candidateId authority retained from parseCandidatesBlock (1)');
  }

  console.log('====================================================');
  console.log('All Triage Module Tests PASSED!');
  console.log('====================================================');
}

if (process.argv[1] && process.argv[1].endsWith('triageModuleTest.ts')) {
  runTriageModuleTestSuite();
}
