# [VEC-04] Candidate Self-Minted Evidence → ImmigrationGate → VerifiedClaim 포렌식 검증 및 수정 보고서

## 1. 포렌식 검증 결과
- **검증 대상**: CandidatePacket을 통한 미검증 NPC 속성 및 사망 상태(`isDead`) 주입
- **수정 전 결론**: `CandidatePacket`이 스스로 생성한 미검증/허위 속성이 `buildSafeProposalFromCandidate()` 내부에서 `RECOVERY_GATE_CANDIDATE` 출처의 `ExternalEvidence`로 자가 발급(self-mint)된 후, `ImmigrationGate.admit()` 및 `EngineValidator.validate()`를 우회하여 `CanonicalState`를 영구 변조(Commit)할 수 있었음.

---

## 2. 최소 Diff 수정 내역 (`src/engine/proposalParser.ts`)
- `buildSafeProposalFromCandidate()` 함수 내부에서 `RECOVERY_GATE_CANDIDATE` 출처의 `ExternalEvidence` 및 `UntrustedClaim`을 생성하여 `ImmigrationGate.admit()`을 호출하는 Self-Minting 로직 삭제 (총 45줄 삭제).
- Candidate에서 요청한 `SET_NPC_STATUS` 및 `UPDATE_NPC` 액션 자체는 유지되나, `VerifiedClaim`이 수반되지 않으므로 `EngineValidator` 단계에서 `[CLAIM_AUTHORITY_VIOLATION]`으로 철저히 차단됨.

---

## 3. 수정 후 차단 검증
- `npx tsx scripts/vec04_deep_forensic_audit.ts` 실행:
  - Candidate 허위 속성 주입: `Commit Success: false` (`[CLAIM_AUTHORITY_VIOLATION]` 차단, Zero Mutation)
  - Candidate 허위 `isDead`: `Commit Success: false` (`[CLAIM_AUTHORITY_VIOLATION]` 차단, Zero Mutation)
- `npm run test:engine`: **95/95 All Passed**
