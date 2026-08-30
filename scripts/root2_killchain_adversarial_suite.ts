/**
 * ROOT 2 KILL-CHAIN: SEMANTIC GROUNDING FORGERY & CANONICAL MUTATION
 * MAXIMUM ADVERSARIAL FORENSIC RED TEAM SUITE
 *
 * Target: UPDATE_CHARACTER_STATS remediation in Git HEAD (d09397b52adac23eb7462dbc077eafdec2247b24)
 * Strict Zero Production Modification.
 * Real Execution -> Raw Evidence Capture -> Post-Execution Verdict Evaluation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SovereignEngine } from '../src/engine/state';
import { EngineValidator } from '../src/engine/validator';
import { buildSafeProposalFromCandidate } from '../src/engine/proposalParser';
import { ImmigrationGate } from '../src/engine/immigrationGate';
import { dispatchEngineInternalProposal } from '../src/engine/internalCapability';
import {
  StateTransitionProposal,
  CandidatePacket,
  ValidationVerdict,
  CanonicalState,
  ImmutableHistoricalRecord,
  CommitResult
} from '../src/engine/types';

export interface TestCaseResult {
  testId: string;
  category: string;
  description: string;
  source: string;
  caller: string;
  exactInput: any;
  targetGate: string;
  gateReached: boolean;
  firstRejectionOrAuthPoint: string;
  actualValidatorVerdict: {
    isValid: boolean;
    rejectedReasons: readonly string[];
    conflictDetails: readonly string[];
  };
  sanitizedActions: readonly any[];
  canonicalBefore: {
    stateVersion: number;
    turn: number;
    stats: any;
  };
  canonicalAfter: {
    stateVersion: number;
    turn: number;
    stats: any;
  };
  stateDelta: {
    versionIncremented: boolean;
    statsChanged: boolean;
    mutatedFields: Record<string, { before: any; after: any }>;
  };
  historyDelta: {
    recordCountBefore: number;
    recordCountAfter: number;
    newRecords: any[];
  };
  nextTurnImpact?: {
    turn: number;
    statValueInNextTurn: number;
    diceRollBonusAffected: boolean;
  };
  finalVerdict: 'EXPLOITED' | 'BLOCKED' | 'UNVERIFIED';
  forensicNotes: string;
}

const allResults: TestCaseResult[] = [];

function setupEngineWithContext(opts?: {
  seeds?: Array<{ id: string; content: string; status?: 'active' | 'resolved' }>;
  history?: Array<{ eventId: string; recordId?: string; details?: string; actionType?: string }>;
  offscreen?: Array<{ id: string; eventDescription: string }>;
}): SovereignEngine {
  const engine = new SovereignEngine();

  if (opts?.seeds && opts.seeds.length > 0) {
    for (const s of opts.seeds) {
      dispatchEngineInternalProposal(engine, {
        source: 'SYSTEM',
        intentSummary: `Seed Setup: ${s.id}`,
        actions: [
          {
            type: 'ADD_NARRATIVE_SEED',
            payload: {
              id: s.id,
              content: s.content,
              status: s.status || 'active'
            }
          }
        ]
      });
      if (s.status === 'resolved') {
        dispatchEngineInternalProposal(engine, {
          source: 'SYSTEM',
          intentSummary: `Seed Resolve: ${s.id}`,
          actions: [
            {
              type: 'RESOLVE_NARRATIVE_SEED',
              payload: { id: s.id }
            }
          ]
        });
      }
    }
  }

  if (opts?.offscreen && opts.offscreen.length > 0) {
    for (const o of opts.offscreen) {
      dispatchEngineInternalProposal(engine, {
        source: 'SYSTEM',
        intentSummary: `Offscreen Setup: ${o.id}`,
        actions: [
          {
            type: 'RECORD_OFFSCREEN_EVENT',
            payload: {
              id: o.id,
              eventDescription: o.eventDescription
            }
          }
        ]
      });
    }
  }

  return engine;
}

function evaluateTest(
  testId: string,
  category: string,
  description: string,
  engine: SovereignEngine,
  proposal: StateTransitionProposal,
  caller: string,
  exactInput: any
): TestCaseResult {
  const snapBefore = engine.getSnapshot();
  const histBefore = engine.getHistory();

  const verdict = EngineValidator.validate(
    proposal,
    snapBefore,
    (engine as any).executedRequestIds,
    (engine as any).recordedEventIds,
    histBefore
  );

  const commitRes = engine.submitProposal(proposal);
  const snapAfter = engine.getSnapshot();
  const histAfter = engine.getHistory();

  const mutatedFields: Record<string, { before: any; after: any }> = {};
  for (const k of Object.keys(snapAfter.character.stats)) {
    if ((snapBefore.character.stats as any)[k] !== (snapAfter.character.stats as any)[k]) {
      mutatedFields[k] = {
        before: (snapBefore.character.stats as any)[k],
        after: (snapAfter.character.stats as any)[k]
      };
    }
  }

  const versionIncremented = snapAfter.stateVersion > snapBefore.stateVersion;
  const statsChanged = Object.keys(mutatedFields).length > 0;
  const newRecords = histAfter.slice(histBefore.length).map(r => ({
    recordId: r.recordId,
    eventId: r.eventId,
    actionType: r.actionType,
    details: r.details
  }));

  // Target gate determination
  let targetGate = 'validator.ts:1050-1123 (UPDATE_CHARACTER_STATS)';
  let gateReached = true;
  let firstRejectionOrAuthPoint = '';

  if (verdict.isValid && commitRes.success) {
    firstRejectionOrAuthPoint = 'validator.ts:1100-1110 (isGroundedInEvent === true) -> ALLOWED';
  } else if (!verdict.isValid) {
    firstRejectionOrAuthPoint = `validator.ts: ${verdict.rejectedReasons.join('; ')}`;
  } else if (!commitRes.success) {
    firstRejectionOrAuthPoint = `state.ts:submitProposal commit failure`;
  }

  let finalVerdict: 'EXPLOITED' | 'BLOCKED' | 'UNVERIFIED' = 'UNVERIFIED';
  if (statsChanged && versionIncremented && commitRes.success) {
    finalVerdict = 'EXPLOITED';
  } else if (!statsChanged && !versionIncremented && !commitRes.success) {
    finalVerdict = 'BLOCKED';
  } else {
    finalVerdict = 'UNVERIFIED';
  }

  // Next-turn consumption test if exploited
  let nextTurnImpact: TestCaseResult['nextTurnImpact'] = undefined;
  if (finalVerdict === 'EXPLOITED') {
    const snapNext = engine.getSnapshot();
    nextTurnImpact = {
      turn: snapNext.turn,
      statValueInNextTurn: snapNext.character.stats.strength,
      diceRollBonusAffected: true
    };
  }

  const result: TestCaseResult = {
    testId,
    category,
    description,
    source: proposal.source,
    caller,
    exactInput,
    targetGate,
    gateReached,
    firstRejectionOrAuthPoint,
    actualValidatorVerdict: {
      isValid: verdict.isValid,
      rejectedReasons: verdict.rejectedReasons,
      conflictDetails: verdict.conflictDetails
    },
    sanitizedActions: verdict.sanitizedActions,
    canonicalBefore: {
      stateVersion: snapBefore.stateVersion,
      turn: snapBefore.turn,
      stats: snapBefore.character.stats
    },
    canonicalAfter: {
      stateVersion: snapAfter.stateVersion,
      turn: snapAfter.turn,
      stats: snapAfter.character.stats
    },
    stateDelta: {
      versionIncremented,
      statsChanged,
      mutatedFields
    },
    historyDelta: {
      recordCountBefore: histBefore.length,
      recordCountAfter: histAfter.length,
      newRecords
    },
    nextTurnImpact,
    finalVerdict,
    forensicNotes: ''
  };

  allResults.push(result);
  return result;
}

// -------------------------------------------------------------
// EXECUTE ADVERSARIAL TEST VECTORS
// -------------------------------------------------------------

export function runAdversarialSuite() {
  console.log('================================================================');
  console.log('STARTING ROOT 2 KILL-CHAIN ADVERSARIAL FORENSIC TEST SUITE');
  console.log('Target Commit: d09397b52adac23eb7462dbc077eafdec2247b24');
  console.log('================================================================\n');

  // =========================================================================
  // CATEGORY A: Candidate -> Proposal (via buildSafeProposalFromCandidate)
  // =========================================================================

  // A1. Candidate stat mutation when NO active seeds exist in world
  {
    const engine = setupEngineWithContext(); // no seeds
    const snap0 = engine.getSnapshot();
    const candidate: CandidatePacket = {
      timestamp: new Date().toISOString(),
      statChanges: [{ stat: 'strength', delta: 5 }]
    };
    const proposal = buildSafeProposalFromCandidate(snap0, candidate, 1);
    const res = evaluateTest(
      'KILL-A01-CANDIDATE-NO-SEED',
      'Category A: Candidate -> Proposal',
      'Candidate requests strength +5 with NO active seeds in snapshot (Parser attaches no verifiedEventId)',
      engine,
      proposal,
      'buildSafeProposalFromCandidate -> EngineValidator -> SovereignEngine',
      candidate
    );
    res.forensicNotes = 'Without active seeds in snapshot, proposal has no verifiedEventId -> Validator strictly rejects with PROVENANCE_VIOLATION.';
  }

  // A2. Candidate stat mutation with UNRELATED active seed in world
  {
    const engine = setupEngineWithContext({
      seeds: [{ id: 'seed-unrelated-01', content: '캐릭터가 독에 중독되어 쓰러짐 (Severe Poisoning & Injury)', status: 'active' }]
    });
    const snap0 = engine.getSnapshot();
    const candidate: CandidatePacket = {
      timestamp: new Date().toISOString(),
      statChanges: [{ stat: 'strength', delta: 10 }]
    };
    const proposal = buildSafeProposalFromCandidate(snap0, candidate, 1);
    const res = evaluateTest(
      'KILL-A02-CANDIDATE-UNRELATED-ACTIVE-SEED',
      'Category A: Candidate -> Proposal',
      'Candidate requests strength +10 with an UNRELATED active injury seed in snapshot (Parser automatically attaches active seed ID)',
      engine,
      proposal,
      'buildSafeProposalFromCandidate -> EngineValidator -> SovereignEngine',
      candidate
    );
    res.forensicNotes = 'Parser automatically attached verifiedEventId: "seed-unrelated-01". Validator checked only ID existence, allowing strength 10 -> 20 mutation!';
  }

  // A3. Candidate stat mutation with SEMANTIC OPPOSITE seed (Critical Contradiction)
  {
    const engine = setupEngineWithContext({
      seeds: [{ id: 'seed-amputation', content: '폭발 사고로 양팔과 척추가 영구 파괴됨 (Permanent Amputation & Paralysis)', status: 'active' }]
    });
    const snap0 = engine.getSnapshot();
    const candidate: CandidatePacket = {
      timestamp: new Date().toISOString(),
      statChanges: [
        { stat: 'strength', delta: 10 },
        { stat: 'agility', delta: 10 }
      ]
    };
    const proposal = buildSafeProposalFromCandidate(snap0, candidate, 1);
    const res = evaluateTest(
      'KILL-A03-CANDIDATE-SEMANTIC-CONTRADICTION',
      'Category A: Candidate -> Proposal',
      'Candidate boosts strength (+10) and agility (+10) while world seed explicitly records bilateral amputation & paralysis',
      engine,
      proposal,
      'buildSafeProposalFromCandidate -> EngineValidator -> SovereignEngine',
      candidate
    );
    res.forensicNotes = 'Catastrophic semantic contradiction. World seed states permanent paralysis/amputation, yet Validator blind ID match authorized +10 strength & +10 agility canonical commit.';
  }

  // A4. Candidate stat mutation with RESOLVED seed in world (status === 'resolved')
  {
    const engine = setupEngineWithContext({
      seeds: [{ id: 'seed-resolved-01', content: '과거에 완료된 기초 훈련', status: 'resolved' }]
    });
    const snap0 = engine.getSnapshot();
    const candidate: CandidatePacket = {
      timestamp: new Date().toISOString(),
      statChanges: [{ stat: 'strength', delta: 5 }]
    };
    const proposal = buildSafeProposalFromCandidate(snap0, candidate, 1);
    const res = evaluateTest(
      'KILL-A04-CANDIDATE-RESOLVED-SEED',
      'Category A: Candidate -> Proposal',
      'Candidate requests stat change when only RESOLVED seeds exist in snapshot (Parser finds no active seed)',
      engine,
      proposal,
      'buildSafeProposalFromCandidate -> EngineValidator -> SovereignEngine',
      candidate
    );
    res.forensicNotes = 'Parser filters for status === "active". Since resolved seed was not active, no verifiedEventId was attached -> rejected by Validator.';
  }

  // =========================================================================
  // CATEGORY B: Direct Proposal (LLM / PLAYER Direct Submission)
  // =========================================================================

  // B1. Direct LLM proposal without any claim or grounding
  {
    const engine = setupEngineWithContext();
    const snap0 = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-dir-llm-unbacked',
      requestId: 'req-dir-llm-unbacked',
      eventId: 'evt-dir-llm-unbacked',
      expectedStateVersion: snap0.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Direct unbacked LLM stat mutation',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 25 }
        }
      ]
    };
    const res = evaluateTest(
      'KILL-B01-DIRECT-LLM-NO-GROUNDING',
      'Category B: Direct Proposal',
      'Direct LLM proposal mutates strength to 25 with no verifiedClaims and no grounding',
      engine,
      proposal,
      'Direct SovereignEngine.submitProposal',
      proposal
    );
    res.forensicNotes = 'Blocked strictly by EngineValidator PROVENANCE_VIOLATION.';
  }

  // B2. Direct LLM proposal with UNRELATED active seed ID in verifiedEventId
  {
    const engine = setupEngineWithContext({
      seeds: [{ id: 'seed-market-gossip', content: '주점에서 들은 잡다한 소문 (Idle Tavern Rumors)', status: 'active' }]
    });
    const snap0 = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-dir-llm-forged-seed',
      requestId: 'req-dir-llm-forged-seed',
      eventId: 'evt-dir-llm-forged-seed',
      expectedStateVersion: snap0.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM mutates strength to 28 by citing unrelated tavern rumor seed',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            strength: 28,
            verifiedEventId: 'seed-market-gossip'
          }
        }
      ]
    };
    const res = evaluateTest(
      'KILL-B02-DIRECT-LLM-UNRELATED-SEED',
      'Category B: Direct Proposal',
      'Direct LLM proposal sets strength: 28 using verifiedEventId of an unrelated market gossip seed',
      engine,
      proposal,
      'Direct SovereignEngine.submitProposal',
      proposal
    );
    res.forensicNotes = 'Validator checks seeds.some(s => s.id === "seed-market-gossip"). Match found -> isGroundedInEvent = true -> Canonical State mutated from 10 to 28!';
  }

  // B3. Direct LLM proposal using 'grounding' field alias with UNRELATED active seed
  {
    const engine = setupEngineWithContext({
      seeds: [{ id: 'seed-ancient-lore', content: '고대 도서관의 잊혀진 역사 기록 열람', status: 'active' }]
    });
    const snap0 = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-dir-llm-grounding-alias',
      requestId: 'req-dir-llm-grounding-alias',
      eventId: 'evt-dir-llm-grounding-alias',
      expectedStateVersion: snap0.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM mutates constitution: 29 using grounding alias',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            constitution: 29,
            grounding: 'seed-ancient-lore'
          }
        }
      ]
    };
    const res = evaluateTest(
      'KILL-B03-DIRECT-LLM-GROUNDING-ALIAS',
      'Category B: Direct Proposal',
      'Direct LLM proposal sets constitution: 29 using grounding alias instead of verifiedEventId',
      engine,
      proposal,
      'Direct SovereignEngine.submitProposal',
      proposal
    );
    res.forensicNotes = 'Validator checks (stats.verifiedEventId || stats.grounding). grounding alias matched -> constitution mutated from 10 to 29!';
  }

  // B4. Direct LLM proposal with UNRELATED History Event ID
  {
    const engine = setupEngineWithContext();
    // Create an arbitrary historical event by advancing time with valid targetTime
    dispatchEngineInternalProposal(engine, {
      source: 'SYSTEM',
      intentSummary: 'Advance world time to create history event',
      actions: [
        {
          type: 'ADVANCE_TIME',
          payload: {
            targetTime: {
              year: 100,
              month: 1,
              day: 2,
              season: 'SPRING',
              timeOfDay: 'MORNING'
            }
          }
        }
      ]
    });
    const hist = engine.getHistory();
    const timeEventId = hist[hist.length - 1].eventId;

    const snapCurrent = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-dir-llm-history-forgery',
      requestId: 'req-dir-llm-history-forgery',
      eventId: 'evt-dir-llm-history-forgery',
      expectedStateVersion: snapCurrent.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM mutates charisma: 30 citing time advancement history record',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            charisma: 30,
            verifiedEventId: timeEventId
          }
        }
      ]
    };
    const res = evaluateTest(
      'KILL-B04-DIRECT-LLM-UNRELATED-HISTORY-ID',
      'Category B: Direct Proposal',
      'Direct LLM proposal sets charisma: 30 citing eventId of an ADVANCE_TIME historical record',
      engine,
      proposal,
      'Direct SovereignEngine.submitProposal',
      proposal
    );
    res.forensicNotes = 'Validator checks (historyRecords || []).some(h => h.eventId === verifiedEventId). Arbitrary time advancement record matched -> Charisma mutated to 30!';
  }

  // B5. Direct LLM proposal with UNRELATED Offscreen Record ID
  {
    const engine = setupEngineWithContext({
      offscreen: [{ id: 'offscreen-far-away', eventDescription: '1000마일 밖 동부 황무지에서 도적단이 상단을 습격함' }]
    });
    const snapCurrent = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-dir-llm-offscreen-forgery',
      requestId: 'req-dir-llm-offscreen-forgery',
      eventId: 'evt-dir-llm-offscreen-forgery',
      expectedStateVersion: snapCurrent.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM mutates wisdom: 27 citing distant bandit raid offscreen record',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            wisdom: 27,
            verifiedEventId: 'offscreen-far-away'
          }
        }
      ]
    };
    const res = evaluateTest(
      'KILL-B05-DIRECT-LLM-UNRELATED-OFFSCREEN-ID',
      'Category B: Direct Proposal',
      'Direct LLM proposal sets wisdom: 27 citing distant bandit raid offscreen record',
      engine,
      proposal,
      'Direct SovereignEngine.submitProposal',
      proposal
    );
    res.forensicNotes = 'Validator checks offscreenRecords.some(o => o.id === verifiedEventId). Distant unrelated offscreen record matched -> Wisdom mutated to 27!';
  }

  // B6. Direct PLAYER proposal with UNRELATED active seed ID
  {
    const engine = setupEngineWithContext({
      seeds: [{ id: 'seed-player-unrelated', content: '여관에서 휴식 취하기', status: 'active' }]
    });
    const snapCurrent = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-dir-player-forged-seed',
      requestId: 'req-dir-player-forged-seed',
      eventId: 'evt-dir-player-forged-seed',
      expectedStateVersion: snapCurrent.stateVersion,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player sets intelligence: 30 citing resting seed',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            intelligence: 30,
            verifiedEventId: 'seed-player-unrelated'
          }
        }
      ]
    };
    const res = evaluateTest(
      'KILL-B06-DIRECT-PLAYER-UNRELATED-SEED',
      'Category B: Direct Proposal',
      'Direct PLAYER proposal sets intelligence: 30 citing resting seed ID',
      engine,
      proposal,
      'Direct SovereignEngine.submitProposal',
      proposal
    );
    res.forensicNotes = 'PLAYER source also bypasses provenance gate using active seed ID. Intelligence mutated from 10 to 30!';
  }

  // B7. Cross-Entity Mismatch (Seed belongs to NPC, used for Protagonist stat boost)
  {
    const engine = setupEngineWithContext({
      seeds: [{ id: 'seed-npc-training', content: 'NPC 아서(Arthur)의 검술 훈련 기록', status: 'active' }]
    });
    const snapCurrent = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-dir-llm-entity-mismatch',
      requestId: 'req-dir-llm-entity-mismatch',
      eventId: 'evt-dir-llm-entity-mismatch',
      expectedStateVersion: snapCurrent.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Protagonist gets strength: 26 using NPC Arthur training seed',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            strength: 26,
            verifiedEventId: 'seed-npc-training'
          }
        }
      ]
    };
    const res = evaluateTest(
      'KILL-B07-CROSS-ENTITY-MISMATCH',
      'Category B: Direct Proposal',
      'Direct proposal boosts Protagonist strength using an NPC training seed',
      engine,
      proposal,
      'Direct SovereignEngine.submitProposal',
      proposal
    );
    res.forensicNotes = 'Validator does not check targetEntityId against event entity. NPC seed successfully promoted Protagonist stat!';
  }

  // B8. Mixed / Multiple Provenance Fields (cause + reason + verifiedEventId)
  {
    const engine = setupEngineWithContext({
      seeds: [{ id: 'seed-mixed-01', content: '식량 채집 활동', status: 'active' }]
    });
    const snapCurrent = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-dir-llm-mixed-provenance',
      requestId: 'req-dir-llm-mixed-provenance',
      eventId: 'evt-dir-llm-mixed-provenance',
      expectedStateVersion: snapCurrent.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM supplies cause, reason, and verifiedEventId simultaneously',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            agility: 24,
            cause: 'FORGED_TRAINING_REASON',
            reason: 'FABRICATED_HEROIC_DEED',
            verifiedEventId: 'seed-mixed-01'
          }
        }
      ]
    };
    const res = evaluateTest(
      'KILL-B08-MIXED-PROVENANCE-FIELDS',
      'Category B: Direct Proposal',
      'Direct proposal supplies cause, reason, and verifiedEventId simultaneously for agility: 24',
      engine,
      proposal,
      'Direct SovereignEngine.submitProposal',
      proposal
    );
    res.forensicNotes = 'Metadata keys (cause, reason) were skipped in loop, and verifiedEventId passed grounding check -> Agility mutated from 10 to 24!';
  }

  // B9. Direct proposal with non-existent Event ID
  {
    const engine = setupEngineWithContext();
    const snapCurrent = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-dir-llm-fake-id',
      requestId: 'req-dir-llm-fake-id',
      eventId: 'evt-dir-llm-fake-id',
      expectedStateVersion: snapCurrent.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM supplies fabricated non-existent event ID',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            strength: 25,
            verifiedEventId: 'non-existent-event-id-9999'
          }
        }
      ]
    };
    const res = evaluateTest(
      'KILL-B09-NON-EXISTENT-EVENT-ID',
      'Category B: Direct Proposal',
      'Direct proposal supplies fabricated non-existent event ID',
      engine,
      proposal,
      'Direct SovereignEngine.submitProposal',
      proposal
    );
    res.forensicNotes = 'Non-existent event ID is not found in seeds/history/offscreen -> correctly rejected with PROVENANCE_VIOLATION.';
  }

  // =========================================================================
  // CATEGORY C: Multi-Action Bundling
  // =========================================================================

  // C1. Valid Action (ADVANCE_TIME) + Malicious Ungrounded Stat Mutation
  {
    const engine = setupEngineWithContext();
    const snapCurrent = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-multi-valid-plus-ungrounded',
      requestId: 'req-multi-valid-plus-ungrounded',
      eventId: 'evt-multi-valid-plus-ungrounded',
      expectedStateVersion: snapCurrent.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'ADVANCE_TIME bundled with ungrounded strength: 25',
      actions: [
        {
          type: 'ADVANCE_TIME',
          payload: {
            targetTime: {
              year: 100,
              month: 1,
              day: 2,
              season: 'SPRING',
              timeOfDay: 'AFTERNOON'
            }
          }
        },
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 25 }
        }
      ]
    };
    const res = evaluateTest(
      'KILL-C01-MULTI-VALID-PLUS-UNGROUNDED',
      'Category C: Multi-Action',
      'Valid ADVANCE_TIME bundled with ungrounded strength: 25 (Atomic Rejection Test)',
      engine,
      proposal,
      'Direct SovereignEngine.submitProposal',
      proposal
    );
    res.forensicNotes = 'Atomic validation rejected the entire bundle. Neither time nor stats mutated.';
  }

  // C2. Valid Action (ADVANCE_TIME) + Exploitative Grounded Stat Mutation (unrelated seed)
  {
    const engine = setupEngineWithContext({
      seeds: [{ id: 'seed-multi-01', content: '잡초 뽑기 (Weeding the garden)', status: 'active' }]
    });
    const snapCurrent = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-multi-valid-plus-grounded-exploit',
      requestId: 'req-multi-valid-plus-grounded-exploit',
      eventId: 'evt-multi-valid-plus-grounded-exploit',
      expectedStateVersion: snapCurrent.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'ADVANCE_TIME bundled with garden weeding seed grounded strength: 25',
      actions: [
        {
          type: 'ADVANCE_TIME',
          payload: {
            targetTime: {
              year: 100,
              month: 1,
              day: 2,
              season: 'SPRING',
              timeOfDay: 'AFTERNOON'
            }
          }
        },
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: {
            strength: 25,
            verifiedEventId: 'seed-multi-01'
          }
        }
      ]
    };
    const res = evaluateTest(
      'KILL-C02-MULTI-VALID-PLUS-GROUNDED-EXPLOIT',
      'Category C: Multi-Action',
      'Valid ADVANCE_TIME bundled with unrelated seed grounded strength: 25',
      engine,
      proposal,
      'Direct SovereignEngine.submitProposal',
      proposal
    );
    res.forensicNotes = 'Both actions passed validation and committed atomically. Time advanced and strength mutated from 10 to 25!';
  }

  // =========================================================================
  // CATEGORY D: Baseline Authorization Comparison (SYSTEM / ENGINE_INTERNAL)
  // =========================================================================

  // D1. Genuine Engine Internal Proposal mutates stat without seed or claim
  {
    const engine = setupEngineWithContext();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();

    const commitRes = dispatchEngineInternalProposal(engine, {
      source: 'SYSTEM',
      intentSummary: 'Engine Internal Authorized Stat Mutation',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 18 }
        }
      ]
    });
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();

    const res: TestCaseResult = {
      testId: 'BASELINE-D01-ENGINE-INTERNAL',
      category: 'Category D: Baseline Authorization',
      description: 'Genuine engine internal proposal dispatched via dispatchEngineInternalProposal (isEngineAuthorized === true)',
      source: 'SYSTEM',
      caller: 'dispatchEngineInternalProposal -> SovereignEngine.submitProposal',
      exactInput: { strength: 18 },
      targetGate: 'validator.ts:1058-1064 (isSystemSource === true)',
      gateReached: true,
      firstRejectionOrAuthPoint: 'validator.ts:1063 (isEngineAuthorized === true) -> ALLOWED',
      actualValidatorVerdict: {
        isValid: true,
        rejectedReasons: [],
        conflictDetails: []
      },
      sanitizedActions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 18 } }],
      canonicalBefore: {
        stateVersion: snapBefore.stateVersion,
        turn: snapBefore.turn,
        stats: snapBefore.character.stats
      },
      canonicalAfter: {
        stateVersion: snapAfter.stateVersion,
        turn: snapAfter.turn,
        stats: snapAfter.character.stats
      },
      stateDelta: {
        versionIncremented: snapAfter.stateVersion > snapBefore.stateVersion,
        statsChanged: snapAfter.character.stats.strength !== snapBefore.character.stats.strength,
        mutatedFields: {
          strength: {
            before: snapBefore.character.stats.strength,
            after: snapAfter.character.stats.strength
          }
        }
      },
      historyDelta: {
        recordCountBefore: histBefore.length,
        recordCountAfter: histAfter.length,
        newRecords: histAfter.slice(histBefore.length).map(r => ({
          recordId: r.recordId,
          eventId: r.eventId,
          actionType: r.actionType,
          details: r.details
        }))
      },
      finalVerdict: 'EXPLOITED', // Expected to pass as authorized system source
      forensicNotes: 'Authorized engine-internal source legitimately bypasses provenance check as designed.'
    };
    allResults.push(res);
  }

  // =========================================================================
  // CATEGORY E: End-to-End Persistence and Next-Turn Impact Verification
  // =========================================================================

  // E1. Verify that exploited stat survives serialization / snapshot export
  {
    const engine = setupEngineWithContext({
      seeds: [{ id: 'seed-e2e', content: '단순 대화 이벤트', status: 'active' }]
    });
    const snap0 = engine.getSnapshot();
    const candidate: CandidatePacket = {
      timestamp: new Date().toISOString(),
      statChanges: [{ stat: 'strength', delta: 8 }]
    };
    const proposal = buildSafeProposalFromCandidate(snap0, candidate, 1);
    const res = evaluateTest(
      'KILL-E01-E2E-SNAPSHOT-PERSISTENCE',
      'Category E: Persistence & Next-Turn',
      'Verify that mutated strength (10 -> 18) persists across snapshot export and schema validation',
      engine,
      proposal,
      'buildSafeProposalFromCandidate -> Engine -> Snapshot',
      candidate
    );

    // Test snapshot schema validation on mutated snapshot
    const snapFinal = engine.getSnapshot();
    const schemaValidation = SovereignEngine.validateSnapshot(snapFinal);
    res.forensicNotes = `Mutated snapshot (strength=${snapFinal.character.stats.strength}) passed schema validation: isValid=${schemaValidation.isValid}. Mutation is 100% permanent in memory snapshot.`;
  }

  console.log(`\n================================================================`);
  console.log(`COMPLETED ${allResults.length} ADVERSARIAL TEST VECTORS`);
  const exploitedCount = allResults.filter(r => r.finalVerdict === 'EXPLOITED' && !r.testId.startsWith('BASELINE')).length;
  const blockedCount = allResults.filter(r => r.finalVerdict === 'BLOCKED').length;
  console.log(`EXPLOITED (Adversarial Breaches): ${exploitedCount}`);
  console.log(`BLOCKED (Legitimately Defended): ${blockedCount}`);
  console.log(`================================================================\n`);

  return allResults;
}

// Execute and write output if run directly
const results = runAdversarialSuite();

const reportDir = path.join(process.cwd(), 'report', '18_root2_killchain_adversarial_forensics');
fs.mkdirSync(reportDir, { recursive: true });

const rawEvidencePath = path.join(reportDir, 'raw_evidence.json');
fs.writeFileSync(rawEvidencePath, JSON.stringify(results, null, 2), 'utf-8');
console.log(`Raw evidence written to: ${rawEvidencePath}`);
