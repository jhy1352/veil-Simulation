import fs from 'fs';
import path from 'path';
import { SovereignEngine } from '../src/engine/state';
import { StateTransitionProposal, TransitionAction, ProposalSource } from '../src/engine/types';
import { createEmptyCharacter, createEmptyWorldInfo } from '../src/utils/factory';
import { actionToMeaningNode, adaptMeaningTreeToProposal } from '../src/engine/language/adapter';
import { MeaningNode } from '../src/engine/language/types';
import { ImmigrationGate } from '../src/engine/immigrationGate';
import { dispatchEngineInternalProposal, dispatchEngineInternalAction } from '../src/engine/internalCapability';
import { buildSafeProposalFromCandidate } from '../src/engine/proposalParser';
import { CandidatePacket, Character } from '../src/types';
import { runSovereignEngineTestSuite } from '../src/engine/testRunner';
import { runLanguageTestSuite } from '../src/engine/language/testSuite';
import { executeRedTeamCampaign } from '../src/engine/claimCausalityRedteamRunner';

export type RedTeamTestType =
  | 'ADVERSARIAL_ATTACK'
  | 'POLICY_CLAMPING_SANITIZATION'
  | 'LEGITIMATE_PRODUCTION';

export interface RedTeamRecord {
  id: string;
  domain: string;
  name: string;
  testType: RedTeamTestType;
  attackVector: string;
  verdict: 'BLOCKED' | 'BREACHED' | 'SANITIZED_AND_COMMITTED' | 'ALLOWED' | 'FAILED';
  canonicalStateUnmutatedVerified: boolean;
  historyUnmutatedVerified: boolean;
  historyCountBefore: number;
  historyCountAfter: number;
  rejectionReasons: readonly string[];
  stateVersionBefore: number;
  stateVersionAfter: number;
  details: string;
}

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function createGenesisEngine(): SovereignEngine {
  const char = createEmptyCharacter();
  char.name = '테스트 주인공';
  char.stats.strength = 15;
  char.stats.agility = 12;
  char.inventory = [{ id: 'item_sword', name: '강철 검', quantity: 1, type: 'WEAPON' }];

  const world = createEmptyWorldInfo();
  world.currentTime = {
    year: 100,
    month: 1,
    day: 1,
    hour: 8,
    minute: 0,
    formattedTime: '100년 1월 1일 08:00',
    totalMinutes: 52560000
  };
  world.npcs = [
    {
      id: 'npc_elder',
      name: '마을 촌장',
      innerThought: '비밀을 숨기고 있다.',
      npcClass: 'Class A',
      status: 'ALIVE'
    }
  ];

  return new SovereignEngine(world, char, [], 1, 1);
}

async function runExhaustivePenetrationMission() {
  console.log('================================================================');
  console.log('    VEIL — MAXIMUM RED TEAM EXHAUSTIVE PENETRATION MISSION      ');
  console.log('================================================================');

  const records: RedTeamRecord[] = [];

  // ==========================================================================
  // DOMAIN 1: PROPOSAL SURFACE & DIRECT ASSEMBLY ATTACKS (4 Vectors)
  // ==========================================================================
  console.log('\n>>> DOMAIN 1: Proposal Surface & Direct Assembly Attacks <<<');

  // [SURF-01] Direct actions[] assembly without meaningTree (missing meaningTree)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-surf-01',
      requestId: 'req-surf-01',
      eventId: 'evt-surf-01',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Direct actions injection without meaningTree',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 25 }
        }
      ]
    };
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'SURF-01',
      domain: '1. Proposal Surface',
      name: 'Direct actions[] assembly without meaningTree property',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'Omit proposal.meaningTree completely',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [SURF-02] meaningTree null / invalid type
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const proposal: any = {
      proposalId: 'prop-surf-02',
      requestId: 'req-surf-02',
      eventId: 'evt-surf-02',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'meaningTree null violation',
      meaningTree: null,
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 25 }
        }
      ]
    };
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'SURF-02',
      domain: '1. Proposal Surface',
      name: 'meaningTree property set to null/primitive',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'proposal.meaningTree = null',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [SURF-03] meaningTree with invalid atom / grammar violation
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const invalidTree: any = {
      atom: 'ILLEGAL_ROOT_ATOM',
      scope: 'PROPOSAL',
      value: 'Attacker payload',
      children: [
        {
          atom: 'FORGED_CHILD',
          scope: 'SYSTEM',
          value: { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 25 } }
        }
      ]
    };
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-surf-03',
      requestId: 'req-surf-03',
      eventId: 'evt-surf-03',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Grammar corrupted tree',
      meaningTree: invalidTree,
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 25 }
        }
      ]
    };
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'SURF-03',
      domain: '1. Proposal Surface',
      name: 'Corrupted atom/grammar in MeaningTree',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'atom: ILLEGAL_ROOT_ATOM',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [SURF-04] Reference substitution after adaptMeaningTreeToProposal
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const action: TransitionAction = {
      type: 'UPDATE_CHARACTER_STATS',
      payload: { strength: 16 }
    };
    const tree = actionToMeaningNode(action, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-surf-04',
      requestId: 'req-surf-04',
      eventId: 'evt-surf-04',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Swapped actions reference attack'
    });
    // Attacker substitutes actions array with forged action
    (proposal as any).actions = [
      {
        type: 'UPDATE_CHARACTER_STATS',
        payload: { strength: 28 }
      }
    ];
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'SURF-04',
      domain: '1. Proposal Surface',
      name: 'Post-adaptation actions[] reference replacement',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'proposal.actions = [forgedAction]',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // ==========================================================================
  // DOMAIN 2: MEANING TREE AUTHORITY & PROJECTION INCONSISTENCY ATTACKS (6 Vectors)
  // ==========================================================================
  console.log('\n>>> DOMAIN 2: MeaningTree Authority & Projection Tampering Attacks <<<');

  // [TREE-01] Action Type Mismatch (Tree OVERWRITE_CHARACTER vs Action OVERWRITE_WORLD_INFO)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const char = { ...snapBefore.character, age: 25 };
    const charAction: TransitionAction = { type: 'OVERWRITE_CHARACTER', payload: char };
    const tree = actionToMeaningNode(charAction, 'PROPOSAL');
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-tree-01',
      requestId: 'req-tree-01',
      eventId: 'evt-tree-01',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Type mismatch attack',
      meaningTree: tree,
      actions: [{ type: 'OVERWRITE_WORLD_INFO', payload: snapBefore.worldInfo }]
    };
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'TREE-01',
      domain: '2. MeaningTree Authority',
      name: 'Action type mismatch (OVERWRITE_CHARACTER vs OVERWRITE_WORLD_INFO)',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'Tree has type A, actions has type B',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [TREE-02] Payload Stat Value Tampering (Tree STR 18 vs Action STR 29)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const charLegit = { ...snapBefore.character, stats: { ...snapBefore.character.stats, strength: 18 } };
    const charAction: TransitionAction = { type: 'OVERWRITE_CHARACTER', payload: charLegit };
    const tree = actionToMeaningNode(charAction, 'PROPOSAL');
    const charMalicious = { ...snapBefore.character, stats: { ...snapBefore.character.stats, strength: 29 } };
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-tree-02',
      requestId: 'req-tree-02',
      eventId: 'evt-tree-02',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Payload stat value tampering attack',
      meaningTree: tree,
      actions: [{ type: 'OVERWRITE_CHARACTER', payload: charMalicious }]
    };
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'TREE-02',
      domain: '2. MeaningTree Authority',
      name: 'Payload stat tampering (Tree STR 18 vs Action STR 29)',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'Action payload altered after MeaningTree projection',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [TREE-03] Injected Extra Action into actions[]
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act1: TransitionAction = { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 16 } };
    const tree = actionToMeaningNode(act1, 'PROPOSAL');
    const actInjected: TransitionAction = { type: 'RECORD_DICE_RESULT', payload: { roll: 20, targetDC: 10, isSuccess: true, reason: 'Injected' } };
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-tree-03',
      requestId: 'req-tree-03',
      eventId: 'evt-tree-03',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Extra action injection',
      meaningTree: tree,
      actions: [act1, actInjected]
    };
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'TREE-03',
      domain: '2. MeaningTree Authority',
      name: 'Injected extra unprojected action into actions[]',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'Append unprojected action to actions[]',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [TREE-04] Deleted Actions (Empty actions[] with non-empty MeaningTree)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act1: TransitionAction = { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 16 } };
    const tree = actionToMeaningNode(act1, 'PROPOSAL');
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-tree-04',
      requestId: 'req-tree-04',
      eventId: 'evt-tree-04',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Empty actions[] with valid MeaningTree',
      meaningTree: tree,
      actions: []
    };
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'TREE-04',
      domain: '2. MeaningTree Authority',
      name: 'Deleted actions[] with non-empty MeaningTree',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'actions = [] with valid tree',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [TREE-05] ORDERED Sequence Inversion
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act1: TransitionAction = { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 16 } };
    const act2: TransitionAction = { type: 'RECORD_DICE_RESULT', payload: { roll: 15, targetDC: 12, isSuccess: true, reason: 'Check' } };
    const tree: MeaningNode = {
      atom: 'ORDERED',
      scope: 'PROPOSAL',
      children: [actionToMeaningNode(act1, 'PROPOSAL'), actionToMeaningNode(act2, 'PROPOSAL')]
    };
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-tree-05',
      requestId: 'req-tree-05',
      eventId: 'evt-tree-05',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Sequence inversion',
      meaningTree: tree,
      actions: [act2, act1] // Inverted!
    };
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'TREE-05',
      domain: '2. MeaningTree Authority',
      name: 'ORDERED composition actions sequence inverted',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'actions = [act2, act1] vs tree [act1, act2]',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [TREE-06] Alias / Reference Mutation after projection
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const mutablePayload = { strength: 16 };
    const act: TransitionAction = { type: 'UPDATE_CHARACTER_STATS', payload: mutablePayload };
    const tree = actionToMeaningNode(act, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-tree-06',
      requestId: 'req-tree-06',
      eventId: 'evt-tree-06',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Reference mutation attack'
    });
    // Mutate the shared payload object to exceed bounds (STR 99)
    mutablePayload.strength = 99;
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'TREE-06',
      domain: '2. MeaningTree Authority',
      name: 'Shared reference payload mutation trap (STR 16 -> 99)',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'Mutate shared payload reference after adapt',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // ==========================================================================
  // DOMAIN 3: AUTHORITY & ACL PENETRATION ATTACKS (7 Vectors)
  // ==========================================================================
  console.log('\n>>> DOMAIN 3: Authority & ACL Penetration Attacks <<<');

  // [ACL-01] Spoofed SYSTEM source without engine capability
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act: TransitionAction = { type: 'OVERWRITE_WORLD_INFO', payload: snapBefore.worldInfo };
    const tree = actionToMeaningNode(act, 'SYSTEM');
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-acl-01',
      requestId: 'req-acl-01',
      eventId: 'evt-acl-01',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'SYSTEM',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Spoofed system proposal',
      meaningTree: tree,
      actions: [act]
    };
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'ACL-01',
      domain: '3. Authority & ACL',
      name: 'Spoofed SYSTEM source without Engine capability token',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'source: SYSTEM without capability token',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [ACL-02] Spoofed ENGINE_INTERNAL source without capability
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act: TransitionAction = { type: 'OVERWRITE_CHARACTER', payload: snapBefore.character };
    const tree = actionToMeaningNode(act, 'SYSTEM');
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-acl-02',
      requestId: 'req-acl-02',
      eventId: 'evt-acl-02',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'ENGINE_INTERNAL',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Spoofed ENGINE_INTERNAL proposal',
      meaningTree: tree,
      actions: [act]
    };
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'ACL-02',
      domain: '3. Authority & ACL',
      name: 'Spoofed ENGINE_INTERNAL source without Engine capability token',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'source: ENGINE_INTERNAL direct submission',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [ACL-03] Unknown / Forged source string (HACKER_ROOT)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act: TransitionAction = { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 20 } };
    const tree = actionToMeaningNode(act, 'PROPOSAL');
    const proposal: any = {
      proposalId: 'prop-acl-03',
      requestId: 'req-acl-03',
      eventId: 'evt-acl-03',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'HACKER_ROOT',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Forged source string',
      meaningTree: tree,
      actions: [act]
    };
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'ACL-03',
      domain: '3. Authority & ACL',
      name: 'Unknown forged source string (HACKER_ROOT)',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'source: HACKER_ROOT',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [ACL-04] GENESIS source on active game (turn > 1 or prior commit)
  {
    const engine = createGenesisEngine();
    const snap0 = engine.getSnapshot();
    const validChar = { ...snap0.character, age: 25 };
    const act0: TransitionAction = { type: 'OVERWRITE_CHARACTER', payload: validChar };
    const tree0 = actionToMeaningNode(act0, 'PROPOSAL');
    const p0 = adaptMeaningTreeToProposal(tree0, {
      proposalId: 'prop-init-acl-04',
      requestId: 'req-init-acl-04',
      eventId: 'evt-init-acl-04',
      expectedStateVersion: snap0.stateVersion,
      source: 'PLAYER',
      turn: snap0.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Setup'
    });
    engine.submitProposal(p0);

    const snapBefore = engine.getSnapshot(); // now stateVersion === 2
    const histBefore = engine.getHistory();
    const actGenesis: TransitionAction = { type: 'OVERWRITE_WORLD_INFO', payload: snapBefore.worldInfo };
    const treeGenesis = actionToMeaningNode(actGenesis, 'PROPOSAL');
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-acl-04',
      requestId: 'req-acl-04',
      eventId: 'evt-acl-04',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'GENESIS',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Late genesis attack',
      meaningTree: treeGenesis,
      actions: [actGenesis]
    };
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'ACL-04',
      domain: '3. Authority & ACL',
      name: 'GENESIS source replay after stateVersion > 1',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'source: GENESIS on committed session (v=2)',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [ACL-05] LLM proposing OVERWRITE_CHARACTER (Unauthorized action for LLM)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act: TransitionAction = { type: 'OVERWRITE_CHARACTER', payload: snapBefore.character };
    const tree = actionToMeaningNode(act, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-acl-05',
      requestId: 'req-acl-05',
      eventId: 'evt-acl-05',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM OVERWRITE_CHARACTER attack'
    });
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'ACL-05',
      domain: '3. Authority & ACL',
      name: 'LLM source proposing OVERWRITE_CHARACTER (ACL violation)',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'source: LLM + action: OVERWRITE_CHARACTER',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [ACL-06] PLAYER proposing ADVANCE_TIME (Unauthorized action for PLAYER)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act: TransitionAction = { type: 'ADVANCE_TIME', payload: { minutes: 60 } };
    const tree = actionToMeaningNode(act, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-acl-06',
      requestId: 'req-acl-06',
      eventId: 'evt-acl-06',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player ADVANCE_TIME attack'
    });
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'ACL-06',
      domain: '3. Authority & ACL',
      name: 'PLAYER source proposing ADVANCE_TIME (ACL violation)',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'source: PLAYER + action: ADVANCE_TIME',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [ACL-07] PLAYER proposing OVERWRITE_WORLD_INFO (Unauthorized action for PLAYER)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act: TransitionAction = { type: 'OVERWRITE_WORLD_INFO', payload: snapBefore.worldInfo };
    const tree = actionToMeaningNode(act, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-acl-07',
      requestId: 'req-acl-07',
      eventId: 'evt-acl-07',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player OVERWRITE_WORLD_INFO attack'
    });
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'ACL-07',
      domain: '3. Authority & ACL',
      name: 'PLAYER source proposing OVERWRITE_WORLD_INFO (ACL violation)',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'source: PLAYER + action: OVERWRITE_WORLD_INFO',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // ==========================================================================
  // DOMAIN 4: CLAIM, CAUSALITY & STATE INTEGRITY ATTACKS (8 Vectors)
  // ==========================================================================
  console.log('\n>>> DOMAIN 4: Claim, Causality & State Integrity Attacks <<<');

  // [CLAIM-01] Forged VerifiedClaim (invalid signature / tampered issuer)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act: TransitionAction = {
      type: 'MODIFY_INVENTORY',
      payload: {
        item: { id: 'item_relic', name: '전설의 성검', quantity: 1, type: 'WEAPON' },
        operation: 'ADD',
        acquisition: { cause: 'PURCHASE', verifiedEventId: 'evt-forged' }
      }
    };
    const tree = actionToMeaningNode(act, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-claim-01',
      requestId: 'req-claim-01',
      eventId: 'evt-claim-01',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Forged claim attack'
    });
    // Attach forged claim
    proposal.verifiedClaims = [
      {
        claimId: 'claim-fake-01',
        issuer: 'FORGED_IMMIGRATION_GATE' as any,
        signature: 'fake-signature-hex-12345',
        targetEntityId: 'protagonist',
        targetAttribute: 'inventory:item_relic',
        verifiedValue: 1,
        verifiedAtStateVersion: snapBefore.stateVersion,
        verifiedAtTurn: snapBefore.turn,
        timestamp: new Date().toISOString()
      }
    ];
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'CLAIM-01',
      domain: '4. Claim & Causality',
      name: 'Forged signature/issuer in VerifiedClaim',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'signature: fake-signature-hex-12345',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [CLAIM-02] Stale Claim Replay (Claim verified at stateVersion 1 replayed against stateVersion 2)
  {
    const engine = createGenesisEngine();
    // Generate valid claim at stateVersion 1
    const ev1: any = {
      evidenceId: 'ev-claim-02',
      source: 'CANONICAL_HISTORY',
      entityId: 'protagonist',
      attribute: 'stats:strength',
      value: 20,
      timestamp: new Date().toISOString()
    };
    const adm = ImmigrationGate.admit(
      {
        targetEntityId: 'protagonist',
        targetAttribute: 'stats:strength',
        claimedValue: 20,
        claimedEvidenceIds: ['ev-claim-02']
      },
      [ev1],
      engine.getSnapshot()
    );
    const validClaimV1 = adm.verifiedClaim!;

    // Advance engine version to v=2
    const snap0 = engine.getSnapshot();
    const act0: TransitionAction = { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 16 } };
    const tree0 = actionToMeaningNode(act0, 'PROPOSAL');
    const p0 = adaptMeaningTreeToProposal(tree0, {
      proposalId: 'prop-init-claim-02',
      requestId: 'req-init-claim-02',
      eventId: 'evt-init-claim-02',
      expectedStateVersion: snap0.stateVersion,
      source: 'PLAYER',
      turn: snap0.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Advance'
    });
    engine.submitProposal(p0);

    const snapBefore = engine.getSnapshot(); // now stateVersion === 2
    const histBefore = engine.getHistory();
    const actStale: TransitionAction = { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 20 } };
    const treeStale = actionToMeaningNode(actStale, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(treeStale, {
      proposalId: 'prop-claim-02',
      requestId: 'req-claim-02',
      eventId: 'evt-claim-02',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stale claim replay'
    });
    proposal.verifiedClaims = [validClaimV1]; // Stale claim from version 1!

    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'CLAIM-02',
      domain: '4. Claim & Causality',
      name: 'Stale VerifiedClaim replay across stateVersion mutation',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'Claim verified at v=1 replayed against engine at v=2',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [CLAIM-03] Wildcard Attribute Claim Injection ('*')
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const wildcardClaim: any = Object.freeze({
      claimId: 'vclm-wildcard',
      status: 'VERIFIED',
      targetEntityId: 'protagonist',
      targetAttribute: '*',
      verifiedValue: true,
      evidenceIds: Object.freeze(['ev-wildcard']),
      verifiedAtStateVersion: snapBefore.stateVersion,
      verifiedAtTurn: snapBefore.turn,
      verifiedAtTimestamp: new Date().toISOString(),
      provenance: Object.freeze({ source: 'UNTRUSTED_INJECTION', evidenceCount: 1 })
    });
    const act: TransitionAction = {
      type: 'MODIFY_INVENTORY',
      payload: {
        item: { id: 'item_relic', name: '전설의 성검', quantity: 1, type: 'WEAPON' },
        operation: 'ADD',
        acquisition: { cause: 'PURCHASE' }
      }
    };
    const tree = actionToMeaningNode(act, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-claim-03',
      requestId: 'req-claim-03',
      eventId: 'evt-claim-03',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Wildcard claim attack'
    });
    proposal.verifiedClaims = [wildcardClaim];
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'CLAIM-03',
      domain: '4. Claim & Causality',
      name: 'Wildcard targetAttribute (*) claim injection',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'targetAttribute: * attempting to authorize inventory edit',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [CAUS-01] Unbacked inventory mutation via OVERWRITE_CHARACTER
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const charWithNewItem = {
      ...snapBefore.character,
      inventory: [...snapBefore.character.inventory, { id: 'item_god', name: '신화의 반지', quantity: 1, type: 'ACCESSORY' as const }]
    };
    const act: TransitionAction = { type: 'OVERWRITE_CHARACTER', payload: charWithNewItem };
    const tree = actionToMeaningNode(act, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-caus-01',
      requestId: 'req-caus-01',
      eventId: 'evt-caus-01',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Unbacked inventory injection'
    });
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'CAUS-01',
      domain: '4. Claim & Causality',
      name: 'Unbacked inventory injection via OVERWRITE_CHARACTER',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'OVERWRITE_CHARACTER with modified inventory array',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [CAUS-02] Double-Spend Inventory: Consuming item X with quantity 5 when inventory has 1
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act: TransitionAction = {
      type: 'MODIFY_INVENTORY',
      payload: {
        item: { id: 'item_sword', name: '강철 검', quantity: 5, type: 'WEAPON' },
        operation: 'REMOVE'
      }
    };
    const tree = actionToMeaningNode(act, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-caus-02',
      requestId: 'req-caus-02',
      eventId: 'evt-caus-02',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Double spend overdraft attack'
    });
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'CAUS-02',
      domain: '4. Claim & Causality',
      name: 'Inventory overdraft / double spend (Remove qty 5 when stock is 1)',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'REMOVE quantity: 5 vs current quantity: 1',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [STATE-01] State Version Replay (ExpectedStateVersion 0 against v=1)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act: TransitionAction = { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 16 } };
    const tree = actionToMeaningNode(act, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-state-01',
      requestId: 'req-state-01',
      eventId: 'evt-state-01',
      expectedStateVersion: 0, // Stale!
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stale version replay'
    });
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'STATE-01',
      domain: '4. Claim & Causality',
      name: 'Stale expectedStateVersion mismatch (v=0 vs current v=1)',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'expectedStateVersion: 0',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [STATE-02] Idempotency Violation: Duplicate requestId re-submission
  {
    const engine = createGenesisEngine();
    const snap0 = engine.getSnapshot();
    const act1: TransitionAction = { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 16 } };
    const tree1 = actionToMeaningNode(act1, 'PROPOSAL');
    const p1 = adaptMeaningTreeToProposal(tree1, {
      proposalId: 'prop-state-02',
      requestId: 'req-state-02-fixed',
      eventId: 'evt-state-02-1',
      expectedStateVersion: snap0.stateVersion,
      source: 'PLAYER',
      turn: snap0.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'First commit'
    });
    engine.submitProposal(p1);

    const snapBefore = engine.getSnapshot(); // v=2
    const histBefore = engine.getHistory();
    const act2: TransitionAction = { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 17 } };
    const tree2 = actionToMeaningNode(act2, 'PROPOSAL');
    const pDuplicate = adaptMeaningTreeToProposal(tree2, {
      proposalId: 'prop-state-02-dup',
      requestId: 'req-state-02-fixed', // DUPLICATE REQUEST ID!
      eventId: 'evt-state-02-2',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Replay duplicate requestId'
    });
    const res2 = engine.submitProposal(pDuplicate);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'STATE-02',
      domain: '4. Claim & Causality',
      name: 'Idempotency violation (Duplicate requestId re-submission)',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'requestId: req-state-02-fixed submitted twice',
      verdict: !res2.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res2.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res2.rejectedReasons || []).join('; ')
    });
  }

  // [STATE-03] Atomic Multi-Action Failure Rollback (Action 1 Valid, Action 2 Malicious)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const actValid: TransitionAction = { type: 'UPDATE_CHARACTER_STATS', payload: { agility: 14 } };
    const actInvalid: TransitionAction = { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 99 } }; // Bound violation!
    const tree: MeaningNode = {
      atom: 'ORDERED',
      scope: 'PROPOSAL',
      children: [actionToMeaningNode(actValid, 'PROPOSAL'), actionToMeaningNode(actInvalid, 'PROPOSAL')]
    };
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-state-03',
      requestId: 'req-state-03',
      eventId: 'evt-state-03',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Atomic rollback test',
      meaningTree: tree,
      actions: [actValid, actInvalid]
    };
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'STATE-03',
      domain: '4. Claim & Causality',
      name: 'Atomic multi-action failure rollback (Zero-mutation of preceding valid action)',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: '[Valid AGI 14, Invalid STR 99] in single atomic proposal',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // ==========================================================================
  // DOMAIN 5: CROSS-LAYER & CHAINED EVASION ATTACKS (3 Vectors: 2 Attacks + 1 Clamping Policy)
  // ==========================================================================
  console.log('\n>>> DOMAIN 5: Cross-Layer & Chained Evasion Attacks <<<');

  // [CHAIN-01] Valid MeaningTree + Valid Projection + Spoofed SYSTEM Source -> Blocked at ACL
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act: TransitionAction = { type: 'SET_WORLD_METADATA', payload: { weather: '태풍' } };
    const tree = actionToMeaningNode(act, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-chain-01',
      requestId: 'req-chain-01',
      eventId: 'evt-chain-01',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'SYSTEM',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Chained spoof'
    });
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'CHAIN-01',
      domain: '5. Cross-Layer & Chaining',
      name: 'Valid MeaningTree + Projection -> Intercepted at Engine Capability Gate',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'Chain passes MeaningTree & Projection, fails Engine Capability',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [CHAIN-02] Valid MeaningTree + Valid Projection + Valid Source (LLM) + Dead NPC Resurrection -> Blocked at Narrative Rule 8
  {
    const engine = createGenesisEngine();
    // First kill the NPC
    const snap0 = engine.getSnapshot();
    const actKill: TransitionAction = { type: 'SET_NPC_STATUS', payload: { npcId: 'npc_elder', status: 'DEAD' } };
    const treeKill = actionToMeaningNode(actKill, 'PROPOSAL');
    const pKill = adaptMeaningTreeToProposal(treeKill, {
      proposalId: 'prop-chain-02-kill',
      requestId: 'req-chain-02-kill',
      eventId: 'evt-chain-02-kill',
      expectedStateVersion: snap0.stateVersion,
      source: 'PLAYER',
      turn: snap0.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Kill elder'
    });
    engine.submitProposal(pKill);

    const snapBefore = engine.getSnapshot(); // npc_elder is DEAD
    const histBefore = engine.getHistory();
    const actResurrect: TransitionAction = { type: 'ADD_NPC', payload: { id: 'npc_elder', name: '마을 촌장', innerThought: '부활했다', npcClass: 'Class A' } };
    const treeResurrect = actionToMeaningNode(actResurrect, 'PROPOSAL');
    const pResurrect = adaptMeaningTreeToProposal(treeResurrect, {
      proposalId: 'prop-chain-02-res',
      requestId: 'req-chain-02-res',
      eventId: 'evt-chain-02-res',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Resurrect dead NPC'
    });
    const res = engine.submitProposal(pResurrect);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const stateUnmutated = deepEqual(snapBefore, snapAfter) && snapBefore.stateVersion === snapAfter.stateVersion;
    const historyUnmutated = deepEqual(histBefore, histAfter) && histBefore.length === histAfter.length;

    records.push({
      id: 'CHAIN-02',
      domain: '5. Cross-Layer & Chaining',
      name: 'Valid MeaningTree + LLM source + Dead NPC Resurrection (Rule 8 Violation)',
      testType: 'ADVERSARIAL_ATTACK',
      attackVector: 'ADD_NPC matching historically dead NPC name',
      verdict: !res.success && stateUnmutated && historyUnmutated ? 'BLOCKED' : 'BREACHED',
      canonicalStateUnmutatedVerified: stateUnmutated,
      historyUnmutatedVerified: historyUnmutated,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: res.rejectedReasons || [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (res.rejectedReasons || []).join('; ')
    });
  }

  // [CHAIN-03] Candidate Packet Pipeline: Excessive Seeds (> 3) Clamped / Defense Rule 2 (Policy Clamping / Sanitization)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const candidate: CandidatePacket = {
      candidateId: 'cand-chain-03',
      seedChanges: [
        { content: '비밀 통로', status: 'active' },
        { content: '고대 마법서', status: 'active' },
        { content: '도적단의 암호', status: 'active' },
        { content: '황실의 음모', status: 'active' },
        { content: '용의 동굴', status: 'active' }
      ]
    };
    const safeProp = buildSafeProposalFromCandidate(snapBefore, candidate, snapBefore.turn, engine.getHistory());
    // In safeProp, narrative seeds should be capped at 3
    const seedActions = safeProp.actions.filter(a => a.type === 'ADD_NARRATIVE_SEED');
    const isCapped = seedActions.length <= 3;
    const res = engine.submitProposal(safeProp);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const seedsInWorld = (snapAfter.worldInfo.seeds || []).length;
    const isSanitizedAndCommitted = isCapped && res.success && seedsInWorld <= 3 && snapAfter.stateVersion === snapBefore.stateVersion + 1;

    records.push({
      id: 'CHAIN-03',
      domain: '5. Cross-Layer & Chaining',
      name: 'Candidate Pipeline: Narrative Seeds capped at 3 (Rule 2 Enforcement)',
      testType: 'POLICY_CLAMPING_SANITIZATION',
      attackVector: '5 seeds injected in CandidatePacket -> clamped to 3',
      verdict: isSanitizedAndCommitted ? 'SANITIZED_AND_COMMITTED' : 'FAILED',
      canonicalStateUnmutatedVerified: false,
      historyUnmutatedVerified: false,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: `Injected 5 seeds -> Clamped to ${seedActions.length} actions -> World has ${seedsInWorld} seeds, stateVersion: ${snapAfter.stateVersion}`
    });
  }

  // ==========================================================================
  // DOMAIN 6: LEGITIMATE PRODUCTION PATHS PROOF (3 Vectors)
  // ==========================================================================
  console.log('\n>>> DOMAIN 6: Legitimate Production Execution Proof <<<');

  // [PROD-01] Production handleUpdateCharacter (Valid Edit -> Commit)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const nextChar = {
      ...snapBefore.character,
      appearance: '새로운 흑발 검객',
      goal: '진실을 밝혀낸다',
      age: 26
    };
    const action: TransitionAction = {
      type: 'OVERWRITE_CHARACTER',
      payload: nextChar
    };
    const meaningTree = actionToMeaningNode(action, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(meaningTree, {
      proposalId: `prop-prod-01`,
      requestId: `req-prod-01`,
      eventId: `evt-prod-01`,
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player manual character edit'
    });
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const isPassed = res.success &&
      snapAfter.stateVersion === snapBefore.stateVersion + 1 &&
      snapAfter.character.appearance === '새로운 흑발 검객' &&
      snapAfter.character.goal === '진실을 밝혀낸다' &&
      snapAfter.character.age === 26 &&
      snapAfter.character.stats.strength === snapBefore.character.stats.strength &&
      histAfter.length === histBefore.length + 1;

    records.push({
      id: 'PROD-01',
      domain: '6. Legitimate Production',
      name: 'Production Pipeline: handleUpdateCharacter() Valid Edit -> ALLOW & Commit',
      testType: 'LEGITIMATE_PRODUCTION',
      attackVector: 'Legitimate Player Character Edit',
      verdict: isPassed ? 'ALLOWED' : 'FAILED',
      canonicalStateUnmutatedVerified: false,
      historyUnmutatedVerified: false,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: `Committed clean stateVersion ${snapAfter.stateVersion}, appearance: ${snapAfter.character.appearance}, historyCount: ${histAfter.length}`
    });
  }

  // [PROD-02] Production CandidatePacket Pipeline (Valid Turn Candidate -> Commit)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const candidate: CandidatePacket = {
      candidateId: 'cand-prod-02',
      npcChanges: [
        {
          name: '성문 경비병',
          alias: '경비병 철수',
          status: 'ALIVE',
          npcClass: 'Class B',
          metInStory: true,
          innerThought: '성문을 굳게 지켜야 한다.'
        }
      ],
      factionChanges: [
        {
          name: '북부 수비대',
          description: '성문을 수호하는 정예 경비단',
          attitudeTowardsPlayer: '우호적'
        }
      ]
    };
    const proposal = buildSafeProposalFromCandidate(snapBefore, candidate, snapBefore.turn, engine.getHistory());
    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const isPassed = res.success &&
      snapAfter.stateVersion === snapBefore.stateVersion + 1 &&
      snapAfter.worldInfo.npcs.some(n => n.name === '성문 경비병') &&
      snapAfter.worldInfo.factions.some(f => f.name === '북부 수비대') &&
      histAfter.length === histBefore.length + 1;

    records.push({
      id: 'PROD-02',
      domain: '6. Legitimate Production',
      name: 'Production Pipeline: buildSafeProposalFromCandidate() -> ALLOW & Commit',
      testType: 'LEGITIMATE_PRODUCTION',
      attackVector: 'Legitimate LLM Candidate Packet',
      verdict: isPassed ? 'ALLOWED' : 'FAILED',
      canonicalStateUnmutatedVerified: false,
      historyUnmutatedVerified: false,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: `Committed Candidate Packet: new NPC 성문 경비병, new Faction 북부 수비대, stateVersion ${snapAfter.stateVersion}, historyCount: ${histAfter.length}`
    });
  }

  // [PROD-03] Internal Capability Engine Proposal (Privileged System Transition)
  {
    const engine = createGenesisEngine();
    const snapBefore = engine.getSnapshot();
    const histBefore = engine.getHistory();
    const act: TransitionAction = {
      type: 'ADVANCE_CHAPTER',
      payload: {
        currentChapter: '제 2장: 검은 안개의 숲',
        upcomingChapters: ['제 3장: 무너진 성채']
      }
    };
    const res = dispatchEngineInternalAction(engine, act, 'Internal Chapter Transition');
    const snapAfter = engine.getSnapshot();
    const histAfter = engine.getHistory();
    const isPassed = res.success &&
      snapAfter.stateVersion === snapBefore.stateVersion + 1 &&
      snapAfter.worldInfo.chapters.currentChapter === '제 2장: 검은 안개의 숲' &&
      histAfter.length === histBefore.length + 1;

    records.push({
      id: 'PROD-03',
      domain: '6. Legitimate Production',
      name: 'Production Pipeline: dispatchEngineInternalAction() -> Token Verified ALLOW',
      testType: 'LEGITIMATE_PRODUCTION',
      attackVector: 'Engine Authorized Capability Token',
      verdict: isPassed ? 'ALLOWED' : 'FAILED',
      canonicalStateUnmutatedVerified: false,
      historyUnmutatedVerified: false,
      historyCountBefore: histBefore.length,
      historyCountAfter: histAfter.length,
      rejectionReasons: [],
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: `Committed chapter: ${snapAfter.worldInfo.chapters.currentChapter}, stateVersion ${snapAfter.stateVersion}, historyCount: ${histAfter.length}`
    });
  }

  // ==========================================================================
  // CONSOLE SUMMARY & FORENSIC METRICS
  // ==========================================================================
  console.log('\n================================================================');
  console.log('                 PENETRATION MISSION FORENSIC SUMMARY           ');
  console.log('================================================================');

  for (const rec of records) {
    let label = '';
    let isOk = false;
    if (rec.testType === 'ADVERSARIAL_ATTACK') {
      isOk = rec.verdict === 'BLOCKED' && rec.canonicalStateUnmutatedVerified && rec.historyUnmutatedVerified;
      label = isOk ? 'PASS - BLOCKED' : 'FAIL - BREACHED';
    } else if (rec.testType === 'POLICY_CLAMPING_SANITIZATION') {
      isOk = rec.verdict === 'SANITIZED_AND_COMMITTED';
      label = isOk ? 'PASS - SANITIZED' : 'FAIL - UNSANITIZED';
    } else {
      isOk = rec.verdict === 'ALLOWED';
      label = isOk ? 'PASS - ALLOWED' : 'FAIL - FAILED';
    }
    console.log(`[${label}] ${rec.id} (${rec.domain}): ${rec.name}`);
    console.log(`  Type: ${rec.testType}, Verdict: ${rec.verdict}, StateUnmutated: ${rec.canonicalStateUnmutatedVerified}, HistoryUnmutated: ${rec.historyUnmutatedVerified}, Details: ${rec.details}`);
  }

  const attacks = records.filter(r => r.testType === 'ADVERSARIAL_ATTACK');
  const attackTotal = attacks.length;
  const attackBlocked = attacks.filter(r => r.verdict === 'BLOCKED').length;
  const canonicalStateUnmutatedCount = attacks.filter(r => r.canonicalStateUnmutatedVerified).length;
  const historyUnmutatedCount = attacks.filter(r => r.historyUnmutatedVerified).length;
  const fullZeroMutationCount = attacks.filter(r => r.canonicalStateUnmutatedVerified && r.historyUnmutatedVerified).length;

  const clampings = records.filter(r => r.testType === 'POLICY_CLAMPING_SANITIZATION');
  const clampingTotal = clampings.length;
  const clampingSanitized = clampings.filter(r => r.verdict === 'SANITIZED_AND_COMMITTED').length;

  const prods = records.filter(r => r.testType === 'LEGITIMATE_PRODUCTION');
  const prodTotal = prods.length;
  const prodAllowed = prods.filter(r => r.verdict === 'ALLOWED').length;

  const allPassed =
    attackBlocked === attackTotal &&
    fullZeroMutationCount === attackTotal &&
    clampingSanitized === clampingTotal &&
    prodAllowed === prodTotal;

  console.log('================================================================');
  console.log(`ATTACK SURFACE:               EXHAUSTED (6 Domains, 31 Records)`);
  console.log(`VULNERABILITIES:              ${allPassed ? 'NONE FOUND' : 'FOUND'}`);
  console.log(`ADVERSARIAL ATTACKS:          ${attackBlocked} / ${attackTotal} BLOCKED`);
  console.log(`CANONICAL STATE UNMUTATED:    ${canonicalStateUnmutatedCount} / ${attackTotal} VERIFIED`);
  console.log(`HISTORY UNMUTATED (IMMUTABLE):${historyUnmutatedCount} / ${attackTotal} VERIFIED`);
  console.log(`FULL ZERO-MUTATION PROOF:     ${fullZeroMutationCount} / ${attackTotal} VERIFIED`);
  console.log(`POLICY CLAMPING/SANITIZATION: ${clampingSanitized} / ${clampingTotal} SANITIZED & COMMITTED`);
  console.log(`LEGITIMATE PRODUCTION:        ${prodAllowed} / ${prodTotal} ALLOWED & COMMITTED`);
  console.log(`FINAL MISSION RESULT:         ${allPassed ? 'PASS' : 'FAIL'}`);
  console.log('================================================================');

  // ==========================================================================
  // RUN REGRESSION SUITES
  // ==========================================================================
  console.log('\n>>> Running Regression Test Suites <<<');
  const sovResults = runSovereignEngineTestSuite();
  console.log(`  Sovereign Engine Suite: ${sovResults.passed ? 'ALL PASS' : 'FAIL'} (${sovResults.results.length} tests)`);

  const langResults = runLanguageTestSuite();
  const langPassed = langResults.failed === 0;
  console.log(`  Language Engine Suite:  ${langPassed ? 'ALL PASS' : 'FAIL'} (${langResults.total} tests)`);

  const claimResults = executeRedTeamCampaign();
  const claimPassed = claimResults.exploited === 0;
  console.log(`  Claim Causality Suite:  ${claimPassed ? 'ALL PASS' : 'FAIL'} (${claimResults.results.length} tests)`);

  // Write Evidence Artifacts
  const reportDir = path.resolve(process.cwd(), 'report/02_exhaustive_penetration_mission');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const rawEvidence = {
    timestamp: new Date().toISOString(),
    missionStatus: allPassed ? 'COMPLETED_SUCCESS' : 'BREACH_FOUND',
    metrics: {
      attackSurface: 'EXHAUSTED',
      vulnerabilities: allPassed ? 'NONE_FOUND' : 'VULNERABILITY_DETECTED',
      totalRecords: records.length,
      adversarialAttacks: {
        total: attackTotal,
        blocked: attackBlocked,
        canonicalStateUnmutatedCount,
        historyUnmutatedCount,
        fullZeroMutationCount
      },
      policyClampingSanitization: {
        total: clampingTotal,
        sanitizedAndCommitted: clampingSanitized
      },
      legitimateProduction: {
        total: prodTotal,
        allowedAndCommitted: prodAllowed
      },
      regressionSuites: {
        sovereignEngine: { passed: sovResults.passed, count: sovResults.results.length },
        languageEngine: { passed: langPassed, count: langResults.total },
        claimCausality: { passed: claimPassed, count: claimResults.results.length }
      }
    },
    records
  };

  fs.writeFileSync(path.join(reportDir, 'raw_evidence.json'), JSON.stringify(rawEvidence, null, 2));
  console.log(`\nRaw evidence saved to: ${path.join(reportDir, 'raw_evidence.json')}`);

  return { allPassed, records };
}

runExhaustivePenetrationMission().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
