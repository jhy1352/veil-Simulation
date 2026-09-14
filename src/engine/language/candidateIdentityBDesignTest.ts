/**
 * @file src/engine/language/candidateIdentityBDesignTest.ts
 * @description VEIL Candidate Identity B-Design Exhaustive Invariant & Red Team Suite
 * 
 * Verifies:
 * 1. Parser Authority: parseCandidatesBlock strictly assigns sequential canonical candidateIds (1..N, max 5) based on array order.
 * 2. LLM ID Immunity: Complete neutralization of LLM ID forgery, duplicate IDs, missing IDs, out-of-order IDs, negative IDs, float IDs, and type spoofs.
 * 3. Payload Preservation: label, narrativeSummary, rawMetadata are preserved with zero semantic distortion.
 * 4. Downstream Pipeline Invariants:
 *    - runCandidateRecoveryGate receives pristine 1..N IDs and zero duplicate-ID quarantines.
 *    - Translation -> Diversity Gate -> PreAuth Gate validate accurately.
 *    - LLM #2 selectedCandidateId resolution deterministically targets the exact intended candidate.
 *    - Selection tampering strictly fails-closed to non-mutation.
 */

import { parseCandidatesBlock, VeilCandidate, runCandidateRecoveryGate } from './candidateRecoveryGate.ts';
import { extractCandidatesFromMetadata } from '../../utils/engineValidator.ts';
import { buildSafeProposalFromCandidate } from '../proposalParser.ts';
import { filterDiverseCandidates } from './diversity.ts';
import { EngineValidator } from '../validator.ts';
import { CanonicalState } from '../types.ts';

export interface BDesignTestReport {
  total: number;
  passed: number;
  failed: number;
  errors: string[];
}

export function runCandidateIdentityBDesignSuite(): BDesignTestReport {
  const report: BDesignTestReport = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  function assert(condition: boolean, testName: string, detail?: string) {
    report.total++;
    if (condition) {
      report.passed++;
      console.log(`  [PASS] #${report.total}: ${testName}`);
    } else {
      report.failed++;
      const err = `  [FAIL] #${report.total}: ${testName}${detail ? ` — ${detail}` : ''}`;
      console.error(err);
      report.errors.push(err);
    }
  }

  console.log('\n================================================================');
  console.log('  VEIL CANDIDATE IDENTITY B-DESIGN — EXHAUSTIVE INVARIANT SUITE');
  console.log('================================================================\n');

  const baseMetadata = {
    foreshadowSeeds: ['Seed A'],
    cameraOffscreenEvents: ['Event A'],
    chapterChanges: {
      currentChapter: '1장 시작',
      upcomingChapters: ['2장 전개', '3장 위기', '4장 결말']
    }
  };

  // Test 1: Missing candidateId from LLM -> Parser assigns canonical 1..N
  {
    const rawBlock = `
[CANDIDATES_BLOCK]
[
  {
    "label": "숲으로 진입",
    "narrativeSummary": "숲길을 따라 걷는다",
    "rawMetadata": ${JSON.stringify(baseMetadata)}
  },
  {
    "label": "마을 광장 조사",
    "narrativeSummary": "광장 사람들의 대화를 듣는다",
    "rawMetadata": ${JSON.stringify(baseMetadata)}
  },
  {
    "label": "동굴 탐색",
    "narrativeSummary": "어두운 동굴 입구를 살핀다",
    "rawMetadata": ${JSON.stringify(baseMetadata)}
  }
]
[CANDIDATES_END]
    `;

    const parsed = parseCandidatesBlock(rawBlock);
    assert(parsed !== null, 'T1.1: parseCandidatesBlock parses array without candidateId in source');
    assert(Array.isArray(parsed) && parsed.length === 3, 'T1.2: Exactly 3 candidates parsed');
    assert(parsed![0].candidateId === 1, 'T1.3: 1st candidate assigned candidateId: 1');
    assert(parsed![1].candidateId === 2, 'T1.4: 2nd candidate assigned candidateId: 2');
    assert(parsed![2].candidateId === 3, 'T1.5: 3rd candidate assigned candidateId: 3');
    assert(parsed![0].label === '숲으로 진입', 'T1.6: Payload label preserved verbatim');
  }

  // Test 2: Duplicate candidateId from LLM (all 1s) -> Parser enforces unique canonical 1, 2, 3
  {
    const rawBlock = `
[CANDIDATES_BLOCK]
[
  {
    "candidateId": 1,
    "label": "행동 A",
    "narrativeSummary": "요약 A",
    "rawMetadata": ${JSON.stringify(baseMetadata)}
  },
  {
    "candidateId": 1,
    "label": "행동 B",
    "narrativeSummary": "요약 B",
    "rawMetadata": ${JSON.stringify(baseMetadata)}
  },
  {
    "candidateId": 1,
    "label": "행동 C",
    "narrativeSummary": "요약 C",
    "rawMetadata": ${JSON.stringify(baseMetadata)}
  }
]
[CANDIDATES_END]
    `;

    const parsed = parseCandidatesBlock(rawBlock);
    assert(parsed !== null, 'T2.1: Duplicate ID block parses successfully');
    assert(parsed![0].candidateId === 1, 'T2.2: First candidate assigned canonical ID 1');
    assert(parsed![1].candidateId === 2, 'T2.3: Second candidate assigned canonical ID 2 (overwriting duplicate 1)');
    assert(parsed![2].candidateId === 3, 'T2.4: Third candidate assigned canonical ID 3 (overwriting duplicate 1)');

    const gate = runCandidateRecoveryGate<VeilCandidate>(parsed!);
    assert(gate.passedCount === 3, 'T2.5: All 3 pass recovery gate without duplicate quarantine');
    assert(gate.quarantinedCount === 0, 'T2.6: Zero quarantined candidates');
  }

  // Test 3: Forged / Arbitrary / Out-of-order IDs from LLM -> Neutralized to 1, 2, 3, 4, 5
  {
    const rawBlock = `
[CANDIDATES_BLOCK]
[
  {
    "candidateId": 9999,
    "label": "고유행동 1",
    "narrativeSummary": "서사 1",
    "rawMetadata": ${JSON.stringify(baseMetadata)}
  },
  {
    "candidateId": -42,
    "label": "고유행동 2",
    "narrativeSummary": "서사 2",
    "rawMetadata": ${JSON.stringify(baseMetadata)}
  },
  {
    "candidateId": "FORGED_STRING_ID",
    "label": "고유행동 3",
    "narrativeSummary": "서사 3",
    "rawMetadata": ${JSON.stringify(baseMetadata)}
  },
  {
    "candidateId": 3.141592,
    "label": "고유행동 4",
    "narrativeSummary": "서사 4",
    "rawMetadata": ${JSON.stringify(baseMetadata)}
  },
  {
    "candidateId": null,
    "label": "고유행동 5",
    "narrativeSummary": "서사 5",
    "rawMetadata": ${JSON.stringify(baseMetadata)}
  }
]
[CANDIDATES_END]
    `;

    const parsed = parseCandidatesBlock(rawBlock);
    assert(parsed !== null, 'T3.1: Forged IDs block parsed');
    assert(parsed!.length === 5, 'T3.2: 5 candidates extracted');
    assert(parsed!.map(c => c.candidateId).join(',') === '1,2,3,4,5', 'T3.3: Canonical sequential IDs [1, 2, 3, 4, 5] strictly assigned');

    const gate = runCandidateRecoveryGate<VeilCandidate>(parsed!);
    assert(gate.passedCount === 5, 'T3.4: All 5 pass gate cleanly due to Parser ID authority');
  }

  // Test 4: Cardinality non-truncation verification (7 candidates parsed, excess explicitly quarantined in Recovery Gate)
  {
    const rawList = [];
    for (let i = 0; i < 7; i++) {
      rawList.push({
        candidateId: i * 10,
        label: `행동 ${i + 1}`,
        narrativeSummary: `요약 ${i + 1}`,
        rawMetadata: { ...baseMetadata }
      });
    }

    const rawBlock = `[CANDIDATES_BLOCK]\n${JSON.stringify(rawList)}\n[CANDIDATES_END]`;
    const parsed = parseCandidatesBlock(rawBlock);
    assert(parsed !== null && parsed.length === 7, 'T4.1: Parsed candidates are not truncated silently');
    assert(parsed!.map(c => c.candidateId).join(',') === '1,2,3,4,5,6,7', 'T4.2: Candidates sequentialized beyond 5');
    assert(parsed![6].label === '행동 7', 'T4.3: Last candidate is preserved');

    // Run recovery gate on the 7 parsed candidates
    const gate = runCandidateRecoveryGate(parsed);
    assert(gate.passedCount === 5, 'T4.4: Exactly 5 candidates pass the structural ceiling check');
    assert(gate.quarantinedCount === 2, 'T4.5: Excess 2 candidates are explicitly quarantined');
    assert(gate.quarantinedCandidates[0].index === 5, 'T4.6: 6th candidate is quarantined');
    assert(gate.quarantinedCandidates[0].reasons[0].includes('out of bounds'), 'T4.7: Explicit out of bounds quarantine reason recorded');
  }

  // Test 5: End-to-End Pipeline & LLM #2 selectedCandidateId Resolution Integrity
  {
    const canonicalState: CanonicalState = {
      stateVersion: 1,
      turn: 1,
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
      lastCommittedEventId: null,
      lastCommittedAt: new Date().toISOString()
    };

    const rawBlock = `
[CANDIDATES_BLOCK]
[
  {
    "candidateId": 100,
    "label": "제1안: 평화 협상",
    "narrativeSummary": "대화로 사태를 해결한다",
    "rawMetadata": ${JSON.stringify(baseMetadata)}
  },
  {
    "candidateId": 200,
    "label": "제2안: 전술적 우회",
    "narrativeSummary": "적의 측면으로 우회한다",
    "rawMetadata": ${JSON.stringify({ ...baseMetadata, cameraOffscreenEvents: ['Event B'] })}
  }
]
[CANDIDATES_END]
    `;

    const parsed = parseCandidatesBlock(rawBlock)!;
    const gate = runCandidateRecoveryGate<VeilCandidate>(parsed);
    const candidates = gate.passedCandidates;

    // Translation & PreAuth with Canonical Candidate ID preservation
    const translated = candidates.map(c => {
      const candidatePacket = extractCandidatesFromMetadata(c.rawMetadata, 1, '1년차 봄 1일', c.candidateId);
      const proposal = buildSafeProposalFromCandidate(canonicalState, candidatePacket, 1, []);
      return { candidate: c, candidatePacket, proposal, meaningTree: proposal.meaningTree! };
    });

    // Invariant: candidatePacket.candidateId === String(c.candidateId)
    assert(translated[0].candidatePacket.candidateId === '1', 'T5.0a: CandidatePacket 1 preserved ID "1"');
    assert(translated[1].candidatePacket.candidateId === '2', 'T5.0b: CandidatePacket 2 preserved ID "2"');
    assert(translated[0].proposal.originInputId === '1', 'T5.0c: Proposal 1 has originInputId "1"');
    assert(translated[1].proposal.originInputId === '2', 'T5.0d: Proposal 2 has originInputId "2"');

    const preAuthResults: VeilCandidate[] = translated.map(tc => {
      const v = EngineValidator.validate(tc.proposal, canonicalState, new Set(), new Set(), []);
      return {
        ...tc.candidate,
        preAuthStatus: v.isValid ? 'ALLOW' : 'REJECT',
        preAuthReasons: [...v.rejectedReasons]
      };
    });

    const allowed = preAuthResults.filter(c => c.preAuthStatus === 'ALLOW');
    assert(allowed.length === 2, 'T5.1: Both candidates allowed in PreAuth');
    assert(allowed[0].candidateId === 1, 'T5.2: Candidate 1 has ID 1');
    assert(allowed[1].candidateId === 2, 'T5.3: Candidate 2 has ID 2');

    // Case 5A: LLM #2 correctly selects Candidate 2
    const rawLlm2Success = `{"selectedCandidateId": 2}\n적의 측면으로 조용히 우회하며 진입로를 확보했다.`;
    const selectMatch = rawLlm2Success.match(/\{"selectedCandidateId"\s*:\s*(\d+)\}/i);
    const selectedId = selectMatch ? parseInt(selectMatch[1], 10) : null;
    const selectedCandidate = selectedId !== null ? (allowed.find(c => c.candidateId === selectedId) || null) : null;

    assert(selectedCandidate !== null, 'T5.4: LLM #2 selected Candidate 2 found in ALLOW list');
    assert(selectedCandidate!.label === '제2안: 전술적 우회', 'T5.5: Selected candidate matches exact 2nd candidate payload');

    // Case 5B: LLM #2 attempts selecting an unassigned/forged ID 200 (original prompt ID before parser normalization)
    const rawLlm2Forged = `{"selectedCandidateId": 200}\n200번 선택지 실행 시도`;
    const forgedMatch = rawLlm2Forged.match(/\{"selectedCandidateId"\s*:\s*(\d+)\}/i);
    const forgedId = forgedMatch ? parseInt(forgedMatch[1], 10) : null;
    const forgedCandidate = forgedId !== null ? (allowed.find(c => c.candidateId === forgedId) || null) : null;

    assert(forgedCandidate === null, 'T5.6: Forged/Old ID 200 is REJECTED (Fail-Closed to non-mutation)');
  }

  // ============================================================================
  // Test 6: Full Lifecycle Identity Invariant Proof (Parser -> PreAuth -> LLM #2 -> Final Translation -> Proposal -> Commit)
  // ============================================================================
  {
    console.log('Test 6: Full Candidate Identity Lifecycle Invariant Proof (#1~#5)');

    const canonicalState: CanonicalState = {
      stateVersion: 1,
      turn: 1,
      worldInfo: {
        worldName: '테스트 세계',
        settingDescription: '테스트 설정',
        currentTime: { year: 1, month: 1, day: 1, timeOfDay: '아침', formattedTime: '1년차 봄 1일' },
        seeds: [],
        npcs: [],
        factions: [],
        offscreenRecords: []
      } as any,
      character: {
        name: '주인공',
        stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        inventory: []
      } as any,
      lastCommittedEventId: null,
      lastCommittedAt: new Date().toISOString()
    };

    const fiveCandidatesRaw = `
[CANDIDATES_BLOCK]
[
  { "candidateId": 999, "label": "옵션 1", "narrativeSummary": "설명 1", "rawMetadata": { "statDeltas": [{ "stat": "strength", "delta": 1 }] } },
  { "candidateId": 888, "label": "옵션 2", "narrativeSummary": "설명 2", "rawMetadata": { "statDeltas": [{ "stat": "agility", "delta": 1 }] } },
  { "candidateId": 777, "label": "옵션 3", "narrativeSummary": "설명 3", "rawMetadata": { "statDeltas": [{ "stat": "intelligence", "delta": 1 }] } },
  { "candidateId": 666, "label": "옵션 4", "narrativeSummary": "설명 4", "rawMetadata": { "statDeltas": [{ "stat": "wisdom", "delta": 1 }] } },
  { "candidateId": 555, "label": "옵션 5", "narrativeSummary": "설명 5", "rawMetadata": { "statDeltas": [{ "stat": "charisma", "delta": 1 }] } }
]
[CANDIDATES_END]
    `;

    // 1. Parser Authority assigns sequential canonical IDs 1..5
    const parsed = parseCandidatesBlock(fiveCandidatesRaw)!;
    assert(parsed.length === 5, 'T6.1: Parser extracted 5 candidates');
    parsed.forEach((c, idx) => {
      assert(c.candidateId === idx + 1, `T6.2.${idx + 1}: Parser assigned canonical candidateId ${idx + 1}`);
    });

    // 2. Recovery Gate passes all 5 with zero mutation
    const gate = runCandidateRecoveryGate<VeilCandidate>(parsed);
    assert(gate.passedCount === 5, 'T6.3: Gate passed all 5 candidates');

    // 3. PreAuth Translation retains exact canonical candidateId
    const preAuthPackets = gate.passedCandidates.map(c =>
      extractCandidatesFromMetadata(c.rawMetadata, 1, '1년차 봄 1일', c.candidateId)
    );

    preAuthPackets.forEach((pkt, idx) => {
      assert(pkt.candidateId === String(idx + 1), `T6.4.${idx + 1}: PreAuth CandidatePacket has exact ID "${idx + 1}" (no new random ID)`);
      assert(!pkt.candidateId.startsWith('cand-'), `T6.5.${idx + 1}: PreAuth CandidatePacket is NOT overwritten with random cand- ID`);
    });

    // 4. LLM #2 selects Candidate #4
    const selectedCandidateId = 4;
    const chosenCandidate = gate.passedCandidates.find(c => c.candidateId === selectedCandidateId)!;
    assert(chosenCandidate.label === '옵션 4', 'T6.6: Chosen candidate is option 4');

    // 5. Final Translation receives selectedCandidateId
    const finalPacket = extractCandidatesFromMetadata(
      chosenCandidate.rawMetadata,
      1,
      '1년차 봄 1일',
      selectedCandidateId
    );

    assert(finalPacket.candidateId === '4', 'T6.7: Final CandidatePacket identity strictly matches selectedCandidateId "4"');
    assert(finalPacket.statChanges.length === 1 && finalPacket.statChanges[0].stat === 'wisdom', 'T6.8: Final CandidatePacket payload zero mutation');

    // 6. Proposal generation preserves originInputId = "4"
    const proposal = buildSafeProposalFromCandidate(canonicalState, finalPacket, 1, []);
    assert(proposal.originInputId === '4', 'T6.9: Proposal.originInputId is strictly "4"');

    // 7. Backward compatibility: when canonicalCandidateId is omitted, fallback generates 'cand-' ID
    const defaultPacket = extractCandidatesFromMetadata({}, 1);
    assert(defaultPacket.candidateId.startsWith('cand-'), 'T6.10: Omitted canonicalCandidateId falls back to generated cand- ID');
  }

  console.log('\n================================================================');
  console.log(`  VERDICT: ${report.passed}/${report.total} PASSED (Failed: ${report.failed})`);
  console.log('================================================================\n');

  return report;
}

if (process.argv[1]?.includes('candidateIdentityBDesignTest')) {
  const report = runCandidateIdentityBDesignSuite();
  if (report.failed > 0) {
    process.exit(1);
  }
}
