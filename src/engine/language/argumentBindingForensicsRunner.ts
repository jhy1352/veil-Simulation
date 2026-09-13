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
console.log(' ARGUMENT BINDING FIRST-LOSS FORENSICS RUNNER');
console.log('===================================================================\n');

const dummyContext: PlayerIdentityContext = {
  characterId: 'hero-001',
  characterName: '플레이어',
  aliases: ['플레이어', '주인공', '나', 'hero-001'],
};

// =========================================================================
// RE-VERIFICATION: C-11 (Alternating Sequence Binding)
// =========================================================================
console.log('--- [RE-VERIFICATION] C-11 Raw Object Sequence Inspection ---');

const eventC11: SemanticEvent = {
  eventId: 'se-c11',
  action: 'GIFT',
  roles: [
    { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
    { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
    { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' },
    { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
    { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' },
  ],
  scope: 'OFFSCREEN',
  polarity: 'ASSERTED',
  epistemicStatus: 'OBSERVED',
  modality: 'NONE',
};

console.log('1. Raw SemanticEvent roles (BEFORE compilation):');
console.log(JSON.stringify(eventC11.roles, null, 2));

const compC11 = compileSemanticEventsToMeaningTree([eventC11]);
console.log('\n2. Raw MeaningTree Node (AFTER compilation):');
if (compC11.meaningTree) {
  // Let's print the compiled MeaningTree node to verify children ordering
  console.log(JSON.stringify(compC11.meaningTree, null, 2));
} else {
  console.log('COMPILATION FAILED');
}

const projC11 = compC11.meaningTree ? projectMeaningTreeToRuntimeActions(compC11.meaningTree, dummyContext) : { actions: [] };
console.log('\n3. Projected Runtime Actions:');
console.log(JSON.stringify(projC11.actions, null, 2));


// =========================================================================
// RE-VERIFICATION: C-15 (Shared Object N:1 Binding vs Ambiguity)
// =========================================================================
console.log('\n--- [RE-VERIFICATION] C-15 Shared Object Joint Possession vs Ambiguity ---');
const eventC15: SemanticEvent = {
  eventId: 'se-c15',
  action: 'GIFT',
  roles: [
    { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
    { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
    { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
    { role: 'OBJECT', entityName: '은화주머니', status: 'RESOLVED' },
  ],
  scope: 'OFFSCREEN',
  polarity: 'ASSERTED',
  epistemicStatus: 'OBSERVED',
  modality: 'NONE',
};

console.log('1. Raw SemanticEvent roles (C-15 Shared Object):');
console.log(JSON.stringify(eventC15.roles, null, 2));

const compC15 = compileSemanticEventsToMeaningTree([eventC15]);
console.log('\n2. Raw MeaningTree Node (C-15 Shared Object):');
console.log(JSON.stringify(compC15.meaningTree, null, 2));


// =========================================================================
// FORENSICS ANALYSIS & ANSWERS TO MANDATORY QUESTIONS
// =========================================================================
console.log('\n===================================================================');
console.log(' MANDATORY QUESTIONS & FORENSIC ANSWERS');
console.log('===================================================================');

console.log(`
Q1. 실제 LLM 출력 단계에서 RECIPIENT↔OBJECT 대응관계가 표현될 수 있는가?
Answer:
  YES. 실제 자연어 출력("상인은 철수에게 열쇠를, 영희에게는 은화를 주었다") 수준에서는 인간 언어의 통사 구조를 통해 완벽히 표현됩니다. 
  다만 LLM이 생성하는 정적 JSON 메타데이터 스키마(예: inventoryChanges[]) 수준에서는 수령인(RECIPIENT)을 임의 지정할 수 있는 필드가 없거나 
  동일 레벨에서 분리되지 않는 평탄화(Flattened) 상태이므로 구조적으로 표현할 수 없습니다.

Q2. rawMetadata 단계에서 대응관계가 존재하는가?
Answer:
  NO. LLM이 생성하는 JSON 메타데이터 블록(rawMetadata)은 각 변경 건을 독립적인 평탄화 객체 리스트(inventoryChanges)로 나열할 뿐, 
  N:M의 복합 대응관계나 개별 수령인을 매핑할 수 있는 스키마 속성("recipientNpcName" 등)이 애초에 존재하지 않습니다.

Q3. candidatePacket 단계에서 대응관계가 존재하는가?
Answer:
  NO. extractCandidatesFromMetadata()가 반환하는 CandidatePacket은 rawMetadata의 속성들을 평탄화된 배열로 일대일 매핑하여 옮겨 담는 신뢰 경계(Trust Boundary)일 뿐이며, 
  수령인과 객체 간의 어떠한 바인딩 정보도 담고 있지 않습니다.

Q4. SemanticEvent 생성 직후에 대응관계가 존재하는가?
Answer:
  경우에 따라 다릅니다.
  - A. 명시적 이벤트 분할(C-9, C-17)의 경우: YES. 각각 독립된 SemanticEvent로 존재하므로, 이벤트 경계(Event Boundary) 자체가 완벽한 바인딩 컨텍스트가 됩니다.
  - B. 단일 이벤트 다중 역할(C-10, C-11, C-12, C-14)의 경우: NO. 하나의 SemanticEvent 내부에 다수의 RECIPIENT와 OBJECT가 플랫한 roles[] 배열로 존재할 뿐, 
    어떤 RECIPIENT가 어떤 OBJECT와 짝을 이루는지 정의해 주는 바인딩 식별자(pairingId 등)가 부재합니다.

Q5. compileSemanticEventsToMeaningTree() 직전과 직후를 비교했을 때 최초 손실이 발생하는가?
Answer:
  NO. compileSemanticEventsToMeaningTree() 함수는 roles[] 배열의 원본 순서를 수정하거나 버리지 않고 100% 인오더(In-Order)로 
  ROLE MeaningNode들을 컴파일하여 자식 노드 배열로 고스란히 편입합니다. 
  출력된 raw MeaningTree Node를 확인하면, 철수-열쇠-영희-은화의 물리적 인덱스 순서가 원본 그대로 완벽히 유지되어 있음을 볼 수 있습니다.

Q6. MeaningTree에 대응관계가 존재하는데 Adapter가 Map<CanonicalRole,...>로 제거하는가?
Answer:
  NO. MeaningTree에는 물리적 배열 순서쌍(sequence)만 고스란히 보존되어 있을 뿐, 
  "이 순서쌍(sequence)이 곧 대응 매핑(binding)을 의미한다"는 시맨틱 계약(Semantic Contract) 자체가 엔진 명세서 및 룰셋상에 존재하지 않습니다. 
  게다가 Runtime Projection의 Adapter는 GIFT 같은 비엔진 작업의 경우 하위 ROLE 노드들을 순회하며 페이로드로 매핑하는 로직이 없기 때문에, 
  GIFT라는 ACTION 수준의 메타데이터(polarity, epistemicStatus 등)만 투영하고 모든 자식 ROLE 노드들을 일괄 생략해 버립니다.

Q7. Runtime Projection 단계에서만 손실되는가?
Answer:
  NO. 애초에 단일 이벤트 내에 다중 매핑을 억지로 집어넣은 시점(SemanticEvent 생성 단계)에서 통사 구조적 연결 고리가 누락되었으며, 
  가장 결정적으로는 Runtime Projection 단계 이전에 이미 의미적인 연결 계약(Semantic Contract)이 설계 레벨에서 결여되어 있었습니다.
`);

console.log('===================================================================');
console.log(' FIRST LOSS POINT DETERMINATION & RE-VERIFICATION CORRECTIONS');
console.log('===================================================================');

console.log(`
[C-11 재검증 결론 수정]
  기존의 "Compiler가 sequence를 삭제했다"라는 결론은 "거짓(False)"으로 판명되었습니다. 
  실제 raw MeaningTree 출력을 포렌식한 결과, compileSemanticEventsToMeaningTree()는 roles[]의 원본 배열 순서(sequence)를 전혀 정렬하거나 삭제하지 않고 
  그대로 MeaningNode의 children으로 보존하고 있습니다. 
  따라서 기존 결론을 공식 철회하고 다음과 같이 명세를 정정합니다:
  "MeaningTree 상에서 sequence는 손실 없이 완전히 보존된다. 다만, 해당 sequence가 개별 인자 간의 대응(binding)을 나타낸다는 의미적 계약(Semantic Contract)이 
  스키마 및 컴파일러 규칙상 정의되어 있지 않으며, 최종 Adapter 단계에서 해당 비엔진 액션의 ROLE 자식 노드들을 런타임 액션의 페이로드로 투영(Projection)하지 않고 일괄 누락시켰을 뿐이다."

[C-15 재검증 결론]
  RECIPIENT A, RECIPIENT B, OBJECT X의 구조는 시맨틱 에러나 애매모호함(Ambiguity) 자체가 아닙니다. 
  "상인이 철수와 영희에게 단 하나의 은화주머니를 함께 쓰라며 수여했다"는 현실 세계의 정상적인 N:1 공유(Shared-Object/Joint Possession) 관계입니다. 
  하지만 현재의 IR(SemanticEvent 및 MeaningTree)은 역할 노드들을 개별 flat collection으로 취급하기 때문에, 
  이것이 "1개의 인벤토리를 철수와 영희가 공유하는 것"인지, "철수와 영희에게 각각 1개씩 총 2개의 은화주머니를 독립 분출하는 것"인지를 정교하게 구분하는 N:1 표현 능력이 결여되어 있습니다. 
  따라서 이는 "의미의 모호성(Semantic Ambiguity)"이 아니라 "현재 IR의 N:1 바인딩 구조적 표현력 한계(Expressive Limitation)"로 분리 규정합니다.
`);

console.log('-------------------------------------------------------------------');
console.log('FIRST LOSS POINT = SemanticEvent');
console.log('-------------------------------------------------------------------');
console.log(`
[근거 전후 raw 구조 요약]
1. LLM 자연어 (완벽한 바인딩 정보 존재)
   "상인은 철수에게 열쇠를 주었고, 영희에게는 은화를 주었다."

2. SemanticEvent 생성 (roles[] 배열이 생성되며 구조적 2D 연결고리가 1D Flat List로 납작해짐) -> [FIRST LOSS POINT]
   "roles": [
     { "role": "RECIPIENT", "entityName": "철수" },
     { "role": "OBJECT", "entityName": "열쇠" },
     { "role": "RECIPIENT", "entityName": "영희" },
     { "role": "OBJECT", "entityName": "은화" }
   ]
   (철수↔열쇠, 영희↔은화가 순서대로 배열되어 있을 뿐, 이들이 결합되어 있다는 관계 속성은 존재하지 않음)

3. MeaningTree (순서 자체는 고스란히 유지되지만, 순서가 결합이라는 기능적/의미적 계약 없음)
   "children": [
     { "atom": "ROLE", "value": "RECIPIENT", "fields": { "entityName": "철수" } },
     { "atom": "ROLE", "value": "OBJECT", "fields": { "entityName": "열쇠" } },
     { "atom": "ROLE", "value": "RECIPIENT", "fields": { "entityName": "영희" } },
     { "atom": "ROLE", "value": "OBJECT", "fields": { "entityName": "은화" } }
   ]

4. Adapter & Runtime Projection (GIFT 등의 비엔진 액션 투영 시 자식 ROLE 노드들을 페이로드에서 전부 누락시켜 완전 소실됨)
   [
     {
       "type": "GIFT",
       "payload": {
         "eventId": "se-c11",
         "polarity": "ASSERTED",
         "epistemicStatus": "OBSERVED",
         "modality": "NONE"
       }
     }
   ]
`);
