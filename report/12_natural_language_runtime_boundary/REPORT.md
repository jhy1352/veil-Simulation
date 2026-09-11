# 12. Natural Language Runtime Boundary Audit

## Scope

This audit advances the engine from isolated Commit-Gate tests toward the boundary where player natural-language intent is represented as a structured semantic interpretation and then routed through the existing runtime.

## Source-level finding

The current application path is:

`PLAYER INPUT -> /api/chat -> Gemini narrative/candidate interpretation -> candidate recovery -> CandidatePacket -> buildSafeProposalFromCandidate -> EngineValidator / SovereignEngine.submitProposal -> CanonicalState -> History -> Passport`

The client (`src/App.tsx`) does not itself convert player prose into a MeaningTree. The server performs candidate translation and proposal construction. Therefore a test that merely constructs a MeaningTree is **not** a Gemini inference E2E test.

## Test added

`src/engine/index/naturalLanguageRuntimeBoundaryTest.ts`

The test deliberately uses deterministic structured semantic fixtures as a stand-in for the LLM's interpretation. It then exercises the real textual proposal parser, MeaningTree recovery/grammar validation, adapter, PLAYER source, Sovereign Commit Gate, causality rejection, and zero-mutation boundary.

Scenarios:

1. Existing-world purchase expressed as Korean natural language -> atomic payment + acquisition commit.
2. Novel but legitimate player action -> canonical rumor only after Commit Gate acceptance.
3. Contradictory purchase -> causality rejection and byte-for-byte canonical-state preservation.

## Execution result

**PASS — executed in Studio.**

Authoritative command:

`npm run test:natural-language-runtime`

Observed result:

- Fixture facts entered CanonicalState through the real internal Commit Gate.
- Existing-world natural-language purchase passed recovery/grammar and MeaningTree validation, passed the Sovereign Commit Gate, and committed payment + acquired item atomically.
- Novel but legitimate player intent was accepted and became canonical only after Commit Gate acceptance.
- Genuinely contradictory purchase intent was rejected rather than inventing missing resources.
- The contradictory intent was denied by causality, not by blanket PLAYER source blocking.
- Rejected natural-language action preserved CanonicalState byte-for-byte and could not leak a forged item into canonical inventory.
- Total assertions reported by this suite: **19 PASS**.

## Important limitation

No Gemini API call is performed by this test. It therefore proves the **runtime boundary after semantic interpretation**, not the quality or correctness of Gemini's natural-language interpretation itself. This distinction is intentional to avoid spending external model quota and to prevent a fixture from being misrepresented as an LLM E2E result.

The complete stdout is preserved in `RAW_STDOUT.md` in this report folder.

## Acceptance criteria

- Normal player intent is accepted without player-supplied provenance hashes or VerifiedClaims when the resulting action is causally valid. **PASS**
- Novelty alone does not cause rejection. **PASS**
- Contradictory intent is rejected by causality/world constraints. **PASS**
- Rejected intent causes zero canonical mutation. **PASS**
- Internal-only action ACL remains separate from general PLAYER intent acceptance. **Covered by the test's existing ACL/runtime architecture; this suite does not add a separate internal-only assertion.**

## Conclusion

The deterministic natural-language runtime boundary is verified. The engine now has evidence that ordinary and novel player intent can cross interpretation, MeaningTree recovery, PLAYER proposal construction, and the Sovereign Commit Gate without requiring the player to forge internal provenance, while contradictory intent remains blocked by world causality and rejected turns remain non-mutating.

This does **not** constitute Gemini live E2E verification. The next forensic target is the actual `/api/chat` server path from player prose through Gemini/candidate generation and Candidate Recovery Gate into the same Commit Gate, with a minimal live-model test only if needed.
