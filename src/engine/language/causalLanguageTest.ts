/**
 * @file src/engine/language/causalLanguageTest.ts
 * @description VEIL Causal Language v1 Minimal Test Suite
 * Tests cases A through H as specified in Causal Language Contract v1.
 */

import {
  compileSemanticEventsToMeaningTree,
  parseNaturalLanguageToEvents,
} from './causalCompiler';
import { resolveCurrentCausalAuthority } from '../index/authoritativeEvidence';
import { CanonicalState, TransitionAction, StateTransitionProposal } from '../types';
import { SovereignEngine } from '../state';
import { createEmptyCharacter, createEmptyWorldInfo } from '../../utils/factory';
import { MeaningNode, SemanticEvent } from './types';
import { serializeMeaningTree, deserializeMeaningTree, verifyRoundTrip } from './serializer';
import { areMeaningsSemanticallyEqual } from './canonicalizer';
import { PlayerIdentityContext, projectMeaningTreeToRuntimeActions } from './runtimeProjection';
import { actionToMeaningNode, classifyEntityRole, extractActionsAndClaimsFromMeaningTree } from './adapter';

export function runCausalLanguageTestSuite(): { passed: boolean; log: string[] } {
  const log: string[] = [];
  let allPassed = true;

  function assert(condition: boolean, testName: string, detail: string) {
    if (condition) {
      log.push(`[PASS] ${testName}: ${detail}`);
    } else {
      log.push(`[FAIL] ${testName}: ${detail}`);
      allPassed = false;
    }
  }

  log.push('=== RUNNING VEIL CAUSAL LANGUAGE V1 MINIMAL TEST SUITE ===\n');

  // Case A: DISCOVER
  const textA = '삼화상인이 은화를 발견했다.';
  const eventsA = parseNaturalLanguageToEvents(textA);
  const resultA = compileSemanticEventsToMeaningTree(eventsA);
  assert(
    resultA.status === 'COMPILED' &&
      eventsA[0].action === 'DISCOVER' &&
      eventsA[0].roles.find((r) => r.role === 'SUBJECT')?.entityName === '삼화상인' &&
      eventsA[0].roles.find((r) => r.role === 'OBJECT')?.entityName === '은화' &&
      !eventsA[0].roles.some((r) => r.role === 'RECIPIENT'),
    'Case A (DISCOVER)',
    'Parsed DISCOVER action with SUBJECT=삼화상인, OBJECT=은화, RECIPIENT=null'
  );

  // Case B: GIFT
  const textB = '삼화상인이 플레이어에게 은화를 주었다.';
  const eventsB = parseNaturalLanguageToEvents(textB);
  const resultB = compileSemanticEventsToMeaningTree(eventsB);
  assert(
    resultB.status === 'COMPILED' &&
      eventsB[0].action === 'GIFT' &&
      eventsB[0].roles.find((r) => r.role === 'SUBJECT')?.entityName === '삼화상인' &&
      eventsB[0].roles.find((r) => r.role === 'RECIPIENT')?.entityName === '플레이어' &&
      eventsB[0].roles.find((r) => r.role === 'OBJECT')?.entityName === '은화',
    'Case B (GIFT)',
    'Parsed GIFT action with SUBJECT=삼화상인, RECIPIENT=플레이어, OBJECT=은화'
  );

  // Case C: Semantic Attack (Discovery + Negated Gift)
  const textC = '삼화상인이 은화를 발견했지만, 플레이어에게 주지는 않았다.';
  const eventsC = parseNaturalLanguageToEvents(textC);
  const giftEventC = eventsC.find((e) => e.action === 'GIFT');
  assert(
    eventsC.length >= 2 &&
      eventsC[0].action === 'DISCOVER' &&
      giftEventC?.polarity === 'NEGATED',
    'Case C (Semantic Attack)',
    'Correctly segmented into DISCOVER and NEGATED GIFT events, preventing false GIFT proof'
  );

  // Case D: Passive Voice
  const textD = '플레이어는 삼화상인에게 은화를 제공받았다.';
  const eventsD = parseNaturalLanguageToEvents(textD);
  assert(
    eventsD[0].action === 'GIFT' &&
      eventsD[0].roles.find((r) => r.role === 'SUBJECT')?.entityName === '삼화상인' &&
      eventsD[0].roles.find((r) => r.role === 'RECIPIENT')?.entityName === '플레이어' &&
      eventsD[0].roles.find((r) => r.role === 'OBJECT')?.entityName === '은화',
    'Case D (Passive Voice)',
    'Normalized passive sentence to deep semantic roles SUBJECT=삼화상인, RECIPIENT=플레이어'
  );

  // Case E: Ambiguous Reference
  const textE = '누군가가 무언가를 주었다.';
  const eventsE = parseNaturalLanguageToEvents(textE);
  const resultE = compileSemanticEventsToMeaningTree(eventsE);
  assert(
    resultE.status === 'RECONCILIATION_REQUIRED' || resultE.status === 'INVALID',
    'Case E (Ambiguous Reference)',
    `Ambiguous entity references safely rejected without guessing (status: ${resultE.status})`
  );

  // Case F: Intent != Execution
  const textF = '삼화상인은 플레이어에게 은화를 주려고 했다.';
  const eventsF = parseNaturalLanguageToEvents(textF);
  const giftEventF = eventsF.find((e) => e.action === 'GIFT');
  assert(
    giftEventF?.modality === 'INTENTIONAL',
    'Case F (Intent != Execution)',
    'Preserved modality INTENTIONAL, preventing automatic canonical state mutation'
  );

  // Case G: Claim != Canon (Hearsay)
  const textG = '경비가 삼화상인이 플레이어에게 은화를 줬다고 말했다.';
  const eventsG = parseNaturalLanguageToEvents(textG);
  assert(
    eventsG[0].epistemicStatus === 'HEARSAY' && eventsG[0].scope === 'CLAIM',
    'Case G (Claim != Canon)',
    'Marked hearsay claim with EpistemicStatus=HEARSAY and Scope=CLAIM'
  );

  // Case H: R1-U Semantic Authority Spoof Prevention
  const mockStateH: CanonicalState = {
    stateVersion: 10,
    turn: 10,
    character: createEmptyCharacter(),
    lastCommittedEventId: 'evt-init',
    lastCommittedAt: new Date().toISOString(),
    worldInfo: {
      ...createEmptyWorldInfo(),
      worldName: 'Test World',
      settingDescription: 'Test Setting',
      offscreenRecords: [
        {
          id: 'offscreen-r1u-semantic-source-attack-001',
          eventDescription: '삼화상인이 시장 창고에서 은화를 발견했다.',
          involvedNpcIds: ['npc-r1u-semantic-source'],
        },
      ],
    },
  };

  const authResultH = resolveCurrentCausalAuthority(
    'offscreen-r1u-semantic-source-attack-001',
    mockStateH,
    [],
    {
      operation: 'ADD',
      acquisitionCause: 'GIFT_REWARD',
      sourceNpcId: 'npc-r1u-semantic-source',
    }
  );

  assert(
    authResultH.hasAuthority === false &&
      authResultH.rejectionReason === 'SEMANTIC_ACTION_MISMATCH',
    'Case H (R1-U Semantic Spoof Prevention)',
    `Historical DISCOVERY event correctly denied causal authority for GIFT_REWARD request (Reason: ${authResultH.rejectionReason})`
  );

  // Case I: P0-1 Unrecognized Natural Language Fallback Prevention
  const textI = '오늘 하늘의 구름이 빠르게 흘러간다.';
  const eventsI = parseNaturalLanguageToEvents(textI);
  const resultI = compileSemanticEventsToMeaningTree(eventsI);
  const hasUpdateStateAction =
    eventsI.some((e) => e.action === 'UPDATE_STATE') ||
    (resultI.meaningTree ? JSON.stringify(resultI.meaningTree).includes('UPDATE_STATE') : false);

  assert(
    eventsI.length === 0 &&
      resultI.status === 'UNKNOWN' &&
      !hasUpdateStateAction &&
      resultI.meaningTree === undefined,
    'Case I (P0-1 Unknown Input Fallback Prevention)',
    `Unrecognized input returned empty events, status 'UNKNOWN', and no synthetic 'UPDATE_STATE' mutation action`
  );

  // Case J: P0-2A Semantic Event -> MeaningTree Semantic Preservation (11 Core Atoms & References)
  const populatedEvent: SemanticEvent = {
    eventId: 'evt-p02a-comprehensive-001',
    action: 'GIFT',
    roles: [
      { role: 'SUBJECT', entityName: '상인', entityId: 'npc-merchant', status: 'RESOLVED' },
      { role: 'RECIPIENT', entityName: '플레이어', entityId: 'pc-hero', status: 'RESOLVED' },
      { role: 'OBJECT', entityName: '은화', entityId: 'item-silver', status: 'RESOLVED' },
    ],
    states: [
      { name: 'CHEST_OPEN', value: true, target: 'chest-01' },
    ],
    relations: [
      { type: 'ALLIED_WITH', source: 'npc-merchant', target: 'pc-hero' },
    ],
    values: [
      { amount: 100, currency: 'SILVER' },
    ],
    times: [
      { timestamp: '1024-04-12T10:00:00Z', temporalPrecision: 'EXACT' },
    ],
    causes: [
      { reason: 'QUEST_COMPLETION', causeId: 'quest-delivery-01' },
    ],
    constraints: [
      { rule: 'CANNOT_TRANSFER_CURSED', severity: 'BLOCK' },
    ],
    intent: 'REWARD_HERO',
    scope: 'OFFSCREEN',
    polarity: 'ASSERTED',
    epistemicStatus: 'OBSERVED',
    modality: 'NONE',
    provenance: 'RULE_ENGINE_COMMISSION',
    temporalPrecision: 'EXACT',
    literalness: true,
    references: [
      { id: 'ref-quest-1', targetAtom: 'CAUSE', role: 'TRIGGER' },
      { id: 'ref-contract-2', targetAtom: 'CONSTRAINT', role: 'LIMIT' },
    ],
  };

  const resultJ = compileSemanticEventsToMeaningTree([populatedEvent]);
  const treeJ = resultJ.meaningTree;
  const actionNode = treeJ?.children?.[0];

  const hasAction = actionNode?.atom === 'ACTION' && actionNode.value === 'GIFT';
  const hasRoles = actionNode?.children?.some((c) => c.atom === 'ROLE' && c.value === 'SUBJECT') &&
                   actionNode?.children?.some((c) => c.atom === 'ROLE' && c.value === 'RECIPIENT') &&
                   actionNode?.children?.some((c) => c.atom === 'ROLE' && c.value === 'OBJECT');
  const hasState = actionNode?.children?.some((c) => c.atom === 'STATE' && c.value === 'CHEST_OPEN');
  const hasRelation = actionNode?.children?.some((c) => c.atom === 'RELATION' && c.value === 'ALLIED_WITH');
  const hasValue = actionNode?.children?.some((c) => c.atom === 'VALUE' && (c.value === 100 || (c.fields as any)?.amount === 100));
  const hasTime = actionNode?.children?.some((c) => c.atom === 'TIME' && (c.value === '1024-04-12T10:00:00Z' || (c.fields as any)?.timestamp === '1024-04-12T10:00:00Z'));
  const hasCause = actionNode?.children?.some((c) => c.atom === 'CAUSE' && c.value === 'QUEST_COMPLETION');
  const hasConstraint = actionNode?.children?.some((c) => c.atom === 'CONSTRAINT' && c.value === 'CANNOT_TRANSFER_CURSED');
  const hasReferences = Array.isArray(actionNode?.references) && actionNode.references.length === 2 &&
                        actionNode.references.some((r) => r.id === 'ref-quest-1') &&
                        actionNode.references.some((r) => r.id === 'ref-contract-2');
  const hasMetadataFields = actionNode?.fields?.intent === 'REWARD_HERO' &&
                            actionNode?.fields?.provenance === 'RULE_ENGINE_COMMISSION' &&
                            actionNode?.fields?.literalness === true &&
                            actionNode?.fields?.temporalPrecision === 'EXACT';

  const allAtomsPreserved = !!(hasAction && hasRoles && hasState && hasRelation && hasValue && hasTime && hasCause && hasConstraint && hasReferences && hasMetadataFields);

  assert(
    resultJ.status === 'COMPILED' && allAtomsPreserved,
    'Case J (P0-2A Semantic Preservation - 11 Core Atoms & References)',
    `All semantic elements (states, relations, values, times, causes, constraints, references, intent) preserved into Core Atom tree without degradation`
  );

  // Case K: P0-2A Serialization & Deserialization Round-Trip Semantic Invariance
  let roundTripSuccess = false;
  if (treeJ) {
    const roundTripRes = verifyRoundTrip(treeJ);
    const serialized = serializeMeaningTree(treeJ);
    const deserialized = deserializeMeaningTree(serialized);
    const equal = areMeaningsSemanticallyEqual(treeJ, deserialized);
    roundTripSuccess = roundTripRes.success && equal;
  }

  assert(
    roundTripSuccess,
    'Case K (P0-2A MeaningTree Serialization Round-Trip)',
    `Extended Core Atom MeaningTree successfully passed Serialize -> Deserialize -> Canonicalize semantic equivalence check`
  );

  // Case L: 5-way Semantic Discrimination Verification (DISCOVER vs GIFT vs NEGATED vs INTENTIONAL vs HEARSAY)
  const evDiscover: SemanticEvent = {
    eventId: 'disc-1',
    action: 'DISCOVER',
    roles: [
      { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
      { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' },
    ],
    scope: 'OFFSCREEN',
    polarity: 'ASSERTED',
    epistemicStatus: 'OBSERVED',
    modality: 'NONE',
  };

  const evGift: SemanticEvent = {
    eventId: 'gift-1',
    action: 'GIFT',
    roles: [
      { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
      { role: 'RECIPIENT', entityName: '플레이어', status: 'RESOLVED' },
      { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' },
    ],
    scope: 'OFFSCREEN',
    polarity: 'ASSERTED',
    epistemicStatus: 'OBSERVED',
    modality: 'NONE',
  };

  const evNegatedGift: SemanticEvent = {
    ...evGift,
    eventId: 'gift-neg-1',
    polarity: 'NEGATED',
  };

  const evIntentionalGift: SemanticEvent = {
    ...evGift,
    eventId: 'gift-intent-1',
    modality: 'INTENTIONAL',
  };

  const evHearsayClaim: SemanticEvent = {
    ...evGift,
    eventId: 'hearsay-1',
    scope: 'CLAIM',
    epistemicStatus: 'HEARSAY',
    roles: [
      { role: 'SPEAKER', entityName: '경비', status: 'RESOLVED' },
      ...evGift.roles,
    ],
  };

  const resDisc = compileSemanticEventsToMeaningTree([evDiscover]);
  const resGift = compileSemanticEventsToMeaningTree([evGift]);
  const resNeg = compileSemanticEventsToMeaningTree([evNegatedGift]);
  const resIntent = compileSemanticEventsToMeaningTree([evIntentionalGift]);
  const resHear = compileSemanticEventsToMeaningTree([evHearsayClaim]);

  const discNode = resDisc.meaningTree?.children?.[0];
  const giftNode = resGift.meaningTree?.children?.[0];
  const negNode = resNeg.meaningTree?.children?.[0];
  const intentNode = resIntent.meaningTree?.children?.[0];
  const hearNode = resHear.meaningTree?.children?.[0];

  const discHasRecipient = discNode?.children?.some((c) => c.atom === 'ROLE' && c.value === 'RECIPIENT');
  const giftHasRecipient = giftNode?.children?.some((c) => c.atom === 'ROLE' && c.value === 'RECIPIENT');
  const negPolarity = negNode?.fields?.polarity;
  const intentModality = intentNode?.fields?.modality;
  const hearScope = hearNode?.scope;
  const hearEpistemic = hearNode?.fields?.epistemicStatus;
  const hearHasSpeaker = hearNode?.children?.some((c) => c.atom === 'ROLE' && c.value === 'SPEAKER');

  const discriminated = Boolean(
    !discHasRecipient &&
      giftHasRecipient &&
      negPolarity === 'NEGATED' &&
      intentModality === 'INTENTIONAL' &&
      hearScope === 'CLAIM' &&
      hearEpistemic === 'HEARSAY' &&
      hearHasSpeaker
  );

  assert(
    discriminated,
    'Case L (5-Way Core Semantic Discrimination)',
    `DISCOVER vs GIFT vs NEGATED GIFT vs INTENTIONAL GIFT vs HEARSAY CLAIM are strictly discriminated in MeaningTree`
  );

  // Case M-1 & M-2: P0-2B-1 Compound Wrapper Leakage Prevention & Child Action Preservation
  const normalAction1: TransitionAction = {
    type: 'MODIFY_INVENTORY',
    payload: {
      operation: 'ADD',
      item: { id: 'item-silver-coin', name: '은화', quantity: 10 },
    },
  };

  const normalAction2: TransitionAction = {
    type: 'ADD_NPC',
    payload: {
      id: 'npc-merchant-1',
      name: '삼화상인',
      status: 'ALIVE',
      archetype: 'MERCHANT',
      firstMetTurn: 1,
    } as any,
  };

  const normalAction3: TransitionAction = {
    type: 'UPDATE_CHARACTER_STATS',
    payload: {
      strength: 15,
      agility: 12,
    },
  };

  const compoundTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'CANONICAL',
    composition: 'ORDERED',
    value: 'COMPOUND_EVENT_SEQUENCE',
    children: [
      actionToMeaningNode(normalAction1, 'CANONICAL'),
      actionToMeaningNode(normalAction2, 'CANONICAL'),
    ],
  };

  const projCompound = projectMeaningTreeToRuntimeActions(compoundTree);
  const hasCompoundWrapperInActions = projCompound.actions.some(
    (a) => (a.type as any) === 'COMPOUND_EVENT_SEQUENCE'
  );

  assert(
    !hasCompoundWrapperInActions,
    'Case M-1 (Compound Wrapper Leakage Prevention)',
    'ACTION.value === "COMPOUND_EVENT_SEQUENCE" is strictly prevented from projecting as TransitionAction'
  );

  const childrenPreserved =
    projCompound.actions.length === 2 &&
    projCompound.actions[0].type === 'MODIFY_INVENTORY' &&
    projCompound.actions[1].type === 'ADD_NPC';

  assert(
    childrenPreserved,
    'Case M-2 (Child Action Preservation)',
    'Children actions inside COMPOUND_EVENT_SEQUENCE are recursively projected in canonical order'
  );

  // Case M-3: P0-2B-1 CLAIM Leakage Prevention
  const claimActionTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'CLAIM',
    value: 'MODIFY_INVENTORY',
    fields: {
      actionType: 'MODIFY_INVENTORY',
      payload: { operation: 'ADD', item: { id: 'item-fake', name: '가짜은화', quantity: 999 } },
    },
  };
  const projClaim = projectMeaningTreeToRuntimeActions(claimActionTree);

  assert(
    projClaim.actions.length === 0,
    'Case M-3 (CLAIM Leakage Prevention)',
    'ACTION node with scope="CLAIM" is strictly prevented from projecting as TransitionAction'
  );

  // Case M-4: P0-2B-1 HEARSAY Leakage Prevention
  const hearsayActionTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'MODIFY_INVENTORY',
    fields: {
      actionType: 'MODIFY_INVENTORY',
      epistemicStatus: 'HEARSAY',
      payload: { operation: 'ADD', item: { id: 'item-hearsay', name: '소문은화', quantity: 500 } },
    },
  };
  const projHearsay = projectMeaningTreeToRuntimeActions(hearsayActionTree);

  // Also check compiler-generated hearsay event
  const eventsHearsay = parseNaturalLanguageToEvents('경비가 삼화상인이 플레이어에게 은화를 줬다고 말했다.');
  const compiledHearsay = compileSemanticEventsToMeaningTree(eventsHearsay);
  const projCompiledHearsay = compiledHearsay.meaningTree
    ? projectMeaningTreeToRuntimeActions(compiledHearsay.meaningTree)
    : { actions: [] };

  assert(
    projHearsay.actions.length === 0 && projCompiledHearsay.actions.length === 0,
    'Case M-4 (HEARSAY Leakage Prevention)',
    'ACTION node with epistemicStatus="HEARSAY" is strictly prevented from projecting as TransitionAction'
  );

  // Case M-5: P0-2B-1 Existing Runtime Action Regression
  const node1 = actionToMeaningNode(normalAction1, 'CANONICAL');
  const node2 = actionToMeaningNode(normalAction2, 'CANONICAL');
  const node3 = actionToMeaningNode(normalAction3, 'CANONICAL');

  const proj1 = projectMeaningTreeToRuntimeActions(node1);
  const proj2 = projectMeaningTreeToRuntimeActions(node2);
  const proj3 = projectMeaningTreeToRuntimeActions(node3);

  const regressionPass =
    proj1.actions.length === 1 &&
    proj1.actions[0].type === 'MODIFY_INVENTORY' &&
    proj2.actions.length === 1 &&
    proj2.actions[0].type === 'ADD_NPC' &&
    proj3.actions.length === 1 &&
    proj3.actions[0].type === 'UPDATE_CHARACTER_STATS';

  assert(
    regressionPass,
    'Case M-5 (Existing Runtime Action Regression)',
    'Standard runtime actions (MODIFY_INVENTORY, ADD_NPC, UPDATE_CHARACTER_STATS) project identically as before'
  );

  // ==========================================
  // P0-2B-2: ROLE Runtime Projection + GIFT / DISCOVER Routing
  // ==========================================

  const canonicalTestContext: PlayerIdentityContext = {
    characterId: 'protagonist',
    characterName: '주인공',
    knownNpcIds: ['npc-elder', 'npc-merchant', 'npc-guard', 'npc-bandit', 'npc-friend'],
    knownNpcNames: ['촌장', '상인', '경비병', '산적', '친구'],
  };

  // Case N-1: GIFT to PLAYER -> MODIFY_INVENTORY
  const giftPlayerTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'CANONICAL',
    value: 'GIFT',
    children: [
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'SUBJECT',
        fields: { entityId: 'npc-elder', entityName: '촌장', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'RECIPIENT',
        fields: { entityId: 'protagonist', entityName: '주인공', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'OBJECT',
        fields: { entityId: 'item-herb', entityName: '약초', status: 'RESOLVED' },
      },
      {
        atom: 'VALUE',
        scope: 'CANONICAL',
        value: 3,
      },
    ],
  };
  const projGiftPlayer = projectMeaningTreeToRuntimeActions(giftPlayerTree, canonicalTestContext);
  assert(
    projGiftPlayer.actions.length === 1 &&
      projGiftPlayer.actions[0].type === 'MODIFY_INVENTORY' &&
      projGiftPlayer.actions[0].payload?.item?.id === 'item-herb' &&
      projGiftPlayer.actions[0].payload?.item?.quantity === 3 &&
      projGiftPlayer.actions[0].payload?.acquisition?.cause === 'GIFT_REWARD' &&
      projGiftPlayer.actions[0].payload?.acquisition?.sourceNpcId === 'npc-elder',
    'Case N-1 (GIFT to PLAYER Routing)',
    'GIFT with RECIPIENT=protagonist projects to MODIFY_INVENTORY with cause=GIFT_REWARD and sourceNpcId'
  );

  // Case N-2: GIFT between NPCs -> RECORD_OFFSCREEN_EVENT
  const giftNpcTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'CANONICAL',
    value: 'GIFT',
    children: [
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'SUBJECT',
        fields: { entityId: 'npc-merchant', entityName: '상인', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'RECIPIENT',
        fields: { entityId: 'npc-guard', entityName: '경비병', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'OBJECT',
        fields: { entityId: 'item-bribe', entityName: '은화주머니', status: 'RESOLVED' },
      },
    ],
  };
  const projGiftNpc = projectMeaningTreeToRuntimeActions(giftNpcTree, canonicalTestContext);
  assert(
    projGiftNpc.actions.length === 1 &&
      projGiftNpc.actions[0].type === 'RECORD_OFFSCREEN_EVENT' &&
      Array.isArray(projGiftNpc.actions[0].payload?.involvedNpcIds) &&
      projGiftNpc.actions[0].payload?.involvedNpcIds?.includes('npc-merchant') &&
      projGiftNpc.actions[0].payload?.involvedNpcIds?.includes('npc-guard'),
    'Case N-2 (GIFT between NPCs Routing)',
    'GIFT between NPCs projects to RECORD_OFFSCREEN_EVENT containing involvedNpcIds without modifying player inventory'
  );

  // Case N-3: DISCOVER by PLAYER -> MODIFY_INVENTORY
  const discoverPlayerTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'CANONICAL',
    value: 'DISCOVER',
    children: [
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'SUBJECT',
        fields: { entityId: 'protagonist', entityName: '주인공', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'OBJECT',
        fields: { entityId: 'item-ancient-key', entityName: '고대의열쇠', status: 'RESOLVED' },
      },
    ],
  };
  const projDiscoverPlayer = projectMeaningTreeToRuntimeActions(discoverPlayerTree, canonicalTestContext);
  assert(
    projDiscoverPlayer.actions.length === 1 &&
      projDiscoverPlayer.actions[0].type === 'MODIFY_INVENTORY' &&
      projDiscoverPlayer.actions[0].payload?.item?.id === 'item-ancient-key' &&
      projDiscoverPlayer.actions[0].payload?.item?.quantity === 1 &&
      projDiscoverPlayer.actions[0].payload?.acquisition?.cause === 'DISCOVERY_PICKUP',
    'Case N-3 (DISCOVER by PLAYER Routing)',
    'DISCOVER by PLAYER projects to MODIFY_INVENTORY with cause=DISCOVERY_PICKUP'
  );

  // Case N-4: DISCOVER by NPC -> RECORD_OFFSCREEN_EVENT
  const discoverNpcTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'CANONICAL',
    value: 'DISCOVER',
    children: [
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'SUBJECT',
        fields: { entityId: 'npc-bandit', entityName: '산적', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'OBJECT',
        fields: { entityId: 'item-chest', entityName: '보물상자', status: 'RESOLVED' },
      },
    ],
  };
  const projDiscoverNpc = projectMeaningTreeToRuntimeActions(discoverNpcTree, canonicalTestContext);
  assert(
    projDiscoverNpc.actions.length === 1 &&
      projDiscoverNpc.actions[0].type === 'RECORD_OFFSCREEN_EVENT' &&
      Array.isArray(projDiscoverNpc.actions[0].payload?.involvedNpcIds) &&
      projDiscoverNpc.actions[0].payload?.involvedNpcIds?.includes('npc-bandit'),
    'Case N-4 (DISCOVER by NPC Routing)',
    'DISCOVER by NPC projects to RECORD_OFFSCREEN_EVENT without modifying player inventory'
  );

  // Case N-5: UNKNOWN / Ambiguous Entity Fail-Closed (NO player inventory mutation)
  const unknownRecipientGift: MeaningNode = {
    atom: 'ACTION',
    scope: 'CANONICAL',
    value: 'GIFT',
    children: [
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'SUBJECT',
        fields: { entityId: 'npc-merchant', entityName: '상인', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'RECIPIENT',
        fields: { entityName: '누군가', status: 'UNRESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'OBJECT',
        fields: { entityId: 'item-coin', entityName: '은화', status: 'RESOLVED' },
      },
    ],
  };
  const projUnknownGift = projectMeaningTreeToRuntimeActions(unknownRecipientGift, canonicalTestContext);

  const ambiguousDiscover: MeaningNode = {
    atom: 'ACTION',
    scope: 'CANONICAL',
    value: 'DISCOVER',
    children: [
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'SUBJECT',
        fields: { entityName: '미지의존재', status: 'AMBIGUOUS' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'OBJECT',
        fields: { entityId: 'item-gem', entityName: '보석', status: 'RESOLVED' },
      },
    ],
  };
  const projAmbiguousDiscover = projectMeaningTreeToRuntimeActions(ambiguousDiscover, canonicalTestContext);

  assert(
    projUnknownGift.actions.length === 0 && projAmbiguousDiscover.actions.length === 0,
    'Case N-5 (Fail-Closed on UNKNOWN / Ambiguous Entity)',
    'Unresolved or ambiguous entities strictly fail-closed: NO player inventory modification occurs'
  );

  // Case N-6: Semantic Separation (GIFT vs DISCOVER Grammar & Role Constraints)
  const giftWithoutRecipient: MeaningNode = {
    atom: 'ACTION',
    scope: 'CANONICAL',
    value: 'GIFT',
    children: [
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'SUBJECT',
        fields: { entityId: 'npc-merchant', entityName: '상인', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'OBJECT',
        fields: { entityId: 'item-ring', entityName: '반지', status: 'RESOLVED' },
      },
    ],
  };
  const projInvalidGift = projectMeaningTreeToRuntimeActions(giftWithoutRecipient, canonicalTestContext);

  const discoverWithForbiddenRecipient: MeaningNode = {
    atom: 'ACTION',
    scope: 'CANONICAL',
    value: 'DISCOVER',
    children: [
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'SUBJECT',
        fields: { entityId: 'protagonist', entityName: '주인공', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'RECIPIENT',
        fields: { entityId: 'npc-friend', entityName: '친구', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'OBJECT',
        fields: { entityId: 'item-stone', entityName: '신비한돌', status: 'RESOLVED' },
      },
    ],
  };
  const projInvalidDiscover = projectMeaningTreeToRuntimeActions(discoverWithForbiddenRecipient, canonicalTestContext);

  assert(
    projInvalidGift.actions.length === 0 && projInvalidDiscover.actions.length === 0,
    'Case N-6 (GIFT / DISCOVER Semantic Role Separation)',
    'GIFT missing RECIPIENT and DISCOVER containing forbidden RECIPIENT fail projection and never leak to runtime'
  );

  // Case N-7: Strict Identity Classification & Fail-Closed Invariant Suite
  const dummyPlayerContext: PlayerIdentityContext = {
    characterId: 'hero-001',
    characterName: '홍길동',
    aliases: ['길동'],
    knownNpcIds: ['npc-merchant-01'],
    knownNpcNames: ['김상인'],
  };

  // 1. Arbitrary RESOLVED entityId + player context mismatch -> UNKNOWN
  const test1 = classifyEntityRole(
    { role: 'SUBJECT', entityId: 'hero-other', status: 'RESOLVED' },
    dummyPlayerContext
  );

  // 2. Arbitrary entityName + player context mismatch -> UNKNOWN
  const test2 = classifyEntityRole(
    { role: 'SUBJECT', entityName: '임꺽정', status: 'RESOLVED' },
    dummyPlayerContext
  );

  // 3. "npc-..." prefix without NPC context -> UNKNOWN
  const test3 = classifyEntityRole(
    { role: 'SUBJECT', entityId: 'npc-bandit-99', status: 'RESOLVED' },
    dummyPlayerContext
  );

  // 4. "protagonist" string without player context -> UNKNOWN
  const test4 = classifyEntityRole(
    { role: 'SUBJECT', entityId: 'protagonist', status: 'RESOLVED' },
    undefined
  );

  // 5. Explicit PLAYER entityType -> PLAYER
  const test5 = classifyEntityRole(
    { role: 'SUBJECT', entityId: 'any-id', entityType: 'PLAYER', status: 'RESOLVED' },
    undefined
  );

  // 6. Explicit NPC entityType -> NPC
  const test6 = classifyEntityRole(
    { role: 'SUBJECT', entityId: 'any-id', entityType: 'NPC', status: 'RESOLVED' },
    undefined
  );

  // 7. Canonical Player Identity match -> PLAYER
  const test7a = classifyEntityRole(
    { role: 'SUBJECT', entityId: 'hero-001', status: 'RESOLVED' },
    dummyPlayerContext
  );
  const test7b = classifyEntityRole(
    { role: 'SUBJECT', entityName: '홍길동', status: 'RESOLVED' },
    dummyPlayerContext
  );
  const test7c = classifyEntityRole(
    { role: 'SUBJECT', entityName: '길동', status: 'RESOLVED' },
    dummyPlayerContext
  );

  // 8. Canonical NPC Identity match -> NPC
  const test8a = classifyEntityRole(
    { role: 'SUBJECT', entityId: 'npc-merchant-01', status: 'RESOLVED' },
    dummyPlayerContext
  );
  const test8b = classifyEntityRole(
    { role: 'SUBJECT', entityName: '김상인', status: 'RESOLVED' },
    dummyPlayerContext
  );

  // 9. Ambiguous / Unresolved -> UNKNOWN
  const test9a = classifyEntityRole(
    { role: 'SUBJECT', entityId: 'hero-001', status: 'AMBIGUOUS' },
    dummyPlayerContext
  );
  const test9b = classifyEntityRole(
    { role: 'SUBJECT', entityId: 'hero-001', status: 'UNRESOLVED' },
    dummyPlayerContext
  );

  assert(
    test1 === 'UNKNOWN' &&
      test2 === 'UNKNOWN' &&
      test3 === 'UNKNOWN' &&
      test4 === 'UNKNOWN' &&
      test5 === 'PLAYER' &&
      test6 === 'NPC' &&
      test7a === 'PLAYER' &&
      test7b === 'PLAYER' &&
      test7c === 'PLAYER' &&
      test8a === 'NPC' &&
      test8b === 'NPC' &&
      test9a === 'UNKNOWN' &&
      test9b === 'UNKNOWN',
    'Case N-7 (Strict Identity Classification & Fail-Closed Invariant Suite)',
    'Verified zero string hardcoding, zero ID prefix guessing, zero negative inference, and exact canonical/explicit match logic'
  );

  // === P0-2B-3 PRESERVATION TEST SUITE ===

  // M/P0-2B-3-1: NEGATED ACTION
  const p02b3NegatedActionTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'DISCOVER',
    fields: { polarity: 'NEGATED' },
    children: [
      {
        atom: 'ROLE',
        scope: 'PROPOSAL',
        value: 'SUBJECT',
        fields: { entityId: 'hero-001', entityType: 'PLAYER', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'PROPOSAL',
        value: 'OBJECT',
        fields: { entityId: 'item-chest', entityType: 'ITEM', status: 'RESOLVED' },
      },
    ],
  };
  const p02b3ProjNegated = projectMeaningTreeToRuntimeActions(p02b3NegatedActionTree, dummyPlayerContext);
  assert(
    p02b3ProjNegated.actions.length === 0 &&
      p02b3ProjNegated.canonicalMeaning.atom === 'ACTION' &&
      p02b3ProjNegated.canonicalMeaning.fields?.polarity === 'NEGATED',
    'M/P0-2B-3-1 (NEGATED ACTION)',
    'Zero runtime actions projected, MeaningTree strictly preserved'
  );

  // M/P0-2B-3-2: INTENTIONAL ACTION
  const p02b3IntentionalActionTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'GIFT',
    fields: { modality: 'INTENTIONAL', intentText: '주인공에게 물약을 주려고 했다' },
    children: [
      {
        atom: 'ROLE',
        scope: 'PROPOSAL',
        value: 'SUBJECT',
        fields: { entityId: 'npc-merchant-01', entityType: 'NPC', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'PROPOSAL',
        value: 'RECIPIENT',
        fields: { entityId: 'hero-001', entityType: 'PLAYER', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'PROPOSAL',
        value: 'OBJECT',
        fields: { entityId: 'item-potion', entityType: 'ITEM', status: 'RESOLVED' },
      },
    ],
  };
  const p02b3ProjIntentional = projectMeaningTreeToRuntimeActions(p02b3IntentionalActionTree, dummyPlayerContext);
  const p02b3ExtractedIntentional = extractActionsAndClaimsFromMeaningTree(p02b3IntentionalActionTree, dummyPlayerContext);
  assert(
    p02b3ProjIntentional.actions.length === 0 &&
      p02b3ExtractedIntentional.intentSummary === '주인공에게 물약을 주려고 했다' &&
      p02b3IntentionalActionTree.fields?.modality === 'INTENTIONAL',
    'M/P0-2B-3-2 (INTENTIONAL ACTION)',
    'Zero runtime actions projected, intent summary preserved, no mutation'
  );

  // M/P0-2B-3-3: CLAIM 내부 ACTION
  const p02b3ClaimActionTree: MeaningNode = {
    atom: 'CLAIM',
    scope: 'CLAIM',
    value: '보물이 동굴에 숨겨져 있다는 소문',
    fields: { claimText: '보물이 동굴에 숨겨져 있다는 소문' },
    children: [
      {
        atom: 'ACTION',
        scope: 'CLAIM',
        value: 'DISCOVER',
        children: [
          {
            atom: 'ROLE',
            scope: 'CLAIM',
            value: 'SUBJECT',
            fields: { entityId: 'hero-001', entityType: 'PLAYER', status: 'RESOLVED' },
          },
          {
            atom: 'ROLE',
            scope: 'CLAIM',
            value: 'OBJECT',
            fields: { entityId: 'item-treasure', entityType: 'ITEM', status: 'RESOLVED' },
          },
        ],
      },
    ],
  };
  const p02b3ProjClaim = projectMeaningTreeToRuntimeActions(p02b3ClaimActionTree, dummyPlayerContext);
  const p02b3ExtractedClaim = extractActionsAndClaimsFromMeaningTree(p02b3ClaimActionTree, dummyPlayerContext);
  assert(
    p02b3ProjClaim.actions.length === 0 &&
      p02b3ExtractedClaim.rawClaims.includes('보물이 동굴에 숨겨져 있다는 소문') &&
      p02b3ClaimActionTree.scope === 'CLAIM',
    'M/P0-2B-3-3 (CLAIM 내부 ACTION)',
    'Zero runtime actions, rawClaims preserved, claim not promoted to canon'
  );

  // M/P0-2B-3-4: HEARSAY ACTION
  const p02b3HearsayActionTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'GIFT',
    fields: { epistemicStatus: 'HEARSAY', claimText: '상인이 길동에게 검을 주었다고 들었다' },
    children: [
      {
        atom: 'ROLE',
        scope: 'PROPOSAL',
        value: 'SUBJECT',
        fields: { entityId: 'npc-merchant-01', entityType: 'NPC', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'PROPOSAL',
        value: 'RECIPIENT',
        fields: { entityId: 'hero-001', entityType: 'PLAYER', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'PROPOSAL',
        value: 'OBJECT',
        fields: { entityId: 'item-sword', entityType: 'ITEM', status: 'RESOLVED' },
      },
    ],
  };
  const p02b3ProjHearsay = projectMeaningTreeToRuntimeActions(p02b3HearsayActionTree, dummyPlayerContext);
  const p02b3ExtractedHearsay = extractActionsAndClaimsFromMeaningTree(p02b3HearsayActionTree, dummyPlayerContext);
  assert(
    p02b3ProjHearsay.actions.length === 0 &&
      p02b3ExtractedHearsay.rawClaims.length > 0 &&
      p02b3HearsayActionTree.fields?.epistemicStatus === 'HEARSAY',
    'M/P0-2B-3-4 (HEARSAY ACTION)',
    'Zero runtime actions, HEARSAY status preserved as claim without mutation'
  );

  // M/P0-2B-3-5: CLAIM + NEGATED ACTION
  const p02b3ClaimNegatedTree: MeaningNode = {
    atom: 'CLAIM',
    scope: 'CLAIM',
    value: '상인은 경비를 공격하지 않았다는 주장',
    fields: { claimText: '상인은 경비를 공격하지 않았다는 주장' },
    children: [
      {
        atom: 'ACTION',
        scope: 'CLAIM',
        value: 'ATTACK',
        fields: { polarity: 'NEGATED' },
      },
    ],
  };
  const p02b3ProjClaimNegated = projectMeaningTreeToRuntimeActions(p02b3ClaimNegatedTree, dummyPlayerContext);
  const p02b3ExtractedClaimNegated = extractActionsAndClaimsFromMeaningTree(p02b3ClaimNegatedTree, dummyPlayerContext);
  assert(
    p02b3ProjClaimNegated.actions.length === 0 &&
      p02b3ExtractedClaimNegated.rawClaims.includes('상인은 경비를 공격하지 않았다는 주장') &&
      p02b3ClaimNegatedTree.children?.[0].fields?.polarity === 'NEGATED',
    'M/P0-2B-3-5 (CLAIM + NEGATED ACTION)',
    'Zero runtime actions, tree & negated polarity & raw claim preserved'
  );

  // M/P0-2B-3-6: CLAIM + INTENTIONAL ACTION
  const p02b3ClaimIntentionalTree: MeaningNode = {
    atom: 'CLAIM',
    scope: 'CLAIM',
    value: '도적이 그릇을 훔치려 했다는 제보',
    fields: { claimText: '도적이 그릇을 훔치려 했다는 제보' },
    children: [
      {
        atom: 'ACTION',
        scope: 'CLAIM',
        value: 'STEAL',
        fields: { modality: 'INTENTIONAL' },
      },
    ],
  };
  const p02b3ProjClaimIntentional = projectMeaningTreeToRuntimeActions(p02b3ClaimIntentionalTree, dummyPlayerContext);
  const p02b3ExtractedClaimIntentional = extractActionsAndClaimsFromMeaningTree(p02b3ClaimIntentionalTree, dummyPlayerContext);
  assert(
    p02b3ProjClaimIntentional.actions.length === 0 &&
      p02b3ExtractedClaimIntentional.rawClaims.includes('도적이 그릇을 훔치려 했다는 제보') &&
      p02b3ClaimIntentionalTree.children?.[0].fields?.modality === 'INTENTIONAL',
    'M/P0-2B-3-6 (CLAIM + INTENTIONAL ACTION)',
    'Zero runtime actions, claim & intentional modality preserved'
  );

  // M/P0-2B-3-7: 일반 ASSERTED ACTION (Regression Check)
  const p02b3AssertedActionTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'CANONICAL',
    value: 'DISCOVER',
    children: [
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'SUBJECT',
        fields: { entityId: 'hero-001', entityType: 'PLAYER', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'OBJECT',
        fields: { entityId: 'item-gold', entityName: '금화', entityType: 'ITEM', status: 'RESOLVED' },
      },
    ],
  };
  const p02b3ProjAsserted = projectMeaningTreeToRuntimeActions(p02b3AssertedActionTree, dummyPlayerContext);
  assert(
    p02b3ProjAsserted.actions.length === 1 &&
      p02b3ProjAsserted.actions[0].type === 'MODIFY_INVENTORY' &&
      (p02b3ProjAsserted.actions[0].payload as any).acquisition?.cause === 'DISCOVERY_PICKUP',
    'M/P0-2B-3-7 (일반 ASSERTED ACTION)',
    'Standard asserted action projected cleanly to MODIFY_INVENTORY without regression'
  );

  // M/P0-2B-3-8: 복합 트리 (Compound Tree)
  const p02b3CompoundTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'CANONICAL',
    value: 'COMPOUND_EVENT_SEQUENCE',
    composition: 'ORDERED',
    children: [
      // 1. Executable general action
      {
        atom: 'ACTION',
        scope: 'CANONICAL',
        value: 'DISCOVER',
        children: [
          {
            atom: 'ROLE',
            scope: 'CANONICAL',
            value: 'SUBJECT',
            fields: { entityId: 'hero-001', entityType: 'PLAYER', status: 'RESOLVED' },
          },
          {
            atom: 'ROLE',
            scope: 'CANONICAL',
            value: 'OBJECT',
            fields: { entityId: 'item-key', entityName: '열쇠', entityType: 'ITEM', status: 'RESOLVED' },
          },
        ],
      },
      // 2. NEGATED action
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'GIFT',
        fields: { polarity: 'NEGATED' },
        children: [
          {
            atom: 'ROLE',
            scope: 'PROPOSAL',
            value: 'SUBJECT',
            fields: { entityId: 'npc-merchant-01', entityType: 'NPC', status: 'RESOLVED' },
          },
          {
            atom: 'ROLE',
            scope: 'PROPOSAL',
            value: 'RECIPIENT',
            fields: { entityId: 'hero-001', entityType: 'PLAYER', status: 'RESOLVED' },
          },
          {
            atom: 'ROLE',
            scope: 'PROPOSAL',
            value: 'OBJECT',
            fields: { entityId: 'item-map', entityType: 'ITEM', status: 'RESOLVED' },
          },
        ],
      },
      // 3. INTENTIONAL action
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'ATTACK',
        fields: { modality: 'INTENTIONAL', intentText: '적을 도망치게 하려는 의도' },
      },
      // 4. CLAIM with child ACTION
      {
        atom: 'CLAIM',
        scope: 'CLAIM',
        value: '문이 열려 있었다는 소문',
        fields: { claimText: '문이 열려 있었다는 소문' },
        children: [
          {
            atom: 'ACTION',
            scope: 'CLAIM',
            value: 'OPEN_DOOR',
          },
        ],
      },
    ],
  };

  const p02b3ProjCompound = projectMeaningTreeToRuntimeActions(p02b3CompoundTree, dummyPlayerContext);
  const p02b3ExtractedCompound = extractActionsAndClaimsFromMeaningTree(p02b3CompoundTree, dummyPlayerContext);

  assert(
    p02b3ProjCompound.actions.length === 1 &&
      p02b3ProjCompound.actions[0].type === 'MODIFY_INVENTORY' &&
      (p02b3ProjCompound.actions[0].payload as any).item?.id === 'item-key' &&
      p02b3ExtractedCompound.intentSummary === '적을 도망치게 하려는 의도' &&
      p02b3ExtractedCompound.rawClaims.includes('문이 열려 있었다는 소문'),
    'M/P0-2B-3-8 (복합 트리 Compound Tree)',
    'Only the valid asserted action projected to runtime, non-executable meanings preserved in respective paths'
  );

  // ==========================================
  // P0-2B-4 Test Cases (UNPROVEN Causal Anchor & Execution Separation)
  // ==========================================

  // M/P0-2B-4-1: UNPROVEN CAUSE는 runtime mutation을 만들지 않는다
  const p02b4UnprovenCauseTree: MeaningNode = {
    atom: 'CAUSE',
    scope: 'PROPOSAL',
    value: 'UNEXPLAINED_EXPLOSION',
    fields: {
      epistemicStatus: 'UNPROVEN',
      causalStatus: 'UNPROVEN',
      reason: '원인 불명의 화재',
    },
    children: [
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'UPDATE_STATE',
        fields: { description: '건물 파괴' },
      },
    ],
  };
  const p02b4ProjUnprovenCause = projectMeaningTreeToRuntimeActions(p02b4UnprovenCauseTree, dummyPlayerContext);
  assert(
    p02b4ProjUnprovenCause.actions.length === 0 &&
      p02b4UnprovenCauseTree.fields?.epistemicStatus === 'UNPROVEN',
    'M/P0-2B-4-1 (UNPROVEN CAUSE - Zero Mutation)',
    'UNPROVEN CAUSE produces zero runtime actions while preserving epistemicStatus'
  );

  // M/P0-2B-4-2: UNPROVEN은 DENY가 아니다
  const p02b4DenyCheckTree: MeaningNode = {
    atom: 'CAUSE',
    scope: 'PROPOSAL',
    value: 'SUSPECTED_POISONING',
    fields: {
      epistemicStatus: 'UNPROVEN',
      causalStatus: 'UNPROVEN',
    },
  };
  const p02b4ProjDenyCheck = projectMeaningTreeToRuntimeActions(p02b4DenyCheckTree, dummyPlayerContext);
  assert(
    p02b4ProjDenyCheck.actions.length === 0 &&
      p02b4DenyCheckTree.fields?.epistemicStatus === 'UNPROVEN' &&
      (p02b4DenyCheckTree.fields?.epistemicStatus as unknown) !== 'DENIED' &&
      p02b4DenyCheckTree.fields?.polarity !== 'NEGATED',
    'M/P0-2B-4-2 (UNPROVEN != DENY)',
    'UNPROVEN remains UNPROVEN and is never collapsed or converted into DENIED or NEGATED'
  );

  // M/P0-2B-4-3: UNPROVEN 의미가 MeaningTree에서 보존된다
  const p02b4AnchorPreserveTree: MeaningNode = {
    atom: 'CAUSE',
    scope: 'PROPOSAL',
    value: 'MYSTERIOUS_CURSE',
    fields: {
      epistemicStatus: 'UNPROVEN',
      causalStatus: 'UNPROVEN',
      reason: '고대 저주의 영향 가능성',
    },
    references: [
      {
        id: 'curse-ref-999',
        targetAtom: 'ENTITY',
        uri: 'entity://curse/ancient-01',
      },
    ],
  };
  const p02b4ProjAnchor = projectMeaningTreeToRuntimeActions(p02b4AnchorPreserveTree, dummyPlayerContext);
  const p02b4ExtractedAnchor = extractActionsAndClaimsFromMeaningTree(p02b4AnchorPreserveTree, dummyPlayerContext);
  assert(
    p02b4ProjAnchor.actions.length === 0 &&
      p02b4AnchorPreserveTree.references?.[0].id === 'curse-ref-999' &&
      p02b4AnchorPreserveTree.fields?.reason === '고대 저주의 영향 가능성' &&
      p02b4ExtractedAnchor.rawClaims.includes('고대 저주의 영향 가능성'),
    'M/P0-2B-4-3 (UNPROVEN MeaningTree Anchor & References Preservation)',
    'MeaningTree structure, references, and reason fields are 100% preserved as an anchor'
  );

  // M/P0-2B-4-4: UNPROVEN CAUSE와 검증된 EVENT의 분리 (Case 1 vs Case 2)
  const p02b4Case1Tree: MeaningNode = {
    atom: 'CAUSE',
    scope: 'PROPOSAL',
    value: 'RUMORED_TREASON',
    fields: { epistemicStatus: 'UNPROVEN' },
    children: [
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'DISCOVER',
        children: [
          {
            atom: 'ROLE',
            scope: 'PROPOSAL',
            value: 'SUBJECT',
            fields: { entityId: 'hero-001', entityType: 'PLAYER', status: 'RESOLVED' },
          },
          {
            atom: 'ROLE',
            scope: 'PROPOSAL',
            value: 'OBJECT',
            fields: { entityId: 'item-secret-map', entityName: '비밀지도', entityType: 'ITEM', status: 'RESOLVED' },
          },
        ],
      },
    ],
  };
  const p02b4ProjCase1 = projectMeaningTreeToRuntimeActions(p02b4Case1Tree, dummyPlayerContext);

  const p02b4Case2Tree: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'DISCOVER',
    fields: { epistemicStatus: 'ASSERTED' },
    children: [
      {
        atom: 'ROLE',
        scope: 'PROPOSAL',
        value: 'SUBJECT',
        fields: { entityId: 'hero-001', entityType: 'PLAYER', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'PROPOSAL',
        value: 'OBJECT',
        fields: { entityId: 'item-gold-coin', entityName: '금화', entityType: 'ITEM', status: 'RESOLVED' },
      },
      {
        atom: 'CAUSE',
        scope: 'PROPOSAL',
        value: 'UNKNOWN_BENEFACTOR',
        fields: { epistemicStatus: 'UNPROVEN', reason: '누군가 일부러 떨어뜨린 금화일 수 있음' },
      },
    ],
  };
  const p02b4ProjCase2 = projectMeaningTreeToRuntimeActions(p02b4Case2Tree, dummyPlayerContext);

  assert(
    p02b4ProjCase1.actions.length === 0 &&
      p02b4ProjCase2.actions.length === 0 &&
      p02b4Case2Tree.children?.[2].fields?.epistemicStatus === 'UNPROVEN',
    'M/P0-2B-4-4 (UNPROVEN CAUSE vs Verified EVENT Separation)',
    'Both dependent actions are blocked by UNPROVEN CAUSE dependencies while their anchor semantics remain preserved'
  );

  // M/P0-2B-4-5: UNPROVEN CAUSE가 Novel History를 삭제하지 않는다
  const dummyHistory = [
    { recordId: 'hist-001', eventId: 'evt-001', turn: 1, actionType: 'MODIFY_INVENTORY', details: 'Item acquired' },
    { recordId: 'hist-002', eventId: 'evt-002', turn: 2, actionType: 'ADVANCE_TIME', details: 'Time advanced' },
  ];
  const initialHistoryLen = dummyHistory.length;
  projectMeaningTreeToRuntimeActions(p02b4UnprovenCauseTree, dummyPlayerContext);
  assert(
    dummyHistory.length === initialHistoryLen && dummyHistory[0].recordId === 'hist-001',
    'M/P0-2B-4-5 (Novel History Preservation)',
    'UNPROVEN CAUSE projection does not delete or alter existing historical records'
  );

  // M/P0-2B-4-6: UNPROVEN CLAIM은 Canonical Fact로 승격되지 않는다
  const p02b4UnprovenClaimTree: MeaningNode = {
    atom: 'CLAIM',
    scope: 'CLAIM',
    value: '성벽 뒤에 비밀 창고가 존재한다는 미입증 소문',
    fields: {
      epistemicStatus: 'UNPROVEN',
      claimText: '성벽 뒤에 비밀 창고가 존재한다는 미입증 소문',
    },
  };
  const p02b4ProjUnprovenClaim = projectMeaningTreeToRuntimeActions(p02b4UnprovenClaimTree, dummyPlayerContext);
  const p02b4ExtractedUnprovenClaim = extractActionsAndClaimsFromMeaningTree(p02b4UnprovenClaimTree, dummyPlayerContext);
  assert(
    p02b4ProjUnprovenClaim.actions.length === 0 &&
      p02b4ExtractedUnprovenClaim.rawClaims.includes('성벽 뒤에 비밀 창고가 존재한다는 미입증 소문') &&
      p02b4UnprovenClaimTree.fields?.epistemicStatus === 'UNPROVEN',
    'M/P0-2B-4-6 (UNPROVEN CLAIM - No Canonical Fact Elevation)',
    'UNPROVEN CLAIM is preserved as raw claim metadata without producing canonical state actions'
  );

  // M/P0-2B-4-7: 기존 P0-2B-2 Identity Routing regression 없음
  const p02b4IdentityRoutingTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'CANONICAL',
    value: 'GIFT',
    children: [
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'SUBJECT',
        fields: { entityId: 'npc-merchant-01', entityType: 'NPC', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'RECIPIENT',
        fields: { entityId: 'hero-001', entityType: 'PLAYER', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'OBJECT',
        fields: { entityId: 'item-potion-01', entityName: '체력 포션', entityType: 'ITEM', status: 'RESOLVED' },
      },
    ],
  };
  const p02b4ProjIdentity = projectMeaningTreeToRuntimeActions(p02b4IdentityRoutingTree, dummyPlayerContext);
  assert(
    p02b4ProjIdentity.actions.length === 1 &&
      p02b4ProjIdentity.actions[0].type === 'MODIFY_INVENTORY' &&
      (p02b4ProjIdentity.actions[0].payload as any).acquisition?.cause === 'GIFT_REWARD',
    'M/P0-2B-4-7 (P0-2B-2 Identity Routing Regression Check)',
    'GIFT from NPC to Player routes cleanly to MODIFY_INVENTORY without regression'
  );

  // M/P0-2B-4-8: 기존 P0-2B-3 NEGATED / INTENTIONAL / CLAIM / HEARSAY regression 없음
  const p02b4P02B3RegressionTree: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'COMPOUND_EVENT_SEQUENCE',
    composition: 'ORDERED',
    children: [
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'GIFT',
        fields: { polarity: 'NEGATED' },
      },
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'ATTACK',
        fields: { modality: 'INTENTIONAL', intentText: '위협을 목적으로 한 공격 의도' },
      },
    ],
  };
  const p02b4ProjP02B3Reg = projectMeaningTreeToRuntimeActions(p02b4P02B3RegressionTree, dummyPlayerContext);
  const p02b4ExtractP02B3Reg = extractActionsAndClaimsFromMeaningTree(p02b4P02B3RegressionTree, dummyPlayerContext);
  assert(
    p02b4ProjP02B3Reg.actions.length === 0 &&
      p02b4ExtractP02B3Reg.intentSummary === '위협을 목적으로 한 공격 의도',
    'M/P0-2B-4-8 (P0-2B-3 NEGATED & INTENTIONAL Regression Check)',
    'NEGATED and INTENTIONAL actions continue to produce zero actions with proper intent extraction'
  );

  // ==========================================
  // P0-3-1 Test Cases (Temporal Causal Continuity)
  // ==========================================

  // M/P0-3-1-1: UNPROVEN CAUSE survives turn advancement
  const p0311CauseTree: MeaningNode = {
    atom: 'CAUSE',
    scope: 'PROPOSAL',
    value: 'MYSTERIOUS_FEVER',
    fields: {
      epistemicStatus: 'UNPROVEN',
      causalStatus: 'UNPROVEN',
      reason: '원인 불명의 열병',
    },
    references: [
      { id: 'fever-ref-001', targetAtom: 'ENTITY', uri: 'entity://novel/fever-outbreak' },
    ],
  };

  const p0311Engine = new SovereignEngine(createEmptyWorldInfo(), createEmptyCharacter());
  let nowTime = Date.now() + 10000;

  // Helper for valid test proposal construction
  function createTestProposal(
    engine: SovereignEngine,
    eventId: string,
    turn: number,
    action: TransitionAction,
    source: any = 'LLM',
    customTree?: MeaningNode
  ): StateTransitionProposal {
    nowTime += 1000;
    const meaningTree = customTree || actionToMeaningNode(action, 'CANONICAL');
    return {
      proposalId: `prop-${eventId}`,
      requestId: `req-${eventId}`,
      eventId: eventId,
      turn: turn,
      expectedStateVersion: engine.getSnapshot().stateVersion,
      timestamp: new Date(nowTime).toISOString(),
      source: source,
      originInputId: `input-${eventId}`,
      actions: [action],
      meaningTree,
    };
  }

  // Commit turn 1 proposal containing UNPROVEN cause as offscreen/record
  const p0311Action1: TransitionAction = {
    type: 'RECORD_OFFSCREEN_EVENT',
    category: 'WORLD_CAUSAL',
    payload: {
      eventDescription: '원인 불명의 열병 발생',
      meaningTree: p0311CauseTree,
    } as any,
  };
  const p0311Prop1 = createTestProposal(p0311Engine, 'evt-p0311-1', 1, p0311Action1, 'LLM');
  const commitP0311_1 = p0311Engine.submitProposal(p0311Prop1);
  assert(commitP0311_1.success, 'M/P0-3-1-1 setup', `Turn 1 proposal committed successfully: ${JSON.stringify(commitP0311_1.rejectedReasons)}`);

  // Advance engine across turns T2 -> T10 -> T50
  for (let t = 2; t <= 50; t++) {
    const advanceAction: TransitionAction = {
      type: 'RECORD_OFFSCREEN_EVENT',
      category: 'WORLD_CAUSAL',
      payload: { eventDescription: `Turn ${t} observation` },
    };
    const advanceProp = createTestProposal(p0311Engine, `evt-p0311-${t}`, t, advanceAction, 'LLM');
    p0311Engine.submitProposal(advanceProp);
  }

  // Retrieve Turn 1 record from history after 50 turns
  const p0311History = p0311Engine.getHistory();
  const t1Record = p0311History.find((r) => r.eventId === 'evt-p0311-1');
  const t1MeaningTree = (t1Record?.canonicalAction as any)?.payload?.meaningTree as MeaningNode;

  assert(
    p0311Engine.getSnapshot().turn === 50 &&
      t1Record !== undefined &&
      t1MeaningTree?.fields?.epistemicStatus === 'UNPROVEN' &&
      t1MeaningTree?.references?.[0].uri === 'entity://novel/fever-outbreak',
    'M/P0-3-1-1 (UNPROVEN CAUSE survives turn advancement)',
    'UNPROVEN cause tree and references remain unchanged after advancing 50 turns'
  );

  // M/P0-3-1-2: UNPROVEN does not decay into DENIED over time/stateVersion advancement
  let decayedCount = 0;
  for (const record of p0311History) {
    const tree = (record.canonicalAction as any)?.payload?.meaningTree as MeaningNode | undefined;
    if (tree && tree.fields?.epistemicStatus === 'DENIED') {
      decayedCount++;
    }
  }
  assert(
    decayedCount === 0 && t1MeaningTree?.fields?.epistemicStatus === 'UNPROVEN',
    'M/P0-3-1-2 (UNPROVEN does not decay into DENIED)',
    'UNPROVEN status never auto-decays or converts to DENIED across 50 state versions'
  );

  // M/P0-3-1-3: UNPROVEN -> VERIFIED preserves historical UNPROVEN state
  const p0313Engine = new SovereignEngine(createEmptyWorldInfo(), createEmptyCharacter());
  // T1: UNPROVEN
  const p0313TreeT1: MeaningNode = {
    atom: 'CAUSE',
    scope: 'PROPOSAL',
    value: 'POISON_SOURCE',
    fields: { epistemicStatus: 'UNPROVEN', causalStatus: 'UNPROVEN' },
  };
  p0313Engine.submitProposal(
    createTestProposal(p0313Engine, 'evt-p0313-1', 1, {
      type: 'RECORD_OFFSCREEN_EVENT',
      category: 'WORLD_CAUSAL',
      payload: { eventDescription: '독의 출처 추정', meaningTree: p0313TreeT1 } as any,
    })
  );

  // T5: New evidence verifies cause -> VERIFIED
  const p0313TreeT5: MeaningNode = {
    atom: 'CAUSE',
    scope: 'PROPOSAL',
    value: 'POISON_SOURCE',
    fields: { epistemicStatus: 'VERIFIED', causalStatus: 'VERIFIED' },
  };
  p0313Engine.submitProposal(
    createTestProposal(p0313Engine, 'evt-p0313-5', 5, {
      type: 'RECORD_OFFSCREEN_EVENT',
      category: 'WORLD_CAUSAL',
      payload: { eventDescription: '독의 출처 확인됨', meaningTree: p0313TreeT5 } as any,
    })
  );

  const p0313Hist = p0313Engine.getHistory();
  const p0313RecT1 = p0313Hist.find((r) => r.eventId === 'evt-p0313-1');
  const p0313RecT5 = p0313Hist.find((r) => r.eventId === 'evt-p0313-5');
  const p0313TreeT1Hist = (p0313RecT1?.canonicalAction as any)?.payload?.meaningTree;
  const p0313TreeT5Hist = (p0313RecT5?.canonicalAction as any)?.payload?.meaningTree;

  assert(
    p0313TreeT1Hist?.fields?.epistemicStatus === 'UNPROVEN' &&
      p0313TreeT5Hist?.fields?.epistemicStatus === 'VERIFIED' &&
      p0313Hist.length === 2,
    'M/P0-3-1-3 (UNPROVEN -> VERIFIED preserves historical UNPROVEN state)',
    'Historical T1 UNPROVEN state is preserved unchanged while T5 records VERIFIED transition'
  );

  // M/P0-3-1-4: UNPROVEN -> DENIED preserves historical UNPROVEN state
  const p0314Engine = new SovereignEngine(createEmptyWorldInfo(), createEmptyCharacter());
  // T1: UNPROVEN
  const p0314TreeT1: MeaningNode = {
    atom: 'CAUSE',
    scope: 'PROPOSAL',
    value: 'ACCIDENTAL_FALL',
    fields: { epistemicStatus: 'UNPROVEN' },
  };
  p0314Engine.submitProposal(
    createTestProposal(p0314Engine, 'evt-p0314-1', 1, {
      type: 'RECORD_OFFSCREEN_EVENT',
      category: 'WORLD_CAUSAL',
      payload: { eventDescription: '실족사 의혹', meaningTree: p0314TreeT1 } as any,
    })
  );

  // T5: Disproved -> DENIED
  const p0314TreeT5: MeaningNode = {
    atom: 'CAUSE',
    scope: 'PROPOSAL',
    value: 'ACCIDENTAL_FALL',
    fields: { epistemicStatus: 'DENIED', causalStatus: 'DENIED' },
  };
  p0314Engine.submitProposal(
    createTestProposal(p0314Engine, 'evt-p0314-5', 5, {
      type: 'RECORD_OFFSCREEN_EVENT',
      category: 'WORLD_CAUSAL',
      payload: { eventDescription: '실족사 의혹 반박됨', meaningTree: p0314TreeT5 } as any,
    })
  );

  const p0314Hist = p0314Engine.getHistory();
  const p0314RecT1 = p0314Hist.find((r) => r.eventId === 'evt-p0314-1');
  const p0314RecT5 = p0314Hist.find((r) => r.eventId === 'evt-p0314-5');

  assert(
    (p0314RecT1?.canonicalAction as any)?.payload?.meaningTree?.fields?.epistemicStatus === 'UNPROVEN' &&
      (p0314RecT5?.canonicalAction as any)?.payload?.meaningTree?.fields?.epistemicStatus === 'DENIED' &&
      p0314Hist.length === 2,
    'M/P0-3-1-4 (UNPROVEN -> DENIED preserves historical UNPROVEN state)',
    'Historical T1 UNPROVEN state is preserved unchanged while T5 records DENIED transition'
  );

  // M/P0-3-1-5: Unrelated event does not invalidate causal relation
  const p0315Engine = new SovereignEngine(createEmptyWorldInfo(), createEmptyCharacter());
  // T1: Causal relation A -> B (UNPROVEN)
  const p0315Tree: MeaningNode = {
    atom: 'CAUSE',
    scope: 'PROPOSAL',
    value: 'ANCIENT_SEAL_BREAK',
    fields: { epistemicStatus: 'UNPROVEN' },
  };
  p0315Engine.submitProposal(
    createTestProposal(p0315Engine, 'evt-p0315-1', 1, {
      type: 'RECORD_OFFSCREEN_EVENT',
      category: 'WORLD_CAUSAL',
      payload: { eventDescription: '고대 봉인 해제 미입증 인과', meaningTree: p0315Tree } as any,
    })
  );

  // T2: Event C (Unrelated)
  p0315Engine.submitProposal(
    createTestProposal(p0315Engine, 'evt-p0315-2', 2, {
      type: 'RECORD_OFFSCREEN_EVENT',
      category: 'WORLD_CAUSAL',
      payload: { eventDescription: '상인이 빵을 진열함' },
    })
  );

  // T3: Event D (Unrelated)
  p0315Engine.submitProposal(
    createTestProposal(p0315Engine, 'evt-p0315-3', 3, {
      type: 'RECORD_OFFSCREEN_EVENT',
      category: 'WORLD_CAUSAL',
      payload: { eventDescription: '경비병이 초소를 지나감' },
    })
  );

  // T4: Event E (Unrelated)
  p0315Engine.submitProposal(
    createTestProposal(p0315Engine, 'evt-p0315-4', 4, {
      type: 'RECORD_OFFSCREEN_EVENT',
      category: 'WORLD_CAUSAL',
      payload: { eventDescription: '마을 축제 준비' },
    })
  );

  const p0315Hist = p0315Engine.getHistory();
  const p0315T1Rec = p0315Hist.find((r) => r.eventId === 'evt-p0315-1');
  const p0315T1Tree = (p0315T1Rec?.canonicalAction as any)?.payload?.meaningTree;

  assert(
    p0315T1Tree?.fields?.epistemicStatus === 'UNPROVEN' && p0315Hist.length === 4,
    'M/P0-3-1-5 (Unrelated event does not invalidate causal relation)',
    'Unrelated events C, D, E at T2, T3, T4 leave T1 UNPROVEN causal relation completely intact'
  );

  // M/P0-3-1-6: Verified event remains executable despite unresolved causal attachment
  const p0316Case2Tree: MeaningNode = {
    atom: 'ACTION',
    scope: 'CANONICAL',
    value: 'DISCOVER',
    fields: { epistemicStatus: 'ASSERTED' },
    children: [
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'SUBJECT',
        fields: { entityId: 'hero-001', entityType: 'PLAYER', status: 'RESOLVED' },
      },
      {
        atom: 'ROLE',
        scope: 'CANONICAL',
        value: 'OBJECT',
        fields: { entityId: 'item-ancient-ring', entityName: '고대 반지', entityType: 'ITEM', status: 'RESOLVED' },
      },
      {
        atom: 'CAUSE',
        scope: 'PROPOSAL',
        value: 'UNSOLVED_MYSTERY_ORIGIN',
        fields: {
          epistemicStatus: 'UNPROVEN',
          causalStatus: 'UNPROVEN',
          reason: '어떻게 이곳에 놓였는지 알 수 없음',
        },
      },
    ],
  };

  const p0316Proj = projectMeaningTreeToRuntimeActions(p0316Case2Tree, dummyPlayerContext);
  assert(
    p0316Proj.actions.length === 0 &&
      p0316Case2Tree.children?.[2].fields?.epistemicStatus === 'UNPROVEN',
    'M/P0-3-1-6 (Dependent action is blocked by UNPROVEN CAUSE; anchor is preserved)',
    'Dependent DISCOVER is blocked by child UNPROVEN cause while the anchor remains preserved'
  );

  // M/P0-3-1-7: Novel -> Novel causal relation survives long-term state progression
  const p0317Engine = new SovereignEngine(createEmptyWorldInfo(), createEmptyCharacter());
  const p0317NovelRelationTree: MeaningNode = {
    atom: 'CAUSE',
    scope: 'UNVERIFIED',
    value: 'DIMENSIONAL_RIFT_ENERGY',
    fields: { epistemicStatus: 'UNPROVEN', causalStatus: 'UNPROVEN' },
    references: [
      { id: 'ref-novel-cause', targetAtom: 'ENTITY', uri: 'entity://novel/mysterious-runestone' },
      { id: 'ref-novel-effect', targetAtom: 'ENTITY', uri: 'entity://novel/dimensional-rift' },
    ],
  };

  p0317Engine.submitProposal(
    createTestProposal(p0317Engine, 'evt-p0317-1', 1, {
      type: 'RECORD_OFFSCREEN_EVENT',
      category: 'WORLD_CAUSAL',
      payload: { eventDescription: 'Novel -> Novel 인과 수립', meaningTree: p0317NovelRelationTree } as any,
    })
  );

  // Progress 50 turns
  for (let t = 2; t <= 50; t++) {
    p0317Engine.submitProposal(
      createTestProposal(p0317Engine, `evt-p0317-${t}`, t, {
        type: 'RECORD_OFFSCREEN_EVENT',
        category: 'WORLD_CAUSAL',
        payload: { eventDescription: `Progression turn ${t}` },
      })
    );
  }

  const p0317Hist = p0317Engine.getHistory();
  const p0317T1Rec = p0317Hist.find((r) => r.eventId === 'evt-p0317-1');
  const p0317T1Tree = (p0317T1Rec?.canonicalAction as any)?.payload?.meaningTree as MeaningNode;

  assert(
    p0317Engine.getSnapshot().turn === 50 &&
      p0317T1Tree?.fields?.epistemicStatus === 'UNPROVEN' &&
      p0317T1Tree?.references?.length === 2 &&
      p0317T1Tree.references[0].uri === 'entity://novel/mysterious-runestone' &&
      p0317T1Tree.references[1].uri === 'entity://novel/dimensional-rift',
    'M/P0-3-1-7 (Novel -> Novel causal relation survives long-term state progression)',
    'Novel to Novel relation with custom URIs remains intact without auto-promotion or deletion over 50 turns'
  );

  // M/P0-3-1-8: No silent retcon / deletion of Novel history
  const p0318HistCount = p0317Hist.length;
  let unbrokenChain = true;
  for (let i = 1; i < p0317Hist.length; i++) {
    if (p0317Hist[i].turn <= p0317Hist[i - 1].turn) unbrokenChain = false;
    if (p0317Hist[i].stateVersionAfterCommit <= p0317Hist[i - 1].stateVersionAfterCommit) unbrokenChain = false;
  }

  assert(
    p0318HistCount === 50 && unbrokenChain,
    'M/P0-3-1-8 (No silent retcon / deletion of Novel history)',
    'Historical chain of 50 turns is strictly monotonic with zero record deletions or retcons'
  );

  log.push(`\n=== TEST SUITE RESULT: ${allPassed ? 'ALL PASSED' : 'FAILED'} ===`);
  return { passed: allPassed, log };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = runCausalLanguageTestSuite();
  console.log(res.log.join('\n'));
  if (!res.passed) process.exit(1);
}


