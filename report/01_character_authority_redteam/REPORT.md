# VEIL — Character MeaningTree Authority 최종 레드팀 검증 보고서

- **검증 일시**: 2026-08-30
- **검증 대상**: `main` HEAD (`src/App.tsx`, `src/engine/language/`, `src/engine/validator.ts`, `src/engine/engine.ts`)
- **실행 환경**: Node.js v20.x, TypeScript (tsx)
- **보존 위치**: `/report/01_character_authority_redteam/REPORT.md`, `/report/01_character_authority_redteam/raw_attack_evidence.json`

---

## 1. Executive Summary & Forensic Verdict

본 보고서는 `handleUpdateCharacter()`의 `MeaningTree` Authority migration 작업에 대해 독립적인 파괴적 레드팀 공격 및 프로덕션 검증을 수행한 결과를 기록한다.

총 **16개 세부 시나리오**(Direct Attacks 13건, Legitimate Production 1건, Malicious Production 2건)를 직접 인젝션 및 런타임 실행하였으며, 모든 공격 시도가 Sovereign Engine의 다층 방어선에 의해 차단(BLOCKED)되고 Zero-Mutation이 보장됨을 포렌식 증거로 확인하였다.

```text
Attacks:               13/13 BLOCKED
Legitimate Production: 1/1 ALLOWED + COMMIT
Malicious Production:  2/2 BLOCKED + ZERO MUTATION
```

| 범주 (Category) | 시나리오 수 | 결과 (Verdict) | 상태 무결성 (Zero-Mutation) |
|---|---|---|---|
| Direct Attacks (`ATTACK`) | 13 | 13/13 BLOCKED | 100% 보존 (Zero-Mutation) |
| Legitimate Production (`LEGITIMATE_PRODUCTION`) | 1 | 1/1 ALLOWED + COMMIT | 정상 반영 (`stateVersion` 증가) |
| Malicious Production (`MALICIOUS_PRODUCTION`) | 2 | 2/2 BLOCKED | 100% 보존 (Zero-Mutation) |
| **합계** | **16** | **모든 방어 경계 수호** | **결함 없음 (무결성 검증 완료)** |

---

## 2. Attack Section 1: Attack Vector Mapping & Threat Model

```text
[공격 경로 1: Direct Bypass Attempt]
App.tsx / Malicious Client
      ↓ (MeaningTree 없이 actions[] 직접 송신)
SovereignEngine.submitProposal()
      ↓
[Check 1: Missing Tree Gate] ─── FAIL-CLOSED ───► REJECTED: COMPOSITION_PROJECTION_MISSING

[공격 경로 2: Projection Tampering Attempt]
App.tsx / Malicious Client
      ↓ (MeaningTree와 다른 actions[] 송신 - 변조, 추가, 삭제, 순서역전)
SovereignEngine.submitProposal()
      ↓
[Check 2: Consistency Projection Gate] ─── FAIL-CLOSED ───► REJECTED: COMPOSITION_PROJECTION_MISMATCH

[공격 경로 3: Valid MeaningTree + Malicious Payload Attempt]
App.tsx / Malicious Client
      ↓ (일치하는 MeaningTree + actions 송신, 그러나 ACL/스탯/인벤토리/버전 위반)
SovereignEngine.submitProposal()
      ↓
[Check 3: Deterministic Grammar & Projection] ──► PASS
      ↓
[Check 4: Authority ACL Gate] ──► REJECTED: UNAUTHORIZED_ACTION_FOR_SOURCE (LLM OVERWRITE 등)
      ↓
[Check 5: Immigration Claim Gate] ──► REJECTED: FORGED_CLAIM_REJECTED (Wildcard * 등)
      ↓
[Check 6: Causality Firewall Gate] ──► REJECTED: INVENTORY_OVERWRITE_PROHIBITED
      ↓
[Check 7: Mutation Boundary Gate] ──► REJECTED: INVALID_STAT_VALUE (1~30 경계 초과)
      ↓
[Check 8: State Integrity Gate] ──► REJECTED: STALE_STATE_CONFLICT (버전 불일치)
```

---

## 3. Attack Section 2: Missing MeaningTree Attacks

* **ATK-MISSING-01**: `meaningTree: undefined` 상태에서 `PLAYER` 소스의 `OVERWRITE_CHARACTER` action 주입
  * **결과**: `BLOCKED` (Zero-Mutation: `true`)
  * **사유**: `[COMPOSITION_PROJECTION_MISSING] Proposal has actions but no MeaningTree authority.`
* **ATK-MISSING-02**: Grammar 위반 Node(`ILLEGAL_ATOM` 기반 `MeaningNode`)를 가진 `meaningTree` 주입
  * **결과**: `BLOCKED` (Zero-Mutation: `true`)
  * **사유**: `[PROJECTION_INCONSISTENCY] [COMPOSITION_PROJECTION_INVALID] MeaningTree failed deterministic runtime projection.`

---

## 4. Attack Section 3: Projection Tampering Attacks

MeaningTree와 `proposal.actions` 간의 불일치를 시도한 6종 공격 분석:

* **ATK-TAMPER-01 (Type Mismatch)**: Tree는 `OVERWRITE_CHARACTER`, Action은 `OVERWRITE_WORLD_INFO`로 변조
  * **결과**: `BLOCKED` (`[COMPOSITION_PROJECTION_MISMATCH]`)
* **ATK-TAMPER-02 (Payload Value Tampering)**: Tree는 `strength: 18`, Action은 `strength: 29`로 변조
  * **결과**: `BLOCKED` (`[COMPOSITION_PROJECTION_MISMATCH]`)
* **ATK-TAMPER-03 (Action Injection)**: Tree는 1개 Action, Action 배열에는 추가 임의 Action 주입
  * **결과**: `BLOCKED` (`[COMPOSITION_PROJECTION_MISMATCH]`)
* **ATK-TAMPER-04 (Action Deletion)**: Tree는 유효한데 Action 배열을 `[]` 빈 배열로 제출
  * **결과**: `BLOCKED` (`[EMPTY_PROPOSAL_REJECTED]`, `[COMPOSITION_PROJECTION_MISMATCH]`)
* **ATK-TAMPER-05 (Action Order Tampering)**: ORDERED composition에서 Tree 프로젝션 순서와 반대로 Action 배열 순서 역전
  * **결과**: `BLOCKED` (`[COMPOSITION_PROJECTION_MISMATCH]`)
* **ATK-TAMPER-06 (Foreign Action Substitution)**: Character Tree에 전혀 무관한 `RECORD_DICE_RESULT` Action 주입
  * **결과**: `BLOCKED` (`[COMPOSITION_PROJECTION_MISMATCH]`)

---

## 5. Attack Section 4: Layer-Penetration Red Team

MeaningTree projection check를 통과하더라도 하위 방어벽이 무력화되지 않고 독립 작동하는지 증명:

* **ATK-LAYER-01 (Authority Layer)**: `source: 'LLM'`이 `OVERWRITE_CHARACTER`를 MeaningTree와 함께 송신
  * **결과**: `BLOCKED` (`[UNAUTHORIZED_ACTION_FOR_SOURCE] Action #1 (OVERWRITE_CHARACTER) is unauthorized for source 'LLM'.`)
* **ATK-LAYER-02 (Claim Layer)**: 와일드카드 `*` Claim 첨부 주입
  * **결과**: `BLOCKED` (`[FORGED_CLAIM_REJECTED] Attached claim #1 fails Immigration Gate signature or structure verification.`)
* **ATK-LAYER-03 (Causality Layer)**: `OVERWRITE_CHARACTER`를 통한 런타임 미입증 인벤토리 아이템 주입
  * **결과**: `BLOCKED` (`[INVENTORY_OVERWRITE_PROHIBITED] Runtime inventory mutation via OVERWRITE_CHARACTER is prohibited.`)
* **ATK-LAYER-04 (Mutation Layer)**: 스탯 범위 초과 주입 (`strength: 99`)
  * **결과**: `BLOCKED` (`[INVALID_STAT_VALUE] Action #1: OVERWRITE_CHARACTER stat 'strength' must be a finite integer between 1 and 30. Received: 99`)
* **ATK-LAYER-05 (State Integrity Layer)**: 이전 stale version (`expectedStateVersion: 0`) 주입
  * **결과**: `BLOCKED` (`[STALE_STATE_CONFLICT] Proposal expected state version 0, but current sovereign state is at version 1.`)

---

## 6. Attack Section 5: Composition Edge Cases

* **Order Preservation**: `ORDERED` 컴포지션 시 자식 노드 순서가 프로젝션 결과 순서와 엄격 일치 검증.
* **Deterministic Canonical Projection**: `UNORDERED` 컴포지션 시 자식 노드 선언 순서와 무관하게 사전식 표준화 순서로 프로젝션되어 결정론적 일관성 검증.
* **Recursive Nesting**: `ORDERED` 내부에 `UNORDERED`가 포함된 다층 트리 구조에서도 중첩 의미 보존 및 프로젝션 일치 검증.

---

## 7. Attack Section 6: Independent Production Authority Proof

`src/App.tsx`의 실제 프로덕션 핸들러 `handleUpdateCharacter()` 파이프라인 실시간 실행 증명:

* **PROD-AUTH-01 (정규 프로필 갱신)**:
  * 입력: `appearance: '눈빛이 매서운 중년 검객'`, `goal: '복수를 완수한다'`, `age: 24`
  * 결과: `SUCCESS`
  * 커밋 확인: `snapshot.character.appearance`, `snapshot.character.goal`, `snapshot.character.age` 정상 커밋, `stateVersion` 1 -> 2 단항 증가.
* **PROD-AUTH-02 (악의적 스탯 변조 시도)**:
  * 입력: `stats.agility: 99`
  * 결과: `REJECTED` (`[INVALID_STAT_VALUE]`)
  * 상태 확인: Zero-Mutation (`stateVersion` 2 유지, 스탯 불변).
* **PROD-AUTH-03 (악의적 인벤토리 변조 시도)**:
  * 입력: 임의 인벤토리 아이템 주입
  * 결과: `REJECTED` (`[INVENTORY_OVERWRITE_PROHIBITED]`)
  * 상태 확인: Zero-Mutation (`stateVersion` 2 유지, 인벤토리 불변).

---

## 8. Constitutional Invariant Compliance Audit

1. **제6조 (양방향 Truth Boundary)**: App UI는 더 이상 Proposal을 임의로 생성하지 않으며 반드시 `MeaningTree` -> `adaptMeaningTreeToProposal()` -> `SovereignEngine` 단일 관문을 통과함. (COMPLIANT)
2. **제12조 (단일 상태 변경 관문) & 제13조 (Parse ≠ Validate ≠ Commit)**: MeaningTree 생성과 Proposal 구성은 제안일 뿐이며, Commit Gate의 다층 검증을 통과해야만 상태 변경이 성립함. (COMPLIANT)
3. **제21조 (CSPRNG 및 결정론적 로직)**: Projection 및 해싱 과정은 결정론적이며 불필요한 LLM 호출이나 무작위성 왜곡 없이 수행됨. (COMPLIANT)
4. **제59조 (Fail-Closed)**: MeaningTree 누락, 변조, 불일치 시 예외 없이 거부(Zero-Mutation)됨. (COMPLIANT)
5. **제67조/제69조 (개발 진실성 및 실제 증거 우선)**: 16개 레드팀 공격 벡터를 실제 실행하여 로그 및 JSON 원본 증거로 보존함. (COMPLIANT)

---

## 9. Final Red Team Determination
 
* **판정**: **ALL DEFENSE BOUNDARIES INTACT**
  * `Attacks: 13/13 BLOCKED`
  * `Legitimate Production: 1/1 ALLOWED + COMMIT`
  * `Malicious Production: 2/2 BLOCKED + ZERO MUTATION`
* **결론**: `handleUpdateCharacter()`의 `MeaningTree` 권위 이관은 엔진의 모든 보안 계층(Missing Tree Gate, Projection Consistency Check, Authority ACL, Claim Immigration Gate, Causality Firewall, Mutation Boundary, State Versioning)과 완벽하게 정합하며, 어떠한 우회 경로도 존재하지 않음을 확인하였다.
