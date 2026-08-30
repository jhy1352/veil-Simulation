import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { SovereignEngine } from '../src/engine/state';
import { EngineValidator } from '../src/engine/validator';
import { dispatchEngineInternalProposal, isEngineAuthorized } from '../src/engine/internalCapability';
import { validateLLM2MutationBoundary } from '../src/engine/mutationBoundary';
import { parseGMResponseAndProposal } from '../src/engine/proposalParser';
import { StateTransitionProposal, ImmutableHistoricalRecord, CanonicalState, TransitionAction } from '../src/engine/types';
import { createEmptyCharacter, createEmptyWorldInfo } from '../src/utils/factory';

// ============================================================================
// TRPG 3.1 VEIL — RED TEAM EVIDENCE INTEGRITY RE-VERIFICATION SUITE
// ============================================================================

export interface StrictDeepStateSnapshot {
  stateVersion: number;
  turn: number;
  lastCommittedEventId: string | null;
  lastCommittedAt: string;
  character: any;
  worldInfo: any;
  history: any[];
  historyLength: number;
  diagnostics: any;
  executedRequestIds: string[];
  recordedEventIds: string[];
}

export function captureStrictDeepState(engine: SovereignEngine): StrictDeepStateSnapshot {
  const snap = engine.getSnapshot();
  const hist = engine.getHistory();
  const diag = engine.getDiagnostics();
  const executedReqs = Array.from((engine as any).executedRequestIds || []).sort();
  const recordedEvts = Array.from((engine as any).recordedEventIds || []).sort();

  return {
    stateVersion: snap.stateVersion,
    turn: snap.turn,
    lastCommittedEventId: snap.lastCommittedEventId,
    lastCommittedAt: snap.lastCommittedAt,
    character: JSON.parse(JSON.stringify(snap.character)),
    worldInfo: JSON.parse(JSON.stringify(snap.worldInfo)),
    historyLength: hist.length,
    history: hist.map(h => ({
      recordId: h.recordId,
      eventId: h.eventId,
      requestId: h.requestId,
      proposalId: h.proposalId,
      actionType: h.actionType,
      stateVersionAfterCommit: h.stateVersionAfterCommit,
      turn: h.turn,
      timestamp: h.timestamp,
      informationAccess: h.informationAccess,
      details: h.details,
      category: h.category
    })),
    diagnostics: { ...diag },
    executedRequestIds: executedReqs,
    recordedEventIds: recordedEvts
  };
}

export function strictDeepCompare(
  before: StrictDeepStateSnapshot,
  after: StrictDeepStateSnapshot
): { isIdentical: boolean; diffs: string[] } {
  const diffs: string[] = [];

  if (before.stateVersion !== after.stateVersion) {
    diffs.push(`stateVersion: ${before.stateVersion} -> ${after.stateVersion}`);
  }
  if (before.turn !== after.turn) {
    diffs.push(`turn: ${before.turn} -> ${after.turn}`);
  }
  if (before.lastCommittedEventId !== after.lastCommittedEventId) {
    diffs.push(`lastCommittedEventId: ${before.lastCommittedEventId} -> ${after.lastCommittedEventId}`);
  }
  if (before.lastCommittedAt !== after.lastCommittedAt) {
    diffs.push(`lastCommittedAt: ${before.lastCommittedAt} -> ${after.lastCommittedAt}`);
  }
  if (before.historyLength !== after.historyLength) {
    diffs.push(`historyLength: ${before.historyLength} -> ${after.historyLength}`);
  }
  const beforeHistStr = JSON.stringify(before.history);
  const afterHistStr = JSON.stringify(after.history);
  if (beforeHistStr !== afterHistStr) {
    diffs.push(`history content mutated: ${beforeHistStr} -> ${afterHistStr}`);
  }
  const beforeCharStr = JSON.stringify(before.character);
  const afterCharStr = JSON.stringify(after.character);
  if (beforeCharStr !== afterCharStr) {
    diffs.push(`character mutated: ${beforeCharStr} -> ${afterCharStr}`);
  }
  const beforeWorldStr = JSON.stringify(before.worldInfo);
  const afterWorldStr = JSON.stringify(after.worldInfo);
  if (beforeWorldStr !== afterWorldStr) {
    diffs.push(`worldInfo mutated: ${beforeWorldStr} -> ${afterWorldStr}`);
  }
  const beforeDiagStr = JSON.stringify(before.diagnostics);
  const afterDiagStr = JSON.stringify(after.diagnostics);
  if (beforeDiagStr !== afterDiagStr) {
    diffs.push(`diagnostics mutated: ${beforeDiagStr} -> ${afterDiagStr}`);
  }
  const beforeReqsStr = JSON.stringify(before.executedRequestIds);
  const afterReqsStr = JSON.stringify(after.executedRequestIds);
  if (beforeReqsStr !== afterReqsStr) {
    diffs.push(`executedRequestIds mutated: ${beforeReqsStr} -> ${afterReqsStr}`);
  }
  const beforeEvtsStr = JSON.stringify(before.recordedEventIds);
  const afterEvtsStr = JSON.stringify(after.recordedEventIds);
  if (beforeEvtsStr !== afterEvtsStr) {
    diffs.push(`recordedEventIds mutated: ${beforeEvtsStr} -> ${afterEvtsStr}`);
  }

  return {
    isIdentical: diffs.length === 0,
    diffs
  };
}

// ----------------------------------------------------------------------------
// HARNESS AUDIT & POSITIVE CONTROL TEST
// ----------------------------------------------------------------------------
function runPositiveControlAudit(): { total: number; passed: number; failed: number; findings: string[] } {
  const findings: string[] = [];
  let total = 0;
  let passed = 0;
  let failed = 0;

  function createBaselineEngine(): SovereignEngine {
    const world = createEmptyWorldInfo();
    world.worldName = 'PositiveControlWorld';
    world.currentTime = { year: 1, season: 'SPRING', month: 3, day: 15, timeOfDay: 'MORNING' };
    world.factions = [{ id: 'fac-1', name: '화산파', influence: 50 }];
    world.npcs = [{ id: 'npc-1', name: '백운도인', metInStory: true, status: 'ALIVE' }];
    world.seeds = [{ id: 'seed-1', content: '자하진기 비급 수색', status: 'active' }];

    const char = createEmptyCharacter();
    char.name = '청명';
    char.stats = { strength: 14, agility: 12, constitution: 13, intelligence: 10, wisdom: 10, charisma: 10 };
    char.inventory = [{ id: 'item-1', name: '철검', quantity: 1 }];
    char.physicalDefect = '왼쪽 어깨 흉터';

    return new SovereignEngine(world, char, [], 1, 1);
  }

  const mutations: Array<{ name: string; mutate: (snap: StrictDeepStateSnapshot) => void }> = [
    { name: 'stateVersion mutation', mutate: s => { s.stateVersion += 1; } },
    { name: 'turn mutation', mutate: s => { s.turn += 1; } },
    { name: 'lastCommittedEventId mutation', mutate: s => { s.lastCommittedEventId = 'evt-mutated'; } },
    { name: 'lastCommittedAt mutation', mutate: s => { s.lastCommittedAt = '2099-01-01T00:00:00.000Z'; } },
    { name: 'character.name mutation', mutate: s => { s.character.name = '변조된이름'; } },
    { name: 'character.stats.strength mutation', mutate: s => { s.character.stats.strength = 99; } },
    { name: 'character.inventory item addition', mutate: s => { s.character.inventory.push({ id: 'item-hacked', name: '해킹검', quantity: 1 }); } },
    { name: 'character.physicalDefect mutation', mutate: s => { s.character.physicalDefect = '완치됨'; } },
    { name: 'worldInfo.worldName mutation', mutate: s => { s.worldInfo.worldName = '변조세계'; } },
    { name: 'worldInfo.currentTime mutation', mutate: s => { s.worldInfo.currentTime.year = 999; } },
    { name: 'worldInfo.factions influence mutation', mutate: s => { s.worldInfo.factions[0].influence = 99; } },
    { name: 'worldInfo.npcs status mutation', mutate: s => { s.worldInfo.npcs[0].status = 'DEAD'; } },
    { name: 'worldInfo.seeds status mutation', mutate: s => { s.worldInfo.seeds[0].status = 'completed'; } },
    { name: 'historyLength mutation', mutate: s => { s.historyLength += 1; } },
    {
      name: 'history in-place record details mutation (same length)',
      mutate: s => {
        if (s.history.length === 0) {
          s.history.push({ recordId: 'rec-fake', eventId: 'evt-fake', requestId: 'req-fake', proposalId: 'prop-fake', actionType: 'ADD_RUMOR', stateVersionAfterCommit: 1, turn: 1, timestamp: '2026-01-01', informationAccess: 'PUBLIC', details: 'fake' });
          s.historyLength = 1;
        } else {
          s.history[0].details = 'mutated details';
        }
      }
    },
    { name: 'diagnostics.totalExecutedRequests mutation', mutate: s => { s.diagnostics.totalExecutedRequests += 1; } },
    { name: 'diagnostics.totalRecordedEvents mutation', mutate: s => { s.diagnostics.totalRecordedEvents += 1; } },
    { name: 'executedRequestIds set addition', mutate: s => { s.executedRequestIds.push('req-injected-id'); } },
    { name: 'recordedEventIds set addition', mutate: s => { s.recordedEventIds.push('evt-injected-id'); } }
  ];

  for (const tc of mutations) {
    total++;
    const engine = createBaselineEngine();
    const before = captureStrictDeepState(engine);
    const after = captureStrictDeepState(engine);

    // Apply deliberate mutation to 'after'
    tc.mutate(after);

    const comp = strictDeepCompare(before, after);
    if (!comp.isIdentical && comp.diffs.length > 0) {
      passed++;
      findings.push(`[POSITIVE CONTROL PASS] ${tc.name} -> Successfully caught mutation: ${comp.diffs[0]}`);
    } else {
      failed++;
      findings.push(`[POSITIVE CONTROL FAIL] ${tc.name} -> FAILED to detect mutation!`);
    }
  }

  return { total, passed, failed, findings };
}

// ============================================================================
// AUDIT OF ORIGINAL final_red_team_adversarial_proof.ts HARNESS
// ============================================================================
function auditOriginalHarness(): { findings: string[]; issuesCount: number } {
  const findings: string[] = [];
  let issuesCount = 0;

  findings.push('1. Harness Forensics on `final_red_team_adversarial_proof.ts`:');

  // Issue 1: S3-01 does not run engine.submitProposal and uses dummy snapshot
  findings.push('   - [HARNESS ISSUE S3-01]: Test S3-01 only calls `validateLLM2MutationBoundary` standalone without initializing a SovereignEngine instance, capturing runtime stateBefore/After, or executing `engine.submitProposal`. It hardcodes `stateBefore: {}` and `comparison: { isIdentical: true, diffs: [] }`.');
  issuesCount++;

  // Issue 2: S6-01 does not run engine.submitProposal and uses tautological assertion
  findings.push('   - [HARNESS ISSUE S6-01]: Test S6-01 only tests parser `parseGMResponseAndProposal` without runtime engine execution. Its assertion `parsed.cleanNarrative.length > 0` is weak and does not verify whether malicious candidate blocks were safely neutralized from being committed.');
  issuesCount++;

  // Issue 3: deepCompareStates in original file checked historyLength but omitted history deep content comparison
  findings.push('   - [HARNESS WEAKNESS deepCompareStates]: Original `deepCompareStates` compared `historyLength` but did NOT do `JSON.stringify(before.history) !== JSON.stringify(after.history)`. In-place historical record modifications with identical length would have bypassed the original comparator.');
  issuesCount++;

  // Issue 4: executedRequestIds and recordedEventIds sets were only compared via .size
  findings.push('   - [HARNESS WEAKNESS private sets]: Original comparator checked `diagnostics.totalExecutedRequests` (.size) but did not check exact serialized set contents of `executedRequestIds` or `recordedEventIds`.');
  issuesCount++;

  return { findings, issuesCount };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
console.log('================================================================================');
console.log('TRPG 3.1 VEIL — RED TEAM EVIDENCE INTEGRITY RE-VERIFICATION');
console.log('TIMESTAMP:', new Date().toISOString());
console.log('================================================================================\n');

console.log('>>> [PHASE 1] RUNNING POSITIVE CONTROL AUDIT (19 INJECTED MUTATIONS)...');
const pcResults = runPositiveControlAudit();
for (const f of pcResults.findings) {
  console.log(f);
}
console.log(`\nPositive Control Summary: Total=${pcResults.total}, Passed=${pcResults.passed}, Failed=${pcResults.failed}\n`);

console.log('>>> [PHASE 2] AUDITING ORIGINAL TEST HARNESS...');
const harnessAudit = auditOriginalHarness();
for (const f of harnessAudit.findings) {
  console.log(f);
}
console.log(`\nHarness Issues Identified: ${harnessAudit.issuesCount}\n`);

// Save audit output to report
const reportDir = path.join(process.cwd(), 'report', '03_evidence_integrity_reverification');
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

const auditReportText = [
  '================================================================================',
  'TRPG 3.1 VEIL — RED TEAM EVIDENCE INTEGRITY RE-VERIFICATION AUDIT REPORT',
  `TIMESTAMP: ${new Date().toISOString()}`,
  '================================================================================\n',
  '1. POSITIVE CONTROL RESULTS (19/19 Mutation Vectors Tested):',
  ...pcResults.findings,
  '',
  `Positive Control Result: ${pcResults.passed}/${pcResults.total} (${pcResults.failed === 0 ? '100% SENSITIVITY VERIFIED' : 'DEFICIENT'})`,
  '',
  '2. HARNESS FORENSICS FINDINGS:',
  ...harnessAudit.findings,
  '',
  '================================================================================'
].join('\n');

fs.writeFileSync(path.join(reportDir, 'evidence_integrity_reverification_report.txt'), auditReportText, 'utf-8');
console.log(`Saved report to ${path.join(reportDir, 'evidence_integrity_reverification_report.txt')}`);
