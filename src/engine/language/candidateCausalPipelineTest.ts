/**
 * @file src/engine/language/candidateCausalPipelineTest.ts
 * @description Test suite for the mandatory Candidate -> Causal Language -> Proposal pipeline.
 */

import { compileCandidateToProposal } from './runtimeSemanticCandidate';
import { createEngineSemanticBridgeContext } from './runtimeSemanticCandidate';
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

  console.log('=== All Candidate Causal Pipeline Tests PASSED ===');
}

runCandidateCausalPipelineTests();
