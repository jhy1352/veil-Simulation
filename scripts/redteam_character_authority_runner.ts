import { SovereignEngine } from '../src/engine/state';
import { StateTransitionProposal, TransitionAction, Character } from '../src/engine/types';
import { actionToMeaningNode, adaptMeaningTreeToProposal } from '../src/engine/language';
import { MeaningNode } from '../src/engine/language/types';
import * as fs from 'fs';
import * as path from 'path';

type TestType = 'ATTACK' | 'LEGITIMATE_PRODUCTION' | 'MALICIOUS_PRODUCTION';
type Verdict = 'BLOCKED' | 'BREACHED' | 'ALLOWED' | 'FAILED' | 'ERROR';

interface AttackRecord {
  id: string;
  name: string;
  testType: TestType;
  category: string;
  verdict: Verdict;
  reasons: string[];
  zeroMutationVerified: boolean;
  stateVersionBefore: number;
  stateVersionAfter: number;
  details: string;
}

const attackRecords: AttackRecord[] = [];

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

console.log('================================================================');
console.log('  VEIL — Character MeaningTree Authority RED TEAM RUNNER');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// [2] PROOF-11: Missing / Undefined / Invalid MeaningTree Attack
// -----------------------------------------------------------------------------
console.log('--- [ATTACK SECTION 2: Missing MeaningTree Attacks] ---');

function testMissingTreeAttacks() {
  const engine = new SovereignEngine();
  const snapBefore = deepClone(engine.getSnapshot());

  // 2.1: meaningTree is undefined
  {
    const attackProposal: StateTransitionProposal = {
      proposalId: `prop-attack-missing-tree-1-${Date.now()}`,
      requestId: `req-attack-missing-tree-1-${Date.now()}`,
      eventId: `evt-attack-missing-tree-1-${Date.now()}`,
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Missing tree injection attack',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: { ...snapBefore.character, name: 'HACKED_NAME' }
        }
      ]
    }; // meaningTree is missing

    const res = engine.submitProposal(attackProposal);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'ATK-MISSING-01',
      name: 'Missing meaningTree undefined on PLAYER OVERWRITE_CHARACTER',
      testType: 'ATTACK',
      category: 'Missing MeaningTree',
      verdict: !res.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: res.rejectedReasons,
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: res.rejectedReasons.join('; ')
    });
  }

  // 2.2: meaningTree is null / empty object / invalid grammar
  {
    const attackProposal: any = {
      proposalId: `prop-attack-invalid-tree-2-${Date.now()}`,
      requestId: `req-attack-invalid-tree-2-${Date.now()}`,
      eventId: `evt-attack-invalid-tree-2-${Date.now()}`,
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Invalid grammar tree attack',
      meaningTree: { atom: 'INVALID_ATOM', scope: 'INVALID', value: 123 },
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: { ...snapBefore.character, name: 'HACKED_NAME_2' }
        }
      ]
    };

    const res = engine.submitProposal(attackProposal);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'ATK-MISSING-02',
      name: 'Invalid Grammar MeaningNode on OVERWRITE_CHARACTER',
      testType: 'ATTACK',
      category: 'Missing MeaningTree',
      verdict: !res.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: res.rejectedReasons,
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: res.rejectedReasons.join('; ')
    });
  }
}
testMissingTreeAttacks();

// -----------------------------------------------------------------------------
// [3] Projection Tampering Attack
// -----------------------------------------------------------------------------
console.log('\n--- [ATTACK SECTION 3: Projection Tampering Attacks] ---');

function testProjectionTamperingAttacks() {
  const engine = new SovereignEngine();
  const snapBefore = deepClone(engine.getSnapshot());

  const legitimateChar: Character = {
    ...snapBefore.character,
    stats: { ...snapBefore.character.stats, strength: 18 }
  };
  const legitimateAction: TransitionAction = {
    type: 'OVERWRITE_CHARACTER',
    payload: legitimateChar
  };
  const baseTree = actionToMeaningNode(legitimateAction, 'PROPOSAL');

  // 3.1 Action Type Mismatch (Tree has OVERWRITE_CHARACTER, actions has OVERWRITE_WORLD_INFO)
  {
    const tamperedProposal = adaptMeaningTreeToProposal(baseTree, {
      proposalId: 'prop-tamper-type',
      requestId: 'req-tamper-type',
      eventId: 'evt-tamper-type',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Tampered action type'
    });
    // Maliciously tamper actions
    (tamperedProposal as any).actions = [
      {
        type: 'OVERWRITE_WORLD_INFO',
        payload: { ...snapBefore.worldInfo, realmName: 'TAMPERED_REALM' }
      }
    ];

    const res = engine.submitProposal(tamperedProposal);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'ATK-TAMPER-01',
      name: 'Action type mismatch (OVERWRITE_CHARACTER -> OVERWRITE_WORLD_INFO)',
      testType: 'ATTACK',
      category: 'Projection Tampering',
      verdict: !res.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: res.rejectedReasons,
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: res.rejectedReasons.join('; ')
    });
  }

  // 3.2 Payload stat tampering (Tree has STR 18, actions has STR 29)
  {
    const tamperedProposal = adaptMeaningTreeToProposal(baseTree, {
      proposalId: 'prop-tamper-payload',
      requestId: 'req-tamper-payload',
      eventId: 'evt-tamper-payload',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Tampered stat payload'
    });
    (tamperedProposal as any).actions = [
      {
        type: 'OVERWRITE_CHARACTER',
        payload: {
          ...legitimateChar,
          stats: { ...legitimateChar.stats, strength: 29 }
        }
      }
    ];

    const res = engine.submitProposal(tamperedProposal);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'ATK-TAMPER-02',
      name: 'Payload stat value tampering (Tree STR 18 vs Action STR 29)',
      testType: 'ATTACK',
      category: 'Projection Tampering',
      verdict: !res.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: res.rejectedReasons,
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: res.rejectedReasons.join('; ')
    });
  }

  // 3.3 Injected extra action in actions[]
  {
    const tamperedProposal = adaptMeaningTreeToProposal(baseTree, {
      proposalId: 'prop-tamper-extra',
      requestId: 'req-tamper-extra',
      eventId: 'evt-tamper-extra',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Injected extra action'
    });
    (tamperedProposal as any).actions = [
      ...tamperedProposal.actions,
      {
        type: 'ADD_INVENTORY_ITEM',
        payload: {
          item: { id: 'hacked-sword', name: '치트검', quantity: 1, type: 'WEAPON', description: '치트', acquiredAt: 'T1' },
          acquisitionCause: { causeType: 'DISCOVERY_PICKUP', verifiedEventId: 'evt-fake' }
        }
      }
    ];

    const res = engine.submitProposal(tamperedProposal);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'ATK-TAMPER-03',
      name: 'Injected extra action into actions array',
      testType: 'ATTACK',
      category: 'Projection Tampering',
      verdict: !res.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: res.rejectedReasons,
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: res.rejectedReasons.join('; ')
    });
  }

  // 3.4 Deleted action (Empty actions[] when Tree has action)
  {
    const tamperedProposal = adaptMeaningTreeToProposal(baseTree, {
      proposalId: 'prop-tamper-empty',
      requestId: 'req-tamper-empty',
      eventId: 'evt-tamper-empty',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Empty actions array'
    });
    (tamperedProposal as any).actions = [];

    const res = engine.submitProposal(tamperedProposal);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'ATK-TAMPER-04',
      name: 'Deleted actions (empty actions[] with non-empty MeaningTree)',
      testType: 'ATTACK',
      category: 'Projection Tampering',
      verdict: !res.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: res.rejectedReasons,
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: res.rejectedReasons.join('; ')
    });
  }

  // 3.5 Action order reversal (ORDERED composition)
  {
    const act1: TransitionAction = { type: 'OVERWRITE_CHARACTER', payload: legitimateChar };
    const act2: TransitionAction = { type: 'RECORD_PLAYER_CHOICE', payload: { choiceText: '공격', timestamp: 'T1' } };
    const orderedTree: MeaningNode = {
      atom: 'INTENT',
      scope: 'PROPOSAL',
      composition: 'ORDERED',
      value: 'Ordered actions',
      children: [actionToMeaningNode(act1, 'PROPOSAL'), actionToMeaningNode(act2, 'PROPOSAL')]
    };
    const tamperedProposal = adaptMeaningTreeToProposal(orderedTree, {
      proposalId: 'prop-tamper-order',
      requestId: 'req-tamper-order',
      eventId: 'evt-tamper-order',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Reversed order attack'
    });
    (tamperedProposal as any).actions = [act2, act1]; // Reverse order

    const res = engine.submitProposal(tamperedProposal);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'ATK-TAMPER-05',
      name: 'ORDERED composition actions order reversed',
      testType: 'ATTACK',
      category: 'Projection Tampering',
      verdict: !res.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: res.rejectedReasons,
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: res.rejectedReasons.join('; ')
    });
  }

  // 3.6 Completely unrelated action
  {
    const tamperedProposal = adaptMeaningTreeToProposal(baseTree, {
      proposalId: 'prop-tamper-unrelated',
      requestId: 'req-tamper-unrelated',
      eventId: 'evt-tamper-unrelated',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Unrelated action attack'
    });
    (tamperedProposal as any).actions = [
      {
        type: 'RECORD_DICE_RESULT',
        payload: {
          rollId: 'roll-cheat',
          diceFormula: '1d20',
          rollValue: 20,
          targetDC: 10,
          outcome: 'SUCCESS',
          reason: '치트 주사위',
          timestamp: 'T1'
        }
      }
    ];

    const res = engine.submitProposal(tamperedProposal);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'ATK-TAMPER-06',
      name: 'Completely unrelated action injected (RECORD_DICE_RESULT)',
      testType: 'ATTACK',
      category: 'Projection Tampering',
      verdict: !res.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: res.rejectedReasons,
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: res.rejectedReasons.join('; ')
    });
  }
}
testProjectionTamperingAttacks();

// -----------------------------------------------------------------------------
// [4] Layer-Penetration Red Team (Valid Tree + Projection, attacking other layers)
// -----------------------------------------------------------------------------
console.log('\n--- [ATTACK SECTION 4: Layer-Penetration Red Team] ---');

function testLayerPenetrationAttacks() {
  const engine = new SovereignEngine();
  const snapBefore = deepClone(engine.getSnapshot());

  // 4.1 Authority Attack: LLM source proposing OVERWRITE_CHARACTER
  {
    const attackAction: TransitionAction = {
      type: 'OVERWRITE_CHARACTER',
      payload: { ...snapBefore.character, name: 'LLM_MUTATED' }
    };
    const tree = actionToMeaningNode(attackAction, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-layer-auth',
      requestId: 'req-layer-auth',
      eventId: 'evt-layer-auth',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM', // Unauthorized source for OVERWRITE_CHARACTER
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'LLM unauthorized character overwrite'
    });

    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'ATK-LAYER-01',
      name: 'Authority Layer: LLM source proposing OVERWRITE_CHARACTER',
      testType: 'ATTACK',
      category: 'Layer-Penetration',
      verdict: !res.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: res.rejectedReasons,
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: res.rejectedReasons.join('; ')
    });
  }

  // 4.2 Claim Attack: Unbacked claim / Wildcard claim
  {
    const attackAction: TransitionAction = {
      type: 'OVERWRITE_CHARACTER',
      payload: { ...snapBefore.character, age: 25 }
    };
    const tree = actionToMeaningNode(attackAction, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-layer-claim',
      requestId: 'req-layer-claim',
      eventId: 'evt-layer-claim',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Wildcard claim attack'
    });
    (proposal as any).verifiedClaims = [
      {
        claimId: 'claim-fake',
        claimType: 'EXISTENCE',
        targetEntityId: '*',
        attribute: '*',
        claimedValue: 'anything',
        groundingEventId: 'evt-fake',
        confidence: 1.0,
        source: 'PLAYER'
      }
    ];

    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'ATK-LAYER-02',
      name: 'Claim Layer: Wildcard claim injection (*)',
      testType: 'ATTACK',
      category: 'Layer-Penetration',
      verdict: !res.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: res.rejectedReasons,
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: res.rejectedReasons.join('; ')
    });
  }

  // 4.3 Causality Attack: Unbacked inventory injection via character OVERWRITE
  {
    const attackAction: TransitionAction = {
      type: 'OVERWRITE_CHARACTER',
      payload: {
        ...snapBefore.character,
        inventory: [
          ...snapBefore.character.inventory,
          { id: 'item-unbacked-cheat', name: '치트검', quantity: 1, type: 'WEAPON', description: '치트', acquiredAt: 'T1' }
        ]
      }
    };
    const tree = actionToMeaningNode(attackAction, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-layer-causality',
      requestId: 'req-layer-causality',
      eventId: 'evt-layer-causality',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Unbacked inventory injection'
    });

    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'ATK-LAYER-03',
      name: 'Causality Layer: Unbacked inventory injection via OVERWRITE_CHARACTER',
      testType: 'ATTACK',
      category: 'Layer-Penetration',
      verdict: !res.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: res.rejectedReasons,
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: res.rejectedReasons.join('; ')
    });
  }

  // 4.4 Mutation Layer: Stat outside 1-30 (STR 99)
  {
    const attackAction: TransitionAction = {
      type: 'OVERWRITE_CHARACTER',
      payload: {
        ...snapBefore.character,
        stats: { ...snapBefore.character.stats, strength: 99 }
      }
    };
    const tree = actionToMeaningNode(attackAction, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-layer-stat-bounds',
      requestId: 'req-layer-stat-bounds',
      eventId: 'evt-layer-stat-bounds',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stat overflow attack'
    });

    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'ATK-LAYER-04',
      name: 'Mutation Layer: Stat bounds violation (STR 99 > 30)',
      testType: 'ATTACK',
      category: 'Layer-Penetration',
      verdict: !res.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: res.rejectedReasons,
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: res.rejectedReasons.join('; ')
    });
  }

  // 4.5 State Integrity Layer: Stale stateVersion
  {
    const attackAction: TransitionAction = {
      type: 'OVERWRITE_CHARACTER',
      payload: { ...snapBefore.character, alias: '풍운검객' }
    };
    const tree = actionToMeaningNode(attackAction, 'PROPOSAL');
    const proposal = adaptMeaningTreeToProposal(tree, {
      proposalId: 'prop-layer-stale-version',
      requestId: 'req-layer-stale-version',
      eventId: 'evt-layer-stale-version',
      expectedStateVersion: snapBefore.stateVersion - 1, // Stale version
      source: 'PLAYER',
      turn: snapBefore.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stale state version attack'
    });

    const res = engine.submitProposal(proposal);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'ATK-LAYER-05',
      name: 'State Integrity Layer: Stale expectedStateVersion mismatch',
      testType: 'ATTACK',
      category: 'Layer-Penetration',
      verdict: !res.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: res.rejectedReasons,
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: res.rejectedReasons.join('; ')
    });
  }
}
testLayerPenetrationAttacks();

// -----------------------------------------------------------------------------
// [6] Independent Production Authority Proof
// -----------------------------------------------------------------------------
console.log('\n--- [ATTACK SECTION 6: Independent Production Authority Proof] ---');

function testProductionHandlerPipeline() {
  const engine = new SovereignEngine();
  const snap0 = engine.getSnapshot();

  // Emulate App.tsx handleUpdateCharacter function exactly
  function appHandleUpdateCharacter(partial: Partial<Character>, isPlaying: boolean): { success: boolean; character?: Character; rejectedReasons?: string[] } {
    if (isPlaying && engine) {
      const snap = engine.getSnapshot();
      const nextChar = { ...snap.character, ...partial };
      const action: TransitionAction = {
        type: 'OVERWRITE_CHARACTER',
        payload: nextChar
      };
      const meaningTree = actionToMeaningNode(action, 'PROPOSAL');
      const proposal = adaptMeaningTreeToProposal(meaningTree, {
        proposalId: `prop-player-char-${Date.now()}`,
        requestId: `req-player-char-${Date.now()}`,
        eventId: `evt-player-char-${Date.now()}`,
        expectedStateVersion: snap.stateVersion,
        source: 'PLAYER',
        turn: snap.turn,
        timestamp: new Date().toISOString(),
        intentSummary: 'Player manual character edit'
      });
      const res = engine.submitProposal(proposal);
      if (res.success) {
        return { success: true, character: res.snapshot.character };
      }
      return { success: false, rejectedReasons: res.rejectedReasons };
    }
    return { success: false, rejectedReasons: ['Not in playing state'] };
  }

  // 6.1 Legitimate Character update through Production Handler
  {
    const updateResult = appHandleUpdateCharacter({ appearance: '눈빛이 매서운 중년 검객', goal: '복수를 완수한다', age: 24 }, true);
    const snap1 = engine.getSnapshot();
    const passed = updateResult.success && snap1.character.appearance === '눈빛이 매서운 중년 검객' && snap1.character.goal === '복수를 완수한다' && snap1.character.age === 24 && snap1.stateVersion === snap0.stateVersion + 1;

    attackRecords.push({
      id: 'PROD-AUTH-01',
      name: 'Production Pipeline: Valid Character Update -> ALLOW & Commit',
      testType: 'LEGITIMATE_PRODUCTION',
      category: 'Production Proof',
      verdict: passed ? 'ALLOWED' : 'FAILED',
      reasons: [],
      zeroMutationVerified: false,
      stateVersionBefore: snap0.stateVersion,
      stateVersionAfter: snap1.stateVersion,
      details: `Committed appearance: ${snap1.character.appearance}, goal: ${snap1.character.goal}, age: ${snap1.character.age}, stateVersion: ${snap1.stateVersion}`
    });
  }

  // 6.2 Malicious injection through partial: illegal stat value (e.g. 99)
  {
    const snapBefore = deepClone(engine.getSnapshot());
    const updateResult = appHandleUpdateCharacter({ stats: { ...snapBefore.character.stats, agility: 99 } }, true);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'PROD-AUTH-02',
      name: 'Production Pipeline: Malicious Stat (AGI 99) via partial -> REJECTED & Zero Mutation',
      testType: 'MALICIOUS_PRODUCTION',
      category: 'Production Proof',
      verdict: !updateResult.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: updateResult.rejectedReasons || [],
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (updateResult.rejectedReasons || []).join('; ')
    });
  }

  // 6.3 Malicious injection through partial: unbacked inventory item
  {
    const snapBefore = deepClone(engine.getSnapshot());
    const fakeItem = { id: 'cheat-dagger', name: '암살단도', quantity: 1, type: 'WEAPON', description: '치트단도', acquiredAt: 'T1' };
    const updateResult = appHandleUpdateCharacter({ inventory: [...snapBefore.character.inventory, fakeItem as any] }, true);
    const snapAfter = engine.getSnapshot();
    const zeroMut = deepEqual(snapBefore, snapAfter);

    attackRecords.push({
      id: 'PROD-AUTH-03',
      name: 'Production Pipeline: Unbacked Inventory injection via partial -> REJECTED & Zero Mutation',
      testType: 'MALICIOUS_PRODUCTION',
      category: 'Production Proof',
      verdict: !updateResult.success && zeroMut ? 'BLOCKED' : 'BREACHED',
      reasons: updateResult.rejectedReasons || [],
      zeroMutationVerified: zeroMut,
      stateVersionBefore: snapBefore.stateVersion,
      stateVersionAfter: snapAfter.stateVersion,
      details: (updateResult.rejectedReasons || []).join('; ')
    });
  }
}
testProductionHandlerPipeline();

// Output summary
console.log('\n================================================================');
console.log('                 RED TEAM EXECUTION RESULTS                     ');
console.log('================================================================');

for (const rec of attackRecords) {
  let isOk = false;
  let label = '';
  if (rec.testType === 'ATTACK') {
    isOk = rec.verdict === 'BLOCKED' && rec.zeroMutationVerified;
    label = isOk ? 'PASS - ATTACK BLOCKED' : 'FAIL - ATTACK BREACHED';
  } else if (rec.testType === 'LEGITIMATE_PRODUCTION') {
    isOk = rec.verdict === 'ALLOWED';
    label = isOk ? 'PASS - LEGITIMATE ALLOWED' : 'FAIL - LEGITIMATE FAILED';
  } else if (rec.testType === 'MALICIOUS_PRODUCTION') {
    isOk = rec.verdict === 'BLOCKED' && rec.zeroMutationVerified;
    label = isOk ? 'PASS - MALICIOUS BLOCKED' : 'FAIL - MALICIOUS BREACHED';
  }
  console.log(`[${label}] ${rec.id} (${rec.category}): ${rec.name}`);
  console.log(`  Type: ${rec.testType}, Verdict: ${rec.verdict}, ZeroMutation: ${rec.zeroMutationVerified}, Details: ${rec.details}`);
}

const attackTotal = attackRecords.filter(r => r.testType === 'ATTACK').length;
const attackBlocked = attackRecords.filter(r => r.testType === 'ATTACK' && r.verdict === 'BLOCKED' && r.zeroMutationVerified).length;

const legitTotal = attackRecords.filter(r => r.testType === 'LEGITIMATE_PRODUCTION').length;
const legitAllowed = attackRecords.filter(r => r.testType === 'LEGITIMATE_PRODUCTION' && r.verdict === 'ALLOWED').length;

const malTotal = attackRecords.filter(r => r.testType === 'MALICIOUS_PRODUCTION').length;
const malBlocked = attackRecords.filter(r => r.testType === 'MALICIOUS_PRODUCTION' && r.verdict === 'BLOCKED' && r.zeroMutationVerified).length;

const allPassed = (attackBlocked === attackTotal) && (legitAllowed === legitTotal) && (malBlocked === malTotal);

console.log('================================================================');
console.log('SUMMARY:');
console.log(`  Attacks:               ${attackBlocked}/${attackTotal} BLOCKED`);
console.log(`  Legitimate Production: ${legitAllowed}/${legitTotal} ALLOWED + COMMIT`);
console.log(`  Malicious Production:  ${malBlocked}/${malTotal} BLOCKED + ZERO MUTATION`);
console.log('================================================================');
console.log(`Final Status: ${allPassed ? 'ALL DEFENSE BOUNDARIES INTACT' : 'DEFENSE FAILURE DETECTED'}`);
console.log('================================================================');

// Save raw evidence to report folder
const reportDir = path.resolve(process.cwd(), 'report/01_character_authority_redteam');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}
const reportPath = path.join(reportDir, 'raw_attack_evidence.json');
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      summary: {
        attacks: { total: attackTotal, blocked: attackBlocked, breached: attackTotal - attackBlocked },
        legitimateProduction: { total: legitTotal, allowed: legitAllowed, failed: legitTotal - legitAllowed },
        maliciousProduction: { total: malTotal, blocked: malBlocked, breached: malTotal - malBlocked },
        allPassed
      },
      records: attackRecords
    },
    null,
    2
  )
);
console.log(`Raw evidence written to: ${reportPath}`);
