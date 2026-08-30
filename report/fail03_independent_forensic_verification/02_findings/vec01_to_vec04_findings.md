# VEC-01 ~ VEC-04 Forensic Finding Details

## VEC-01: Causal Relevance 2-Char Token Substring Injection
- **Source File:** `src/engine/validator.ts`
- **Line Range / Symbol:** `EngineValidator.validate` / Causal connection check
- **Triggering Code in Runner (L100-173):**
  ```typescript
  const exploitProposal: StateTransitionProposal = {
    proposalId: 'prop-causal-exploit',
    requestId: 'req-causal-exploit',
    eventId: 'evt-causal-exploit',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Causal token substring exploit',
    actions: [{
      type: 'MODIFY_INVENTORY',
      payload: {
        operation: 'ADD',
        item: { id: 'item-god-slayer', name: '신살검 북쪽', quantity: 1 },
        acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'seed-ancient-dragon' }
      }
    }]
  };
  ```
- **Observed Validator Verdict:**
  ```json
  {
    "isValid": false,
    "rejectedReasons": ["[CAUSALITY_VIOLATION] Event 'seed-ancient-dragon' has no causal connection to item '신살검 북쪽'."],
    "conflictDetails": ["[CAUSALITY_VIOLATION] Action #1: Event 'seed-ancient-dragon' (북쪽 산맥의 고룡 수색...) has no causal connection to item '신살검 북쪽'."],
    "sanitizedActions": []
  }
  ```
- **Status:** `DEFENSE_HELD`. Zero mutation committed.

---

## VEC-02: Permanent Physical Defect Negation via Substring
- **Source File:** `src/engine/validator.ts`, `src/engine/actionApplier.ts`
- **Line Range / Symbol:** `applyOverwriteCharacter` in `src/engine/actionApplier.ts`
- **Triggering Code in Runner (L176-239):**
  ```typescript
  const exploitProposal: StateTransitionProposal = {
    proposalId: 'prop-defect-exploit',
    requestId: 'req-defect-exploit',
    eventId: 'evt-defect-exploit',
    expectedStateVersion: 1,
    source: 'PLAYER',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Defect negation exploit',
    actions: [{
      type: 'OVERWRITE_CHARACTER',
      payload: { name: 'BlindHero', physicalDefect: 'Not Blind (Completely Cured)' }
    }]
  };
  ```
- **Observed Validator Verdict:**
  ```json
  {
    "isValid": false,
    "rejectedReasons": ["[PHYSICAL_DEFECT_IMMUTABILITY] Physical defect cannot be negated or cured."],
    "conflictDetails": ["[PHYSICAL_DEFECT_IMMUTABILITY] Action #1: Cannot negate or cure existing canonical physicalDefect 'Blind' with 'Not Blind (Completely Cured)'."],
    "sanitizedActions": []
  }
  ```
- **Status:** `DEFENSE_HELD`. Zero mutation committed.

---

## VEC-03: Information Boundary Escalation via Field Omission
- **Source File:** `src/engine/mutationBoundary.ts`, `src/engine/state.ts`
- **Line Range / Symbol:** `validateLLM2MutationBoundary` in `src/engine/mutationBoundary.ts`
- **Triggering Code in Runner (L242-317):**
  Candidate proposal has `visibility: 'PRIVATE'`, final proposal omits `visibility`.
- **Status:** `DEFENSE_HELD`. State commit preserves information access level without unauthorized escalation.

---

## VEC-04: Fail-Closed Narrative Code Block Leakage
- **Source File:** `server.ts`, `src/engine/proposalParser.ts`
- **Line Range / Symbol:** `server.ts` candidate stripping / `parseGMResponseAndProposal`
- **Triggering Code in Runner (L320-387):**
  Raw LLM #2 text with failed candidate selection (`selectedCandidateId: 999`) and markdown code block.
- **Status:** `DEFENSE_HELD`. Client parser does not extract unauthorized actions when candidate selection fails closed.
