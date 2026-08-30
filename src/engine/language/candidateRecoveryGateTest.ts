/**
 * @file src/engine/language/candidateRecoveryGateTest.ts
 * @description VEIL Candidate Recovery Gate Exhaustive Test Suite
 * 
 * Verifies all 18+ attack scenarios and invariants:
 * 1. Zero-Mutation on normal candidates
 * 2. Strict deterministic quarantine on corrupted candidates
 * 3. Type forgery protection (arrays, primitives, nulls, floats)
 * 4. Boundary isolation (no cross-candidate contamination)
 * 5. Full pipeline integration up to PreAuth
 */

import {
  validateCandidateStructure,
  runCandidateRecoveryGate,
} from './candidateRecoveryGate';
import { extractCandidatesFromMetadata } from '../../utils/engineValidator';
import { buildSafeProposalFromCandidate } from '../proposalParser';
import { filterDiverseCandidates } from './diversity';
import { EngineValidator } from '../validator';
import { CanonicalState } from '../types';

export interface TestReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  details: { name: string; status: 'PASSED' | 'FAILED'; error?: string }[];
}

export function runCandidateRecoveryGateTests(): TestReport {
  const report: TestReport = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    details: []
  };

  function assert(condition: boolean, name: string, errMsg?: string) {
    report.totalTests++;
    if (condition) {
      report.passedTests++;
      report.details.push({ name, status: 'PASSED' });
    } else {
      report.failedTests++;
      report.details.push({ name, status: 'FAILED', error: errMsg || 'Assertion failed' });
    }
  }

  // Baseline Valid Candidates Factory
  const makeValidCandidate = (id: number, label: string = `Candidate ${id}`) => ({
    candidateId: id,
    label,
    narrativeSummary: `Summary for candidate ${id}`,
    rawMetadata: {
      factCheckSummary: `Fact check for ${id}`,
      foreshadowSeeds: [`Seed ${id}`],
      cameraOffscreenEvents: [`Event ${id}`],
      currentChapter: '1장 시작',
      upcomingChapters: ['2장', '3장', '4장'],
      statChanges: '체력 변동 없음',
      recommendedDC: 10 + id,
      dcReason: '판정 사유',
      contextVerificationDeclaration: '정사 맥락 일치'
    }
  });

  // Scenario 1: Normal 5 Candidates (All valid)
  {
    const normal5 = [1, 2, 3, 4, 5].map(id => makeValidCandidate(id));
    const res = runCandidateRecoveryGate(normal5);
    assert(
      res.passedCount === 5 && res.quarantinedCount === 0,
      'Scenario 1: Normal 5 Candidates - All 5 pass',
      `Expected 5 passed, got ${res.passedCount}`
    );
    // Zero-Mutation check: exact references & deep equality preserved
    const zeroMutated = normal5.every((c, idx) => res.passedCandidates[idx] === c);
    assert(zeroMutated, 'Scenario 1: Zero-Mutation invariant preserved for all normal candidates');
  }

  // Scenario 2: Normal 4 + 1 Corrupt (Candidate 3 has float candidateId)
  {
    const list = [
      makeValidCandidate(1),
      makeValidCandidate(2),
      { ...makeValidCandidate(3), candidateId: 3.5 }, // FLOAT ID
      makeValidCandidate(4),
      makeValidCandidate(5)
    ];
    const res = runCandidateRecoveryGate(list);
    assert(
      res.passedCount === 4 && res.quarantinedCount === 1,
      'Scenario 2: Normal 4 + 1 Float candidateId - 4 passed, 1 quarantined',
      `Passed: ${res.passedCount}, Quarantined: ${res.quarantinedCount}`
    );
    assert(
      res.quarantinedCandidates[0].index === 2 && res.quarantinedCandidates[0].reasons.some(r => r.includes('integer')),
      'Scenario 2: Quarantined candidate has correct index and integer reason'
    );
    assert(
      res.passedCandidates[0].candidateId === 1 && res.passedCandidates[1].candidateId === 2 &&
      res.passedCandidates[2].candidateId === 4 && res.passedCandidates[3].candidateId === 5,
      'Scenario 2: Passed candidates retain correct order and identity'
    );
  }

  // Scenario 3: Normal 3 + 2 Corrupt (One string ID, one missing label)
  {
    const list = [
      makeValidCandidate(1),
      { ...makeValidCandidate(2), candidateId: '2' as any }, // Type forgery
      makeValidCandidate(3),
      { ...makeValidCandidate(4), label: '' }, // Empty label
      makeValidCandidate(5)
    ];
    const res = runCandidateRecoveryGate(list);
    assert(
      res.passedCount === 3 && res.quarantinedCount === 2,
      'Scenario 3: Normal 3 + 2 Corrupted - 3 passed, 2 quarantined'
    );
  }

  // Scenario 4: Normal 1 + 4 Corrupt
  {
    const list = [
      { candidateId: 1, label: 123 as any, narrativeSummary: 'test', rawMetadata: {} }, // Invalid label type
      { candidateId: 0, label: 'zero id', narrativeSummary: 'test', rawMetadata: {} }, // Out of bounds
      makeValidCandidate(3), // VALID
      { candidateId: 4, label: 'null meta', narrativeSummary: 'test', rawMetadata: null }, // Null metadata
      { candidateId: 5, label: 'array meta', narrativeSummary: 'test', rawMetadata: [] as any } // Array metadata
    ];
    const res = runCandidateRecoveryGate(list);
    assert(
      res.passedCount === 1 && res.quarantinedCount === 4,
      'Scenario 4: Normal 1 + 4 Corrupted - 1 passed, 4 quarantined'
    );
    assert(res.passedCandidates[0].candidateId === 3, 'Scenario 4: The only valid candidate is #3');
  }

  // Scenario 5: All 5 Corrupt -> 0 Passed, 5 Quarantined (Fail-Closed)
  {
    const list = [
      null,
      123,
      'invalid candidate',
      [],
      { invalidObject: true }
    ];
    const res = runCandidateRecoveryGate(list);
    assert(
      res.passedCount === 0 && res.quarantinedCount === 5,
      'Scenario 5: All 5 Corrupt - 0 passed, 5 quarantined (Fail-Closed)'
    );
  }

  // Scenario 6: CandidateId Out of Bounds Upper (id = 6)
  {
    const c = { ...makeValidCandidate(1), candidateId: 6 };
    const res = validateCandidateStructure(c);
    assert(!res.valid && res.reasons.some(r => r.includes('out of bounds')), 'Scenario 6: candidateId 6 rejected (out of bounds)');
  }

  // Scenario 7: CandidateId Out of Bounds Lower (id = 0, -1)
  {
    const c0 = { ...makeValidCandidate(1), candidateId: 0 };
    const cNeg = { ...makeValidCandidate(1), candidateId: -1 };
    const r0 = validateCandidateStructure(c0);
    const rNeg = validateCandidateStructure(cNeg);
    assert(!r0.valid && !rNeg.valid, 'Scenario 7: candidateId <= 0 rejected');
  }

  // Scenario 8: CandidateId Type Forgery (boolean, string, object, NaN, Infinity)
  {
    const rBool = validateCandidateStructure({ ...makeValidCandidate(1), candidateId: true });
    const rStr = validateCandidateStructure({ ...makeValidCandidate(1), candidateId: '1' });
    const rObj = validateCandidateStructure({ ...makeValidCandidate(1), candidateId: { id: 1 } });
    const rNaN = validateCandidateStructure({ ...makeValidCandidate(1), candidateId: NaN });
    const rInf = validateCandidateStructure({ ...makeValidCandidate(1), candidateId: Infinity });
    assert(
      !rBool.valid && !rStr.valid && !rObj.valid && !rNaN.valid && !rInf.valid,
      'Scenario 8: candidateId type forgeries (bool, str, obj, NaN, Infinity) rejected'
    );
  }

  // Scenario 9: Label Type Forgery (number, null, array, undefined, whitespace-only)
  {
    const rNum = validateCandidateStructure({ ...makeValidCandidate(1), label: 42 });
    const rNull = validateCandidateStructure({ ...makeValidCandidate(1), label: null });
    const rArr = validateCandidateStructure({ ...makeValidCandidate(1), label: ['text'] });
    const rUndef = validateCandidateStructure({ ...makeValidCandidate(1), label: undefined });
    const rSpace = validateCandidateStructure({ ...makeValidCandidate(1), label: '   ' });
    assert(
      !rNum.valid && !rNull.valid && !rArr.valid && !rUndef.valid && !rSpace.valid,
      'Scenario 9: label invalid types / whitespace-only rejected'
    );
  }

  // Scenario 10: NarrativeSummary Type Forgery (number, null, object, undefined)
  {
    const rNum = validateCandidateStructure({ ...makeValidCandidate(1), narrativeSummary: 100 });
    const rNull = validateCandidateStructure({ ...makeValidCandidate(1), narrativeSummary: null });
    const rObj = validateCandidateStructure({ ...makeValidCandidate(1), narrativeSummary: {} });
    const rUndef = validateCandidateStructure({ ...makeValidCandidate(1), narrativeSummary: undefined });
    assert(
      !rNum.valid && !rNull.valid && !rObj.valid && !rUndef.valid,
      'Scenario 10: narrativeSummary invalid types rejected'
    );
  }

  // Scenario 11: RawMetadata Null Verification
  {
    const rNull = validateCandidateStructure({ ...makeValidCandidate(1), rawMetadata: null });
    assert(!rNull.valid && rNull.reasons.some(r => r.includes('rawMetadata')), 'Scenario 11: rawMetadata null rejected');
  }

  // Scenario 12: RawMetadata Array Forgery (Metadata passed as array instead of object)
  {
    const rArr = validateCandidateStructure({ ...makeValidCandidate(1), rawMetadata: [{ fact: 1 }] });
    assert(!rArr.valid && rArr.reasons.some(r => r.includes('rawMetadata')), 'Scenario 12: rawMetadata array rejected');
  }

  // Scenario 13: RawMetadata Primitive Forgery (string, number, boolean)
  {
    const rStr = validateCandidateStructure({ ...makeValidCandidate(1), rawMetadata: 'metadata string' });
    const rNum = validateCandidateStructure({ ...makeValidCandidate(1), rawMetadata: 999 });
    const rBool = validateCandidateStructure({ ...makeValidCandidate(1), rawMetadata: true });
    assert(!rStr.valid && !rNum.valid && !rBool.valid, 'Scenario 13: rawMetadata primitive values rejected');
  }

  // Scenario 14: Candidate Item Primitive / Array / Null root
  {
    const rNull = validateCandidateStructure(null);
    const rArr = validateCandidateStructure([makeValidCandidate(1)]);
    const rNum = validateCandidateStructure(12345);
    const rStr = validateCandidateStructure('candidate string');
    assert(!rNull.valid && !rArr.valid && !rNum.valid && !rStr.valid, 'Scenario 14: Candidate root non-objects rejected');
  }

  // Scenario 15: Non-Array Input to runCandidateRecoveryGate (Fail-Closed)
  {
    const rNull = runCandidateRecoveryGate(null);
    const rObj = runCandidateRecoveryGate({ candidateId: 1 });
    const rStr = runCandidateRecoveryGate('invalid');
    assert(
      rNull.passedCount === 0 && rObj.passedCount === 0 && rStr.passedCount === 0,
      'Scenario 15: Non-array input to gate fails closed immediately'
    );
  }

  // Scenario 16: Zero Mutation Deep Preservation (No property normalization or stripping)
  {
    const originalCandidate = {
      candidateId: 2,
      label: 'Special Label with Extra   Spaces',
      narrativeSummary: 'Summary text',
      rawMetadata: {
        customField: 'preserved_as_is',
        nestedArray: [1, 2, { inner: true }]
      },
      extraEngineFlag: 'do_not_strip'
    };

    const res = runCandidateRecoveryGate([originalCandidate]);
    assert(res.passedCount === 1, 'Scenario 16: Custom valid candidate passed');
    const passed = res.passedCandidates[0];
    assert(passed === originalCandidate, 'Scenario 16: Reference equality preserved (Zero Mutation)');
    assert(
      passed.extraEngineFlag === 'do_not_strip' &&
      passed.rawMetadata.customField === 'preserved_as_is',
      'Scenario 16: All arbitrary valid custom fields completely preserved'
    );
  }

  // Scenario 17: Multi-corrupt with mixed error vectors (Independence & Isolation)
  {
    const mixedList = [
      makeValidCandidate(1, 'Valid One'),
      { candidateId: 2.2, label: 'Float ID', narrativeSummary: 's', rawMetadata: {} },
      makeValidCandidate(3, 'Valid Three'),
      { candidateId: 4, label: '', narrativeSummary: 's', rawMetadata: {} },
      { candidateId: 5, label: 'Valid Five Label', narrativeSummary: 's', rawMetadata: 'not an object' }
    ];

    const res = runCandidateRecoveryGate(mixedList);
    assert(res.passedCount === 2, 'Scenario 17: Exactly 2 valid candidates passed (1 and 3)');
    assert(res.quarantinedCount === 3, 'Scenario 17: Exactly 3 candidates quarantined (2, 4, 5)');
    assert(
      res.passedCandidates[0].label === 'Valid One' && res.passedCandidates[1].label === 'Valid Three',
      'Scenario 17: Passed candidates strictly preserve identities without cross-contamination'
    );
  }

  // Scenario 18: Full End-to-End Pipeline Execution (Gate -> extractCandidatesFromMetadata -> Translation -> Diversity -> PreAuth)
  {
    const rawPhase1Candidates = [
      makeValidCandidate(1, '전진 탐색'),
      { candidateId: 99, label: 'Corrupted ID', narrativeSummary: 'bad', rawMetadata: {} }, // Corrupted
      makeValidCandidate(2, '측면 우회'),
      { candidateId: 3, label: null, narrativeSummary: 'bad', rawMetadata: {} }, // Corrupted
      makeValidCandidate(4, '매복 관측')
    ];

    // Step 1: Gate
    const gateRes = runCandidateRecoveryGate<any>(rawPhase1Candidates);
    assert(gateRes.passedCount === 3 && gateRes.quarantinedCount === 2, 'Scenario 18 Step 1: Gate passed 3, quarantined 2');

    // Step 2: Canonical State setup
    const canonicalState: CanonicalState = {
      stateVersion: 1,
      turn: 1,
      worldInfo: {
        worldName: '테스트 세계',
        settingDescription: '테스트 설정',
        toneStyle: '정통 무협',
        currentTime: { year: 1, month: 1, day: 1, timeOfDay: '아침', formattedTime: '1년차 봄 1일' },
        currentLocation: '초원',
        currentChapter: '1장',
        upcomingChapters: ['2장', '3장', '4장'],
        seeds: [],
        npcs: [],
        factions: [],
        historySummary: [],
        offscreenEvents: [],
        rumors: []
      } as any,
      character: {
        name: '주인공',
        alias: '소협',
        stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        inventory: [],
        relationships: {},
        secrets: [],
        physicalDefects: [],
        psychologicalState: '침착'
      } as any,
      lastCommittedEventId: null,
      lastCommittedAt: new Date().toISOString()
    };

    // Step 3: extractCandidatesFromMetadata & buildSafeProposalFromCandidate
    const translated = gateRes.passedCandidates.map(c => {
      const candidatePacket = extractCandidatesFromMetadata(c.rawMetadata, 1, '1년차 봄 1일');
      const proposal = buildSafeProposalFromCandidate(canonicalState, candidatePacket, 1, []);
      return {
        candidate: c,
        candidatePacket,
        proposal,
        meaningTree: proposal.meaningTree!
      };
    });

    assert(translated.length === 3, 'Scenario 18 Step 3: Successfully translated 3 valid candidates');

    // Step 4: Diversity Gate
    const diverse = filterDiverseCandidates(
      translated.map(tc => ({ candidate: tc.candidatePacket, meaningTree: tc.meaningTree }))
    );
    assert(diverse.length > 0, 'Scenario 18 Step 4: Diversity filter succeeded');

    // Step 5: Pre-Authorization Validation
    const preAuthResults = translated.map(tc => {
      const validation = EngineValidator.validate(
        tc.proposal,
        canonicalState,
        new Set(),
        new Set(),
        []
      );
      return {
        ...tc.candidate,
        preAuthStatus: validation.isValid ? 'ALLOW' : 'REJECT'
      };
    });

    assert(
      preAuthResults.every(r => r.preAuthStatus === 'ALLOW'),
      'Scenario 18 Step 5: All valid candidate proposals safely validated in PreAuth'
    );
  }

  return report;
}
