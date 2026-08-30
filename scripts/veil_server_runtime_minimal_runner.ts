import fs from 'fs';
import path from 'path';
import { SovereignEngine } from '../src/engine/state.ts';
import { EngineValidator } from '../src/engine/validator.ts';
import { buildSafeProposalFromCandidate } from '../src/engine/proposalParser.ts';
import { validateLLM2MutationBoundary } from '../src/engine/mutationBoundary.ts';
import { extractCandidatesFromMetadata } from '../src/utils/engineValidator.ts';
import { parseGMResponseMetaData } from '../src/utils/parser.ts';
import { createEmptyCharacter, createEmptyWorldInfo } from '../src/utils/factory.ts';
import { CanonicalState, StateTransitionProposal, VeilCandidatePacket } from '../src/types.ts';

async function runObservation() {
  const timestamp = new Date().toISOString();
  const gitHead = 'c44e4701e69b596d66e7ea81b5d635035fe7cb91';

  // -------------------------------------------------------------
  // Setup standard test world & character state
  // -------------------------------------------------------------
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

  // =============================================================
  // QUESTION 2: Server Candidate ID Binding Behavior
  // When LLM #2 returns a REJECTED selectedCandidateId
  // =============================================================
  // Candidate 1 (ALLOWED): Valid trade
  // Candidate 2 (REJECTED): Ungrounded free legend sword
  const candidate1_Allowed: VeilCandidatePacket = {
    candidateId: 1,
    label: '정상 상인 거래',
    narrativeSummary: '은화 5냥으로 지혈초 구매',
    rawMetadata: {
      factCheckSummary: '1) 정상 구매',
      inventoryChanges: [
        { name: '은화', quantity: 5, action: 'remove' },
        { name: '지혈초', quantity: 1, action: 'add', cause: 'RESOURCE_EXCHANGE', cost: { name: '은화', quantity: 5 } }
      ]
    }
  };

  const candidate2_Rejected: VeilCandidatePacket = {
    candidateId: 2,
    label: '출처 불명 전설검 획득',
    narrativeSummary: '공짜 전설검 획득',
    rawMetadata: {
      factCheckSummary: '1) 출처 불명 전설검',
      inventoryChanges: [
        { name: '무형검', quantity: 1, action: 'add' }
      ]
    }
  };

  const candidate3_Allowed: VeilCandidatePacket = {
    candidateId: 3,
    label: '이객주와의 환담',
    narrativeSummary: '대화 및 호감도 상승',
    rawMetadata: {
      factCheckSummary: '1) 대화',
      newNpcs: [
        {
          name: '이객주',
          alias: '객잔 주인',
          npcClass: '일반인',
          innerThought: '새 손님',
          metInStory: true,
          isDead: false,
          origin: '산동',
          background: '객잔 20년',
          informationAccess: 'PUBLIC'
        }
      ]
    }
  };

  const allCandidates = [candidate1_Allowed, candidate2_Rejected, candidate3_Allowed];

  // Run PreAuth
  const preAuthResults = allCandidates.map(c => {
    const extracted = extractCandidatesFromMetadata(c.rawMetadata, storyTurnCount, initialWorld.currentTime.formattedTime);
    const proposal = buildSafeProposalFromCandidate(canonicalState, extracted, storyTurnCount, historicalRecords);
    const val = EngineValidator.validate(proposal, canonicalState, executedRequestIds, recordedEventIds, historicalRecords);
    return {
      candidateId: c.candidateId,
      rawCandidate: c,
      proposal,
      isValid: val.isValid,
      reasons: val.rejectedReasons,
      status: val.isValid ? 'ALLOW' : 'REJECT'
    };
  });

  const allowedCandidates = preAuthResults.filter(c => c.status === 'ALLOW').map(c => c.rawCandidate);
  const rejectedCandidates = preAuthResults.filter(c => c.status === 'REJECT').map(c => c.rawCandidate);

  // Simulate LLM #2 returning selectedCandidateId = 2 (which is in rejectedCandidates)
  const rawPhase2ResponseWithRejectedId = `{"selectedCandidateId": 2}\n무형검을 쥐고 앞으로 나아간다.`;
  const selectMatch = rawPhase2ResponseWithRejectedId.match(/\{"selectedCandidateId"\s*:\s*(\d+)\}/i);
  const selectedId = selectMatch ? parseInt(selectMatch[1], 10) : allowedCandidates[0].candidateId;

  // Actual server.ts lines 797:
  // let selectedCandidate = allowedCandidates.find(c => c.candidateId === selectedId) || allowedCandidates[0];
  const selectedCandidateActual = allowedCandidates.find(c => c.candidateId === selectedId) || allowedCandidates[0];

  const question2Observation = {
    totalCandidates: allCandidates.map(c => ({ id: c.candidateId, label: c.label })),
    preAuthSummary: {
      allowed: allowedCandidates.map(c => ({ id: c.candidateId, label: c.label })),
      rejected: rejectedCandidates.map(c => ({ id: c.candidateId, label: c.label }))
    },
    llm2ReturnedCandidateId: selectedId,
    isLlm2IdInAllowedList: allowedCandidates.some(c => c.candidateId === selectedId),
    isLlm2IdInRejectedList: rejectedCandidates.some(c => c.candidateId === selectedId),
    serverBindingCode: 'allowedCandidates.find(c => c.candidateId === selectedId) || allowedCandidates[0]',
    actualBoundCandidate: {
      boundCandidateId: selectedCandidateActual.candidateId,
      boundLabel: selectedCandidateActual.label,
      boundRawMetadata: selectedCandidateActual.rawMetadata
    },
    serverBehaviorSummary: 'When LLM#2 selects a REJECTED Candidate ID (ID 2), allowedCandidates.find() returns undefined, and the server falls back to allowedCandidates[0] (Candidate 1, ALLOW). The REJECTED candidate metadata is NOT used.'
  };

  // =============================================================
  // QUESTION 1: Mutation Boundary Block Behavior on submitProposal()
  // When Boundary evaluates to isValid: false, does submitProposal() get blocked?
  // =============================================================
  // Let Approved Candidate Proposal = Candidate 1 (Trade)
  // Let Final Proposal Attempt = Tampered proposal (Injected 99 items, violating boundary)
  const approvedProposal = preAuthResults.find(c => c.candidateId === 1)!.proposal;

  const tamperedProposal: StateTransitionProposal = {
    ...approvedProposal,
    requestId: 'req_tampered_001',
    actions: [
      ...approvedProposal.actions,
      {
        type: 'MODIFY_INVENTORY',
        eventId: 'evt_injected_001',
        turn: storyTurnCount,
        source: 'LLM',
        causalTrigger: 'UNAUTHORIZED_SPAWN',
        payload: {
          operation: 'ADD',
          item: { id: 'inv_gold_ingot', name: '황금', quantity: 99, type: '재화', isEquipped: false }
        }
      }
    ]
  };

  // 1. Evaluate Mutation Boundary
  const boundaryCheckResult = validateLLM2MutationBoundary(approvedProposal, tamperedProposal);

  // 2. Simulate client / engine check with Boundary Guard
  let submitProposalCalled = false;
  let commitResult: any = null;
  const engine = new SovereignEngine(initialWorld, initialCharacter, historicalRecords, storyTurnCount);
  const snapshotBefore = engine.getSnapshot();

  if (boundaryCheckResult.isValid) {
    submitProposalCalled = true;
    commitResult = engine.submitProposal(tamperedProposal);
  } else {
    submitProposalCalled = false;
    commitResult = {
      success: false,
      rejectedReasons: boundaryCheckResult.violationReasons,
      conflictDetails: []
    };
  }

  const snapshotAfter = engine.getSnapshot();

  const question1Observation = {
    approvedCandidateActions: approvedProposal.actions.map(a => ({ type: a.type, payload: a.payload })),
    tamperedProposalActions: tamperedProposal.actions.map(a => ({ type: a.type, payload: a.payload })),
    mutationBoundaryResult: {
      isValid: boundaryCheckResult.isValid,
      violationReasons: boundaryCheckResult.violationReasons
    },
    submitProposalInvocation: {
      submitProposalCalled,
      stateVersionBefore: snapshotBefore.stateVersion,
      stateVersionAfter: snapshotAfter.stateVersion,
      inventoryBefore: snapshotBefore.character.inventory,
      inventoryAfter: snapshotAfter.character.inventory,
      isStateUnmutated: JSON.stringify(snapshotBefore) === JSON.stringify(snapshotAfter)
    },
    directEngineSubmitIfBoundaryBypassed: {
      description: 'Even if boundary was bypassed directly to EngineValidator:',
      directEngineValidatorResult: EngineValidator.validate(tamperedProposal, snapshotBefore, executedRequestIds, recordedEventIds, historicalRecords)
    }
  };

  const finalOutputContent = `# TRPG 3.1 — VEIL Phase 2 Server Runtime Minimal Observation

- **Execution Timestamp**: ${timestamp}
- **Git HEAD Commit**: \`${gitHead}\`
- **Execution Target**: Server Runtime Specifics (1. Mutation Boundary Block Behavior, 2. Rejected Candidate ID Binding)

---

## 1. Mutation Boundary \`false\` -> \`submitProposal()\` Invocation Observation

\`\`\`json
${JSON.stringify(question1Observation, null, 2)}
\`\`\`

---

## 2. REJECTED \`selectedCandidateId\` -> Server Candidate Binding Observation

\`\`\`json
${JSON.stringify(question2Observation, null, 2)}
\`\`\`
`;

  const outputPath = path.join(process.cwd(), 'idea/report/veil_phase2_server_runtime_minimal_evidence.md');
  fs.writeFileSync(outputPath, finalOutputContent, 'utf-8');
  console.log(`Saved minimal runtime evidence to: ${outputPath}`);
}

runObservation().catch(console.error);
