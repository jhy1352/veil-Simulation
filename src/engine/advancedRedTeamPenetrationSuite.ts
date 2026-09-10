import { SovereignEngine } from './state';
import { StateTransitionProposal } from './types';
import { NpcRecord } from '../types';
import { actionToMeaningNode } from './language/adapter';
import { MeaningNode } from './language/types';
import { dispatchEngineInternalProposal } from './internalCapability';

interface RedTeamTestResult {
  testId: string;
  attackName: string;
  targetSurface: string;
  outcome: 'BLOCKED' | 'VULNERABLE' | 'ERROR';
  details: string;
}

function attachMeaningTree(proposal: StateTransitionProposal): StateTransitionProposal {
  if (!proposal.meaningTree) {
    const children = (proposal.actions || []).map(act => actionToMeaningNode(act, 'PROPOSAL'));
    const tree: MeaningNode = {
      atom: 'INTENT',
      scope: 'PROPOSAL',
      value: proposal.intentSummary || 'Red-Team Attack Proposal',
      children: children.length > 0 ? children : undefined,
    };
    proposal.meaningTree = tree;
  }
  return proposal;
}

/**
 * Advanced Red-Team Campaign Penetration Test Suite (TRPG 3.1)
 * Executes live runtime attacks against SovereignEngine and asserts that all attack vectors are successfully BLOCKED.
 */
export function runAdvancedRedTeamPenetrationSuite(): { passed: boolean; results: RedTeamTestResult[] } {
  const results: RedTeamTestResult[] = [];

  // 1. Attack 1: PLAYER Direct NPC Mutation (ACL / Provenance Bypass Attempt)
  try {
    const engine = new SovereignEngine();
    // First add an NPC legitimately via dispatchEngineInternalProposal (SYSTEM source)
    const setupRes = dispatchEngineInternalProposal(engine, {
      proposalId: 'p-setup-1',
      requestId: 'req-setup-1',
      eventId: 'evt-setup-1',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Setup NPC for test',
      actions: [
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-target-1', name: '표적 NPC', npcClass: 'Class A' } as NpcRecord
        }
      ]
    });

    if (!setupRes.success) {
      throw new Error(`Setup failed: ${setupRes.rejectedReasons.join(', ')}`);
    }

    const snapshot = engine.getSnapshot();
    if (snapshot.worldInfo.npcs.length !== 1) {
      throw new Error('Setup failed to add NPC');
    }

    // Now attempt PLAYER direct mutation of NPC without VerifiedClaim
    const maliciousProposal = attachMeaningTree({
      proposalId: 'p-attack-1',
      requestId: 'req-attack-1',
      eventId: 'evt-attack-1',
      expectedStateVersion: snapshot.stateVersion,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player unauthorized direct NPC mutation',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: {
            id: 'npc-target-1',
            changes: { name: '해킹된 NPC' }
          }
        }
      ]
    });

    const commitRes = engine.submitProposal(maliciousProposal);
    if (!commitRes.success) {
      results.push({
        testId: 'RED-RT-01',
        attackName: 'PLAYER Direct NPC Mutation Attack',
        targetSurface: 'EngineValidator ACL & VerifiedClaim Enforcement',
        outcome: 'BLOCKED',
        details: `Successfully blocked unauthorized PLAYER UPDATE_NPC. Rejected reasons: ${commitRes.rejectedReasons.join('; ')}`
      });
    } else {
      results.push({
        testId: 'RED-RT-01',
        attackName: 'PLAYER Direct NPC Mutation Attack',
        targetSurface: 'EngineValidator ACL & VerifiedClaim Enforcement',
        outcome: 'VULNERABLE',
        details: 'Vulnerability confirmed: PLAYER source successfully mutated canonical NPC without VerifiedClaim.'
      });
    }
  } catch (err: any) {
    results.push({
      testId: 'RED-RT-01',
      attackName: 'PLAYER Direct NPC Mutation Attack',
      targetSurface: 'EngineValidator ACL & VerifiedClaim Enforcement',
      outcome: 'ERROR',
      details: err?.message || String(err)
    });
  }

  // 2. Attack 2: Stale State Version Regression Attack
  try {
    const engine = new SovereignEngine();

    // Advance state version normally via dispatchEngineInternalProposal
    const setup2Res = dispatchEngineInternalProposal(engine, {
      proposalId: 'p-setup-2',
      requestId: 'req-setup-2',
      eventId: 'evt-setup-2',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Advance state version',
      actions: [
        {
          type: 'ADVANCE_CHAPTER',
          payload: { currentChapter: '제2장' }
        }
      ]
    });

    if (!setup2Res.success) {
      throw new Error(`Setup 2 failed: ${setup2Res.rejectedReasons.join(', ')}`);
    }

    const v2Snapshot = engine.getSnapshot();
    if (v2Snapshot.stateVersion !== 2) {
      throw new Error('Failed to advance state version');
    }

    // Submit proposal with stale expectedStateVersion = 1
    const staleProposal = attachMeaningTree({
      proposalId: 'p-attack-2',
      requestId: 'req-attack-2',
      eventId: 'evt-attack-2',
      expectedStateVersion: 1, // Stale!
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stale version regression attack',
      actions: [
        {
          type: 'ADVANCE_CHAPTER',
          payload: { currentChapter: '해킹된 장' }
        }
      ]
    });

    const staleRes = engine.submitProposal(staleProposal);
    if (!staleRes.success) {
      results.push({
        testId: 'RED-RT-02',
        attackName: 'Stale State Version Regression Attack',
        targetSurface: 'SovereignEngine State Version Guard',
        outcome: 'BLOCKED',
        details: `Successfully blocked stale state version proposal. Rejected reasons: ${staleRes.rejectedReasons.join('; ')}`
      });
    } else {
      results.push({
        testId: 'RED-RT-02',
        attackName: 'Stale State Version Regression Attack',
        targetSurface: 'SovereignEngine State Version Guard',
        outcome: 'VULNERABLE',
        details: 'Vulnerability confirmed: Stale state version was accepted.'
      });
    }
  } catch (err: any) {
    results.push({
      testId: 'RED-RT-02',
      attackName: 'Stale State Version Regression Attack',
      targetSurface: 'SovereignEngine State Version Guard',
      outcome: 'ERROR',
      details: err?.message || String(err)
    });
  }

  // 3. Attack 3: Independent ADD_NPC Identity Gate Bypass Attack
  try {
    const engine = new SovereignEngine();
    const snapshot = engine.getSnapshot();

    // Attempt to add NPC with source LLM directly bypassing identity resolution gate
    const bypassProposal = attachMeaningTree({
      proposalId: 'p-attack-3',
      requestId: 'req-attack-3',
      eventId: 'evt-attack-3',
      expectedStateVersion: snapshot.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Direct ADD_NPC without proper immigration / identity gate',
      actions: [
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-malicious', name: '위조된 도인', npcClass: 'Class A' } as NpcRecord
        }
      ]
    });

    const bypassRes = engine.submitProposal(bypassProposal);
    if (!bypassRes.success) {
      results.push({
        testId: 'RED-RT-03',
        attackName: 'Direct ADD_NPC Identity Gate Bypass',
        targetSurface: 'EngineValidator ADD_NPC Authority & ImmigrationGate',
        outcome: 'BLOCKED',
        details: `Successfully blocked direct ADD_NPC from LLM source. Rejected reasons: ${bypassRes.rejectedReasons.join('; ')}`
      });
    } else {
      results.push({
        testId: 'RED-RT-03',
        attackName: 'Direct ADD_NPC Identity Gate Bypass',
        targetSurface: 'EngineValidator ADD_NPC Authority & ImmigrationGate',
        outcome: 'VULNERABLE',
        details: 'Vulnerability confirmed: LLM source successfully executed ADD_NPC.'
      });
    }
  } catch (err: any) {
    results.push({
      testId: 'RED-RT-03',
      attackName: 'Direct ADD_NPC Identity Gate Bypass',
      targetSurface: 'EngineValidator ADD_NPC Authority & ImmigrationGate',
      outcome: 'ERROR',
      details: err?.message || String(err)
    });
  }

  const allPassed = results.every(r => r.outcome === 'BLOCKED');
  return { passed: allPassed, results };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.endsWith('advancedRedTeamPenetrationSuite.ts')) {
  const { passed, results } = runAdvancedRedTeamPenetrationSuite();
  console.log('=== Advanced Red-Team Penetration Test Results ===');
  for (const r of results) {
    console.log(`[${r.outcome}] ${r.testId} - ${r.attackName} (${r.targetSurface}): ${r.details}`);
  }
  if (!passed) {
    console.error('❌ Red-Team Penetration Suite Failed: Vulnerabilities detected.');
    process.exit(1);
  } else {
    console.log('✅ All Red-Team Attacks Successfully Blocked.');
    process.exit(0);
  }
}
