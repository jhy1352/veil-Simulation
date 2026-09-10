import {
  SemanticEvent,
  validateActionSignature,
  compileSemanticEventsToMeaningTree,
} from './causalCompiler';
import {
  projectMeaningTreeToRuntimeActions,
  PlayerIdentityContext,
} from './runtimeProjection';
import { MeaningNode } from './types';

console.log('===================================================================');
console.log(' ROLE RED-TEAM SUITE REPORT');
console.log('===================================================================\n');

const dummyContext: PlayerIdentityContext = {
  characterId: 'hero-001',
  characterName: '플레이어',
  aliases: ['플레이어', '주인공', '나', 'hero-001'],
};

// =========================================================================
// Attack A: 동일 ROLE 복수 입력 (Multiple identical roles)
// TARGET 2개를 가진 SemanticEvent 생성
// =========================================================================
console.log('--- Attack A: Duplicate ROLE Input (Multiple TARGETs) ---');
const eventA: SemanticEvent = {
  eventId: 'se-attack-a',
  action: 'UPDATE_STATE',
  roles: [
    { role: 'SUBJECT', entityName: '경비병', status: 'RESOLVED' },
    { role: 'TARGET', entityName: '플레이어', status: 'RESOLVED' },
    { role: 'TARGET', entityName: '상인', status: 'RESOLVED' },
  ],
  scope: 'OFFSCREEN',
  polarity: 'ASSERTED',
  epistemicStatus: 'OBSERVED',
  modality: 'NONE',
};

// 1. 원본 SemanticEvent.roles 배열에 TARGET 2개 존재 확인
const targetRolesA = eventA.roles.filter((r) => r.role === 'TARGET');
console.log(`1. Original roles count for TARGET: ${targetRolesA.length} (Expected: 2)`);

// 2. validateActionSignature() 이후 두 TARGET의 의미 보존 확인
const validationA = validateActionSignature(eventA);
console.log(`2. validateActionSignature result: valid=${validationA.valid}, errors=${JSON.stringify(validationA.errors)}`);

// 3 & 4. MeaningTree에 ROLE/TARGET 2개가 생성되는지, 하나가 다른 하나를 덮어쓰는지 확인
const compiledA = compileSemanticEventsToMeaningTree([eventA]);
let targetNodesA: MeaningNode[] = [];
if (compiledA.meaningTree) {
  const root = compiledA.meaningTree;
  const eventNode = (root.value === 'COMPOUND_EVENT_SEQUENCE' && root.children?.[0]) ? root.children[0] : root;
  targetNodesA = (eventNode?.children || []).filter((c) => c.atom === 'ROLE' && c.value === 'TARGET');
}
console.log(`3 & 4. MeaningTree ROLE/TARGET nodes count: ${targetNodesA.length}`);
targetNodesA.forEach((n, idx) => {
  console.log(`   TARGET[${idx}]: entityName='${n.fields?.entityName}'`);
});

const attackAPassed =
  targetRolesA.length === 2 &&
  validationA.valid &&
  targetNodesA.length === 2 &&
  targetNodesA[0]?.fields?.entityName !== targetNodesA[1]?.fields?.entityName;
console.log(`[RESULT] Attack A Status: ${attackAPassed ? 'PASS' : 'FAIL'}\n`);


// =========================================================================
// Attack B: 명확한 대응관계 (Explicit Binding)
// RECIPIENT=철수, OBJECT=열쇠 / RECIPIENT=영희, OBJECT=은화
// =========================================================================
console.log('--- Attack B: Explicit Binding / Paired Roles ---');
const eventB1: SemanticEvent = {
  eventId: 'se-attack-b-1',
  action: 'GIFT',
  roles: [
    { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
    { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
    { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' },
  ],
  scope: 'OFFSCREEN',
  polarity: 'ASSERTED',
  epistemicStatus: 'OBSERVED',
  modality: 'NONE',
};

const eventB2: SemanticEvent = {
  eventId: 'se-attack-b-2',
  action: 'GIFT',
  roles: [
    { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
    { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
    { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' },
  ],
  scope: 'OFFSCREEN',
  polarity: 'ASSERTED',
  epistemicStatus: 'OBSERVED',
  modality: 'NONE',
};

const compiledB = compileSemanticEventsToMeaningTree([eventB1, eventB2]);
console.log(`Compiled Event B status: ${compiledB.status}`);
let attackBPassed = false;
if (compiledB.meaningTree && compiledB.meaningTree.children) {
  const evNodes = compiledB.meaningTree.children;
  const pair1Roles = evNodes[0]?.children?.filter((c) => c.atom === 'ROLE');
  const pair2Roles = evNodes[1]?.children?.filter((c) => c.atom === 'ROLE');

  const p1Rec = pair1Roles?.find((r) => r.value === 'RECIPIENT')?.fields?.entityName;
  const p1Obj = pair1Roles?.find((r) => r.value === 'OBJECT')?.fields?.entityName;
  const p2Rec = pair2Roles?.find((r) => r.value === 'RECIPIENT')?.fields?.entityName;
  const p2Obj = pair2Roles?.find((r) => r.value === 'OBJECT')?.fields?.entityName;

  console.log(`Pair 1: RECIPIENT=${p1Rec}, OBJECT=${p1Obj}`);
  console.log(`Pair 2: RECIPIENT=${p2Rec}, OBJECT=${p2Obj}`);

  if (p1Rec === '철수' && p1Obj === '열쇠' && p2Rec === '영희' && p2Obj === '은화') {
    attackBPassed = true;
  }
}
console.log(`[RESULT] Attack B Status: ${attackBPassed ? 'PASS' : 'FAIL'}\n`);


// =========================================================================
// Attack C: Unbound / Unpaired Multiple Roles (Intentionally Unbound)
// Single event with RECIPIENT=철수, RECIPIENT=영희, OBJECT=열쇠, OBJECT=은화
// =========================================================================
console.log('--- Attack C: Unbound Multiple Roles (Ambiguous Correspondence) ---');
const eventC: SemanticEvent = {
  eventId: 'se-attack-c',
  action: 'GIFT',
  roles: [
    { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
    { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
    { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
    { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' },
    { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' },
  ],
  scope: 'OFFSCREEN',
  polarity: 'ASSERTED',
  epistemicStatus: 'OBSERVED',
  modality: 'NONE',
};

const validationC = validateActionSignature(eventC);
const compiledC = compileSemanticEventsToMeaningTree([eventC]);
let projectionC = null;
if (compiledC.meaningTree) {
  projectionC = projectMeaningTreeToRuntimeActions(compiledC.meaningTree, dummyContext);
}

console.log(`Validation C: valid=${validationC.valid}, errors=${JSON.stringify(validationC.errors)}`);
console.log(`Compiled C Status: ${compiledC.status}, errors=${JSON.stringify(compiledC.errors)}`);
console.log(`Projection C Actions Count: ${projectionC ? projectionC.actions.length : 0}`);
if (projectionC && projectionC.actions.length > 0) {
  console.log(`Projection C Actions: ${JSON.stringify(projectionC.actions)}`);
}

let attackCPassed = false;
let warningC = '';
if (projectionC && projectionC.actions.length === 0) {
  attackCPassed = true;
  if (validationC.valid && compiledC.status === 'COMPILED') {
    warningC = '[WARNING] Validator/Compiler passed Event C without flagging role correspondence ambiguity (relying on RuntimeProjection Fail-Closed to block execution)!';
    console.log(warningC);
  }
} else if (compiledC.status === 'RECONCILIATION_REQUIRED' || compiledC.status === 'AMBIGUOUS') {
  attackCPassed = true;
} else {
  console.log('[FAIL REASON] Attack C executed or compiled cleanly without flagging structural ambiguity!');
}
console.log(`[RESULT] Attack C Status: ${attackCPassed ? 'PASS' : 'FAIL'}\n`);


// =========================================================================
// Attack D: Map Overwrite Direct Attack (3+ identical ROLEs)
// D: TARGET=A (AMBIGUOUS), TARGET=B (UNRESOLVED), TARGET=C (RESOLVED)
// D-2: TARGET=C (RESOLVED), TARGET=A (AMBIGUOUS), TARGET=B (UNRESOLVED)
// D-3: TARGET=A (AMBIGUOUS), TARGET=B (RESOLVED)
// D-4: TARGET=A (UNRESOLVED), TARGET=B (RESOLVED)
// =========================================================================
console.log('--- Attack D: Map Overwrite Direct Attack (D, D-2, D-3, D-4) ---');
const eventD: SemanticEvent = {
  eventId: 'se-attack-d',
  action: 'UPDATE_STATE',
  roles: [
    { role: 'TARGET', entityName: '대상A', status: 'AMBIGUOUS' },
    { role: 'TARGET', entityName: '대상B', status: 'UNRESOLVED' },
    { role: 'TARGET', entityName: '대상C', status: 'RESOLVED' },
  ],
  scope: 'OFFSCREEN',
  polarity: 'ASSERTED',
  epistemicStatus: 'OBSERVED',
  modality: 'NONE',
};

const validationD = validateActionSignature(eventD);
console.log(`Validation D Result: valid=${validationD.valid}, errors=${JSON.stringify(validationD.errors)}`);
const attackDPassed = !validationD.valid && validationD.errors.length > 0;
console.log(`[RESULT] Attack D Status: ${attackDPassed ? 'PASS' : 'FAIL'}`);

// D-2: Order reversed
const eventD2: SemanticEvent = {
  eventId: 'se-attack-d2',
  action: 'UPDATE_STATE',
  roles: [
    { role: 'TARGET', entityName: '대상C', status: 'RESOLVED' },
    { role: 'TARGET', entityName: '대상A', status: 'AMBIGUOUS' },
    { role: 'TARGET', entityName: '대상B', status: 'UNRESOLVED' },
  ],
  scope: 'OFFSCREEN',
  polarity: 'ASSERTED',
  epistemicStatus: 'OBSERVED',
  modality: 'NONE',
};
const validationD2 = validateActionSignature(eventD2);
console.log(`Validation D-2 Result: valid=${validationD2.valid}, errors=${JSON.stringify(validationD2.errors)}`);
const attackD2Passed = !validationD2.valid && validationD2.errors.length > 0;
console.log(`[RESULT] Attack D-2 Status: ${attackD2Passed ? 'PASS' : 'FAIL'}`);

// D-3: AMBIGUOUS + RESOLVED
const eventD3: SemanticEvent = {
  eventId: 'se-attack-d3',
  action: 'UPDATE_STATE',
  roles: [
    { role: 'TARGET', entityName: '대상A', status: 'AMBIGUOUS' },
    { role: 'TARGET', entityName: '대상B', status: 'RESOLVED' },
  ],
  scope: 'OFFSCREEN',
  polarity: 'ASSERTED',
  epistemicStatus: 'OBSERVED',
  modality: 'NONE',
};
const validationD3 = validateActionSignature(eventD3);
console.log(`Validation D-3 Result: valid=${validationD3.valid}, errors=${JSON.stringify(validationD3.errors)}`);
const attackD3Passed = !validationD3.valid && validationD3.errors.length > 0;
console.log(`[RESULT] Attack D-3 Status: ${attackD3Passed ? 'PASS' : 'FAIL'}`);

// D-4: UNRESOLVED + RESOLVED
const eventD4: SemanticEvent = {
  eventId: 'se-attack-d4',
  action: 'UPDATE_STATE',
  roles: [
    { role: 'TARGET', entityName: '대상A', status: 'UNRESOLVED' },
    { role: 'TARGET', entityName: '대상B', status: 'RESOLVED' },
  ],
  scope: 'OFFSCREEN',
  polarity: 'ASSERTED',
  epistemicStatus: 'OBSERVED',
  modality: 'NONE',
};
const validationD4 = validateActionSignature(eventD4);
console.log(`Validation D-4 Result: valid=${validationD4.valid}, errors=${JSON.stringify(validationD4.errors)}`);
const attackD4Passed = !validationD4.valid && validationD4.errors.length > 0;
console.log(`[RESULT] Attack D-4 Status: ${attackD4Passed ? 'PASS' : 'FAIL'}\n`);


// =========================================================================
// Attack E: AMBIGUOUS Role Silent Promotion Check
// =========================================================================
console.log('--- Attack E: AMBIGUOUS Role Silent Promotion Check ---');
const eventE: SemanticEvent = {
  eventId: 'se-attack-e',
  action: 'DISCOVER',
  roles: [
    { role: 'SUBJECT', entityName: 'hero-001', entityId: 'hero-001', status: 'RESOLVED' },
    { role: 'OBJECT', entityName: '수상한 상자', status: 'AMBIGUOUS' },
  ],
  scope: 'OFFSCREEN',
  polarity: 'ASSERTED',
  epistemicStatus: 'OBSERVED',
  modality: 'NONE',
};

const validationE = validateActionSignature(eventE);
const compiledE = compileSemanticEventsToMeaningTree([eventE]);

console.log(`Validation E: valid=${validationE.valid}, errors=${JSON.stringify(validationE.errors)}`);
console.log(`Compiled E Status: ${compiledE.status}`);

let attackEPassed = true;
if (compiledE.meaningTree) {
  const objNode = compiledE.meaningTree.children?.find((c) => c.atom === 'ROLE' && c.value === 'OBJECT');
  console.log(`MeaningTree OBJECT status: ${objNode?.fields?.status}`);
  if (objNode?.fields?.status === 'RESOLVED') {
    attackEPassed = false;
    console.log('[FAIL REASON] AMBIGUOUS status was silently promoted to RESOLVED in MeaningTree!');
  }

  const projE = projectMeaningTreeToRuntimeActions(compiledE.meaningTree, dummyContext);
  console.log(`Projected E actions count: ${projE.actions.length}`);
  if (projE.actions.length > 0) {
    attackEPassed = false;
    console.log('[FAIL REASON] Action projected for event with AMBIGUOUS role!');
  }
}
if (compiledE.status !== 'RECONCILIATION_REQUIRED') {
  attackEPassed = false;
  console.log(`[FAIL REASON] Compiler returned status '${compiledE.status}' instead of RECONCILIATION_REQUIRED for AMBIGUOUS role.`);
}
console.log(`[RESULT] Attack E Status: ${attackEPassed ? 'PASS' : 'FAIL'}\n`);


// =========================================================================
// Attack F: Multiple Roles + UNPROVEN Cause
// =========================================================================
console.log('--- Attack F: Multiple Roles + UNPROVEN Cause ---');
const treeF: MeaningNode = {
  id: 'evt-attack-f',
  atom: 'ACTION',
  scope: 'CANONICAL',
  value: 'GIFT',
  fields: { epistemicStatus: 'OBSERVED' },
  children: [
    { atom: 'ROLE', scope: 'CANONICAL', value: 'SUBJECT', fields: { entityId: 'npc-merchant-01', entityType: 'NPC', status: 'RESOLVED' } },
    { atom: 'ROLE', scope: 'CANONICAL', value: 'RECIPIENT', fields: { entityId: 'hero-001', entityType: 'PLAYER', status: 'RESOLVED' } },
    { atom: 'ROLE', scope: 'CANONICAL', value: 'OBJECT', fields: { entityId: 'item-potion-01', entityName: '체력 포션', entityType: 'ITEM', status: 'RESOLVED' } },
    { atom: 'CAUSE', scope: 'CANONICAL', value: 'MYSTERIOUS_MOTIVE', fields: { epistemicStatus: 'UNPROVEN', causalStatus: 'UNPROVEN', reason: '동기 불명' } },
  ],
};

const projF = projectMeaningTreeToRuntimeActions(treeF, dummyContext);
const roleChildrenF = treeF.children?.filter((c) => c.atom === 'ROLE') || [];

console.log(`Tree F Role children count: ${roleChildrenF.length} (Expected: 3)`);
console.log(`Tree F Projected actions count: ${projF.actions.length} (Expected: 0)`);

let attackFPassed = false;
if (roleChildrenF.length === 3 && projF.actions.length === 0) {
  attackFPassed = true;
}
console.log(`[RESULT] Attack F Status: ${attackFPassed ? 'PASS' : 'FAIL'}\n`);

console.log('===================================================================');
console.log(' ROLE RED-TEAM SUITE SUMMARY');
console.log('===================================================================');
console.log(`Attack A (Duplicate ROLE Input): ${attackAPassed ? 'PASS' : 'FAIL'}`);
console.log(`Attack B (Explicit Binding): ${attackBPassed ? 'PASS' : 'FAIL'}`);
console.log(`Attack C (Unbound Multiple Roles): ${attackCPassed ? 'PASS' : 'FAIL'}`);
if (warningC) console.log(`   ${warningC}`);
console.log(`Attack D (Map Overwrite Direct Attack): ${attackDPassed ? 'PASS' : 'FAIL'}`);
console.log(`Attack D-2 (Reversed Order Overwrite): ${attackD2Passed ? 'PASS' : 'FAIL'}`);
console.log(`Attack D-3 (AMBIGUOUS + RESOLVED): ${attackD3Passed ? 'PASS' : 'FAIL'}`);
console.log(`Attack D-4 (UNRESOLVED + RESOLVED): ${attackD4Passed ? 'PASS' : 'FAIL'}`);
console.log(`Attack E (AMBIGUOUS Silent Promotion): ${attackEPassed ? 'PASS' : 'FAIL'}`);
console.log(`Attack F (Multiple Roles + UNPROVEN Cause): ${attackFPassed ? 'PASS' : 'FAIL'}`);
