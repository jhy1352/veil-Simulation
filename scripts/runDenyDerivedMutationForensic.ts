import fs from 'fs';
import path from 'path';
import { SovereignEngine, computeCanonicalStateHash } from '../src/engine/state.ts';
import { EngineValidator } from '../src/engine/validator.ts';
import { extractCandidatesFromMetadata } from '../src/utils/engineValidator.ts';
import { buildSafeProposalFromCandidate } from '../src/engine/proposalParser.ts';
import { runCandidateRecoveryGate, parseCandidatesBlock } from '../src/engine/language/candidateRecoveryGate.ts';
import { getCandidateSemanticEvents } from '../src/engine/language/semanticCandidateContract.ts';
import { integrateSemanticEventsIntoProposal, createEngineSemanticBridgeContext } from '../src/engine/language/runtimeSemanticCandidate.ts';
import { CanonicalState, StateTransitionProposal, ImmutableHistoricalRecord } from '../src/engine/types.ts';

const REPORT_DIR = path.join(process.cwd(), 'report', '68_deny_derived_mutation_fix_design');
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

async function runForensicAudit() {
  console.log('================================================================');
  console.log('DENY-DERIVED MUTATION REAL RUNTIME FORENSIC AUDIT');
  console.log('================================================================\n');

  // Initial Character and World State
  const initialWorld = {
    currentTime: { formattedTime: '1년차 봄 1일 10:00', season: 'SPRING', year: 1, day: 1, hour: 10, minute: 0 },
    currentLocation: '마을 광장',
    npcs: [],
    seeds: [],
    chapter: '서막: 모험의 시작',
    customMetadata: {}
  };
  const initialCharacter = {
    name: '알렉스',
    inventory: [],
    stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, hp: 100, maxHp: 100, mp: 50, maxMp: 50, atk: 10, def: 5 },
    gold: 50,
    secrets: []
  };

  // --------------------------------------------------------------------------
  // TEST 1: PURE DENY SCENARIO (Single impossible action)
  // Input: "플레이어는 가방에 전혀 가지고 있지 않은 고대 황금 나침반을 꺼내어 바닥에 내려놓았다."
  // --------------------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('TEST 1: PURE DENY SCENARIO');
  console.log('Prompt: "플레이어는 가방에 전혀 가지고 있지 않은 고대 황금 나침반을 꺼내어 바닥에 내려놓았다."');
  console.log('----------------------------------------------------------------');

  const engine1 = new SovereignEngine(initialWorld as any, initialCharacter as any);
  const stateBefore1 = engine1.getSnapshot();
  const stateHashBefore1 = computeCanonicalStateHash(stateBefore1);
  const versionBefore1 = stateBefore1.stateVersion;
  const historyBefore1 = engine1.getHistory();

  const denyPrompt1 = "플레이어는 가방에 전혀 가지고 있지 않은 고대 황금 나침반을 꺼내어 바닥에 내려놓았다.";
  const requestBody1 = {
    userPrompt: denyPrompt1,
    selectedModel: 'gemini-3.5-flash-lite',
    storyTurnCount: 1,
    messages: [{ role: 'user', content: denyPrompt1 }],
    worldInfo: stateBefore1.worldInfo,
    character: stateBefore1.character,
    engineState: {
      stateVersion: stateBefore1.stateVersion,
      lastCommittedEventId: stateBefore1.lastCommittedEventId,
      lastCommittedAt: stateBefore1.lastCommittedAt,
      historicalRecords: historyBefore1
    }
  };

  const startTime1 = Date.now();
  const httpResponse1 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody1)
  });
  const responseStatus1 = httpResponse1.status;
  const responseData1 = await httpResponse1.json();
  const endTime1 = Date.now();

  console.log(`HTTP Status: ${responseStatus1} (${endTime1 - startTime1}ms)`);
  console.log(`Authorized Proposal Present: ${Boolean(responseData1.authorizedProposal)}`);
  console.log(`isFallbackNonMutation Flag: ${Boolean(responseData1.isFallbackNonMutation)}`);

  // Parse candidate recovery gate & candidates
  const rawLLMOutput1 = responseData1.rawResponse || responseData1.text || '';
  const parsedBlock1 = parseCandidatesBlock(rawLLMOutput1) || [];
  const gateResult1 = runCandidateRecoveryGate(parsedBlock1);

  const parsedCandidates1 = gateResult1.passedCandidates.map((c: any) => {
    const packet = extractCandidatesFromMetadata(c.rawMetadata || {}, 1, '1년차 봄 1일 10:00', c.candidateId);
    const proposal = buildSafeProposalFromCandidate(engine1.getSnapshot(), packet, 1, engine1.getHistory(), 'p_deny_1');
    const semanticEvents = getCandidateSemanticEvents(c) || getCandidateSemanticEvents(c.rawMetadata);
    const bridgeContext = createEngineSemanticBridgeContext(engine1.getSnapshot(), engine1.getHistory());
    let integratedProposal = proposal;
    let integratedMeaningTree = proposal.meaningTree;

    if (semanticEvents.length > 0) {
      const integration = integrateSemanticEventsIntoProposal(proposal, semanticEvents, bridgeContext);
      if (integration.status === 'MAPPABLE') {
        integratedProposal = integration.proposal;
        integratedMeaningTree = integration.meaningTree || proposal.meaningTree;
      }
    }

    const preAuthValidation = EngineValidator.validate(integratedProposal, engine1.getSnapshot(), new Set(), new Set(), engine1.getHistory());
    return {
      candidateId: c.candidateId,
      label: c.label,
      narrativeSummary: c.narrativeSummary,
      semanticEvents,
      parsedPacket: packet,
      proposal: integratedProposal,
      meaningTree: integratedMeaningTree,
      preAuthVerdict: preAuthValidation
    };
  });

  // Client Sovereign Commit attempt
  let commitResult1: any = null;
  let clientSovereignCommitExecuted1 = false;
  if (responseData1.authorizedProposal && Array.isArray(responseData1.authorizedProposal.actions) && responseData1.authorizedProposal.actions.length > 0) {
    clientSovereignCommitExecuted1 = true;
    commitResult1 = engine1.submitProposal(responseData1.authorizedProposal);
  } else {
    clientSovereignCommitExecuted1 = false;
    commitResult1 = { success: false, reason: 'SKIPPED_NO_AUTHORIZED_ACTIONS' };
  }

  const stateAfter1 = engine1.getSnapshot();
  const stateHashAfter1 = computeCanonicalStateHash(stateAfter1);
  const versionAfter1 = stateAfter1.stateVersion;
  const historyAfter1 = engine1.getHistory();
  const newHistoricalRecords1 = historyAfter1.length - historyBefore1.length;
  const committedActionsCount1 = commitResult1?.committedActionsCount ?? 0;
  const isStateUnchanged1 = (versionBefore1 === versionAfter1) && (stateHashBefore1 === stateHashAfter1) && (newHistoricalRecords1 === 0);

  const evidence1 = {
    testType: 'PURE_DENY_EXECUTION',
    actualModelVersion: responseData1.actualModelVersion || responseData1.requestedModel || 'gemini-3.5-flash',
    candidateRecoveryGate: {
      totalInputCount: gateResult1.totalInputCount,
      passedCount: gateResult1.passedCandidates.length,
      quarantinedCount: gateResult1.quarantinedCount
    },
    preAuthSummary: responseData1.preAuthSummary || { total: 0, allowed: 0, rejected: 0 },
    authorizedProposal: responseData1.authorizedProposal || null,
    isFallbackNonMutation: Boolean(responseData1.isFallbackNonMutation),
    clientSovereignCommit: {
      executed: clientSovereignCommitExecuted1,
      attemptedProposalId: responseData1.authorizedProposal?.proposalId || null
    },
    commitResult: commitResult1,
    stateVersionBefore: versionBefore1,
    stateVersionAfter: versionAfter1,
    stateHashBefore: stateHashBefore1,
    stateHashAfter: stateHashAfter1,
    isStateUnchanged: isStateUnchanged1,
    committedActionsCount: committedActionsCount1,
    newHistoricalRecords: newHistoricalRecords1,
    rawResponseSnippet: (responseData1.text || '').slice(0, 500)
  };

  console.log('\nTEST 1 INVARIANT CHECK:');
  console.log(`- Invariant A (original denied intent canonical mutation = 0): ${committedActionsCount1 === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`- Invariant B (LLM arbitrary replacement mutation = 0): ${(responseData1.authorizedProposal?.actions?.length || 0) === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`- Invariant C (authorizedProposal null or empty): ${(!responseData1.authorizedProposal || responseData1.authorizedProposal.actions.length === 0) ? 'PASS' : 'FAIL'}`);
  console.log(`- Invariant D (no client mutation): ${committedActionsCount1 === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`- Invariant E (version unchanged: ${versionBefore1} === ${versionAfter1}): ${versionBefore1 === versionAfter1 ? 'PASS' : 'FAIL'}`);
  console.log(`- Invariant F (hash unchanged: ${stateHashBefore1} === ${stateHashAfter1}): ${stateHashBefore1 === stateHashAfter1 ? 'PASS' : 'FAIL'}`);
  console.log(`- Invariant G (committedActionsCount === 0): ${committedActionsCount1 === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`- Invariant H (newHistoricalRecords === 0): ${newHistoricalRecords1 === 0 ? 'PASS' : 'FAIL'}`);

  // --------------------------------------------------------------------------
  // TEST 2: COUNTER-EXAMPLE SCENARIO (Dual Action: Impossible A + Explicit Valid B)
  // Input: "플레이어는 가방에 없는 고대 나침반을 꺼내보려다 없어서, 바닥에 떨어진 마른 나뭇가지를 주웠다."
  // --------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 2: COUNTER-EXAMPLE SCENARIO (Dual Action: Invalid A + Valid B)');
  console.log('Prompt: "플레이어는 가방에 없는 고대 나침반을 꺼내보려다 없어서, 바닥에 떨어진 마른 나뭇가지를 주웠다."');
  console.log('----------------------------------------------------------------');

  const engine2 = new SovereignEngine(initialWorld as any, initialCharacter as any);
  const stateBefore2 = engine2.getSnapshot();
  const stateHashBefore2 = computeCanonicalStateHash(stateBefore2);
  const versionBefore2 = stateBefore2.stateVersion;
  const historyBefore2 = engine2.getHistory();

  const dualPrompt = "플레이어는 가방에 없는 고대 나침반을 꺼내보려다 없어서, 바닥에 떨어진 마른 나뭇가지를 주웠다.";
  const requestBody2 = {
    userPrompt: dualPrompt,
    selectedModel: 'gemini-3.5-flash-lite',
    storyTurnCount: 1,
    messages: [{ role: 'user', content: dualPrompt }],
    worldInfo: stateBefore2.worldInfo,
    character: stateBefore2.character,
    engineState: {
      stateVersion: stateBefore2.stateVersion,
      lastCommittedEventId: stateBefore2.lastCommittedEventId,
      lastCommittedAt: stateBefore2.lastCommittedAt,
      historicalRecords: historyBefore2
    }
  };

  const startTime2 = Date.now();
  const httpResponse2 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody2)
  });
  const responseStatus2 = httpResponse2.status;
  const responseData2 = await httpResponse2.json();
  const endTime2 = Date.now();

  console.log(`HTTP Status: ${responseStatus2} (${endTime2 - startTime2}ms)`);
  console.log(`Authorized Proposal Present: ${Boolean(responseData2.authorizedProposal)}`);
  console.log(`Authorized Actions: ${JSON.stringify(responseData2.authorizedProposal?.actions || [])}`);

  // Client Sovereign Commit attempt for Test 2
  let commitResult2: any = null;
  let clientSovereignCommitExecuted2 = false;
  if (responseData2.authorizedProposal && Array.isArray(responseData2.authorizedProposal.actions) && responseData2.authorizedProposal.actions.length > 0) {
    clientSovereignCommitExecuted2 = true;
    commitResult2 = engine2.submitProposal(responseData2.authorizedProposal);
  } else {
    clientSovereignCommitExecuted2 = false;
    commitResult2 = { success: false, reason: 'SKIPPED_NO_AUTHORIZED_ACTIONS' };
  }

  const stateAfter2 = engine2.getSnapshot();
  const stateHashAfter2 = computeCanonicalStateHash(stateAfter2);
  const versionAfter2 = stateAfter2.stateVersion;
  const historyAfter2 = engine2.getHistory();
  const newHistoricalRecords2 = historyAfter2.length - historyBefore2.length;
  const committedActionsCount2 = commitResult2?.committedActionsCount ?? (commitResult2?.success ? (responseData2.authorizedProposal?.actions?.length || 0) : 0);

  const evidence2 = {
    testType: 'DUAL_ACTION_COUNTER_EXAMPLE_EXECUTION',
    actualModelVersion: responseData2.actualModelVersion || responseData2.requestedModel || 'gemini-3.5-flash',
    userPrompt: dualPrompt,
    authorizedProposal: responseData2.authorizedProposal || null,
    isFallbackNonMutation: Boolean(responseData2.isFallbackNonMutation),
    clientSovereignCommit: {
      executed: clientSovereignCommitExecuted2,
      commitResult: commitResult2
    },
    stateVersionBefore: versionBefore2,
    stateVersionAfter: versionAfter2,
    stateHashBefore: stateHashBefore2,
    stateHashAfter: stateHashAfter2,
    committedActionsCount: committedActionsCount2,
    inventoryAfter: stateAfter2.character.inventory,
    rawResponseSnippet: (responseData2.text || '').slice(0, 500)
  };

  // Save forensic evidence files
  fs.writeFileSync(path.join(REPORT_DIR, 'pure_deny_raw_evidence.json'), JSON.stringify(evidence1, null, 2), 'utf-8');
  fs.writeFileSync(path.join(REPORT_DIR, 'dual_action_raw_evidence.json'), JSON.stringify(evidence2, null, 2), 'utf-8');
  fs.writeFileSync(path.join(REPORT_DIR, 'full_forensic_run.json'), JSON.stringify({
    test1: evidence1,
    test2: evidence2,
    timestamp: new Date().toISOString()
  }, null, 2), 'utf-8');

  console.log('\nForensic raw evidence written to report/68_deny_derived_mutation_fix_design/');
}

runForensicAudit().catch(err => {
  console.error('Forensic execution failed:', err);
  process.exit(1);
});
