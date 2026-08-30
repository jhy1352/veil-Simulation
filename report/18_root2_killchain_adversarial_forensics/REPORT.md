# VEIL — ROOT 2 REMEDIATION ADVERSARIAL FORENSIC RED TEAM REPORT
**Kill-Chain & Semantic Grounding Forgery / Arbitrary Canonical Stat Mutation**

- **Audit Target Branch**: `veil-authority-fix`
- **Target Git HEAD SHA**: `d09397b52adac23eb7462dbc077eafdec2247b24`
- **Mode**: 최강 적대적 포렌식 레드팀 (0 Production Code Modification)
- **Report Date**: 2026-08-29
- **Evidence Storage**: `/report/18_root2_killchain_adversarial_forensics/raw_evidence.json`

---

## 1. EXECUTIVE SUMMARY & VERDICT

### 1.1 핵심 결론: **ROOT 2 REMEDIATION COMPLETELY BYPASSABLE (VULNERABILITY CONFIRMED)**
Git HEAD `d09397b`에 적용된 `UPDATE_CHARACTER_STATS` remediation은 **임의의 존재하는 Seed ID / History Event ID / Offscreen Event ID를 참조(`verifiedEventId`)하기만 하면 어떠한 의미적(Semantic)·인과적(Causal)·개체적(Entity) 타당성 검증도 없이 Canonical State를 임의 변조할 수 있는 중대 보안 결함(Grounding Forgery / Semantic Blindness Bypass)**을 내포하고 있음을 실제 런타임 공격을 통해 입증하였다.

또한 `proposalParser.ts` (라인 515-521)는 스냅샷 내에 `active` 상태인 Seed가 단 1개라도 존재하면, **LLM Candidate 패킷의 모든 스탯 변경 요청에 해당 Seed ID를 자동으로 `verifiedEventId`로 주입**하여 Validator의 차단 게이트를 스스로 무력화하는 **"Automated Auto-Bypass Pipeline"**을 형성하고 있다.

### 1.2 공격 전수 검증 통계 (17 Test Vectors)
- **Total Adversarial Test Vectors**: 17
- **EXPLOITED (공격 성공 / Canonical Mutation 발생)**: 11건 (Candidate 자동 주입 3건, Direct Proposal 6건, Multi-action 번들 1건, E2E 스냅샷 영구 잔존 1건)
  *(+ Baseline System Authorized 1건)*
- **BLOCKED (정상 차단 / Legitimate Defense)**: 5건 (Active Seed 전무 1건, Resolved Seed 1건, 순수 미인가 LLM 1건, 위조/미존재 Event ID 1건, Ungrounded 번들 원자적 거부 1건)
- **Production Code Modification**: **0 lines** (순수 Red Team Test Suite 및 포렌식 하네스로만 입증)

---

## 2. SOURCE CODE VULNERABILITY MAPPING (HEAD `d09397b`)

### 2.1 Target Gate 1: `src/engine/validator.ts` (Lines 1050–1123)
```typescript
// validator.ts:1095-1110
const isGroundedInEvent =
  Boolean(stats.verifiedEventId || stats.grounding) &&
  (
    (draftWorld.seeds || []).some(s => s.id === (stats.verifiedEventId || stats.grounding)) ||
    (historyRecords || []).some(h => h.eventId === (stats.verifiedEventId || stats.grounding)) ||
    (draftWorld.offscreenRecords || []).some(o => o.id === (stats.verifiedEventId || stats.grounding))
  );

if (hasVerifiedClaim || isGroundedInEvent || isPlayerSource || isGenesisSource) {
  // PROVENANCE VERIFIED! -> Passes validation and modifies draftCharacter.stats
}
```
**포렌식 결함 분석**:
1. **Semantic Blindness**: `s.content`, `h.details`, `o.description`에 대한 어떠한 텍스트/의미적 인과관계도 검사하지 않음. "독에 중독됨", "잡초 뽑기", "시간 경과", "타인의 훈련" 등 무관한 사건의 ID만 매칭되면 통과.
2. **Entity Blindness**: 해당 사건의 주체(Protagonist vs NPC)를 검증하지 않음 (`KILL-B07-CROSS-ENTITY-MISMATCH`).
3. **Grounding Alias Support**: `stats.verifiedEventId` 외에도 비공식 속성인 `stats.grounding`을 동일하게 허용 (`KILL-B03-DIRECT-LLM-GROUNDING-ALIAS`).

### 2.2 Target Gate 2: `src/engine/proposalParser.ts` (Lines 505–524)
```typescript
// proposalParser.ts:515-522
if (Object.keys(statsObj).length > 0) {
  const activeSeed = currentSnapshot.worldInfo.seeds.find(s => s.status === 'active');
  actions.push({
    type: 'UPDATE_CHARACTER_STATS',
    payload: {
      ...statsObj,
      ...(activeSeed ? { verifiedEventId: activeSeed.id } : {})
    } as any
  });
}
```
**포렌식 결함 분석**:
1. **Automated Exploit Ingestion**: LLM이 반환한 `candidate.statChanges`가 아무런 근거 없이 생성되었더라도, 스냅샷에 `active` seed가 존재하면 파서가 첫 번째 활성 Seed ID를 자동으로 `verifiedEventId`에 바인딩.
2. 이로 인해 LLM Candidate가 엔진의 Validator를 100% 통과하여 Canonical State를 변조하게 됨.

---

## 3. ADVERSARIAL TEST VECTORS & FORENSIC EVIDENCE BREAKDOWN

| Test ID | Category | Attack Payload | Target Gate | Verdict | Canonical State Delta | Forensic Evidence Summary |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **KILL-A01** | Candidate | `strength: +5` (No seeds) | `validator.ts:1050` | **BLOCKED** | State Version 1 유지, Stats 변화 없음 | Seed 부재로 `verifiedEventId` 미주입 -> Validator가 `PROVENANCE_VIOLATION`으로 차단. |
| **KILL-A02** | Candidate | `strength: +10` with Unrelated Poison Seed (`seed-unrelated-01`) | `validator.ts:1050` | **EXPLOITED** | **Version: 2 -> 3, Str: 10 -> 20** | 파서가 `seed-unrelated-01` 자동 주입 -> 단순 ID 존재로 통과 -> Str 20 커밋. |
| **KILL-A03** | Candidate | `strength: +10, agility: +10` with Amputation Seed (`seed-amputation`) | `validator.ts:1050` | **EXPLOITED** | **Version: 2 -> 3, Str: 10 -> 20, Agi: 10 -> 20** | 양팔 절단/척추 마비 시드에도 불구하고 ID 매칭으로 +10 힘/+10 민첩 승인. 극단적 인과 모순 발생. |
| **KILL-A04** | Candidate | `strength: +5` with Resolved Seed (`seed-resolved-01`) | `validator.ts:1050` | **BLOCKED** | State Version 2 유지, Stats 변화 없음 | 파서가 `status === 'active'`만 필터링하므로 resolved 시드는 주입 안 됨 -> 차단. |
| **KILL-B01** | Direct Proposal | `strength: 25` (Unbacked LLM proposal) | `validator.ts:1050` | **BLOCKED** | State Version 1 유지, Stats 변화 없음 | Claim/EventID 전무 -> Validator `PROVENANCE_VIOLATION` 정상 차단. |
| **KILL-B02** | Direct Proposal | `strength: 28` citing Tavern Rumor Seed (`seed-market-gossip`) | `validator.ts:1050` | **EXPLOITED** | **Version: 2 -> 3, Str: 10 -> 28** | LLM이 주점 소문 시드 ID를 기재하여 Validator 통과 -> 힘 28로 영구 변조. |
| **KILL-B03** | Direct Proposal | `constitution: 29` via `grounding: "seed-ancient-lore"` | `validator.ts:1050` | **EXPLOITED** | **Version: 2 -> 3, Con: 10 -> 29** | `stats.grounding` 별칭 속성을 통해 ID 매칭 성공 -> 체질 29로 변조. |
| **KILL-B04** | Direct Proposal | `charisma: 30` citing ADVANCE_TIME History ID | `validator.ts:1050` | **EXPLOITED** | **Version: 2 -> 3, Cha: 10 -> 30** | 단순 시간 경과 역사 기록 ID를 인용하여 매력 30으로 변조 커밋. |
| **KILL-B05** | Direct Proposal | `wisdom: 27` citing Far Bandit Raid Offscreen ID | `validator.ts:1050` | **EXPLOITED** | **Version: 2 -> 3, Wis: 10 -> 27** | 원거리 도적 습격 오프스크린 사건 ID를 인용하여 지혜 27로 변조 커밋. |
| **KILL-B06** | Direct Proposal | `intelligence: 30` citing Player Resting Seed | `validator.ts:1050` | **EXPLOITED** | **Version: 2 -> 3, Int: 10 -> 30** | PLAYER 소스 제안도 시드 ID 기재 시 게이트 우회 -> 지능 30 커밋. |
| **KILL-B07** | Direct Proposal | Protagonist `strength: 26` citing NPC Arthur Training Seed | `validator.ts:1050` | **EXPLOITED** | **Version: 2 -> 3, Str: 10 -> 26** | NPC 훈련 시드를 도용하여 주인공 스탯 상승 승격 (Entity Mismatch 우회). |
| **KILL-B08** | Direct Proposal | `agility: 24` with mixed fields (`cause`, `reason`, `verifiedEventId`) | `validator.ts:1050` | **EXPLOITED** | **Version: 2 -> 3, Agi: 10 -> 24** | 메타데이터 필드와 유효 ID 혼합 시 ID 우선 통과 -> 민첩 24 변조. |
| **KILL-B09** | Direct Proposal | `strength: 25` with non-existent Event ID | `validator.ts:1050` | **BLOCKED** | State Version 1 유지, Stats 변화 없음 | 존재하지 않는 ID는 검출되어 `PROVENANCE_VIOLATION` 차단. |
| **KILL-C01** | Multi-Action | `ADVANCE_TIME` + ungrounded `strength: 25` | `validator.ts:1050` | **BLOCKED** | State Version 1 유지 (Atomic Rejection) | 번들 내 ungrounded 액션으로 인해 전체 번들 원자적 거부. |
| **KILL-C02** | Multi-Action | `ADVANCE_TIME` + garden weeding seed `strength: 25` | `validator.ts:1050` | **EXPLOITED** | **Version: 2 -> 3, Str: 10 -> 25, Time: +1 Day** | 시드 ID가 붙은 스탯 변조와 시간 진행이 함께 원자적으로 커밋됨. |
| **BASELINE-D01** | Baseline | `SYSTEM` source authorized proposal (`strength: 18`) | `validator.ts:1063` | **EXPLOITED** *(Authorized)* | **Version: 1 -> 2, Str: 10 -> 18** | 엔진 내부 capability token을 보유한 정당한 시스템 소스는 정상 인가. |
| **KILL-E01** | E2E Snapshot | Mutated snapshot serialization & schema validation | Snapshot Export | **EXPLOITED** | **Snapshot Str: 18, Schema: Valid** | 변조된 스탯(Str: 18)이 스냅샷에 영구 반영되며 스키마 검증 100% 통과 확인. |

---

## 4. CONSTITUTIONAL VIOLATIONS CONFIRMED

본 레드팀 공격으로 입증된 헌법 조항 위반 사항:
1. **제2조 제1호, 제10호 (Canonical Truth & Unverified Mutation)**: 검증되지 않은 LLM 추론 및 플레이어 클레임이 단순 ID 매칭만으로 Canonical State를 변조함.
2. **제11조 (불가능한 상태의 승격 금지)**: 양팔 절단/척추 마비(`seed-amputation`) 상태에서 힘/민첩 20으로 상승하는 물리적 불가능 상태가 승인됨 (`KILL-A03`).
3. **제28조, 제40조 (Information Causality & Character Causality)**: 원거리 도적 습격, 주점 소문, NPC 훈련 등 인과관계가 결여된 사건을 근거로 캐릭터 스탯이 상승함.
4. **제84조 제1항, 제2항 (Absolute Rules)**: LLM/Player Output이 실질적인 인과 검증 없이 직접 Canonical State를 변경함.

---

## 5. MINIMAL ARCHITECTURAL REMEDIATION PROPOSAL (차기 작업 제안)

현 결함을 근본적으로 폐쇄하기 위해 필요한 최소 변경 설계:
1. **Proposal Parser의 Auto-Injection 제거 (`proposalParser.ts`)**:
   - `proposalParser.ts`에서 `activeSeed`를 임의로 탐색하여 `verifiedEventId`를 자동 주입하는 코드(lines 515-522) 전면 삭제.
   - LLM Candidate의 스탯 변경은 엔진 내부 판정(`DICE_ROLL`, `TRAINING_RESOLVER`, `SYSTEM_REWARD`)을 거쳐 생성된 정당한 `VerifiedClaim` 또는 명시적 인과 토큰이 있을 때만 승인하도록 제한.
2. **Validator의 Entity 및 Semantic 인과 바인딩 강화 (`validator.ts`)**:
   - 단순 ID 존재 체크(`some(s => s.id === id)`)를 폐기.
   - 해당 이벤트의 대상 개체(`targetEntityId === characterId`) 일치 여부 확인.
   - 스탯 상승을 명시적으로 허용하는 이벤트 타입(`EVENT_TYPE === 'STAT_TRAINING' | 'DIVINE_BLESSING' | 'PERMANENT_INJURY'`) 및 변화 허용 방향(buff/debuff)의 스키마 레벨 검증 강제.

---

## 6. FORENSIC EVIDENCE ARTIFACTS
- **Raw Evidence JSON**: `/report/18_root2_killchain_adversarial_forensics/raw_evidence.json` (1510 lines, 17 test cases with full before/after snapshots, state deltas, history records, and validator verdicts)
- **Adversarial Runner**: `/scripts/root2_killchain_adversarial_suite.ts`
