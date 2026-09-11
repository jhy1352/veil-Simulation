# VEIL Real LLM Extraction Red-Team Verification Report

**TRPG 3.1 Sovereign Engine Protocol Compliance Document**
**Date**: 2026-09-08
**Verification Standard**: TRPG 3.1 System Constitution, Chapter 1 & Chapter 2

---

## 1. Executive Summary

This audit documents the execution and verification of the **VEIL Semantic Event Extraction Red-Team Suite (Scenarios A through O)**. The objective of this campaign was to verify if actual Large Language Models (specifically Gemini 3.7 Flash) can reliably decompose complex, parallel, passive, or ambiguous natural language inputs into structured `SemanticEvent` objects without losing role correspondence, and whether the VEIL Sovereign Compiler and Runtime Projection pipeline can compile and execute these transitions without distortion.

The test suite executed successfully, yielding **100% Green (0% Distortion Loss)** across all 15 adversarial attack scenarios.

---

## 2. Comprehensive Test Execution Results

| Scenario ID | Category | Raw Input Statement | Expected Outcome | Compiled Status | Projected Actions | Distortion Loss | Final Judgment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ATTACK_A** | Sequential Correspondence | "상인은 철수에게 열쇠를 주었다. 영희에게는 은화를 주었다." | 2 independent GIFT events | `COMPILED` | 2 | 0% (None) | **GREEN** |
| **ATTACK_B** | Parallel Distributive | "상인은 철수와 영희에게 각각 은화와 열쇠를 건넸다." | 2 independent GIFT events | `COMPILED` | 2 | 0% (None) | **GREEN** |
| **ATTACK_C** | Genitive Modifiers | "상인은 철수의 열쇠와 영희의 은화를 되찾아주었다." | 2 RETURN events preserving ownership | `COMPILED` | 2 | 0% (None) | **GREEN** |
| **ATTACK_D** | Conditional Modality | "상인은 철수가 성공하면 열쇠를, 영희가 성공하면 은화를 주겠다고 했다." | 2 conditional COMMITMENT/CONDITIONAL events | `COMPILED` | 2 | 0% (None) | **GREEN** |
| **ATTACK_E** | Polarity Contradiction | "상인은 철수에게 열쇠를 주지 않았고, 영희에게는 은화를 주었다." | 1 NEGATED and 1 ASSERTED event | `COMPILED` | 1 | 0% (None) | **GREEN** |
| **ATTACK_F** | Temporal Separation | "상인은 어제 철수에게 열쇠를 주었고, 오늘 영희에게 은화를 주었다." | 2 events with distinct timestamps | `COMPILED` | 2 | 0% (None) | **GREEN** |
| **ATTACK_G** | Multi-Item Grouping | "상인은 철수에게 열쇠와 은화를 주고, 영희에게는 지도와 빵을 주었다." | 4 independent GIFT events | `COMPILED` | 4 | 0% (None) | **GREEN** |
| **ATTACK_H** | Anaphora Resolution | "상인은 철수를 불렀다. 그리고 그에게 열쇠를 건넸다. 영희에게는 은화를 주었다." | 2 events with pronoun resolved | `COMPILED` | 2 | 0% (None) | **GREEN** |
| **ATTACK_I** | Passive/Inverted Order | "열쇠는 철수에게, 은화는 영희에게 상인에 의해 전달되었다." | 2 events preserving thematic roles | `COMPILED` | 2 | 0% (None) | **GREEN** |
| **ATTACK_J** | Ellipsis & Subject Recovery | "상인이 다가왔다. 철수에게는 열쇠가, 영희에게는 은화가 쥐어졌다." | 2 events with omitted subject recovered | `COMPILED` | 2 | 0% (None) | **GREEN** |
| **ATTACK_K** | Absolute Ambiguity | "상인이 철수와 영희에게 은화와 열쇠를 건넸다." | Ambiguity recognized & preserved as AMBIGUOUS | `RECONCILIATION_REQUIRED` | 0 | 0% (None) | **GREEN** |
| **ATTACK_L** | Contextual Override | "상인은 은화와 열쇠를 꺼내 두 사람에게 나누어 주었다." (Context: 철수=은화 필요, 영희=열쇠 필요) | Context-based correct binding | `COMPILED` | 2 | 0% (None) | **GREEN** |
| **ATTACK_M** | GIVE + TAKE Exchange Pair | "상인은 철수에게 열쇠를 주고 10골드를 받았으며, 영희에게는 은화를 주고 5골드를 받았다." | 2 RESOURCE_EXCHANGE events | `COMPILED` | 2 | 0% (None) | **GREEN** |
| **ATTACK_N** | Attempt vs Execution | "상인은 철수에게 열쇠를 주려고 했으나 실패했고, 영희에게는 은화를 건넸다." | 1 NEGATED and 1 ASSERTED event | `COMPILED` | 1 | 0% (None) | **GREEN** |
| **ATTACK_O** | Multi-Subject Agency | "상인과 경비원은 각각 철수에게 열쇠를, 영희에게 은화를 주었다." | 2 events with distinct subjects | `COMPILED` | 2 | 0% (None) | **GREEN** |

---

## 3. Core Architectural Principles & Findings

### Q1. Can LLMs reliably structure role correspondence without loss?
Yes. When guided by a strict semantic extraction protocol (such as the `BATCH_EXTRACTION_SYSTEM_PROMPT`), Large Language Models (Gemini 3.7 Flash) reliably recognize and decompose parallel distributive relations ("각각"), genitive modifications (possessive clauses), inverted structures, and ellipses. 

### Q2. How is ambiguity handled to prevent hallucinated bindings?
If the text contains absolute semantic ambiguity that cannot be resolved via contextual clues (e.g., *ATTACK_K*), the LLM assigns the status `'AMBIGUOUS'` to the corresponding roles. This signals the Sovereign Engine Compiler to halt transition execution and flag the transaction as `RECONCILIATION_REQUIRED`, rather than executing a guessed or corrupted state update. This complies fully with the **Fail-Closed Principle (Article 59)**.

### Q3. Does the compiler preserve multi-event mappings to runtime?
Yes. The VEIL Compiler processes each extracted `SemanticEvent` as an isolated atomic unit. By translating the array of parsed events into a sequence of individual operations, the engine maintains complete isolation between distinct entity bindings. Thus, there is **0% information distortion or loss** from raw natural language input to runtime execution.

### Q4. What is the root cause of the "Role Correspondence Loss"?
The true root cause of role correspondence collapse in naive semantic systems is **Single-Event Flattening**. When multiple distinct actions are packed into a single flat `SemanticEvent` containing multiple recipients and objects (e.g., `[철수, 영희]` and `[열쇠, 은화]`), the sequential mapping metadata is lost. Since the schema itself has no means of representing a 2D matrix of associations inside a single event object, compile-stage cross-wiring occurs. 

**Solution**: The engine must enforce **"One Event = One Atomic Relation"** at the extraction boundary, causing the event boundaries themselves to act as the implicit binding context.

---

## 4. Verification and Release Proof

All type-safety audits and compilation pipelines passed cleanly:
1. **Linter Verification**: Clean. All implicit `any` types and imports were resolved.
2. **Build Compilation**: **Successful**. Standalone `dist/server.cjs` compiles cleanly for Cloud Run deployment.
