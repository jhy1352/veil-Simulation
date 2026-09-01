생동감있는 세계를 구현하기 위한 월드 시뮬레이션 요소

1. 현재 엔진 구조
2. Canonical State 구조
3. History 구조
4. Identity 구조
5. Recovery Gate 구조
6. Index / Retrieval 구조
7. LLM ↔ Engine 권한 경계
8. Information Asymmetry 경계
9. 이미 존재하는 벽돌
10. 확인된 결함
11. 아직 판정 보류인 위험
12. 월드 시뮬레이션 구현 시 지켜야 할 불변식
-World Memory Access Rule: LLM의 역사·세계 메모리 열람은 Recovery Gate 권위경계 내부에서만 수행한다. LLM은 직접 History/Index를 검색하거나 원본 Canonical 데이터를 읽지 않는다. Recovery Gate의 부속 Historical Index/Translation Layer가 요청된 정보만 검수·Engine Language로 변환하여 LLM에 projection한다.
14. 아직 구현하지 않은 미래 설계



FORENSIC BASELINE — 현재 코드 기준


Canonical State
Entity Identity
History
Index / Retrieval
Recovery Gate
LLM ↔ Engine 권한 경계
Information Asymmetry
확인된 구현
실제 코드에 존재하는 기능
이미 구현되어 있으나 아직 실사용되지 않는 벽돌
현재 데이터 흐름과 연결점
확정 결함
Inventory identity continuity
OVERWRITE_CHARACTER identity 보존
OVERWRITE_WORLD_INFO entity continuity
Recovery EOF 문자열 자동 종료
History shallow freeze
아직 검증이 필요한 것
innerThought → Index → Retrieval → LLM 실제 노출 경로
stale 판정
ORDERED / UNORDERED semantics
offscreen event 이중 표현
Math.random() fallback의 현재 HEAD 존재 여부
World Simulation 구현 원칙
Engine이 Canonical truth의 권위를 유지
LLM은 능동적 Narrative Reasoning Layer
Engine은 서사를 제시하거나 선택하지 않음
Retrieval은 LLM 대신 허용된 역사 정보만 projection
History는 immutable
Entity identity는 장기간 보존
정보비대칭은 retrieval 단계에서도 유지
Recovery는 문법만 복구하고 의미를 발명하지 않음
미래 설계와 현재 구현의 구분
이미 코드에 있는 것
구현은 되어 있지만 연결되지 않은 것
아직 아이디어인 것
