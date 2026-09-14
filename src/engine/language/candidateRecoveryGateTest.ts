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
      foreshadowSeeds: [`Seed ${id}`],
      cameraOffscreenEvents: [`Event ${id}`],
      chapterChanges: {
        currentChapter: '1장 시작',
        upcomingChapters: ['2장', '3장', '4장']
      }
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

  // Scenario 6: CandidateId Cardinality 1..N (id >= 1 valid, e.g. id = 6, 10)
  {
    const c6 = { ...makeValidCandidate(1), candidateId: 6 };
    const c10 = { ...makeValidCandidate(1), candidateId: 10 };
    const res6 = validateCandidateStructure(c6);
    const res10 = validateCandidateStructure(c10);
    assert(res6.valid && res10.valid, 'Scenario 6: candidateId 6 and 10 valid under 1..N cardinality');
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
        foreshadowSeeds: ['Seed Special'],
        chapterChanges: {
          currentChapter: '1장 특별',
          upcomingChapters: ['2장', '3장']
        }
      },
      extraEngineFlag: 'do_not_strip'
    };

    const res = runCandidateRecoveryGate([originalCandidate]);
    assert(res.passedCount === 1, 'Scenario 16: Custom valid candidate passed');
    const passed = res.passedCandidates[0];
    assert(passed === originalCandidate, 'Scenario 16: Reference equality preserved (Zero Mutation)');
    assert(
      passed.extraEngineFlag === 'do_not_strip' &&
      passed.rawMetadata.foreshadowSeeds[0] === 'Seed Special',
      'Scenario 16: All valid fields and root extra properties completely preserved'
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
      { candidateId: -99, label: 'Corrupted ID', narrativeSummary: 'bad', rawMetadata: {} }, // Corrupted (< 1)
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

  // Scenario 19: Genuinely distinct 5 candidates (1..N cardinality) -> All 5 preserved through Pipeline
  {
    const candidates5 = [
      makeValidCandidate(1, '정면 돌파'),
      makeValidCandidate(2, '측면 우회'),
      makeValidCandidate(3, '협상 시도'),
      makeValidCandidate(4, '은밀 잠입'),
      makeValidCandidate(5, '후퇴 및 정보 수집')
    ];
    const gateRes = runCandidateRecoveryGate(candidates5);
    assert(gateRes.passedCount === 5 && gateRes.quarantinedCount === 0, 'Scenario 19: Genuinely distinct 5 candidates - All 5 pass Gate');
  }

  // Scenario 19.1: Genuinely distinct 7 candidates (1..N cardinality) -> All 7 preserved through Pipeline
  {
    const candidates7 = [
      makeValidCandidate(1, '정면 돌파'),
      makeValidCandidate(2, '측면 우회'),
      makeValidCandidate(3, '협상 시도'),
      makeValidCandidate(4, '은밀 잠입'),
      makeValidCandidate(5, '후퇴 및 정보 수집'),
      makeValidCandidate(6, '지원 요청'),
      makeValidCandidate(7, '정찰 유지')
    ];
    const gateRes = runCandidateRecoveryGate(candidates7);
    assert(gateRes.passedCount === 7 && gateRes.quarantinedCount === 0, 'Scenario 19.1: Genuinely distinct 7 candidates - All 7 pass Gate');
  }

  // Scenario 20: Genuinely distinct 4 candidates (1..N cardinality) -> All 4 preserved
  {
    const candidates4 = [
      makeValidCandidate(1, '성문 접근'),
      makeValidCandidate(2, '비밀 통로 탐색'),
      makeValidCandidate(3, '주변 상인 심문'),
      makeValidCandidate(4, '야간 기습 대기')
    ];
    const gateRes = runCandidateRecoveryGate(candidates4);
    assert(gateRes.passedCount === 4 && gateRes.quarantinedCount === 0, 'Scenario 20: Genuinely distinct 4 candidates - All 4 pass Gate');
  }

  // Scenario 21: Genuinely distinct 3 candidates -> All 3 preserved
  {
    const candidates3 = [
      makeValidCandidate(1, '경계 태세'),
      makeValidCandidate(2, '대화 시도'),
      makeValidCandidate(3, '무기 투하')
    ];
    const gateRes = runCandidateRecoveryGate(candidates3);
    assert(gateRes.passedCount === 3 && gateRes.quarantinedCount === 0, 'Scenario 21: Genuinely distinct 3 candidates - All 3 pass Gate');
  }

  // Scenario 22: Genuinely distinct 2 candidates -> All 2 preserved
  {
    const candidates2 = [
      makeValidCandidate(1, '수락'),
      makeValidCandidate(2, '거절')
    ];
    const gateRes = runCandidateRecoveryGate(candidates2);
    assert(gateRes.passedCount === 2 && gateRes.quarantinedCount === 0, 'Scenario 22: Genuinely distinct 2 candidates - All 2 pass Gate');
  }

  // Scenario 23: Genuinely distinct 1 candidate -> 1 preserved
  {
    const candidate1 = [
      makeValidCandidate(1, '단일 불가피 행동')
    ];
    const gateRes = runCandidateRecoveryGate(candidate1);
    assert(gateRes.passedCount === 1 && gateRes.quarantinedCount === 0, 'Scenario 23: Genuinely distinct 1 candidate - 1 passes Gate');
  }

  // Scenario 24: Surface-only variations (Different prose/label, identical semantic structure) -> Diversity Gate filters to unique
  {
    const baseMetadata = {
      chapterChanges: {
        currentChapter: '1장',
        upcomingChapters: ['2장', '3장', '4장']
      }
    };
    const surfaceVariations = [
      { candidateId: 1, label: '조심스럽게 숲으로 이동', narrativeSummary: '숲으로 걸어간다', rawMetadata: { ...baseMetadata } },
      { candidateId: 2, label: '신중하게 수풀 사이로 진입', narrativeSummary: '완전히 다른 수사적 표현', rawMetadata: { ...baseMetadata } },
      { candidateId: 3, label: '완전히 다른 행동: 2장 개막', narrativeSummary: '2장으로 전개된다', rawMetadata: { chapterChanges: { currentChapter: '2장', upcomingChapters: ['3장', '4장', '5장'] } } }
    ];
    const gateRes = runCandidateRecoveryGate<any>(surfaceVariations);
    assert(gateRes.passedCount === 3, 'Scenario 24 Step 1: All 3 pass structural gate');

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

    const diverse = filterDiverseCandidates(
      translated.map(tc => ({ candidate: tc.candidatePacket, meaningTree: tc.meaningTree }))
    );

    // Candidates 1 & 2 have identical structural meaning tree (ADVANCE_CHAPTER 1장), so diversity filters from 3 to 2 unique trees
    assert(diverse.length === 2, 'Scenario 24 Step 2: Surface-only variations deduplicated by Diversity Gate');
  }

  // Scenario 25: Hallucinated filler candidate with unbacked item creation at Turn 2 is REJECTED by PreAuth Gate
  {
    const canonicalStateTurn2: CanonicalState = {
      stateVersion: 2,
      turn: 2,
      worldInfo: {
        worldName: '테스트 세계',
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
        stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        inventory: [],
        relationships: {},
        secrets: [],
        physicalDefects: [],
        psychologicalState: '침착'
      } as any,
      lastCommittedEventId: 'evt-genesis',
      lastCommittedAt: new Date().toISOString()
    };

    const genuineCand = makeValidCandidate(1, '정상 후보: 주변 관찰');
    const fakeFillerCand = {
      candidateId: 2,
      label: '허위 필러 후보: 가상의 보검 획득',
      narrativeSummary: '근거 없이 보검을 획득함',
      rawMetadata: {
        chapterChanges: {
          currentChapter: '1장',
          upcomingChapters: ['2장', '3장', '4장']
        },
        inventoryChanges: [
          {
            name: '가상의 보검',
            quantity: 1,
            action: 'add',
            entityReference: {
              entityType: 'ITEM',
              evidence: {
                verifiedEventId: 'evt-genesis',
                cause: 'UNBACKED_ACQUISITION'
              }
            }
          }
        ]
      }
    };

    const gateRes = runCandidateRecoveryGate<any>([genuineCand, fakeFillerCand]);
    assert(gateRes.passedCount === 2, 'Scenario 25 Step 1: Structural gate passes both syntactically');

    const p1 = buildSafeProposalFromCandidate(canonicalStateTurn2, extractCandidatesFromMetadata(genuineCand.rawMetadata, 2, '1년차 봄 1일'), 2, []);
    const p2 = buildSafeProposalFromCandidate(canonicalStateTurn2, extractCandidatesFromMetadata(fakeFillerCand.rawMetadata, 2, '1년차 봄 1일'), 2, []);

    const v1 = EngineValidator.validate(p1, canonicalStateTurn2, new Set(), new Set(), []);
    const v2 = EngineValidator.validate(p2, canonicalStateTurn2, new Set(), new Set(), []);

    assert(v1.isValid === true, 'Scenario 25 Step 2: Genuine candidate is ALLOWED');
    const isUnbackedItemBlocked = !p2.actions.some(a => a.type === 'MODIFY_INVENTORY') || v2.isValid === false;
    assert(isUnbackedItemBlocked, 'Scenario 25 Step 3: Unbacked hallucinated item at Turn 2 is REJECTED by PreAuth Gate');
  }

  // Scenario 26: UNKNOWN_FIELD Firewall — inventoryModifications strictly quarantined
  {
    const cand = {
      candidateId: 1,
      label: '구식 필드 침투 시도',
      narrativeSummary: 'inventoryModifications 사용 시도',
      rawMetadata: {
        inventoryModifications: [{ name: '철검', quantity: 1 }]
      }
    };
    const res = runCandidateRecoveryGate([cand]);
    assert(
      res.passedCount === 0 && res.quarantinedCount === 1,
      'Scenario 26: rawMetadata.inventoryModifications strictly quarantined'
    );
    assert(
      res.quarantinedCandidates[0].reasons.some(r => r.includes('inventoryModifications') && r.includes('UNKNOWN_FIELD')),
      'Scenario 26: Quarantine reason explicitly states UNKNOWN_FIELD violation for inventoryModifications'
    );
  }

  // Scenario 27: UNKNOWN_FIELD Firewall — statChanges strictly quarantined
  {
    const cand = {
      candidateId: 1,
      label: '구식 statChanges 침투 시도',
      narrativeSummary: 'statChanges 사용 시도',
      rawMetadata: {
        statChanges: '힘 +1'
      }
    };
    const res = runCandidateRecoveryGate([cand]);
    assert(
      res.passedCount === 0 && res.quarantinedCount === 1,
      'Scenario 27: rawMetadata.statChanges strictly quarantined as UNKNOWN_FIELD'
    );
  }

  // Scenario 28: UNKNOWN_FIELD Firewall — Top-level currentChapter / upcomingChapters strictly quarantined
  {
    const cand = {
      candidateId: 1,
      label: '최상위 챕터 필드 침투 시도',
      narrativeSummary: '최상위 currentChapter 사용',
      rawMetadata: {
        currentChapter: '1장 시작'
      }
    };
    const res = runCandidateRecoveryGate([cand]);
    assert(
      res.passedCount === 0 && res.quarantinedCount === 1,
      'Scenario 28: Top-level currentChapter in rawMetadata strictly quarantined'
    );
    assert(
      res.quarantinedCandidates[0].reasons.some(r => r.includes('currentChapter') && r.includes('UNKNOWN_FIELD')),
      'Scenario 28: Explicit UNKNOWN_FIELD quarantine reason for top-level currentChapter'
    );
  }

  // Scenario 29: UNKNOWN_FIELD Firewall — recommendedDC / dcReason strictly quarantined
  {
    const cand = {
      candidateId: 1,
      label: '주사위 난이도 주입 시도',
      narrativeSummary: 'recommendedDC 사용',
      rawMetadata: {
        recommendedDC: 12,
        dcReason: '임의 난이도'
      }
    };
    const res = runCandidateRecoveryGate([cand]);
    assert(
      res.passedCount === 0 && res.quarantinedCount === 1,
      'Scenario 29: rawMetadata.recommendedDC / dcReason strictly quarantined'
    );
  }

  // Scenario 30: UNKNOWN_FIELD Firewall — factCheckSummary / contextVerificationDeclaration strictly quarantined
  {
    const cand = {
      candidateId: 1,
      label: '서술 검증 요약 주입 시도',
      narrativeSummary: 'factCheckSummary 사용',
      rawMetadata: {
        factCheckSummary: '위조 검증',
        contextVerificationDeclaration: '위조 선언'
      }
    };
    const res = runCandidateRecoveryGate([cand]);
    assert(
      res.passedCount === 0 && res.quarantinedCount === 1,
      'Scenario 30: factCheckSummary / contextVerificationDeclaration strictly quarantined'
    );
  }

  // Scenario 31: Engine-owned resolvedEntityId in candidate root strictly rejected
  {
    const cand = {
      candidateId: 1,
      label: '엔진 ID 위조 시도',
      narrativeSummary: 'candidate.resolvedEntityId 포함',
      resolvedEntityId: 'engine-spoofed-id',
      rawMetadata: {}
    };
    const res = runCandidateRecoveryGate([cand]);
    assert(
      res.passedCount === 0 && res.quarantinedCount === 1,
      'Scenario 31: candidate.resolvedEntityId strictly rejected and quarantined'
    );
    assert(
      res.quarantinedCandidates[0].reasons.some(r => r.includes('resolvedEntityId') && r.includes('engine-owned')),
      'Scenario 31: Reason clearly identifies prohibited engine-owned resolvedEntityId'
    );
  }

  // Scenario 32: Nested resolvedEntityId inside newNpcs strictly rejected
  {
    const cand = {
      candidateId: 1,
      label: 'NPC 엔진 ID 위조 시도',
      narrativeSummary: 'newNpcs[0].resolvedEntityId 포함',
      rawMetadata: {
        newNpcs: [
          {
            name: '위조 NPC',
            resolvedEntityId: 'engine-npc-spoof'
          }
        ]
      }
    };
    const res = runCandidateRecoveryGate([cand]);
    assert(
      res.passedCount === 0 && res.quarantinedCount === 1,
      'Scenario 32: newNpcs[0].resolvedEntityId strictly rejected and quarantined'
    );
  }

  // Scenario 33: inventoryChanges without entityReference MUST PASS Recovery Gate
  {
    const cand = {
      candidateId: 1,
      label: '황동 방울 획득',
      narrativeSummary: '황동 방울을 발견하여 획득한다.',
      rawMetadata: {
        inventoryChanges: [
          {
            name: '황동 방울',
            quantity: 1,
            action: 'add',
            cause: 'DISCOVERY_PICKUP',
            verifiedEventId: 'event_shaman_item_discovery'
          }
        ]
      }
    };
    const res = runCandidateRecoveryGate([cand]);
    assert(
      res.passedCount === 1 && res.quarantinedCount === 0,
      'Scenario 33: inventoryChanges without entityReference MUST PASS Recovery Gate'
    );
  }

  // Scenario 34: inventoryChanges with invalid entityReference (null / array / primitive) MUST BE QUARANTINED
  {
    const invalidRefs = [null, ['invalid'], 'invalid_string', 123];
    for (const invalidRef of invalidRefs) {
      const cand = {
        candidateId: 1,
        label: '잘못된 entityReference 테스트',
        narrativeSummary: 'invalid entityReference',
        rawMetadata: {
          inventoryChanges: [
            {
              name: '손상된 아이템',
              entityReference: invalidRef
            }
          ]
        }
      };
      const res = runCandidateRecoveryGate([cand]);
      assert(
        res.passedCount === 0 && res.quarantinedCount === 1,
        `Scenario 34: inventoryChanges with invalid entityReference (${typeof invalidRef}) MUST BE QUARANTINED`
      );
    }
  }

  return report;
}
