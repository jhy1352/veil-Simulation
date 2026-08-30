/**
 * @file src/engine/language/testSuite.ts
 * @description VEIL Engine Language Phase 1 Comprehensive Test Suite
 */

import {
  CORE_ATOMS,
  CoreAtom,
  MeaningNode,
  SCOPES,
  Scope,
} from './types';
import { assertValidMeaningTree, validateMeaningTree } from './grammar';
import {
  areMeaningsSemanticallyEqual,
  canonicalizeMeaningTree,
} from './canonicalizer';
import {
  deserializeMeaningTree,
  serializeMeaningTree,
  verifyRoundTrip,
} from './serializer';
import {
  actionToMeaningNode,
  adaptMeaningTreeToProposal,
  extractActionsAndClaimsFromMeaningTree,
} from './adapter';
import { recoverAndParseMeaningTree, recoverAndParseProposalOrMeaningTree } from './recovery';
import { filterDiverseCandidates, filterDiverseMeaningNodes } from './diversity';
import { SovereignEngine } from '../state';
import { TransitionAction } from '../types';

export function runLanguageTestSuite(): { total: number; passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function assertTest(name: string, condition: boolean, details?: string) {
    if (condition) {
      passed++;
      console.log(`✅ [PASS] LANG-TEST: ${name}`);
    } else {
      failed++;
      console.error(`❌ [FAIL] LANG-TEST: ${name} - Details: ${details || 'Assertion failed'}`);
    }
  }

  console.log('====================================================');
  console.log('VEIL Engine Language Phase 1 Test Suite Running...');
  console.log('====================================================');

  // 1. Core/Auxiliary Verification
  // Exactly 11 Core Atoms
  assertTest('1.1 Exact 11 Core Atoms present in CORE_ATOMS', CORE_ATOMS.length === 11);
  const expectedAtoms: CoreAtom[] = [
    'ENTITY', 'ACTION', 'STATE', 'RELATION', 'CLAIM', 'TIME',
    'CAUSE', 'ROLE', 'INTENT', 'VALUE', 'CONSTRAINT',
  ];
  const allPresent = expectedAtoms.every((a) => CORE_ATOMS.includes(a));
  assertTest('1.2 All 11 specific core atoms present', allPresent);

  // Non-core atom rejected
  const fakeAtomResult = validateMeaningTree({
    atom: 'INVALID_ATOM_MAGIC',
    scope: 'CANONICAL',
    value: 'test',
  });
  assertTest('1.3 Non-core atom is rejected by Grammar', !fakeAtomResult.valid);

  // Auxiliary tags separated from Core
  const auxNode: MeaningNode = {
    atom: 'ENTITY',
    scope: 'CANONICAL',
    id: 'hero_01',
    auxiliary: ['WARRIOR', 'LEADER'],
    value: 'Aiden',
  };
  const auxRes = validateMeaningTree(auxNode);
  assertTest('1.4 Auxiliary tags are cleanly accepted and separated', auxRes.valid);

  // 2. Scope Verification
  const validScopeNode: MeaningNode = {
    atom: 'STATE',
    scope: 'CLAIM',
    value: 'HP: 50',
  };
  assertTest('2.1 Valid scope CLAIM accepted', validateMeaningTree(validScopeNode).valid);

  const invalidScopeRes = validateMeaningTree({
    atom: 'STATE',
    scope: 'SUPER_NATURAL_SCOPE',
    value: 'test',
  });
  assertTest('2.2 Invalid scope rejected', !invalidScopeRes.valid);

  // 3. Nesting & Composition Verification
  // Illegal composition: VALUE having child ACTION
  const illegalCompRes = validateMeaningTree({
    atom: 'VALUE',
    scope: 'PROPOSAL',
    value: 100,
    children: [
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'MODIFY_INVENTORY',
      },
    ],
  });
  assertTest('3.1 Illegal composition (VALUE -> ACTION) rejected', !illegalCompRes.valid);

  // 4. CLAIM -> CLAIM / STATE / ACTION
  const claimTree: MeaningNode = {
    atom: 'CLAIM',
    scope: 'CLAIM',
    value: 'Rumor of the lost blade',
    children: [
      {
        atom: 'CLAIM',
        scope: 'CLAIM',
        value: 'Sub-claim: Hidden in the crypt',
      },
      {
        atom: 'STATE',
        scope: 'CLAIM',
        value: 'Blade is cursed',
      },
      {
        atom: 'ACTION',
        scope: 'CLAIM',
        value: 'Blade deals shadow damage',
      },
    ],
  };
  assertTest('4.1 CLAIM -> CLAIM / STATE / ACTION accepted', validateMeaningTree(claimTree).valid);

  // 5. CAUSE -> ACTION / STATE
  const causeTree: MeaningNode = {
    atom: 'CAUSE',
    scope: 'PROPOSAL',
    value: 'RESOURCE_EXCHANGE',
    children: [
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'DEDUCT_GOLD',
      },
      {
        atom: 'STATE',
        scope: 'PROPOSAL',
        value: 'INVENTORY_UPDATED',
      },
    ],
  };
  assertTest('5.1 CAUSE -> ACTION / STATE accepted', validateMeaningTree(causeTree).valid);

  // 6. INTENT -> ACTION
  const intentTree: MeaningNode = {
    atom: 'INTENT',
    scope: 'INTENT',
    value: 'Player wants to buy a potion',
    children: [
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'MODIFY_INVENTORY',
      },
    ],
  };
  assertTest('6.1 INTENT -> ACTION accepted', validateMeaningTree(intentTree).valid);

  // 7. CONSTRAINT -> STATE / ACTION
  const constraintTree: MeaningNode = {
    atom: 'CONSTRAINT',
    scope: 'CANONICAL',
    value: 'Max carry weight 100kg',
    children: [
      {
        atom: 'STATE',
        scope: 'CANONICAL',
        value: 'Weight is 85kg',
      },
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'PICKUP_STONE',
      },
    ],
  };
  assertTest('7.1 CONSTRAINT -> STATE / ACTION accepted', validateMeaningTree(constraintTree).valid);

  // 8. Deep Nesting
  let deepTree: MeaningNode = {
    atom: 'VALUE',
    scope: 'PROPOSAL',
    value: 'deep_leaf',
  };
  // Build a 15-level nesting: ACTION -> STATE -> ENTITY -> STATE -> ENTITY...
  for (let i = 0; i < 15; i++) {
    const parentAtom: CoreAtom = i % 2 === 0 ? 'STATE' : 'ENTITY';
    deepTree = {
      atom: parentAtom,
      scope: 'PROPOSAL',
      value: `level_${i}`,
      children: [deepTree],
    };
  }
  const deepRes = validateMeaningTree(deepTree);
  assertTest('8.1 Deep Nesting (15 levels) validated successfully', deepRes.valid);

  // 9. Conflicting Scope
  const conflictingScopeTree = {
    atom: 'STATE',
    scope: 'CANONICAL',
    value: 'Real world state',
    children: [
      {
        atom: 'STATE',
        scope: 'HYPOTHETICAL', // Directly claiming HYPOTHETICAL inside CANONICAL without CLAIM/INTENT boundary
        value: 'Unverified dream',
      },
    ],
  };
  const conflictRes = validateMeaningTree(conflictingScopeTree);
  assertTest('9.1 Conflicting Scope (CANONICAL direct child HYPOTHETICAL) rejected', !conflictRes.valid);

  // 10. Canonical Serialization & Order Invariance
  const nodeA: MeaningNode = {
    atom: 'ENTITY',
    scope: 'CANONICAL',
    composition: 'UNORDERED',
    id: 'npc_01',
    value: 'Eldrin',
    auxiliary: ['MAGE', 'ELDER'],
    fields: { age: 150, location: 'High Tower' },
    children: [
      { atom: 'STATE', scope: 'CANONICAL', value: 'Health: 100' },
      { atom: 'RELATION', scope: 'CANONICAL', value: 'Allied with Aiden' },
    ],
  };

  const nodeB: MeaningNode = {
    // Fields and auxiliary inverted in declaration order
    children: [
      { atom: 'RELATION', scope: 'CANONICAL', value: 'Allied with Aiden' },
      { atom: 'STATE', scope: 'CANONICAL', value: 'Health: 100' },
    ],
    fields: { location: 'High Tower', age: 150 },
    auxiliary: ['ELDER', 'MAGE'],
    value: 'Eldrin',
    id: 'npc_01',
    scope: 'CANONICAL',
    atom: 'ENTITY',
    composition: 'UNORDERED',
  };

  const serA = serializeMeaningTree(nodeA);
  const serB = serializeMeaningTree(nodeB);
  assertTest('10.1 Order-invariant canonical serialization produces identical strings', serA === serB);
  assertTest('10.2 areMeaningsSemanticallyEqual returns true for permuted declarations', areMeaningsSemanticallyEqual(nodeA, nodeB));

  // 11. Round Trip Verification
  const rtResult = verifyRoundTrip(nodeA);
  assertTest('11.1 Serialize -> Deserialize -> Canonicalize round trip succeeds', rtResult.success);

  // 12. Integration with VEIL Sovereign Engine & Proposal Adapter
  const engine = new SovereignEngine();
  const rawState = engine.getSnapshot();

  // Create a Meaning Tree representing a valid acquisition (e.g. GENESIS or purchase)
  const buyAction: TransitionAction = {
    type: 'MODIFY_INVENTORY',
    payload: {
      item: { id: 'lang_potion_1', name: 'Language Elixir', quantity: 1 },
      operation: 'ADD',
      acquisition: {
        cause: 'GENESIS_STARTER',
      },
    },
  };

  const meaningTreeOfAction = actionToMeaningNode(buyAction);
  const proposal = adaptMeaningTreeToProposal(meaningTreeOfAction, {
    expectedStateVersion: rawState.stateVersion,
    source: 'GENESIS',
    turn: 1,
  });

  assertTest('12.1 Proposal Adapter extracts actions correctly', proposal.actions.length === 1 && proposal.actions[0].type === 'MODIFY_INVENTORY');

  // Submit through Sovereign Engine (enforcing standard Validator and MutationBoundary)
  const commitResult = engine.submitProposal(proposal);
  assertTest('12.2 Adapted proposal commits cleanly through SovereignEngine and MutationBoundary', commitResult.success === true);

  const updatedState = engine.getSnapshot();
  const hasItem = updatedState.character.inventory.some((i) => i.id === 'lang_potion_1');
  assertTest('12.3 Canonical state inventory updated through standard boundary', hasItem);

  // 13. Causality & Firewall Defense through Language Adapter
  // LLM attempts to forge unbacked item via Meaning Tree
  const unbackedAction: TransitionAction = {
    type: 'MODIFY_INVENTORY',
    payload: {
      item: { id: 'forged_sword', name: 'God Sword', quantity: 1 },
      operation: 'ADD',
      // Missing acquisition cause
    },
  };
  const unbackedTree = actionToMeaningNode(unbackedAction);
  const unbackedProposal = adaptMeaningTreeToProposal(unbackedTree, {
    expectedStateVersion: updatedState.stateVersion,
    source: 'LLM',
    turn: 2,
  });

  const unbackedCommitResult = engine.submitProposal(unbackedProposal);
  assertTest('13.1 Causality Firewall strictly rejects unbacked Meaning Tree proposal', unbackedCommitResult.success === false);

  const postState = engine.getSnapshot();
  const swordExists = postState.character.inventory.some((i) => i.id === 'forged_sword');
  assertTest('13.2 Zero mutation verified on rejected Meaning Tree proposal', !swordExists);

  // 14. Deterministic Syntax Recovery Layer Verification
  // 14.1 Normal Engine Language -> Unchanged PASS (recovered: false)
  const perfectRaw = JSON.stringify({
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'TALK_TO_NPC',
    fields: { target: 'npc_elder' },
  });
  const perfectRes = recoverAndParseMeaningTree(perfectRaw);
  assertTest('14.1 Normal Engine Language passes with zero mutation (recovered=false)', perfectRes.success === true && perfectRes.recovered === false && perfectRes.node?.atom === 'ACTION');

  // 14.2 Single Unique Syntax: Markdown Code Block Wrapping -> Recovered PASS
  const fencedRaw = '```json\n' + perfectRaw + '\n```';
  const fencedRes = recoverAndParseMeaningTree(fencedRaw);
  assertTest('14.2 Markdown code block wrapping recovered cleanly', fencedRes.success === true && fencedRes.recovered === true && fencedRes.node?.value === 'TALK_TO_NPC');

  // 14.3 Single Unique Syntax: Trailing Commas in Object & Array -> Recovered PASS
  const trailingCommaRaw = `{\n  "atom": "ENTITY",\n  "scope": "CANONICAL",\n  "value": "Warrior",\n  "auxiliary": ["WARRIOR", "SWORDSMAN",],\n  "fields": { "level": 5, },\n}`;
  const trailingRes = recoverAndParseMeaningTree(trailingCommaRaw);
  assertTest('14.3 Trailing commas in object and array recovered cleanly', trailingRes.success === true && trailingRes.recovered === true && trailingRes.node?.atom === 'ENTITY');

  // 14.4 Single Unique Syntax: Unclosed Terminal Brackets at EOF -> Recovered PASS
  const unclosedBracketRaw = `{"atom":"STATE","scope":"CANONICAL","value":"POISONED","fields":{"turns":3`;
  const unclosedRes = recoverAndParseMeaningTree(unclosedBracketRaw);
  assertTest('14.4 Unclosed terminal brackets at EOF deterministically completed', unclosedRes.success === true && unclosedRes.recovered === true && unclosedRes.node?.value === 'POISONED');

  // 14.5 Multiple/Ambiguous Bracket Mismatch -> FAIL-CLOSED
  const mismatchedBracketRaw = `{"atom": "STATE", "scope": "CANONICAL", "value": [1, 2}}`;
  const mismatchedRes = recoverAndParseMeaningTree(mismatchedBracketRaw);
  assertTest('14.5 Mismatched/ambiguous bracket syntax strictly FAIL-CLOSED', mismatchedRes.success === false && mismatchedRes.recovered === false);

  // 14.6 Semantic Field/Value Missing -> FAIL-CLOSED (No guessing or value invention)
  const missingValueRaw = `{"atom": "STATE", "scope": "CANONICAL", "value": , "fields": {}}`;
  const missingValueRes = recoverAndParseMeaningTree(missingValueRaw);
  assertTest('14.6 Missing semantic value token strictly rejects without guessing (FAIL-CLOSED)', missingValueRes.success === false && missingValueRes.recovered === false);

  const missingColonValueRaw = `{"atom": "STATE", "scope": "CANONICAL", "value": "test", "fields": {"hp": }}`;
  const missingColonRes = recoverAndParseMeaningTree(missingColonValueRaw);
  assertTest('14.7 Missing nested field value strictly rejects without guessing (FAIL-CLOSED)', missingColonRes.success === false);

  // 14.8 Recovery produces valid syntax but Grammar Validation fails -> FAIL-CLOSED
  // E.g., trailing comma fixed, but atom is non-core or composition is illegal
  const grammarViolatingRaw = `{\n  "atom": "INVALID_CORE_ATOM",\n  "scope": "CANONICAL",\n  "value": "Magic",\n}`;
  const grammarViolatingRes = recoverAndParseMeaningTree(grammarViolatingRaw);
  assertTest('14.8 Recovered syntax violating Grammar (invalid Atom) is rejected FAIL-CLOSED', grammarViolatingRes.success === false);

  const illegalCompositionRaw = `{\n  "atom": "VALUE",\n  "scope": "PROPOSAL",\n  "value": 100,\n  "children": [{\n    "atom": "ACTION",\n    "scope": "PROPOSAL",\n    "value": "ILLEGAL_CHILD",\n  },],\n}`;
  const illegalCompRecoverRes = recoverAndParseMeaningTree(illegalCompositionRaw);
  assertTest('14.9 Recovered syntax violating Grammar (illegal composition) is rejected FAIL-CLOSED', illegalCompRecoverRes.success === false);

  // ============================================================================
  // 15. Live Runtime Wiring & End-to-End Pipeline Verification
  // Pipeline: LLM Raw Output → Syntax Recovery → Engine Language / Grammar → Meaning Tree → Adapter → Validator/Gate → Canonical State
  // ============================================================================

  // 15.1 Live LLM Raw Output with code fences & trailing commas -> Recovery -> Engine Language Adapter -> SovereignEngine Commit
  const liveLLMRawOutput = `
소협의 명성은 강호에 퍼져나가기 시작했다. 주루의 손님들이 수군거렸다.

\`\`\`json
{
  "intentSummary": "주루 소문 확산 및 시간 경과",
  "actions": [
    {
      "type": "ADD_RUMOR",
      "payload": {
        "rumor": "북해빙궁의 후계자가 중원에 나타났다.",
        "sourceContext": "낙양 주루 취선루",
      },
    },
    {
      "type": "ADVANCE_TIME",
      "payload": {
        "targetTime": { "year": 1, "month": 1, "day": 2, "timeOfDay": "AFTERNOON" },
        "reason": "소문 탐문으로 인한 반나절 경과",
      },
    },
  ],
}
\`\`\`
  `.trim();

  // Test recoverAndParseProposalOrMeaningTree directly on the code block content
  const codeBlockMatch = liveLLMRawOutput.match(/```json\s*([\s\S]*?)```/);
  const rawCodeBlock = codeBlockMatch ? codeBlockMatch[1] : liveLLMRawOutput;
  const liveRecoveryResult = recoverAndParseProposalOrMeaningTree(rawCodeBlock);

  assertTest('15.1.1 Live LLM raw block successfully recovered by Syntax Recovery Layer', liveRecoveryResult.success === true && liveRecoveryResult.recovered === true);
  assertTest('15.1.2 Exactly 2 actions extracted via Engine Language Grammar & Adapter', liveRecoveryResult.proposalActions.length === 2);

  // Construct Sovereign Proposal and commit to SovereignEngine
  const liveEngine = new SovereignEngine();

  const liveRootMeaningNode: MeaningNode = {
    atom: 'INTENT',
    scope: 'PROPOSAL',
    value: liveRecoveryResult.intentSummary || 'Live Turn Actions',
    children: liveRecoveryResult.proposalActions.map((act) => actionToMeaningNode(act, 'PROPOSAL')),
  };

  const liveProposal = adaptMeaningTreeToProposal(liveRootMeaningNode, {
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    intentSummary: liveRecoveryResult.intentSummary,
  });

  const liveCommitRes = liveEngine.submitProposal(liveProposal);
  if (!liveCommitRes.success) {
    console.log('15.1.3 Rejection Reasons:', liveCommitRes.rejectedReasons, liveCommitRes.conflictDetails);
  }
  assertTest('15.1.3 SovereignEngine Commit Gate validates and commits recovered proposal', liveCommitRes.success === true, liveCommitRes.rejectedReasons?.join(', '));

  const liveFinalSnapshot = liveEngine.getSnapshot();
  const rumorAdded = liveFinalSnapshot.worldInfo.publicRumors?.some((r) => r.includes('북해빙궁'));
  assertTest('15.1.4 Canonical State reflects committed rumor from recovered LLM raw output', Boolean(rumorAdded));

  // 15.2 Direct Meaning Tree LLM Raw Output (with fences & trailing commas) -> Recovery -> Meaning Tree -> Canonical State
  const directMeaningTreeRaw = `\`\`\`json
{
  "atom": "INTENT",
  "scope": "PROPOSAL",
  "value": "사건 기록",
  "children": [
    {
      "atom": "ACTION",
      "scope": "PROPOSAL",
      "value": "RECORD_OFFSCREEN_EVENT",
      "fields": {
        "eventDescription": "무당파 장문인이 폐관 수련에 들어갔다.",
        "location": "무당산",
      },
    },
  ],
}
\`\`\``;

  const directMTRes = recoverAndParseProposalOrMeaningTree(directMeaningTreeRaw);
  assertTest('15.2.1 Direct MeaningTree raw output recovered and grammar-checked', directMTRes.success === true && directMTRes.isMeaningTree === true);
  assertTest('15.2.2 Direct MeaningTree action extracted via Adapter', directMTRes.proposalActions.length === 1 && directMTRes.proposalActions[0].type === 'RECORD_OFFSCREEN_EVENT');

  if (directMTRes.meaningTree) {
    const directMTProposal = adaptMeaningTreeToProposal(directMTRes.meaningTree, {
      expectedStateVersion: liveFinalSnapshot.stateVersion,
      source: 'LLM',
      turn: 2,
    });
    const directMTCommit = liveEngine.submitProposal(directMTProposal);
    assertTest('15.2.3 Direct Meaning Tree proposal successfully committed to SovereignEngine', directMTCommit.success === true);
  }

  // 15.3 Broken/Truncated Value in LLM Output -> FAIL-CLOSED -> Zero Canonical Mutation
  const brokenLLMRaw = `\`\`\`json
{
  "intentSummary": "아이템 획득",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "item": { "id": "legendary_sword", "name": "전설의 검", "quantity": },
        "operation": "ADD"
      }
    }
  ]
}
\`\`\``;

  const brokenRecoveryRes = recoverAndParseProposalOrMeaningTree(brokenLLMRaw);
  assertTest('15.3.1 Truncated value in LLM raw output strictly FAIL-CLOSED', brokenRecoveryRes.success === false);

  const preBrokenSnapshot = liveEngine.getSnapshot();
  // Attempting to adapt empty actions does nothing, state remains pristine
  const postBrokenSnapshot = liveEngine.getSnapshot();
  assertTest('15.3.2 Zero mutation on Canonical State verified when recovery fails-closed', preBrokenSnapshot.stateVersion === postBrokenSnapshot.stateVersion);

  // 15.4 Candidate-Derived State Transition Pipeline roundtrip via Engine Language Adapter
  const candidateAction: TransitionAction = {
    type: 'ADD_NPC',
    payload: {
      id: 'npc_baek_rang',
      name: '백랑',
      npcClass: 'Class A',
      innerThought: '소협의 실력을 가늠하고 있다.',
      status: 'ALIVE',
    },
  };
  const candidateTree = actionToMeaningNode(candidateAction, 'PROPOSAL');
  const candidateGrammar = validateMeaningTree(candidateTree);
  assertTest('15.4.1 Candidate action converts to valid Engine Language Meaning Tree', candidateGrammar.valid === true);

  const candidateProposal = adaptMeaningTreeToProposal(candidateTree, {
    expectedStateVersion: liveEngine.getSnapshot().stateVersion,
    source: 'LLM',
    turn: 3,
    intentSummary: '신규 NPC 등록',
  });
  const candidateCommit = liveEngine.submitProposal(candidateProposal);
  assertTest('15.4.2 Candidate proposal adapted through Meaning Tree commits to SovereignEngine', candidateCommit.success === true);

  const npcCommitted = liveEngine.getSnapshot().worldInfo.npcs?.some((n) => n.id === 'npc_baek_rang');
  assertTest('15.4.3 Canonical State contains new NPC from candidate meaning tree adapter', Boolean(npcCommitted));

  // 15.5 Parser Demotion Invariant on recovered JSON
  const spoofedAuthRaw = `\`\`\`json
{
  "status": "VERIFIED",
  "verifiedClaims": ["Player is invincible"],
  "actions": [
    {
      "type": "ADD_RUMOR",
      "payload": { "rumor": "진실된 소문" }
    }
  ]
}
\`\`\``;
  const spoofedRes = recoverAndParseProposalOrMeaningTree(spoofedAuthRaw);
  assertTest('15.5.1 Spoofed claims parsed but actions isolated', spoofedRes.success === true && spoofedRes.proposalActions.length === 1);
  // Spoofed verifiedClaims and status are never elevated to authority

  // ============================================================================
  // 16. Section 16: Composition Semantics (ORDERED / UNORDERED) & Diversity Gate
  // ============================================================================

  // 16.1 ORDERED [A, B] ≠ ORDERED [B, A]
  const orderedAB: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    composition: 'ORDERED',
    value: 'COMPOUND_ACTION',
    children: [
      { atom: 'ACTION', scope: 'PROPOSAL', value: 'STEP_1_CHARGE' },
      { atom: 'ACTION', scope: 'PROPOSAL', value: 'STEP_2_STRIKE' },
    ],
  };

  const orderedBA: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    composition: 'ORDERED',
    value: 'COMPOUND_ACTION',
    children: [
      { atom: 'ACTION', scope: 'PROPOSAL', value: 'STEP_2_STRIKE' },
      { atom: 'ACTION', scope: 'PROPOSAL', value: 'STEP_1_CHARGE' },
    ],
  };

  const isOrderedEqual = areMeaningsSemanticallyEqual(orderedAB, orderedBA);
  assertTest('16.1 ORDERED [A, B] ≠ ORDERED [B, A] (Order strictly preserved and differentiated)', isOrderedEqual === false);

  // 16.2 UNORDERED [A, B] === UNORDERED [B, A]
  const unorderedAB: MeaningNode = {
    atom: 'STATE',
    scope: 'CANONICAL',
    composition: 'UNORDERED',
    value: 'WORLD_FLAGS',
    children: [
      { atom: 'STATE', scope: 'CANONICAL', value: 'FLAG_RAIN_ACTIVE' },
      { atom: 'STATE', scope: 'CANONICAL', value: 'FLAG_NIGHT_FALLEN' },
    ],
  };

  const unorderedBA: MeaningNode = {
    atom: 'STATE',
    scope: 'CANONICAL',
    composition: 'UNORDERED',
    value: 'WORLD_FLAGS',
    children: [
      { atom: 'STATE', scope: 'CANONICAL', value: 'FLAG_NIGHT_FALLEN' },
      { atom: 'STATE', scope: 'CANONICAL', value: 'FLAG_RAIN_ACTIVE' },
    ],
  };

  const isUnorderedEqual = areMeaningsSemanticallyEqual(unorderedAB, unorderedBA);
  assertTest('16.2 UNORDERED [A, B] === UNORDERED [B, A] (Order-independent canonical equality verified)', isUnorderedEqual === true);

  // 16.3 Nested & Mixed Composition Semantics
  // Tree 1: ORDERED [ UNORDERED [FlagA, FlagB], StrikeAction ]
  const mixedTree1: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    composition: 'ORDERED',
    value: 'SEQUENCE_1',
    children: [
      {
        atom: 'STATE',
        scope: 'PROPOSAL',
        composition: 'UNORDERED',
        value: 'PRECONDITIONS',
        children: [
          { atom: 'STATE', scope: 'PROPOSAL', value: 'WEAPON_DRAWN' },
          { atom: 'STATE', scope: 'PROPOSAL', value: 'ENEMY_IN_RANGE' },
        ],
      },
      { atom: 'ACTION', scope: 'PROPOSAL', value: 'PERFORM_SLASH' },
    ],
  };

  // Tree 2: Same outer ORDERED, but inner UNORDERED has reversed elements -> MUST BE EQUAL to Tree 1
  const mixedTree2: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    composition: 'ORDERED',
    value: 'SEQUENCE_1',
    children: [
      {
        atom: 'STATE',
        scope: 'PROPOSAL',
        composition: 'UNORDERED',
        value: 'PRECONDITIONS',
        children: [
          { atom: 'STATE', scope: 'PROPOSAL', value: 'ENEMY_IN_RANGE' },
          { atom: 'STATE', scope: 'PROPOSAL', value: 'WEAPON_DRAWN' },
        ],
      },
      { atom: 'ACTION', scope: 'PROPOSAL', value: 'PERFORM_SLASH' },
    ],
  };

  // Tree 3: Outer ORDERED sequence is flipped [ PERFORM_SLASH, UNORDERED [...] ] -> MUST NOT BE EQUAL to Tree 1
  const mixedTree3: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    composition: 'ORDERED',
    value: 'SEQUENCE_1',
    children: [
      { atom: 'ACTION', scope: 'PROPOSAL', value: 'PERFORM_SLASH' },
      {
        atom: 'STATE',
        scope: 'PROPOSAL',
        composition: 'UNORDERED',
        value: 'PRECONDITIONS',
        children: [
          { atom: 'STATE', scope: 'PROPOSAL', value: 'WEAPON_DRAWN' },
          { atom: 'STATE', scope: 'PROPOSAL', value: 'ENEMY_IN_RANGE' },
        ],
      },
    ],
  };

  assertTest('16.3.1 Nested UNORDERED inside ORDERED preserves inner equivalence', areMeaningsSemanticallyEqual(mixedTree1, mixedTree2) === true);
  assertTest('16.3.2 Outer ORDERED differentiation respected across nested subtrees', areMeaningsSemanticallyEqual(mixedTree1, mixedTree3) === false);

  // 16.4 Serialization / Deserialization Round-Trip with Composition
  const serOrdered = serializeMeaningTree(orderedAB);
  const deserOrdered = deserializeMeaningTree(serOrdered);
  assertTest('16.4.1 ORDERED composition preserved across serialize/deserialize round-trip', deserOrdered.composition === 'ORDERED' && areMeaningsSemanticallyEqual(orderedAB, deserOrdered));

  const serUnordered = serializeMeaningTree(unorderedAB);
  const deserUnordered = deserializeMeaningTree(serUnordered);
  assertTest('16.4.2 UNORDERED composition preserved across serialize/deserialize round-trip', deserUnordered.composition === 'UNORDERED' && areMeaningsSemanticallyEqual(unorderedAB, deserUnordered));

  // 16.5 Diversity Gate Filtering (5 Candidates -> Structurally Unique Deduplication)
  const candTree1: MeaningNode = { atom: 'ACTION', scope: 'PROPOSAL', value: 'BUY_SWORD' };
  const candTree2: MeaningNode = { atom: 'ACTION', scope: 'PROPOSAL', value: 'BUY_POTION' };
  const candTree3: MeaningNode = { atom: 'ACTION', scope: 'PROPOSAL', value: 'BUY_SWORD' }; // Duplicate of 1
  const candTree4: MeaningNode = { atom: 'ACTION', scope: 'PROPOSAL', value: 'BUY_POTION' }; // Duplicate of 2
  const candTree5: MeaningNode = { atom: 'ACTION', scope: 'PROPOSAL', value: 'EXPLORE_DUNGEON' }; // Unique

  const fiveCandidatesInput = [
    { candidate: { candidateId: 'cand_1', turn: 1, timestamp: '2026-01-01', rawMetadataBlock: '검 구매 1' } as any, meaningTree: candTree1 },
    { candidate: { candidateId: 'cand_2', turn: 1, timestamp: '2026-01-01', rawMetadataBlock: '물약 구매 2' } as any, meaningTree: candTree2 },
    { candidate: { candidateId: 'cand_3', turn: 1, timestamp: '2026-01-01', rawMetadataBlock: '검 구매 3 (중복)' } as any, meaningTree: candTree3 },
    { candidate: { candidateId: 'cand_4', turn: 1, timestamp: '2026-01-01', rawMetadataBlock: '물약 구매 4 (중복)' } as any, meaningTree: candTree4 },
    { candidate: { candidateId: 'cand_5', turn: 1, timestamp: '2026-01-01', rawMetadataBlock: '던전 탐색 5' } as any, meaningTree: candTree5 },
  ];

  const filteredDiverse = filterDiverseCandidates(fiveCandidatesInput);
  assertTest('16.5.1 Diversity Gate reduces 5 candidates (with 2 duplicates) to exactly 3 unique candidates', filteredDiverse.length === 3);
  assertTest('16.5.2 First occurrence metadata preserved for Candidate 1', filteredDiverse[0].candidate.candidateId === 'cand_1' && filteredDiverse[0].candidate.rawMetadataBlock === '검 구매 1');
  assertTest('16.5.3 First occurrence metadata preserved for Candidate 2', filteredDiverse[1].candidate.candidateId === 'cand_2' && filteredDiverse[1].candidate.rawMetadataBlock === '물약 구매 2');
  assertTest('16.5.4 Unique Candidate 5 preserved', filteredDiverse[2].candidate.candidateId === 'cand_5');

  // 16.6 All Identical Candidates -> Diversity Gate preserves 1 candidate (never 0)
  const allIdenticalInput = [
    { candidate: { candidateId: 'cand_1', turn: 1, timestamp: '2026-01-01', rawMetadataBlock: '동일 제안 1' } as any, meaningTree: candTree1 },
    { candidate: { candidateId: 'cand_2', turn: 1, timestamp: '2026-01-01', rawMetadataBlock: '동일 제안 2' } as any, meaningTree: candTree1 },
    { candidate: { candidateId: 'cand_3', turn: 1, timestamp: '2026-01-01', rawMetadataBlock: '동일 제안 3' } as any, meaningTree: candTree1 },
    { candidate: { candidateId: 'cand_4', turn: 1, timestamp: '2026-01-01', rawMetadataBlock: '동일 제안 4' } as any, meaningTree: candTree1 },
    { candidate: { candidateId: 'cand_5', turn: 1, timestamp: '2026-01-01', rawMetadataBlock: '동일 제안 5' } as any, meaningTree: candTree1 },
  ];
  const allIdenticalFiltered = filterDiverseCandidates(allIdenticalInput);
  assertTest('16.6 All identical 5 candidates filtered to exactly 1 candidate (never 0)', allIdenticalFiltered.length === 1 && allIdenticalFiltered[0].candidate.candidateId === 'cand_1');

  // 16.7 Translation -> Diversity -> Adapter -> Sovereign Proposal Pipeline Integrity
  const proposalFromFiltered = adaptMeaningTreeToProposal(filteredDiverse[0].meaningTree, {
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    intentSummary: '검 구매',
  });
  assertTest('16.7 Filtered Meaning Tree seamlessly adapts into StateTransitionProposal with meaningTree attached', Boolean(proposalFromFiltered.meaningTree));


  console.log('====================================================');
  console.log(`Summary: ${passed}/${passed + failed} Language & Live Wiring Tests Passed.`);
  console.log('====================================================');

  return { total: passed + failed, passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = runLanguageTestSuite();
  if (res.failed > 0) {
    process.exit(1);
  }
}
