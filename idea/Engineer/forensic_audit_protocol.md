# TRPG 3.1 — 포렌식 감사 프로토콜 (Forensic Audit Protocol)

본 문서는 TRPG 3.1 Sovereign Engine의 무결성, 신뢰 경계 및 상태 전이 권한을 검증하는 모든 AI 포렌식 감사의 최상위 행동 규약이다.
감사관 및 엔지니어는 시스템의 안전성을 임의로 판정할 권한이 없으며, 오직 실제 실행 증거가 허용하는 범위 내에서만 보고할 수 있다.

---

## 1. 현재 Git HEAD 기준 검증 원칙
- 모든 AI 감사는 **현재 Git HEAD의 실제 코드**를 기준으로 수행한다.
- 이전 감사 보고서나 AI의 구두 설명, 과거 요약본을 현재 코드의 유효한 증거로 재사용하거나 신뢰해서는 안 된다.

## 2. 감사 시작 전 필수 열람
- 실제 감사를 시작할 때 감사관(AI 및 인간)은 **반드시 이 문서를 먼저 열람(Read)**해야 한다.
- 이 프로토콜을 확인하지 못한 상태에서는 어떠한 확정 판정(PASS/FAIL)도 내리지 않는다.

## 3. 전체 코드 및 호출부 완전 확보 원칙
- 긴 파일이나 모듈에 대해 "전체를 확보했다"고 임의로 가정하지 않는다.
- 감사 대상 함수의 **전체 본문**과 **필요한 호출부/실행 경로**를 완전히 확보하여 확인해야 한다.
- Truncation(내용 생략) 또는 미확보 구간이 존재하는 경우 추측하여 메우지 말고 도구를 통해 추가 확보한다.
- 완전한 코드를 확보하지 못한 경우 판정은 반드시 **`INCONCLUSIVE`**로 기록한다.

## 4. 정적 검증과 Runtime 검증의 엄격한 분리
- 정적 코드 분석과 실제 런타임 실행 검증을 명확히 구분한다.
- **실제로 실행하여 확인하지 않은 공격/시나리오는 결코 `PASS`로 판정할 수 없다.**
- Node.js 환경이나 단위 시뮬레이션에서 얻은 결과를 "Browser Runtime PASS" 또는 "실제 클라이언트 통과"로 왜곡하여 표현하지 않는다.

## 5. 실제 코드 경로와 증거 기반 판정
- 모든 감사는 **실제 실행 코드 경로와 캡처된 RAW 증거(Execution Log)**만을 근거로 판정한다.
- 판정 근거가 불충분하거나 증거가 부족한 경우 억지로 PASS 또는 FAIL을 선언하지 말고 **`INCONCLUSIVE`**를 사용한다.

## 6. 감사와 구현의 엄격한 분리 (Separation of Audit and Implementation)
- 감사 단계에서는 제품 코드를 일절 수정하지 않는다.
- 개발 및 보완 주기는 반드시 다음 순서를 준수한다:
  1. **문제 확정 (Defect Identification & Isolation)**
  2. **구현 범위 확정 (Scope Definition)**
  3. **별도 구현 (Targeted Implementation)**
  4. **독립 재검증 (Independent Re-verification)**

## 7. 핵심 신뢰 경계(Trust Boundary) 실 코드 추적 경로
감사 시 반드시 다음 신뢰 경계 파이프라인을 실제 제품 코드로 전수 추적하여 검증한다:

```text
Player Prompt / Action
  ↓
LLM Narrative Reasoning
  ↓
Parser (Metadata / Candidate Extraction)
  ↓
Candidate Packet
  ↓
StateTransitionProposal
  ↓
SOURCE_ACTION_ACL (Source Authority Verification)
  ↓
Engine Validator (Causality Gate, Range, Logic Check)
  ↓
Draft State Evaluation
  ↓
Commit Gate (Atomic Transaction)
  ↓
Canonical World State & Immutable HistoricalRecord
```
