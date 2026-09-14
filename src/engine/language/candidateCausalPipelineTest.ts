/**
 * @file src/engine/language/candidateCausalPipelineTest.ts
 * @description Test suite for the mandatory Candidate -> Causal Language -> Proposal pipeline.
 */

import { compileCandidateToProposal } from './runtimeSemanticCandidate';
import { createEngineSemanticBridgeContext } from './runtimeSemanticCandidate';
import { checkMeaningTreeProjectionConsistency, projectMeaningTreeToRuntimeActions } from './runtimeProjection';
import { CanonicalState } from '../types';
import { VeilCandidate } from './candidateRecoveryGate';
import { SemanticEvent } from './types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION_FAILED] ${message}`);
  }
}

function mockCanonicalState(): CanonicalState {
  return {
    stateVersion: 10,
    turn: 3,
    worldInfo: {
      worldName: '테스트 세계',
      currentTime: { year: 1, month: 1, day: 1, timeOfDay: '아침', formattedTime: '1년차 봄 1일' },
      currentLocation: '시작 마을',
      currentChapter: '1장',
      upcomingChapters: ['2장', '3장'],
      seeds: [],
      npcs: [],
      factions: [],
      historySummary: [],
      offscreenEvents: [],
      rumors: [],
    } as any,
    character: {
      name: '주인공',
      alias: '소협',
      stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      inventory: [
        { id: 'item-herb-001', name: '약초', quantity: 3 }
      ],
      relationships: {},
      secrets: [],
      physicalDefects: [],
      psychologicalState: '침착',
    } as any,
    lastCommittedEventId: 'evt-001',
    lastCommittedAt: new Date().toISOString(),
  };
}

export function runCandidateCausalPipelineTests() {
  console.log('=== Running Candidate Causal Pipeline Test Suite ===');
  const canonicalState = mockCanonicalState();
  const bridgeContext = createEngineSemanticBridgeContext(canonicalState, []);

  // Scenario 1: Candidate with valid semanticEvents -> Successfully COMPILED
  {
    const candidate: VeilCandidate = {
      candidateId: 1,
      label: '약초 채집',
      narrativeSummary: '약초를 채집한다.',
      rawMetadata: {},
    };

    const validSemanticEvents: SemanticEvent[] = [
      {
        eventId: 'ev_herb_1',
        action: 'PICKUP',
        scope: 'CANONICAL',
        polarity: 'ASSERTED',
        epistemicStatus: 'OBSERVED',
        modality: 'NONE',
        provenance: 'evt-001',
        roles: [
          { role: 'SUBJECT', entityName: '주인공' },
          { role: 'OBJECT', entityName: '약초' }
        ]
      }
    ];

    const result = compileCandidateToProposal(
      candidate,
      validSemanticEvents,
      canonicalState,
      3,
      [],
      'req-001',
      bridgeContext
    );

    if (result.status !== 'COMPILED') {
      console.log('Scenario 1 result:', result);
    }

    assert(result.status === 'COMPILED', 'Scenario 1: Candidate with valid semanticEvents must be COMPILED');
    assert(Boolean(result.proposal), 'Scenario 1: Proposal must be generated');
    assert(Boolean(result.meaningTree), 'Scenario 1: MeaningTree must be generated');
    assert(result.candidate.candidateId === 1, 'Scenario 1: Candidate object must be preserved');
    assert(result.proposal?.actions.length === 1, 'Scenario 1: Proposal must contain mapped action');
    assert(result.proposal?.actions[0].type === 'MODIFY_INVENTORY', 'Scenario 1: Action type must be MODIFY_INVENTORY');
    assert(result.proposal?.meaningTree === result.meaningTree, 'Scenario 1: proposal.meaningTree must strictly match result.meaningTree');
    const consistency1 = checkMeaningTreeProjectionConsistency(result.proposal?.meaningTree, result.proposal?.actions || []);
    assert(consistency1.isConsistent, 'Scenario 1: proposal.meaningTree must project consistently to actions');
    console.log('[PASS] Scenario 1: Valid candidate -> Causal Language -> Proposal successful');
  }

  // Scenario 2: Candidate without semanticEvents -> TRANSLATION_MISSING (No fallback)
  {
    const candidate: VeilCandidate = {
      candidateId: 2,
      label: '의미론 없는 후보',
      narrativeSummary: 'semanticEvents 없음',
      rawMetadata: {
        inventoryChanges: [{ name: '가상검', quantity: 1, action: 'add' }]
      },
    };

    const result = compileCandidateToProposal(
      candidate,
      undefined,
      canonicalState,
      3,
      [],
      'req-002',
      bridgeContext
    );

    assert(result.status === 'TRANSLATION_MISSING', 'Scenario 2: Candidate without semanticEvents must return TRANSLATION_MISSING');
    assert(result.proposal === undefined, 'Scenario 2: Proposal MUST NOT be generated without Causal Language path');
    assert(result.candidate.candidateId === 2, 'Scenario 2: Candidate object must be preserved');
    console.log('[PASS] Scenario 2: Candidate without semanticEvents -> TRANSLATION_MISSING (No fallback)');
  }

  // Scenario 3: Candidate with invalid shape semanticEvents -> SHAPE_INVALID (Candidate preserved)
  {
    const candidate: VeilCandidate = {
      candidateId: 3,
      label: '손상된 의미론 후보',
      narrativeSummary: '형식 오류가 포함됨',
      rawMetadata: {},
    };

    const invalidEvents: any[] = [
      {
        eventId: '', // Invalid empty eventId
        type: 'ITEM_TRANSFER',
      }
    ];

    const result = compileCandidateToProposal(
      candidate,
      invalidEvents,
      canonicalState,
      3,
      [],
      'req-003',
      bridgeContext
    );

    assert(result.status === 'SHAPE_INVALID', 'Scenario 3: Candidate with invalid shape events must return SHAPE_INVALID');
    assert(result.proposal === undefined, 'Scenario 3: Proposal MUST NOT be generated for invalid shape');
    assert(result.candidate.candidateId === 3, 'Scenario 3: Candidate object MUST NOT be deleted');
    assert(result.errors.length > 0, 'Scenario 3: Validation errors must be recorded');
    console.log('[PASS] Scenario 3: Candidate with invalid shape -> SHAPE_INVALID (Candidate preserved)');
  }

  // Scenario 4: Candidate with QUERY semanticEvent -> COMPILED, 0 actions, Candidate preserved
  {
    const candidate: VeilCandidate = {
      candidateId: 4,
      label: '마을 주민에게 질문',
      narrativeSummary: '마을 주민에게 길을 묻는다.',
      rawMetadata: {},
    };

    const queryEvents: SemanticEvent[] = [
      {
        eventId: 'ev_query_1',
        action: 'QUERY',
        scope: 'CANONICAL',
        polarity: 'ASSERTED',
        epistemicStatus: 'OBSERVED',
        modality: 'NONE',
        provenance: 'evt-001',
        roles: [
          { role: 'SUBJECT', entityName: '주인공' },
          { role: 'TARGET', entityName: '주민' }
        ]
      }
    ];

    const result = compileCandidateToProposal(
      candidate,
      queryEvents,
      canonicalState,
      3,
      [],
      'req-004',
      bridgeContext
    );

    assert(result.status === 'COMPILED', 'Scenario 4: Candidate with QUERY must be COMPILED');
    assert(Boolean(result.proposal), 'Scenario 4: Proposal must be generated');
    assert(Boolean(result.meaningTree), 'Scenario 4: MeaningTree must be generated');
    assert(result.proposal?.actions.length === 0, 'Scenario 4: QUERY must produce 0 runtime actions (non-mutating)');
    assert(result.candidate.candidateId === 4, 'Scenario 4: Candidate object must be preserved');
    assert(result.proposal?.meaningTree === result.meaningTree, 'Scenario 4: proposal.meaningTree must strictly match result.meaningTree without loss');
    const queryChild = result.proposal?.meaningTree?.children?.find(c => c.value === 'QUERY' || (c as any).fields?.action === 'QUERY');
    assert(Boolean(queryChild), 'Scenario 4: proposal.meaningTree must preserve QUERY action node');
    assert(
      Boolean(
        queryChild?.children?.some(
          c => c.atom === 'ROLE' && c.value === 'TARGET' && c.fields?.entityName === '주민'
        )
      ),
      'Scenario 4: proposal.meaningTree must preserve TARGET role in MeaningTree'
    );
    const consistency4 = checkMeaningTreeProjectionConsistency(result.proposal?.meaningTree, result.proposal?.actions || []);
    assert(consistency4.isConsistent, 'Scenario 4: proposal.meaningTree must project consistently to actions');
    console.log('[PASS] Scenario 4: Candidate with QUERY -> COMPILED, actions: [], Candidate preserved, proposal.meaningTree preserved');
  }

  // Scenario 5: Candidate with HEARSAY semanticEvent -> COMPILED, 0 actions, Candidate preserved
  {
    const candidate: VeilCandidate = {
      candidateId: 5,
      label: '소문 듣기',
      narrativeSummary: '상인이 보물을 숨겼다는 소문을 듣는다.',
      rawMetadata: {},
    };

    const hearsayEvents: SemanticEvent[] = [
      {
        eventId: 'ev_hearsay_1',
        action: 'GIFT',
        scope: 'CANONICAL',
        polarity: 'ASSERTED',
        epistemicStatus: 'HEARSAY',
        modality: 'NONE',
        provenance: 'evt-001',
        roles: [
          { role: 'SUBJECT', entityName: '상인' },
          { role: 'RECIPIENT', entityName: '주인공' },
          { role: 'OBJECT', entityName: '보물' }
        ]
      }
    ];

    const result = compileCandidateToProposal(
      candidate,
      hearsayEvents,
      canonicalState,
      3,
      [],
      'req-005',
      bridgeContext
    );

    assert(result.status === 'COMPILED', 'Scenario 5: Candidate with HEARSAY must be COMPILED');
    assert(Boolean(result.proposal), 'Scenario 5: Proposal must be generated');
    assert(Boolean(result.meaningTree), 'Scenario 5: MeaningTree must be generated');
    assert(result.proposal?.actions.length === 0, 'Scenario 5: HEARSAY must produce 0 runtime actions (non-canonical)');
    assert(result.candidate.candidateId === 5, 'Scenario 5: Candidate object must be preserved');
    assert(result.proposal?.meaningTree === result.meaningTree, 'Scenario 5: proposal.meaningTree must strictly match result.meaningTree without loss');
    assert(Boolean(result.proposal?.meaningTree?.children?.some(c => (c as any).fields?.epistemicStatus === 'HEARSAY')), 'Scenario 5: proposal.meaningTree must preserve HEARSAY epistemicStatus');
    const consistency5 = checkMeaningTreeProjectionConsistency(result.proposal?.meaningTree, result.proposal?.actions || []);
    assert(consistency5.isConsistent, 'Scenario 5: proposal.meaningTree must project consistently to actions');
    console.log('[PASS] Scenario 5: Candidate with HEARSAY -> COMPILED, actions: [], Candidate preserved, proposal.meaningTree preserved');
  }

  // Scenario 6: Candidate with compound [PICKUP, QUERY] -> COMPILED, 1 action, both preserved in MeaningTree
  {
    const candidate: VeilCandidate = {
      candidateId: 6,
      label: '약초 채집 후 주민에게 문의',
      narrativeSummary: '약초를 채집하고 주민에게 쓰임새를 묻는다.',
      rawMetadata: {},
    };

    const compoundEvents: SemanticEvent[] = [
      {
        eventId: 'ev_herb_pickup',
        action: 'PICKUP',
        scope: 'CANONICAL',
        polarity: 'ASSERTED',
        epistemicStatus: 'OBSERVED',
        modality: 'NONE',
        provenance: 'evt-001',
        roles: [
          { role: 'SUBJECT', entityName: '주인공' },
          { role: 'OBJECT', entityName: '약초' }
        ]
      },
      {
        eventId: 'ev_herb_query',
        action: 'QUERY',
        scope: 'CANONICAL',
        polarity: 'ASSERTED',
        epistemicStatus: 'OBSERVED',
        modality: 'NONE',
        provenance: 'evt-001',
        roles: [
          { role: 'SUBJECT', entityName: '주인공' },
          { role: 'TARGET', entityName: '주민' }
        ]
      }
    ];

    const result = compileCandidateToProposal(
      candidate,
      compoundEvents,
      canonicalState,
      3,
      [],
      'req-006',
      bridgeContext
    );

    assert(result.status === 'COMPILED', 'Scenario 6: Compound [PICKUP, QUERY] candidate must be COMPILED');
    assert(Boolean(result.proposal), 'Scenario 6: Proposal must be generated');
    assert(result.proposal?.actions.length === 1, 'Scenario 6: Only executable PICKUP projects to runtime action');
    assert(result.proposal?.actions[0].type === 'MODIFY_INVENTORY', 'Scenario 6: Action must be MODIFY_INVENTORY');
    assert(result.candidate.candidateId === 6, 'Scenario 6: Candidate object must be preserved');
    assert(result.proposal?.meaningTree === result.meaningTree, 'Scenario 6: proposal.meaningTree must strictly match result.meaningTree without loss');
    assert(result.proposal?.meaningTree?.children?.length === 2, 'Scenario 6: proposal.meaningTree must preserve both PICKUP and QUERY atoms');
    const consistency6 = checkMeaningTreeProjectionConsistency(result.proposal?.meaningTree, result.proposal?.actions || []);
    assert(consistency6.isConsistent, 'Scenario 6: proposal.meaningTree must project consistently to actions');
    console.log('[PASS] Scenario 6: Compound [PICKUP, QUERY] -> COMPILED, 1 action, Candidate preserved, proposal.meaningTree preserved');
  }

  // Scenario 7: Truly invalid/unmapped action -> Fail Closed, Candidate preserved
  {
    const candidate: VeilCandidate = {
      candidateId: 7,
      label: '알 수 없는 조작',
      narrativeSummary: '미등록 액션 실행 시도',
      rawMetadata: {},
    };

    const invalidActionEvents: SemanticEvent[] = [
      {
        eventId: 'ev_unmapped_1',
        action: 'UNSUPPORTED_FRONTEND_ACTION' as any,
        scope: 'CANONICAL',
        polarity: 'ASSERTED',
        epistemicStatus: 'OBSERVED',
        modality: 'NONE',
        provenance: 'evt-001',
        roles: [
          { role: 'SUBJECT', entityName: '주인공' }
        ]
      }
    ];

    const result = compileCandidateToProposal(
      candidate,
      invalidActionEvents,
      canonicalState,
      3,
      [],
      'req-007',
      bridgeContext
    );

    assert(result.status === 'INVALID' || result.status === 'UNSUPPORTED', 'Scenario 7: Unmapped action must return INVALID or UNSUPPORTED');
    assert(result.proposal === undefined, 'Scenario 7: Proposal MUST NOT be generated for unmapped action');
    assert(result.candidate.candidateId === 7, 'Scenario 7: Candidate object must be preserved');
    assert(result.errors.length > 0, 'Scenario 7: Errors must be recorded');
    console.log('[PASS] Scenario 7: Unmapped action -> INVALID / UNSUPPORTED, Fail-Closed, Candidate preserved');
  }

  console.log('=== All Candidate Causal Pipeline Tests PASSED ===');
}

runCandidateCausalPipelineTests();
