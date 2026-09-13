# Raw Studio Execution Evidence

Command:

```bash
npm run test:natural-language-runtime
```

Observed stdout:

```text
> react-example@0.0.0 test:natural-language-runtime
> tsx src/engine/index/naturalLanguageRuntimeBoundaryTest.ts

=== Natural Language -> Runtime -> Canonical Commit Boundary ===
NOTE: The semantic interpretation below is deterministic test fixture data standing in for an LLM interpretation.
It does NOT claim to test Gemini inference itself. It tests the real textual parser, MeaningTree recovery, adapter, PLAYER source, Commit Gate, and zero-mutation rejection boundary.
✓ Fixture facts enter CanonicalState through the real internal Commit Gate
--- Normal Existing-World Natural-Language Action ---
✓ Player interpretation is extracted for: 대장장이에게 금화 세 닢을 주고 단검 하나를 만들어 달라고 한다.
✓ Player interpretation passes recovery/grammar for: 대장장이에게 금화 세 닢을 주고 단검 하나를 만들어 달라고 한다.
✓ MeaningTree exists at the runtime boundary for: 대장장이에게 금화 세 닢을 주고 단검 하나를 만들어 달라고 한다.
✓ Normal player natural-language action reaches and passes the Sovereign Commit Gate
✓ Natural-language purchase commits payment and acquired item atomically
✓ Natural-language purchase produces canonical inventory state
✓ Natural-language purchase deducts the actual canonical payment
--- Novel But Legitimate Natural-Language Action ---
✓ Player interpretation is extracted for: 여관에서 내일 상단이 도착한다고 사람들에게 알린다.
✓ Player interpretation passes recovery/grammar for: 여관에서 내일 상단이 도착한다고 사람들에게 알린다.
✓ MeaningTree exists at the runtime boundary for: 여관에서 내일 상단이 도착한다고 사람들에게 알린다.
✓ Novel player intent is not falsely rejected merely because it is new
✓ Novel natural-language intent becomes canonical only after Commit Gate acceptance
--- Genuinely Contradictory Natural-Language Action ---
✓ Player interpretation is extracted for: 금화 열 닢을 내고 장검을 산다. 실제로는 가진 금화가 일곱 닢뿐이다.
✓ Player interpretation passes recovery/grammar for: 금화 열 닢을 내고 장검을 산다. 실제로는 가진 금화가 일곱 닢뿐이다.
✓ MeaningTree exists at the runtime boundary for: 금화 열 닢을 내고 장검을 산다. 실제로는 가진 금화가 일곱 닢뿐이다.
✓ Contradictory natural-language intent is rejected instead of inventing missing resources
✓ Contradictory natural-language intent is denied by causality, not by PLAYER source blocking
✓ Rejected natural-language action preserves CanonicalState byte-for-byte
✓ Rejected natural-language action cannot leak a forged item into canonical inventory
=== Natural Language -> Runtime -> Canonical Commit: PASS ===
```

Result: **PASS**

Important scope limitation: this is a deterministic semantic-fixture runtime-boundary test. It does not test Gemini inference quality or make a live Gemini API call.
