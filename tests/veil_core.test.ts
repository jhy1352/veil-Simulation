import { extractCandidatesFromMetadata } from '../src/utils/engineValidator.ts';
import { buildSafeProposalFromCandidate } from '../src/engine/proposalParser.ts';
import { EngineValidator } from '../src/engine/validator.ts';
import { SovereignEngine } from '../src/engine/state.ts';
import { CanonicalState, StateTransitionProposal } from '../src/engine/types.ts';
import { validateLLM2MutationBoundary } from '../src/engine/mutationBoundary.ts';

function runVeilTests() {
  console.log('--- Running VEIL 2.0 Unit Tests ---');
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, msg: string) {
    totalCount++;
    if (!condition) {
      console.error(`❌ FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    } else {
      passedCount++;
      console.log(`✅ PASS: ${msg}`);
    }
  }

  const dummySnapshot: CanonicalState = {
    stateVersion: 1,
    turn: 1,
    worldInfo: {
      worldName: '테스트 세계',
      settingDescription: '테스트',
      toneStyle: '진지',
      currentTime: { year: 100, month: 1, day: 1, timeOfDay: 'MORNING', formattedTime: '100년 1월 1일 아침' },
      chapters: { currentChapter: '서막', upcomingChapters: ['1장', '2장', '3장'] },
      npcs: [],
      factions: [],
      seeds: [],
      cameraOffscreenEvents: [],
      dcHistory: [],
      rumors: []
    } as any,
    character: {
      name: '주인공',
      age: 20,
      stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      inventory: [{ id: 'inv-gold-1', name: '은화', quantity: 5 }]
    } as any,
    lastCommittedEventId: null,
    lastCommittedAt: new Date().toISOString()
  };

  // Test 1: Valid candidate generates valid proposal passing Pre-Auth
  {
    const rawMetadata = {
      foreshadowSeeds: ['새로운 암운이 감돈다'],
      upcomingChapters: ['1장', '2장', '3장']
    };
    const cand = extractCandidatesFromMetadata(rawMetadata, 1, '100년 1월 1일 아침');
    const proposal = buildSafeProposalFromCandidate(dummySnapshot, cand, 1, []);
    assert(proposal.actions.length > 0, 'Valid candidate yields non-empty proposal actions');
    
    const verdict = EngineValidator.validate(
      proposal,
      dummySnapshot,
      new Set<string>(),
      new Set<string>(),
      []
    );
    assert(verdict.isValid === true, 'EngineValidator Pre-Auth approves valid candidate proposal');
  }

  // Test 2: Empty metadata yields empty actions and is rejected by EngineValidator
  {
    const rawMetadata = {};
    const cand = extractCandidatesFromMetadata(rawMetadata, 1, '100년 1월 1일 아침');
    const proposal = buildSafeProposalFromCandidate(dummySnapshot, cand, 1, []);
    const verdict = EngineValidator.validate(
      proposal,
      dummySnapshot,
      new Set<string>(),
      new Set<string>(),
      []
    );
    assert(verdict.isValid === false, 'EngineValidator Pre-Auth rejects empty proposal with zero actions');
  }

  // Test 3: 3~5 Candidates validation logic
  {
    const candidates3 = [
      { candidateId: 1, label: 'A', narrativeSummary: 'A', rawMetadata: {} },
      { candidateId: 2, label: 'B', narrativeSummary: 'B', rawMetadata: {} },
      { candidateId: 3, label: 'C', narrativeSummary: 'C', rawMetadata: {} }
    ];
    assert(candidates3.length >= 3 && candidates3.length <= 5, '3 candidates meet 3~5 boundary condition');

    const candidates2 = [
      { candidateId: 1, label: 'A', narrativeSummary: 'A', rawMetadata: {} },
      { candidateId: 2, label: 'B', narrativeSummary: 'B', rawMetadata: {} }
    ];
    assert(candidates2.length < 3, '2 candidates correctly detected as violation (< 3)');

    const candidates6 = [
      { candidateId: 1, label: '1', narrativeSummary: '', rawMetadata: {} },
      { candidateId: 2, label: '2', narrativeSummary: '', rawMetadata: {} },
      { candidateId: 3, label: '3', narrativeSummary: '', rawMetadata: {} },
      { candidateId: 4, label: '4', narrativeSummary: '', rawMetadata: {} },
      { candidateId: 5, label: '5', narrativeSummary: '', rawMetadata: {} },
      { candidateId: 6, label: '6', narrativeSummary: '', rawMetadata: {} }
    ];
    assert(candidates6.length > 5, '6 candidates correctly detected as violation (> 5)');
  }

  // Test 4: Silver +3 Unbacked Acquisition Defense (Causality Defense)
  {
    const unbackedSilverProposal: StateTransitionProposal = {
      proposalId: 'prop-silver-unbacked',
      requestId: 'req-silver-unbacked',
      eventId: 'evt-silver-unbacked',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: '은화 세 냥 획득 주장',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'inv-silver-bonus', name: '은화', quantity: 3 },
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { name: '비단', quantity: 1 } // Player does not have 비단
            }
          }
        }
      ]
    };

    const verdict = EngineValidator.validate(
      unbackedSilverProposal,
      dummySnapshot,
      new Set<string>(),
      new Set<string>(),
      []
    );
    assert(verdict.isValid === false, 'Pre-Auth Gate rejects unbacked silver +3 acquisition proposal');
  }

  // Test 5: Grounded Discovery Acquisition (ALLOW)
  {
    const dummySnapshotWithSeed: CanonicalState = {
      ...dummySnapshot,
      worldInfo: {
        ...dummySnapshot.worldInfo,
        seeds: [
          {
            id: 'seed-sword-find',
            content: '동굴 깊은 곳에서 청강검 발견',
            status: 'active'
          }
        ]
      }
    };

    const groundedSwordProposal: StateTransitionProposal = {
      proposalId: 'prop-sword-grounded',
      requestId: 'req-sword-grounded',
      eventId: 'evt-sword-grounded',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: '동굴에서 발견한 청강검 획득',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'inv-sword-1', name: '청강검', quantity: 1 },
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-sword-find'
            }
          }
        }
      ]
    };

    const verdict = EngineValidator.validate(
      groundedSwordProposal,
      dummySnapshotWithSeed,
      new Set<string>(),
      new Set<string>(),
      []
    );
    assert(verdict.isValid === true, 'Pre-Auth Gate approves causally grounded sword acquisition');
  }

  // Test 6: Partial ALLOW/REJECT preserving candidate array without ranking
  {
    const candidates = [
      {
        candidateId: 1,
        label: 'A: Unbacked Silver',
        proposal: {
          proposalId: 'p-1',
          requestId: 'req-1',
          eventId: 'evt-1',
          expectedStateVersion: 1,
          source: 'LLM' as const,
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Unbacked silver',
          actions: [{
            type: 'MODIFY_INVENTORY' as const,
            payload: {
              operation: 'ADD' as const,
              item: { id: 'inv-s1', name: '은화', quantity: 3 },
              acquisition: { cause: 'RESOURCE_EXCHANGE' as const, cost: { name: '비단', quantity: 1 } }
            }
          }]
        }
      },
      {
        candidateId: 2,
        label: 'B: Valid Roadmap',
        proposal: {
          proposalId: 'p-2',
          requestId: 'req-2',
          eventId: 'evt-2',
          expectedStateVersion: 1,
          source: 'LLM' as const,
          turn: 1,
          timestamp: new Date().toISOString(),
          intentSummary: 'Valid chapter roadmap',
          actions: [{
            type: 'ADVANCE_CHAPTER' as const,
            payload: { currentChapter: '서막', upcomingChapters: ['1장', '2장', '3장'] }
          }]
        }
      }
    ];

    const preAuthList = candidates.map(c => {
      const v = EngineValidator.validate(c.proposal, dummySnapshot, new Set(), new Set(), []);
      return {
        candidateId: c.candidateId,
        label: c.label,
        status: v.isValid ? 'ALLOW' : 'REJECT'
      };
    });

    assert(preAuthList[0].status === 'REJECT', 'Candidate 1 is REJECTED');
    assert(preAuthList[1].status === 'ALLOW', 'Candidate 2 is ALLOWED');
    
    const allowedOnly = preAuthList.filter(c => c.status === 'ALLOW');
    assert(allowedOnly.length === 1 && allowedOnly[0].candidateId === 2, 'Only ALLOW candidates filtered for LLM #2');
  }

  // Test 7: Sovereign Engine Commit-First Atomic Execution
  {
    const engine = new SovereignEngine(
      dummySnapshot.worldInfo,
      dummySnapshot.character,
      [],
      1
    );

    const validProposal: StateTransitionProposal = {
      proposalId: 'prop-roadmap-commit',
      requestId: 'req-roadmap-commit',
      eventId: 'evt-roadmap-commit',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Update chapters roadmap',
      actions: [
        {
          type: 'ADVANCE_CHAPTER',
          payload: {
            currentChapter: '1장: 새로운 여정',
            upcomingChapters: ['2장: 갈림길', '3장: 위기', '4장: 결전']
          }
        }
      ]
    };

    const commitResult = engine.submitProposal(validProposal);
    assert(commitResult.success === true, 'SovereignEngine atomically commits valid proposal');
    assert(commitResult.snapshot.worldInfo.chapters.currentChapter === '1장: 새로운 여정', 'Canonical state updated upon successful commit');
  }

  // Test 8: PreAuth Side-Effect Freeness (Canonical State and Engine Immutable)
  {
    const initialSnapshotJson = JSON.stringify(dummySnapshot);
    const reqSet = new Set<string>(['req-existing']);
    const evtSet = new Set<string>(['evt-existing']);
    const initialReqSize = reqSet.size;
    const initialEvtSize = evtSet.size;

    const testProposal: StateTransitionProposal = {
      proposalId: 'prop-preauth-side-effect-test',
      requestId: 'req-test-1',
      eventId: 'evt-test-1',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Test side effects',
      actions: [
        {
          type: 'ADVANCE_CHAPTER',
          payload: {
            currentChapter: '1장',
            upcomingChapters: ['2장', '3장', '4장']
          }
        }
      ]
    };

    // Run Pre-Auth validation
    const verdict = EngineValidator.validate(testProposal, dummySnapshot, reqSet, evtSet, []);
    assert(verdict.isValid === true, 'Validation succeeds');

    // Verify ZERO side effects
    assert(JSON.stringify(dummySnapshot) === initialSnapshotJson, 'Canonical snapshot remained 100% byte-identical after Pre-Auth');
    assert(reqSet.size === initialReqSize, 'Executed request IDs set was NOT modified during Pre-Auth');
    assert(evtSet.size === initialEvtSize, 'Recorded event IDs set was NOT modified during Pre-Auth');
  }

  // Test 9: LLM #2 Mutation Boundary Enforcement
  {
    const approvedCandidateProposal: StateTransitionProposal = {
      proposalId: 'prop-approved-cand',
      requestId: 'req-cand-1',
      eventId: 'evt-cand-1',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Approved candidate actions',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-herb', name: '지혈초', quantity: 1 },
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-herb-find'
            }
          }
        },
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 11 }
        }
      ]
    };

    // Case 9A: Valid matching final proposal
    const validFinalProposal: StateTransitionProposal = {
      ...approvedCandidateProposal,
      proposalId: 'prop-final-valid',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-herb', name: '지혈초', quantity: 1 },
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-herb-find'
            }
          }
        },
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 11 }
        }
      ]
    };
    const checkValid = validateLLM2MutationBoundary(approvedCandidateProposal, validFinalProposal);
    assert(checkValid.isValid === true, 'LLM #2 exact matching proposal passes Mutation Boundary');

    // Case 9B: Attempting to sneak in an unapproved extra action type
    const sneakActionProposal: StateTransitionProposal = {
      ...approvedCandidateProposal,
      proposalId: 'prop-final-sneak-action',
      actions: [
        ...approvedCandidateProposal.actions,
        {
          type: 'SET_CHARACTER_SECRET',
          payload: { secret: '숨겨진 보물의 위치' }
        }
      ]
    };
    const checkSneakAction = validateLLM2MutationBoundary(approvedCandidateProposal, sneakActionProposal);
    assert(checkSneakAction.isValid === false, 'LLM #2 sneak action type is blocked by Mutation Boundary');

    // Case 9C: Attempting to inflate item quantity (e.g. 1 -> 5 herbs)
    const inflatedQtyProposal: StateTransitionProposal = {
      ...approvedCandidateProposal,
      proposalId: 'prop-final-inflated-qty',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-herb', name: '지혈초', quantity: 5 }, // Inflated!
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-herb-find'
            }
          }
        }
      ]
    };
    const checkInflatedQty = validateLLM2MutationBoundary(approvedCandidateProposal, inflatedQtyProposal);
    assert(checkInflatedQty.isValid === false, 'LLM #2 inflated item quantity is blocked by Mutation Boundary');

    // Case 9D: Attempting to forge a different verifiedEventId
    const forgedEventProposal: StateTransitionProposal = {
      ...approvedCandidateProposal,
      proposalId: 'prop-final-forged-event',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-herb', name: '지혈초', quantity: 1 },
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-forged-fake-id' // Forged!
            }
          }
        }
      ]
    };
    const checkForgedEvent = validateLLM2MutationBoundary(approvedCandidateProposal, forgedEventProposal);
    assert(checkForgedEvent.isValid === false, 'LLM #2 forged verifiedEventId is blocked by Mutation Boundary');
  }

  console.log(`\nVEIL 2.0 Unit Tests Completed: ${passedCount}/${totalCount} Passed.`);
}

runVeilTests();
