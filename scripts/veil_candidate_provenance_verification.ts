import { SovereignEngine } from '../src/engine/state.ts';
import { EngineValidator } from '../src/engine/validator.ts';
import { buildSafeProposalFromCandidate } from '../src/engine/proposalParser.ts';
import { extractCandidatesFromMetadata } from '../src/utils/engineValidator.ts';
import { parseGMResponseMetaData } from '../src/utils/parser.ts';
import { createEmptyCharacter, createEmptyWorldInfo } from '../src/utils/factory.ts';
import { CanonicalState, VeilCandidatePacket } from '../src/types.ts';

function runProductPathVerification() {
  console.log('================================================================');
  console.log('TRPG 3.1 — VEIL Candidate Authorization Provenance Verification');
  console.log('================================================================\n');

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(name: string, condition: boolean, details?: string) {
    totalChecks++;
    if (condition) {
      console.log(`[PASS] ${name}`);
      passedChecks++;
    } else {
      console.error(`[FAIL] ${name}${details ? ` - ${details}` : ''}`);
    }
  }

  // Setup initial canonical world & character
  const initialWorld = createEmptyWorldInfo();
  initialWorld.currentTime = {
    year: 1,
    season: '봄',
    day: 1,
    timeOfDay: '오전',
    formattedTime: '1년차 봄 1일 오전'
  };
  const initialCharacter = createEmptyCharacter();
  initialCharacter.name = '백연화';
  initialCharacter.inventory = [
    { id: 'inv_silver_coin', name: '은화', quantity: 20, type: '재화', isEquipped: false }
  ];
  const storyTurnCount = 2;
  const canonicalState: CanonicalState = {
    stateVersion: 1,
    turn: storyTurnCount,
    worldInfo: initialWorld,
    character: initialCharacter,
    lastCommittedEventId: 'evt_genesis',
    lastCommittedAt: new Date().toISOString()
  };

  const executedRequestIds = new Set<string>();
  const recordedEventIds = new Set<string>();
  const historicalRecords: any[] = [];

  // Setup 3 candidate packets (Candidate 1: ALLOW, Candidate 2: REJECT, Candidate 3: ALLOW)
  const candidate1_Allow: VeilCandidatePacket = {
    candidateId: 1,
    label: '객잔 앞 포고문 확인 및 새로운 복선 발생',
    narrativeSummary: '객잔 벽에 붙은 포고문을 유심히 살펴본다.',
    rawMetadata: {
      factCheckSummary: '1) 포고문 확인 및 복선 씨앗 생성',
      foreshadowSeeds: ['장안성 근교에서 출몰하는 의문의 복면검객 소문']
    }
  };

  const candidate2_Reject: VeilCandidatePacket = {
    candidateId: 2,
    label: '출처 불명 전설검 기습 획득',
    narrativeSummary: '하늘에서 갑자기 떨어진 전설의 무형검을 쥔다.',
    rawMetadata: {
      factCheckSummary: '1) 출처 불명 전설검 획득',
      inventoryChanges: [
        { name: '무형검', quantity: 1, action: 'add' } // Missing causality cost/cause
      ]
    }
  };

  const candidate3_Allow: VeilCandidatePacket = {
    candidateId: 3,
    label: '이객주와의 환담',
    narrativeSummary: '이객주와 대화하며 소문을 듣는다.',
    rawMetadata: {
      factCheckSummary: '1) 대화 및 소문 청취',
      newNpcs: [
        {
          name: '이객주',
          alias: '객잔 주인',
          npcClass: '일반인',
          innerThought: '새 손님이 찾아왔군.',
          metInStory: true,
          isDead: false,
          origin: '산동',
          background: '객잔 20년 운영',
          informationAccess: 'PUBLIC'
        }
      ]
    }
  };

  const allCandidates = [candidate1_Allow, candidate2_Reject, candidate3_Allow];

  // Run PreAuth
  const preAuthResults = allCandidates.map(c => {
    const extracted = extractCandidatesFromMetadata(c.rawMetadata, storyTurnCount, initialWorld.currentTime.formattedTime);
    const proposal = buildSafeProposalFromCandidate(canonicalState, extracted, storyTurnCount, historicalRecords);
    const val = EngineValidator.validate(proposal, canonicalState, executedRequestIds, recordedEventIds, historicalRecords);
    return {
      ...c,
      preAuthStatus: val.isValid ? ('ALLOW' as const) : ('REJECT' as const),
      preAuthReasons: val.isValid ? [] : [...val.rejectedReasons, ...val.conflictDetails]
    };
  });

  console.log('PreAuth Results:', JSON.stringify(preAuthResults.map(p => ({ id: p.candidateId, status: p.preAuthStatus, reasons: p.preAuthReasons })), null, 2));

  const allowedCandidates = preAuthResults.filter(c => c.preAuthStatus === 'ALLOW');

  assert(
    'PreAuth correctly partitions candidates into ALLOW and REJECT',
    allowedCandidates.length === 2 &&
    allowedCandidates.some(c => c.candidateId === 1) &&
    allowedCandidates.some(c => c.candidateId === 3) &&
    !allowedCandidates.some(c => c.candidateId === 2)
  );

  // Helper simulating the exact server.ts logic
  function simulateServerPhase2(rawPhase2Response: string) {
    const selectMatch = rawPhase2Response.match(/\{"selectedCandidateId"\s*:\s*(\d+)\}/i);
    const selectedId = selectMatch ? parseInt(selectMatch[1], 10) : null;
    const selectedCandidate = selectedId !== null ? (allowedCandidates.find(c => c.candidateId === selectedId) || null) : null;

    let finalResponseText = '';
    let authorizedCandidateId: number | null = null;

    if (selectedCandidate) {
      authorizedCandidateId = selectedCandidate.candidateId;
      const metaJson = JSON.stringify(selectedCandidate.rawMetadata, null, 2);
      const finalNarrative = rawPhase2Response.replace(/\{"selectedCandidateId"\s*:\s*\d+\}/i, '').trim();
      finalResponseText = `\`\`\`markdown\n${selectedCandidate.rawMetadata?.factCheckSummary || '1) [검증]: 완료'}\n\`\`\`\n\`\`\`json\n${metaJson}\n\`\`\`\n\n${finalNarrative}`;
    } else {
      const cleanNarrative = rawPhase2Response.replace(/\{"selectedCandidateId"\s*:\s*\d+\}/i, '').trim();
      finalResponseText = cleanNarrative;
    }

    return {
      success: true,
      text: finalResponseText,
      rawResponse: finalResponseText,
      selectedCandidateId: authorizedCandidateId,
      isFallbackNonMutation: !selectedCandidate
    };
  }

  // Helper simulating the exact client App.tsx logic
  function simulateClientTurn(serverResponse: ReturnType<typeof simulateServerPhase2>, engine: SovereignEngine) {
    const rawOutputText = serverResponse.text;
    const { cleanText, metaData } = parseGMResponseMetaData(rawOutputText);

    let proposalBuilt = false;
    let commitResult: any = null;

    const hasAuthorizedMutation = Boolean(metaData && serverResponse.selectedCandidateId && !serverResponse.isFallbackNonMutation);

    if (hasAuthorizedMutation) {
      const candidate = extractCandidatesFromMetadata(
        metaData,
        storyTurnCount,
        initialWorld.currentTime.formattedTime
      );
      const snapshot = engine.getSnapshot();
      const proposal = buildSafeProposalFromCandidate(
        snapshot,
        candidate,
        storyTurnCount,
        engine.getHistory()
      );
      proposalBuilt = true;
      commitResult = engine.submitProposal(proposal);
    }

    return {
      hasAuthorizedMutation,
      proposalBuilt,
      commitResult,
      cleanText,
      metaData
    };
  }

  // -------------------------------------------------------------
  // Test 1: ALLOW Candidate 1 selected -> Exact commit succeeds
  // -------------------------------------------------------------
  {
    const engine1 = new SovereignEngine(initialWorld, initialCharacter, historicalRecords, storyTurnCount);
    const serverRes = simulateServerPhase2(`{"selectedCandidateId": 1}\n포고문을 차분히 읽어내려갔다.`);
    const clientRes = simulateClientTurn(serverRes, engine1);

    assert(
      'ALLOW A -> A -> Normal Proposal & Commit succeeds cleanly',
      serverRes.selectedCandidateId === 1 &&
      serverRes.isFallbackNonMutation === false &&
      clientRes.proposalBuilt === true &&
      clientRes.commitResult?.success === true
    );
  }

  // -------------------------------------------------------------
  // Test 1-B: ALLOW Candidate 3 selected (NPC 등록) -> Exact NPC commit succeeds
  // -------------------------------------------------------------
  {
    const engine1b = new SovereignEngine(initialWorld, initialCharacter, historicalRecords, storyTurnCount);
    const serverRes = simulateServerPhase2(`{"selectedCandidateId": 3}\n이객주가 웃으며 차를 내왔다.`);
    const clientRes = simulateClientTurn(serverRes, engine1b);

    assert(
      'ALLOW Candidate 3 (NPC 등록) -> Exact NPC Commit into Canonical State succeeds',
      serverRes.selectedCandidateId === 3 &&
      serverRes.isFallbackNonMutation === false &&
      clientRes.proposalBuilt === true &&
      clientRes.commitResult?.success === true &&
      clientRes.commitResult?.snapshot.worldInfo.npcs.some((n: any) => n.name === '이객주')
    );
  }

  // -------------------------------------------------------------
  // Test 2: REJECT Candidate 2 selected -> Fail-Closed: No proposal, No commit
  // -------------------------------------------------------------
  {
    const engine2 = new SovereignEngine(initialWorld, initialCharacter, historicalRecords, storyTurnCount);
    const snapshotBefore = engine2.getSnapshot();
    const serverRes = simulateServerPhase2(`{"selectedCandidateId": 2}\n무형검을 쥐고 휘두른다.`);
    const clientRes = simulateClientTurn(serverRes, engine2);
    const snapshotAfter = engine2.getSnapshot();

    assert(
      'REJECT B -> B -> Fail-Closed: No Proposal, No Commit, Zero State Mutation',
      serverRes.selectedCandidateId === null &&
      serverRes.isFallbackNonMutation === true &&
      clientRes.proposalBuilt === false &&
      clientRes.commitResult === null &&
      JSON.stringify(snapshotBefore) === JSON.stringify(snapshotAfter)
    );
  }

  // -------------------------------------------------------------
  // Test 3: UNKNOWN Candidate ID (e.g. 999) -> Fail-Closed: No proposal, No commit
  // -------------------------------------------------------------
  {
    const engine3 = new SovereignEngine(initialWorld, initialCharacter, historicalRecords, storyTurnCount);
    const snapshotBefore = engine3.getSnapshot();
    const serverRes = simulateServerPhase2(`{"selectedCandidateId": 999}\n알 수 없는 환상 속에서 걷는다.`);
    const clientRes = simulateClientTurn(serverRes, engine3);
    const snapshotAfter = engine3.getSnapshot();

    assert(
      'UNKNOWN ID 999 -> Fail-Closed: No Proposal, No Commit, Zero State Mutation',
      serverRes.selectedCandidateId === null &&
      serverRes.isFallbackNonMutation === true &&
      clientRes.proposalBuilt === false &&
      clientRes.commitResult === null &&
      JSON.stringify(snapshotBefore) === JSON.stringify(snapshotAfter)
    );
  }

  // -------------------------------------------------------------
  // Test 4: Missing selectedCandidateId / parsing failure -> Fail-Closed: No proposal, No commit
  // -------------------------------------------------------------
  {
    const engine4 = new SovereignEngine(initialWorld, initialCharacter, historicalRecords, storyTurnCount);
    const snapshotBefore = engine4.getSnapshot();
    const serverRes = simulateServerPhase2(`아무런 태그 없이 서사만 출력한다.`);
    const clientRes = simulateClientTurn(serverRes, engine4);
    const snapshotAfter = engine4.getSnapshot();

    assert(
      'Missing selectedCandidateId -> Fail-Closed: No Proposal, No Commit, Zero State Mutation',
      serverRes.selectedCandidateId === null &&
      serverRes.isFallbackNonMutation === true &&
      clientRes.proposalBuilt === false &&
      clientRes.commitResult === null &&
      JSON.stringify(snapshotBefore) === JSON.stringify(snapshotAfter)
    );
  }

  // -------------------------------------------------------------
  // Test 5: Client tamper defense -> Server authority invariant
  // If a compromised client attempts to build a proposal without server authorization
  // -------------------------------------------------------------
  {
    const engine5 = new SovereignEngine(initialWorld, initialCharacter, historicalRecords, storyTurnCount);
    const snapshotBefore = engine5.getSnapshot();

    // Client attempts to forge a proposal for an unapproved Candidate 2
    const forgedCandidate = extractCandidatesFromMetadata(
      candidate2_Reject.rawMetadata,
      storyTurnCount,
      initialWorld.currentTime.formattedTime
    );
    const forgedProposal = buildSafeProposalFromCandidate(
      snapshotBefore,
      forgedCandidate,
      storyTurnCount,
      engine5.getHistory()
    );

    // 5.7 Engine Commit Gate directly defends against the forged proposal
    const commitResult = engine5.submitProposal(forgedProposal);
    const snapshotAfter = engine5.getSnapshot();

    assert(
      'Client forged proposal defense: 5.7 Sovereign Commit Gate blocks unauthorized mutation',
      commitResult.success === false &&
      commitResult.rejectedReasons.length > 0 &&
      JSON.stringify(snapshotBefore) === JSON.stringify(snapshotAfter)
    );
  }

  console.log(`\n================================================================`);
  console.log(`Verification Complete: ${passedChecks}/${totalChecks} Checks Passed.`);
  console.log(`================================================================\n`);
}

runProductPathVerification();
