# P0-2A SemanticEvent -> MeaningTree Semantic Preservation Report

## 1. 개요
VEIL Causal Language V1 P0-2A 단계 구현 완료 보고서.
SemanticEvent에서 MeaningTree로의 컴파일 과정에서 발생하는 의미 손실(Semantic Loss)을 기존 11 Core Atoms와 Grammar 규칙을 엄격히 준수하여 해결함.

## 2. 변경 파일
- `src/engine/language/causalCompiler.ts`:
  - `compileSemanticEventsToMeaningTree()`: SemanticEvent의 states, relations, values, times, causes, constraints를 MeaningNode의 허용된 Core Atom 자식 노드(`STATE`, `RELATION`, `VALUE`, `TIME`, `CAUSE`, `CONSTRAINT`)로 컴파일 매핑.
  - `ev.references`를 MeaningNode의 1급 필드 `references`로 전달 보존.
  - `intent`, `temporalPrecision`, `literalness` 메타데이터 속성을 `fields`에 보존.
- `src/engine/language/causalLanguageTest.ts`:
  - Case J (P0-2A 11 Core Atoms & References 전방위 보존 검증).
  - Case K (P0-2A MeaningTree 직렬화 및 역직렬화 라운드트립 의미 불변성 검증).
  - Case L (DISCOVER vs GIFT vs NEGATED GIFT vs INTENTIONAL GIFT vs HEARSAY CLAIM 5중 의미 구별 검증).

## 3. SemanticEvent -> MeaningTree 매핑 매트릭스
| SemanticEvent Field | MeaningNode Representation | Preserved? |
|---|---|---|
| eventId | MeaningNode.id & fields.eventId | YES |
| action | MeaningNode.atom='ACTION', value=action | YES |
| roles | Child MeaningNode.atom='ROLE' -> 'ENTITY' | YES |
| states | Child MeaningNode.atom='STATE' | YES |
| relations | Child MeaningNode.atom='RELATION' | YES |
| values | Child MeaningNode.atom='VALUE' | YES |
| times | Child MeaningNode.atom='TIME' | YES |
| causes | Child MeaningNode.atom='CAUSE' | YES |
| constraints | Child MeaningNode.atom='CONSTRAINT' | YES |
| intent | fields.intent | YES |
| scope | MeaningNode.scope | YES |
| polarity | fields.polarity | YES |
| epistemicStatus | fields.epistemicStatus | YES |
| modality | fields.modality | YES |
| provenance | fields.provenance | YES |
| references | MeaningNode.references | YES |
| temporalPrecision | fields.temporalPrecision & TIME child | YES |
| literalness | fields.literalness | YES |

## 4. 테스트 결과
- `causalLanguageTest.ts`: Cases A-L 전부 통과 (12/12 PASS).
- `causalAuthorityRegressionTest.ts`: Cases 1-9 전부 통과 (9/9 PASS).
- Serialization Round-Trip: PASS.
- 5-Way Core Semantic Discrimination: PASS.
