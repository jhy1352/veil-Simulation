# TRPG 3.1 VEIL — RED TEAM CONFIRMED BREAKS REMEDIATION REPORT

**Target Repository**: `jhy1352/3.1veil1`  
**Evaluation Role**: World-Class Adversarial Red Team + Minimal-Diff Security Engineer  
**Date**: 2026-08-27  
**Engine Suite Status**: 90/90 Tests Passed (100%)  
**Security Posture**: Zero-Mutation on Rejection, Absolute Boundary Enforcement, Minimal Diff Compliance  

---

## 1. Executive Summary

This report documents the minimal-diff remediation and adversarial defeat of the 5 confirmed BREAK vulnerabilities (VEC-01 through VEC-05):
- **VEC-01 (V3-04)**: Arbitrary Source Forgery (`SAVE_HYDRATION`, `CLOUD_RESTORE`, and Unrecognized Sources).
- **VEC-02 (V3-05)**: Retrospective `GENESIS` Source Exploitation on Active Game Turns.
- **VEC-03 (V4-01)**: Substring / Partial Token Overlap Bypass for Item Acquisition Causality.
- **VEC-04 (V2-03)**: Faction Influence Invariant Breach via `ADD_FACTION` & `OVERWRITE_WORLD_INFO`.
- **VEC-05 (V2-04)**: Faction Influence Cumulative Cap Overflow via `UPDATE_FACTION`.

All 5 root causes were closed directly at the single truth boundary in `src/engine/validator.ts` without inventing unauthorized rules or degrading existing valid semantics.

---

## 2. Root Cause Analysis & Remediation Details

### VEC-01 (V3-04): Privileged Source Spoofing
- **Root Cause**: `validator.ts` accepted unauthenticated external `SAVE_HYDRATION` and `CLOUD_RESTORE` proposals without verifying internal engine execution capability, allowing untrusted callers to spoof privileged sources.
- **Remediation**:
  1. Defined strict whitelist `VALID_PROPOSAL_SOURCES = ['PLAYER', 'LLM', 'GENESIS', 'SYSTEM', 'ENGINE_INTERNAL', 'SAVE_HYDRATION', 'CLOUD_RESTORE']`.
  2. Applied `isEngineAuthorized(internalCapability)` check for `SAVE_HYDRATION` and `CLOUD_RESTORE`, matching the existing protection for `SYSTEM` and `ENGINE_INTERNAL`.
  3. Non-whitelisted or unauthorized privileged sources are rejected immediately with `SECURITY_FORGERY`.
- **Verification**: `TEST-VEC-01-V3-04-SOURCE-FORGERY` (PASS) + `TEST-SEC-4A/B/C/D` (PASS).

### VEC-02 (V3-05): Retrospective GENESIS Abuse
- **Root Cause**: `GENESIS` source proposals were permitted even after the game had progressed beyond the initial genesis turn, allowing arbitrary retrospective state mutations.
- **Remediation**:
  1. Enforced genesis turn boundary: `if (proposal.source === 'GENESIS' && (currentState.turn > 0 || currentState.stateVersion > 1))` -> REJECT with `SECURITY_FORGERY`.
  2. Preserved legitimate initial genesis initialization while shutting down all post-genesis injection routes.
- **Verification**: `TEST-VEC-02-V3-05-RETROSPECTIVE-GENESIS` (PASS).

### VEC-03 (V4-01): Partial Token Overlap Causality Exploitation
- **Root Cause**: Item acquisition causality verification utilized substring matching (`includes()`), allowing an unrelated item (e.g. "화산 파괴검") to pass verification against an unrelated seed (e.g. "화산 둥지에 놓여있는 단 하나의 용의 알") due to the accidental token "화산".
- **Remediation**:
  1. Enhanced causal item entity extraction: split seed/event text into word tokens and matched complete phrases or multi-word item entities (minimum length >= 2 and word boundary / token match).
  2. Disallowed single short-word false positives that do not represent the actual entity in the grounded event.
- **Verification**: `TEST-VEC-03-V4-01-CAUSAL-TOKEN-OVERLAP` (PASS) + `TEST-CAUSALITY-A~J` (PASS).

### VEC-04 & VEC-05 (V2-03 & V2-04): Faction Influence Invariants
- **Root Cause**: `ADD_FACTION`, `UPDATE_FACTION`, and `OVERWRITE_WORLD_INFO` lacked total cumulative influence boundary checks, allowing factions to exceed the total world influence limit (<= 100) or specify invalid values (< 0 or > 100).
- **Remediation**:
  1. In `ADD_FACTION`: Enforced `0 <= newInfluence <= 100` and `existingTotalInfluence + newInfluence <= 100`.
  2. In `UPDATE_FACTION`: Enforced `0 <= targetInfluence <= 100` and `otherFactionsTotalInfluence + targetInfluence <= 100`.
  3. In `OVERWRITE_WORLD_INFO`: Enforced `totalFactionsInfluence <= 100`.
- **Verification**: `TEST-VEC-04-V2-03-FACTION-INFLUENCE-INVARIANT` (PASS) and `TEST-VEC-05-V2-04-UPDATE-FACTION-INFLUENCE-INVARIANT` (PASS).

---

## 3. Test Evidence & Forensic Verification Summary

- **Total Test Cases**: 90
- **Passed**: 90 (100%)
- **Failed**: 0 (0%)
- **Zero-Mutation**: Confirmed across all rejected attack vectors (state version unchanged, no partial mutations).
- **TypeScript Compilation**: Clean (0 errors).
- **Vite/SPA Build**: Clean (0 errors).
