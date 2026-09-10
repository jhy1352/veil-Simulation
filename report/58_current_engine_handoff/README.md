# VEIL Engine — Current Forensic Handoff

## 0. Handoff purpose

이 문서는 다음 참모/AI가 `work/identity-continuity`의 VEIL Engine 작업을 즉시 이어갈 수 있도록, 현재까지의 핵심 포렌식 결과와 미해결 문제를 하나의 기준점으로 보존한다.

**이 문서는 새로운 설계 제안서가 아니다.** 기존 코드/런타임 포렌식 결과를 이어가기 위한 handoff 문서다.

Evidence policy:
- 코드와 실제 런타임 증거가 보고서/LLM 주장보다 우선한다.
- 모든 판정은 FACT / INFERENCE / HYPOTHESIS / UNKNOWN으로 구분한다.
- 정적 분석으로 확정할 수 없는 것은 실전 런타임 필요로 명시한다.
- 기존 보고서가 PASS/VERIFIED라고 주장해도 현재 코드가 확인되지 않으면 다시 검증한다.

## 1. 현재 기준점

- Repository: `jhy1352/veil-Simulation`
- Branch: `work/identity-continuity`
- Current branch HEAD: `5405bb33d7c87c2df44703c1e168ebc3a4e1cf8a`
- Current HEAD commit message: `docs: preserve VEIL partnership strategy and full engine handoff state`
- Engine/runtime evidence baseline: `ad4b085052040608f91772d8b6dcdb82973bb9b5`
- Code parent before current documentation/narrative-db commits: `ad4b085...`

The five commits after `ad4b085...` were checked at the branch-history level. They are documentation / Human Narrative research additions rather than engine implementation changes. Therefore the engine findings below remain tied to the audited engine state unless a later engine-specific commit is introduced.

## 2. VEIL architecture that must be preserved

Target authority pipeline:

`Player / LLM → Candidate → Identity Resolution → MeaningTree → Proposal → PreAuth → Sovereign Commit → Canonical State → Immutable History → NovelHistory → Passport Projection → UI / Save`

Core constitutional rule:

- LLM is narrative intelligence/reasoning/expression, not world-state authority.
- Player input is not automatically canonical fact.
- Narrative output is not automatically canonical truth.
- Only validated proposals may mutate Canonical State.
- Prefer one canonical state, one sovereign write authority, one commit gate, one validation model.

Strong existing architecture to preserve:

- `SovereignEngine.submitProposal()` as the sovereign mutation entryway.
- `stateVersion`, `requestId`, `eventId`, `previousStateHash`.
- deterministic replay / hydration validation.
- MeaningTree projection consistency.
- Identity Resolver statuses: EXACT / RECOVERED / NOVEL / AMBIGUOUS / CONFLICT.
- Index miss is not Novel.
- Novel/CANON lifecycle preserves lineage.
- Passport is a projection, not an authority.
- Server PreAuth is not the final commit; App performs the sovereign commit.
- Commit failure must not produce a successful mutation narrative.
- Inventory acquisition validation requires causal authority, verified event identity, duplicate-event protection, item relevance, and provenance constraints.

## 3. Known unresolved / unproven engine issues

### P0 — local persistence / storage integrity

**FACT**

The client persistence payload grows with major state and history structures including, depending on current payload shape:
- character
- worldInfo
- messages
- engineState
- history
- diagnostics
- novelHistory
- passports
- traces
- latency
- checkpoints
- pendingCandidates
- related session data

Save failure has been observed in the audited design as a warning path rather than an integrity boundary.

**Risk**

Canonical in-memory state can continue advancing while durable browser storage remains stale. A later refresh can therefore restore an older state.

**Classification: RED / P0**

This is not merely a performance optimization. It is a potential world-preservation failure.

**Required direction**

Do not simply increase limits or hide warnings. Design a structural persistence strategy that makes durable-state failure explicit and prevents silent divergence between canonical runtime state and recoverable state.

**Runtime requirement**

Exact practical turn threshold requires real runtime/storage measurement across realistic text-heavy campaigns.

---

### P1 — Passport projection scaling

**FACT**

Passport projection can repeatedly scan and sort historical records.

**Risk**

Projection cost grows with history size and can become a long-campaign bottleneck.

**Classification: YELLOW → potentially RED at scale**

Do not optimize by weakening historical truth. Prefer incremental/indexed projection or another structurally bounded mechanism.

---

### P1/P2 — repeated historical scans

**FACT**

Identity / Novel / Inventory validation paths can repeatedly scan `historicalRecords`.

**Risk**

Long campaigns can accumulate avoidable validation cost.

**Classification: YELLOW**

Exact threshold is UNKNOWN without benchmark.

---

### P1 — Narrative Authority Gap

**FACT**

The corrected Commit-First flow prevents a failed canonical commit from being shown as a successful state mutation. However, after a successful commit, the raw Phase 2 narrative text is not itself deterministically validated as a complete set of factual claims against the committed Canonical State.

Fallback non-mutation narrative has the same general gap.

**Risk**

Canonical state may remain correct while the displayed prose contains unsupported or incorrect factual assertions.

**Classification: YELLOW / RED depending the product promise**

If VEIL promises strict separation between truth and generated prose, this gap must be explicitly closed or bounded.

Important distinction:

`Canonical State correctness ≠ Narrative text correctness`

---

### P1 — Context continuity

**FACT**

App sends previous messages to `/api/chat`; the server uses a recent-message window (`messages.slice(-20)`). Canonical context is not guaranteed to occupy every request's literal model context.

**Risk**

During long play, the model may receive prior assistant narrative while losing direct access to critical canonical state/context unless that state is deterministically re-injected.

**Classification: RED for long-term continuity until hardened**

Required direction:
- Canonical context must have an explicit, deterministic injection path every relevant turn.
- Do not rely on the model remembering canonical facts from old prose.

---

### Candidate maximum-count enforcement defect

**FACT**

`parseCandidatesBlock()` previously sliced the raw candidate list to five before a later `candidates.length > 5` check.

**Risk**

If the model emits seven candidates, the parser can reduce them to five before the overflow validator observes the violation. The contract violation is therefore silently normalized away.

**Classification: YELLOW**

Required direction:
- validate raw cardinality before truncation;
- never silently convert an invalid model response into a valid-looking five-candidate response.

---

### `originInputId` provenance fallback

**FACT**

`buildSafeProposalFromCandidate()` previously contained an `originInputId || candidate.candidateId` fallback.

**Risk**

If the caller omits `originInputId`, provenance can collapse source-input identity into candidate identity.

**Classification: YELLOW**

Required direction:
- source identity should be mandatory at the boundary where provenance matters;
- avoid silently minting substitute provenance identifiers.

---

### Recovery / Triage runtime integration

**FACT**

Recovery semantics were defined as grammar / format / interpretation repair without inventing meaning.

The following rule was explicitly rejected:
- automatic EOF unterminated-string closure by appending a quote.

Accepted recovery philosophy:
- deterministic terminal-comma / EOF closure only where the structural closure is unique;
- unrecoverable candidate is removed individually rather than destroying the entire candidate batch;
- Recovery and Triage are distinct concepts.

Prior static forensic work did not establish a proven direct runtime call from the actual LLM path into Triage/recovery diagnostics such as `diagnoseForRecovery()`.

**Classification: UNKNOWN until current code is re-audited**

Do not assume a helper existing/exported means the production path invokes it.

---

### Causal compiler runtime integration

**FACT from prior audit**

- `causalCompiler.ts` exists.
- Prior `server.ts` audit found no direct import/use of it.
- `parseNaturalLanguageToEvents()` was pattern-based rather than a general causal compiler.
- Event IDs in that path used `Date.now()` despite deterministic-compiler intent.
- `src/engine/language/index.ts` did not export the causal compiler in the audited state.

**Classification: UNKNOWN until current code is re-audited**

**Critical invariant**

Do NOT weaken the causal validator just to make normal play pass.

Correct rule:

- If an acquisition/action cannot be grounded through a valid causal path against Canonical State / History / World Rules → DENY.
- Lack of an explicit natural-language cause must NOT automatically mean DENY if a valid causal path can be deterministically derived and grounded.
- A natural-language cause label alone is not proof.

The upstream compiler/grounding layer should make legitimate natural-language actions structurally representable; the validator should remain strict.

---

### runtimeProjection causal restrictions

**FACT from prior audit**

`runtimeProjection.ts` rejects actions whose causal dependency is marked as:

- CLAIM
- HEARSAY
- UNPROVEN
- NEGATED
- INTENTIONAL
- POSSIBLE
- COUNTERFACTUAL
- HYPOTHETICAL
- UNVERIFIED

**Classification: GREEN as an authority boundary**

Do not casually weaken these restrictions to solve downstream usability problems. First determine whether the upstream representation/grounding is incorrectly classifying legitimate causes.

## 4. Runtime narrative convergence evidence

Controlled runtime experiment preserved under:

`report/gemini-3.5-flash`

Experiment design:

- Run 1: 5 turns.
- Run 2: 5 turns.
- Same world preset.
- Same character.
- Same initial Canonical State.
- Same inventory / NPC / faction / history / foreshadowing / knowledge / context.
- Same model/settings/system prompt.
- Same exact player action sequence.
- Run 3 was stopped after Gemini API 429 and is not used as evidence.

Observed common five-turn skeleton:

`암벽 탐색 → 기괴한 석판 → 석판 조사 → 냉기 나는 틈새 → 고대 화산파 구결 → 구결 암송 → 석문 개방 → 거대한 비밀 공동`

Verdict:

- wording/style convergence: GREEN–YELLOW
- detail convergence: YELLOW
- candidate idea convergence: YELLOW–RED
- character behavior convergence: RED
- event progression convergence: RED
- causal structure convergence: RED
- place/device convergence: RED
- overall five-turn story skeleton: RED
- “always completely new story”: FAIL

**Interpretation**

This is evidence of higher-order narrative template convergence, not merely one repeated object/cliché.

This problem belongs primarily to the narrative-quality research track, but the engine must provide the boundaries and history needed to support later anti-convergence mechanisms.

## 5. Human Narrative Prior boundary

This is a separate workstream from core engine completion.

Proposed research pipeline:

`Human narrative corpus → AI-assisted structural analysis → recurring structure/mechanism extraction → generalization → current VEIL world/person/relationship/history/causal state → novel concrete instantiation → final narrative`

Status:

- The hypothesis that this can improve narrative quality is **UNKNOWN**.
- It must not be presented as proven technology.
- Human Narrative Prior is a creative prior / choice-space, not truth authority.
- It must never directly mutate Canonical State.
- The purpose of the engine remains world/state/causal authority and continuity; narrative generation remains the LLM's role.

## 6. What is NOT a current engine failure

The following must not be incorrectly reopened merely because they appear in old reports:

- Core sovereign mutation architecture is not known to be bypassed.
- `SovereignEngine.submitProposal()` remains the intended single mutation authority.
- Commit-first narrative display fix is established in prior forensic work.
- Identity Resolver's EXACT / RECOVERED / NOVEL / AMBIGUOUS / CONFLICT model is structurally strong.
- Index miss ≠ Novel is an important invariant.
- Passport is projection, not authority.
- Novel/CANON lineage preservation is a strength.
- Deterministic replay/hash-chain concepts are strong foundations.
- Inventory acquisition has strong causal/provenance checks.

These are **existing strengths**, not reasons to stop auditing.

## 7. Immediate next forensic sequence

### Priority 1 — Causal Language

Re-read current branch code from the actual entry point and trace:

`Player natural language → server request → LLM candidate → parser/recovery → candidate adapter → causal compilation → MeaningTree / Proposal → PreAuth → Sovereign Commit`

Questions:

1. Is `causalCompiler` actually invoked?
2. Is natural language converted into structured causal evidence?
3. Is the generated causal evidence grounded against Canonical State/History/World Rules?
4. Are event IDs deterministic?
5. Are valid ordinary actions incorrectly denied?
6. Can ungrounded natural-language labels bypass the validator?

If static tracing cannot establish runtime behavior: **실전 런타임 필요**.

### Priority 2 — Persistence

Trace the complete save/load lifecycle and identify the first point at which canonical state can diverge from durable state.

Target:
- bounded payload growth;
- explicit save failure semantics;
- no silent stale-state recovery;
- preservation of canonical history integrity.

### Priority 3 — Narrative Authority

Determine whether VEIL's intended promise requires deterministic validation of generated prose claims after commit.

If yes, design a structural claim-validation boundary rather than ad-hoc phrase filtering.

### Priority 4 — Context continuity

Guarantee canonical state/context injection on every model request without depending on old narrative messages.

### Priority 5 — Contract/provenance hardening

- candidate count validation before truncation;
- mandatory/strict `originInputId` provenance;
- re-audit Recovery/Triage runtime integration.

### Priority 6 — Historical projection scaling

Benchmark Passport and historical validators; replace repeated full-history scans with structurally bounded/indexed mechanisms where justified.

### Priority 7 — Final long-play validation

Only after the above structural issues are resolved:

- normal-play campaign;
- hostile/red-team campaign;
- refresh/hydration tests;
- persistence failure tests;
- long-history performance tests;
- narrative/canonical divergence tests.

## 8. Required forensic operating procedure

For every future issue:

1. Identify exact current branch HEAD.
2. Read the actual current code.
3. Lock relevant file SHA(s).
4. Trace caller → callee, not merely symbol existence.
5. Classify FACT / INFERENCE / HYPOTHESIS / UNKNOWN.
6. Reproduce statically where possible.
7. If static evidence is insufficient, mark **실전 런타임 필요**.
8. Do not weaken validators to hide upstream representation problems.
9. Prefer one structural correction over many isolated conditionals.
10. After implementation: diff-check and read-back verification.
11. Run targeted tests.
12. Preserve raw runtime evidence in `report/`.
13. Update this handoff when a P0/P1 item changes status.

## 9. Final state for next advisor

**Current reality:**

VEIL is not a finished commercial product. It has a substantial implemented engine architecture and has undergone repeated forensic/red-team work. The remaining work is not “nothing but polishing.” There are real unresolved P0/P1 reliability and integration issues, especially persistence, causal-language integration, context continuity, and narrative-authority boundaries.

At the same time, the core sovereignty architecture is sufficiently substantial that the correct next action is **continued engineering and forensic hardening**, not redesigning VEIL from scratch.

The engine can continue to be completed independently.

Separately, the demonstrated LLM narrative-convergence problem motivates the larger Human Narrative Prior research track. That track should remain separate from engine authority and should be treated as an experimental hypothesis until measured.

**Do not declare VEIL “complete” until the unresolved P0/P1 items have been re-audited against current code and the required runtime evidence exists.**
