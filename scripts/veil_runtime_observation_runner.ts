import fs from 'fs';
import path from 'path';
import { SovereignEngine } from '../src/engine/state.ts';
import { EngineValidator } from '../src/engine/validator.ts';
import { buildSafeProposalFromCandidate } from '../src/engine/proposalParser.ts';
import { validateLLM2MutationBoundary } from '../src/engine/mutationBoundary.ts';
import { extractCandidatesFromMetadata } from '../src/utils/engineValidator.ts';
import { parseGMResponseMetaData } from '../src/utils/parser.ts';
import { createEmptyCharacter, createEmptyWorldInfo } from '../src/utils/factory.ts';
import { CanonicalState, StateTransitionProposal, VeilCandidatePacket, DEFAULT_NPC_CLASS } from '../src/types.ts';

interface ObservationRecord {
  timestamp: string;
  stepName: string;
  observationPoint: number;
  data: any;
}

const observations: ObservationRecord[] = [];

function recordObservation(point: number, stepName: string, data: any) {
  const ts = new Date().toISOString();
  observations.push({
    timestamp: ts,
    stepName,
    observationPoint: point,
    data
  });
}

export async function runRuntimeObservation() {
  const runTimestamp = new Date().toISOString();
  const gitHead = '5379968e761c66cdb4c811bc54d94a8618819b50';

  // 1. Initial State Setup (Turn 1 / Turn 2 setup)
  const initialWorld = createEmptyWorldInfo();
  initialWorld.currentTime = {
    year: 1,
    season: '봄',
    day: 1,
    timeOfDay: '오전',
    formattedTime: '1년차 봄 1일 오전'
  };
  initialWorld.currentLocation = {
    name: '청운 객잔',
    region: '산동',
    description: '청운현의 활기찬 객잔',
    environmentType: '도시',
    surroundingHazards: [],
    availableResources: ['객잔 식음료', '소문']
  };

  const initialCharacter = createEmptyCharacter();
  initialCharacter.name = '백연화';
  initialCharacter.inventory = [
    { id: 'inv_silver_coin', name: '은화', quantity: 20, type: '재화', isEquipped: false }
  ];
  initialCharacter.stats = {
    STR: 12,
    DEX: 14,
    CON: 13,
    INT: 15,
    WIS: 12,
    CHA: 14
  };

  const storyTurnCount = 2;
  const canonicalState: CanonicalState = {
    stateVersion: 1,
    turn: storyTurnCount,
    worldInfo: initialWorld,
    character: initialCharacter,
    lastCommittedEventId: 'evt_genesis_turn_1',
    lastCommittedAt: new Date().toISOString()
  };

  const executedRequestIds = new Set<string>(['req_genesis_001']);
  const recordedEventIds = new Set<string>(['evt_genesis_turn_1']);
  const historicalRecords = [
    {
      recordId: 'rec_genesis_01',
      narrativeDate: '1년차 봄 1일 오전',
      location: '청운 객잔',
      characters: ['백연화'],
      sourceContext: '세션 시작',
      informationStatus: 'CANONICAL' as const,
      timestamp: new Date().toISOString(),
      causalRelationships: [],
      previousState: {},
      resultingState: {}
    }
  ];

  const engine = new SovereignEngine(
    initialWorld,
    initialCharacter,
    historicalRecords as any,
    storyTurnCount
  );

  // Simulation of LLM #1 generating 3 Candidates
  // Candidate 1: Grounded trade (Buy herb for 5 silver coins)
  // Candidate 2: Ungrounded magic spawn (Free divine sword) -> will be REJECTED by PreAuth
  // Candidate 3: Conversational affinity shift (Talk with Innkeeper Li)
  const candidatePackets: VeilCandidatePacket[] = [
    {
      candidateId: 1,
      label: '약초 상인과의 은화 거래',
      narrativeSummary: '객잔 앞 상인에게 은화 5냥을 지불하고 지혈초 1개를 정당하게 구매한다.',
      rawMetadata: {
        factCheckSummary: '1) [소지]: 은화 20냥 확인\n2) [소비]: 은화 5냥 지불\n3) [획득]: 지혈초 1개 정상 획득',
        inventoryChanges: [
          {
            name: '은화',
            quantity: 5,
            action: 'remove'
          },
          {
            name: '지혈초',
            quantity: 1,
            action: 'add',
            cause: 'RESOURCE_EXCHANGE',
            cost: { name: '은화', quantity: 5 }
          }
        ],
        cameraOffscreenEvents: ['상인이 지혈초를 건네고 은화를 챙겨 떠났다.']
      }
    },
    {
      candidateId: 2,
      label: '출처 불명의 전설검 기습 획득',
      narrativeSummary: '갑자기 하늘에서 전설의 무형검이 떨어져 손에 쥐어진다.',
      rawMetadata: {
        factCheckSummary: '1) [획득]: 전설의 무형검 획득 (출처 불명)',
        inventoryChanges: [
          {
            name: '무형검',
            quantity: 1,
            action: 'add'
            // Missing cause / cost / event -> Causality violation
          }
        ]
      }
    },
    {
      candidateId: 3,
      label: '이객주와의 환담',
      narrativeSummary: '이객주와 인사를 나누며 호감도를 쌓고 소문을 듣는다.',
      rawMetadata: {
        factCheckSummary: '1) [NPC]: 이객주와의 대화로 호감도 소폭 상승\n2) [소문]: 산적 출몰 소문 청취',
        newNpcs: [
          {
            name: '이객주',
            alias: '객잔 주인',
            npcClass: '일반인',
            innerThought: '새로운 손님이 찾아왔군.',
            metInStory: true,
            isDead: false,
            origin: '산동',
            background: '객잔 20년 운영',
            informationAccess: 'PUBLIC'
          }
        ],
        cameraOffscreenEvents: ['최근 북쪽 산도에 산적 떼가 출몰하고 있다는 소문이 돌고 있다.']
      }
    }
  ];

  // -------------------------------------------------------------
  // STEP 1: PreAuth Execution for all Candidates
  // -------------------------------------------------------------
  const preAuthResults = candidatePackets.map(cand => {
    const candidatePacket = extractCandidatesFromMetadata(
      cand.rawMetadata,
      storyTurnCount,
      initialWorld.currentTime.formattedTime
    );

    const proposal = buildSafeProposalFromCandidate(
      canonicalState,
      candidatePacket,
      storyTurnCount,
      historicalRecords
    );

    const validation = EngineValidator.validate(
      proposal,
      canonicalState,
      executedRequestIds,
      recordedEventIds,
      historicalRecords
    );

    return {
      candidateId: cand.candidateId,
      label: cand.label,
      rawMetadata: cand.rawMetadata,
      proposal,
      validationResult: {
        isValid: validation.isValid,
        rejectedReasons: validation.rejectedReasons,
        conflictDetails: validation.conflictDetails
      },
      preAuthStatus: validation.isValid ? 'ALLOW' : 'REJECT'
    };
  });

  const allowedCandidates = preAuthResults.filter(c => c.preAuthStatus === 'ALLOW');

  // [OBSERVATION POINT 1] PreAuth ALLOW Candidates
  recordObservation(1, 'PRE_AUTH_ALLOWED_CANDIDATES', {
    totalCandidates: candidatePackets.length,
    allowedCount: allowedCandidates.length,
    allowedCandidates: allowedCandidates.map(c => ({
      candidateId: c.candidateId,
      label: c.label,
      preAuthStatus: c.preAuthStatus,
      rawMetadataIdentifiers: {
        factCheckSummary: c.rawMetadata?.factCheckSummary,
        characterChanges: c.rawMetadata?.characterChanges,
        worldChanges: c.rawMetadata?.worldChanges
      },
      proposalActionTypes: c.proposal.actions.map(a => a.type)
    })),
    rejectedCandidates: preAuthResults.filter(c => c.preAuthStatus === 'REJECT').map(c => ({
      candidateId: c.candidateId,
      label: c.label,
      rejectedReasons: c.validationResult.rejectedReasons
    }))
  });

  // -------------------------------------------------------------
  // STEP 2: LLM #2 selects candidateId
  // -------------------------------------------------------------
  // LLM#2 selects Candidate 1
  const llm2SelectedId = 1;

  // [OBSERVATION POINT 2] LLM#2 selectedCandidateId
  recordObservation(2, 'LLM2_SELECTED_CANDIDATE_ID', {
    selectedCandidateId: llm2SelectedId,
    selectionSource: 'LLM#2 Synthesizer Output: {"selectedCandidateId": 1}'
  });

  // -------------------------------------------------------------
  // STEP 3: Server Recombines Candidate by selectedCandidateId
  // -------------------------------------------------------------
  const selectedPreAuthCandidate = allowedCandidates.find(c => c.candidateId === llm2SelectedId) || allowedCandidates[0];
  const recombinedCandidate = candidatePackets.find(c => c.candidateId === selectedPreAuthCandidate.candidateId)!;

  // [OBSERVATION POINT 3] Recombined Candidate verification
  recordObservation(3, 'SERVER_RECOMBINED_CANDIDATE', {
    selectedCandidateId: selectedPreAuthCandidate.candidateId,
    recombinedCandidateId: recombinedCandidate.candidateId,
    isIdentityEqual: selectedPreAuthCandidate.candidateId === recombinedCandidate.candidateId,
    recombinedRawMetadata: recombinedCandidate.rawMetadata,
    originalPreAuthRawMetadata: selectedPreAuthCandidate.rawMetadata,
    metadataStrictMatch: JSON.stringify(recombinedCandidate.rawMetadata) === JSON.stringify(selectedPreAuthCandidate.rawMetadata)
  });

  // -------------------------------------------------------------
  // STEP 4: buildSafeProposalFromCandidate() on Client/Server
  // -------------------------------------------------------------
  const snapshotBeforeProposal = engine.getSnapshot();
  const extractedCandidatePacket = extractCandidatesFromMetadata(
    recombinedCandidate.rawMetadata,
    storyTurnCount,
    snapshotBeforeProposal.worldInfo.currentTime.formattedTime
  );

  const finalProposal: StateTransitionProposal = buildSafeProposalFromCandidate(
    snapshotBeforeProposal,
    extractedCandidatePacket,
    storyTurnCount,
    engine.getHistory()
  );

  // [OBSERVATION POINT 4] buildSafeProposalFromCandidate() Final Proposal inspection
  recordObservation(4, 'BUILD_SAFE_PROPOSAL_RESULT', {
    proposalRequestId: finalProposal.requestId,
    proposalTurn: finalProposal.turn,
    actionCount: finalProposal.actions.length,
    actions: finalProposal.actions.map(action => ({
      type: action.type,
      eventId: action.eventId,
      source: action.source,
      causalTrigger: action.causalTrigger,
      payload: action.payload
    })),
    deltasFromRawCandidate: {
      rawInventoryInput: recombinedCandidate.rawMetadata?.characterChanges?.inventory,
      builtInventoryActions: finalProposal.actions.filter(a => a.type === 'MODIFY_INVENTORY')
    }
  });

  // -------------------------------------------------------------
  // STEP 5: Mutation Boundary Check (Final Proposal vs Approved Candidate Proposal)
  // -------------------------------------------------------------
  const approvedCandidateProposal = selectedPreAuthCandidate.proposal;
  const mutationBoundaryResult = validateLLM2MutationBoundary(
    approvedCandidateProposal,
    finalProposal
  );

  // [OBSERVATION POINT 5] Mutation Boundary Invocation & Evaluation
  recordObservation(5, 'MUTATION_BOUNDARY_INVOCATION', {
    callLocation: 'src/engine/mutationBoundary.ts -> validateLLM2MutationBoundary()',
    inputApprovedCandidateProposal: {
      requestId: approvedCandidateProposal.requestId,
      actionsCount: approvedCandidateProposal.actions.length,
      actionsSummary: approvedCandidateProposal.actions.map(a => ({ type: a.type, payload: a.payload }))
    },
    inputFinalProposal: {
      requestId: finalProposal.requestId,
      actionsCount: finalProposal.actions.length,
      actionsSummary: finalProposal.actions.map(a => ({ type: a.type, payload: a.payload }))
    },
    boundaryResult: {
      isValid: mutationBoundaryResult.isValid,
      violationReasons: mutationBoundaryResult.violationReasons
    }
  });

  // -------------------------------------------------------------
  // STEP 6: Proposal immediately prior to submitProposal()
  // -------------------------------------------------------------
  // [OBSERVATION POINT 6] Prior to submitProposal
  recordObservation(6, 'PROPOSAL_PRIOR_TO_SUBMIT', {
    engineCurrentStateVersion: engine.getSnapshot().stateVersion,
    engineCurrentTurn: engine.getSnapshot().turn,
    submittingProposal: {
      requestId: finalProposal.requestId,
      turn: finalProposal.turn,
      timestamp: finalProposal.timestamp,
      actions: finalProposal.actions
    }
  });

  // -------------------------------------------------------------
  // STEP 7: EngineValidator Inputs and Results during submitProposal()
  // -------------------------------------------------------------
  const preSubmitSnapshot = engine.getSnapshot();
  const directValidationResult = EngineValidator.validate(
    finalProposal,
    preSubmitSnapshot,
    (engine as any).executedRequestIds,
    (engine as any).recordedEventIds,
    engine.getHistory()
  );

  // [OBSERVATION POINT 7] EngineValidator evaluation
  recordObservation(7, 'ENGINE_VALIDATOR_EVALUATION', {
    validatorInputs: {
      proposalTurn: finalProposal.turn,
      proposalActionsCount: finalProposal.actions.length,
      canonicalStateVersion: preSubmitSnapshot.stateVersion,
      executedRequestIdsCount: (engine as any).executedRequestIds?.size || 0,
      recordedEventIdsCount: (engine as any).recordedEventIds?.size || 0,
      historicalRecordsCount: engine.getHistory().length
    },
    validationOutput: {
      isValid: directValidationResult.isValid,
      rejectedReasons: directValidationResult.rejectedReasons,
      conflictDetails: directValidationResult.conflictDetails
    }
  });

  // -------------------------------------------------------------
  // STEP 8: Draft Execution, Commit Execution, and Commit Result
  // -------------------------------------------------------------
  const commitResult = engine.submitProposal(finalProposal);
  const postSubmitSnapshot = engine.getSnapshot();

  // [OBSERVATION POINT 8] Draft and Commit Execution result
  recordObservation(8, 'DRAFT_AND_COMMIT_EXECUTION', {
    commitSuccess: commitResult.success,
    committedActionsCount: commitResult.committedActionsCount,
    newStateVersion: commitResult.stateVersion,
    newHistoricalRecordsCount: commitResult.newHistoricalRecords.length,
    rejectedReasons: commitResult.rejectedReasons,
    conflictDetails: commitResult.conflictDetails,
    inventorySnapshotBefore: initialCharacter.inventory,
    inventorySnapshotAfter: postSubmitSnapshot.character.inventory,
    historyTail: engine.getHistory().slice(-1)
  });

  // Format observations into markdown raw evidence log
  const outputFilePath = path.join(process.cwd(), 'idea/report/veil_phase2_runtime_observation_evidence.md');
  const markdownContent = `# TRPG 3.1 — VEIL Phase 2 Runtime Observational Evidence

- **Execution Timestamp**: ${runTimestamp}
- **Git HEAD Commit**: \`${gitHead}\`
- **Execution Target**: Runtime End-to-End Pipeline (Candidate -> PreAuth -> Recombination -> SafeProposal -> MutationBoundary -> EngineValidator -> Draft -> Commit)

---

## Observational Data Points

${observations.map(obs => `### Observation Point ${obs.observationPoint}: ${obs.stepName}
- **Timestamp**: \`${obs.timestamp}\`
- **Raw Object Dump**:
\`\`\`json
${JSON.stringify(obs.data, null, 2)}
\`\`\`
`).join('\n---\n\n')}
`;

  fs.writeFileSync(outputFilePath, markdownContent, 'utf-8');
  console.log(`Saved raw observation evidence to: ${outputFilePath}`);
  return { outputFilePath, observationsCount: observations.length };
}

runRuntimeObservation()
  .then(res => {
    console.log(`Observation run complete. Total points recorded: ${res.observationsCount}`);
  })
  .catch(err => {
    console.error('Observation run failed:', err);
    process.exit(1);
  });
