# HUMAN NARRATIVE DB

Human Narrative Prior / Human Narrative Differential Modeling 조사 결과의 누적 저장소.

## 원칙

- 작품 자체의 줄거리 백과사전이 아니라 인간 서사 구조의 관찰 DB다.
- 모든 분석기는 동일한 DB 좌표계로 정규화한다.
- 최소 원자 단위는 `PRE_STATE → EVENT → POST_STATE → ΔSTATE`다.
- 가능한 경우 `Δ²STATE`, `ACCUMULATION`, `TRAJECTORY`를 함께 기록한다.
- `STRUCTURE`, `MECHANISM`, `VARIATION/DETAIL`을 분리한다.
- RAW OBSERVATION과 STRUCTURAL INTERPRETATION을 분리한다.
- FACT / INFERENCE / HYPOTHESIS / UNKNOWN을 구분한다.
- 작품별 변수는 자동으로 canonical variable이 되지 않는다.
- cross-work promotion은 누적 비교 후 별도로 판정한다.
- 모델이 제공하지 않은 데이터는 추정해서 채우지 않는다.
- 원작 표현을 복제하지 않고 추상화된 구조와 기능을 중심으로 저장한다.

## 현재 수록

| DB ID | Analyzer | Work | Source Status | 상태 |
|---|---|---|---|---|
| GPT-MM-E01 | GPT | Middlemarch | FULL_TEXT (분석 결과에 기재된 상태) | 수록 |
| GEMINI-WP-E01 | Gemini | War and Peace | MEMORY | 수록 |
| QWEN-HL-E01 | Qwen | Dream of the Red Chamber | 미수록 | 결과 대기 |

`War and Peace`가 두 번 배정된 것으로 해석하지 않는다. 현재 배정은 GPT→Middlemarch, Gemini→War and Peace, Qwen→Dream of the Red Chamber다.
